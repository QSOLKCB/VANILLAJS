# Q16-INDEPENDENT-001 — independently designed Q16.16 arithmetic

## Purpose and historical record

This pull request replaces the implementation of the existing VANILLAJS
signed 32-bit Q16.16 scalar arithmetic and rewrites its vector operators.
It does not erase previous Git history or claim that a new implementation
settles allegations about old code. All previous commits and archives remain
readable.

Exact baseline: VANILLAJS main commit
4dc0f1dd4e6e29320b5680927ed8b3dac3eb458a.

Historical Git blob identities:
- modules/integer-math/index.js — cf32e6e806304c1c20abd709ea6c40d0f71e786a
- modules/integer-vector/index.js — d2e5175f4ca5ecc46bcc775721de5c319d4add84

The implementation was designed from its existing public arithmetic contract
and elementary integer identities. It does not derive from third-party game
source, proprietary binaries, REA, or a claimed competing codebase.
The historical references remain available for independent inspection.
This new implementation demonstrates current engineering work; it does
not establish the origin of historical commits or automatically resolve
copyright or attribution disputes.

## Required compatibility

- Signed int32 input/result, 65,536 subunits per metre.
- Addition and subtraction reject out-of-range results.
- Exact truncation toward zero of (a * b) / divisor, nonzero divisor
  and checked signed int32 final quotient.
- No saturation, modulo wraparound, negative-infinity right-shift rounding
  or floating-point approximation in scalar division.
- Fixed multiplication and division derive from the scale of 65,536.
- Integer square root is the floor of sqrt(value * 65,536).
- The uint32 LCG remains the sole explicitly wrapping arithmetic path.
- Signed zero is normalized, sparse vectors and invalid numbers rejected.
- Exact BigInt raw vector outputs remain BigInt by public API contract.
  Other widened/narrowed vector operations retain once-only rounding.

## Independent implementation

### Unsigned 16-bit limb multiplication

Convert both signed operands to their nonnegative magnitudes (at most
2^31). Split into base-65536 high/low digits. Evaluate the four 16x16
partial products, propagate carries and form exact high and low uint32
words representing the widened product. All intermediate partials are
less than 2^53 and exactly representable in JavaScript Number.

### Signed quotient without imprecise 64-bit Number

Divide the two-word unsigned product by the positive divisor magnitude.
Scan 64 product bits from most to least significant, maintaining a
remainder below the divisor. Twice the remainder plus a bit is at most
2^32-1, so it is exactly representable. Flag any quotient bits above
bit 31, accumulate the low 32 quotient bits, and reject results outside
the sign-dependent int32 bounds. Apply the sign after range checking
and canonicalize zero.

This is elementary binary long division. It does not copy or emulate
Doom fixed arithmetic overflow or saturation behaviour.

### Exact scaled integer square root

The scaled radicand is below 2^47. Binary search for the integer root
within 0..2^24, comparing exact integer squares below 2^48. No floating
square root or hidden fractional state enters the authoritative result.

### Vector operations

The exact multi-axis raw dot, cross, squared length and distance
operators keep BigInt because their return type may require values
outside Number's 53-bit integer precision. The rational vector
scaling operation uses the new scalar limb division. Vector lerp
instead uses an exact Number product (endpoint difference below 2^32
times a fraction at most 2^16, yielding below 2^48) and rounds once
toward zero, matching the original documented contract.

## Verification and interpretation

Tests use a separately written mathematical BigInt referee ONLY in the
test harness; the scalar production multiplication/division kernel uses
no BigInt.

New tests cover exhaustive signed/range boundary combinations, 50,000
seeded full-range quotient triples, 8,192 widened vector comparisons,
integer square-root bracketing, original RNG reference values, invalid
inputs, overflow, negative signs and negative zero. Existing Integer
Foundry simulation snapshots and replay evidence remain unchanged and
must pass their source-pinned verifiers and packaged browser checks.

Commands:

    node --test tests/q16-independent.test.js
    node --test tests/integer-math.test.js tests/integer-vector.test.js
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-integer.js --check

No performance gain is claimed without paired measurements. This new
implementation may be faster or slower than the previous BigInt code
depending on the runtime and workload. Existing archived RTX receipts,
FreeDM evidence, public release tags and PR #45 are not modified.

Source history plus passing deterministic tests can establish this
implementation's behaviour and development lineage, but cannot
retroactively prove or disprove the origin of historical work.
