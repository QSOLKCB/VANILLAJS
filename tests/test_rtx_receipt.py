"""Adversarial byte-preservation regressions for the pinned RTX receipt."""
import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "evidence" / "RTX5060TI-001"
spec = importlib.util.spec_from_file_location("verify_rtx_receipt", ROOT / "scripts" / "verify-rtx-receipt.py")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class ReceiptIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="rtx-receipt-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.zip = self.root / verifier.ZIP.name
        self.manifest = self.root / "SHA256SUMS"
        shutil.copyfile(verifier.ZIP, self.zip)
        shutil.copyfile(SOURCE / "SHA256SUMS", self.manifest)

    def audit(self):
        with patch.object(verifier, "ZIP", self.zip), patch.object(verifier, "RECEIPT_DIR", self.root):
            verifier.verify()

    def test_unmodified_receipt_passes(self):
        self.audit()

    def test_manifest_crlf_is_rejected_byte_for_byte(self):
        original = self.manifest.read_bytes()
        self.assertNotIn(b"\r", original)
        self.manifest.write_bytes(original.replace(b"\n", b"\r\n"))
        with self.assertRaisesRegex(ValueError, "outer SHA256SUMS changed"):
            self.audit()

    def test_manifest_extra_blank_line_is_rejected(self):
        self.manifest.write_bytes(self.manifest.read_bytes() + b"\n")
        with self.assertRaisesRegex(ValueError, "outer SHA256SUMS changed"):
            self.audit()

    def test_zip_byte_mutation_is_rejected(self):
        raw = bytearray(self.zip.read_bytes())
        raw[100] ^= 1
        self.zip.write_bytes(raw)
        with self.assertRaisesRegex(ValueError, "outer ZIP SHA-256 mismatch"):
            self.audit()


if __name__ == "__main__":
    unittest.main()
