"""Protect the optional base64 Git blob uploader's exact identity boundaries."""
import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/upload-comment001-blobs.py"
spec = importlib.util.spec_from_file_location("comment001_binary_uploader", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BinaryUploaderTests(unittest.TestCase):
    def test_declared_blob_identity_is_pinned(self):
        self.assertEqual(module.git_blob(b"test content"),
                         "08cf6101416f0ce0dda3c80e627f333854c4085c")
        self.assertEqual(set(module.EXPECTED), {
            "evidence/COMMENT-001/2026-11-07_original-screenshot.png",
            "evidence/COMMENT-001/2026-11-07_x-post_excerpt.png",
        })
        self.assertEqual(module.BRANCH, "evidence/comment001-commit-exact-pngs")

    def test_empty_or_forged_source_refuses_before_any_git_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = pathlib.Path(tmp) / "capture.zip"
            source.write_bytes(b"not a ZIP")
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                module.prepare(source)
            with zipfile.ZipFile(source, "w") as archive:
                archive.writestr("evidence/COMMENT-001/2026-11-07_original-screenshot.png",
                                 b"not the real screenshot")
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                module.prepare(source)

    def test_dry_run_never_needs_auth_for_invalid_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = pathlib.Path(tmp) / "invalid.zip"
            source.write_bytes(b"forged")
            result = subprocess.run([sys.executable, str(SCRIPT),
                                     str(source), "--dry-run"],
                                    capture_output=True, text=True,
                                    cwd=ROOT, timeout=15, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("transfer ZIP SHA-256 mismatch", result.stderr)


if __name__ == "__main__":
    unittest.main()
