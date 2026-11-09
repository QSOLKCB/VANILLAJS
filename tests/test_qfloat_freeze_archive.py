# SPDX-License-Identifier: Apache-2.0
"""Synthetic five-member ZIP regression gates for QFLOAT-001.

The real original archive remains immutable and external to the source tree.
This suite verifies that the four-file checksum manifest travels as a
fifth ZIP member, that the exact manifest bytes are authenticated, and
that extra, missing, duplicate and corrupted members fail closed.
"""
from contextlib import ExitStack
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
# The production CLI intentionally has a hyphenated filename. Import it by
# its exact on-disk path rather than incorrectly treating it as a Python
# identifier with underscores.
spec = importlib.util.spec_from_file_location(
    "qfloat_freeze_verifier", ROOT / "scripts" / "verify-qfloat-freeze.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("unable to load canonical QFloat verifier")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def digest(data):
    return hashlib.sha256(data).hexdigest()


class OriginalZipInventoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = ROOT / "evidence" / "QFLOAT-001"
        self.parts = {
            "QFLOAT_ARCADE_REPORT.json": (source / "QFLOAT_ARCADE_REPORT.json").read_bytes(),
            "SUMMARY.md": (source / "SUMMARY.md").read_bytes(),
            # Deliberately synthetic: no claim these are original screenshots.
            "qfloat-desktop.png": b"synthetic-desktop-PNG-witness",
            "qfloat-mobile.png": b"synthetic-mobile-PNG-witness",
        }
        self.expected = {name: digest(data) for name, data in self.parts.items()}
        self.manifest = "".join(
            f"{checksum}  {name}\n" for name, checksum in self.expected.items()
        ).encode("ascii")
        self.freeze = self.root / "freeze"
        self.freeze.mkdir()
        for name in ("QFLOAT_ARCADE_REPORT.json", "SUMMARY.md"):
            (self.freeze / name).write_bytes(self.parts[name])
        (self.freeze / "SHA256SUMS").write_bytes(self.manifest)
        self.parts["SHA256SUMS"] = self.manifest

    def check_zip(self, *, missing=(), extra=None, replacements=None, duplicate=None):
        contents = dict(self.parts)
        for name in missing:
            contents.pop(name)
        if extra:
            contents["unknown.txt"] = b"unlisted extra"
        contents.update(replacements or {})
        archive = self.root / "original.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for name, value in contents.items():
                z.writestr(name, value)
            if duplicate:
                z.writestr(duplicate, contents[duplicate])
        expected_zip = {**self.expected, "SHA256SUMS": digest(self.manifest)}
        with ExitStack() as stack:
            stack.enter_context(patch.object(verifier, "FREEZE", self.freeze))
            stack.enter_context(patch.object(verifier, "EXPECTED", self.expected))
            stack.enter_context(patch.object(verifier, "EXPECTED_ZIP", expected_zip))
            stack.enter_context(patch.object(verifier, "ORIGINAL_ZIP_SHA256",
                                            digest(archive.read_bytes())))
            # No original screenshots are embedded in this synthetic test.
            return verifier.verify(archive)

    def test_full_five_file_original_shape_passes(self):
        result = self.check_zip()
        self.assertEqual(result["scope"], "complete-original-artifact")
        self.assertTrue(result["archiveVerified"])
        self.assertTrue(result["manifestMemberVerified"])
        self.assertEqual(result["screenshotsVerified"], 2)

    def test_manifest_not_in_zip_is_not_accepted(self):
        with self.assertRaisesRegex(ValueError, "ZIP file count mismatch"):
            self.check_zip(missing=("SHA256SUMS",))

    def test_extra_file_is_not_accepted(self):
        with self.assertRaisesRegex(ValueError, "ZIP file count mismatch"):
            self.check_zip(extra=True)

    def test_duplicate_filename_is_not_accepted(self):
        # Python may emit a UserWarning for duplicate names; rejection is
        # mandatory even when the set of names still looks correct.
        with self.assertWarns(UserWarning):
            with self.assertRaisesRegex(ValueError, "ZIP file count mismatch"):
                self.check_zip(duplicate="SHA256SUMS")

    def test_changed_manifest_bytes_are_not_accepted(self):
        with self.assertRaisesRegex(ValueError,
                                    "SHA256SUMS original ZIP member SHA-256 mismatch"):
            self.check_zip(replacements={"SHA256SUMS": self.manifest + b"\n"})

    def test_changed_png_bytes_are_not_accepted(self):
        with self.assertRaisesRegex(ValueError,
                                    "qfloat-desktop.png original ZIP member SHA-256 mismatch"):
            self.check_zip(replacements={"qfloat-desktop.png": b"tampered"})

    def test_manifest_bytes_are_identical_to_retained_text_receipt(self):
        # Correct manifest hash is necessary AND equality with the frozen
        # manifest on disk is enforced, not just an archive member count.
        changed = self.manifest + b"\n"
        (self.freeze / "SHA256SUMS").write_bytes(changed)
        with self.assertRaisesRegex(ValueError, "malformed SHA256SUMS line"):
            self.check_zip()


if __name__ == "__main__":
    unittest.main()
