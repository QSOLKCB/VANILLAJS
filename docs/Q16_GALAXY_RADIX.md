# Q16-GALAXY-RADIX-001 — exact radix-65536 arithmetic

## Scope and provenance

This is an independent optimization of VANILLAJS's own Q16.16 code at merged PR #46
(base commit 199ee112d5f54c640cdd06dec352c4b1c9f6ee7e).
The GALAXY project's retro integer-angle work, sampled numerical oracles,
flat-data architecture and before/after reproducibility strategy informed the
design discipline. No GALAXY simulation kernels, astrophysics, old game source,
or third-party arithmetic code is transplanted.

The existing public API, Q16.16 scale, signed truncation, overflow exceptions,
RNG, vector BigInt outputs, world snapshots and replay contracts are unchanged.
No dependency, Wasm, GPU backend or native runtime is added.

## Kernel

1. For products within Number.MAX_SAFE_INTEGER, multiply exactly. The
   mathematically exact integer remainder provides an exact multiple of the
   denominator; dividing that multiple yields an exact integer quotient.
   The signed int32 bounds are checked before returning.
2. For wider products, form two unsigned uint32 words using the pre-existing
   independently authored 16x16 partial-product identity. Feed four 16-bit
   digits through high-radix long division.
3. After each digit, the remainder is strictly smaller than a positive divisor
   at most 2^31. Therefore the next expanded remainder is < 2^47; both
   it and all candidate digit-product comparisons are exact IEEE-754 integers.
   Floating division merely estimates a digit in 0..65535. Adjacent exact
   comparisons adjust it until the defining floor inequality holds.
4. Reject nonzero high quotient digits, check the lower 32-bit result against
   the sign-specific int32 limit, and normalize negative zero.
5. For sqrt, use Math.sqrt only as an estimate. Check and correct the candidate
   until root^2 <= value*65536 < (root+1)^2. The radicand is < 2^47 and
   trial squares are < 2^48, so the final inequalities are exact.

All outputs are exact mathematical integers for admitted inputs even though
intermediate digit guesses use floating operations. This is not a claim that
every JavaScript engine executes specific CPU integer instructions.

## Validation

Run:

    node --test tests/q16-radix.test.js
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-integer.js --check
    node scripts/q16-radix-workload.js 80000

The benchmark embeds the specific merged-PR-46 before-state, warms both paths,
alternates five pairs, refuses checksum drift and reports median timings.
Microbenchmark speedups are runtime/workload-specific, not a blanket
game-engine, GPU, CUDA or rendering claim. Revalidate packaged browser
snapshot/replay parity and owner RTX hardware workflows before promotion.

Historical code and commit identities remain intact. The work establishes
this implementation's current provenance, not the origin of older history.
