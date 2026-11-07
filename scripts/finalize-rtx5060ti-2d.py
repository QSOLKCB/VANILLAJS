#!/usr/bin/env python3
"""Fail-closed finalization of a manually authorized owner RTX 2D experiment."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import stat
import sys

ROOT = Path(__file__).resolve().parents[1]
NAMES = ("lab2d-source.json", "rtx2d.json")
_HEX40 = re.compile(r"[0-9a-f]{40}\Z")
_HEX64 = re.compile(r"[0-9a-f]{64}\Z")


def require(ok, why):
    if not ok:
        raise ValueError(why)


def regular(path):
    require(stat.S_ISREG(path.lstat().st_mode), "missing/nonregular: " + str(path))
    return path.read_bytes()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def median(rows):
    require(type(rows) is list and len(rows) == 7 and all(
        type(x) in (int, float) and math.isfinite(x) and x >= 0 for x in rows
    ), "exactly seven finite timing samples required")
    return sorted(rows)[3]


def verify(source, report, expected_head):
    require(_HEX40.fullmatch(expected_head) is not None,
            "expected source must be a full Git SHA")
    require(type(source) is dict and
            set(source) == {"strict", "strictSHA256", "observations"},
            "bad 2D source evidence envelope")
    strict = source["strict"]
    require(type(strict) is dict and
            strict.get("kind") == "qsol.vanillajs.lab2d.evidence.v1" and
            len(strict.get("scenes", [])) == 4 and
            strict.get("audio", {}).get("chunkIdentical") is True,
            "source 2D contract incomplete")
    # JS node evidence uses recursively sorted keys, matching this Python form.
    identity = sha(json.dumps(strict, sort_keys=True, separators=(",", ":"),
                             ensure_ascii=True, allow_nan=False).encode("utf-8"))
    require(source.get("strictSHA256") == identity,
            "source-side strict identity drift")
    require(type(report) is dict and report.get("schemaVersion") == 1 and
            report.get("kind") == "qsol.vanillajs.rtx5060ti.2d-foundry.native.v1" and
            report.get("status") == "PASS" and
            report.get("candidateSha") == expected_head and
            report.get("sourceStrictSHA256") == identity and
            report.get("sourceEvidenceSHA256") == sha(
                (json.dumps(source, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
            ),
            "RTX2D result source identity mismatch")
    # A receipt must bind the exact source JSON file; the caller below checks
    # this again from original raw bytes, never from a reconstructed report.
    native = report.get("nativeWebGLIdentity", {})
    require(isinstance(native.get("vendor"), str) and
            re.search("NVIDIA", native["vendor"], re.I) is not None and
            isinstance(native.get("renderer"), str) and
            re.search("RTX\\s*5060\\s*Ti", native["renderer"], re.I) is not None and
            re.search("swiftshader|llvmpipe|lavapipe|software",
                      native["renderer"], re.I) is None,
            "native NVIDIA WebGL identity missing")
    c = report.get("canvas2D", {})
    assert_sha = lambda x: type(x) is str and _HEX64.fullmatch(x) is not None
    require(type(c.get("brightPixels")) is int and c["brightPixels"] > 500 and
            assert_sha(c.get("pixelSHA256")) and
            c.get("rendererMode") == "Canvas2D" and
            c.get("sampleCount") == 95 and
            len(c.get("frameIntervalsMs", [])) == 95 and
            all(type(x) in (int, float) and math.isfinite(x) and x > 0
                for x in c["frameIntervalsMs"]),
            "incomplete measured Canvas2D observation")
    samples = sorted(c["frameIntervalsMs"])
    require(c.get("p95FrameIntervalMs") == samples[math.ceil(len(samples) * .95) - 1],
            "frame p95 does not match raw observations")
    comparison = report.get("comparison", {})
    require(comparison.get("protocol") ==
            {"warmups": 2, "pairs": 7, "framesPerTrial": 240,
             "reuse": "FrameGate identical presentation key", "timingGate": False},
            "wrong hardware test protocol")
    rows = comparison["forced"]["samples"], comparison["retained"]["samples"]
    for name, data in zip(("forced", "retained"), rows):
        require(type(data) is list and len(data) == 7,
                "seven source-paired frame-gate observations required")
        values = []
        for item in data:
            require(type(item) is dict and
                    type(item.get("ms")) in (int, float) and
                    math.isfinite(item["ms"]) and item["ms"] >= 0 and
                    assert_sha(item.get("pixels")) and
                    item.get("drawn") == (240 if name == "forced" else 1),
                    "invalid frame-gate " + name + " sample")
            if name == "retained":
                require(item.get("stats", {}).get("drawn") == 1 and
                        item["stats"].get("skipped") == 239,
                        "retained draw-skip invariant failed")
            values.append(item["ms"])
        require(comparison[name]["medianMs"] == median(values),
                "frame-gate median changed")
    for old, new in zip(*rows):
        require(old["pixels"] == new["pixels"],
                "paired framebuffer mismatch")
    return {"source": expected_head, "pairedTrials": 7,
            "pixelFrames": 7, "canvasIntervals": 95}


def finalize(folder, expected_head, run_id, attempt):
    folder = folder.resolve()
    require(folder.is_dir() and ROOT != folder and ROOT not in folder.parents,
            "must write evidence outside source checkout")
    require(re.fullmatch(r"[0-9]+", run_id) and
            re.fullmatch(r"[0-9]+", attempt),
            "run and attempt must be unsigned decimal strings")
    for name in ("EXPERIMENT.json", "SUMMARY.md", "SHA256SUMS"):
        require(not (folder / name).exists(),
                "refusing to overwrite sealed evidence")
    raw = {name: regular(folder / name) for name in NAMES}
    src = json.loads(raw["lab2d-source.json"])
    rep = json.loads(raw["rtx2d.json"])
    result = verify(src, rep, expected_head)
    require(rep["sourceEvidenceSHA256"] == sha(raw["lab2d-source.json"]),
            "RTX report did not bind exact original source bytes")
    source_hashes = src["strict"].get("sourceSHA256", {})
    require(type(source_hashes) is dict and len(source_hashes) == 4,
            "source byte identity list incomplete")
    for name, h in source_hashes.items():
        require(type(name) is str and name.startswith("modules/") or
                name == "demos/2d-lab/world.js",
                "nonallowlisted source path")
        require(_HEX64.fullmatch(h) is not None and
                sha(regular(ROOT / name)) == h,
                "source files changed after measured code execution")
    receipt = {"schemaVersion": 1,
        "kind": "qsol.vanillajs.rtx5060ti.2d-followup.v1",
        "status": "PASS", "sourceSha": expected_head,
        "actions": {"runId": run_id, "attempt": attempt},
        "sourceEvidenceSHA256": sha(raw["lab2d-source.json"]),
        "nativeReportSHA256": sha(raw["rtx2d.json"]),
        "summary": result,
        "limits": ["Physical RTX identity is separate from Canvas2D acceleration.",
                   "No GPU compute, timer queries, or game FPS speedup claim.",
                   "No source history or prior RTX archive was rewritten."]}
    summary = [
        "# RTX 5060 Ti — 2D Foundry hardware follow-up",
        "", "Status: PASS", "Exact reviewed main: " + expected_head,
        "Native identity: " + rep["nativeWebGLIdentity"]["renderer"],
        "Seven forced-redraw/FrameGate pairs with matching pixels.",
        "95 observed requestAnimationFrame intervals (browser-scheduler dependent).",
        "Audio and ternary workload evidence is CPU-only.",
        "No universal game FPS or GPU compute speedup claim.",
        ""]
    (folder / "EXPERIMENT.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    (folder / "SUMMARY.md").write_text("\n".join(summary), encoding="utf-8")
    files = NAMES + ("EXPERIMENT.json", "SUMMARY.md")
    (folder / "SHA256SUMS").write_text("".join(
        sha(regular(folder / name)) + "  " + name + "\n" for name in files),
        encoding="ascii")
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--expected-head", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--attempt", required=True)
    args = p.parse_args()
    print("RTX2D PASS", finalize(args.out, args.expected_head,
                                 args.run_id, args.attempt))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as ex:
        print("RTX2D FAIL: " + str(ex), file=sys.stderr)
        raise SystemExit(1) from None
