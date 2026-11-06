#!/usr/bin/env python3
"""Read-only verification of the original RTX5060TI-001 ZIP (no hardware rerun)."""
import hashlib
import json
import math
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT_DIR = ROOT / "evidence" / "RTX5060TI-001"
ZIP = RECEIPT_DIR / "vanillajs-rtx5060ti-42203888152.zip"
DIGEST = "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8"
BASELINE = "1f965f4e5b6669de0f954e3a39b11aa679e56720"
CANDIDATE = "240617e8bc1a935f05eaf75a10531f194f72a173"
MEMBERS = {"report.json", "SUMMARY.md", "SHA256SUMS"}
HASH_RE = re.compile(r"[0-9a-f]{64}\Z")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify():
    raw = ZIP.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == DIGEST, "outer ZIP SHA-256 mismatch")
    outer = (RECEIPT_DIR / "SHA256SUMS").read_text(encoding="ascii")
    require(outer == f"{DIGEST}  {ZIP.name}\n", "outer SHA256SUMS changed")
    with zipfile.ZipFile(ZIP) as archive:
        infos = archive.infolist()
        require(len(infos) == 3 and {info.filename for info in infos} == MEMBERS,
                "ZIP members must be exactly the original three files, without duplicates")
        require(all(not info.is_dir() and info.file_size < 2_000_000 for info in infos),
                "unexpected ZIP member type or size")
        require(archive.testzip() is None, "ZIP CRC failed")
        receipt = archive.read("SHA256SUMS").decode("ascii")
        entries = receipt.splitlines()
        require(len(entries) == 2, "expected precisely two internal checksum entries")
        parsed = {}
        for entry in entries:
            require(re.fullmatch(r"[0-9a-f]{64}  (?:report\.json|SUMMARY\.md)", entry) is not None,
                    "malformed internal checksum entry")
            digest, name = entry.split("  ")
            require(name not in parsed, "duplicate checksum name")
            parsed[name] = digest
        require(set(parsed) == MEMBERS - {"SHA256SUMS"}, "internal checksum member mismatch")
        for name, digest in parsed.items():
            require(hashlib.sha256(archive.read(name)).hexdigest() == digest,
                    f"internal {name} SHA-256 mismatch")
        report = json.loads(archive.read("report.json"))
        summary = archive.read("SUMMARY.md").decode("utf-8")
    require(report.get("schemaVersion") == 1 and
            report.get("kind") == "qsol.vanillajs.rtx5060ti.trusted-comparison.v1",
            "unexpected report schema")
    require(report["baseline"]["sha"] == BASELINE and report["candidate"]["sha"] == CANDIDATE,
            "source pins differ from the frozen receipt")
    require(BASELINE in summary and CANDIDATE in summary, "summary commit pins differ")
    env = report["environment"]
    require(env["gpu"]["verifiedModel"] == "NVIDIA GeForce RTX 5060 Ti",
            "unexpected GPU model in reported environment")
    renderer = env["nativeWebGL"]["renderer"]
    require("NVIDIA GeForce RTX 5060 Ti" in renderer and
            not re.search(r"swiftshader|llvmpipe|lavapipe|software", renderer, re.I),
            "reported renderer is not RTX 5060 Ti native WebGL")
    require(env["playwright"] == "1.64.0", "unexpected Playwright version")
    comparison = report["comparison"]
    protocol = comparison["protocol"]
    require((protocol["warmupPairs"], protocol["measuredPairs"],
             protocol["framesPerAppTrial"]) == (2, 7, 240), "unexpected test protocol")
    pixels = comparison["pixelParity"]
    require([p["tick"] for p in pixels] == [0, 73, 149] and
            all(p["brightPixels"] > 10 and HASH_RE.fullmatch(p["sha256"]) for p in pixels),
            "invalid recorded pixel parity")
    kernels = comparison["kernelSamples"]
    frames = comparison["frameSamples"]
    for lane in ("baseline", "candidate"):
        require(len(kernels[lane]) == 7 and len(frames[lane]) == 7,
                f"incorrect number of {lane} sample pairs")
        for trial in frames[lane]:
            sample = trial["raw"]
            require(len(sample["callbackMs"]) == 240 and len(sample["deltaMs"]) == 239,
                    f"incomplete {lane} frame trial")
            require(all(math.isfinite(x) for x in sample["callbackMs"] + sample["deltaMs"]),
                    "non-finite raw frame measurement")
        for metric in comparison["summary"][lane].values():
            require(metric["count"] == 7, "summary does not contain seven measured pairs")
    for i, (base, candidate) in enumerate(zip(kernels["baseline"], kernels["candidate"])):
        for field in ("geometrySha256", "collisionSha256", "geometryBytes", "hitCount", "sink"):
            require(base[field] == candidate[field], f"kernel parity mismatch: pair {i}, {field}")
    print(f"PASS RTX5060TI-001: outer SHA256 {DIGEST}")
    print("PASS: 3 ZIP members, 2 internal checksums, 7 paired kernels, 14 complete frame trials")
    print(f"Source: {CANDIDATE}; baseline: {BASELINE}")


if __name__ == "__main__":
    try:
        verify()
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print(f"FAIL RTX5060TI-001: {exc}", file=sys.stderr)
        sys.exit(1)
