# api/collector/test_network_extras.py
"""
Testes da fase 4 da rede: WAN (mapper puro) e historico de conexoes (regra pura).
Rodar:  cd api; python -m unittest collector.test_network_extras -v
"""
import unittest
from datetime import datetime, timedelta, timezone

from .client_sessions import OpenSession, plan_sessions
from .unifi_mapper import NetworkClient, find_gateway, map_wans

NOW = datetime(2026, 11, 23, 20, 0, tzinfo=timezone.utc)

# Formato tipico do `stat/device` de um UCG (campos de WAN), com dados ficticios.
GATEWAY = {
    "type": "udm",
    "mac": "0C:EA:14:00:00:01",
    "wan1": {"ip": "172.16.0.24", "up": True, "enable": True, "rx_bytes-r": 1000, "tx_bytes-r": 500},
    "wan2": {"ip": "179.219.55.234", "up": False, "enable": True},
    "uptime_stats": {
        "WAN": {"availability": 100.0, "latency_average": 12},
        "WAN2": {"availability": 99.5, "latency_average": 30.5},
    },
    "geo_info": {"WAN": {"isp_name": "Unifique Telecomunicacoes"}},
}
CONFS = [
    {"purpose": "corporate", "name": "Rede1"},
    {"purpose": "wan", "wan_networkgroup": "WAN", "name": "Unifique", "wan_load_balance_type": "weighted"},
    {"purpose": "wan", "wan_networkgroup": "WAN2", "name": "Claro NET", "wan_load_balance_type": "failover-only"},
]


def client(mac: str, since: datetime | None) -> NetworkClient:
    return NetworkClient(
        mac=mac, name=None, hostname=None, note=None, ip_address="192.168.16.9", vendor=None,
        is_wired=True, is_guest=False, network_name=None, uplink_mac="0c:ea:14:00:00:01",
        ssid=None, signal_dbm=None, tx_bytes=None, rx_bytes=None,
        connected_since=since, first_seen_at=None,
    )


class WanMapperTests(unittest.TestCase):
    def test_maps_both_wans_with_names_role_and_stats(self):
        wan, wan2 = map_wans(GATEWAY, CONFS)
        self.assertEqual(wan.wan_group, "WAN")
        self.assertEqual(wan.name, "Unifique")
        self.assertEqual(wan.isp_name, "Unifique Telecomunicacoes")
        self.assertEqual(wan.ip_address, "172.16.0.24")
        self.assertTrue(wan.is_up)
        self.assertFalse(wan.failover_only)
        self.assertEqual(wan.availability_pct, 100.0)
        self.assertEqual(wan.rx_bps, 8000)  # bytes/s -> bits/s
        self.assertEqual(wan.gateway_mac, "0c:ea:14:00:00:01")
        self.assertEqual(wan2.name, "Claro NET")
        self.assertTrue(wan2.failover_only)
        self.assertFalse(wan2.is_up)
        self.assertEqual(wan2.latency_ms, 30.5)
        self.assertIsNone(wan2.isp_name)

    def test_without_networkconf_still_maps(self):
        links = map_wans(GATEWAY)
        self.assertEqual([l.wan_group for l in links], ["WAN", "WAN2"])
        self.assertIsNone(links[0].name)
        self.assertIsNone(links[0].failover_only)

    def test_status_text_is_used_when_up_flag_missing(self):
        gw = {"wan1": {"ip": "1.2.3.4"}, "last_wan_status": {"WAN": "online"}}
        self.assertTrue(map_wans(gw)[0].is_up)

    def test_bad_types_become_none(self):
        gw = {"wan1": {"ip": 5, "up": "yes", "rx_bytes-r": True}, "uptime_stats": []}
        link = map_wans(gw)[0]
        self.assertIsNone(link.ip_address)
        self.assertIsNone(link.is_up)
        self.assertIsNone(link.rx_bps)
        self.assertIsNone(link.availability_pct)

    def test_find_gateway(self):
        ap = {"type": "uap", "mac": "aa"}
        self.assertIs(find_gateway([ap, GATEWAY]), GATEWAY)
        self.assertIsNone(find_gateway([ap]))
        self.assertIsNone(find_gateway("x"))


class SessionPlanTests(unittest.TestCase):
    def test_new_client_opens_from_connected_since(self):
        since = NOW - timedelta(hours=3)
        plan = plan_sessions({}, [client("a", since)], NOW)
        self.assertEqual(len(plan.to_open), 1)
        self.assertEqual(plan.to_open[0].connected_at, since)
        self.assertEqual(plan.to_close, ())

    def test_future_or_missing_since_opens_now(self):
        plan = plan_sessions({}, [client("a", None), client("b", NOW + timedelta(hours=1))], NOW)
        self.assertEqual([s.connected_at for s in plan.to_open], [NOW, NOW])

    def test_still_connected_does_nothing(self):
        since = NOW - timedelta(hours=3)
        open_ = {"a": OpenSession(1, "a", since)}
        plan = plan_sessions(open_, [client("a", since + timedelta(seconds=30))], NOW)
        self.assertEqual((plan.to_open, plan.to_close), ((), ()))

    def test_reconnect_between_cycles_closes_and_reopens(self):
        old = NOW - timedelta(hours=3)
        new = NOW - timedelta(minutes=10)
        plan = plan_sessions({"a": OpenSession(1, "a", old)}, [client("a", new)], NOW)
        self.assertEqual(plan.to_close[0].id, 1)
        self.assertEqual(plan.to_close[0].disconnected_at, new)
        self.assertEqual(plan.to_open[0].connected_at, new)

    def test_absent_client_is_closed_now(self):
        plan = plan_sessions({"a": OpenSession(7, "a", NOW - timedelta(days=1))}, [], NOW)
        self.assertEqual(plan.to_close[0].id, 7)
        self.assertEqual(plan.to_close[0].disconnected_at, NOW)

    def test_duplicate_mac_in_cycle_opens_once(self):
        plan = plan_sessions({}, [client("a", None), client("a", None)], NOW)
        self.assertEqual(len(plan.to_open), 1)


if __name__ == "__main__":
    unittest.main()
