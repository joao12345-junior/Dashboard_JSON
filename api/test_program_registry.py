# test_program_registry.py
"""Testes do registro de programas -- sem banco (cursor falso)."""
import unittest

import program_registry as registry


class FakeCursor:
    """Grava cada execute(); `rowcounts` define o rowcount depois de cada um."""

    def __init__(self, rowcounts=()):
        self.calls: list[tuple[str, tuple]] = []
        self._rowcounts = list(rowcounts)
        self.rowcount = 0

    def execute(self, sql, params=()):
        self.calls.append((" ".join(sql.split()), tuple(params)))
        self.rowcount = self._rowcounts.pop(0) if self._rowcounts else 0


class ParseTests(unittest.TestCase):
    def test_program_name_keeps_exact_text(self):
        # sem strip: precisa casar com o texto cru de app_logs.programa
        self.assertEqual(registry.parse_program_name({"programa": " Cofre "}), " Cofre ")

    def test_program_name_rejects_bad_input(self):
        for body in (None, [], {}, {"programa": ""}, {"programa": "   "}, {"programa": 3}):
            with self.assertRaises(registry.InvalidPayload):
                registry.parse_program_name(body)

    def test_program_name_rejects_too_long(self):
        with self.assertRaises(registry.InvalidPayload):
            registry.parse_program_name({"programa": "x" * (registry.MAX_PROGRAM_LENGTH + 1)})

    def test_visibility_payload_ok(self):
        for vis in registry.VISIBILITIES:
            self.assertEqual(
                registry.parse_visibility_payload({"programa": "Cofre", "visibility": vis}),
                ("Cofre", vis),
            )

    def test_visibility_payload_rejects_unknown_value(self):
        for vis in (None, "", "visible", "HIDDEN", 1):
            with self.assertRaises(registry.InvalidPayload):
                registry.parse_visibility_payload({"programa": "Cofre", "visibility": vis})


class SqlTests(unittest.TestCase):
    def test_set_visibility_auto_is_stored_as_null(self):
        cur = FakeCursor()
        registry.set_visibility(cur, "Cofre", "auto")
        sql, params = cur.calls[0]
        self.assertIn("ON CONFLICT (programa) DO UPDATE", sql)
        self.assertEqual(params, ("Cofre", None, "Cofre"))

    def test_set_visibility_hidden_is_stored_as_text(self):
        cur = FakeCursor()
        registry.set_visibility(cur, "Cofre", "hidden")
        self.assertEqual(cur.calls[0][1], ("Cofre", "hidden", "Cofre"))

    def test_delete_program_removes_logs_then_registry_and_returns_log_count(self):
        cur = FakeCursor(rowcounts=[10000, 1])
        deleted = registry.delete_program(cur, "Cofre")
        self.assertEqual(deleted, 10000)
        self.assertEqual(len(cur.calls), 2)
        self.assertIn("DELETE FROM optsislog.app_logs", cur.calls[0][0])
        self.assertIn("DELETE FROM optsislog.app_programs", cur.calls[1][0])
        self.assertEqual(cur.calls[0][1], ("Cofre",))

    def test_delete_program_uses_bound_parameter_not_string_formatting(self):
        cur = FakeCursor()
        registry.delete_program(cur, "x'; DROP TABLE optsislog.app_logs; --")
        for sql, params in cur.calls:
            self.assertNotIn("DROP TABLE", sql)
            self.assertEqual(params, ("x'; DROP TABLE optsislog.app_logs; --",))

    def test_sync_ignores_null_and_empty_program(self):
        cur = FakeCursor()
        registry.sync_last_log_at(cur)
        sql = cur.calls[0][0]
        self.assertIn("programa IS NOT NULL AND programa <> ''", sql)
        self.assertIn("GREATEST", sql)


if __name__ == "__main__":
    unittest.main()
