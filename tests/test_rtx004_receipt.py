"""Adversarial, offline RTX004 archive checks. No GPU execution."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("rtx004_validator",
    ROOT / "scripts/verify-rtx004-receipt.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


class RTX004ReceiptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = v.ARCHIVE.read_bytes()

    @staticmethod
    def rewrite(raw, mutator):
        with zipfile.ZipFile(io.BytesIO(raw)) as inp:
            entries = {name: inp.read(name) for name in inp.namelist()}
        mutator(entries)
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for name, contents in entries.items():
                z.writestr(name, contents)
        return out.getvalue()

    def test_frozen_archive_and_source_replayed(self):
        self.assertEqual(v.verify_zip(self.raw, check_sources=False)["scenarios"], 8)

    def test_wrong_outer_bytes_fail_even_with_compatible_zip(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / "artifact.zip"
            p.write_bytes(self.raw + b"trailing")
            with self.assertRaisesRegex(ValueError, "SHA-256/size"):
                v.verify_archive(p)

    def test_unknown_extra_member_fails_closed(self):
        modified = self.rewrite(self.raw, lambda x: x.__setitem__("bonus.sh", b"exec"))
        with self.assertRaisesRegex(ValueError, "membership"):
            v.verify_zip(modified, check_sources=False)

    def test_mutated_member_rejected_by_original_manifest(self):
        modified = self.rewrite(self.raw, lambda x: x.__setitem__(
            "baseline-002/SUMMARY.md", b"tampered"))
        with self.assertRaisesRegex(ValueError, "checksum drift"):
            v.verify_zip(modified, check_sources=False)

    def test_synthetic_missing_archive_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(OSError):
                v.verify_archive(Path(folder) / "missing.zip")


if __name__ == "__main__":
    unittest.main()
