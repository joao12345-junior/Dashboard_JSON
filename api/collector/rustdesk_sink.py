# api/collector/rustdesk_sink.py
"""
Gravacao da auditoria do RustDesk no PostgreSQL (porta de SAIDA + adaptador).

Um ciclo grava em DUAS transacoes:
  1. `save_batch`: avisos brutos (ON CONFLICT pelo hash da linha), estado das maquinas
     e o offset do arquivo, juntos. O offset so avanca se os avisos foram gravados:
     se cair no meio, o proximo ciclo rele o mesmo trecho e o hash evita duplicar.
  2. `replace_sessions`: refaz as sessoes da janela recente a partir da tabela bruta.
     Se falhar, o proximo ciclo refaz (e idempotente).
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional, Protocol, Sequence

from .rustdesk_audit import AuditEvent, RemoteSession, SysInfo
from .rustdesk_source import FileState


class RustDeskSink(Protocol):
    def load_state(self, file_name: str) -> Optional[FileState]: ...

    def save_batch(
        self, events: Sequence[AuditEvent], machines: Sequence[SysInfo], file_name: str, state: FileState
    ) -> int:
        """Grava e devolve quantos avisos eram novos."""
        ...

    def load_events(self, since: datetime) -> list[AuditEvent]: ...

    def replace_sessions(self, since: datetime, sessions: Sequence[RemoteSession]) -> None: ...

    def close(self) -> None: ...


class PostgresRustDeskSink:
    """Conexao PROPRIA (nao usa o pool do Flask), aberta sob demanda e descartada em erro."""

    def __init__(self) -> None:
        from .db_config import connection_kwargs

        self._kwargs = connection_kwargs()
        self._conn = None

    def _cursor(self):
        import psycopg2

        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(**self._kwargs)
        return self._conn.cursor()

    def load_state(self, file_name: str) -> Optional[FileState]:
        try:
            with self._cursor() as cur:
                cur.execute(
                    "SELECT read_offset, head_hash, head_len FROM optsislog.rustdesk_file_state WHERE file_name = %s",
                    (file_name,),
                )
                row = cur.fetchone()
            self._conn.commit()
        except Exception:
            self.close()
            raise
        return None if row is None else FileState(int(row[0]), row[1], int(row[2] or 0))

    def save_batch(
        self, events: Sequence[AuditEvent], machines: Sequence[SysInfo], file_name: str, state: FileState
    ) -> int:
        from psycopg2.extras import execute_values

        event_rows = [
            (
                e.line_hash, e.received_at, e.source_ip, e.path, e.kind, e.machine_id, e.conn_id, e.action,
                e.peer_id, e.peer_name, e.peer_ip, e.primary_auth, e.conn_type, e.session_id, e.alarm_type,
                json.dumps(dict(e.body), ensure_ascii=False),
            )
            for e in {e.line_hash: e for e in events}.values()
        ]
        machine_rows = [
            (
                m.machine_id, m.hostname, m.username, m.last_username, m.os, m.version, m.cpu, m.memory,
                m.uuid, m.source_ip, m.received_at,
            )
            for m in machines
        ]
        try:
            with self._cursor() as cur:
                inserted = 0
                if event_rows:
                    returned = execute_values(
                        cur,
                        """
                        INSERT INTO optsislog.rustdesk_audit_raw
                            (line_hash, received_at, source_ip, path, kind, machine_id, conn_id, action,
                             peer_id, peer_name, peer_ip, primary_auth, conn_type, session_id, alarm_type, body)
                        VALUES %s
                        ON CONFLICT (line_hash) DO NOTHING
                        RETURNING 1
                        """,
                        event_rows,
                        template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)",
                        fetch=True,
                    )
                    inserted = len(returned)
                if machine_rows:
                    # Sysinfo mais antigo que o gravado (releitura) nao sobrescreve o atual.
                    execute_values(
                        cur,
                        """
                        INSERT INTO optsislog.rustdesk_machines
                            (machine_id, hostname, username, last_username, os, version, cpu, memory,
                             uuid, source_ip, last_sysinfo_at)
                        VALUES %s
                        ON CONFLICT (machine_id) DO UPDATE SET
                            hostname = EXCLUDED.hostname,
                            username = EXCLUDED.username,
                            last_username = COALESCE(EXCLUDED.last_username, optsislog.rustdesk_machines.last_username),
                            os = EXCLUDED.os, version = EXCLUDED.version, cpu = EXCLUDED.cpu,
                            memory = EXCLUDED.memory, uuid = EXCLUDED.uuid, source_ip = EXCLUDED.source_ip,
                            last_sysinfo_at = EXCLUDED.last_sysinfo_at
                        WHERE optsislog.rustdesk_machines.last_sysinfo_at IS NULL
                           OR EXCLUDED.last_sysinfo_at >= optsislog.rustdesk_machines.last_sysinfo_at
                        """,
                        machine_rows,
                    )
                cur.execute(
                    """
                    INSERT INTO optsislog.rustdesk_file_state (file_name, read_offset, head_hash, head_len, updated_at)
                    VALUES (%s, %s, %s, %s, now())
                    ON CONFLICT (file_name) DO UPDATE SET
                        read_offset = EXCLUDED.read_offset, head_hash = EXCLUDED.head_hash,
                        head_len = EXCLUDED.head_len, updated_at = now()
                    """,
                    (file_name, state.offset, state.head_hash, state.head_len),
                )
            self._conn.commit()
            return inserted
        except Exception:
            self.close()
            raise

    def load_events(self, since: datetime) -> list[AuditEvent]:
        """Avisos de conexao e alarme desde `since` (base para refazer as sessoes)."""
        try:
            with self._cursor() as cur:
                cur.execute(
                    """
                    SELECT line_hash, received_at, source_ip, path, kind, machine_id, conn_id, action,
                           peer_id, peer_name, peer_ip, primary_auth, conn_type, session_id, alarm_type
                    FROM optsislog.rustdesk_audit_raw
                    WHERE kind IN ('conn', 'alarm') AND received_at >= %s
                    """,
                    (since,),
                )
                rows = cur.fetchall()
            self._conn.commit()
        except Exception:
            self.close()
            raise
        return [
            AuditEvent(
                line_hash=r[0], received_at=r[1], source_ip=r[2], path=r[3], kind=r[4], machine_id=r[5],
                conn_id=r[6], action=r[7], peer_id=r[8], peer_name=r[9], peer_ip=r[10], primary_auth=r[11],
                conn_type=r[12], session_id=int(r[13]) if r[13] is not None else None, alarm_type=r[14],
            )
            for r in rows
        ]

    def replace_sessions(self, since: datetime, sessions: Sequence[RemoteSession]) -> None:
        """Apaga as sessoes que comecaram na janela e grava as recalculadas (uma transacao)."""
        from psycopg2.extras import execute_values

        rows = [
            (
                s.machine_id, s.conn_id, s.started_at, s.authenticated_at, s.ended_at, s.peer_id, s.peer_name,
                s.peer_ip, s.primary_auth, s.conn_type, s.session_id, s.alarm_type, s.status,
            )
            for s in sessions
            if s.started_at >= since
        ]
        try:
            with self._cursor() as cur:
                cur.execute("DELETE FROM optsislog.rustdesk_sessions WHERE started_at >= %s", (since,))
                if rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO optsislog.rustdesk_sessions
                            (machine_id, conn_id, started_at, authenticated_at, ended_at, peer_id, peer_name,
                             peer_ip, primary_auth, conn_type, session_id, alarm_type, status)
                        VALUES %s
                        ON CONFLICT (machine_id, conn_id, started_at) DO NOTHING
                        """,
                        rows,
                    )
            self._conn.commit()
        except Exception:
            self.close()
            raise

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None
