"""Offline Qwen3-VL 2B text/image isolation: no network, game or model loading."""
import argparse
import base64
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "experiments" / "freedm-open"))
import qwen2b_probe as p


def png():
    return (b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" +
            b"\x00\x00\x01@\x00\x00\x00\xf0" +
            b"\x08\x02\x00\x00\x00" + b"\x00\x00\x00\x00" + b"EOF!")


def fake_source():
    img = png()
    rows = [{} for _ in range(p.IMAGE_ROUND)]
    rows.append({"observations": [{"imageSHA256": p.sha256(img)}]})
    return {"source": {"turns": rows},
            "frames": {(p.IMAGE_ROLE, p.IMAGE_ROUND): img},
            "match": p.replay.TERRA_MATCH_SHA256,
            "sums": p.replay.TERRA_SUMS_SHA256}


def identity(**kwargs):
    return {"modelTag": p.MODEL, "sha256": p.MODEL_DIGEST,
            "bytes": 1889519687}


class ProbeContracts(unittest.TestCase):
    def test_matrix_exactly_seven_text_then_seven_image(self):
        rows = p.cases()
        self.assertEqual(len(rows), 14)
        self.assertEqual(len({x["id"] for x in rows}), 14)
        self.assertEqual([x["modality"] for x in rows],
                         ["text"] * 7 + ["image"] * 7)
        self.assertEqual(sum(x["schema"] == "tiny" for x in rows), 12)

    def test_pairs_same_prompt_and_parameters_except_the_image(self):
        for fmt in p.FORMATS:
            for think in p.THINK_MODES:
                t = next(x for x in p.cases()
                         if x["id"] == f"tiny-text-{fmt}-{think}")
                v = next(x for x in p.cases()
                         if x["id"] == f"tiny-image-{fmt}-{think}")
                a, prompt_a = p.request_for(t, None)
                b, prompt_b = p.request_for(v, png())
                self.assertEqual(prompt_a, prompt_b)
                self.assertEqual({k: value for k, value in a.items()
                                  if k != "messages"},
                                 {k: value for k, value in b.items()
                                  if k != "messages"})
                self.assertEqual(a["messages"][0]["content"],
                                 b["messages"][0]["content"])
                self.assertNotIn("images", a["messages"][0])
                self.assertEqual(base64.b64decode(
                    b["messages"][0]["images"][0]), png())
                self.assertEqual(a["options"]["num_predict"], 384)
                self.assertNotIn("tools", a)
                if think == "omitted":
                    self.assertNotIn("think", a)
                else:
                    self.assertIs(a["think"], think == "true")

    def test_one_field_and_six_field_validation_remain_strict(self):
        c = p.cases()[0]
        self.assertEqual(p.check_content(c, '{"move":"forward"}')["status"],
                         "VALID_EXACT")
        for raw, code in (
            ("", "EMPTY_CONTENT"),
            ('{"move":"backward"}', "SCHEMA_REJECTED"),
            ('{"move":"forward","x":1}', "SCHEMA_REJECTED"),
            ("not json", "INVALID_JSON"),
            ('[1,2]', "SCHEMA_REJECTED"),
        ):
            self.assertEqual(p.check_content(c, raw)["status"], code)
        f = next(x for x in p.cases() if x["id"] ==
                 "full-text-schema-false")
        self.assertEqual(p.check_content(f, json.dumps(p.FULL_EXPECTED))["status"],
                         "VALID_EXACT")
        changed = dict(p.FULL_EXPECTED, move="left")
        self.assertEqual(p.check_content(f, json.dumps(changed))["status"],
                         "VALID_DIFFERENT")
        changed["unexpected"] = True
        self.assertEqual(p.check_content(f, json.dumps(changed))["status"],
                         "SCHEMA_REJECTED")
        with self.assertRaises(ValueError):
            p.check_content(c, "x" * 4097)

    def test_same_exact_installed_model_digest_or_abort(self):
        self.assertEqual(p.MODEL_DIGEST,
            "0635d9d857d497aeadba3d7d27485746c50554446f9f6ec01ef39788221adbe8")
        models = [{"name": p.MODEL, "digest": p.MODEL_DIGEST,
                   "size": 1889519687}]
        with patch.object(p.replay, "local_http",
                          return_value={"models": models}):
            self.assertEqual(p.model_inventory()["sha256"], p.MODEL_DIGEST)
            models[0]["digest"] = "f" * 64
            with self.assertRaises(ValueError):
                p.model_inventory()
            models[0]["digest"] = p.MODEL_DIGEST
            models[0]["remote_host"] = "not local"
            with self.assertRaises(ValueError):
                p.model_inventory()

    def test_ollama_metadata_thinking_without_private_template(self):
        def fake(path, body=None, **kwargs):
            if path == "/api/version":
                return {"version": "0.12.9"}
            self.assertEqual(path, "/api/show")
            self.assertEqual(body, {"model": p.MODEL})
            return {"thinking": {"values": [True, False], "default": True},
                    "template": "not to be saved"}
        with patch.object(p.replay, "local_http", side_effect=fake):
            result = p.local_metadata()
        self.assertEqual(result["ollamaVersion"], "0.12.9")
        self.assertEqual(result["thinking"]["values"], [True, False])
        self.assertNotIn("template", result)

    def test_empty_content_logs_stop_reason_but_not_thought_text(self):
        def fake(path, body=None, **kwargs):
            self.assertEqual(path, "/api/chat")
            return {"model": p.MODEL, "done": True, "done_reason": "stop",
                    "message": {"content": "", "thinking": "private text"},
                    "eval_count": 39}
        with patch.object(p.replay, "local_http", side_effect=fake):
            row = p.run_case(p.cases()[0], None)
        self.assertEqual(row["status"], "EMPTY_CONTENT")
        self.assertEqual(row["metrics"]["doneReason"], "stop")
        self.assertEqual(row["metrics"]["thinkingCharacters"], 12)
        self.assertNotIn("private text", json.dumps(row))

    def test_provider_error_is_recorded_without_retry(self):
        calls = []
        def failure(path, body=None, **kwargs):
            calls.append(path)
            raise RuntimeError("local Ollama HTTP 400")
        with patch.object(p.replay, "local_http", side_effect=failure):
            row = p.run_case(p.cases()[0], None)
        self.assertEqual(calls, ["/api/chat"])
        self.assertEqual(row["status"], "LOCAL_ERROR")


    def test_complete_empty_output_is_valid_diagnostic_not_game_readiness(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = argparse.Namespace(source=Path(tmp)/"source",
                                      output=Path(tmp)/"out", head="a"*40)
            def response(case, image, **kwargs):
                prompt = p.TINY_PROMPT if case["schema"] == "tiny" else p.FULL_PROMPT
                return {"id": case["id"], "condition": dict(case),
                        "request": {"promptSHA256": p.sha256(prompt.encode()),
                                    "sourceImageSHA256":
                                    p.sha256(image) if image else None},
                        "status": "EMPTY_CONTENT", "rawContent": "",
                        "metrics": {"wallNs": 1_000_000}}
            with patch.object(p.replay, "check_checkout"), \
                 patch.object(p, "local_metadata", return_value={
                     "ollamaVersion": "0.12.9", "thinking": None}), \
                 patch.object(p, "run_case", side_effect=response):
                report = p.execute(args, source_loader=lambda _: fake_source(),
                                   inventory=identity)
            self.assertEqual(report["status"], "COMPLETE")
            self.assertEqual(report["summary"]["providerCompleted"], 14)
            self.assertEqual(report["summary"]["emptyContent"], 14)
            self.assertEqual(len(report["pairs"]), 6)
            self.assertTrue(all(x["samePrompt"] for x in report["pairs"]))
            self.assertTrue(report["summary"]["isDiagnosticNotGameReadiness"])
            contents = (args.output/"PROBE.json").read_bytes()
            checksum = (args.output/"SHA256SUMS").read_text()
            self.assertEqual(checksum, p.sha256(contents) + "  PROBE.json\n")

    def test_all_14_provider_failures_are_incomplete_with_sealed_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = argparse.Namespace(source=Path(tmp)/"source",
                                      output=Path(tmp)/"out", head="a"*40)
            def failure(case, image, **kwargs):
                prompt = p.TINY_PROMPT if case["schema"] == "tiny" else p.FULL_PROMPT
                return {"id": case["id"], "condition": dict(case),
                        "request": {"promptSHA256": p.sha256(prompt.encode())},
                        "status": "LOCAL_ERROR", "errorClass": "RuntimeError",
                        "errorMessage": "Ollama unavailable"}
            with patch.object(p.replay, "check_checkout"), \
                 patch.object(p, "local_metadata", return_value={
                     "ollamaVersion": "0.12.9", "thinking": None}), \
                 patch.object(p, "run_case", side_effect=failure):
                report = p.execute(args, source_loader=lambda _: fake_source(),
                                   inventory=identity)
            self.assertEqual(report["status"], "INCOMPLETE")
            self.assertEqual(report["summary"]["providerCompleted"], 0)
            self.assertEqual(report["summary"]["localErrors"], 14)
            self.assertTrue((args.output/"PROBE.json").exists())
            self.assertTrue((args.output/"SHA256SUMS").exists())
        with patch.object(p, "execute", return_value=report), \
             patch("sys.argv", ["qwen2b_probe.py", "--source", "/s",
                                "--output", "/o", "--head", "a"*40]):
            with self.assertRaises(SystemExit) as result:
                p.main()
            self.assertEqual(result.exception.code, 1)

    def test_corrupt_source_image_aborts_before_model_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = argparse.Namespace(source=Path(tmp)/"source",
                                      output=Path(tmp)/"out", head="a"*40)
            data = fake_source()
            data["source"]["turns"][p.IMAGE_ROUND]["observations"][0]["imageSHA256"] = "0"*64
            with patch.object(p.replay, "check_checkout"):
                with self.assertRaisesRegex(ValueError, "identity changed"):
                    p.execute(args, source_loader=lambda _: data,
                              inventory=identity)
            self.assertFalse(args.output.exists())

    def test_postflight_digest_drift_aborts_completed_probe_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = argparse.Namespace(source=Path(tmp)/"source",
                                      output=Path(tmp)/"out", head="a"*40)
            calls = []
            def inventory(**kwargs):
                calls.append(1)
                row = identity()
                if len(calls) == 2:
                    row["sha256"] = "f"*64
                return row
            def response(case, image, **kwargs):
                prompt = p.TINY_PROMPT if case["schema"] == "tiny" else p.FULL_PROMPT
                return {"id": case["id"], "condition": dict(case),
                        "request": {"promptSHA256": p.sha256(prompt.encode())},
                        "status": "VALID_EXACT", "metrics": {"wallNs": 1}}
            with patch.object(p.replay,"check_checkout"), \
                 patch.object(p,"local_metadata",return_value={
                     "ollamaVersion":"0.12.9","thinking":None}), \
                 patch.object(p,"run_case",side_effect=response):
                report = p.execute(args, source_loader=lambda _: fake_source(),
                                   inventory=inventory)
            self.assertEqual(len(calls), 2)
            self.assertEqual(report["summary"]["providerCompleted"], 14)
            self.assertEqual(report["status"], "INCOMPLETE")
            self.assertEqual(report["modelDrift"]["before"]["sha256"], p.MODEL_DIGEST)
            self.assertEqual(report["modelDrift"]["after"]["sha256"], "f"*64)
            self.assertEqual(json.loads((args.output/"PROBE.json").read_text())["status"],
                             "INCOMPLETE")

    def test_postflight_exception_never_seals_complete_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = argparse.Namespace(source=Path(tmp)/"source",
                                      output=Path(tmp)/"out", head="a"*40)
            calls = []
            def inventory(**kwargs):
                calls.append(1)
                if len(calls) == 2:
                    raise RuntimeError("Ollama unreachable after inference")
                return identity()
            def response(case, image, **kwargs):
                prompt = p.TINY_PROMPT if case["schema"] == "tiny" else p.FULL_PROMPT
                return {"id": case["id"], "condition": dict(case),
                        "request": {"promptSHA256": p.sha256(prompt.encode())},
                        "status": "VALID_EXACT", "metrics": {"wallNs": 1}}
            with patch.object(p.replay,"check_checkout"), \
                 patch.object(p,"local_metadata",return_value={
                     "ollamaVersion":"0.12.9","thinking":None}), \
                 patch.object(p,"run_case",side_effect=response):
                with self.assertRaisesRegex(RuntimeError, "Ollama unreachable"):
                    p.execute(args, source_loader=lambda _: fake_source(),
                              inventory=inventory)
            self.assertEqual(len(calls), 2)
            saved = json.loads((args.output/"PROBE.json").read_text())
            self.assertEqual(saved["status"], "INCOMPLETE")
            self.assertEqual(saved["fatalError"]["class"], "RuntimeError")
            self.assertEqual(saved["summary"]["providerCompleted"], 14)
            raw = (args.output/"PROBE.json").read_bytes()
            self.assertEqual((args.output/"SHA256SUMS").read_text(),
                             p.sha256(raw)+"  PROBE.json\n")

    def test_existing_live_gate_remains_untouched(self):
        existing = (ROOT/".github/workflows/freedm-open-vision.yml").read_text()
        self.assertIn("not r.get('liveReadiness',{}).get('eligible')", existing)
        self.assertIn("LIVE REFUSED:", existing)
        workflow = (ROOT/".github/workflows/freedm-qwen2b-probe.yml").read_text()
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("github.actor == 'EmergentMonk'", workflow)
        self.assertNotIn("OPENAI_API_KEY", workflow)
        self.assertNotIn("ollama pull", workflow)
        self.assertNotIn("experiments/freedm-open/live.py", workflow)


if __name__ == "__main__":
    unittest.main()
