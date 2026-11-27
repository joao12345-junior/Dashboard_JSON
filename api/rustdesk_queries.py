# api/rustdesk_queries.py
"""
Consultas da auditoria do RustDesk (Repository Pattern): todo o SQL de leitura das
tabelas rustdesk_* (migracao 022) mora aqui; routes/rustdesk.py so' traduz HTTP.
Recebe cursor (RealDictCursor) e nao abre conexao: testavel sem banco.

Quem grava e' o coletor (collector/rustdesk_sync.py), a cada 5 min.
"""
from __future__ import annotations

from typing import Any, Optional

#: Retencao no banco do LogDash (o VPS guarda 52 semanas por conta propria).
RUSTDESK_RETENTION_DAYS = 365

DEFAULT_DAYS = 7
MAX_DAYS = 365
MAX_SESSIONS = 1000
SESSION_STATUSES = ("concluida", "aberta", "bloqueada", "tentativa")


class InvalidParameter(ValueError):
    """Parametro invalido (a rota responde 400)."""


def parse_days(raw: Optional[str], default: int = DEFAULT_DAYS) -> int:
    if raw is None or raw == "":
        return default
    try:
        days = int(raw)
    except ValueError:
        raise InvalidParameter("days deve ser um numero inteiro.")
    if days < 1 or days > MAX_DAYS:
        raise InvalidParameter(f"days deve estar entre 1 e {MAX_DAYS}.")
    return days


def parse_status(raw: Optional[str]) -> Optional[str]:
    if raw is None or raw == "":
        return None
    if raw not in SESSION_STATUSES:
        raise InvalidParameter(f"status deve ser um de: {', '.join(SESSION_STATUSES)}.")
    return raw


def parse_flag(raw: Optional[str]) -> bool:
    return (raw or "").strip().lower() in ("1", "true", "sim", "yes")


def _iso(row: dict, *keys: str) -> None:
    for key in keys:
        if row.get(key) is not None:
            row[key] = row[key].isoformat()


def _session_id_as_text(row: dict) -> None:
    # numeric(20) nao cabe num Number do JavaScript sem perder digitos: vai como texto.
    if row.get("session_id") is not None:
        row["session_id"] = str(int(row["session_id"]))


def list_sessions(
    cur, *, days: int, status: Optional[str], machine_id: Optional[str], include_test: bool
) -> dict[str, Any]:
    """
    Sessoes dos ultimos `days` dias, da mais nova para a mais antiga, com o nome da
    maquina acessada e, quando quem acessou tambem e' uma maquina conhecida (o PC do
    tecnico com RustDesk), o nome dela. Devolve tambem a contagem por status.
    """
    where = ["s.started_at >= now() - make_interval(days => %(days)s)"]
    params: dict[str, Any] = {"days": days, "limit": MAX_SESSIONS}
    if status:
        where.append("s.status = %(status)s")
        params["status"] = status
    if machine_id:
        where.append("s.machine_id = %(machine)s")
        params["machine"] = machine_id
    if not include_test:
        where.append("COALESCE(m.is_test, false) = false")
    where_sql = " AND ".join(where)
    cur.execute(
        f"""
        SELECT s.machine_id, m.hostname AS machine_name, COALESCE(m.is_test, false) AS machine_is_test,
               s.conn_id, s.started_at, s.authenticated_at, s.ended_at,
               s.peer_id, s.peer_name, s.peer_ip, p.hostname AS peer_hostname,
               s.primary_auth, s.conn_type, s.session_id, s.alarm_type, s.status
        FROM optsislog.rustdesk_sessions s
        LEFT JOIN optsislog.rustdesk_machines m ON m.machine_id = s.machine_id
        LEFT JOIN optsislog.rustdesk_machines p ON p.machine_id = s.peer_id
        WHERE {where_sql}
        ORDER BY s.started_at DESC, s.machine_id, s.conn_id
        LIMIT %(limit)s
        """,
        params,
    )
    sessions = cur.fetchall()
    for row in sessions:
        _iso(row, "started_at", "authenticated_at", "ended_at")
        _session_id_as_text(row)

    cur.execute(
        f"""
        SELECT s.status, count(*) AS n
        FROM optsislog.rustdesk_sessions s
        LEFT JOIN optsislog.rustdesk_machines m ON m.machine_id = s.machine_id
        WHERE {where_sql}
        GROUP BY s.status
        """,
        params,
    )
    counts = {status: 0 for status in SESSION_STATUSES}
    for row in cur.fetchall():
        counts[row["status"]] = int(row["n"])
    return {"sessions": sessions, "counts": counts, "truncated": len(sessions) >= MAX_SESSIONS}


def list_alarms(cur, *, days: int, include_test: bool) -> list[dict[str, Any]]:
    """Alarmes de senha (forca bruta) dos ultimos `days` dias."""
    test_sql = "" if include_test else "AND COALESCE(m.is_test, false) = false"
    cur.execute(
        f"""
        SELECT r.received_at, r.machine_id, m.hostname AS machine_name, r.conn_id, r.alarm_type,
               r.peer_id, r.peer_name, r.peer_ip
        FROM optsislog.rustdesk_audit_raw r
        LEFT JOIN optsislog.rustdesk_machines m ON m.machine_id = r.machine_id
        WHERE r.kind = 'alarm' AND r.received_at >= now() - make_interval(days => %(days)s) {test_sql}
        ORDER BY r.received_at DESC
        LIMIT 500
        """,
        {"days": days},
    )
    rows = cur.fetchall()
    for row in rows:
        _iso(row, "received_at")
    return rows


def list_machines(cur) -> list[dict[str, Any]]:
    """Maquinas que ja mandaram sysinfo ou foram acessadas, com o resumo de uso em 30 dias."""
    cur.execute(
        """
        WITH ids AS (
            SELECT machine_id FROM optsislog.rustdesk_machines
            UNION
            SELECT DISTINCT machine_id FROM optsislog.rustdesk_sessions
        ),
        usage AS (
            SELECT machine_id,
                   count(*) FILTER (WHERE started_at >= now() - interval '30 days') AS sessions_30d,
                   count(*) FILTER (WHERE status = 'bloqueada' AND started_at >= now() - interval '30 days')
                       AS blocked_30d,
                   max(started_at) AS last_session_at
            FROM optsislog.rustdesk_sessions
            GROUP BY machine_id
        )
        SELECT ids.machine_id, m.hostname, m.username, m.last_username, m.os, m.version,
               m.memory, m.source_ip, COALESCE(m.is_test, false) AS is_test,
               m.first_seen_at, m.last_sysinfo_at,
               COALESCE(u.sessions_30d, 0) AS sessions_30d, COALESCE(u.blocked_30d, 0) AS blocked_30d,
               u.last_session_at
        FROM ids
        LEFT JOIN optsislog.rustdesk_machines m ON m.machine_id = ids.machine_id
        LEFT JOIN usage u ON u.machine_id = ids.machine_id
        ORDER BY COALESCE(m.is_test, false), COALESCE(m.hostname, ids.machine_id)
        """
    )
    rows = cur.fetchall()
    for row in rows:
        _iso(row, "first_seen_at", "last_sysinfo_at", "last_session_at")
        row["sessions_30d"] = int(row["sessions_30d"])
        row["blocked_30d"] = int(row["blocked_30d"])
    return rows


def parse_test_flag_payload(body: Any) -> bool:
    if not isinstance(body, dict) or not isinstance(body.get("is_test"), bool):
        raise InvalidParameter("Corpo deve ser {\"is_test\": true|false}.")
    return body["is_test"]


def set_machine_test_flag(cur, machine_id: str, is_test: bool) -> None:
    """Marca/desmarca maquina de teste. Cria a linha se a maquina so' apareceu em sessoes."""
    cur.execute(
        """
        INSERT INTO optsislog.rustdesk_machines (machine_id, is_test)
        VALUES (%s, %s)
        ON CONFLICT (machine_id) DO UPDATE SET is_test = EXCLUDED.is_test
        """,
        (machine_id, is_test),
    )


def cleanup(cur, retention_days: int = RUSTDESK_RETENTION_DAYS) -> dict[str, int]:
    """
    Apaga avisos e sessoes mais antigos que a retencao. Sem a migracao 022 nao faz nada
    (a limpeza geral de logs nao pode quebrar por causa desta tabela).
    """
    cur.execute("SELECT to_regclass('optsislog.rustdesk_audit_raw') IS NOT NULL")
    row = cur.fetchone()
    exists = row[0] if isinstance(row, (tuple, list)) else next(iter(row.values()))
    if not exists:
        return {"raw": 0, "sessions": 0}
    cur.execute(
        "DELETE FROM optsislog.rustdesk_audit_raw WHERE received_at < now() - make_interval(days => %s)",
        (retention_days,),
    )
    raw = cur.rowcount
    cur.execute(
        "DELETE FROM optsislog.rustdesk_sessions WHERE started_at < now() - make_interval(days => %s)",
        (retention_days,),
    )
    return {"raw": raw, "sessions": cur.rowcount}
