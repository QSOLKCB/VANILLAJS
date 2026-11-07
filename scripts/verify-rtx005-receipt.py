#!/usr/bin/env python3
"""Fail-closed, standard-library audit of RTX5060TI-005 historical evidence.

The current checkout is not part of any historical source-hash comparison.
"""
import hashlib
import io
import json
import math
from pathlib import Path
import re
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = (ROOT / "evidence/RTX5060TI-005" /
           "vanillajs-rtx5060ti-donor-42353698285-1.zip")
SIZE = 13814
SHA256 = "4589d1f93e08ad5b7a06a67b2565ceaf7ae1c52172c6c6e136740242d380f48d"
GIT_BLOB = "f0227c9c08f26826b8eafe00c03384cbffff78df"
BASELINE = "e82d51be222d99951d70509468eaae8f3efc9fcd"
CANDIDATE = "90b2fe1f3428710eade90cc328c9e6bf7e18f457"
RUN = {"runId": "42353698285", "attempt": "1"}
PREVIOUS = {
    "001": "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8",
    "002": "79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef",
    "003": "2b4377fa147fb951d9a918f94716518865e0696da328140e0ac323556f46b5da",
    "004": "60596835ed906393c8315ce4455a40b4eef05764f82de40a5bbe9d2244136814",
}
# Independently pinned from the reviewed historical CANDIDATE SHA and the
# actual hardware receipt. Never hash current working-tree source modules:
# later fixes, including comment-only edits, must leave RTX005 verifiable.
HISTORICAL_SOURCE_SHA256 = {
    "modules/time/index.js":
        "de94c0bc04e6a269504c5742455ce114f824c2c0d9d59a2fd94555df5d9bb4a2",
    "modules/lead-solver/index.js":
        "e0ed0b67ebbf972f4e1bcf900f24cf56048252bc853073ed0f89cc7328bb06c1",
}
MEMBERS = frozenset({
    "EXPERIMENT.json",
    "donor-upgrade-workload.json",
    "SUMMARY.md",
    "SHA256SUMS",
    "fullpath/report.json",
    "fullpath/SUMMARY.md",
    "fullpath/SHA256SUMS",
})
NATIVE_METRICS = frozenset({
    "geometryPrepMs", "staticCollisionMs", "fpsCallbackMedianMs",
    "fpsFrameIntervalP95Ms", "fpsUploadBytes", "fpsDrawCalls",
})
CPU_NAMES = ("frame-pacing", "moving-target-intercept")
REFRESH_RATES = (30, 59, 60, 61, 75, 120, 144)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def check_manifest(manifest, children, expected, label):
    lines = manifest.decode("ascii").splitlines()
    require(len(lines) == len(expected), label + " manifest count changed")
    seen = set()
    for line in lines:
        match = re.fullmatch(r"([0-9a-f]{64})  ([^\r\n]+)", line)
        require(match is not None, label + " malformed SHA256SUMS")
        sha, name = match.groups()
        require(name in expected and name not in seen,
                label + " unexpected or duplicate manifest path")
        require(name in children and digest(children[name]) == sha,
                label + " member SHA-256 drift: " + name)
        seen.add(name)
    require(seen == set(expected), label + " missing SHA256SUMS member")


def median(samples, label):
    require(type(samples) is list and len(samples) == 7 and
            all(type(x) in (int, float) and math.isfinite(x) and x >= 0
                for x in samples), "seven finite " + label + " samples required")
    return sorted(samples)[3]


def verify_zip(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        require(len(names) == len(MEMBERS) and len(names) == len(set(names))
                and set(names) == MEMBERS, "RTX005 archive membership mismatch")
        total = 0
        for info in infos:
            mode = info.external_attr >> 16
            require(not info.is_dir() and not stat.S_ISLNK(mode) and
                    (not mode or stat.S_ISREG(mode) or (mode & 0o170000) == 0) and
                    info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) and
                    not (info.flag_bits & 1) and 0 <= info.file_size <= 1_000_000,
                    "unsafe RTX005 ZIP member")
            total += info.file_size
        require(total <= 2_000_000 and archive.testzip() is None,
                "RTX005 ZIP resource/CRC failure")
        content = {name: archive.read(name) for name in names}

    check_manifest(content["SHA256SUMS"], content,
                   MEMBERS - {"SHA256SUMS"}, "outer")
    nested = {
        "report.json": content["fullpath/report.json"],
        "SUMMARY.md": content["fullpath/SUMMARY.md"],
    }
    check_manifest(content["fullpath/SHA256SUMS"], nested,
                   frozenset(nested), "native")

    receipt = json.loads(content["EXPERIMENT.json"])
    require(type(receipt) is dict and
            receipt.get("schemaVersion") == 1 and
            receipt.get("kind") == "qsol.vanillajs.rtx5060ti.donor-upgrade.v1" and
            receipt.get("status") == "PASS" and
            receipt.get("baselineSha") == BASELINE and
            receipt.get("candidateSha") == CANDIDATE and
            receipt.get("actions") == RUN and
            receipt.get("originalArchiveSHA256") == PREVIOUS and
            receipt.get("sourceSHA256") == HISTORICAL_SOURCE_SHA256 and
            receipt.get("nativeComparison") == "fullpath/report.json" and
            receipt.get("newCpuWorkloads") == "donor-upgrade-workload.json",
            "RTX005 final receipt identity mismatch")

    report = json.loads(content["fullpath/report.json"])
    require(type(report) is dict and report.get("schemaVersion") == 1 and
            report.get("kind") ==
            "qsol.vanillajs.rtx5060ti.trusted-comparison.v1" and
            report["baseline"]["sha"] == BASELINE and
            report["candidate"]["sha"] == CANDIDATE,
            "RTX005 native comparison source drift")
    environment = report["environment"]
    renderer = environment["nativeWebGL"]["renderer"]
    require(environment["gpu"]["verifiedModel"] == "NVIDIA GeForce RTX 5060 Ti"
            and environment["gpu"]["driverVersion"] == "595.99.02" and
            isinstance(renderer, str) and "RTX 5060 Ti" in renderer and
            not re.search(r"swiftshader|software|llvmpipe|lavapipe", renderer, re.I),
            "RTX005 native hardware renderer identity mismatch")
    comparison = report["comparison"]
    protocol = comparison["protocol"]
    require(protocol["warmupPairs"] == 2 and
            protocol["measuredPairs"] == 7 and
            protocol["framesPerAppTrial"] == 240 and
            protocol["pixelFrames"] == [0, 73, 149],
            "RTX005 hardware protocol dimensions drift")
    parity = comparison["pixelParity"]
    require(type(parity) is list and len(parity) == 3 and
            [row["tick"] for row in parity] == [0, 73, 149],
            "RTX005 three native pixel-parity frames missing")
    for row in parity:
        require(type(row["brightPixels"]) is int and row["brightPixels"] > 500 and
                row["width"] == 384 and row["height"] == 256 and
                re.fullmatch(r"[0-9a-f]{64}", row["sha256"]) is not None,
                "RTX005 invalid hardware pixel frame")
    for side in ("baseline", "candidate"):
        require(len(comparison["kernelSamples"][side]) == 7 and
                len(comparison["frameSamples"][side]) == 7 and
                set(comparison["summary"][side]) == NATIVE_METRICS and
                all(type(metric["count"]) is int and metric["count"] == 7 and
                    type(metric["medianMs"]) in (int, float) and
                    math.isfinite(metric["medianMs"]) and metric["medianMs"] >= 0
                    for metric in comparison["summary"][side].values()),
                "RTX005 incomplete native seven-pair observations")

    cpu = json.loads(content["donor-upgrade-workload.json"])
    require(type(cpu) is dict and cpu.get("schemaVersion") == 1 and
            cpu.get("kind") == "qsol.vanillajs.donor-upgrade.cpu.v1" and
            cpu.get("baseline") == BASELINE and
            cpu.get("sourceSHA256") == HISTORICAL_SOURCE_SHA256 and
            cpu.get("protocol") ==
            {"execution": "serial single Node process", "warmups": 2,
             "samples": 7, "gpu": "not measured", "timingGate": False},
            "RTX005 CPU protocol or historical source identity mismatch")
    rows = cpu["workloads"]
    require(type(rows) is list and len(rows) == 2 and
            [x["name"] for x in rows] == list(CPU_NAMES),
            "RTX005 numerical workload membership mismatch")
    for row in rows:
        require(row["medianMs"] == median(row["samplesMs"], row["name"]) and
                re.fullmatch(r"[0-9a-f]{64}", row["sha256"]) is not None,
                "RTX005 numerical median/hash mismatch")
    clock, lead = rows
    require(clock.get("tickCounts") ==
            [[hz, 7200] for hz in REFRESH_RATES] and
            clock.get("roundedTicks") == 3600,
            "RTX005 frame-pacing rate/rounding drift")
    require(type(lead.get("solutions")) is int and lead["solutions"] == 3200 and
            type(lead.get("abstentions")) is int and lead["abstentions"] == 800 and
            type(lead.get("maxRelativeResidual")) in (int, float) and
            math.isfinite(lead["maxRelativeResidual"]) and
            0 <= lead["maxRelativeResidual"] <= 1e-8,
            "RTX005 moving-target workload contract drift")
    return {"candidate": CANDIDATE, "nativePairs": 7,
            "nativePixelFrames": 3, "cpuWorkloads": 2}


def verify_archive(path=ARCHIVE):
    require(stat.S_ISREG(path.lstat().st_mode),
            "RTX005 evidence must be a regular file, not a symlink")
    raw = path.read_bytes()
    require(len(raw) == SIZE and digest(raw) == SHA256,
            "RTX005 immutable ZIP length/SHA-256 mismatch")
    blob = hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()
    require(blob == GIT_BLOB, "RTX005 immutable Git blob SHA-1 mismatch")
    return verify_zip(raw)


if __name__ == "__main__":
    try:
        print("PASS RTX5060TI-005", verify_archive())
    except (OSError, ValueError, KeyError, TypeError, UnicodeError,
            zipfile.BadZipFile) as exc:
        print("FAIL RTX5060TI-005: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
