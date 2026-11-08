#!/usr/bin/env python3
"""Exact 14-theorem transitive axiom audit; standard library only."""
from pathlib import Path
import re
import sys

EXPECTED = [
    "corrected_digit_is_quotient", "quotient_certificate_sound",
    "radix_digit_lt", "radix_step_decomposition",
    "radix_step_remainder_bounded", "radix_prefix_invariant",
    "exact_safe_product_path", "checked_magnitude_within_int32",
    "zero_is_canonical", "sign_asymmetry",
    "expanded_remainder_lt_2pow47", "trial_product_lt_2pow47",
    "scaled_radicand_lt_2pow47", "sqrt_certificate_is_bracket"
]
ALLOWLIST = {"propext", "Quot.sound"}
PATTERN = re.compile(
    r"^'Q16Formal\.([A-Za-z_]\w*)' "
    r"(?:does not depend on any axioms|depends on axioms: \[([^\]]*)\])$"
)

def verify(report: str) -> dict[str, frozenset[str]]:
    seen: dict[str, frozenset[str]] = {}
    for raw in report.splitlines():
        if not raw.startswith("'Q16Formal."):
            continue
        match = PATTERN.fullmatch(raw.strip())
        if not match:
            raise ValueError("unrecognized or partial Q16 axiom record")
        name, axioms = match.groups()
        if name not in EXPECTED or name in seen:
            raise ValueError("unknown or duplicate audited theorem: " + name)
        current = frozenset(x.strip() for x in axioms.split(",")) if axioms else frozenset()
        if not current <= ALLOWLIST:
            raise ValueError("unapproved axiom: " + repr(sorted(current - ALLOWLIST)))
        seen[name] = current
    if set(seen) != set(EXPECTED) or len(seen) != len(EXPECTED):
        raise ValueError("incomplete theorem/axiom inventory")
    return seen

def negative_controls() -> None:
    good = "\n".join(f"'Q16Formal.{name}' does not depend on any axioms"
                     for name in EXPECTED)
    assert len(verify(good)) == len(EXPECTED)
    bad = [
        good.replace("'Q16Formal.corrected_digit_is_quotient' does not depend on any axioms",
                     "'Q16Formal.corrected_digit_is_quotient' depends on axioms: [sorryAx]"),
        good.replace("'Q16Formal.corrected_digit_is_quotient' does not depend on any axioms", ""),
        good + "\n'Q16Formal.corrected_digit_is_quotient' does not depend on any axioms",
        good + "\n'Q16Formal.unexpected' depends on axioms: [propext]",
        good + "\n'Q16Formal.unexpected' depends on axioms: [",
    ]
    for case in bad:
        try:
            verify(case)
        except ValueError:
            continue
        raise AssertionError("failed to reject adversarial audit report")

if __name__ == "__main__":
    negative_controls()
    if len(sys.argv) != 2:
        raise SystemExit("usage: verify-q16-axioms.py q16-axiom-audit.txt")
    results = verify(Path(sys.argv[1]).read_text(encoding="utf-8"))
    print(f"Lean Q16 axiom audit PASS: {len(results)} theorems; allowed axioms " +
          ", ".join(sorted(set().union(*results.values()))))
