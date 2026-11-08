#!/usr/bin/env python3
"""Fail closed on theorem inventory drift or unchecked proof escapes."""
from pathlib import Path
import re

proof = Path("Q16Formal.lean").read_text(encoding="utf-8")
audit = Path("Q16Audit.lean").read_text(encoding="utf-8")
expected = [
    "corrected_digit_is_quotient", "quotient_certificate_sound",
    "radix_digit_lt", "radix_step_decomposition",
    "radix_step_remainder_bounded", "radix_prefix_invariant",
    "exact_safe_product_path", "checked_magnitude_within_int32",
    "zero_is_canonical", "sign_asymmetry",
    "expanded_remainder_lt_2pow47", "trial_product_lt_2pow47",
    "scaled_radicand_lt_2pow47", "sqrt_certificate_is_bracket"
]
clean = re.sub(r"/-.*?-/", "", proof, flags=re.S)
clean = re.sub(r"--[^\n]*", "", clean)
if re.search(r"\b(?:sorry|admit|axiom|unsafe|native_decide)\b", clean):
    raise SystemExit("Unchecked proof escape found in Q16Formal")
observed = re.findall(r"\btheorem\s+([A-Za-z_]\w*)", clean)
if observed != expected:
    raise SystemExit(f"Theorem inventory drift: {observed!r}")
for theorem in expected:
    for prefix in ("#check", "#print axioms"):
        entry = f"{prefix} Q16Formal.{theorem}"
        if audit.count(entry) != 1:
            raise SystemExit(f"Missing or duplicate audit entry: {entry}")
if len(re.findall(r"#check Q16Formal\.", audit)) != len(expected):
    raise SystemExit("Unexpected #check inventory")
if len(re.findall(r"#print axioms Q16Formal\.", audit)) != len(expected):
    raise SystemExit("Incomplete axiom audit")
print(f"Q16-FORMAL-001 static inventory PASS: {len(expected)} named theorems")
