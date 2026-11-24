# api/collector/site_sync.py
"""
Sincronizacao periodica do monitor de sites (substitui o agendamento do
`sync_site.ps1` no Agendador de Tarefas). Roda numa thread DENTRO do servico
LogDashSyslog: o coletor syslog continua escutando o tempo todo e, a cada
SITE_SYNC_MINUTES (padrao 30), este job chama a API Flask local, na mesma ordem
do script antigo:

    1. POST /api/site/check        verifica as URLs monitoradas
    2. POST /api/site/sync-sentry  puxa os erros do Sentry
    3. POST /api/site/cleanup      limpeza dos checks antigos
    4. POST /api/logs/cleanup      limpeza dos logs antigos

Cada passo e independente: um que falha nao impede os seguintes (igual ao .ps1).

Configuracao (api/.env, o mesmo da API):
    SYNC_API_KEY            obrigatoria (a mesma que a API confere no X-Sync-Key)
    SITE_SYNC_API_URL       padrao https://localhost:8765
    SITE_SYNC_MINUTES       padrao 30, minimo 5
    SITE_SYNC_VERIFY_TLS    "true" para validar o certificado (padrao: nao valida;
                            a chamada e para a propria maquina, loopback)

Ports and Adapters: o job so conhece um `HttpPoster` (porta); em producao e uma
`requests.Session`, nos testes um falso em memoria.
"""
from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from typing import Any, Optional, Protocol

logger = logging.getLogger("site_sync")

DEFAULT_API_URL = "https://localhost:8765"
DEFAULT_INTERVAL_MINUTES = 30
MIN_INTERVAL_MINUTES = 5
#: O check de sites visita cada URL monitorada; da folga para sites lentos.
REQUEST_TIMEOUT_SECONDS = 300
#: Corpo de resposta guardado no log (o resto e cortado).
MAX_LOGGED_BODY = 300

#: (rotulo, caminho, corpo JSON ou None) na ordem do sync_site.ps1.
STEPS: tuple[tuple[str, str, Optional[dict]], ...] = (
    ("site check", "/api/site/check", None),
    ("sync do Sentry", "/api/site/sync-sentry", {}),
    ("limpeza do site", "/api/site/cleanup", None),
    ("limpeza de logs", "/api/logs/cleanup", None),
)


class HttpPoster(Protocol):
    def post(self, url: str, **kwargs: Any) -> Any: ...


@dataclass(frozen=True, slots=True)
class StepResult:
    label: str
    ok: bool
    #: Codigo HTTP, ou None quando nem chegou resposta (API fora do ar, timeout...).
    status: Optional[int]
    detail: str


class SiteSyncJob:
    """Um ciclo = os 4 passos. Nunca levanta excecao: devolve o resultado de cada passo."""

    def __init__(self, session: HttpPoster, api_url: str, sync_key: str, *, verify_tls: bool = False) -> None:
        self._session = session
        self._base = api_url.rstrip("/")
        self._key = sync_key
        self._verify = verify_tls

    def run_once(self) -> list[StepResult]:
        results: list[StepResult] = []
        for label, path, body in STEPS:
            headers = {"X-Sync-Key": self._key}
            kwargs: dict[str, Any] = {
                "headers": headers,
                "timeout": REQUEST_TIMEOUT_SECONDS,
                "verify": self._verify,
            }
            if body is not None:
                kwargs["json"] = body
            try:
                resp = self._session.post(self._base + path, **kwargs)
                status = int(resp.status_code)
                text = str(getattr(resp, "text", ""))[:MAX_LOGGED_BODY]
                result = StepResult(label, 200 <= status < 300, status, text)
            except Exception as e:  # um passo que falha nao derruba os outros
                result = StepResult(label, False, None, f"{type(e).__name__}: {e}")
            log = logger.info if result.ok else logger.error
            log("Sync de sites - %s: %s %s", label, result.status or "sem resposta", result.detail)
            results.append(result)
        return results


def read_interval_minutes(raw: Optional[str]) -> float:
    """Intervalo em minutos com piso; valor invalido cai no padrao (com aviso)."""
    if raw is None or not raw.strip():
        return float(DEFAULT_INTERVAL_MINUTES)
    try:
        value = float(raw)
    except ValueError:
        logger.warning("SITE_SYNC_MINUTES invalido (%r); usando %d.", raw, DEFAULT_INTERVAL_MINUTES)
        return float(DEFAULT_INTERVAL_MINUTES)
    return max(value, float(MIN_INTERVAL_MINUTES))


def run_periodically(job: SiteSyncJob, interval_minutes: float, stop: threading.Event) -> None:
    """Roda um ciclo logo ao iniciar o servico e depois a cada intervalo, ate `stop`."""
    while not stop.is_set():
        results = job.run_once()
        failed = [r.label for r in results if not r.ok]
        if failed:
            logger.warning("Sync de sites terminou com falha em: %s", ", ".join(failed))
        else:
            logger.info("Sync de sites ok (%d passos).", len(results))
        stop.wait(interval_minutes * 60)


def start_from_env(stop: threading.Event) -> Optional[threading.Thread]:
    """
    Monta o job a partir do api/.env e inicia a thread. Sem SYNC_API_KEY, avisa e
    nao inicia (o coletor syslog segue normalmente). Devolve a thread, ou None.
    """
    from .db_config import connection_kwargs

    connection_kwargs()  # carrega o api/.env
    key = os.getenv("SYNC_API_KEY", "").strip()
    if not key:
        logger.warning("SYNC_API_KEY ausente no api/.env: sync de sites DESLIGADO.")
        return None
    api_url = os.getenv("SITE_SYNC_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL
    verify = os.getenv("SITE_SYNC_VERIFY_TLS", "").strip().lower() == "true"
    interval = read_interval_minutes(os.getenv("SITE_SYNC_MINUTES"))

    import requests
    import urllib3

    if not verify:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    job = SiteSyncJob(requests.Session(), api_url, key, verify_tls=verify)
    thread = threading.Thread(
        target=run_periodically, args=(job, interval, stop), name="site-sync", daemon=True
    )
    thread.start()
    logger.info("Sync de sites ligado: %s a cada %.0f min.", api_url, interval)
    return thread
