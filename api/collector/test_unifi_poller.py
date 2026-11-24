# api/collector/test_unifi_poller.py
"""
Testes do poller da API do UCG. Sem rede e sem banco: mapeadores puros, fonte HTTP
com sessao falsa, poller com fonte/sink em memoria.
Rodar:  cd api; python -m unittest collector.test_unifi_poller -v
"""
import threading
import unittest
from datetime import datetime, timezone

from .unifi_mapper import map_client, map_device
from .unifi_poller import MAX_BACKOFF_SECONDS, UnifiPoller
from .unifi_source import UnifiHttpSource

# Formatos reais vistos no UCG Ultra (Network 11.0.104), com MACs/nomes ficticios.
DEVICE = {
    "id": "c64e1e4b-0000-0000-0000-000000000001",
    "macAddress": "24:5A:4C:00:00:01",
    "ipAddress": "192.168.16.247",
    "name": "Ap 409",
    "model": "UAP-AC-Lite",
    "state": "ONLINE",
    "supported": True,
    "firmwareVersion": "6.8.2",
    "firmwareUpdatable": False,
    "features": ["accessPoint"],
    "interfaces": ["radios"],
}
STATS = {
    "uptimeSec": 4341512,
    "lastHeartbeatAt": "2026-11-23T20:08:14Z",
    "cpuUtilizationPct": 7.3,
    "memoryUtilizationPct": 46.6,
    "uplink": {"txRateBps": 472, "rxRateBps": 480},
}
STA_WIRED = {
    "mac": "E0:D5:5E:00:00:01",
    "is_wired": True,
    "name": "OPT006",
    "hostname": "OPT006",
    "note": "Fulano de Tal",
    "ip": "192.168.16.136",
    "oui": "Giga-Byte Technology Co.,Ltd.",
    "network": "Rede1",
    "gw_mac": "0c:ea:14:00:00:01",
    "last_uplink_mac": "0c:ea:14:00:00:01",
    "assoc_time": 1794380044,
    "first_seen": 1751032595,
    "wired-tx_bytes": 1994585624,
    "wired-rx_bytes": 1312536171,
}
STA_WIFI = {
    "mac": "ac:5a:f0:00:00:02",
    "is_wired": False,
    "hostname": "LGwebOSTV",
    "essid": "optare",
    "signal": -61,
    "ap_mac": "24:5a:4c:00:00:01",
    "network": "OptWifi",
    "latest_assoc_time": 1795000000,
    "assoc_time": 1794000000,
    "tx_bytes": 10,
    "rx_bytes": 20,
}


class MapperTests(unittest.TestCase):
    def test_device_with_stats(self):
        d = map_device(DEVICE, STATS)
        self.assertEqual(d.mac, "24:5a:4c:00:00:01")  # minusculo
        self.assertEqual(d.name, "Ap 409")
        self.assertEqual(d.features, ("accessPoint",))
        self.assertFalse(d.firmware_updatable)
        self.assertEqual(d.uptime_sec, 4341512)
        self.assertAlmostEqual(d.cpu_pct, 7.3)
        self.assertEqual((d.uplink_tx_bps, d.uplink_rx_bps), (472, 480))
        self.assertEqual(
            d.last_heartbeat_at, datetime(2026, 11, 23, 20, 8, 14, tzinfo=timezone.utc)
        )

    def test_device_without_stats_keeps_inventory(self):
        d = map_device(DEVICE, None)
        self.assertEqual(d.state, "ONLINE")
        self.assertIsNone(d.cpu_pct)
        self.assertIsNone(d.last_heartbeat_at)

    def test_device_without_mac_is_dropped(self):
        self.assertIsNone(map_device({"name": "x"}, None))

    def test_wired_client_uses_switch_or_gateway_and_wired_counters(self):
        c = map_client(STA_WIRED)
        self.assertTrue(c.is_wired)
        self.assertEqual(c.uplink_mac, "0c:ea:14:00:00:01")
        self.assertEqual(c.tx_bytes, 1994585624)
        self.assertIsNone(c.ssid)
        self.assertIsNone(c.signal_dbm)
        self.assertEqual(c.note, "Fulano de Tal")
        self.assertEqual(c.network_name, "Rede1")

    def test_wifi_client_uses_ap_signal_and_prefers_latest_assoc(self):
        c = map_client(STA_WIFI)
        self.assertEqual(c.uplink_mac, "24:5a:4c:00:00:01")
        self.assertEqual(c.ssid, "optare")
        self.assertEqual(c.signal_dbm, -61)
        self.assertEqual(c.name, "LGwebOSTV")  # sem name: cai no hostname
        self.assertEqual(c.connected_since, datetime.fromtimestamp(1795000000, tz=timezone.utc))

    def test_bad_types_become_none_not_errors(self):
        c = map_client({"mac": "aa:bb:cc:00:00:03", "signal": "forte", "tx_bytes": True, "ip": 5})
        self.assertIsNone(c.signal_dbm)
        self.assertIsNone(c.tx_bytes)
        self.assertIsNone(c.ip_address)


class FakeResponse:
    def __init__(self, body, status=200):
        self._body, self.status_code = body, status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._body


class FakeSession:
    """Responde por caminho; guarda os GETs feitos (para checar que so ha GET)."""

    def __init__(self, routes):
        self.headers = {}
        self.routes = routes
        self.calls = []

    def get(self, url, params=None, timeout=None, verify=None):
        path = url.split("://", 1)[1].split("/", 1)[1]
        self.calls.append(("GET", "/" + path, params))
        body = self.routes["/" + path]
        return body if isinstance(body, FakeResponse) else FakeResponse(body)


SITES = {"data": [{"id": "site-1", "internalReference": "default"}], "totalCount": 1}
PREFIX = "/proxy/network/integration/v1"


class HttpSourceTests(unittest.TestCase):
    def _source(self, extra=None):
        routes = {
            f"{PREFIX}/sites": SITES,
            f"{PREFIX}/sites/site-1/devices": {"data": [DEVICE], "totalCount": 1},
            f"{PREFIX}/sites/site-1/devices/{DEVICE['id']}/statistics/latest": STATS,
            "/proxy/network/api/s/default/stat/sta": {"data": [STA_WIRED, STA_WIFI, {"x": 1}]},
        }
        routes.update(extra or {})
        session = FakeSession(routes)
        return UnifiHttpSource("https://ucg.local/", "KEY", session=session), session

    def test_fetch_devices_and_clients(self):
        source, session = self._source()
        self.assertEqual(session.headers["X-API-KEY"], "KEY")
        devices = source.fetch_devices()
        clients = source.fetch_clients()
        self.assertEqual([d.name for d in devices], ["Ap 409"])
        self.assertEqual(devices[0].cpu_pct, 7.3)
        self.assertEqual(len(clients), 2)  # o item sem MAC foi descartado
        self.assertTrue(all(method == "GET" for method, _, _ in session.calls))

    def test_site_is_resolved_once(self):
        source, session = self._source()
        source.fetch_devices()
        source.fetch_clients()
        site_calls = [c for c in session.calls if c[1] == f"{PREFIX}/sites"]
        self.assertEqual(len(site_calls), 1)

    def test_missing_stats_do_not_break_the_cycle(self):
        stats_path = f"{PREFIX}/sites/site-1/devices/{DEVICE['id']}/statistics/latest"
        source, _ = self._source({stats_path: FakeResponse({}, 500)})
        devices = source.fetch_devices()
        self.assertEqual(len(devices), 1)
        self.assertIsNone(devices[0].cpu_pct)

    def test_fetch_wans_with_names_and_without_networkconf(self):
        gateway = {"type": "udm", "mac": "0c:ea:14:00:00:01", "wan1": {"ip": "172.16.0.24", "up": True}}
        legacy = "/proxy/network/api/s/default"
        conf = {"data": [{"purpose": "wan", "wan_networkgroup": "WAN", "name": "Unifique"}]}
        source, session = self._source({f"{legacy}/stat/device": {"data": [gateway]}, f"{legacy}/rest/networkconf": conf})
        self.assertEqual(source.fetch_wans()[0].name, "Unifique")
        self.assertTrue(all(method == "GET" for method, _, _ in session.calls))
        source, _ = self._source({f"{legacy}/stat/device": {"data": [gateway]}, f"{legacy}/rest/networkconf": FakeResponse({}, 404)})
        self.assertIsNone(source.fetch_wans()[0].name)

    def test_fetch_wans_without_gateway_raises(self):
        source, _ = self._source({"/proxy/network/api/s/default/stat/device": {"data": [{"type": "uap"}]}})
        with self.assertRaises(RuntimeError):
            source.fetch_wans()

    def test_unexpected_sta_response_raises(self):
        source, _ = self._source({"/proxy/network/api/s/default/stat/sta": {"meta": {}}})
        with self.assertRaises(RuntimeError):
            source.fetch_clients()


class FakeSource:
    def __init__(self, devices=(), clients=(), error=None, wans=(), wan_error=None):
        self.devices, self.clients, self.error = list(devices), list(clients), error
        self.wans, self.wan_error = list(wans), wan_error

    def fetch_wans(self):
        if self.wan_error:
            raise self.wan_error
        return self.wans

    def fetch_devices(self):
        if self.error:
            raise self.error
        return self.devices

    def fetch_clients(self):
        return self.clients


class MemorySink:
    def __init__(self):
        self.snapshots = []
        self.wans = []
        self.samples = []
        self.sample_error = None

    def replace_snapshot(self, devices, clients, polled_at):
        self.snapshots.append((list(devices), list(clients), polled_at))

    def replace_wans(self, wans, polled_at):
        self.wans.append((list(wans), polled_at))

    def append_wan_samples(self, wans, polled_at):
        if self.sample_error:
            raise self.sample_error
        self.samples.append((list(wans), polled_at))

    def close(self):
        pass


class PollerTests(unittest.TestCase):
    def test_poll_once_writes_snapshot(self):
        device, client = map_device(DEVICE, STATS), map_client(STA_WIFI)
        sink = MemorySink()
        counts = UnifiPoller(FakeSource([device], [client]), sink).poll_once()
        self.assertEqual(counts, (1, 1))
        self.assertEqual(len(sink.snapshots), 1)
        self.assertIsNotNone(sink.snapshots[0][2].tzinfo)

    def test_failed_read_writes_nothing(self):
        sink = MemorySink()
        poller = UnifiPoller(FakeSource(error=ConnectionError("fora do ar")), sink)
        with self.assertRaises(ConnectionError):
            poller.poll_once()
        self.assertEqual(sink.snapshots, [])  # nao "desconecta" ninguem por falha de leitura

    def test_wan_failure_does_not_fail_the_cycle(self):
        sink = MemorySink()
        poller = UnifiPoller(FakeSource(wan_error=RuntimeError("sem gateway")), sink)
        self.assertEqual(poller.poll_once(), (0, 0))
        self.assertEqual(len(sink.snapshots), 1)
        self.assertEqual(sink.wans, [])  # mantem o ultimo estado bom da WAN

    def test_wans_are_written_with_the_same_time(self):
        sink = MemorySink()
        UnifiPoller(FakeSource(wans=["w"]), sink).poll_once()
        self.assertEqual(sink.wans[0][0], ["w"])
        self.assertEqual(sink.wans[0][1], sink.snapshots[0][2])

    def test_wan_samples_are_appended_with_the_same_time(self):
        sink = MemorySink()
        UnifiPoller(FakeSource(wans=["w"]), sink).poll_once()
        self.assertEqual(sink.samples, [(["w"], sink.snapshots[0][2])])

    def test_wan_failure_writes_no_sample(self):
        sink = MemorySink()
        UnifiPoller(FakeSource(wan_error=RuntimeError("x")), sink).poll_once()
        self.assertEqual(sink.samples, [])

    def test_sample_failure_does_not_fail_the_cycle(self):
        sink = MemorySink()
        sink.sample_error = RuntimeError("tabela nao existe (migracao 017)")
        self.assertEqual(UnifiPoller(FakeSource(wans=["w"]), sink).poll_once(), (0, 0))
        self.assertEqual(len(sink.wans), 1)  # o estado atual da WAN foi gravado mesmo assim

    def test_run_backs_off_and_recovers(self):
        stop = threading.Event()
        poller = UnifiPoller(FakeSource(error=ConnectionError("x")), MemorySink(), 60)
        self.assertEqual(poller.next_delay(), 60)
        poller._failures = 1
        self.assertEqual(poller.next_delay(), 120)
        poller._failures = 20
        self.assertEqual(poller.next_delay(), MAX_BACKOFF_SECONDS)

    def test_interval_has_a_floor(self):
        self.assertEqual(UnifiPoller(FakeSource(), MemorySink(), 1).next_delay(), 15)


if __name__ == "__main__":
    unittest.main()
