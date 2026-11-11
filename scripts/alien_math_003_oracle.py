#!/usr/bin/env python3
"""Independent Fraction oracle for ALIEN-MATH-003 (Python stdlib only).

SPDX-License-Identifier: Apache-2.0
Does not import or execute VANILLAJS JavaScript production code.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from fractions import Fraction as F
from pathlib import Path

SEED = 0x3177653D
GENERATED = 2048
FIXED = (
    (0, 0, 4, 4, 0, 4, 4, 0),
    (0, 0, 2, 2, 2, 2, 3, 0),
    (0, 0, 4, 0, 2, 0, 6, 0),
    (1, 1, 1, 5, 1, 4, 1, 2),
    (0, 0, 1, 1, 2, 2, 3, 3),
    (0, 0, 2, 0, 0, 1, 2, 1),
    (0, 0, 0, 0, 0, 0, 0, 0),
    (0, 0, 0, 0, 1, 1, 1, 1),
    (1, 1, 1, 1, 0, 0, 2, 2),
    (2, 3, 2, 3, 0, 0, 2, 2),
    (0, 0, 4, 0, 2, 0, 2, 2),
    (0, 0, 2, 2, 0, 2, 2, 0),
    (0, 0, 2, 0, 2, 0, 4, 0),
    (0, 0, 2, 2, 2, 0, 4, 2),
    (0, 0, 3, 3, 1, 1, 2, 2),
    (0, 0, 2, 0, 2, 0, 2, 0),
    (0, 0, 2, 2, 1, 0, 3, 2),
    (0, 0, 1, 1, 2, 2, 4, 4),
)


def cases():
    for row in FIXED:
        yield tuple((F(row[j]), F(row[j + 1])) for j in range(0, 8, 2))
    state = SEED

    def next_u32():
        nonlocal state
        state = (1664525 * state + 1013904223) & 0xFFFFFFFF
        return state

    def point():
        return (F(next_u32() % 81 - 40, next_u32() % 13 + 1),
                F(next_u32() % 81 - 40, next_u32() % 13 + 1))

    def shift(p, dx, dy):
        return (p[0] + dx, p[1] + dy)

    for i in range(GENERATED):
        a, b, c, d = (point() for _ in range(4))
        pattern = i % 10
        if pattern == 0:
            b = a
        elif pattern == 1:
            d = c
        elif pattern == 2:
            c = b
        elif pattern == 3:
            b, c, d = shift(a, 1, 1), shift(a, 2, 2), shift(a, 3, 3)
        elif pattern == 4:
            b, c, d = shift(a, 3, 3), shift(a, 1, 1), shift(a, 4, 4)
        elif pattern == 5:
            b, c, d = shift(a, 2, 2), shift(a, 0, 2), shift(a, 2, 0)
        elif pattern == 6:
            b, c, d = shift(a, 0, 2), shift(a, 0, 2), shift(a, 0, 3)
        elif pattern == 7:
            b, d = a, c
        elif pattern == 8:
            b, c, d = shift(a, 4, 0), shift(a, 2, -1), shift(a, 2, 1)
        yield a, b, c, d


def sign(value):
    return (value > 0) - (value < 0)


def orientation(a, b, c):
    return sign((b[0] - a[0]) * (c[1] - a[1]) -
                (b[1] - a[1]) * (c[0] - a[0]))


def on_segment(p, a, b):
    return orientation(a, b, p) == 0 and all(
        min(a[axis], b[axis]) <= p[axis] <= max(a[axis], b[axis])
        for axis in range(2)
    )


def segment_relation(a, b, c, d):
    if a == b:
        return "touch" if on_segment(a, c, d) else "disjoint"
    if c == d:
        return "touch" if on_segment(c, a, b) else "disjoint"
    o = (orientation(a, b, c), orientation(a, b, d),
         orientation(c, d, a), orientation(c, d, b))
    if all(v == 0 for v in o):
        axis = 0 if a[0] != b[0] else 1
        lo = max(min(a[axis], b[axis]), min(c[axis], d[axis]))
        hi = min(max(a[axis], b[axis]), max(c[axis], d[axis]))
        return "disjoint" if lo > hi else "touch" if lo == hi else "overlap"
    if any((
        o[0] == 0 and on_segment(c, a, b),
        o[1] == 0 and on_segment(d, a, b),
        o[2] == 0 and on_segment(a, c, d),
        o[3] == 0 and on_segment(b, c, d),
    )):
        return "touch"
    return "cross" if o[0] * o[1] < 0 and o[2] * o[3] < 0 else "disjoint"


def interval_relation(a, b):
    return "a_below_b" if a[1] < b[0] else "b_below_a" if b[1] < a[0] else "overlap"


def box_relation(a, b, c, d):
    singleton = []
    for axis in range(2):
        lo = max(min(a[axis], b[axis]), min(c[axis], d[axis]))
        hi = min(max(a[axis], b[axis]), max(c[axis], d[axis]))
        if lo > hi:
            return "disjoint"
        singleton.append(lo == hi)
    return "touch" if any(singleton) else "overlap"


def build():
    digest = hashlib.sha256()
    segments, boxes, intervals = Counter(), Counter(), Counter()
    observations = 0
    for index, (a, b, c, d) in enumerate(cases()):
        x1 = (min(a[0], b[0]), max(a[0], b[0]))
        x2 = (min(c[0], d[0]), max(c[0], d[0]))
        relation = interval_relation(x1, x2)
        intersection = ("[" + str(max(x1[0], x2[0])) + "," +
                        str(min(x1[1], x2[1])) + "]") if relation == "overlap" else "null"
        ori = orientation(a, b, c)
        on = "1" if on_segment(c, a, b) else "0"
        segment = segment_relation(a, b, c, d)
        box = box_relation(a, b, c, d)
        row = [str(index), *(str(coord) for p in (a, b, c, d) for coord in p),
               relation, intersection, str(ori), on, segment, box]
        digest.update(("|".join(row) + "\n").encode("ascii"))
        observations += 1
        segments[segment] += 1
        boxes[box] += 1
        intervals[relation] += 1
    summary = {
        "schema": "qsol.alien-math-003.fraction-oracle.v1",
        "oracle": "CPython fractions.Fraction, independent geometric predicates",
        "seed": f"0x{SEED:08x}",
        "fixed_cases": len(FIXED),
        "generated_cases": GENERATED,
        "observations": observations,
        "sha256": digest.hexdigest(),
        "segment_counts": dict(sorted(segments.items())),
        "box_counts": dict(sorted(boxes.items())),
        "interval_counts": dict(sorted(intervals.items())),
    }
    return (json.dumps(summary, indent=2, sort_keys=True, ensure_ascii=True) + "\n").encode("ascii")


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    path = Path(__file__).resolve().parent.parent / "tests/fixtures/alien-math-003-oracle.json"
    expected = build()
    if args.write:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(expected)
    elif path.read_bytes() != expected:
        raise SystemExit("FAIL: ALIEN-MATH-003 Fraction fixture mismatch")
    print(f"PASS: ALIEN-MATH-003 Fraction oracle, {len(FIXED) + GENERATED} cases")


if __name__ == "__main__":
    main()
