"""No-network falsification of local-only Ollama service readiness and lifecycle."""
import io
from pathlib import Path
import sys
import unittest
import urllib.error
import urllib.request
import urllib.response
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "experiments" / "freedm-open"))
import ollama_health as health


class MockHTTP:
    def __init__(self, content=b'{"version":"0.12.9"}', status=200):
        self.content = content
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self, n):
        return self.content[:n]


class OllamaPreflightTests(unittest.TestCase):
    def test_only_loopback_version_endpoint_no_write_or_proxy(self):
        calls = []
        def fetch(request, timeout):
            calls.append((request.full_url, request.get_method(), timeout))
            return MockHTTP()
        self.assertEqual(health.ollama_version(opener=fetch), "0.12.9")
        self.assertEqual(calls, [(health.URL, "GET", 2.0)])
        self.assertEqual(health.URL, "http://127.0.0.1:11434/api/version")
        with self.assertRaisesRegex(ValueError, "bounded"):
            health.ollama_version(opener=fetch, timeout=30)
        self.assertEqual(len(calls), 1)

    def test_http_redirects_never_leave_exact_loopback_endpoint(self):
        opener = health.local_opener()
        redirects = [h for h in opener.handlers
                     if isinstance(h, urllib.request.HTTPRedirectHandler)]
        self.assertEqual(len(redirects), 1)
        self.assertIsInstance(redirects[0], health.RejectRedirects)
        pinned = urllib.request.Request(health.URL)
        for destination in (
            "http://127.0.0.1:11435/api/version",
            "http://example.org/api/version",
            "https://example.org/private",
            "/different",
        ):
            with self.subTest(redirect=destination):
                with self.assertRaisesRegex(ValueError, "redirect refused"):
                    redirects[0].redirect_request(pinned, None, 302,
                                                  "Found", {}, destination)

    def test_configured_proxy_is_bypassed_without_network(self):
        response = urllib.response.addinfourl(
            io.BytesIO(b'{"version":"0.12.9"}'), {}, health.URL, 200)
        response.msg = "OK"
        # An empty ProxyHandler disables proxy discovery, but urllib may omit
        # it from opener.handlers because it has no protocol methods to add.
        # Disable host bypass rules so NO_PROXY cannot hide a regression.
        with patch.object(urllib.request, "getproxies", return_value={
            "http": "http://proxy.invalid:3128",
        }), patch.object(urllib.request, "proxy_bypass", return_value=False), \
             patch.object(urllib.request.HTTPHandler, "do_open",
                         return_value=response) as transport:
            self.assertEqual(health.ollama_version(), "0.12.9")
        transport.assert_called_once()
        request = transport.call_args.args[1]
        self.assertEqual(request.host, "127.0.0.1:11434")
        self.assertEqual(request.selector, "/api/version")
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(request.timeout, 2.0)
        self.assertFalse(request.has_proxy())

    def test_unavailable_server_has_actionable_fixed_boundary(self):
        calls = []
        def refused(request, timeout):
            calls.append(1)
            raise urllib.error.URLError(ConnectionRefusedError(111, "connection refused"))
        with self.assertRaisesRegex(ConnectionError, "ollama serve"):
            health.ollama_version(opener=refused)
        self.assertEqual(calls, [1])  # no retry or recovery disguised as health
        with patch.object(health, "ollama_version", side_effect=ConnectionError(
             "Ollama is unreachable at 127.0.0.1:11434")):
            self.assertEqual(health.main(["--quiet"]), 1)

    def test_corrupt_oversized_or_invalid_version_fail_closed(self):
        cases = (
            (b'{}', 200),
            (b'[]', 200),
            (b'{"version":""}', 200),
            (b'{"version":123}', 200),
            (b'{', 200),
            (b'x' * (health.MAX_BYTES + 1), 200),
            (b'{"version":"0.12.9"}', 503),
        )
        for content, status in cases:
            with self.subTest(content=content[:12], status=status):
                with self.assertRaises((ValueError, UnicodeError)):
                    health.ollama_version(
                        opener=lambda req, timeout: MockHTTP(content, status))

    def test_workflow_reuses_or_starts_only_owned_loopback_process(self):
        workflow = (ROOT / ".github/workflows/freedm-qwen2b-probe.yml").read_text()
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("github.actor == 'EmergentMonk'", workflow)
        self.assertIn("github.ref == 'refs/heads/main'", workflow)
        self.assertIn("inputs.acknowledge_local_execution == true", workflow)
        self.assertIn('OLLAMA_HOST: "127.0.0.1:11434"', workflow)
        self.assertIn("if health; then", workflow)
        self.assertIn("exec ollama serve", workflow)
        self.assertIn("ollama_pid=$!", workflow)
        self.assertIn('trap stop_owned_ollama EXIT', workflow)
        self.assertIn('kill "$ollama_pid"', workflow)
        self.assertIn("for attempt in $(seq 1 30)", workflow)
        self.assertNotIn("ollama pull", workflow)
        self.assertNotIn("OPENAI_API_KEY", workflow)
        self.assertNotIn("sudo ", workflow)
        self.assertNotIn("systemctl", workflow)
        self.assertNotIn("experiments/freedm-open/live.py", workflow)
        live = (ROOT / ".github/workflows/freedm-open-vision.yml").read_text()
        self.assertIn("not r.get('liveReadiness',{}).get('eligible')", live)


if __name__ == "__main__":
    unittest.main()
