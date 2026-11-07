"""Offline synthetic fail-closed gates for the new RTX numerical receipt."""
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "scripts/finalize-rtx5060ti-numerical.py"
spec = importlib.util.spec_from_file_location("qsol_numerical_finalizer", PATH)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
HEAD = "a" * 40


def sha(data):
    return hashlib.sha256(data).hexdigest()


def save(path, obj):
    path.write_text(json.dumps(obj) + "\n")


class NumericalEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="qsol-rtx-numerical-")
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.baselines = {}
        for label, (base, _, _) in m.OLD.items():
            folder = self.root / ("baseline-" + label)
            folder.mkdir()
            report = {
                "schemaVersion": 1,
                "kind": "qsol.vanillajs.rtx5060ti.trusted-comparison.v1",
                "baseline": {"sha": base}, "candidate": {"sha": HEAD},
                "environment": {
                    "nativeWebGL": {"renderer": "ANGLE NVIDIA GeForce RTX 5060 Ti"},
                    "gpu": {"verifiedModel": "NVIDIA GeForce RTX 5060 Ti"},
                },
                "comparison": {"summary": {
                    "baseline": {"geometry": {"count": 7}},
                    "candidate": {"geometry": {"count": 7}},
                }},
            }
            save(folder / "report.json", report)
            (folder / "SUMMARY.md").write_text("synthetic test only\n")
            sums = "".join(sha((folder / name).read_bytes()) + "  " + name + "\n"
                           for name in ("report.json", "SUMMARY.md"))
            (folder / "SHA256SUMS").write_text(sums)
            self.baselines[label] = (folder, report)
        axis = {
            "name": "axis-range", "sha256": "b" * 64,
            "strategies": {
                key: {"samplesMs": [1.0] * 7, "medianMs": 1.0}
                for key in ("reference", "candidate")
            },
        }
        other = lambda name: {
            "name": name, "samplesMs": [1.0] * 7, "medianMs": 1.0,
        }
        self.numeric = {
            "schemaVersion": 1,
            "kind": "qsol.vanillajs.bloat-nexus-uff.serial-workloads.v1",
            "sourcePins": dict(m.PINS),
            "sourceSHA256": {name: sha((ROOT / name).read_bytes())
                             for name in m.MODULES},
            "protocol": {"warmups": 2, "pairedTrials": 7, "timingGate": False,
                         "gpu": "not measured"},
            "workloads": [
                axis, axis, axis,
                {**other("integer-replay"), "complete": True, "digest": "1" * 8},
                *({**other("nexus-lattice"), "inverseMismatches": 0,
                    "sha256": "2" * 64} for _ in range(3)),
                {**other("kepler-orbit"), "maxRelativeEnergyDrift": 1e-12,
                 "finalPosition": [1.0, 2.0, 3.0]},
            ],
        }

    def run_check(self):
        save(self.root / m.DATA, self.numeric)
        return m.verify(self.root, HEAD, "123", "1")

    def test_valid_receipt_sealed_once_with_byte_exact_manifest(self):
        self.assertIn("Status: PASS", self.run_check())
        entries = (self.root / "SHA256SUMS").read_text().splitlines()
        self.assertEqual(len(entries), len(m.BASELINE_MEMBERS) + 3)
        for line in entries:
            digest, name = line.split("  ")
            self.assertEqual(digest, sha((self.root / name).read_bytes()))
        note = json.loads((self.root / "NUMERICAL-RECEIPT.json").read_text())
        self.assertEqual(note["candidateSha"], HEAD)
        self.assertEqual(set(note["originalArchives"]), set(m.OLD))
        with self.assertRaisesRegex(ValueError, "overwrit"):
            self.run_check()

    def test_partial_or_forged_numerical_evidence_refused_without_receipt(self):
        for mutation in (
            lambda x: x["workloads"][0]["strategies"]["reference"]["samplesMs"].pop(),
            lambda x: x["sourcePins"].__setitem__("nexus", "f" * 40),
            lambda x: x["workloads"][3].__setitem__("complete", False),
            lambda x: x["workloads"][4].__setitem__("inverseMismatches", 1),
            lambda x: x["workloads"][-1].__setitem__("maxRelativeEnergyDrift", 1),
        ):
            with self.subTest(mutation=str(mutation)):
                before = json.loads(json.dumps(self.numeric))
                mutation(self.numeric)
                with self.assertRaises((ValueError, TypeError)):
                    self.run_check()
                self.assertFalse((self.root / "NUMERICAL-RECEIPT.json").exists())
                self.numeric = before

    def test_mismatched_source_is_rejected(self):
        folder, report = self.baselines["002"]
        report["candidate"]["sha"] = "f" * 40
        save(folder / "report.json", report)
        (folder / "SHA256SUMS").write_text("".join(
            sha((folder / name).read_bytes()) + "  " + name + "\n"
            for name in ("report.json", "SUMMARY.md")))
        with self.assertRaisesRegex(ValueError, "source mismatch"):
            self.run_check()
        self.assertFalse((self.root / "SHA256SUMS").exists())

    def test_symlinked_evidence_rejected_even_if_target_matches(self):
        save(self.root / m.DATA, self.numeric)
        external = self.root / "valid.json"
        external.write_bytes((self.root / m.DATA).read_bytes())
        (self.root / m.DATA).unlink()
        (self.root / m.DATA).symlink_to(external)
        with self.assertRaisesRegex(ValueError, "not a regular file"):
            m.verify(self.root, HEAD, "12", "1")


if __name__ == "__main__":
    unittest.main()
