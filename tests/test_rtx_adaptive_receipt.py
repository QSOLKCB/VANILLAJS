"""Offline integrity regressions for the new owner-run RTX follow-up receipt."""
import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FROZEN = ROOT / "evidence/RTX5060TI-001/vanillajs-rtx5060ti-42203888152.zip"
HEAD = "f" * 40
COUNTS = [14, 26, 58, 128]
PIXEL = "a" * 64


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


class AdaptiveReceiptTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="qsol-rtx-adaptive-test-")
        self.addCleanup(self.temp.cleanup)
        self.out = Path(self.temp.name)
        with zipfile.ZipFile(FROZEN) as archive:
            self.full = json.loads(archive.read("report.json"))
        self.full["candidate"]["sha"] = HEAD
        stats = {
            lane: {"samplesMs": [1] * 7}
            for lane in ("brute", "grid", "adaptive")
        }
        self.serial = {
            "schemaVersion": 1,
            "candidateSHA256": hashlib.sha256(
                (ROOT / "modules/adaptive-circles/index.js").read_bytes()
            ).hexdigest(),
            "records": [{"count": count, "strategies": stats} for count in COUNTS],
        }
        samples = [
            {"image": {"sha256": PIXEL}} for _ in range(7)
        ]
        self.native = {
            "kind": "qsol.vanillajs.rtx5060ti.new-workloads.v1",
            "sourceSha": HEAD, "status": "PASS",
            "native": {"renderer": "NVIDIA GeForce RTX 5060 Ti"},
            "protocol": {"measuredPairs": 7, "gpuFramesPerTrial": 32},
            "circles": [
                {"count": count, "strategies": stats} for count in COUNTS
            ],
            "gpu": {
                "fresh": {"samples": samples, "medianMs": 5},
                "retained": {"samples": samples, "medianMs": 3},
                "pixelParitySha256": PIXEL,
            },
        }
        (self.out / "fullpath").mkdir()
        (self.out / "fullpath/SUMMARY.md").write_text("original workload", encoding="utf-8")
        (self.out / "fullpath/SHA256SUMS").write_text("original sums", encoding="ascii")

    def run_receipt(self):
        save(self.out / "fullpath/report.json", self.full)
        save(self.out / "adaptive-serial.json", self.serial)
        save(self.out / "adaptive-browser.json", self.native)
        return subprocess.run([
            sys.executable, str(ROOT / "scripts/finalize-rtx5060ti-adaptive.py"),
            "--out", str(self.out), "--expected-head", HEAD,
            "--run-id", "123", "--attempt", "1",
        ], cwd=ROOT, capture_output=True, text=True, check=False)

    def test_valid_followup_is_separate_and_manifest_is_exact(self):
        proc = self.run_receipt()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        note = json.loads((self.out / "EXPERIMENT.json").read_text())
        self.assertEqual(note["status"], "PASS")
        self.assertEqual(note["candidate"], HEAD)
        self.assertEqual(note["lineage"]["originalReceipt"], "RTX5060TI-001")
        self.assertIn("no historical", (self.out / "SUMMARY.md").read_text().lower())
        entries = (self.out / "SHA256SUMS").read_text().splitlines()
        self.assertEqual(len(entries), 7)
        for entry in entries:
            digest, name = entry.split("  ")
            self.assertEqual(digest, hashlib.sha256((self.out / name).read_bytes()).hexdigest())
        self.assertEqual(self.run_receipt().returncode, 1, "completed receipt must refuse overwrite")

    def test_incomplete_gpu_trials_refuse_success_receipt(self):
        self.native["gpu"]["retained"]["samples"] = self.native["gpu"]["retained"]["samples"][:6]
        proc = self.run_receipt()
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse((self.out / "SHA256SUMS").exists())
        self.assertFalse((self.out / "EXPERIMENT.json").exists())

    def test_candidate_mismatch_refuses_success_receipt(self):
        self.full["candidate"]["sha"] = "0" * 40
        proc = self.run_receipt()
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse((self.out / "SHA256SUMS").exists())

    def test_invalid_native_pixel_parity_refuses_success_receipt(self):
        self.native["gpu"]["retained"]["samples"][0]["image"]["sha256"] = "b" * 64
        proc = self.run_receipt()
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse((self.out / "SHA256SUMS").exists())

    def test_invalid_serial_source_digest_refuses_success_receipt(self):
        self.serial["candidateSHA256"] = "0" * 64
        proc = self.run_receipt()
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse((self.out / "SHA256SUMS").exists())


if __name__ == "__main__":
    unittest.main()
