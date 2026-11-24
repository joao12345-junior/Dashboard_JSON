# api/collector/test_site_sync.py
"""
Testes do sync periodico de sites (sem rede: sessao HTTP falsa).
Rodar:  cd api; python -m unittest collector.test_site_sync -v
"""
import threading
import unittest

from .site_sync import (
    DEFAULT_INTERVAL_MINUTES,
    MIN_INTERVAL_MINUTES,
    SiteSyncJob,
    read_interval_minutes,
    run_periodically,
)


class FakeResponse:
    def __init__(self, status=200, text="ok"):
        self.status_code, self.text = status, text


class FakeSession:
    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        path = url.split("8765", 1)[1]
        r = self.responses.get(path, FakeResponse())
        if isinstance(r, Exception):
            raise r
        return r


class SiteSyncJobTests(unittest.TestCase):
    def test_runs_the_four_steps_in_order_with_the_key(self):
        session = FakeSession()
        results = SiteSyncJob(session, "https://localhost:8765/", "KEY").run_once()
        paths = [url.split("8765", 1)[1] for url, _ in session.calls]
        self.assertEqual(
            paths, ["/api/site/check", "/api/site/sync-sentry", "/api/site/cleanup", "/api/logs/cleanup"]
        )
        self.assertTrue(all(kw["headers"]["X-Sync-Key"] == "KEY" for _, kw in session.calls))
        self.assertTrue(all(r.ok for r in results))
        # Sentry recebe corpo JSON "{}" como no .ps1; os outros vao sem corpo.
        self.assertEqual(session.calls[1][1]["json"], {})
        self.assertNotIn("json", session.calls[0][1])

    def test_failed_step_does_not_stop_the_next_ones(self):
        session = FakeSession(
            {"/api/site/check": ConnectionError("recusada"), "/api/site/cleanup": FakeResponse(401, "Chave de sync inválida")}
        )
        results = SiteSyncJob(session, "https://localhost:8765", "KEY").run_once()
        self.assertEqual(len(session.calls), 4)
        self.assertEqual([r.ok for r in results], [False, True, False, True])
        self.assertIsNone(results[0].status)
        self.assertIn("ConnectionError", results[0].detail)
        self.assertEqual(results[2].status, 401)

    def test_tls_verification_follows_the_setting(self):
        session = FakeSession()
        SiteSyncJob(session, "https://localhost:8765", "K", verify_tls=True).run_once()
        self.assertTrue(all(kw["verify"] for _, kw in session.calls))

    def test_interval_parsing(self):
        self.assertEqual(read_interval_minutes(None), DEFAULT_INTERVAL_MINUTES)
        self.assertEqual(read_interval_minutes("abc"), DEFAULT_INTERVAL_MINUTES)
        self.assertEqual(read_interval_minutes("1"), MIN_INTERVAL_MINUTES)
        self.assertEqual(read_interval_minutes("45"), 45)

    def test_runs_immediately_and_stops(self):
        session = FakeSession()
        stop = threading.Event()

        class OneShot(SiteSyncJob):
            def run_once(self):
                out = super().run_once()
                stop.set()  # encerra depois do primeiro ciclo
                return out

        run_periodically(OneShot(session, "https://localhost:8765", "K"), 30, stop)
        self.assertEqual(len(session.calls), 4)


if __name__ == "__main__":
    unittest.main()
