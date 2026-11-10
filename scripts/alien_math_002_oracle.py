#!/usr/bin/env python3
"""Independent stdlib fractions.Fraction oracle for ALIEN-MATH-002.

SPDX-License-Identifier: Apache-2.0
Only the SHA-256 commitment to all ordered input/outcome rows is checked in Node.
No JavaScript module is read or executed by this generator.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from fractions import Fraction
from pathlib import Path

SCALE = 65536
MIN_RAW, MAX_RAW = -(2**31), 2**31 - 1
SEED = 0x6A09E667
GENERATED = 2048
MODES = ("exact", "toward-zero", "floor", "ceil", "nearest-even", "nearest-away")
OVERFLOWS = ("reject", "saturate")
MAX = (1 << 256) - 1
FIXED = (
    (0, 1), (1, 10), (-1, 10), (3, 10), (-3, 10),
    (1, 3), (-1, 3), (1, 7), (-1, 7),
    (1, 131072), (-1, 131072), (3, 131072), (-3, 131072),
    (5, 131072), (-5, 131072), (1, 65536), (-1, 65536),
    (MAX_RAW, SCALE), (MIN_RAW, SCALE), (MAX_RAW + 1, SCALE),
    (MIN_RAW - 1, SCALE), (2 * MAX_RAW + 1, 131072),
    (2 * MAX_RAW + 2, 131072), (2 * MIN_RAW - 1, 131072),
    (2 * MIN_RAW - 2, 131072), (1, MAX), (MAX, 1), (-MAX, 1),
    (MAX, MAX), (1 << 255, MAX), (-(1 << 255), MAX),
    (1, 1 << 18), (1, 1 << 17), (1, 1 << 16), (1, 1 << 15),
    (0, MAX), (100000000000000001, 100000000000000000),
)


def inputs():
    yield from FIXED
    state = SEED

    def next_u32():
        nonlocal state
        state = (1664525 * state + 1013904223) & 0xFFFFFFFF
        return state

    for i in range(GENERATED):
        a, b = next_u32(), next_u32()
        bucket = i % 4
        if bucket == 0:
            yield a % 200000001 - 100000000, b % 100000000 + 1
        elif bucket == 1:
            d = b % 4096 + 1
            yield MAX_RAW * d + a % 7 - 3, SCALE * d
        elif bucket == 2:
            d = b % 4096 + 1
            yield MIN_RAW * d + a % 7 - 3, SCALE * d
        else:
            yield a % 21 - 10, 131072


def expected(value: Fraction, rounding: str, overflow: str) -> str:
    if rounding == "exact" and overflow == "saturate":
        return "invalid-policy"
    scaled = value * SCALE
    if rounding == "exact":
        if scaled.denominator != 1:
            return "inexact"
        output = scaled.numerator
    elif rounding == "toward-zero":
        output = int(scaled)
    elif rounding == "floor":
        output = scaled.numerator // scaled.denominator
    elif rounding == "ceil":
        output = -((-scaled.numerator) // scaled.denominator)
    elif rounding == "nearest-even":
        output = round(scaled)  # fractions.Fraction.__round__: nearest, ties to even
    elif rounding == "nearest-away":
        magnitude = abs(scaled)
        half_up = (magnitude.numerator * 2 + magnitude.denominator) // (2 * magnitude.denominator)
        output = -half_up if scaled < 0 else half_up
    else:
        raise AssertionError("unknown oracle rounding mode")

    if not MIN_RAW <= output <= MAX_RAW:
        if overflow == "reject":
            return "overflow"
        return str(MIN_RAW if output < MIN_RAW else MAX_RAW)
    return str(output)


def build() -> bytes:
    digest = hashlib.sha256()
    count = 0
    for numerator, denominator in inputs():
        value = Fraction(numerator, denominator)
        for rounding in MODES:
            for overflow in OVERFLOWS:
                outcome = expected(value, rounding, overflow)
                line = f"{numerator}/{denominator}|{rounding}|{overflow}|{outcome}\n"
                digest.update(line.encode("ascii"))
                count += 1
    summary = {
        "schema": "qsol.alien-math-002.fraction-oracle.v1",
        "oracle": "CPython fractions.Fraction with independently specified rounding",
        "seed": f"0x{SEED:08x}",
        "fixed_cases": len(FIXED),
        "generated_cases": GENERATED,
        "observations": count,
        "sha256": digest.hexdigest(),
    }
    return (json.dumps(summary, indent=2, sort_keys=True) + "\n").encode("ascii")


def main() -> None:
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--write", action="store_true")
    action.add_argument("--check", action="store_true")
    options = parser.parse_args()
    path = Path(__file__).resolve().parent.parent / "tests/fixtures/alien-math-002-oracle.json"
    expected_bytes = build()
    if options.write:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(expected_bytes)
    elif path.read_bytes() != expected_bytes:
        raise SystemExit("FAIL: independent Fraction oracle SHA-256 commitment mismatch")
    print(f"PASS: Fraction oracle, {(len(FIXED) + GENERATED)} inputs x {len(MODES) * len(OVERFLOWS)} policies")


if __name__ == "__main__":
    main()
