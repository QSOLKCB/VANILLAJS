#!/usr/bin/env python3
"""Fail-closed optional verification of source-pinned RTX003 and COMMENT-001 bytes.

A manifest-only invocation checks metadata, NOT binary preservation. To claim
raw evidence is archived, supply --require-binaries with all three paths.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import stat
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "evidence/COMMENT-001/EVIDENCE_MANIFEST.json"
NAMES = (
    "EXPERIMENT.json", "SUMMARY.md", "frame-gate.json", "SHA256SUMS",
    "baseline-001/report.json", "baseline-001/SUMMARY.md",
    "baseline-001/SHA256SUMS", "baseline-002/report.json",
    "baseline-002/SUMMARY.md", "baseline-002/SHA256SUMS",
)
HEAD = "3f5518a168652a003e8db9aa6dc0371ddb4782ea"
BASELINES = {
    "baseline-001": "240617e8bc1a935f05eaf75a10531f194f72a173",
    "baseline-002": "b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f",
}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_manifest():
    m = json.loads(MANIFEST.read_bytes())
    require(m["schemaVersion"] == 1, "unexpected manifest schema")
    require(m["githubActions"]["sourceSha"] == HEAD, "source pin changed")
    require(set(m["rawEvidence"]) == {"rtx003", "screenshot", "excerpt"},
            "unexpected manifest members")
    for item in m["rawEvidence"].values():
        require(re.fullmatch(r"[0-9a-f]{64}", item["sha256"]), "bad SHA-256")
        require(re.fullmatch(r"[0-9a-f]{40}", item["gitBlob"]), "bad Git blob SHA-1")
        require(item["size"] > 0, "bad file size")
        require(item["path"].startswith("evidence/"), "bad relative evidence path")
    require(m["relatedDataset"]["doi"] == "10.5281/zenodo.24026140",
            "dataset citation drift")
    return m


def verify_bytes(item, path):
    require(stat.S_ISREG(path.lstat().st_mode),
            f"expected regular evidence file, not a link: {path.name}")
    raw = path.read_bytes()
    require(len(raw) == item["size"], f"size mismatch: {path.name}")
    require(digest(raw) == item["sha256"], f"SHA-256 mismatch: {path.name}")
    git_sha = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
    require(git_sha == item["gitBlob"], f"Git blob mismatch: {path.name}")
    return raw


def verify_image(data, width, height):
    require(data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG")
    require(data[12:16] == b"IHDR", "missing PNG header")
    require(struct.unpack(">II", data[16:24]) == (width, height),
            "PNG dimensions changed")


def verify_zip(raw):
    import io
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = z.namelist()
        require(len(names) == len(NAMES) and set(names) == set(NAMES),
                "ZIP member allowlist mismatch or duplicate")
        for info in z.infolist():
            require(not info.is_dir() and not (info.external_attr >> 16 & 0o170000) == 0o120000,
                    "symlink or directory in evidence ZIP")
            require(info.file_size < 1_000_000, "oversize member")
        require(z.testzip() is None, "ZIP CRC failure")
        checksum_entries = z.read("SHA256SUMS").decode("ascii").splitlines()
        require(len(checksum_entries) == 9, "outer member checksum cardinality")
        used = set()
        for line in checksum_entries:
            require(re.fullmatch(r"[0-9a-f]{64}  .+", line), "bad checksum line")
            h, name = line.split("  ", 1)
            require(name in NAMES and name != "SHA256SUMS" and name not in used,
                    "unexpected/duplicate checksum target")
            used.add(name)
            require(digest(z.read(name)) == h, "inner evidence checksum drift")
        require(used == set(NAMES) - {"SHA256SUMS"}, "incomplete SHA256SUMS")
        for folder in BASELINES:
            lines = z.read(folder + "/SHA256SUMS").decode("ascii").splitlines()
            require(len(lines) == 2, "nested manifest cardinality")
            nested = set()
            for line in lines:
                h, _, name = line.partition("  ")
                require(re.fullmatch(r"[0-9a-f]{64}", h) and name in ("report.json", "SUMMARY.md")
                        and name not in nested, "bad nested checksum")
                nested.add(name)
                require(digest(z.read(folder + "/" + name)) == h, "nested checksum drift")
        receipt = json.loads(z.read("EXPERIMENT.json"))
        require(receipt["candidate"] == HEAD and receipt["status"] == "PASS",
                "receipt source/status mismatch")
        for folder, old in BASELINES.items():
            report = json.loads(z.read(folder + "/report.json"))
            require(report["baseline"]["sha"] == old and
                    report["candidate"]["sha"] == HEAD, "baseline source drift")
        gate = json.loads(z.read("frame-gate.json"))
        require(gate["sourceSha"] == HEAD and gate["status"] == "PASS",
                "frame-gate source/status drift")
        require(gate["protocol"]["measuredPairs"] == 7 and
                gate["protocol"]["framesPerTrial"] == 48, "trial count drift")
        a, b = gate["strategies"]["forced"]["samples"], gate["strategies"]["gated"]["samples"]
        require(len(a) == len(b) == 7, "paired sample cardinality")
        for x, y in zip(a, b):
            require(x["pixels"] == y["pixels"] and len(x["pixels"]) == 9,
                    "checkpoint parity mismatch")
            require(x["actualDrawn"] == 48 and y["actualDrawn"] == 9 and
                    y["skipped"] == 39, "draw-call count drift")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest-only", action="store_true")
    p.add_argument("--require-binaries", action="store_true")
    p.add_argument("--rtx-only", action="store_true")
    p.add_argument("--archive", type=Path)
    p.add_argument("--screenshot", type=Path)
    p.add_argument("--excerpt", type=Path)
    args = p.parse_args()
    m = read_manifest()
    if args.manifest_only:
        require(not args.require_binaries and not args.rtx_only and not any((
            args.archive, args.screenshot, args.excerpt)), "choose one mode")
        print("PASS metadata only — RAW ARTIFACTS NOT VERIFIED")
        return
    if args.rtx_only:
        require(not args.require_binaries and not args.screenshot and not args.excerpt,
                "RTX-only mode takes no screenshot inputs")
        archive = args.archive or ROOT / m["rawEvidence"]["rtx003"]["path"]
        verify_zip(verify_bytes(m["rawEvidence"]["rtx003"], archive))
        print("PASS exact RTX003 Git archive; SCREENSHOT BYTES NOT VERIFIED")
        return
    require(args.require_binaries or all((args.archive, args.screenshot, args.excerpt)),
            "provide all three paths or use --manifest-only")
    for arg in (args.archive, args.screenshot, args.excerpt):
        require(arg is not None, "all three evidence inputs required")
    raw = verify_bytes(m["rawEvidence"]["rtx003"], args.archive)
    verify_zip(raw)
    verify_image(verify_bytes(m["rawEvidence"]["screenshot"], args.screenshot), 1851, 996)
    verify_image(verify_bytes(m["rawEvidence"]["excerpt"], args.excerpt), 670, 554)
    print("PASS binary evidence bytes, ZIP membership, nested checksums and source identities")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, UnicodeError, AssertionError,
            zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print("FAIL: RTX003 / COMMENT-001: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
