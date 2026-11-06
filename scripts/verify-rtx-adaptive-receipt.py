#!/usr/bin/env python3
"""Read-only, byte-pinned verification of the RTX5060TI-002 hardware receipt."""
import hashlib
import io
import json
import re
import stat
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "evidence" / "RTX5060TI-002"
FILENAME = "vanillajs-rtx5060ti-adaptive-42310094400-1.zip"
DIGEST = "79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef"
SIZE = 17130
CANDIDATE = "b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f"
BASELINE = "1f965f4e5b6669de0f954e3a39b11aa679e56720"
PREVIOUS_CANDIDATE = "240617e8bc1a935f05eaf75a10531f194f72a173"
OLD_DIGEST = "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8"
MEMBERS = {
    "EXPERIMENT.json", "SUMMARY.md", "SHA256SUMS", "adaptive-browser.json",
    "adaptive-serial.json", "fullpath/report.json", "fullpath/SUMMARY.md",
    "fullpath/SHA256SUMS",
}
COUNTS = [14, 26, 58, 128]
LANES = ("brute", "grid", "adaptive")
HEX64 = re.compile(r"[0-9a-f]{64}\Z")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def manifest(blob, expected):
    """Parse exact sha256sum format; do not normalize CRLF or ignored lines."""
    require(blob.endswith(b"\n") and b"\r" not in blob, "checksum manifest newline drift")
    lines = blob.decode("ascii").splitlines()
    require(len(lines) == len(expected), "unexpected number of checksum entries")
    result = {}
    for line in lines:
        require(re.fullmatch(r"[0-9a-f]{64}  [A-Za-z0-9._/-]+", line) is not None,
                "malformed checksum entry")
        checksum, name = line.split("  ", 1)
        require(name in expected and name not in result,
                "checksum name not allowlisted or repeated")
        require(HEX64.fullmatch(checksum) is not None, "invalid SHA-256")
        result[name] = checksum
    require(set(result) == expected, "checksum manifest membership mismatch")
    return result


def verify(archive_bytes=None, outer_manifest=None, *, expected_digest=DIGEST):
    """Inspect unmodified bytes. Override args permit adversarial unit tests."""
    raw = (DIRECTORY / FILENAME).read_bytes() if archive_bytes is None else archive_bytes
    manifest_bytes = ((DIRECTORY / "SHA256SUMS").read_bytes()
                      if outer_manifest is None else outer_manifest)
    require(len(raw) == SIZE, "ZIP byte size mismatch")
    require(digest(raw) == expected_digest, "outer ZIP SHA-256 mismatch")
    require(manifest_bytes == f"{expected_digest}  {FILENAME}\n".encode("ascii"),
            "outer SHA256SUMS differs byte-for-byte")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        infos = archive.infolist()
        require(len(infos) == 8 and {x.filename for x in infos} == MEMBERS,
                "ZIP members changed, missing or duplicated")
        require(all(not x.is_dir() and x.file_size < 2_000_000 and
                    stat.S_ISREG(x.external_attr >> 16) for x in infos),
                "unexpected archive file type or member size")
        require(sum(x.file_size for x in infos) < 4_000_000,
                "ZIP expanded size outside evidence boundary")
        require(archive.testzip() is None, "ZIP CRC mismatch")
        sums = manifest(archive.read("SHA256SUMS"), MEMBERS - {"SHA256SUMS"})
        for name, checksum in sums.items():
            require(digest(archive.read(name)) == checksum,
                    f"inner checksum mismatch: {name}")
        old = manifest(archive.read("fullpath/SHA256SUMS"),
                       {"report.json", "SUMMARY.md"})
        for name, checksum in old.items():
            require(digest(archive.read("fullpath/" + name)) == checksum,
                    f"nested fullpath checksum mismatch: {name}")
        receipt = json.loads(archive.read("EXPERIMENT.json"))
        browser = json.loads(archive.read("adaptive-browser.json"))
        serial = json.loads(archive.read("adaptive-serial.json"))
        full = json.loads(archive.read("fullpath/report.json"))
        summary = archive.read("SUMMARY.md").decode("utf-8")

    require(receipt.get("schemaVersion") == 1 and
            receipt.get("kind") == "qsol.vanillajs.rtx5060ti.adaptive-followup.v1" and
            receipt.get("status") == "PASS" and receipt.get("candidate") == CANDIDATE,
            "unexpected adaptive receipt identity or source")
    lineage = receipt["lineage"]
    require(lineage["originalReceipt"] == "RTX5060TI-001" and
            lineage["originalZipSha256"] == OLD_DIGEST and
            lineage["originalCandidate"] == PREVIOUS_CANDIDATE and
            lineage["originalReference"] == BASELINE and
            lineage["preExperimentMain"] == "93ace342c11e2427ad82920c8965f16e91518fb7",
            "historical reference/source pins drifted")
    require(receipt["actions"] == {"runId": "42310094400", "attempt": "1"},
            "GitHub Actions run identity changed")
    require(all(pin in summary for pin in [CANDIDATE, BASELINE, OLD_DIGEST]),
            "human-readable summary source pins changed")
    require(full["schemaVersion"] == 1 and
            full["kind"] == "qsol.vanillajs.rtx5060ti.trusted-comparison.v1" and
            full["baseline"]["sha"] == BASELINE and
            full["candidate"]["sha"] == CANDIDATE,
            "fullpath baseline/candidate identity mismatch")
    require(len(full["comparison"]["kernelSamples"]["baseline"]) == 7 and
            len(full["comparison"]["kernelSamples"]["candidate"]) == 7 and
            len(full["comparison"]["frameSamples"]["baseline"]) == 7 and
            len(full["comparison"]["frameSamples"]["candidate"]) == 7,
            "incomplete historical comparable workload")

    require(browser.get("schemaVersion") == 1 and
            browser.get("kind") == "qsol.vanillajs.rtx5060ti.new-workloads.v1" and
            browser.get("status") == "PASS" and browser["sourceSha"] == CANDIDATE,
            "new browser trial identity mismatch")
    renderer = browser["native"]["renderer"]
    require("NVIDIA GeForce RTX 5060 Ti" in renderer and
            not re.search(r"swiftshader|llvmpipe|lavapipe|software", renderer, re.I),
            "recorded browser renderer is not RTX 5060 Ti")
    protocol = browser["protocol"]
    require((protocol["warmupPairs"], protocol["measuredPairs"],
             protocol["circleQueries"], protocol["gpuFramesPerTrial"])
            == (2, 7, 250, 32), "unexpected new browser measurement protocol")
    require([r["count"] for r in browser["circles"]] == COUNTS,
            "new native circle workload inventory changed")
    for record in browser["circles"]:
        require(record["queries"] == 250, "incomplete native circle query trial")
        for lane in LANES:
            require(len(record["strategies"][lane]["samplesMs"]) == 7,
                    "incomplete native circle timing samples")
        require(HEX64.fullmatch(record["paritySha256"]) is not None,
                "missing native circle parity hash")
    gpu = browser["gpu"]
    pixel = gpu["pixelParitySha256"]
    require(HEX64.fullmatch(pixel) is not None, "native pixel SHA-256 missing")
    for lane in ("fresh", "retained"):
        require(len(gpu[lane]["samples"]) == 7, "incomplete native GPU trial pairs")
        for trial in gpu[lane]["samples"]:
            require(trial["frames"] == 32 and trial["image"]["sha256"] == pixel and
                    trial["image"]["brightPixels"] > 50, "GPU frame or pixel parity mismatch")
    require(serial["schemaVersion"] == 1 and
            [r["count"] for r in serial["records"]] == COUNTS,
            "serial CPU workload changed")
    require(HEX64.fullmatch(serial["candidateSHA256"]) is not None,
            "serial workload source checksum missing")
    for record in serial["records"]:
        require(record["queries"] == 400, "serial query count changed")
        for lane in LANES:
            require(len(record["strategies"][lane]["samplesMs"]) == 7,
                    "incomplete serial timing samples")
        require(HEX64.fullmatch(record["paritySHA256"]) is not None,
                "serial circle parity hash missing")
    print(f"PASS RTX5060TI-002: outer SHA256 {DIGEST}")
    print("PASS: eight original ZIP members, seven internal checksums, nested checksum chain")
    print("PASS: source pins, RTX identity, serial/adaptive and GPU pixel parity receipts")
    print(f"Source: {CANDIDATE}; original baseline: {BASELINE}")


if __name__ == "__main__":
    try:
        verify()
    except (OSError, ValueError, KeyError, TypeError, AssertionError,
            zipfile.BadZipFile, UnicodeDecodeError, json.JSONDecodeError) as error:
        print(f"FAIL RTX5060TI-002: {error}", file=sys.stderr)
        raise SystemExit(1) from error
