"""Offline four-open-model live pilot: all real workers mocked, no GPU or API."""
import argparse
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "experiments" / "freedm-open"))
import live
import replay
sys.path.insert(0, str(ROOT / "experiments" / "freedm-terra"))
import run as terra_engine
from core import neutral_action


def tiny_png():
    return (b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" +
            b"\x00\x00\x01@\x00\x00\x00\xf0" +
            b"\x08\x02\x00\x00\x00" + b"\x00\x00\x00\x00" + b"EOF!")


class Pipe:
    def __init__(self, role):
        self.role = role
        self.last = None
        self.acts = 0

    def send(self, command):
        self.last = command
        if command["op"] == "act":
            self.acts += 1

    def poll(self, _):
        return True

    def recv(self):
        if self.last["op"] == "observe":
            data = tiny_png()
            return {"kind": "observation", "role": self.role,
                    "image": data, "imageSHA256": replay.sha256(data),
                    "ended": False,
                    "variables": {"PLAYER_COUNT": 4, "HEALTH": 100,
                                  "FRAGCOUNT": 0, "DEATHCOUNT": 0, "AMMO2": 50}}
        assert self.last["op"] == "act"
        return {"kind": "acted", "role": self.role,
                "frags": 0, "deaths": 0, "ended": False}


class LiveContracts(unittest.TestCase):
    def setUp(self):
        self.pipes = [Pipe(name) for name, _ in live.ROLES]
        self.infos = [{"kind": "ready", "role": name,
                       "playerCount": 4, "playerNumber": i}
                      for i, (name, _) in enumerate(live.ROLES)]
        self.inventory = {tag: {"sha256": "a" * 64,
                           "installedBytes": 3000000000}
                          for tag in replay.MODEL_TAGS}

    def run_mock(self, out, action_func, *, rounds=1):
        args = argparse.Namespace(
            head="b" * 40, wad=Path("/game/freedm.wad"), output=out,
            port=25040, decisions=rounds)
        with patch.object(live, "check_checkout"), \
             patch.object(terra_engine, "valid_wad", return_value={
                "name": "freedm.wad",
                "sha256": replay.TERRA_WAD_SHA256,
                "byteLength": 22218796}), \
             patch.object(live, "installed_models", return_value=self.inventory), \
             patch.object(terra_engine, "spawn_players", return_value=(
                 [(pipe, object()) for pipe in self.pipes], self.infos)), \
             patch.object(terra_engine, "stop_players", return_value=[]), \
             patch.object(live, "vision_action", side_effect=action_func), \
             patch.object(live, "no_model_reload", return_value=True):
            return live.play(args)

    def test_four_named_open_players_and_bounded_real_game_controls(self):
        self.assertEqual(len(live.ROLES), 4)
        self.assertEqual(len(set(name for name, _ in live.ROLES)), 4)
        self.assertEqual(tuple(tag for _, tag in live.ROLES), replay.MODEL_TAGS)
        p = live.live_prompt(live.ROLES[0][0], {
            "variables": {"PLAYER_COUNT": 4, "HEALTH": 100}}, neutral_action())
        self.assertIn("first-person", p)
        self.assertIn("previous action", p.lower())
        self.assertNotIn("object coordinates", p)

    def test_exact_framing_and_rotating_priority_in_two_applied_rounds(self):
        called = []
        def fake(tag, prompt, screenshot):
            called.append(tag)
            self.assertIn("actual first-person", prompt)
            return {"status": "VALID", "action": neutral_action(),
                    "meta": {"wallNs": 5000000, "eval_count": 20}}
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / "live"
            r = self.run_mock(out, fake, rounds=2)
            self.assertEqual(r["status"], "PASS")
            self.assertEqual(len(r["turns"]), 2)
            self.assertEqual(called, [*replay.MODEL_TAGS,
                replay.MODEL_TAGS[1], replay.MODEL_TAGS[2],
                replay.MODEL_TAGS[3], replay.MODEL_TAGS[0]])
            self.assertEqual(r["turns"][0]["phase"], "ENGINE_APPLIED")
            self.assertEqual(r["turns"][1]["phase"], "ENGINE_APPLIED")
            self.assertTrue(all(p.acts == 2 for p in self.pipes))
            self.assertEqual(len(list((out / "frames").rglob("*.png"))), 8)
            self.assertEqual(len((out / "SHA256SUMS").read_text().splitlines()), 9)
            self.assertEqual(json.loads((out / "MATCH.json").read_text())["status"], "PASS")

    def test_one_failed_local_model_does_not_apply_partial_actions(self):
        called = []
        def fake(tag, prompt, screenshot):
            called.append(tag)
            if tag == replay.MODEL_TAGS[2]:
                raise RuntimeError("local inference failure")
            return {"status": "VALID", "action": neutral_action(),
                    "meta": {"wallNs": 2000000}}
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / "aborted"
            with self.assertRaisesRegex(RuntimeError, "local inference failure"):
                self.run_mock(out, fake)
            self.assertEqual(len(called), 3)
            self.assertEqual([p.acts for p in self.pipes], [0, 0, 0, 0])
            receipt = json.loads((out / "MATCH.json").read_text())
            self.assertEqual(receipt["status"], "ABORTED")
            self.assertEqual(len(receipt["turns"]), 1)
            turn = receipt["turns"][0]
            self.assertEqual(turn["phase"], "LOCAL_INFERENCE_ABORTED_UNAPPLIED")
            self.assertEqual(len(turn["observations"]), 4)
            self.assertEqual(len(turn["actions"]), 3)
            self.assertTrue(all(row["status"] == "READY_NOT_APPLIED"
                                for row in turn["actions"][:2]))
            self.assertEqual(turn["actions"][2]["error"]["class"], "RuntimeError")
            self.assertEqual(len(list((out / "frames").rglob("*.png"))), 4)

    def test_wrong_iwad_hash_rejected_before_any_game_worker(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / "bad"
            args = argparse.Namespace(
                head="b" * 40, wad=Path("/game/freedm.wad"), output=out,
                port=25040, decisions=1)
            with patch.object(live, "check_checkout"), \
                 patch.object(terra_engine, "valid_wad", return_value={
                     "sha256": "0" * 64}):
                with self.assertRaisesRegex(ValueError, "same exact FreeDM IWAD"):
                    live.play(args)
            self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
