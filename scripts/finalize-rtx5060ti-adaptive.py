#!/usr/bin/env python3
"""Finalize an owner-run RTX experiment without altering RTX5060TI-001."""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "evidence/RTX5060TI-001/vanillajs-rtx5060ti-42203888152.zip"
HISTORIC_DIGEST = "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8"
HISTORIC_SOURCE = "240617e8bc1a935f05eaf75a10531f194f72a173"
PINNED_BASELINE = "1f965f4e5b6669de0f954e3a39b11aa679e56720"
ORIGIN_SOURCE = "93ace342c11e2427ad82920c8965f16e91518fb7"
EXPECTED_CIRCLES = [14, 26, 58, 128]
FILES = ("adaptive-serial.json", "adaptive-browser.json",
         "fullpath/report.json", "fullpath/SUMMARY.md", "fullpath/SHA256SUMS")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(ok, detail):
    if not ok:
        raise ValueError(detail)


def load_json(path):
    return json.loads(path.read_bytes())


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--expected-head", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--attempt", required=True)
    args = p.parse_args()
    require(re.fullmatch(r"[0-9a-f]{40}", args.expected_head), "invalid expected commit SHA")
    require(args.run_id.isdecimal() and args.attempt.isdecimal(), "invalid workflow run identity")
    target = Path(args.out).resolve()
    require(target != ROOT and ROOT not in target.parents, "evidence must be outside checkout")
    require(target.is_dir(), "missing evidence directory")
    require(not any((target / name).exists() for name in ("EXPERIMENT.json", "SUMMARY.md", "SHA256SUMS")),
            "refuse to overwrite completed receipt")

    require(sha(ARCHIVE.read_bytes()) == HISTORIC_DIGEST,
            "frozen RTX5060TI-001 ZIP drift")
    with zipfile.ZipFile(ARCHIVE) as z:
        history = json.loads(z.read("report.json"))
    require(history["candidate"]["sha"] == HISTORIC_SOURCE and
            history["baseline"]["sha"] == PINNED_BASELINE,
            "historical source identity changed")
    for name in FILES:
        require((target / name).is_file() and (target / name).is_file(),
                "missing required comparison file: " + name)

    full = load_json(target / "fullpath/report.json")
    serial = load_json(target / "adaptive-serial.json")
    native = load_json(target / "adaptive-browser.json")
    require(full["schemaVersion"] == 1 and
            full["kind"] == "qsol.vanillajs.rtx5060ti.trusted-comparison.v1",
            "invalid existing baseline comparison schema")
    require(full["baseline"]["sha"] == PINNED_BASELINE and
            full["candidate"]["sha"] == args.expected_head,
            "original workload source pins mismatch")
    require("RTX 5060 Ti" in full["environment"]["nativeWebGL"]["renderer"],
            "historical comparison did not identify native RTX")
    require(native["kind"] == "qsol.vanillajs.rtx5060ti.new-workloads.v1" and
            native["sourceSha"] == args.expected_head and native["status"] == "PASS",
            "new browser workload candidate mismatch")
    require("RTX 5060 Ti" in native["native"]["renderer"],
            "new browser workload did not identify RTX")
    require(serial["schemaVersion"] == 1 and len(serial["records"]) == 4,
            "serial workload record mismatch")
    require([r["count"] for r in serial["records"]] == EXPECTED_CIRCLES and
            [r["count"] for r in native["circles"]] == EXPECTED_CIRCLES,
            "candidate workloads changed shape")
    require(serial["candidateSHA256"] == sha(
        (ROOT / "modules/adaptive-circles/index.js").read_bytes()),
        "serial workload source checksum mismatch")
    require(native["protocol"]["measuredPairs"] == 7 and
            native["protocol"]["gpuFramesPerTrial"] == 32,
            "new native measurement incomplete")
    for r in serial["records"]:
        require(all(len(r["strategies"][lane]["samplesMs"]) == 7 for lane in
                    ("brute", "grid", "adaptive")),
                "serial adaptive result missing paired trials")
    for r in native["circles"]:
        require(all(len(r["strategies"][lane]["samplesMs"]) == 7 for lane in
                    ("brute", "grid", "adaptive")),
                "native adaptive result missing paired trials")
    require(all(len(native["gpu"][lane]["samples"]) == 7 for lane in
                ("fresh", "retained")), "incomplete native GPU frame trials")
    require(native["gpu"]["fresh"]["samples"][0]["image"]["sha256"] ==
            native["gpu"]["retained"]["samples"][0]["image"]["sha256"] ==
            native["gpu"]["pixelParitySha256"], "native pixel parity failed")

    receipt = {
        "schemaVersion": 1,
        "kind": "qsol.vanillajs.rtx5060ti.adaptive-followup.v1",
        "status": "PASS",
        "candidate": args.expected_head,
        "lineage": {
            "originalReceipt": "RTX5060TI-001",
            "originalZipSha256": HISTORIC_DIGEST,
            "originalCandidate": HISTORIC_SOURCE,
            "originalReference": PINNED_BASELINE,
            "preExperimentMain": ORIGIN_SOURCE,
        },
        "actions": {"runId": args.run_id, "attempt": args.attempt},
        "observations": {
            "historicalComparableWorkload": "fullpath/report.json",
            "newNativeWorkloads": "adaptive-browser.json",
            "newSerialNodeWorkloads": "adaptive-serial.json",
        },
        "trust": {
            "historicalComparison": "Existing RTX workflow is rerun on same pinned original baseline; not an exact replay of the 2026-11-06 device environment.",
            "newFeatures": "New spatial/cuboid workload has no comparable data in RTX5060TI-001; a fresh brute/forced-fresh reference is measured in this run.",
            "timing": "No timing thresholds, no crypto hardware attestation, no GPU timer-query measurement; CPU, driver and compositor influence timings.",
        },
    }
    lines = [
        "# RTX 5060 Ti — adaptive donor follow-up (new evidence, not RTX5060TI-001)",
        "", "Status: PASS",
        "Candidate: " + args.expected_head,
        "Original preserved baseline ZIP SHA-256: " + HISTORIC_DIGEST,
        "Historical source candidate: " + HISTORIC_SOURCE,
        "Existing baseline reference: " + PINNED_BASELINE,
        "New workload has **no historical RTX5060TI-001 equivalent**.",
        "", "## Fresh serial 2D circle-query workload",
        "",
        "| Circles | Brute (ms) | Grid (ms) | Adaptive (ms) |",
        "| ---: | ---: | ---: | ---: |",
    ]
    for r in native["circles"]:
        s = r["strategies"]
        lines.append("| {} | {:.3f} | {:.3f} | {:.3f} |".format(
            r["count"], *(s[k]["medianMs"] for k in ("brute", "grid", "adaptive"))))
    lines += [
        "", "## Native GPU cuboid comparison (same new source, 32 frames per trial)",
        "", "| Strategy | Median CPU+driver completion ms |",
        "| --- | ---: |",
        "| Forced-fresh | {:.3f} |".format(native["gpu"]["fresh"]["medianMs"]),
        "| Retained | {:.3f} |".format(native["gpu"]["retained"]["medianMs"]),
        "", "Pixel parity SHA-256: " + native["gpu"]["pixelParitySha256"],
        "", "## Evidence semantics",
        "",
        "- Native GPU tests use headed Chromium with RTX identification and explicit focus checks.",
        "- Native GPU timing uses gl.finish(); this is **not** a GPU timer query.",
        "- Exact source hashes, all seven paired measurements, renderer identity, and deterministic call counts are in the JSON files.",
        "- The original hardware receipt is verified and referenced, **not overwritten**.",
        "- Report regressions or equivalence alongside speedups; one execution does not establish universal performance.",
        "- Save the resulting GitHub artifact ZIP *verbatim* and its actual SHA-256 in a later preservation PR.",
        "",
    ]
    (target / "EXPERIMENT.json").write_bytes((json.dumps(receipt, indent=2) + "\n").encode())
    (target / "SUMMARY.md").write_bytes("\n".join(lines).encode())
    entries = [*FILES, "EXPERIMENT.json", "SUMMARY.md"]
    checks = "".join(sha((target / name).read_bytes()) + "  " + name + "\n" for name in entries)
    (target / "SHA256SUMS").write_bytes(checks.encode("ascii"))
    print("PASS: RTX5060TI-001 unchanged; new source-pinned paired workloads verified")
    print("\n".join(lines))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile,
            json.JSONDecodeError) as exc:
        print("FAIL: RTX adaptive receipt: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
