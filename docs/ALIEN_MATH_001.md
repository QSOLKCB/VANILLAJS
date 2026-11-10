# ALIEN-MATH-001 — bounded exact rational authoring

**Status: experimental standalone module.** This is independently authored JavaScript arithmetic, not a new Q16.16 simulation backend, a performance improvement, a physical model, or a formal source-refinement theorem.

## Purpose and numerical boundary

VANILLAJS already has integer-owned QFLOAT-001: it parses decimal strings exactly and then deliberately quantizes into signed 32-bit Q16.16. ALIEN-MATH-001 instead retains the exact mathematical rational represented by a decimal string **before** any conversion or rounding. It does not import QFloat, integer-math, browser globals, remote resources, third-party packages, or a clock.

Example (the names are exported by **modules/exact-rational/index.js**):

    const a = parseDecimal('0.1');
    const b = parseDecimal('0.2');
    a.add(b).toString();       // '3/10'
    a.add(b).toDecimalExact(); // '0.3'

For comparison, adding the separately Q16.16-quantized QFloat inputs gives raw integer 19660 and exact fixed-point spelling 0.2999877929687500. Both results are correct under their distinct numerical contracts.

## Exact contract

| Subject | Contract |
| --- | --- |
| Module | modules/exact-rational/index.js; pure native ES module; zero imports |
| Constructor | new ExactRational(numerator, denominator = 1n) |
| Component inputs | Primitive bigint or integral safe JavaScript Number (converted exactly) |
| Bounds | The **absolute value of each supplied component** is at most 2^256 - 1, checked before normalization |
| Representation | Private, immutable, reduced signed numerator/positive denominator; gcd(abs(n),d)=1; zero is 0/1 |
| Decimal syntax | parseDecimal accepts optional minus; whole part 0 or nonzero-leading 1–18 ASCII digits; optional dot with 1–18 ASCII fractional digits |
| Rejections | No leading plus, leading zeros except 0, exponent, whitespace, bare dot, more digits, or non-primitive string |
| Normalization | Negative zero and trailing decimal zeros accepted as input but normalized as rational values |
| Operations | add, subtract, multiply, divide, negate, abs, compare; exact BigInt arithmetic; divide by zero rejected |
| Ordering | compare returns -1, 0, or 1 using cross-product integer comparisons |
| Result bounds | Throw RangeError when canonical reduced result exceeds the numerator/denominator cap; never round, wrap or saturate |
| toString | Reduced numerator/denominator when needed, otherwise the integer alone |
| toDecimalExact | Returns minimal decimal spelling only for terminating expansions requiring no more than 18 fractional places; otherwise RangeError |
| toJSON | Versioned record {kind:'qsol.exact-rational.v1',numerator:'n',denominator:'d'} with integer strings |
| fromJSON | Requires exactly three own data properties, known kind, canonical reduced signed integer strings, and strictly positive denominator |
| Mutability | Frozen instances with private fields, no subclass construction |
| Coercion | Numeric primitive conversion throws TypeError; string conversion is exact rational text |
| Failure | Malformed input/type/JSON: TypeError; division by zero, overflow and decimal precision: RangeError |

Input lengths and component sizes are bounded, and arithmetic products have at most approximately 512-bit intermediate magnitudes. This is a **resource bound**, not a real-time or constant-time guarantee. Hostile Proxy side effects and cross-realm object acceptance are outside the plain-value input domain. Exact rational arithmetic does not establish physical measurement certainty, graph symmetry, or precision of GPU output.

## Reproducible evidence

- **tests/exact-rational.test.js:** input grammar, signed zero, bounds, malformed cases, arithmetic, ordering, canonical JSON, non-coercion, immutable values, and cancellation edge cases.
- **12,000 deterministically seeded pairs:** all four arithmetic operations are independently checked by BigInt cross-product relations; comparison signs and division-by-zero branches are included.
- **scripts/alien_math_001_oracle.py:** a separate Python standard-library generator using fractions.Fraction, with 16 fixed input pairs.
- **tests/fixtures/alien-math-001-vectors.json:** static outputs of that independent Python generator, consumed by Node tests without Python as a runtime dependency.

Reproduce from repository root:

    node --test tests/exact-rational.test.js
    uv run --no-project python scripts/alien_math_001_oracle.py --check
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js

Finite test agreement is **not** a proof of universal ECMAScript implementation refinement. It does not transfer Lean/SPARK proof claims from another implementation. Claims about performance, cross-engine bit identity, physics and formally verified runtime source remain OPEN.

## Source boundaries and citations

The independent design is informed by QSOL-IMC's source-exactness, interval analysis and source-pinning research, rather than copied from an MPL-2.0 SONIFICATION source module.

1. Slade, T. (2026). *SONIFICATION-SPECTRA-001: Traversal Modes, Graph Spectra and D4 Covariant Preservation.* Zenodo. DOI: https://doi.org/10.5281/zenodo.24060930
2. Slade, T. (2026). *MAT-SPEC-010: Final Evidence Freeze and Reproducible Archive of the MAT-SPEC-001–010 Materials Sonification Research Programme.* Zenodo. DOI: https://doi.org/10.5281/zenodo.24062652
3. Slade, T. (2026). *SONIFICATION-FORMAL-001: Source-Pinned Formal Verification and Independent Audit Evidence — Research Milestone 1.* Zenodo. DOI: https://doi.org/10.5281/zenodo.24097287

Source pointers for research review: **QSOLKCB/SONIFICATION/materials/mat_spec.py** (Python Fraction and decimal measurements), **formal/sonification/REFINEMENT.md** (finite source-pinned conformance; universal Python refinement remains OPEN), **docs/SPARK_001.md** (bounded integer-cent arithmetic and proof admission), and **QSOLKCB/VANILLAJS/docs/QFLOAT_001.md** (separate existing Q16.16 quantization/RTX witness).

This implementation is newly authored Apache-2.0 code, not a port of SONIFICATION's MPL-2.0 implementation. No changes are made to existing numeric proofs, QFLOAT-001, archived research witnesses, existing releases, action runner configuration, or simulation code.

## Next phase (not included)

ALIEN-MATH-002 may define an **explicit** rational-to-Q16.16 conversion with specified rounding, saturation/overflow policy and independent oracle tests. Until reviewed, this module must not be inserted into per-frame simulation, WebGL hot paths or deterministic replay. No such conversion is exposed by ALIEN-MATH-001.
