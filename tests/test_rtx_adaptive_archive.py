"""Adversarial receipt tests: never rewrite the frozen GPU evidence."""
import importlib.util
import hashlib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/verify-rtx-adaptive-receipt.py"
spec = importlib.util.spec_from_file_location("rtx002_archive_verifier", SCRIPT)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class RTX002IntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = (verifier.DIRECTORY / verifier.FILENAME).read_bytes()
        cls.manifest = (verifier.DIRECTORY / "SHA256SUMS").read_bytes()

    def test_unmodified_archive_passes(self):
        verifier.verify()

    def test_archive_byte_flip_is_rejected(self):
        damaged = bytearray(self.raw)
        damaged[len(damaged) // 3] ^= 0x01
        with self.assertRaisesRegex(ValueError, "outer ZIP SHA-256"):
            verifier.verify(archive_bytes=bytes(damaged))

    def test_truncated_archive_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "byte size"):
            verifier.verify(archive_bytes=self.raw[:-1])

    def test_crlf_manifest_drift_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "outer SHA256SUMS"):
            verifier.verify(outer_manifest=self.manifest.replace(b"\n", b"\r\n"))

    def test_extra_manifest_line_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "outer SHA256SUMS"):
            verifier.verify(outer_manifest=self.manifest + b"\n")

    def test_incorrect_outer_digest_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "outer ZIP SHA-256"):
            verifier.verify(expected_digest="0" * 64)

    def test_exact_sha_and_content_size(self):
        self.assertEqual(len(self.raw), 17130)
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), verifier.DIGEST)


if __name__ == "__main__":
    unittest.main()
