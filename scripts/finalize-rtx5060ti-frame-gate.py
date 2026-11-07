#!/usr/bin/env python3
"""Read-only historical anchors; finalise new owner-run RTX frame-gate evidence."""
import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT_001 = "240617e8bc1a935f05eaf75a10531f194f72a173"
RECEIPT_002 = "b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f"
ARCHIVE_001 = "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8"
ARCHIVE_002 = "79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef"
FILES = (
    "baseline-001/report.json", "baseline-001/SUMMARY.md",
    "baseline-001/SHA256SUMS",
    "baseline-002/report.json", "baseline-002/SUMMARY.md",
    "baseline-002/SHA256SUMS",
    "frame-gate.json",
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_bytes())


def verify_local_sums(folder):
    entries = (folder / "SHA256SUMS").read_text(encoding="ascii").splitlines()
    require(len(entries) == 2, "baseline checksum manifest must have two files")
    expected = {"report.json", "SUMMARY.md"}
    for line in entries:
        require(re.fullmatch(r"[a-f0-9]{64}  (?:report\.json|SUMMARY\.md)", line),
                "malformed baseline checksum entry")
        digest, name = line.split("  ", 1)
        require(name in expected, "duplicate baseline checksum entry")
        require(sha((folder / name).read_bytes()) == digest,
                "baseline checksum mismatch " + name)
        expected.remove(name)
    require(not expected, "incomplete baseline checksum list")


def verify(out, candidate):
    require(out.is_dir() and out != ROOT and ROOT not in out.parents,
            "output directory must exist outside checkout")
    require(not any((out / name).exists() for name in
                    ("EXPERIMENT.json", "SUMMARY.md", "SHA256SUMS")),
            "refusing to overwrite completed evidence")
    pin = {
        "RTX5060TI-001": ("vanillajs-rtx5060ti-42203888152.zip", ARCHIVE_001),
        "RTX5060TI-002": ("vanillajs-rtx5060ti-adaptive-42310094400-1.zip", ARCHIVE_002),
    }
    for name, (filename, digest) in pin.items():
        data = (ROOT / "evidence" / name / filename).read_bytes()
        require(sha(data) == digest, "frozen historical archive changed: " + name)
    for name in FILES:
        require((out / name).is_file(), "missing required evidence: " + name)

    reports = []
    for label, baseline in (("001", RECEIPT_001), ("002", RECEIPT_002)):
        folder = out / ("baseline-" + label)
        verify_local_sums(folder)
        report = read_json(folder / "report.json")
        require(report.get("schemaVersion") == 1 and
                report.get("kind") == "qsol.vanillajs.rtx5060ti.trusted-comparison.v1",
                "historical comparison type mismatch " + label)
        require(report["baseline"]["sha"] == baseline and
                report["candidate"]["sha"] == candidate,
                "historical pinned source mismatch " + label)
        env = report["environment"]
        require("RTX 5060 Ti" in env["nativeWebGL"]["renderer"] and
                not re.search(r"software|swiftshader|llvmpipe|lavapipe",
                              env["nativeWebGL"]["renderer"], re.I) and
                env["gpu"]["verifiedModel"] == "NVIDIA GeForce RTX 5060 Ti",
                "historical comparison was not native RTX")
        for key in ("baseline", "candidate"):
            require(all(metric["count"] == 7 for metric in
                        report["comparison"]["summary"][key].values()),
                    "incomplete historical comparison trials")
        reports.append(report)

    native = read_json(out / "frame-gate.json")
    require(native.get("schemaVersion") == 1 and
            native.get("kind") == "qsol.vanillajs.arcade-frame-gate.native.v1" and
            native.get("sourceSha") == candidate and native.get("status") == "PASS",
            "new frame-gate provenance mismatch")
    require("RTX 5060 Ti" in native["native"]["renderer"] and
            not re.search(r"software|swiftshader|llvmpipe|lavapipe",
                          native["native"]["renderer"], re.I),
            "new workload did not identify native RTX")
    require(native["protocol"]["warmupPairs"] == 2 and
            native["protocol"]["measuredPairs"] == 7 and
            native["protocol"]["framesPerTrial"] == 48 and
            native["protocol"]["snapshotsPerTrial"] == 9,
            "frame-gate protocol incomplete")
    forced = native["strategies"]["forced"]
    gated = native["strategies"]["gated"]
    require(len(forced["samples"]) == len(gated["samples"]) == 7,
            "frame-gate paired trials incomplete")
    require(re.fullmatch(r"[a-f0-9]{64}", native["paritySha256"]),
            "invalid pixel receipt")
    observed = forced["samples"][0]["pixels"]
    digest = sha(json.dumps(observed, separators=(",", ":")).encode("utf-8"))
    require(digest == native["paritySha256"],
            "pixel receipt digest does not match checkpoint bytes")
    for f, g in zip(forced["samples"], gated["samples"]):
        require(len(f["pixels"]) == len(g["pixels"]) == 9 and
                f["pixels"] == g["pixels"] and
                all(re.fullmatch(r"[a-f0-9]{64}", value) for value in f["pixels"]),
                "frame-gate checkpoint parity failed")
        require(f["actualDrawn"] == f["drawCalls"] == 48 and
                g["actualDrawn"] == g["drawCalls"] == 9 and
                g["skipped"] == 39, "frame-gate work counts changed")
        require(all(math.isfinite(s["ms"]) and s["ms"] >= 0 for s in (f, g)),
                "invalid timing sample")
    require(all(math.isfinite(group["medianMs"]) and group["medianMs"] >= 0 and
                group["medianMs"] == sorted(sample["ms"] for sample in group["samples"])[3]
                for group in (forced, gated)), "invalid timing summary")

    summary = [
        "# RTX 5060 Ti — ARCADE frame-gate hardware comparison",
        "", "Status: PASS", "Candidate: " + candidate,
        "",
        "## Historical source comparison (same *original* workload rerun)",
        "",
        "| Baseline version | Source commit | Candidate commit | Native WebGL pixel parity |",
        "| --- | --- | --- | --- |",
        "| RTX5060TI-001 | " + RECEIPT_001 + " | " + candidate + " | PASS |",
        "| RTX5060TI-002 | " + RECEIPT_002 + " | " + candidate + " | PASS |",
        "",
        "Both historical ZIPs were checked by exact outer SHA-256.",
        "The new report re-executes the original workload on the current hardware.",
        "Historic archived timing samples are not substituted into new pairs.",
        "",
        "## New opt-in ARCADE frame gate vs forced redraw",
        "",
        "| Strategy | Median ms (48 synthetic frames + pixel readback) | Draw calls |",
        "| --- | ---: | ---: |",
        "| Forced | {:.3f} | 48 |".format(forced["medianMs"]),
        "| Gated | {:.3f} | 9 |".format(gated["medianMs"]),
        "",
        "9 pixel checkpoints per trial, 7 alternating paired trials: PASS.",
        "39 of 48 redundant draws skipped; no claim of native game FPS gains.",
        "The new feature was not measured by either archived receipt.",
        "gl.finish and readPixels affect CPU+driver wall time, not pure GPU timer time.",
        "The full raw samples, source SHA and driver/browser metadata are in JSON.",
        "",
        "A separate reviewed evidence-preservation PR is required after owner approval.",
        "",
    ]
    receipt = {
        "schemaVersion": 1,
        "kind": "qsol.vanillajs.arcade.rtx5060ti.followup.v1",
        "status": "PASS",
        "candidate": candidate,
        "historical": {
            "RTX5060TI-001": {"sha": RECEIPT_001, "zipSha256": ARCHIVE_001},
            "RTX5060TI-002": {"sha": RECEIPT_002, "zipSha256": ARCHIVE_002},
        },
        "workloads": {
            "currentProtocolHistoricalSources": [
                "baseline-001/report.json", "baseline-002/report.json"],
            "newOptInFeature": "frame-gate.json",
        },
        "limitations": [
            "Do not compare different workload definitions as speedup.",
            "Hardware results are observational and not cryptographic attestation.",
            "No native-GPU FPS claim or exact cross-driver pixel guarantee.",
        ],
    }
    (out / "EXPERIMENT.json").write_text(json.dumps(receipt, indent=2) + "\n")
    (out / "SUMMARY.md").write_text("\n".join(summary))
    manifest = "".join(
        sha((out / name).read_bytes()) + "  " + name + "\n"
        for name in (*FILES, "EXPERIMENT.json", "SUMMARY.md")
    )
    (out / "SHA256SUMS").write_text(manifest, encoding="ascii")
    return "\n".join(summary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--expected-head", required=True)
    args = parser.parse_args()
    require(re.fullmatch(r"[a-f0-9]{40}", args.expected_head), "invalid source SHA")
    print(verify(Path(args.out).resolve(), args.expected_head))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, UnicodeError,
            json.JSONDecodeError) as exc:
        print("FAIL RTX frame-gate evidence: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
