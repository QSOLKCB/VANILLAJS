"""Offline tests for owner-controlled paid research. No real API traffic."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[1] / "scripts/proof_speed_research.py"
spec = importlib.util.spec_from_file_location("proof_speed_research", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def report():
    return {
        "kind": "qsol.vanillajs.proof-speed.observations.v1",
        "commit": "f" * 40,
        "method": {"order": "AB/BA", "timing": "CPU only"},
        "cases": [
            {"fixture": str(i), "samplesMs": {
                "baseline": [1.0] * 9, "optimized": [2.0] * 9}}
            for i in range(7)
        ],
    }


class ResearchGate(unittest.TestCase):
    def test_three_bounded_requests_and_envelope_below_owner_limit(self):
        requests = module.messages(report())
        self.assertEqual([name for name, _ in requests],
                         ["statistics", "systems", "adversarial"])
        self.assertTrue(all(len(payload) <= module.MAX_INPUT_BYTES
                            for _, payload in requests))
        self.assertLess(module.envelope(), module.MAX_AUTHORIZED_USD)
        for _, body in requests:
            obj = json.loads(body)
            self.assertFalse(obj["store"])
            self.assertNotIn("tools", obj)
            self.assertEqual(obj["model"], module.MODEL)
            self.assertEqual(obj["max_output_tokens"],
                             module.MAX_OUTPUT_TOKENS)

    def test_bad_and_incomplete_reports_fail_before_network(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "report.json"
            for data in [{"kind": "wrong"}, {**report(), "cases": []}]:
                path.write_text(json.dumps(data))
                with self.assertRaises(ValueError):
                    module.run(path, Path(d) / "unused", dry_run=True)
            path.write_text(json.dumps(report()))
            with patch.dict("os.environ", {"GITHUB_SHA": "e" * 40}):
                with self.assertRaises(ValueError):
                    module.run(path, Path(d) / "unused", dry_run=True)

    def test_dry_run_no_api_secret_and_no_network(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "report.json"
            path.write_text(json.dumps(report()))
            with patch.dict("os.environ", {}, clear=True):
                with patch.object(module, "send_once",
                                  side_effect=AssertionError("network forbidden")):
                    summary = module.run(path, Path(d) / "unused", dry_run=True)
            self.assertEqual(summary["plannedRequests"], 3)
            self.assertFalse((Path(d) / "unused").exists())

    def test_real_mode_requires_key_and_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "report.json"
            path.write_text(json.dumps(report()))
            with patch.dict("os.environ", {"GITHUB_RUN_ATTEMPT": "2"},
                            clear=True):
                with self.assertRaisesRegex(ValueError, "rerun"):
                    module.run(path, Path(d) / "unused")
            with patch.dict("os.environ", {"GITHUB_RUN_ATTEMPT": "1"},
                            clear=True):
                with self.assertRaisesRegex(ValueError, "OPENAI_API_KEY"):
                    module.run(path, Path(d) / "unused")

    def test_provider_failure_never_retries_or_claims_complete(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "report.json"
            path.write_text(json.dumps(report()))
            with patch.dict("os.environ", {"OPENAI_API_KEY": "TEST-NOT-A-KEY"},
                            clear=True):
                with patch.object(module, "send_once",
                                  side_effect=TimeoutError("unavailable")) as mock:
                    evidence = module.run(path, Path(d) / "evidence")
            self.assertEqual(mock.call_count, 1)
            self.assertEqual(evidence["status"], "INCOMPLETE")
            self.assertEqual(evidence["reports"], [])
            self.assertNotIn("TEST-NOT-A-KEY",
                             (Path(d) / "evidence" / "RESEARCH.json").read_text())


if __name__ == "__main__":
    unittest.main()
