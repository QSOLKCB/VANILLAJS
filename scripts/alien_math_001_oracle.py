#!/usr/bin/env python3
"""Independent, offline Fraction vectors for ALIEN-MATH-001 (Python stdlib only).

SPDX-License-Identifier: Apache-2.0
This generates test data but is never imported by VANILLAJS's browser runtime.
"""

from __future__ import annotations

import argparse
import json
from fractions import Fraction
from pathlib import Path

CASES = (
    ("0.1", "0.2"),
    ("-0.3", "1.200"),
    ("-0.00", "0.000001"),
    ("999999999999999999.999999999999999999", "-0.000000000000000001"),
    ("0.000000000000000001", "0.000000000000000002"),
    ("1", "0"),
    ("0", "0"),
    ("-5", "-7"),
    ("-12345678.9", "98765432.1"),
    ("12.125", "-0.008"),
    ("2.5", "-3.75"),
    ("-32768", "32767.9999847412109375"),
    ("1.000000000000000001", "1.000000000000000000"),
    ("0.125", "0.375"),
    ("1", "3"),
    ("-0", "-0"),
)


def build() -> bytes:
    rows = []
    for left, right in CASES:
        a, b = Fraction(left), Fraction(right)
        rows.append({
            "a": left,
            "b": right,
            "add": str(a + b),
            "subtract": str(a - b),
            "multiply": str(a * b),
            "divide": str(a / b) if b else None,
            "compare": (a > b) - (a < b),
        })
    return (json.dumps({
        "schema": "qsol.alien-math-001.oracle.v1",
        "oracle": "CPython fractions.Fraction",
        "cases": rows,
    }, indent=2, sort_keys=True, ensure_ascii=True) + "\n").encode("ascii")


def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    path = Path(__file__).resolve().parent.parent / "tests/fixtures/alien-math-001-vectors.json"
    expected = build()
    if args.write:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(expected)
    elif path.read_bytes() != expected:
        raise SystemExit("FAIL: independent oracle fixture mismatch")
    print(f"PASS: {len(CASES)} independently computed rational pairs")


if __name__ == "__main__":
    main()
