# api/collector/test_network_extras.py
"""
Testes da fase 4 da rede: WAN (mapper puro) e historico de conexoes (regra pura).
Rodar:  cd api; python -m unittest collector.test_network_extras -v
"""
import unittest
from datetime import datetime, timedelta, timezone

from .client_sessions import OpenSession, plan_sessions
from .unifi_mapper import (
    NetworkClient,
    dpi_catalog_key,
    find_gateway,
    map_top_apps,
    map_vpn_client,
    map_wan_activity,
    map_wans,
)

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


class WanActivityMapperTests(unittest.TestCase):
    # Itens reais do probe de 24/11 (--wan-activity).
    BODY = {
        "wan_activity": {
            "activity_by_network_group": {
                "WAN2": {
                    "history": [
                        {"avg_latency_ms": 1.8, "avg_packet_loss_pct": 1.1, "max_latency_ms": 5.0,
                         "min_latency_ms": 1.0, "timestamp": 1795546200000},
                    ],
                    "summary": {},
                },
                "WAN": {
                    "history": [
                        {"avg_latency_ms": 9.6, "avg_packet_loss_pct": 0.0, "max_latency_ms": 11.0,
                         "min_latency_ms": 9.0, "timestamp": 1795546200000},
                        {"avg_packet_loss_pct": 2.0},
                    ],
                },
            }
        }
    }

    def test_points_per_wan_with_time_in_utc(self):
        points = map_wan_activity(self.BODY)
        self.assertEqual(len(points), 2)  # o item sem timestamp foi ignorado
        wan2 = next(p for p in points if p.wan_group == "WAN2")
        self.assertEqual(wan2.packet_loss_pct, 1.1)
        self.assertEqual(wan2.latency_max_ms, 5.0)
        self.assertEqual(wan2.sampled_at, datetime.fromtimestamp(1795546200, timezone.utc))

    def test_missing_activity_raises(self):
        with self.assertRaises(ValueError):
            map_wan_activity({"wan": {}})


class TopAppsMapperTests(unittest.TestCase):
    # Catalogo e estatistica reais (probe de 24/11 no UCG da Optare).
    NAMES = {1114252: "Sharepoint", 1310905: "SSL/TLS", 655397: "AnyDesk", 37: "Xfire"}
    CATS = {17: "Business tools", 20: "Network protocols", 10: "Remote access terminals"}
    BODY = {
        "top_all_traffic_by_application": [
            {"application_id": 185, "bytes": 5211106244, "category_id": 20},
            {"application_id": 140, "bytes": 36085708630, "category_id": 17},
            {"application_id": 37, "bytes": 2663431215, "category_id": 10},
        ]
    }

    def test_catalog_key_combines_category_and_application(self):
        self.assertEqual(dpi_catalog_key(17, 140), 1114252)
        self.assertEqual(dpi_catalog_key(10, 37), 655397)

    def test_names_ranked_by_bytes(self):
        apps = map_top_apps(self.BODY, "day", self.NAMES, self.CATS)
        self.assertEqual([a.name for a in apps], ["Sharepoint", "SSL/TLS", "AnyDesk"])
        self.assertEqual([a.rank for a in apps], [1, 2, 3])
        self.assertEqual(apps[0].category, "Business tools")
        self.assertEqual(apps[0].period, "day")

    def test_id_37_is_not_confused_with_the_raw_catalog_id(self):
        # O catalogo tem o id 37 (Xfire); o certo e o combinado (AnyDesk).
        apps = map_top_apps(self.BODY, "day", self.NAMES, self.CATS)
        self.assertEqual(apps[2].name, "AnyDesk")

    def test_unknown_id_keeps_the_row_without_name(self):
        apps = map_top_apps({"top_all_traffic_by_application": [{"application_id": 1, "category_id": 99, "bytes": 5}]}, "hour", {}, {})
        self.assertEqual((apps[0].name, apps[0].category, apps[0].bytes), (None, None, 5))

    def test_bad_rows_are_skipped_and_missing_key_raises(self):
        body = {"top_all_traffic_by_application": [{"application_id": 1}, "x", {"application_id": 2, "category_id": 0, "bytes": 1}]}
        self.assertEqual(len(map_top_apps(body, "day", {}, {})), 1)
        with self.assertRaises(ValueError):
            map_top_apps({}, "day", {}, {})


class VpnClientMapperTests(unittest.TestCase):
    ITEM = {
        "id": "tun1:charles.farias:168430082",
        "interface": "tun1",
        "tunnel_ip": "10.10.10.2",
        "user": "charles.farias",
        "remote_ip": "170.244.220.173",
        "rx_bytes": 649400256,
        "tx_bytes": 1427651616,
        "vpn_type": "openvpn-server",
        "assoc_time": 1795514899,
        "up": True,
    }

    def test_maps_the_real_item(self):
        c = map_vpn_client(self.ITEM)
        self.assertEqual(c.key, "openvpn-server:charles.farias")
        self.assertEqual(c.tunnel_ip, "10.10.10.2")
        self.assertEqual(c.remote_ip, "170.244.220.173")
        self.assertEqual(c.rx_bytes, 649400256)
        self.assertEqual(c.connected_since, datetime.fromtimestamp(1795514899, timezone.utc))

    def test_without_user_or_down_is_ignored(self):
        self.assertIsNone(map_vpn_client({**self.ITEM, "user": None}))
        self.assertIsNone(map_vpn_client({**self.ITEM, "up": False}))

    def test_key_is_stable_when_the_tunnel_ip_changes(self):
        other = {**self.ITEM, "id": "tun1:charles.farias:999", "tunnel_ip": "10.10.10.9"}
        self.assertEqual(map_vpn_client(other).key, map_vpn_client(self.ITEM).key)

    def test_missing_type_gets_a_generic_prefix(self):
        self.assertEqual(map_vpn_client({"user": "ana"}).key, "vpn:ana")


if __name__ == "__main__":
    unittest.main()
