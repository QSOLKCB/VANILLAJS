#!/usr/bin/env python3
"""Seal three same-protocol native RTX baselines plus NEW serial CPU evidence.

New numerical workloads have no historical RTX performance baseline.
The three original ZIPs remain byte-identical and are never modified.
"""
import argparse
import hashlib
import json
import math
import re
import stat
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = {
    "001": ("240617e8bc1a935f05eaf75a10531f194f72a173",
            "vanillajs-rtx5060ti-42203888152.zip",
            "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8"),
    "002": ("b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f",
            "vanillajs-rtx5060ti-adaptive-42310094400-1.zip",
            "79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef"),
    "003": ("3f5518a168652a003e8db9aa6dc0371ddb4782ea",
            "vanillajs-rtx5060ti-arcade-42329114286-1.zip",
            "2b4377fa147fb951d9a918f94716518865e0696da328140e0ac323556f46b5da"),
}
PINS = {
    "vanillajsBase": "4647261445a1128c4e0c1e065f342ac4d2133cff",
    "bloatOps": "6f290dc818759ca49bcdec54b31d738b33c7946f",
    "corpoWars3dV12": "5701949e4ef7047b715db808b777450c3bf49d53",
    "nexus": "ac9ef5ac79008b46be3351c57cab946b93dd37e8",
    "uff": "596cd732df61587aa1a9801cad1ec13483b1347f",
}
MODULES = tuple("modules/" + name + "/index.js" for name in (
    "range2d", "integer-replay", "nexus-lattice", "orbital-physics"))
DATA = "bloat-nexus-uff-workload.json"
BASELINE_MEMBERS = tuple(
    f"baseline-{label}/{name}" for label in OLD
    for name in ("report.json", "SUMMARY.md", "SHA256SUMS"))


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def regular(path):
    require(stat.S_ISREG(path.lstat().st_mode), "not a regular file: " + str(path))
    return path.read_bytes()


def check_submanifest(folder):
    lines = regular(folder / "SHA256SUMS").decode("ascii").splitlines()
    require(len(lines) == 2, "invalid submanifest length")
    seen = set()
    for line in lines:
        match = re.fullmatch(r"([0-9a-f]{64})  (report\.json|SUMMARY\.md)", line)
        require(match is not None, "malformed submanifest")
        sha, name = match.groups()
        require(name not in seen, "duplicate submanifest member")
        seen.add(name)
        require(digest(regular(folder / name)) == sha,
                "nested digest drift: " + name)
    require(seen == {"report.json", "SUMMARY.md"}, "missing nested member")


def verify_samples(data, title):
    require(isinstance(data, list) and len(data) == 7,
            title + ": expected seven samples")
    require(all(type(x) in (int, float) and math.isfinite(x) and x >= 0
                for x in data), title + ": invalid samples")


def verify(out, candidate, run_id, attempt):
    require(re.fullmatch("[0-9a-f]{40}", candidate) is not None, "invalid source SHA")
    require(run_id.isdecimal() and attempt.isdecimal(), "invalid Actions identity")
    require(out.is_dir() and out != ROOT and ROOT not in out.parents,
            "evidence must be outside repository")
    require(not any((out / name).exists() for name in
                    ("NUMERICAL-RECEIPT.json", "SUMMARY.md", "SHA256SUMS")),
            "completed receipt cannot be overwritten")
    for label, (_, filename, expected_sha) in OLD.items():
        archive = ROOT / "evidence" / ("RTX5060TI-" + label) / filename
        require(digest(regular(archive)) == expected_sha,
                "original RTX archive drift: " + label)
    for label, (baseline, _, _) in OLD.items():
        folder = out / ("baseline-" + label)
        check_submanifest(folder)
        report = json.loads(regular(folder / "report.json"))
        require(report.get("schemaVersion") == 1 and
                report.get("kind") == "qsol.vanillajs.rtx5060ti.trusted-comparison.v1",
                "invalid trusted workload schema")
        require(report["baseline"]["sha"] == baseline and
                report["candidate"]["sha"] == candidate,
                "historical comparison source mismatch " + label)
        env = report["environment"]
        renderer = env["nativeWebGL"]["renderer"]
        require("RTX 5060 Ti" in renderer and
                re.search("swiftshader|software|lavapipe|llvmpipe", renderer, re.I)
                is None and
                env["gpu"]["verifiedModel"] == "NVIDIA GeForce RTX 5060 Ti",
                "native GPU hardware identity failed " + label)
        for side in ("baseline", "candidate"):
            summary = report["comparison"]["summary"][side]
            require(bool(summary) and
                    all(row["count"] == 7 for row in summary.values()),
                    "incomplete native trials " + label)
    data = json.loads(regular(out / DATA))
    require(data.get("schemaVersion") == 1 and
            data.get("kind") == "qsol.vanillajs.bloat-nexus-uff.serial-workloads.v1",
            "numerical report schema mismatch")
    require(data.get("sourcePins") == PINS, "donor source identity mismatch")
    require(set(data["sourceSHA256"]) == set(MODULES),
            "numerical source membership changed")
    for path in MODULES:
        require(data["sourceSHA256"][path] == digest(regular(ROOT / path)),
                "numerical source bytes differ: " + path)
    protocol = data["protocol"]
    require(protocol["warmups"] == 2 and protocol["pairedTrials"] == 7 and
            protocol["timingGate"] is False and protocol["gpu"] == "not measured",
            "numerical protocol changed")
    rows = data["workloads"]
    require([x["name"] for x in rows] ==
            ["axis-range"] * 3 + ["integer-replay"] +
            ["nexus-lattice"] * 3 + ["kepler-orbit"],
            "missing or extra numerical workloads")
    dimensions = (
        {"pairs": 32}, {"pairs": 256}, {"pairs": 2048},
        {"ticks": 2048},
        {"cells": 6, "rounds": 32},
        {"cells": 64, "rounds": 32},
        {"cells": 256, "rounds": 32},
        {"steps": 512, "dtSeconds": 10},
    )
    for index, (row, expected) in enumerate(zip(rows, dimensions)):
        require(all(type(row.get(field)) is int and row[field] == value
                    for field, value in expected.items()),
                f"numerical scenario dimensions mismatch at index {index}")
        if row["name"] == "axis-range":
            require(type(row.get("axisRejected")) is int and
                    0 <= row["axisRejected"] <= row["pairs"],
                    "invalid axis rejection count")
            groups = row["strategies"]
            require(set(groups) == {"reference", "candidate"},
                    "strategy membership changed")
            for key in groups:
                samples = groups[key]["samplesMs"]
                verify_samples(samples, key)
                require(groups[key]["medianMs"] == sorted(samples)[3],
                        "range median mismatch")
            require(re.fullmatch("[0-9a-f]{64}", row["sha256"]),
                    "invalid range parity hash")
        else:
            samples = row["samplesMs"]
            verify_samples(samples, row["name"])
            require(row["medianMs"] == sorted(samples)[3],
                    "numerical median mismatch")
        if row["name"] == "nexus-lattice":
            require(row["inverseMismatches"] == 0 and
                    re.fullmatch("[0-9a-f]{64}", row["sha256"]),
                    "lattice inverse evidence invalid")
        if row["name"] == "integer-replay":
            require(row["complete"] is True and
                    re.fullmatch("[0-9a-f]{8}", row["digest"]),
                    "integer replay not complete")
        if row["name"] == "kepler-orbit":
            require(row["maxRelativeEnergyDrift"] < 1e-7 and
                    len(row["finalPosition"]) == 3 and
                    all(math.isfinite(x) for x in row["finalPosition"]),
                    "orbital energy/reference bounds failed")

    receipt = {
        "schemaVersion": 1,
        "kind": "qsol.vanillajs.bloat-nexus-uff.rtx5060ti.followup.v1",
        "status": "PASS",
        "candidateSha": candidate,
        "actions": {"runId": run_id, "attempt": attempt},
        "originalArchives": {label: {"source": old[0], "sha256": old[2]}
                             for label, old in OLD.items()},
        "comparisons": [f"baseline-{x}/report.json" for x in OLD],
        "newCpuWorkloads": DATA,
        "limitations": [
            "Native RTX ran historical WebGL scenes, NOT the new CPU kernels.",
            "Numerical workloads do not have prior comparable GPU timing receipts.",
            "GL completion includes CPU and driver effects; no native game FPS claim.",
            "Original archived evidence is only verified, never modified.",
        ],
    }
    summary = [
        "# RTX 5060 Ti — three pinned original sources + CPU numerical kernels",
        "", "Status: PASS", "Candidate: " + candidate,
        "", "| Historical receipt | Pinned source | Native GPU |",
        "| --- | --- | --- |",
        *("| RTX5060TI-" + label + " | " + x[0] + " | PASS |"
          for label, x in OLD.items()),
        "", "New serial workloads: 8 scenarios (range, replay, NEXUS, Kepler).",
        "Seven measured samples per scenario and strict input/state checks.",
        "This is CPU numerical evidence, not RTX GPU compute.",
        "No historical GPU FPS speedup claim is implied.",
        "Preserve exact artifact bytes in a separate evidence PR.",
        "",
    ]
    (out / "NUMERICAL-RECEIPT.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    (out / "SUMMARY.md").write_text("\n".join(summary), encoding="utf-8")
    members = (*BASELINE_MEMBERS, DATA, "NUMERICAL-RECEIPT.json", "SUMMARY.md")
    (out / "SHA256SUMS").write_text("".join(
        digest(regular(out / filename)) + "  " + filename + "\n"
        for filename in members), encoding="ascii")
    return "\n".join(summary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--expected-head", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--attempt", required=True)
    args = parser.parse_args()
    print(verify(Path(args.out).resolve(), args.expected_head,
                 args.run_id, args.attempt))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, UnicodeError,
            json.JSONDecodeError) as exc:
        print("FAIL RTX numerical receipt: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
