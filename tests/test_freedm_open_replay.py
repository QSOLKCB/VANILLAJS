"""Offline Open-VLM paired replay contracts. No Ollama, API, GPU or WAD."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "experiments" / "freedm-open"))
import replay
sys.path.insert(0, str(ROOT / "experiments" / "freedm-terra"))
from core import ROLES, neutral_action


def png():
    # Only the bounded PNG header is examined by vision_action; the actual
    # owner-run path additionally verifies every byte via pinned SHA-256.
    return (b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" +
            b"\x00\x00\x01@\x00\x00\x00\xf0" +
            b"\x08\x02\x00\x00\x00" + b"\x00\x00\x00\x00" + b"EOF!")


class FakeHTTP:
    def __init__(self, data):
        self.data = json.dumps(data).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self, n):
        return self.data[:n]


def fake_dataset():
    screen = png()
    turns = []
    frames = {}
    for turn in range(12):
        row = {"round": turn, "phase": "ENGINE_APPLIED",
               "observations": [], "actions": []}
        for role, _ in ROLES:
            obs = {"role": role, "variables": {"PLAYER_COUNT": 4,
                   "HEALTH": 100, "FRAGCOUNT": 0, "DEATHCOUNT": 0, "AMMO2": 50},
                   "imageSHA256": replay.sha256(screen),
                   "framePath": f"frames/{role.lower()}/{turn:02}.png"}
            row["observations"].append(obs)
            row["actions"].append({"role": role, "action": neutral_action(),
                                   "status": "ENGINE_ACKNOWLEDGED"})
            frames[(role, turn)] = screen
        turns.append(row)
    return {"source": {"turns": turns}, "frames": frames,
            "sums": replay.TERRA_SUMS_SHA256,
            "match": replay.TERRA_MATCH_SHA256}


class ReplayTests(unittest.TestCase):
    def test_approved_four_model_tags_and_exact_baseline_sha(self):
        self.assertEqual(len(replay.MODEL_TAGS), 4)
        self.assertEqual(len(set(replay.MODEL_TAGS)), 4)
        self.assertEqual(replay.TERRA_RUN_ID, "42374695320")
        self.assertEqual(len(replay.TERRA_MATCH_SHA256), 64)

    def test_sampling_preserves_role_and_round_coverage(self):
        self.assertEqual(replay.frame_indices(1), (0,))
        self.assertEqual(replay.frame_indices(3), (0, 5, 11))
        self.assertEqual(replay.frame_indices(12), tuple(range(12)))
        for n in range(1, 13):
            v = replay.frame_indices(n)
            self.assertEqual(len(set(v)), n)
            self.assertEqual(v[0], 0)
        for val in (0, 13, 1.5, True):
            with self.assertRaises(ValueError):
                replay.frame_indices(val)

    def test_same_prompt_replays_exact_previous_terra_action(self):
        d = fake_dataset()
        role = ROLES[0][0]
        s0 = replay.same_prompt(role, 0, d["source"], png())
        s1 = replay.same_prompt(role, 1, d["source"], png())
        self.assertIn("You are " + role, s0)
        self.assertIn("Previous action:", s1)
        self.assertIn("HEALTH", s1)

    def test_local_only_endpoint_allowlist_and_strict_proxy_bypass(self):
        attempts = []

        def opener(req, timeout):
            attempts.append((req.full_url, timeout, req.method))
            return FakeHTTP({"models": []})
        reply = replay.local_http("/api/tags", opener=opener)
        self.assertEqual(reply, {"models": []})
        self.assertEqual(attempts, [("http://127.0.0.1:11434/api/tags", 90, "GET")])
        for p in ("https://example.org", "/api/pull", "/api/delete",
                  "/api/chat?model=cloud", "/../admin"):
            with self.assertRaises(ValueError):
                replay.local_http(p, opener=opener)
        self.assertEqual(len(attempts), 1)

    def test_all_model_inventory_requires_full_digest_and_local_bytes(self):
        rows = [{"name": x, "digest": "a" * 64,
                 "size": 2000000000, "details": {"family": "vision"}}
                for x in replay.MODEL_TAGS]

        def mock(path, body=None, **kwargs):
            self.assertEqual(path, "/api/tags")
            return {"models": rows}
        with patch.object(replay, "local_http", side_effect=mock):
            model = replay.installed_models()
            self.assertEqual(set(model), set(replay.MODEL_TAGS))
            rows.pop()
            with self.assertRaisesRegex(ValueError, "already be installed"):
                replay.installed_models()
            rows[-1]["digest"] = "not a sha"
            with self.assertRaises(ValueError):
                replay.installed_models()

    def test_vision_request_is_json_bounded_and_uses_exact_png(self):
        calls = []
        def fake(path, body=None, **kwargs):
            self.assertEqual(path, "/api/chat")
            self.assertEqual(body["model"], replay.MODEL_TAGS[0])
            self.assertEqual(body["stream"], False)
            self.assertEqual(body["options"]["temperature"], 0)
            self.assertEqual(body["messages"][0]["images"][0][:8], "iVBORw0K")
            calls.append(body)
            return {"model": replay.MODEL_TAGS[0], "done": True,
                "message": {"content": json.dumps(neutral_action())},
                "prompt_eval_count": 340, "eval_count": 90,
                "total_duration": 440_000_000}
        with patch.object(replay, "local_http", side_effect=fake):
            result = replay.vision_action(replay.MODEL_TAGS[0], "game", png())
            self.assertEqual(result["status"], "VALID")
            self.assertEqual(result["meta"]["eval_count"], 90)
            self.assertEqual(len(calls), 1)
        with self.assertRaises(ValueError):
            replay.vision_action("cloud-only", "game", png())
        with self.assertRaises(ValueError):
            replay.vision_action(replay.MODEL_TAGS[0], "game", b"not PNG")

    def test_invalid_model_actions_are_recorded_not_repaired(self):
        def fake(path, body=None, **kwargs):
            return {"model": replay.MODEL_TAGS[0], "done": True,
                    "message": {"content": '{"fire":true}'}}
        with patch.object(replay, "local_http", side_effect=fake):
            r = replay.vision_action(replay.MODEL_TAGS[0], "game", png())
        self.assertEqual(r["status"], "INVALID_ACTION")
        self.assertNotIn("action", r)

    def test_one_replay_sends_exactly_48_local_inferences_and_is_not_game_score(self):
        dataset = fake_dataset()
        inventory = {x: {"sha256": "a" * 64, "installedBytes": 2000000000}
                     for x in replay.MODEL_TAGS}
        invoked = []
        def simulate(model, prompt, screenshot, **kwargs):
            invoked.append(model)
            return {"status": "VALID", "action": neutral_action(),
                    "meta": {"wallNs": 1000000, "done": True}}
        with tempfile.TemporaryDirectory() as temp:
            args = argparse.Namespace(
                head="b" * 40, source=Path(temp)/"source",
                output=Path(temp)/"output", frames_per_role=3)
            with patch.object(replay, "check_checkout"), \
                 patch.object(replay, "load_terra_archive", return_value=dataset), \
                 patch.object(replay, "installed_models", return_value=inventory), \
                 patch.object(replay, "vision_action", side_effect=simulate), \
                 patch.object(replay, "no_model_reload", return_value=True):
                r = replay.evaluate(args)
            self.assertEqual(r["status"], "PASS")
            self.assertEqual(len(invoked), 48)
            self.assertEqual(len(r["samples"]), 48)
            self.assertEqual(sum(x["sameActionAsTerra"] for x in r["summary"].values()), 48)
            self.assertIn("not a live", r["comparison"])
            self.assertTrue((args.output/"REPLAY.json").is_file())
            sums = (args.output/"SHA256SUMS").read_text().splitlines()
            self.assertEqual(len(sums), 1)
            expected, name = sums[0].split("  ")
            self.assertEqual(name, "REPLAY.json")
            self.assertEqual(expected, replay.sha256((args.output/name).read_bytes()))


if __name__ == "__main__":
    unittest.main()
