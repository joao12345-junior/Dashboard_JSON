# api/collector/test_rustdesk_sync.py
import unittest
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .rustdesk_sync import RustDeskAuditJob, read_interval_minutes

SAMPLE = (Path(__file__).resolve().parent / "testdata" / "rustdesk_avisos_exemplo.jsonl").read_bytes()
NOW = datetime(2026, 11, 27, 21, 0, tzinfo=timezone.utc)


class MemoryFiles:
    def __init__(self, files):
        self.files = files

    def size(self, name):
        data = self.files.get(name)
        return None if data is None else len(data)

    def read(self, name, offset, length=None):
        data = self.files[name][offset:]
        return data if length is None else data[:length]


class MemorySink:
    """Banco de mentira: guarda o que foi gravado e dedup pelo hash, como o real."""

    def __init__(self):
        self.state = None
        self.raw = {}
        self.machines = {}
        self.sessions = []
        self.fail_sessions = False

    def load_state(self, file_name):
        return self.state

    def save_batch(self, events, machines, file_name, state):
        new = [e for e in events if e.line_hash not in self.raw]
        for e in new:
            self.raw[e.line_hash] = e
        for m in machines:
            self.machines[m.machine_id] = m
        self.state = state
        return len(new)

    def load_events(self, since):
        return [e for e in self.raw.values() if e.kind in ("conn", "alarm") and e.received_at >= since]

    def replace_sessions(self, since, sessions):
        if self.fail_sessions:
            raise RuntimeError("banco fora")
        self.sessions = list(sessions)

    def close(self):
        pass


def opener(files, calls):
    @contextmanager
    def open_files():
        calls.append("open")
        yield files

    return open_files


class JobTests(unittest.TestCase):
    def test_first_cycle_reads_everything_and_builds_sessions(self):
        sink, calls = MemorySink(), []
        files = MemoryFiles({"avisos.jsonl": SAMPLE})
        r = RustDeskAuditJob(opener(files, calls), sink, now=lambda: NOW).run_once()
        self.assertTrue(r.ok, r.error)
        self.assertEqual((r.lines, r.machines, r.sessions), (43, 4, 6))
        self.assertEqual(len(sink.raw), 16)  # so conexao e alarme; sysinfo nao entra na raw
        self.assertEqual(calls, ["open"])  # uma conexao por ciclo
        self.assertEqual({s.status for s in sink.sessions}, {"concluida", "aberta", "bloqueada"})

    def test_second_cycle_without_news_inserts_nothing(self):
        sink = MemorySink()
        files = MemoryFiles({"avisos.jsonl": SAMPLE})
        job = RustDeskAuditJob(opener(files, []), sink, now=lambda: NOW)
        job.run_once()
        r = job.run_once()
        self.assertTrue(r.ok)
        self.assertEqual((r.lines, r.inserted), (0, 0))

    def test_reading_the_same_lines_again_does_not_duplicate(self):
        sink = MemorySink()
        files = MemoryFiles({"avisos.jsonl": SAMPLE})
        RustDeskAuditJob(opener(files, []), sink, now=lambda: NOW).run_once()
        sink.state = None  # perdeu o offset: rele tudo
        r = RustDeskAuditJob(opener(files, []), sink, now=lambda: NOW).run_once()
        self.assertEqual((r.lines, r.inserted), (43, 0))

    def test_sftp_failure_writes_nothing_and_does_not_raise(self):
        sink = MemorySink()

        @contextmanager
        def broken():
            raise ConnectionError("porta 22 bloqueada")
            yield  # pragma: no cover

        r = RustDeskAuditJob(broken, sink, now=lambda: NOW).run_once()
        self.assertFalse(r.ok)
        self.assertIn("ConnectionError", r.error)
        self.assertIsNone(sink.state)

    def test_session_failure_keeps_the_raw_events(self):
        sink = MemorySink()
        sink.fail_sessions = True
        r = RustDeskAuditJob(opener(MemoryFiles({"avisos.jsonl": SAMPLE}), []), sink, now=lambda: NOW).run_once()
        self.assertFalse(r.ok)
        self.assertEqual(r.inserted, 16)
        self.assertIn("sessoes", r.error)


class IntervalTests(unittest.TestCase):
    def test_interval(self):
        self.assertEqual(read_interval_minutes(None), 5)
        self.assertEqual(read_interval_minutes("1"), 2)
        self.assertEqual(read_interval_minutes("x"), 5)
        self.assertEqual(read_interval_minutes("10"), 10)


if __name__ == "__main__":
    unittest.main()
