"""Synthetic offline fail-closed checks for the next owner-run RTX receipt."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/finalize-rtx5060ti-frame-gate.py"
HEAD = "f" * 40
SOURCE_001 = "240617e8bc1a935f05eaf75a10531f194f72a173"
SOURCE_002 = "b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f"
PIXEL = "a" * 64


def write_json(path, value):
    path.write_text(json.dumps(value) + "\n")


def sha(data):
    return hashlib.sha256(data).hexdigest()


class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="qsol-arcade-receipt-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folders = []
        for label, baseline in (("001", SOURCE_001), ("002", SOURCE_002)):
            folder = self.root / ("baseline-" + label)
            folder.mkdir()
            report = {
                "schemaVersion": 1,
                "kind": "qsol.vanillajs.rtx5060ti.trusted-comparison.v1",
                "baseline": {"sha": baseline},
                "candidate": {"sha": HEAD},
                "environment": {
                    "nativeWebGL": {"renderer": "ANGLE NVIDIA GeForce RTX 5060 Ti"},
                    "gpu": {"verifiedModel": "NVIDIA GeForce RTX 5060 Ti"},
                },
                "comparison": {"summary": {
                    "baseline": {"a": {"count": 7}},
                    "candidate": {"a": {"count": 7}},
                }},
            }
            write_json(folder / "report.json", report)
            (folder / "SUMMARY.md").write_text("synthetic only\n")
            sums = "".join(sha((folder / name).read_bytes()) + "  " + name + "\n"
                           for name in ("report.json", "SUMMARY.md"))
            (folder / "SHA256SUMS").write_text(sums)
            self.folders.append(folder)
        self.native = {
            "schemaVersion": 1,
            "kind": "qsol.vanillajs.arcade-frame-gate.native.v1",
            "sourceSha": HEAD,
            "status": "PASS",
            "native": {"renderer": "NVIDIA GeForce RTX 5060 Ti"},
            "protocol": {
                "warmupPairs": 2, "measuredPairs": 7,
                "framesPerTrial": 48, "snapshotsPerTrial": 9,
            },
            "paritySha256": sha(json.dumps([PIXEL] * 9,
                 separators=(",", ":")).encode("utf-8")),
            "strategies": {
                "forced": {"medianMs": 15, "samples": [
                    {"ms": 15, "pixels": [PIXEL] * 9,
                     "actualDrawn": 48, "drawCalls": 48} for _ in range(7)]},
                "gated": {"medianMs": 4, "samples": [
                    {"ms": 4, "pixels": [PIXEL] * 9,
                     "actualDrawn": 9, "drawCalls": 9, "skipped": 39}
                    for _ in range(7)]},
            },
        }

    def execute(self):
        write_json(self.root / "frame-gate.json", self.native)
        return subprocess.run([
            sys.executable, str(SCRIPT), "--out", str(self.root),
            "--expected-head", HEAD,
        ], capture_output=True, text=True, cwd=ROOT, check=False)

    def test_valid_receipt_and_one_shot_manifest(self):
        first = self.execute()
        self.assertEqual(first.returncode, 0, first.stderr)
        manifest = (self.root / "SHA256SUMS").read_text().splitlines()
        self.assertEqual(len(manifest), 9)
        for row in manifest:
            digest, name = row.split("  ")
            self.assertEqual(digest, sha((self.root / name).read_bytes()))
        note = json.loads((self.root / "EXPERIMENT.json").read_text())
        self.assertEqual(note["status"], "PASS")
        self.assertEqual(note["candidate"], HEAD)
        self.assertEqual(note["historical"]["RTX5060TI-001"]["sha"], SOURCE_001)
        self.assertEqual(note["historical"]["RTX5060TI-002"]["sha"], SOURCE_002)
        self.assertNotEqual(self.execute().returncode, 0, "must not overwrite")

    def test_reject_wrong_baseline_source_without_success(self):
        report_path = self.folders[0] / "report.json"
        report = json.loads(report_path.read_text())
        report["baseline"]["sha"] = "0" * 40
        write_json(report_path, report)
        (self.folders[0] / "SHA256SUMS").write_text(
            "".join(sha((self.folders[0] / name).read_bytes()) + "  " + name + "\n"
                    for name in ("report.json", "SUMMARY.md")))
        self.assertNotEqual(self.execute().returncode, 0)
        self.assertFalse((self.root / "EXPERIMENT.json").exists())

    def test_reject_incomplete_native_pairs(self):
        self.native["strategies"]["gated"]["samples"].pop()
        self.assertNotEqual(self.execute().returncode, 0)
        self.assertFalse((self.root / "SHA256SUMS").exists())

    def test_reject_pixel_drift(self):
        self.native["strategies"]["gated"]["samples"][2]["pixels"][4] = "b" * 64
        self.assertNotEqual(self.execute().returncode, 0)
        self.assertFalse((self.root / "EXPERIMENT.json").exists())


    def test_reject_false_pixel_digest_even_with_matching_frames(self):
        self.native["paritySha256"] = "b" * 64
        self.assertNotEqual(self.execute().returncode, 0)
        self.assertFalse((self.root / "EXPERIMENT.json").exists())

    def test_reject_forged_median(self):
        self.native["strategies"]["gated"]["medianMs"] = 200
        self.assertNotEqual(self.execute().returncode, 0)
        self.assertFalse((self.root / "EXPERIMENT.json").exists())

    def test_reject_wrong_draw_counts(self):
        self.native["strategies"]["gated"]["samples"][0]["skipped"] = 38
        self.assertNotEqual(self.execute().returncode, 0)
        self.assertFalse((self.root / "EXPERIMENT.json").exists())


if __name__ == "__main__":
    unittest.main()
