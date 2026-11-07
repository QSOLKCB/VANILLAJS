"""Offline adversarial FreeDM/Terra tests: no engine, no credentials, no API calls."""
import json
from pathlib import Path
import sys
import unittest
import zlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "experiments/freedm-terra"))
import core
import run as arena


class FakeFrame:
    shape = (240, 320, 3)

    def __init__(self):
        self.raw = bytes(range(256)) * 900

    def tobytes(self, order):
        assert order == "C"
        return self.raw


class FakeHTTP:
    def __init__(self, result):
        self.raw = json.dumps(result).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, n):
        return self.raw[:n]


class Contracts(unittest.TestCase):
    def test_four_independent_roles_and_expected_model(self):
        self.assertEqual(len(core.ROLES), 4)
        self.assertEqual(len(set(role for role, _ in core.ROLES)), 4)
        self.assertEqual(core.MODEL, "gpt-6.1-terra")
        self.assertEqual(core.PLAYERS, 4)

    def test_actions_use_exact_public_keyset_and_no_hidden_engine_commands(self):
        raw = '{"move":"forward","turn":"left","fire":true,"use":false,"sprint":true,"tactic":"Seek cover"}'
        action = core.parse_action(raw)
        self.assertEqual(core.buttons(action), [1, 0, 0, 0, 1, 0, 1, 0, 1])
        self.assertEqual(core.buttons(core.neutral_action()), [0] * 9)
        for text in (
            '{"move":"teleport","turn":"none","fire":true,"use":false,"sprint":false,"tactic":""}',
            '{"move":"forward","turn":"none","fire":1,"use":false,"sprint":false,"tactic":""}',
            '{"move":"forward","turn":"none","fire":true,"use":false,"sprint":false,"tactic":"","shell":"exit"}',
            '{"move":"forward","turn":"none","fire":true,"use":false,"sprint":false}',
            '{"move":"right","turn":"left","fire":true,"use":false,"sprint":true,"tactic":"' + "x" * 200 + '"}'
        ):
            with self.subTest(text=text[:35]), self.assertRaises((ValueError, json.JSONDecodeError)):
                core.parse_action(text)

    def test_reservation_slots_per_role_restrict_total_to_20_dollars(self):
        ledger = core.Budget()
        for role, _ in core.ROLES:
            for turn in range(core.MAX_DECISIONS):
                self.assertEqual(ledger.reserve(role), turn + 1)
                ledger.record_usage(role, 850, 180)
            with self.assertRaisesRegex(ValueError, "budget exhausted"):
                ledger.reserve(role)
        report = ledger.report()
        self.assertEqual(report["totalAuthorizedUSD"], 20)
        self.assertEqual(sum(r["reservedUSD"] for r in report["roles"].values()), 19.2)
        self.assertTrue(all(v["attempts"] == 12 for v in report["roles"].values()))

    def test_usage_does_not_bypass_billing_reservation_after_invalid_reply(self):
        ledger = core.Budget()
        ledger.reserve("TERRA-ALPHA")
        with self.assertRaisesRegex(ValueError, "exceeds pre-authorized"):
            ledger.record_usage("TERRA-ALPHA", 1_000_000, 0)
        self.assertEqual(ledger.report()["roles"]["TERRA-ALPHA"]["attempts"], 1)
        with self.assertRaises(ValueError):
            ledger.record_usage("TERRA-BRAVO", -1, 0)
        with self.assertRaises(ValueError):
            ledger.record_usage("TERRA-BRAVO", 1, 9999)

    def test_png_is_lossless_320x240_rgb_without_pillow(self):
        original = FakeFrame()
        png = core.png_rgb24(original)
        self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
        self.assertLess(len(png), 512_000)
        chunks = []
        pos = 8
        while pos < len(png):
            count = int.from_bytes(png[pos:pos + 4], "big")
            typ = png[pos + 4:pos + 8]
            payload = png[pos + 8:pos + 8 + count]
            crc = int.from_bytes(png[pos + 8 + count:pos + 12 + count], "big")
            self.assertEqual(zlib.crc32(typ + payload) & 0xffffffff, crc)
            chunks.append((typ, payload))
            pos += 12 + count
        self.assertEqual([x[0] for x in chunks], [b"IHDR", b"IDAT", b"IEND"])
        rows = zlib.decompress(chunks[1][1])
        self.assertEqual(len(rows), 240 * (1 + 960))
        self.assertEqual(b"".join(rows[i + 1:i + 961]
                                  for i in range(0, len(rows), 961)), original.raw)

    def test_vision_request_limits_and_no_hidden_state_or_tools(self):
        image = core.png_rgb24(FakeFrame())
        role, tactic = core.ROLES[0]
        payload = core.agent_request_payload(
            role, tactic, image, {"HEALTH": 100, "AMMO2": 40}, None)
        self.assertEqual(payload["model"], "gpt-6.1-terra")
        self.assertIs(payload["store"], False)
        self.assertNotIn("tools", payload)
        self.assertEqual(payload["input"][0]["content"][1]["detail"], "low")
        self.assertIn("data:image/png;base64,", payload["input"][0]["content"][1]["image_url"])
        with self.assertRaises(ValueError):
            core.agent_request_payload(role, tactic, b"not PNG", {}, None)
        with self.assertRaises(ValueError):
            core.agent_request_payload("unknown", tactic, image, {}, None)

    def test_mock_responses_single_request_and_token_receipt(self):
        action = '{"move":"stop","turn":"none","fire":false,"use":false,"sprint":false,"tactic":"test"}'
        result = {
            "model": "gpt-6.1-terra",
            "status": "completed",
            "id": "resp_test_123",
            "output": [{"type": "message", "content": [
                {"type": "output_text", "text": action}]}],
            "usage": {"input_tokens": 1200, "output_tokens": 120},
        }
        called = []

        def opener(req, timeout):
            called.append({"url": req.full_url, "timeout": timeout,
                           "size": len(req.data)})
            self.assertNotIn(b"sk-test-secret", req.data)
            return FakeHTTP(result)
        payload = core.agent_request_payload(core.ROLES[0][0], core.ROLES[0][1],
                                              core.png_rgb24(FakeFrame()), {}, None)
        parsed, receipt = core.call_terra("sk-test-secret", payload, opener=opener)
        self.assertEqual(parsed["move"], "stop")
        self.assertEqual(receipt["outputTokens"], 120)
        self.assertEqual(len(called), 1)

    def test_provider_errors_are_not_retried(self):
        attempts = []

        def fail(req, timeout):
            attempts.append(1)
            raise TimeoutError()
        payload = {"model": core.MODEL, "store": False}
        with self.assertRaisesRegex(RuntimeError, "no retry"):
            core.call_terra("sk-test-secret", payload, opener=fail)
        self.assertEqual(attempts, [1])

    def test_engine_validation_has_no_import_or_download_side_effects(self):
        self.assertFalse("vizdoom" in sys.modules)
        with self.assertRaises(ValueError):
            arena.valid_wad(Path("/nonexistent/freedm.wad"))
        self.assertFalse("vizdoom" in sys.modules)


if __name__ == "__main__":
    unittest.main()
