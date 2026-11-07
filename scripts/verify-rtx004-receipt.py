#!/usr/bin/env python3
"""Offline fail-closed verification of immutable RTX5060TI-004 Git evidence."""
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
ARCHIVE = ROOT / "evidence/RTX5060TI-004/vanillajs-rtx5060ti-bloat-nexus-uff-42347306980-1.zip"
SIZE = 36987
SHA256 = "60596835ed906393c8315ce4455a40b4eef05764f82de40a5bbe9d2244136814"
GIT_BLOB = "47ec60d25a8c1817d48f690e7102be1d845122fa"
HEAD = "05883459a6ffd355c3336a03f1085bb5d8ac5d5f"
BASELINES = {
    "001": "240617e8bc1a935f05eaf75a10531f194f72a173",
    "002": "b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f",
    "003": "3f5518a168652a003e8db9aa6dc0371ddb4782ea",
}
ORIGINALS = {
    "001": "1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8",
    "002": "79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef",
    "003": "2b4377fa147fb951d9a918f94716518865e0696da328140e0ac323556f46b5da",
}
PINS = {
    "vanillajsBase": "4647261445a1128c4e0c1e065f342ac4d2133cff",
    "bloatOps": "6f290dc818759ca49bcdec54b31d738b33c7946f",
    "corpoWars3dV12": "5701949e4ef7047b715db808b777450c3bf49d53",
    "nexus": "ac9ef5ac79008b46be3351c57cab946b93dd37e8",
    "uff": "596cd732df61587aa1a9801cad1ec13483b1347f",
}
# Independently SHA-256-verified from the four source files at the exact
# historical candidate HEAD, 05883459a6ffd355c3336a03f1085bb5d8ac5d5f.
# These are immutable evidence inputs, not hashes of the current checkout.
HISTORICAL_MODULE_SHA256 = {
    "modules/range2d/index.js":
        "a57f4c97337f124c5783bb8070845513ebab60ae479a46e875ad10adf07d3475",
    "modules/integer-replay/index.js":
        "3ecdc82603efe64476f795a8ec8b9b1c74269cfbf09c2e4c7ba8f72c517c622f",
    "modules/nexus-lattice/index.js":
        "1dc251e2ce33eebe2063464a7040bf8b1a4cffb128e1fb649be05018b7df0f8b",
    "modules/orbital-physics/index.js":
        "04001b0d8aca2e6c7b1300ccdeb2c2aa9293a0e6a5bbb254c75613ca209bc134",
}
NAMES = {"NUMERICAL-RECEIPT.json", "SHA256SUMS", "SUMMARY.md",
         "bloat-nexus-uff-workload.json"}
for label in BASELINES:
    NAMES.update({f"baseline-{label}/{name}" for name in
                  ("report.json", "SUMMARY.md", "SHA256SUMS")})
DIMENSIONS = (
    ("axis-range", {"pairs": 32}),
    ("axis-range", {"pairs": 256}),
    ("axis-range", {"pairs": 2048}),
    ("integer-replay", {"ticks": 2048}),
    ("nexus-lattice", {"cells": 6, "rounds": 32}),
    ("nexus-lattice", {"cells": 64, "rounds": 32}),
    ("nexus-lattice", {"cells": 256, "rounds": 32}),
    ("kepler-orbit", {"steps": 512, "dtSeconds": 10}),
)


def require(ok, description):
    if not ok:
        raise ValueError(description)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def sums(raw, expected):
    lines = raw.decode("ascii").splitlines()
    require(len(lines) == len(expected), "checksum manifest cardinality mismatch")
    seen = set()
    for line in lines:
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        require(match is not None, "invalid checksum manifest line")
        digest, name = match.groups()
        require(name in expected and name not in seen,
                "unexpected or duplicate checksum manifest target")
        seen.add(name)
        yield name, digest
    require(seen == expected, "missing checksum manifest target")


def samples(row):
    require(isinstance(row, list) and len(row) == 7 and
            all(type(v) in (int, float) and math.isfinite(v) and v >= 0
                for v in row), "invalid seven-trial sample set")
    return sorted(row)[3]


def verify_zip(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        infos = z.infolist()
        names = [info.filename for info in infos]
        require(len(names) == 13 and len(names) == len(set(names)) and
                set(names) == NAMES, "ZIP membership or duplicate mismatch")
        for info in infos:
            mode = info.external_attr >> 16
            require(not info.is_dir() and not stat.S_ISLNK(mode) and
                    info.file_size <= 1_000_000, "unsafe ZIP member")
        require(z.testzip() is None, "ZIP CRC failure")
        for name, digest in sums(z.read("SHA256SUMS"), NAMES - {"SHA256SUMS"}):
            require(sha(z.read(name)) == digest, "outer ZIP member checksum drift: " + name)
        for label, baseline in BASELINES.items():
            prefix = "baseline-" + label + "/"
            for name, digest in sums(z.read(prefix + "SHA256SUMS"),
                                      {"report.json", "SUMMARY.md"}):
                require(sha(z.read(prefix + name)) == digest,
                        "nested checksum drift: " + label)
            report = json.loads(z.read(prefix + "report.json"))
            require(report.get("schemaVersion") == 1 and
                    report.get("kind") == "qsol.vanillajs.rtx5060ti.trusted-comparison.v1" and
                    report["baseline"]["sha"] == baseline and
                    report["candidate"]["sha"] == HEAD,
                    "historical source identity mismatch: " + label)
            env = report["environment"]
            require(env["gpu"]["verifiedModel"] == "NVIDIA GeForce RTX 5060 Ti" and
                    "RTX 5060 Ti" in env["nativeWebGL"]["renderer"] and
                    not re.search(r"swiftshader|llvmpipe|lavapipe|software",
                                  env["nativeWebGL"]["renderer"], re.I),
                    "native RTX identity mismatch: " + label)
            for side in ("baseline", "candidate"):
                metrics = report["comparison"]["summary"][side]
                require(bool(metrics) and all(type(v["count"]) is int and
                        v["count"] == 7 for v in metrics.values()),
                        "incomplete native comparison: " + label)
        receipt = json.loads(z.read("NUMERICAL-RECEIPT.json"))
        require(receipt.get("schemaVersion") == 1 and
                receipt.get("kind") == "qsol.vanillajs.bloat-nexus-uff.rtx5060ti.followup.v1" and
                receipt.get("status") == "PASS" and receipt.get("candidateSha") == HEAD and
                receipt.get("actions") == {"runId": "42347306980", "attempt": "1"} and
                set(receipt.get("originalArchives", {})) == set(BASELINES),
                "RTX004 final receipt identity mismatch")
        for label, baseline in BASELINES.items():
            require(receipt["originalArchives"][label] ==
                    {"source": baseline, "sha256": ORIGINALS[label]},
                    "frozen ancestor receipt mismatch: " + label)
        require(receipt.get("comparisons") ==
                [f"baseline-{x}/report.json" for x in BASELINES] and
                receipt.get("newCpuWorkloads") == "bloat-nexus-uff-workload.json",
                "receipt payload references drift")
        data = json.loads(z.read("bloat-nexus-uff-workload.json"))
        require(data.get("schemaVersion") == 1 and
                data.get("kind") == "qsol.vanillajs.bloat-nexus-uff.serial-workloads.v1" and
                data.get("sourcePins") == PINS and
                data.get("sourceSHA256") == HISTORICAL_MODULE_SHA256,
                "historical numerical module SHA-256 identity mismatch")
        protocol = data["protocol"]
        require(protocol.get("warmups") == 2 and protocol.get("pairedTrials") == 7 and
                protocol.get("timingGate") is False and protocol.get("gpu") == "not measured" and
                protocol.get("execution") == "serial single Node process",
                "numerical protocol mismatch")
        rows = data["workloads"]
        require(isinstance(rows, list) and len(rows) == len(DIMENSIONS),
                "eight numerical scenarios required")
        for row, (name, dimensions) in zip(rows, DIMENSIONS):
            require(row["name"] == name and all(type(row.get(k)) is int and row[k] == val
                    for k, val in dimensions.items()), "numerical scenario dimensions changed")
            if name == "axis-range":
                require(type(row.get("axisRejected")) is int and
                        0 <= row["axisRejected"] <= row["pairs"] and
                        re.fullmatch(r"[0-9a-f]{64}", row["sha256"]) is not None,
                        "invalid range parity record")
                require(set(row["strategies"]) == {"reference", "candidate"},
                        "missing paired range strategies")
                for strategy in row["strategies"].values():
                    require(strategy["medianMs"] == samples(strategy["samplesMs"]),
                            "range median mismatch")
            else:
                require(row["medianMs"] == samples(row["samplesMs"]),
                        "numerical median mismatch")
            if name == "integer-replay":
                require(row.get("complete") is True and
                        re.fullmatch(r"[0-9a-f]{8}", row["digest"]) is not None,
                        "incomplete integer replay")
            elif name == "nexus-lattice":
                require(row["inverseMismatches"] == 0 and
                        re.fullmatch(r"[0-9a-f]{64}", row["sha256"]) is not None,
                        "lattice inverse/state mismatch")
            elif name == "kepler-orbit":
                require(type(row["maxRelativeEnergyDrift"]) in (float, int) and
                        math.isfinite(row["maxRelativeEnergyDrift"]) and
                        0 <= row["maxRelativeEnergyDrift"] < 1e-7 and
                        len(row["finalPosition"]) == 3 and
                        all(type(x) in (float, int) and math.isfinite(x)
                            for x in row["finalPosition"]),
                        "invalid orbital diagnostic")
        return {"candidate": HEAD, "samples": 7, "scenarios": 8}


def verify_archive(path=ARCHIVE):
    require(stat.S_ISREG(path.lstat().st_mode), "archive must be a regular file")
    raw = path.read_bytes()
    require(len(raw) == SIZE and sha(raw) == SHA256,
            "immutable RTX004 SHA-256/size mismatch")
    blob = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
    require(blob == GIT_BLOB, "RTX004 Git blob SHA-1 mismatch")
    return verify_zip(raw)


if __name__ == "__main__":
    try:
        print("PASS RTX5060TI-004", verify_archive())
    except (OSError, ValueError, KeyError, TypeError, UnicodeError, zipfile.BadZipFile) as exc:
        print("FAIL RTX5060TI-004: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
