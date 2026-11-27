# api/collector/unifi_syslog.py
"""
Coletor syslog (UDP) para os eventos do UniFi, pensado para rodar como
servico no servidor 201 (NSSM), separado da API Flask:

    cd api
    .venv\\Scripts\\python.exe -m collector.unifi_syslog

Configuracao por variaveis de ambiente:
    SYSLOG_ALLOWED_IPS  obrigatoria: IPs de origem aceitos, separados por
                        virgula (o IP do console UniFi). Syslog nao tem
                        autenticacao; este filtro (junto com o firewall) e a
                        unica barreira.
    SYSLOG_HOST         onde escutar (padrao 0.0.0.0)
    SYSLOG_PORT         porta UDP (padrao 5514; acima de 1024 nao exige privilegio)

O mesmo servico tambem roda o sync do monitor de sites a cada 30 min
(`site_sync.py`; antes era o sync_site.ps1 no Agendador de Tarefas) e a auditoria do
RustDesk (`rustdesk_sync.py`, SFTP do VPS a cada 5 min). Cada um roda
numa thread propria: se ele travar ou falhar, o syslog continua recebendo.

Desenho: uma thread recebe datagramas e enfileira; outra grava em lotes.
Assim, um banco lento nao faz o socket perder pacote (a fila absorve) e,
se o banco cair, o coletor segue recebendo e tenta de novo com backoff. A
fila e limitada: no estouro, descarta o evento mais antigo e conta o descarte.
"""
from __future__ import annotations

import logging
import os
import queue
import signal
import socket
import sys
import threading
import time
from typing import Sequence

from .cef_parser import NetworkEvent, parse_syslog_line
from .sinks import EventSink

logger = logging.getLogger("unifi_syslog")

MAX_DATAGRAM_BYTES = 65535


class SyslogReceiver:
    """Recebe syslog por UDP, interpreta (CEF) e grava em lotes num `EventSink`."""

    def __init__(
        self,
        host: str,
        port: int,
        allowed_ips: Sequence[str],
        sink: EventSink,
        *,
        batch_size: int = 100,
        flush_seconds: float = 1.0,
        queue_max: int = 10000,
    ) -> None:
        # frozenset: a checagem de IP a cada datagrama e O(1) (lookup, nao busca em lista).
        self._allowed = frozenset(allowed_ips)
        self._sink = sink
        self._batch_size = batch_size
        self._flush_seconds = flush_seconds
        self._queue: queue.Queue[NetworkEvent] = queue.Queue(maxsize=queue_max)
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self._rejected_ips: set[str] = set()

        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.bind((host, port))
        self._sock.settimeout(1.0)  # acorda para checar o pedido de parada

        self.received = 0
        self.rejected = 0
        self.dropped = 0
        self.written = 0

    @property
    def port(self) -> int:
        """Porta efetiva (util quando se pede porta 0 nos testes)."""
        return self._sock.getsockname()[1]

    def start(self) -> None:
        for target, name in ((self._receive_loop, "recv"), (self._write_loop, "write")):
            t = threading.Thread(target=target, name=f"syslog-{name}", daemon=True)
            t.start()
            self._threads.append(t)

    def stop(self) -> None:
        self._stop.set()
        for t in self._threads:
            t.join(timeout=15)
        self._sock.close()
        self._sink.close()

    def stats(self) -> str:
        return (
            f"recebidos={self.received} gravados={self.written} "
            f"rejeitados={self.rejected} descartados={self.dropped} "
            f"fila={self._queue.qsize()}"
        )

    # -- thread de recepcao --------------------------------------------------
    def _receive_loop(self) -> None:
        while not self._stop.is_set():
            try:
                data, addr = self._sock.recvfrom(MAX_DATAGRAM_BYTES)
            except socket.timeout:
                continue
            except OSError:
                if self._stop.is_set():
                    return
                logger.exception("Erro no socket UDP")
                time.sleep(1)
                continue

            ip = addr[0]
            if ip not in self._allowed:
                self.rejected += 1
                if ip not in self._rejected_ips:  # avisa uma vez por IP, sem inundar o log
                    self._rejected_ips.add(ip)
                    logger.warning("Datagrama rejeitado de IP nao permitido: %s", ip)
                continue

            text = data.decode("utf-8", errors="replace").strip()
            if not text:
                continue
            self.received += 1
            self._enqueue(parse_syslog_line(text, ip))

    def _enqueue(self, event: NetworkEvent) -> None:
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            try:
                self._queue.get_nowait()  # descarta o mais antigo
                self.dropped += 1
            except queue.Empty:
                pass
            try:
                self._queue.put_nowait(event)
            except queue.Full:
                self.dropped += 1

    # -- thread de gravacao --------------------------------------------------
    def _write_loop(self) -> None:
        failures = 0
        batch: list[NetworkEvent] = []
        while True:
            if not batch:
                self._fill_batch(batch)
            if not batch:
                if self._stop.is_set():
                    return
                continue
            try:
                self._sink.write_batch(batch)
                self.written += len(batch)
                batch = []
                failures = 0
            except Exception:
                failures += 1
                wait = min(30, 2 ** min(failures, 5))
                logger.exception(
                    "Falha ao gravar %d evento(s); nova tentativa em %ds", len(batch), wait
                )
                if self._stop.wait(wait):
                    # Parando com o banco fora: nao ha o que fazer com o lote.
                    logger.error("Encerrando com %d evento(s) nao gravado(s)", len(batch))
                    return

    def _fill_batch(self, batch: list[NetworkEvent]) -> None:
        deadline = time.monotonic() + self._flush_seconds
        while len(batch) < self._batch_size:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                batch.append(self._queue.get(timeout=min(remaining, 0.25)))
            except queue.Empty:
                if self._stop.is_set():
                    break


def _read_allowed_ips() -> list[str]:
    return [ip.strip() for ip in os.getenv("SYSLOG_ALLOWED_IPS", "").split(",") if ip.strip()]


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    allowed = _read_allowed_ips()
    if not allowed:
        logger.error("SYSLOG_ALLOWED_IPS vazio: informe o IP do console UniFi. Abortando.")
        return 2

    from .sinks import PostgresEventSink

    host = os.getenv("SYSLOG_HOST", "0.0.0.0")
    port = int(os.getenv("SYSLOG_PORT", "5514"))
    receiver = SyslogReceiver(host, port, allowed, PostgresEventSink())

    stop = threading.Event()

    def _request_stop(*_args: object) -> None:
        stop.set()

    # SIGTERM/SIGBREAK: o NSSM para o servico por Ctrl+C/Ctrl+Break no Windows.
    for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is not None:
            signal.signal(sig, _request_stop)

    receiver.start()
    from .site_sync import start_from_env

    try:
        start_from_env(stop)
    except Exception:  # o sync e extra: nunca impede o coletor de subir
        logger.exception("Nao foi possivel iniciar o sync de sites")
    # Auditoria do RustDesk (SFTP do VPS): tambem extra, na sua propria thread.
    try:
        from .rustdesk_sync import start_from_env as start_rustdesk

        start_rustdesk(stop)
    except Exception:
        logger.exception("Nao foi possivel iniciar a auditoria do RustDesk")
    logger.info("Escutando UDP %s:%d (origens permitidas: %s)", host, port, ", ".join(allowed))
    last_stats = time.monotonic()
    try:
        while not stop.wait(1.0):
            if time.monotonic() - last_stats >= 60:
                logger.info("Estatisticas: %s", receiver.stats())
                last_stats = time.monotonic()
    finally:
        logger.info("Encerrando. %s", receiver.stats())
        receiver.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
