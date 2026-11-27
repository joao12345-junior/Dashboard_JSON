# api/test_rustdesk_queries.py
import unittest
from datetime import datetime, timezone
from decimal import Decimal

import rustdesk_queries as q


class FakeCursor:
    def __init__(self, results=(), rowcount=0):
        self.results = list(results)
        self.executed = []
        self.rowcount = rowcount

    def execute(self, sql, params=None):
        self.executed.append((" ".join(sql.split()), params))

    def fetchall(self):
        return self.results.pop(0)

    def fetchone(self):
        return self.results.pop(0)


T = datetime(2026, 11, 27, 20, 13, 47, tzinfo=timezone.utc)


class ParseTests(unittest.TestCase):
    def test_days(self):
        self.assertEqual(q.parse_days(None), 7)
        self.assertEqual(q.parse_days("", default=30), 30)
        self.assertEqual(q.parse_days("90"), 90)
        for bad in ("0", "366", "x", "1; DROP"):
            with self.assertRaises(q.InvalidParameter):
                q.parse_days(bad)

    def test_status_and_flag(self):
        self.assertIsNone(q.parse_status(None))
        self.assertEqual(q.parse_status("bloqueada"), "bloqueada")
        with self.assertRaises(q.InvalidParameter):
            q.parse_status("qualquer")
        self.assertTrue(q.parse_flag("1"))
        self.assertFalse(q.parse_flag(None))

    def test_test_flag_payload(self):
        self.assertTrue(q.parse_test_flag_payload({"is_test": True}))
        for bad in (None, {}, {"is_test": "sim"}):
            with self.assertRaises(q.InvalidParameter):
                q.parse_test_flag_payload(bad)


class ListSessionsTests(unittest.TestCase):
    def _run(self, **kw):
        session = {
            "machine_id": "419304090", "machine_name": "servweb", "machine_is_test": False, "conn_id": 631,
            "started_at": T, "authenticated_at": T, "ended_at": None, "peer_id": "234838759",
            "peer_name": "Joaov", "peer_ip": "170.244.220.173", "peer_hostname": "joao-dell",
            "primary_auth": 3, "conn_type": 0, "session_id": Decimal("14704232641301615989"),
            "alarm_type": None, "status": "aberta",
        }
        cur = FakeCursor([[session], [{"status": "aberta", "n": 1}]])
        args = dict(days=7, status=None, machine_id=None, include_test=False)
        args.update(kw)
        return q.list_sessions(cur, **args), cur

    def test_session_id_goes_as_text_without_losing_digits(self):
        result, _ = self._run()
        self.assertEqual(result["sessions"][0]["session_id"], "14704232641301615989")
        self.assertEqual(result["sessions"][0]["started_at"], "2026-11-27T20:13:47+00:00")
        self.assertEqual(result["counts"], {"concluida": 0, "aberta": 1, "bloqueada": 0, "tentativa": 0})

    def test_filters_are_parameters_and_test_machines_are_hidden_by_default(self):
        _, cur = self._run(status="bloqueada", machine_id="28426763")
        sql, params = cur.executed[0]
        self.assertIn("s.status = %(status)s", sql)
        self.assertIn("COALESCE(m.is_test, false) = false", sql)
        self.assertEqual((params["status"], params["machine"], params["days"]), ("bloqueada", "28426763", 7))
        self.assertNotIn("28426763", sql)
        _, cur = self._run(include_test=True)
        self.assertNotIn("is_test, false) = false", cur.executed[0][0])


class CleanupTests(unittest.TestCase):
    def test_without_the_table_does_nothing(self):
        cur = FakeCursor([(False,)])
        self.assertEqual(q.cleanup(cur), {"raw": 0, "sessions": 0})
        self.assertEqual(len(cur.executed), 1)

    def test_deletes_by_retention(self):
        cur = FakeCursor([(True,)], rowcount=3)
        self.assertEqual(q.cleanup(cur, 365), {"raw": 3, "sessions": 3})
        self.assertEqual(cur.executed[1][1], (365,))


if __name__ == "__main__":
    unittest.main()
