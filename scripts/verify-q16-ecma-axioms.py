#!/usr/bin/env python3
"""Strict Q16ECMA five-theorem axiom report audit. Standard library only."""
from __future__ import annotations

import re
import sys
from pathlib import Path

EXPECTED = (
    "uint32Word_bounds", "int32Word_bounds",
    "uint32Word_checked_identity", "int32Word_checked_identity",
    "out_of_checked_domain_wraps",
)
ALLOWED = frozenset({"propext", "Quot.sound"})
LINE = re.compile(
    r"^'Q16ECMA\.([A-Za-z_]\w*)' "
    r"(?:does not depend on any axioms|depends on axioms: \[([^\]]*)\])$"
)


def verify(text: str) -> dict[str, frozenset[str]]:
    seen: dict[str, frozenset[str]] = {}
    for row in text.splitlines():
        if not row.startswith("'Q16ECMA."):
            continue
        match = LINE.fullmatch(row.strip())
        if match is None:
            raise ValueError("malformed or partial Lean axiom line")
        name, listed = match.groups()
        if name not in EXPECTED or name in seen:
            raise ValueError("unknown or repeated Q16ECMA theorem")
        found = frozenset(a.strip() for a in listed.split(",")) if listed else frozenset()
        if not found <= ALLOWED:
            raise ValueError("unexpected Lean axiom: " + repr(sorted(found - ALLOWED)))
        seen[name] = found
    if set(seen) != set(EXPECTED):
        raise ValueError("missing Q16ECMA axiom records")
    return seen


def negative_controls() -> None:
    good = "\n".join(
        f"'Q16ECMA.{x}' does not depend on any axioms" for x in EXPECTED
    )
    assert len(verify(good)) == len(EXPECTED)
    bad = [
        good.replace(
            f"'Q16ECMA.{EXPECTED[0]}' does not depend on any axioms",
            f"'Q16ECMA.{EXPECTED[0]}' depends on axioms: [sorryAx]",
        ),
        good.replace(f"'Q16ECMA.{EXPECTED[0]}' does not depend on any axioms", ""),
        good + "\n" + good.splitlines()[0],
        good + "\n'Q16ECMA.unknown' does not depend on any axioms",
        good + "\n'Q16ECMA.corrupt' depends on axioms: [",
    ]
    for report in bad:
        try:
            verify(report)
        except ValueError:
            continue
        raise AssertionError("axiom audit missed injected malformed evidence")


def main() -> int:
    negative_controls()
    if len(sys.argv) != 2:
        raise SystemExit("usage: verify-q16-ecma-axioms.py audit-file.txt")
    findings = verify(Path(sys.argv[1]).read_text(encoding="utf-8"))
    print(f"Q16ECMA checked axiom records: {len(findings)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
