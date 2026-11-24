# api/test_wan_history.py
import unittest
from datetime import datetime, timezone

from wan_history import PERIODS, fetch_history, resolve_period


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.executed = []
        self._last = None

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        self._last = sql

    def fetchone(self):
        return {"server_time": datetime(2026, 11, 24, 18, 0, tzinfo=timezone.utc)}

    def fetchall(self):
        return self.rows


def row(wan, minute, **over):
    base = {
        "wan_group": wan,
        "bucket": datetime(2026, 11, 24, 17, minute, tzinfo=timezone.utc),
        "rx_bps": 6020376.4,
        "rx_bps_max": 7000000,
        "tx_bps": 100,
        "tx_bps_max": 200,
        "latency_ms": 9.66,
        "latency_ms_max": 12,
        "samples": 5,
        "down_samples": 0,
    }
    base.update(over)
    return base


class ResolvePeriodTests(unittest.TestCase):
    def test_known_periods(self):
        self.assertEqual(resolve_period("1h").step_seconds, 60)
        self.assertEqual(resolve_period("1M".lower()).key, "1m")
        self.assertEqual(resolve_period(" 1W ").key, "1w")

    def test_unknown_or_empty_falls_back_to_one_day(self):
        self.assertEqual(resolve_period(None).key, "1d")
        self.assertEqual(resolve_period("").key, "1d")
        self.assertEqual(resolve_period("1y; DROP TABLE x").key, "1d")

    def test_every_period_has_a_sane_number_of_points(self):
        for period in PERIODS.values():
            points = period.span_seconds / period.step_seconds
            self.assertTrue(50 <= points <= 400, period)


class FetchHistoryTests(unittest.TestCase):
    def test_groups_by_wan_and_formats_values(self):
        cur = FakeCursor([row("WAN", 0), row("WAN", 5, latency_ms=None), row("WAN2", 0, down_samples=2)])
        result = fetch_history(cur, PERIODS["1d"])
        self.assertEqual(result["period"], "1d")
        self.assertEqual(result["step_seconds"], 300)
        self.assertEqual(result["server_time"], "2026-11-24T18:00:00+00:00")
        self.assertEqual(sorted(result["series"]), ["WAN", "WAN2"])
        first = result["series"]["WAN"][0]
        self.assertEqual(first["t"], "2026-11-24T17:00:00+00:00")
        self.assertEqual(first["rx_bps"], 6020376)
        self.assertEqual(first["latency_ms"], 9.7)
        self.assertIsNone(result["series"]["WAN"][1]["latency_ms"])
        self.assertEqual(result["series"]["WAN2"][0]["down_samples"], 2)

    def test_parameters_come_from_the_period_not_from_the_sql_text(self):
        cur = FakeCursor([])
        fetch_history(cur, PERIODS["1w"])
        sql, params = cur.executed[1]
        self.assertEqual(params, {"step": 1800, "span": 7 * 86400})
        self.assertNotIn("1800", sql)

    def test_empty_history(self):
        self.assertEqual(fetch_history(FakeCursor([]), PERIODS["1h"])["series"], {})


if __name__ == "__main__":
    unittest.main()
