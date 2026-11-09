# SPDX-License-Identifier: Apache-2.0
"""QFLOAT-001 receipt verification. Python stdlib; read-only and offline.

Without --archive verifies only the frozen text receipts in Git.
With --archive verifies all five original ZIP members (including SHA256SUMS) and ZIP hash.
Never claim screenshot bytes are present when only their hashes are known.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FREEZE = ROOT / "evidence" / "QFLOAT-001"
KIND = "qsol.vanillajs.qfloat.arcade-witness.v1"
VANILLA_HEAD = "16f252aaea93b8956d2055e49689372164b2b356"
ARCADE_HEAD = "f29b780734a50171d55ae2f770930db8a487b31c"
ORIGINAL_ZIP_SHA256 = "c0c2e23254147caa4e2a8a6e2a4682a8466868f7285b3df5429df8d250323005"
EXPECTED = {
    "QFLOAT_ARCADE_REPORT.json": "9f0ffeca4d86f7795cdad8cc3d4c02ac6c98cb7dbe788fe822f109f174a18cf0",
    "SUMMARY.md": "fce353cc0bf34148e5b8f438b6eda0c5c1004e80f461ac8606be9d685259b063",
    "qfloat-desktop.png": "b2f3b9f2f28aad643c3a1cb723cfeae387ba089cbcb76177be0cd56444191d40",
    "qfloat-mobile.png": "fdc18ff5dc1fedf7fad3657a3374d0a4b2de93f3b297d64949ad3b3f8e2346fb",
}
# The self-checksum manifest has four entries; the original Actions ZIP has
# those four payloads PLUS the SHA256SUMS manifest itself. Pin its own bytes
# independently rather than rewriting the historical four-file manifest.
MANIFEST_SHA256 = "822b994e0147e776ec94b29caf5530bf4fbd8fb702a3bc7dc9db95ab10d7b6db"
EXPECTED_ZIP = {**EXPECTED, "SHA256SUMS": MANIFEST_SHA256}
ASSETS = [
    "arcade3/qfloat-lab.html",
    "arcade3/qfloat-lab.css",
    "arcade3/qfloat-lab.js",
    "arcade3/qfloat-sim.js",
    "arcade2/qfloat.js",
    "arcade2/engine.js",
]
CHECKS = [
    "decimal illusion and exact 19660 subunits",
    "actual Canvas2D pixels",
    "focus loss while already paused, missing keyup",
    "real keyboard and exact 81920 raw subunit tick",
    "simultaneous keyboard aliases",
    "real 60Hz timer with stable pause",
    "guarded speed rejection and integer reset",
    "invalid decimal input rejection",
    "390px responsive display without overflow",
]


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def manifest_entries():
    raw = (FREEZE / "SHA256SUMS").read_bytes()
    result = {}
    for line in raw.decode("ascii").splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  ([A-Za-z0-9_.-]+)", line)
        check(match is not None, "malformed SHA256SUMS line")
        checksum, name = match.groups()
        check(name not in result, "duplicate SHA256SUMS member: " + name)
        result[name] = checksum
    check(result == EXPECTED, "frozen four-file SHA256SUMS changed")
    return result


def check_report(raw):
    obj = json.loads(raw.decode("utf-8"))
    check(obj.get("kind") == KIND, "wrong witness schema")
    check(obj.get("status") == "PASS", "witness is not PASS")
    check(obj.get("sourceHead") == VANILLA_HEAD, "VANILLAJS executed HEAD mismatch")
    check(obj.get("arcadeCommit") == ARCADE_HEAD, "ARCADE executed source mismatch")
    assets = obj.get("sourceManifest", [])
    check([item.get("path") for item in assets] == ASSETS, "wrong source asset inventory")
    check(all(item.get("sourceCommit") == ARCADE_HEAD
              and isinstance(item.get("bytes"), int) and item["bytes"] > 0
              and re.fullmatch(r"[a-f0-9]{64}", item.get("sha256", ""))
              for item in assets), "invalid pinned source assets")
    tools = obj.get("runnerTools", [])
    check([item.get("path") for item in tools] == [
        "scripts/qfloat-arcade-witness.mjs",
        "scripts/rtx-playwright.mjs",
        ".github/workflows/rtx5060ti-qfloat.yml",
    ], "witness toolchain identity changed")
    check(all(re.fullmatch(r"[a-f0-9]{64}", item.get("sha256", "")) for item in tools),
          "invalid original witness tool hashes")
    host = obj.get("host", {})
    check(host.get("runner") == "ubuntu"
          and host.get("node") == "v22.18.0"
          and host.get("playwright") == "1.64.0", "unexpected original execution host")
    check(obj.get("browser") == "156.0.8078.79", "unexpected browser version")
    obs = obj.get("observation", {})
    check(obs.get("passed") is True and obs.get("checks") == CHECKS
          and obs.get("errors") == [] and obj.get("failures") == [],
          "witness success claims changed")
    check(obs.get("pixel") == [134, 255, 226, 255], "Canvas pixel witness changed")
    check(obs.get("overflow") == -15, "mobile width witness changed")
    return obj


def verify(archive=None):
    manifest = manifest_entries()
    for name in ("QFLOAT_ARCADE_REPORT.json", "SUMMARY.md"):
        contents = (FREEZE / name).read_bytes()
        check(digest(contents) == manifest[name], name + " SHA-256 mismatch")
    report = check_report((FREEZE / "QFLOAT_ARCADE_REPORT.json").read_bytes())
    result = {
        "kind": "qsol.vanillajs.qfloat.freeze.001.v1",
        "result": "PASS",
        "scope": "text-receipts-only",
        "originalRun": 42626854784,
        "sourceHead": report["sourceHead"],
        "arcadeCommit": report["arcadeCommit"],
        "textReceiptsVerified": 2,
        "screenshotsVerified": 0,
        "archiveVerified": False,
        "manifestMemberVerified": False,
    }
    if archive is not None:
        archive = Path(archive)
        check(archive.is_file(), "evidence archive not found")
        check(archive.stat().st_size < 1024 * 1024, "unreasonable original ZIP size")
        data = archive.read_bytes()
        check(digest(data) == ORIGINAL_ZIP_SHA256,
              "original artifact ZIP SHA-256 mismatch")
        with zipfile.ZipFile(archive) as package:
            items = package.infolist()
            check(len(items) == len(EXPECTED_ZIP), "ZIP file count mismatch")
            check({item.filename for item in items} == set(EXPECTED_ZIP),
                  "ZIP contains unknown/missing members")
            check(sum(item.file_size for item in items) <= 512 * 1024,
                  "archive expanded byte limit exceeded")
            for item in items:
                check(item.file_size <= 256 * 1024, "oversized ZIP member")
                check(not stat.S_ISLNK(item.external_attr >> 16), "symlink ZIP member")
                raw = package.read(item)
                check(digest(raw) == EXPECTED_ZIP[item.filename],
                      item.filename + " original ZIP member SHA-256 mismatch")
                if item.filename in ("QFLOAT_ARCADE_REPORT.json", "SUMMARY.md",
                                     "SHA256SUMS"):
                    check(raw == (FREEZE / item.filename).read_bytes(),
                          item.filename + " differs from original archive")
        result.update(scope="complete-original-artifact",
                      screenshotsVerified=2, archiveVerified=True,
                      manifestMemberVerified=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="original GitHub Actions ZIP, optional")
    args = parser.parse_args()
    print(json.dumps(verify(args.archive), sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
