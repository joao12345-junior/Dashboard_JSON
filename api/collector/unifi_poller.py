# api/collector/unifi_poller.py
"""
Poller da API local do UCG (fase 2 do UniFi), para rodar como servico no
servidor 201 (NSSM), separado da API Flask e do coletor syslog:

    cd api
    .venv\\Scripts\\python.exe -m collector.unifi_poller

Configuracao (api/.env ou ambiente do servico):
    UNIFI_HOST          obrigatoria, ex.: https://192.168.16.1
    UNIFI_API_KEY       obrigatoria (Network > Integrations)
    UNIFI_POLL_SECONDS  intervalo entre ciclos (padrao 60, minimo 15)
    UNIFI_VERIFY_TLS    "true" para validar o certificado (padrao: nao valida,
                        o UCG usa certificado autoassinado e o trafego e da LAN)

Regra de ouro: se a LEITURA falhar, NADA e gravado. Um ciclo que falha nao pode
virar "todo mundo desconectou". Em falhas seguidas o intervalo cresce (ate 5 min).
"""
from __future__ import annotations

import logging
import os
import signal
import sys
import threading
from datetime import datetime, timezone

from .state_sinks import StateSink
from .unifi_source import UnifiSource

logger = logging.getLogger("unifi_poller")

MIN_INTERVAL_SECONDS = 15
MAX_BACKOFF_SECONDS = 300


class UnifiPoller:
    """Le o retrato da rede numa `UnifiSource` e grava num `StateSink`, em ciclos."""

    def __init__(self, source: UnifiSource, sink: StateSink, interval_seconds: float = 60.0) -> None:
        self._source = source
        self._sink = sink
        self._interval = max(float(interval_seconds), MIN_INTERVAL_SECONDS)
        self._failures = 0

    def poll_once(self) -> tuple[int, int]:
        """Um ciclo. Devolve (dispositivos, clientes). Levanta excecao se falhar."""
        devices = self._source.fetch_devices()
        clients = self._source.fetch_clients()
        # So chega aqui com as DUAS leituras ok: gravar so metade desconectaria clientes
        # ou removeria dispositivos por engano.
        polled_at = datetime.now(timezone.utc)
        self._sink.replace_snapshot(devices, clients, polled_at)
        self._poll_wans(polled_at)
        self._poll_vpn(polled_at)
        return len(devices), len(clients)

    def _poll_wans(self, polled_at: datetime) -> None:
        """
        WAN e EXTRA: se falhar, o ciclo de dispositivos/clientes continua valendo e a
        tabela de WAN fica com o ultimo estado bom (a pagina mostra a idade). O historico
        (grafico de internet) e mais um extra: sem a migracao 017, so o grafico perde o ponto.
        """
        try:
            wans = self._source.fetch_wans()
            self._sink.replace_wans(wans, polled_at)
        except Exception as e:
            logger.warning("WAN nao atualizada neste ciclo: %s: %s", type(e).__name__, e)
            return
        try:
            self._sink.append_wan_samples(wans, polled_at)
        except Exception as e:
            logger.warning("Historico da WAN nao gravado neste ciclo: %s: %s", type(e).__name__, e)

    def _poll_vpn(self, polled_at: datetime) -> None:
        """
        Clientes de VPN (`stat/remoteuservpn`): EXTRA, como a WAN. Leitura que falha nao
        grava nada (senao todo mundo viraria "desconectado"); sem a migracao 018 so loga.
        """
        try:
            vpn_clients = self._source.fetch_vpn_clients()
        except Exception as e:
            logger.warning("VPN nao lida neste ciclo: %s: %s", type(e).__name__, e)
            return
        try:
            self._sink.replace_vpn_clients(vpn_clients, polled_at)
        except Exception as e:
            logger.warning("VPN nao gravada neste ciclo: %s: %s", type(e).__name__, e)

    def next_delay(self) -> float:
        """Intervalo ate o proximo ciclo: normal, ou com backoff apos falhas seguidas."""
        if self._failures == 0:
            return self._interval
        return min(self._interval * (2 ** min(self._failures, 6)), MAX_BACKOFF_SECONDS)

    def run(self, stop: threading.Event) -> None:
        while not stop.is_set():
            try:
                devices, clients = self.poll_once()
                if self._failures:
                    logger.info("Recuperado apos %d falha(s) seguida(s).", self._failures)
                self._failures = 0
                logger.info("Ciclo ok: %d dispositivo(s), %d cliente(s).", devices, clients)
            except Exception as e:
                self._failures += 1
                logger.error(
                    "Ciclo falhou (%d seguida(s)): %s: %s", self._failures, type(e).__name__, e
                )
            stop.wait(self.next_delay())


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    from .db_config import connection_kwargs  # carrega o api/.env

    connection_kwargs()
    host = os.getenv("UNIFI_HOST", "").strip()
    api_key = os.getenv("UNIFI_API_KEY", "").strip()
    if not host or not api_key:
        logger.error("UNIFI_HOST e UNIFI_API_KEY sao obrigatorias (api/.env). Abortando.")
        return 2
    try:
        interval = float(os.getenv("UNIFI_POLL_SECONDS", "60"))
    except ValueError:
        logger.error("UNIFI_POLL_SECONDS invalido. Abortando.")
        return 2
    verify_tls = os.getenv("UNIFI_VERIFY_TLS", "").strip().lower() == "true"

    from .state_sinks import PostgresStateSink
    from .unifi_source import UnifiHttpSource

    source = UnifiHttpSource(host, api_key, verify_tls=verify_tls)
    sink = PostgresStateSink()
    poller = UnifiPoller(source, sink, interval)

    stop = threading.Event()

    def _request_stop(*_args: object) -> None:
        stop.set()

    # SIGTERM/SIGBREAK: o NSSM para o servico por Ctrl+C/Ctrl+Break no Windows.
    for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is not None:
            signal.signal(sig, _request_stop)

    logger.info("Poller iniciado: %s a cada %.0f s (TLS %s).", host, max(interval, MIN_INTERVAL_SECONDS),
                "validado" if verify_tls else "sem validacao")
    try:
        poller.run(stop)
    finally:
        sink.close()
        logger.info("Encerrado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
