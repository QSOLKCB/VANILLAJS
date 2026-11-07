"""Offline, adversarial tests of RTX005's immutable GPU/CPU evidence."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "rtx005_validator", ROOT / "scripts/verify-rtx005-receipt.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


def rewrite(raw, mutate, *, refresh_manifests=False):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        parts = {name: archive.read(name) for name in archive.namelist()}
    mutate(parts)
    if refresh_manifests:
        parts["fullpath/SHA256SUMS"] = "".join(
            hashlib.sha256(parts["fullpath/" + name]).hexdigest() +
            "  " + name + "\n"
            for name in ("report.json", "SUMMARY.md")
        ).encode("ascii")
        parts["SHA256SUMS"] = "".join(
            hashlib.sha256(parts[name]).hexdigest() + "  " + name + "\n"
            for name in sorted(parts) if name != "SHA256SUMS"
        ).encode("ascii")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, payload in parts.items():
            archive.writestr(name, payload)
    return output.getvalue()


def change_json(parts, name, callback):
    data = json.loads(parts[name])
    callback(data)
    parts[name] = (json.dumps(data, sort_keys=True, separators=(",", ":")) +
                   "\n").encode("utf-8")


class RTX005Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = v.ARCHIVE.read_bytes()

    def test_original_archive_and_all_receipts(self):
        result = v.verify_archive()
        self.assertEqual(result["candidate"], v.CANDIDATE)
        self.assertEqual((result["nativePairs"], result["nativePixelFrames"],
                          result["cpuWorkloads"]), (7, 3, 2))

    def test_future_checkout_drift_does_not_freeze_source_modules(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "modules/time/index.js"
            path.parent.mkdir(parents=True)
            path.write_text("// Future benign edit; receipt remains historical\n")
            with patch.object(v, "ROOT", Path(folder)):
                self.assertEqual(v.verify_zip(self.original)["nativePairs"], 7)

    def test_archive_must_have_original_sha_and_byte_count(self):
        with tempfile.TemporaryDirectory() as folder:
            changed = Path(folder) / "archive.zip"
            changed.write_bytes(self.original + b"archive drift")
            with self.assertRaisesRegex(ValueError, "ZIP length/SHA-256"):
                v.verify_archive(changed)

    def test_symlink_does_not_pass_original_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            link = Path(folder) / "evidence.zip"
            link.symlink_to(v.ARCHIVE)
            with self.assertRaisesRegex(ValueError, "regular file"):
                v.verify_archive(link)

    def test_extra_member_fails_closed(self):
        changed = rewrite(self.original, lambda parts:
                          parts.__setitem__("extra/EXECUTE.sh", b"run"))
        with self.assertRaisesRegex(ValueError, "membership"):
            v.verify_zip(changed)

    def test_manifests_must_bind_original_members(self):
        changed = rewrite(self.original, lambda parts:
                          parts.__setitem__("fullpath/SUMMARY.md", b"altered"))
        with self.assertRaisesRegex(ValueError, "member SHA-256 drift"):
            v.verify_zip(changed)

    def test_forged_historical_source_with_rehashed_manifest_is_refused(self):
        def mutate(parts):
            change_json(parts, "donor-upgrade-workload.json",
                        lambda d: d["sourceSHA256"].__setitem__(
                            "modules/time/index.js", "f" * 64))
        changed = rewrite(self.original, mutate, refresh_manifests=True)
        with self.assertRaisesRegex(ValueError, "historical source identity"):
            v.verify_zip(changed)

    def test_forged_native_renderer_with_rehashed_both_manifests_fails(self):
        def mutate(parts):
            change_json(parts, "fullpath/report.json",
                        lambda d: d["environment"]["nativeWebGL"].__setitem__(
                            "renderer", "SwiftShader software renderer"))
        changed = rewrite(self.original, mutate, refresh_manifests=True)
        with self.assertRaisesRegex(ValueError, "native hardware renderer"):
            v.verify_zip(changed)

    def test_shrunk_pair_protocol_with_rehashed_manifest_fails(self):
        def mutate(parts):
            change_json(parts, "fullpath/report.json",
                        lambda d: d["comparison"]["protocol"].__setitem__(
                            "measuredPairs", 6))
        changed = rewrite(self.original, mutate, refresh_manifests=True)
        with self.assertRaisesRegex(ValueError, "hardware protocol dimensions"):
            v.verify_zip(changed)

    def test_changed_rounded_clock_ticks_with_rehashed_manifest_fails(self):
        def mutate(parts):
            change_json(parts, "donor-upgrade-workload.json",
                        lambda d: d["workloads"][0].__setitem__(
                            "roundedTicks", 3540))
        changed = rewrite(self.original, mutate, refresh_manifests=True)
        with self.assertRaisesRegex(ValueError, "frame-pacing rate"):
            v.verify_zip(changed)

    def test_lying_final_receipt_with_rehashed_manifest_fails(self):
        def mutate(parts):
            change_json(parts, "EXPERIMENT.json",
                        lambda d: d["actions"].__setitem__("attempt", "2"))
        changed = rewrite(self.original, mutate, refresh_manifests=True)
        with self.assertRaisesRegex(ValueError, "final receipt identity"):
            v.verify_zip(changed)


if __name__ == "__main__":
    unittest.main()
