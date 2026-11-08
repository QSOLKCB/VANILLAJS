# Q16-FORMAL-001 — mathematical certificates for radix-65536 division

## Claim boundary

This PR supports mathematically verified integer identities and a separate,
finite, exact-source-constrained JavaScript conformance test. It does not
establish authorship, copyright ownership, absence of copied historical code,
or equivalence of a JavaScript engine to a Lean integer model.

Source base: VANILLAJS commit 2a0ad1fd067682c73076e1f1c83b6e83aef089da.
Production scalar module Git blob:
d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9

## Theorems and execution

Q16Formal.lean uses pinned leanprover/lean4:v4.35.0 and no Mathlib dependency.
Fourteen named theorems cover: corrected digit quotient, quotient/remainder
certificate, radix digit bound, exact step decomposition, remainder bound,
prefix invariant, safe exact integer quotient path, checked signed bounds,
canonical zero, INT_MIN sign asymmetry, 2^47 intermediate bounds, and exact
square-root bracket as a validation certificate.

Q16Audit.lean performs typed #check and #print axioms for every named theorem.
The static inventory script checks statement membership and rejects unchecked escapes.
The separate axiom verifier requires all 14 named reports, rejects unknown axioms,
and executes five negative controls for missing, duplicate and forged records.
Source bridge uses independent BigInt tests and refuses source blob mismatch.
Only passing actual CI execution provides checked-proof evidence.

Commands:
  python3 scripts/verify-q16-proof-boundary.py
  lake build Q16Formal
  lake env lean Q16Audit.lean
  node scripts/q16-formal-bridge.mjs

## Formalization context framework

Design discipline follows QSOLKCB/Private-Context-For-Formalization:
ai/bootstrap.json, reference/lean-lake.json, contracts/proof-audit.json,
contracts/claim-boundaries.json, schemas/packet.schema.json.
This framework is a workflow/packet specification, not a proof runner.

PA01: enumerate proof modules; PA02: type-check intended statements;
PA03: print transitive axioms and reject sorryAx;
PA04: pin and observe effective toolchain;
PA05: preserve exact source baseline identity;
PA06: report actual executions, never an assumed result.

## Unresolved obligations

REFINEMENT_OPEN: model the full JavaScript Number, division-estimate correction
loops, exception conditions and runtime semantics and prove a refinement.
PROVENANCE_UNASSESSED: separate source/history/license comparisons;
no theorem here proves that copied material is absent from all history.
PERFORMANCE_OUT_OF_SCOPE: no speedup claim follows from these theorems.

Background references: GALAXY retro-math, GLUBALL deterministic sampling,
QEC finite software conformance, Cornell 16.16 examples, and Microchip
XC32 Compiler User Guide DS50001686J Chapter 10. These are design references.
