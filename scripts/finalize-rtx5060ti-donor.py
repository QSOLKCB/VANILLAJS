#!/usr/bin/env python3
"""Finalize source-pinned RTX donor-upgrade evidence without modifying old receipts.

Native WebGL timings and new serial CPU numerical timings are different claims.
Only an owner-authorized, reviewed main checkout may produce these observations.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import stat
import sys

ROOT = Path(__file__).resolve().parents[1]
BASELINE = "e82d51be222d99951d70509468eaae8f3efc9fcd"
MODULES = ("modules/time/index.js", "modules/lead-solver/index.js")
DATA = "donor-upgrade-workload.json"
ORIGINALS = {
    "001": ("vanillajs-rtx5060ti-42203888152.zip",
            "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8"),
    "002": ("vanillajs-rtx5060ti-adaptive-42310094400-1.zip",
            "79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef"),
    "003": ("vanillajs-rtx5060ti-arcade-42329114286-1.zip",
            "2b4377fa147fb951d9a918f94716518865e0696da328140e0ac323556f46b5da"),
    "004": ("vanillajs-rtx5060ti-bloat-nexus-uff-42347306980-1.zip",
            "60596835ed906393c8315ce4455a40b4eef05764f82de40a5bbe9d2244136814"),
}


def require(ok, explanation):
    if not ok:
        raise ValueError(explanation)


def regular(path):
    require(stat.S_ISREG(path.lstat().st_mode), f"nonregular file: {path}")
    return path.read_bytes()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def samples(row):
    require(type(row) is list and len(row) == 7 and
            all(type(v) in (float, int) and math.isfinite(v) and v >= 0
                for v in row), "expected seven finite nonnegative samples")
    return sorted(row)[3]


def validate_cpu(data, expected):
    require(type(data) is dict and data.get("schemaVersion") == 1 and
            data.get("kind") == "qsol.vanillajs.donor-upgrade.cpu.v1" and
            data.get("baseline") == BASELINE and
            data.get("sourceSHA256") == expected, "CPU source/protocol identity mismatch")
    protocol = data.get("protocol")
    require(type(protocol) is dict and
            protocol.get("execution") == "serial single Node process" and
            protocol.get("warmups") == 2 and protocol.get("samples") == 7 and
            protocol.get("gpu") == "not measured" and
            protocol.get("timingGate") is False, "CPU measurement protocol changed")
    rows = data.get("workloads")
    require(type(rows) is list and len(rows) == 2 and
            [r.get("name") for r in rows] == ["frame-pacing", "moving-target-intercept"],
            "missing or extra CPU workloads")
    for row in rows:
        require(row["medianMs"] == samples(row["samplesMs"]) and
                re.fullmatch(r"[0-9a-f]{64}", row["sha256"]) is not None,
                "CPU samples/median/hash mismatch")
    frame, target = rows
    expected_counts = [[hz, 7200] for hz in (30, 59, 60, 61, 75, 120, 144)]
    require(frame.get("tickCounts") == expected_counts and
            frame.get("roundedTicks") == 3600, "incomplete compensated pacing scenario")
    require(type(target.get("solutions")) is int and target["solutions"] > 0 and
            type(target.get("abstentions")) is int and target["abstentions"] > 0 and
            target["solutions"] + target["abstentions"] == 4000 and
            type(target.get("maxRelativeResidual")) in (int, float) and
            math.isfinite(target["maxRelativeResidual"]) and
            0 <= target["maxRelativeResidual"] <= 1e-8,
            "invalid moving-target numeric scenario")
    return True


def verify_trusted(folder, candidate):
    entries = regular(folder / "SHA256SUMS").decode("ascii").splitlines()
    require(len(entries) == 2, "incomplete native SHA256SUMS")
    seen = set()
    for line in entries:
        match = re.fullmatch(r"([0-9a-f]{64})  (report\.json|SUMMARY\.md)", line)
        require(match is not None, "malformed native manifest")
        sha, name = match.groups()
        require(name not in seen and digest(regular(folder / name)) == sha,
                "native comparison checksum drift")
        seen.add(name)
    require(seen == {"report.json", "SUMMARY.md"}, "missing native manifest member")
    report = json.loads(regular(folder / "report.json"))
    require(report.get("kind") == "qsol.vanillajs.rtx5060ti.trusted-comparison.v1" and
            report.get("schemaVersion") == 1 and
            report["baseline"]["sha"] == BASELINE and
            report["candidate"]["sha"] == candidate,
            "wrong baseline or candidate native source")
    env = report["environment"]
    renderer = env["nativeWebGL"]["renderer"]
    require(env["gpu"]["verifiedModel"] == "NVIDIA GeForce RTX 5060 Ti" and
            "RTX 5060 Ti" in renderer and
            not re.search(r"swiftshader|software|llvmpipe|lavapipe", renderer, re.I),
            "native RTX renderer not established")
    for side in ("baseline", "candidate"):
        metrics = report["comparison"]["summary"][side]
        require(bool(metrics) and all(type(row["count"]) is int and
                row["count"] == 7 for row in metrics.values()),
                "native seven-pair trial incomplete")
    return report


def finalize(out, candidate, run_id, attempt):
    require(re.fullmatch(r"[0-9a-f]{40}", candidate) is not None and
            re.fullmatch(r"[0-9]+", run_id) is not None and
            re.fullmatch(r"[0-9]+", attempt) is not None,
            "invalid source/Actions identities")
    out = out.resolve()
    require(out.is_dir() and out != ROOT and ROOT not in out.parents,
            "write evidence outside source tree")
    require(not any((out / p).exists() for p in
                    ("EXPERIMENT.json", "SUMMARY.md", "SHA256SUMS")),
            "success evidence already exists; refusing overwrite")
    for label, (filename, pinned) in ORIGINALS.items():
        archive = ROOT / "evidence" / ("RTX5060TI-" + label) / filename
        require(digest(regular(archive)) == pinned, "original RTX archive changed: " + label)
    report = verify_trusted(out / "fullpath", candidate)
    source_sha = {name: digest(regular(ROOT / name)) for name in MODULES}
    data = json.loads(regular(out / DATA))
    validate_cpu(data, source_sha)

    receipt = {
        "schemaVersion": 1,
        "kind": "qsol.vanillajs.rtx5060ti.donor-upgrade.v1",
        "status": "PASS",
        "candidateSha": candidate,
        "baselineSha": BASELINE,
        "actions": {"runId": run_id, "attempt": attempt},
        "sourceSHA256": source_sha,
        "originalArchiveSHA256": {label: value[1] for label, value in ORIGINALS.items()},
        "nativeComparison": "fullpath/report.json",
        "newCpuWorkloads": DATA,
        "limitations": [
            "Native RTX WebGL comparison reruns an existing workload, not new GPU physics.",
            "New clock and lead numerical workloads execute on CPU, not RTX compute.",
            "gl.finish includes driver/CPU overhead; no native-game FPS improvement claim.",
            "Archival RTX001/002/003/004 ZIPs are verified and unchanged."
        ]
    }
    summary = [
        "# RTX 5060 Ti — donor upgrade physical follow-up",
        "", "Status: PASS", "Base (pre-upgrade): " + BASELINE,
        "Candidate (reviewed main): " + candidate,
        "Native renderer: " + report["environment"]["nativeWebGL"]["renderer"],
        "", "Native WebGL: 7 paired historical source-comparison trials.",
        "New CPU: 2 separately measured 7-sample numerical workloads.",
        "No GPU physics, game FPS or general speedup claim.",
        "All four prior RTX evidence ZIPs were checked but never modified.",
        "Preserve downloaded artifact ZIP bytes in a separate evidence PR.",
        "",
    ]
    (out / "EXPERIMENT.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    (out / "SUMMARY.md").write_text("\n".join(summary), encoding="utf-8")
    members = ["fullpath/report.json", "fullpath/SUMMARY.md",
               "fullpath/SHA256SUMS", DATA, "EXPERIMENT.json", "SUMMARY.md"]
    (out / "SHA256SUMS").write_text("".join(
        digest(regular(out / file)) + "  " + file + "\n" for file in members),
        encoding="ascii")
    return "\n".join(summary)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--expected-head", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--attempt", required=True)
    args = p.parse_args()
    print(finalize(Path(args.out), args.expected_head, args.run_id, args.attempt))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, UnicodeError,
            json.JSONDecodeError) as exc:
        print("FAILED donor RTX receipt: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
