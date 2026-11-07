"""No-network budget/reservation and evidence-gate tests for paid Sol reviews."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("sol_review",ROOT/"scripts/review-lab2d-sol.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class SolReviewPolicyTests(unittest.TestCase):
    def test_upper_bound_budget_is_strict_and_short_context_is_not_assumed(self):
        self.assertLess(m.conservative_reservation("A"*60000),10)
        self.assertLess(m.conservative_reservation("small"),1)
        self.assertGreater(m.conservative_reservation("long"*20000),0)
        self.assertEqual(m.MODEL,"gpt-6.1-sol")

    def test_missing_or_invalid_public_evidence_refused_without_network(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"report.json"
            with self.assertRaises(ValueError):
                m.preflight(p,10)
            p.write_text('{"untrusted":"private bytes"}')
            with self.assertRaises(ValueError):
                m.preflight(p,10)
            for budget in (-1,0,10.01,float("nan")):
                with self.assertRaises(ValueError):m.preflight(p,budget)

    def test_preflight_never_sends_unsupported_lab_content(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"report.json"
            strict={"kind":"qsol.vanillajs.lab2d.evidence.v1",
                    "scenes":[{}]*4,"audio":{"chunkIdentical":True},
                    "sourceSHA256":{"a":"b","b":"c","c":"d","d":"e"}}
            report={"strict":strict,
                    "strictSHA256":__import__("hashlib").sha256(
                        m.canonical(strict).encode()).hexdigest(),
                    "observations":{}}
            p.write_text(json.dumps(report))
            self.assertEqual(m.preflight(p,10)["strict"],strict)
            report["strictSHA256"]="a"*64;p.write_text(json.dumps(report))
            with self.assertRaises(ValueError):m.preflight(p,10)
            report["strictSHA256"]=__import__("hashlib").sha256(
                m.canonical(strict).encode()).hexdigest()
            report["privateUserData"]="secret"
            p.write_text(json.dumps(report))
            with self.assertRaises(ValueError):m.preflight(p,10)

    def test_no_api_secret_means_no_requests_or_output(self):
        with tempfile.TemporaryDirectory() as d,patch.dict(__import__("os").environ,{},clear=True):
            with self.assertRaisesRegex(ValueError,"OPENAI_API_KEY"):
                m.evaluate(Path(d)/"unused.json",Path(d)/"out.json",10)
            self.assertFalse((Path(d)/"out.json").exists())


if __name__=="__main__":
    unittest.main()
