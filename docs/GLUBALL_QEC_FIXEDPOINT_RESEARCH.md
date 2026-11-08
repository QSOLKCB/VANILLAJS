# GALAXY + GLUBALL + QEC numerical research boundaries

Source baseline: VANILLAJS merged PR #46, commit `199ee112d5f54c640cdd06dec352c4b1c9f6ee7e`.

## Core authoritative arithmetic

`modules/integer-math` remains signed checked Q16.16 throughout game simulation.
The GALAXY-inspired radix-65536 optimization is separately described in
[Q16_GALAXY_RADIX.md](Q16_GALAXY_RADIX.md). It retains exact signed truncation
toward zero, rather than importing right-shift rounding or overflow semantics
from microcontroller examples. Real-world performance is runtime-specific.

Related reading (design context, not code donors):
- DSPRelated: https://www.dsprelated.com/glossary/fixed-point
- Van Hunter Adams: https://vanhunteradams.com/FixedPoint/FixedPoint.html
- Pigweed: https://pigweed.dev/blog/04-fixed-point.html
- Cornell ECE4760: https://people.ece.cornell.edu/land/courses/ece4760/PIC32/index_fixed_point.html

The Cornell PIC32 examples include signed Q16.16 and Q2.30 formats and compare
operation costs on that microcontroller. Its right-shift multiply is NOT a
drop-in equivalent to VANILLAJS's exact truncation-toward-zero contract.

Benmaghnia, Martel & Seladji, *Code Generation for Neural Networks Based on
Fixed-point Arithmetic*, ACM TECS 23(5), article 68 (2024):
https://doi.org/10.1145/3563945

The paper's per-neuron / per-operation precision constraints are relevant to an
**opt-in quantized inference or DSP lane**, not to retroactive alteration of
authoritative world state. No SyFix code is copied, no mixed-Q engine has been
implemented, and there is no inference accuracy or memory-saving claim.

## GLUBALL → optional exact logical sampling

`modules/logical-sampling` adds exact u64-index projections without allocating
the entire logical population. It offers `uniform-floor` and an explicitly
nonmonotone `phi-weyl-64` policy, plus stable contiguous resident partitions.

Relevant public research source: https://github.com/QSOLKCB/GLUBALL
Contract: `GLUBALL-SAMPLING-V1`, docs/SAMPLING.md, source commit represented
by the reviewed `main` tree `d25da2a1ade877e2fe048fd4dabf019728cb25e7`.
This is a new self-contained Apache-2.0 implementation of mathematical
integer mapping identities, not a transplant of MPL-2.0 GLUBALL source.
The module's u64 BigInts are a **logical identifier path**, not physics inputs.
Neither a u64 logical count nor a sampling policy may silently modify snapshots.

## QEC → optional reversible GF(3) finite lattice

`modules/gf3-lattice` provides a standalone reversible SUM/SWAP GF(3) state
transform on explicitly bounded periodic lattices. No QEC decoder or
quantum hardware/runtime is imported. Output is finite software state only.

Pinned source fixture (copied as a separate MPL-2.0 research fixture):
`QSOLKCB/QEC/tests/fixtures/research/qutrit-css-decoupling-v1.json`
Git blob: `9a2ed76f9810d000495da496ac2fa64374e5399e`.
The QEC generator is `scripts/generate_qutrit_css_fixtures.py`;
QEC conformance oracle is `tests/test_qutrit_css_decoupling_conformance.py`.
Its donor `hmx21/css-decoupling` is MIT licensed at pinned commit
`a48048c1097f4d1b37a55eca9a1796a823f0c124`.
The stored fixture preserves QEC's original claim boundaries:
**finite software conformance only**. It does not prove the donor theorem,
decoder reliability, hardware execution, polynomial time, or quantum advantage.

VANILLAJS tests rebuild each of the six saved GF(3) circuit actions
from independent finite-lattice state updates across several periods and
compare both forward and inverse basis-column actions to the pinned Laurent
matrix fixtures. Input data remains unchanged and malformed inputs fail closed.

## Suggested commands

    node --test tests/q16-radix.test.js tests/logical-sampling.test.js tests/qec-gf3-lattice.test.js
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-integer.js --check
    node scripts/q16-radix-workload.js 80000

Only numerical evidence from actually executed runs can substantiate speed
claims. Retain the pre-optimization baseline and historical receipts.
