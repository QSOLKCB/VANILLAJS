# ALIEN-MATH-002 — Explicit rational-to-Q16.16 conversion

**Status: experimental, opt-in authoring adapter.** This addition composes ALIEN-MATH-001 with the existing checked VANILLAJS integer kernel. It does not replace either kernel, alter QFLOAT-001, or change simulation, replay, formal proof, release or RTX evidence.

## API and architecture

- **modules/rational-q16/index.js** exports **quantizeQ16(value, options)** and **rationalFromQ16(raw)**.
- Its only imports are ExactRational from **modules/exact-rational/index.js** and SCALE, INT_MIN, INT_MAX, int32 from **modules/integer-math/index.js**.
- It has zero third-party/runtime dependencies, no DOM, clock, randomness, GPU or WebGL code, and does not import QFloat.
- quantizeQ16 requires a genuine ALIEN-MATH-001 ExactRational and an explicit options object with **exactly** the own data properties **rounding** and **overflow**. Both are mandatory. Unknown or inherited-only properties, getters, symbols, missing fields and incompatible policies fail closed.
- rationalFromQ16 accepts only the existing signed-int32 raw Number contract, canonicalizes negative zero, and returns an immutable exact rational. Nonfinite, fractional, coercible, out-of-range or BigInt raw inputs are rejected.

The Q16.16 scale is 65536, and raw range is **[-2147483648, 2147483647]**, representing real values from **-32768** to **32767.9999847412109375**. A caller provides an exact rational x = n/d, d positive. Conversion first computes exactly t = n × 65536 / d using BigInt, rounds that value under the selected policy, and checks the final rounded integer. Only the accepted raw integer is converted to JavaScript Number; it is always exactly representable.

## Rounding and overflow policies

| Rounding value | Exact behaviour | Ties |
| --- | --- | --- |
| **exact** | Require t to be an integer, otherwise RangeError | None |
| **toward-zero** | Truncate t toward zero, matching QFLOAT input-quantization semantics | None |
| **floor** | Greatest integer not exceeding t | None |
| **ceil** | Least integer not less than t | None |
| **nearest-even** | Nearest integer | Halfway goes to even raw integer |
| **nearest-away** | Nearest integer | Halfway goes away from zero |

The overflow field must be either **reject** or **saturate**. Reject throws RangeError if the rounded result is outside signed-int32 range. Saturate **explicitly clamps the final rounded integer** to an endpoint; it never wraps or silently truncates high bits. The **exact** rounding policy permits only **overflow: reject** because clamping cannot claim exact representability. An inexact value in exact mode is rejected before any range determination.

### Worked examples

The following examples are expressed in Q16 **raw integer units**, not physical metres:

| Exact value | toward-zero | floor | ceil | nearest-even | nearest-away |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1/131072 | 0 | 0 | 1 | 0 | 1 |
| -1/131072 | 0 | -1 | 0 | 0 | -1 |
| 3/131072 | 1 | 1 | 2 | 2 | 2 |
| 5/131072 | 2 | 2 | 3 | 2 | 3 |
| -5/131072 | -2 | -3 | -2 | -2 | -3 |

Authoring **0.1 + 0.1** as exact rationals first, then quantizing toward zero produces raw **13107**. Quantizing each individual **0.1** earlier produces **6553 + 6553 = 13106**. This is an intentional difference in quantization order, not an arithmetic defect.

Example imports and explicit call, using an indented JavaScript block:

    import {parseDecimal} from './modules/exact-rational/index.js';
    import {quantizeQ16, rationalFromQ16} from './modules/rational-q16/index.js';

    const authored = parseDecimal('0.1').add(parseDecimal('0.1'));
    const raw = quantizeQ16(authored,
      {rounding: 'toward-zero', overflow: 'reject'});  // 13107
    const recovered = rationalFromQ16(raw);           // 13107/65536

There is no default rounding mode or overflow policy. No rational is automatically converted by gameplay or browser code.

## Bounds, proofs and limitations

ALIEN-MATH-001 caps the magnitude of each numerator/denominator component at 256 bits. The scaling step adds no more than 16 bits. Quotient, remainder and tie comparisons are exact integers; no tolerance, floating-point estimate or unbounded decimal parser is introduced.

For **successfully converted, non-saturated** values, error measured in raw Q16 units is strictly less than one unit for toward-zero, floor or ceil, at most half a unit for nearest-even or nearest-away, and zero for exact. Saturating conversion has **no such small-error guarantee**. All accepted raw signed-int32 values round-trip through rationalFromQ16 and quantizeQ16 in exact/reject mode; arbitrary rationals need not lie on the Q16 grid.

This is a bounded **authoring-time** conversion only, not an optimization claim, physics proof or source-level ECMAScript refinement theorem. BigInt must not be introduced into a renderer hot path or simulation replay without a separately reviewed change.

## Independent verification and reproducibility

The Python-standard-library script **scripts/alien_math_002_oracle.py** uses **fractions.Fraction**, independently specified integer rounding, and a deterministic 32-bit LCG input generator. It evaluates **37 fixed boundary cases plus 2,048 seeded cases**, each with **six rounding modes × two overflow policies**, for **25,020 ordered observations**.

The frozen **tests/fixtures/alien-math-002-oracle.json** contains the SHA-256 of every canonical ASCII result in order, rather than manually sharing a JavaScript rounding implementation. Each record in the digest stream is numerator/denominator, rounding, overflow and result, separated by vertical bars and terminated with LF. Results are raw integer strings or **inexact**, **overflow**, or **invalid-policy**. Node recomputes that stream from the actual production adapter and compares it with the Python-derived digest. Python does not import or execute the JavaScript module.

The Node tests additionally cover half-step truth tables, upper/lower signed saturation boundaries, malformed policy admission, zero canonicalization, 25,000 signed-int32 raw round-trips and 6,000 exact-rational error-bound trials.

Reproduction from the repository root:

    node --test tests/rational-q16.test.js
    uv run --no-project python scripts/alien_math_002_oracle.py --check
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js

If the reference source intentionally changes after review, regenerate the fixture explicitly with the Python script's **--write** argument, inspect the exact diff, then run **--check**. A failing test must not silently regenerate its expected digest. The hash proves neither machine authenticity nor universal correctness.

Hosted-PR CI, browser checks and any actual GPU execution must be reported separately from local evidence. This implementation requests no self-hosted RTX dispatch.

## Source lineage and attribution

This is newly authored **Apache-2.0** JavaScript built on VANILLAJS's own ALIEN-MATH-001 and signed integer arithmetic. It is not copied from SONIFICATION's MPL-2.0 implementation. Research methods and numerical provenance are informed by:

1. Slade, T. (2026). **SONIFICATION-SPECTRA-001: Traversal Modes, Graph Spectra and D4 Covariant Preservation.** DOI: https://doi.org/10.5281/zenodo.24060930
2. Slade, T. (2026). **MAT-SPEC-010: Final Evidence Freeze and Reproducible Archive of the MAT-SPEC-001–010 Materials Sonification Research Programme.** DOI: https://doi.org/10.5281/zenodo.24062652
3. Slade, T. (2026). **SONIFICATION-FORMAL-001: Source-Pinned Formal Verification and Independent Audit Evidence — Research Milestone 1.** DOI: https://doi.org/10.5281/zenodo.24097287

Existing contracts: **docs/ALIEN_MATH_001.md**, **docs/QFLOAT_001.md**, and **docs/INTEGER_ENGINE.md**. SONIFICATION-FORMAL-001 does **not** establish universal CPython implementation refinement and does not prove JavaScript source-level correspondence. Existing proof work, source-pinned receipts, QFLOAT-001 witness, immutable releases, tags and RTX workflows are preserved.

**Next optional phase:** ALIEN-MATH-003, separate exact interval/geometry predicates, subject to its own scoped PR and verification.
