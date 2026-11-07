"""Offline regression checks for evidence verification mode boundaries."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/verify-rtx003-comment001.py"
MANIFEST = ROOT / "evidence/COMMENT-001/EVIDENCE_MANIFEST.json"


class EvidenceBoundaryTests(unittest.TestCase):
    def invoke(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *args],
                              cwd=ROOT, capture_output=True, text=True,
                              check=False)

    def test_metadata_only_is_explicitly_not_binary_verification(self):
        result = self.invoke("--manifest-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("RAW ARTIFACTS NOT VERIFIED", result.stdout)

    def test_missing_all_binary_sources_is_rejected(self):
        result = self.invoke("--require-binaries")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("required", result.stderr)

    def test_metadata_has_three_distinct_content_addresses(self):
        m = json.loads(MANIFEST.read_text())
        items = m["rawEvidence"]
        self.assertEqual(set(items), {"rtx003", "screenshot", "excerpt"})
        self.assertEqual(len({x["sha256"] for x in items.values()}), 3)
        self.assertEqual(m["githubActions"]["sourceSha"],
                         "3f5518a168652a003e8db9aa6dc0371ddb4782ea")
        self.assertEqual(m["relatedDataset"]["doi"], "10.5281/zenodo.24026140")


if __name__ == "__main__":
    unittest.main()
