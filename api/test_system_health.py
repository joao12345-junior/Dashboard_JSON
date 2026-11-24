# test_system_health.py
"""Fotografia de saude -- sem banco (cursor falso)."""
import unittest
from datetime import datetime, timezone

import system_health


class FakeCursor:
    def __init__(self, row):
        self._row = row
        self.sql = ""

    def execute(self, sql, params=()):
        self.sql = " ".join(sql.split())

    def fetchone(self):
        return self._row


class FetchSnapshotTests(unittest.TestCase):
    def test_converts_datetimes_to_iso_and_keeps_none(self):
        t = datetime(2026, 11, 24, 15, 0, 0, tzinfo=timezone.utc)
        row = {key: None for key in system_health.SNAPSHOT_KEYS}
        row["server_time"] = t
        row["unifi_poller"] = t
        snapshot = system_health.fetch_snapshot(FakeCursor(row))
        self.assertEqual(snapshot["server_time"], "2026-11-24T15:00:00+00:00")
        self.assertEqual(snapshot["unifi_poller"], "2026-11-24T15:00:00+00:00")
        self.assertIsNone(snapshot["app_logs"])

    def test_returns_exactly_the_documented_keys(self):
        row = {key: None for key in system_health.SNAPSHOT_KEYS}
        row["extra"] = "ignorado"
        snapshot = system_health.fetch_snapshot(FakeCursor(row))
        self.assertEqual(set(snapshot), set(system_health.SNAPSHOT_KEYS))

    def test_query_reads_last_row_by_primary_key_not_a_table_scan(self):
        cur = FakeCursor({key: None for key in system_health.SNAPSHOT_KEYS})
        system_health.fetch_snapshot(cur)
        # 4 tabelas grandes + app_logs: todas pelo indice do id
        self.assertEqual(cur.sql.count("ORDER BY id DESC LIMIT 1"), 5)
        self.assertNotIn("max(created_at)", cur.sql)


if __name__ == "__main__":
    unittest.main()
