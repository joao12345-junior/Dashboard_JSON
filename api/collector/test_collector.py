# api/collector/test_collector.py
"""
Testes do coletor, so com a biblioteca padrao (nao precisa de pytest nem de banco):

    cd api
    python -m unittest collector.test_collector -v
"""
import socket
import threading
import time
import unittest
from datetime import timezone

from .cef_parser import parse_syslog_line
from .unifi_syslog import SyslogReceiver


class ListSink:
    """Adaptador em memoria da porta EventSink (so para teste)."""

    def __init__(self):
        self.events = []
        self.lock = threading.Lock()

    def write_batch(self, events):
        with self.lock:
            self.events.extend(events)

    def close(self):
        pass


class CefParserTests(unittest.TestCase):
    def test_cef_completo_com_prefixo_syslog(self):
        raw = (
            "<134>Nov 23 16:00:00 UCG-Ultra CEF:0|Ubiquiti|UniFi Network|9.3.43|"
            "client_connected|Client Connected|3|rt=1763917200000 src=192.168.16.50 "
            "msg=Notebook do Joao conectou no AP Sala"
        )
        e = parse_syslog_line(raw, "192.168.16.1")
        self.assertEqual(e.cef_version, "0")
        self.assertEqual(e.device_vendor, "Ubiquiti")
        self.assertEqual(e.device_product, "UniFi Network")
        self.assertEqual(e.signature_id, "client_connected")
        self.assertEqual(e.name, "Client Connected")
        self.assertEqual(e.severity, 3)
        self.assertEqual(e.extension["src"], "192.168.16.50")
        # valor com espacos vai ate a proxima chave
        self.assertEqual(e.extension["msg"], "Notebook do Joao conectou no AP Sala")
        self.assertEqual(e.event_time.tzinfo, timezone.utc)
        self.assertEqual(e.event_time.year, 2025)
        self.assertEqual(e.source_ip, "192.168.16.1")

    def test_pipe_escapado_no_cabecalho(self):
        e = parse_syslog_line(r"CEF:0|V|P|1|sig|Nome com \| pipe|5|a=b", None)
        self.assertEqual(e.name, "Nome com | pipe")
        self.assertEqual(e.extension, {"a": "b"})

    def test_igual_escapado_no_valor(self):
        e = parse_syslog_line(r"CEF:0|V|P|1|s|N|1|msg=x\=y z=w", None)
        self.assertEqual(e.extension["msg"], "x=y")
        self.assertEqual(e.extension["z"], "w")

    def test_severidade_em_texto(self):
        e = parse_syslog_line("CEF:0|V|P|1|s|N|High|a=b", None)
        self.assertEqual(e.severity, 8)

    def test_nao_cef_vira_name(self):
        e = parse_syslog_line("<13>Nov 23 16:00:00 gw dhcpd: lease renovado", "10.0.0.1")
        self.assertIsNone(e.device_vendor)
        self.assertEqual(e.name, "Nov 23 16:00:00 gw dhcpd: lease renovado")
        self.assertIn("lease renovado", e.raw)

    def test_cabecalho_incompleto_nao_quebra(self):
        e = parse_syslog_line("CEF:0|so|dois", None)
        self.assertIsNone(e.signature_id)
        self.assertTrue(e.raw)

    def test_rt_invalido_e_ignorado(self):
        e = parse_syslog_line("CEF:0|V|P|1|s|N|1|rt=abc", None)
        self.assertIsNone(e.event_time)


class ReceiverTests(unittest.TestCase):
    def _send(self, port, text):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.sendto(text.encode("utf-8"), ("127.0.0.1", port))
        s.close()

    def _wait(self, predicate, timeout=4.0):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            if predicate():
                return True
            time.sleep(0.05)
        return False

    def test_recebe_e_grava_de_ip_permitido(self):
        sink = ListSink()
        r = SyslogReceiver("127.0.0.1", 0, ["127.0.0.1"], sink, flush_seconds=0.2)
        r.start()
        try:
            self._send(r.port, "CEF:0|V|P|1|sig|Nome|2|k=v\n")
            self.assertTrue(self._wait(lambda: len(sink.events) == 1))
            self.assertEqual(sink.events[0].signature_id, "sig")
            self.assertEqual(sink.events[0].source_ip, "127.0.0.1")
        finally:
            r.stop()

    def test_rejeita_ip_nao_permitido(self):
        sink = ListSink()
        r = SyslogReceiver("127.0.0.1", 0, ["10.9.9.9"], sink, flush_seconds=0.2)
        r.start()
        try:
            self._send(r.port, "CEF:0|V|P|1|sig|Nome|2|k=v")
            self.assertTrue(self._wait(lambda: r.rejected == 1))
            time.sleep(0.5)
            self.assertEqual(sink.events, [])
        finally:
            r.stop()

    def test_sink_com_falha_tenta_de_novo_sem_perder_o_lote(self):
        class FlakySink(ListSink):
            def __init__(self):
                super().__init__()
                self.calls = 0

            def write_batch(self, events):
                self.calls += 1
                if self.calls == 1:
                    raise RuntimeError("banco fora")
                super().write_batch(events)

        sink = FlakySink()
        r = SyslogReceiver("127.0.0.1", 0, ["127.0.0.1"], sink, flush_seconds=0.2)
        r.start()
        try:
            self._send(r.port, "CEF:0|V|P|1|sig|Nome|2|k=v")
            # 1a tentativa falha; o backoff e de 2 s; a 2a grava o mesmo lote.
            self.assertTrue(self._wait(lambda: len(sink.events) == 1, timeout=8))
            self.assertEqual(sink.calls, 2)
        finally:
            r.stop()


if __name__ == "__main__":
    unittest.main()
