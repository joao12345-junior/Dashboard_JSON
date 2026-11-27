# api/collector/test_rustdesk_audit.py
"""Regras do RustDesk com as linhas REAIS do VPS (27/11): testdata/rustdesk_avisos_exemplo.jsonl."""
import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .rustdesk_audit import (
    AuditEvent,
    SysInfo,
    build_sessions,
    latest_sysinfo,
    line_hash,
    parse_line,
    parse_lines,
)

SAMPLE = Path(__file__).resolve().parent / "testdata" / "rustdesk_avisos_exemplo.jsonl"
LINES = SAMPLE.read_text(encoding="utf-8").splitlines()
#: Depois da ultima linha do exemplo (20:29:08), com folga.
NOW = datetime(2026, 11, 27, 21, 0, tzinfo=timezone.utc)

SERVWEB, OPT020 = "419304090", "28426763"


def by_conn(sessions, machine_id, conn_id):
    return next(s for s in sessions if s.machine_id == machine_id and s.conn_id == conn_id)


class ParseLineTests(unittest.TestCase):
    def test_sample_splits_into_events_and_sysinfo(self):
        batch = parse_lines(LINES)
        self.assertEqual(batch.invalid, 0)
        self.assertEqual(len(batch.events) + len(batch.sysinfos), 43)
        self.assertEqual({e.kind for e in batch.events}, {"conn", "alarm"})

    def test_new_has_the_ip_of_who_connects_and_no_session_yet(self):
        e = parse_line(LINES[1])
        self.assertIsInstance(e, AuditEvent)
        self.assertEqual((e.action, e.conn_id, e.machine_id), ("new", 1236, SERVWEB))
        self.assertEqual(e.peer_ip, "170.244.220.173")
        self.assertIsNone(e.session_id)  # o new vem com 0 = "ainda nao sei"

    def test_auth_has_peer_method_type_and_a_session_id_bigger_than_bigint(self):
        e = parse_line(LINES[2])
        self.assertEqual(e.action, "auth")
        self.assertEqual((e.peer_id, e.peer_name), ("234838759", "Joaov"))
        self.assertEqual((e.primary_auth, e.conn_type), (3, 0))
        self.assertEqual(e.session_id, 14704232641301615989)
        self.assertGreater(e.session_id, 2**63 - 1)  # por isso numeric(20) no banco

    def test_alarm_reads_the_json_inside_the_info_string(self):
        alarm = next(parse_line(l) for l in LINES if "/api/audit/alarm" in l)
        self.assertEqual((alarm.kind, alarm.alarm_type, alarm.conn_id), ("alarm", 2, 1499))
        self.assertEqual((alarm.peer_id, alarm.peer_ip, alarm.peer_name), ("234838759", "170.244.220.173", "Joaov"))
        self.assertIsNone(alarm.action)

    def test_alarm_with_broken_info_keeps_the_event(self):
        raw = json.dumps({
            "recebido_utc": "2026-11-27T20:29:08+00:00", "ip_origem": "1.1.1.1", "caminho": "/api/audit/alarm",
            "corpo": {"conn_id": 1, "id": "9", "info": "{nao e json", "typ": 1},
        })
        e = parse_line(raw)
        self.assertEqual((e.alarm_type, e.peer_ip), (1, None))

    def test_sysinfo_without_username_when_nobody_is_logged(self):
        info = parse_line(LINES[22])  # opt020 as 20:21:06
        self.assertIsInstance(info, SysInfo)
        self.assertEqual(info.hostname, "opt020")
        self.assertIsNone(info.username)

    def test_invalid_lines(self):
        self.assertIsNone(parse_line(""))
        self.assertIsNone(parse_line("{quebrado"))
        self.assertIsNone(parse_line(json.dumps({"caminho": "/api/audit/conn", "corpo": {}})))  # sem data
        self.assertIsNone(parse_line(json.dumps({"recebido_utc": "2026-11-27T20:00:00", "corpo": {}})))  # sem fuso
        self.assertEqual(parse_lines(["", "x", LINES[0]]).invalid, 1)

    def test_unknown_path_is_kept_as_other(self):
        raw = json.dumps({"recebido_utc": "2026-11-27T20:00:00+00:00", "caminho": "/api/audit/file", "corpo": {"id": "1"}})
        self.assertEqual(parse_line(raw).kind, "file")
        raw = raw.replace("/api/audit/file", "/api/novo")
        self.assertEqual(parse_line(raw).kind, "other")

    def test_hash_ignores_line_ending(self):
        self.assertEqual(line_hash(LINES[0]), line_hash(LINES[0] + "\r\n"))
        self.assertNotEqual(line_hash(LINES[0]), line_hash(LINES[1]))


class LatestSysinfoTests(unittest.TestCase):
    def test_one_per_machine_and_missing_username_keeps_the_last_known(self):
        infos = latest_sysinfo(parse_lines(LINES).sysinfos)
        by_id = {i.machine_id: i for i in infos}
        self.assertEqual(set(by_id), {SERVWEB, OPT020, "234838759", "129257027"})
        self.assertEqual(by_id[OPT020].last_username, "opt006")
        self.assertEqual(by_id[SERVWEB].received_at, datetime(2026, 11, 27, 20, 26, 7, tzinfo=timezone.utc))

    def test_latest_without_username_keeps_the_last_known_separately(self):
        with_user = parse_line(LINES[21])  # opt020 20:20:34, usuario opt006
        without_user = parse_line(LINES[22])  # opt020 20:21:06, ninguem logado
        [info] = latest_sysinfo([without_user, with_user])
        self.assertEqual(info.received_at, without_user.received_at)
        self.assertIsNone(info.username)  # ninguem logado agora
        self.assertEqual(info.last_username, "opt006")


class BuildSessionsTests(unittest.TestCase):
    def setUp(self):
        self.sessions = build_sessions(parse_lines(LINES).events, NOW)

    def test_one_session_per_connection(self):
        keys = sorted((s.machine_id, s.conn_id) for s in self.sessions)
        self.assertEqual(
            keys,
            [(OPT020, 1073), (OPT020, 1498), (OPT020, 1499), (SERVWEB, 631), (SERVWEB, 632), (SERVWEB, 1236)],
        )

    def test_completed_screen_session(self):
        s = by_conn(self.sessions, SERVWEB, 631)
        self.assertEqual(s.status, "concluida")
        self.assertEqual((s.peer_id, s.peer_name, s.peer_ip), ("234838759", "Joaov", "170.244.220.173"))
        self.assertEqual((s.primary_auth, s.conn_type), (3, 0))
        self.assertEqual(s.ended_at - s.started_at, timedelta(minutes=4, seconds=48))

    def test_file_window_shares_the_session_id_with_the_screen(self):
        files = by_conn(self.sessions, SERVWEB, 632)
        self.assertEqual((files.status, files.conn_type), ("concluida", 1))
        self.assertEqual(files.session_id, by_conn(self.sessions, SERVWEB, 631).session_id)

    def test_without_close_stays_open(self):
        self.assertEqual(by_conn(self.sessions, SERVWEB, 1236).status, "aberta")
        self.assertIsNone(by_conn(self.sessions, OPT020, 1073).ended_at)

    def test_alarm_without_auth_is_blocked(self):
        s = by_conn(self.sessions, OPT020, 1499)
        self.assertEqual(s.status, "bloqueada")
        self.assertEqual(s.alarm_type, 2)
        self.assertIsNone(s.authenticated_at)
        self.assertEqual(s.peer_name, "Joaov")  # so o alarme diz quem errou a senha
        self.assertIsNotNone(s.ended_at)

    def _event(self, action, conn_id, minute, **kw):
        base = dict(
            line_hash=f"{action}{conn_id}{minute}", received_at=datetime(2026, 11, 27, 20, minute, tzinfo=timezone.utc),
            source_ip=None, path="/api/audit/conn", kind="conn", machine_id="m", conn_id=conn_id, action=action,
            peer_id=None, peer_name=None, peer_ip=None, primary_auth=None, conn_type=None, session_id=None,
            alarm_type=None,
        )
        base.update(kw)
        return AuditEvent(**base)

    def test_new_without_auth_becomes_attempt_after_closing_or_timeout(self):
        closed = build_sessions([self._event("new", 1, 0), self._event("close", 1, 1)], NOW)
        self.assertEqual(closed[0].status, "tentativa")
        recent = build_sessions([self._event("new", 2, 0)], datetime(2026, 11, 27, 20, 5, tzinfo=timezone.utc))
        self.assertEqual(recent[0].status, "aberta")  # o auth pode estar chegando
        old = build_sessions([self._event("new", 2, 0)], NOW)
        self.assertEqual(old[0].status, "tentativa")

    def test_conn_id_reused_after_service_restart_opens_a_new_session(self):
        sessions = build_sessions(
            [self._event("new", 5, 0), self._event("auth", 5, 0), self._event("new", 5, 30), self._event("close", 5, 31)],
            NOW,
        )
        self.assertEqual([s.status for s in sessions], ["aberta", "tentativa"])

    def test_close_without_new_is_ignored_and_auth_without_new_opens(self):
        sessions = build_sessions([self._event("close", 7, 0), self._event("auth", 8, 1)], NOW)
        self.assertEqual([(s.conn_id, s.status) for s in sessions], [(8, "aberta")])

    def test_other_machine_with_same_conn_id_is_a_different_session(self):
        sessions = build_sessions(
            [self._event("new", 1, 0), self._event("new", 1, 0, machine_id="outra", line_hash="x")], NOW
        )
        self.assertEqual(len(sessions), 2)


if __name__ == "__main__":
    unittest.main()
