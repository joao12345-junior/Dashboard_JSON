# api/collector/rustdesk_sync.py
"""
Job periodico da auditoria do RustDesk: roda numa thread DENTRO do servico
LogDashSyslog (como o sync de sites). A cada RUSTDESK_SYNC_MINUTES (padrao 5):

    1. abre UMA conexao SFTP com o VPS (o firewall de la limita a porta 22);
    2. le as linhas novas do avisos.jsonl desde o ultimo offset (rotacao incluida);
    3. grava os avisos brutos, o estado das maquinas e o novo offset;
    4. refaz as sessoes dos ultimos SESSION_WINDOW_DAYS a partir da tabela bruta.

Falha em qualquer passo so loga e espera o proximo ciclo (nunca reconecta em laco).

Configuracao (api/.env):
    RUSTDESK_SSH_HOST          obrigatoria (sem ela o job fica DESLIGADO)
    RUSTDESK_SSH_USER          padrao logreader
    RUSTDESK_SSH_KEY_PATH      chave privada ed25519 (fora do repositorio)
    RUSTDESK_SSH_KNOWN_HOSTS   arquivo com a chave do host (RejectPolicy)
    RUSTDESK_SFTP_DIR          padrao /rustdesk-audit
    RUSTDESK_SYNC_MINUTES      padrao 5, minimo 2
"""
from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, ContextManager, Optional

from .rustdesk_audit import build_sessions, latest_sysinfo, parse_lines
from .rustdesk_sink import RustDeskSink
from .rustdesk_source import AUDIT_FILE, RemoteFiles, read_new_lines

logger = logging.getLogger("rustdesk_sync")

DEFAULT_INTERVAL_MINUTES = 5
MIN_INTERVAL_MINUTES = 2
#: Sessoes refeitas a cada ciclo. Uma sessao aberta ha mais que isso fica como esta.
SESSION_WINDOW_DAYS = 7


@dataclass(frozen=True, slots=True)
class CycleResult:
    ok: bool
    lines: int = 0
    inserted: int = 0
    machines: int = 0
    sessions: int = 0
    invalid: int = 0
    rotated: bool = False
    error: Optional[str] = None


class RustDeskAuditJob:
    """Um ciclo completo. Nunca levanta excecao: devolve o resultado (o loop so loga)."""

    def __init__(
        self,
        open_files: Callable[[], ContextManager[RemoteFiles]],
        sink: RustDeskSink,
        *,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self._open_files = open_files
        self._sink = sink
        self._now = now

    def run_once(self) -> CycleResult:
        try:
            previous = self._sink.load_state(AUDIT_FILE)
            # A conexao SFTP fica aberta so durante a leitura.
            with self._open_files() as files:
                result = read_new_lines(files, previous)
            batch = parse_lines(result.lines)
            machines = latest_sysinfo(batch.sysinfos)
            inserted = self._sink.save_batch(batch.events, machines, AUDIT_FILE, result.state)
        except Exception as e:
            return CycleResult(ok=False, error=f"{type(e).__name__}: {e}")

        sessions = 0
        try:
            now = self._now()
            since = now - timedelta(days=SESSION_WINDOW_DAYS)
            rebuilt = build_sessions(self._sink.load_events(since), now)
            self._sink.replace_sessions(since, rebuilt)
            sessions = len(rebuilt)
        except Exception as e:
            # Os avisos ja estao gravados: so as sessoes ficam para o proximo ciclo.
            return CycleResult(
                ok=False, lines=len(result.lines), inserted=inserted, machines=len(machines),
                invalid=batch.invalid, rotated=result.rotated, error=f"sessoes: {type(e).__name__}: {e}",
            )
        return CycleResult(
            ok=True, lines=len(result.lines), inserted=inserted, machines=len(machines),
            sessions=sessions, invalid=batch.invalid, rotated=result.rotated,
        )


def read_interval_minutes(raw: Optional[str]) -> float:
    if raw is None or not raw.strip():
        return float(DEFAULT_INTERVAL_MINUTES)
    try:
        return max(float(raw), float(MIN_INTERVAL_MINUTES))
    except ValueError:
        logger.warning("RUSTDESK_SYNC_MINUTES invalido (%r); usando %d.", raw, DEFAULT_INTERVAL_MINUTES)
        return float(DEFAULT_INTERVAL_MINUTES)


def run_periodically(job: RustDeskAuditJob, interval_minutes: float, stop: threading.Event) -> None:
    """Um ciclo ao iniciar e depois a cada intervalo, ate `stop`. Erro: espera o proximo."""
    while not stop.is_set():
        r = job.run_once()
        if r.ok:
            logger.info(
                "RustDesk ok: %d linha(s), %d aviso(s) novo(s), %d maquina(s), %d sessao(oes)%s%s.",
                r.lines, r.inserted, r.machines, r.sessions,
                " - arquivo rotacionado" if r.rotated else "",
                f" - {r.invalid} linha(s) invalida(s)" if r.invalid else "",
            )
        else:
            logger.error("RustDesk falhou (tenta de novo no proximo ciclo): %s", r.error)
        stop.wait(interval_minutes * 60)


def start_from_env(stop: threading.Event) -> Optional[threading.Thread]:
    """Monta o job a partir do api/.env e inicia a thread. Sem host configurado, nao inicia."""
    from .db_config import connection_kwargs

    connection_kwargs()  # carrega o api/.env
    host = os.getenv("RUSTDESK_SSH_HOST", "").strip()
    if not host:
        logger.info("RUSTDESK_SSH_HOST ausente no api/.env: auditoria do RustDesk DESLIGADA.")
        return None
    user = os.getenv("RUSTDESK_SSH_USER", "logreader").strip() or "logreader"
    key_path = os.getenv("RUSTDESK_SSH_KEY_PATH", "").strip()
    known_hosts = os.getenv("RUSTDESK_SSH_KNOWN_HOSTS", "").strip()
    if not key_path or not known_hosts:
        logger.error("RUSTDESK_SSH_KEY_PATH e RUSTDESK_SSH_KNOWN_HOSTS sao obrigatorias: auditoria DESLIGADA.")
        return None
    base_dir = os.getenv("RUSTDESK_SFTP_DIR", "/rustdesk-audit").strip() or "/rustdesk-audit"
    interval = read_interval_minutes(os.getenv("RUSTDESK_SYNC_MINUTES"))

    from .rustdesk_sink import PostgresRustDeskSink
    from .rustdesk_source import SftpRemoteFiles

    job = RustDeskAuditJob(
        lambda: SftpRemoteFiles(host, user, key_path, known_hosts, base_dir=base_dir),
        PostgresRustDeskSink(),
    )
    thread = threading.Thread(
        target=run_periodically, args=(job, interval, stop), name="rustdesk-sync", daemon=True
    )
    thread.start()
    logger.info("Auditoria do RustDesk ligada: %s@%s:%s a cada %.0f min.", user, host, base_dir, interval)
    return thread
