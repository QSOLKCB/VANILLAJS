# ALIEN-MATH-006 — Source-pinned formal correspondence

**Status: research verification layer; no runtime mathematics change.** This phase
separates Lean mathematical theorems, finite source correspondence and OPEN
refinement obligations. It does not claim a universal JavaScript/ECMAScript proof.
Original Apache-2.0 source; no Mathlib or new runtime package dependency.

## Assertion inventory, phases 001–005

| Phase | Established executable contract | Formal coverage here | Still OPEN |
| --- | --- | --- | --- |
| 001 | Bounded normalized exact rationals, arithmetic, strict parsing/serialization | General Rat addition commutativity/associativity, multiplication commutativity/distributivity; integer normalization cross-product certificate | Refinement of private fields, gcd/cancellation code, parsing, all admission/overflow branches, division and representation to Lean Rat |
| 002 | Six explicit Q16 rounding policies and reject/saturate bounds | Nonnegative floor certificate and exact magnitude scale round-trip | Signed/tie/saturation policy refinement and all raw-int32 implementation paths |
| 003 | Closed intervals, orientation, segments and positive-area box relations | General rational closed-interval reflection and D4 signed-area covariance | General segment/box classification correspondence, sign/degeneracy code and object admission |
| 004 | Eight named exact D4 actions, composition/inverses, point/box actions and bounded squared distance | Full D4 identity, associativity, inverses, rational point action composition, distance and signed-area laws | Universal source-to-model relation, box implementation and bounded-result rejection refinement |
| 005 | Bounded simple graphs, deterministic traversal, exact polynomial/invariants | General adjacency relabeling symmetry/no-loops/composition/inverse; all three-vertex polynomial relabelings and determinant identity | General n≤16 Faddeev–LeVerrier implementation proof, traversal and invariant source refinement, complexity/resource refinement |

Earlier phase contracts and independent oracles remain authoritative for their
bounded source APIs. Their finite tests are rerun; a Lean theorem does not widen
an API domain or turn source admission tests into a proof.

## Lean model and exact statements

`formal/alien-math-006/AlienMath006.lean` contains **21 named theorems**, with
explicit mathematical definitions. `Audit.lean` independently fixes each full
expected theorem type through a typed assignment and requests its transitive
axiom inventory. A fresh temporary build prevents stale local `.olean` reuse.

The model uses bundled Lean `Rat` (unbounded canonical mathematical rationals),
`Int`, `Nat`, a finite D4 inductive type, and Boolean graph adjacency functions.
No universal ECMAScript semantics, object layout, Number implementation or
private-field admission is assumed or proved. The D4 composition table uses the
phase-004 convention: compose a b applies b first; r(x,y)=(-y,x), s(x,y)=(x,-y).

The D4 distance and signed-area equalities quantify over **all rational model
coordinates**, not just the finite bridge inputs. Signed area transforms by the
model determinant ±1. The bounded JavaScript squared-distance function may reject
a result outside 256 bits; the unbounded Rat theorem does not remove that limit.

The normalization theorem assumes exact common-factor decompositions n=a·g and
d=b·g and establishes n·b=a·d. It does not prove gcd maximality, denominator
positivity or execution of the JavaScript normalization code. The Q16 floor theorem
assumes lower/upper quotient inequalities for nonnegative magnitudes. It does not
prove signed policy selection or ties-to-even behavior.

Generic graph theorems apply to Boolean adjacency and maps between arbitrary
vertex types: symmetry/no-loops survive pullback, pullbacks compose, and a specified
inverse recovers the original adjacency. They do not claim every map is bijective.
The JavaScript public permutation is old-ID→new-ID; the Lean pullback is
new-ID→old-ID. The finite bridge explicitly inverts that permutation at the API
boundary.

For three-vertex simple graphs, the coefficient list is
`[1,0,-(a+b+c),-2abc]`, where a,b,c are 0/1 edge indicators. The determinant theorem
proves the explicit 3×3 determinant of λI−A equals **Horner evaluation of that
same coefficient list** for every integer λ. All eight graphs and six vertex
permutations satisfy the polynomial relabeling theorem. This is not a general
proof of the bounded 16-vertex JavaScript characteristic-polynomial algorithm.

## Toolchain and axiom boundary

Lean is pinned to **4.35.0**, release commit
`eb6cafb7290e8bd5f2937522d8d804f58f02bafc`, matching existing `lean-toolchain`.
The existing checksum-aware installer is reused in hosted CI, without changing
Q16 proof sources, the Lake file, their axiom policy or historical receipts.
Local verification accepts the installed toolchain via `--lean /absolute/path`.
Node 22 and Python 3.10+ are required; actual versions and Lean launcher SHA-256
are recorded in each observed report, along with the resolved compiler SHA-256.
The launcher resolves the toolchain in the checkout; all temporary builds then
use that absolute compiler, preventing elan default-toolchain drift. These hashes
are not hardware attestation
or a complete inventory of the installed Lean library. Official toolchain delivery,
the Lean kernel, OS and local/hosted execution environment remain trust principals.

The exact audited dependency sets are reported per theorem. This phase permits
only Lean's standard `propext`, `Classical.choice`, and `Quot.sound`; several
finite group and relabeling theorems use no axioms. This is **not an axiom-free
claim**. The old Q16 allowlist remains unchanged. `sorryAx`, custom axioms,
`Lean.ofReduceBool`, `native_decide`, unchecked proof escapes, missing/duplicate
records or unexpected audit output cause failure. Executable `lean --run` output
is finite evaluation evidence, not a kernel theorem about JavaScript.

## Source pins and provenance

`formal/alien-math-006/manifest.json` binds every declared input by SHA-256:
production modules and their integer dependency, phase contracts, prior oracles,
fixture domains/results, tests, new Lean model/audit/bridge, both independent
verifiers, the pinning tool and hosted workflow. The verifier enforces the exact
file inventory, theorem inventory, toolchain identity and axiom policy.

Existing runtime/contracts/fixtures and Q16 proof boundaries additionally match
Git objects at the reviewed phase-005 merge:

`ce7e38eb3c7412407a3ba2bc472120b589e6eb9e`

Missing history fails closed; fetch that commit or use a full checkout. New-phase
files are content-pinned rather than self-referentially including their own commit
SHA. The observed report records its executing Git commit and manifest digest;
the PR handoff records the final commit and tree. These are source-correspondence
records, not authenticated human-review or protected-branch attestations.

Hashes alone do not certify theorem strength. Typed statement checks, actual
kernel compilation, transitive axiom checks and executed bridge comparisons are
all required. A matching numerical result is insufficient when a verifier,
contract, source or fixture identity differs. No mathematical PASS is restored
from a cache. The browser reuse policy also binds these new verification inputs
for consumers of the exact-math modules, while this formal workflow always runs.

## Independently executable finite bridge

`Bridge.lean`, `scripts/alien-math-006-bridge.mjs` and
`scripts/alien_math_006_oracle.py` emit the same ordered ASCII stream. Python uses
Fraction, explicit integer matrices and a separate Leibniz determinant expansion;
it never imports or executes Lean or JavaScript. JavaScript imports the actual
production modules. The frozen JSON input fixes four rational points, eight D4
elements, all eight three-vertex graph masks and six pullback permutations.

The stream covers 64 rational arithmetic pairs (including zero-division rejection),
64 group products, 32 point actions, 128 distances, 512 signed-area observations,
eight graph polynomials and 48 graph relabelings: **856 observations**. Each line
has an operation tag, numeric domain indices and exact canonical rational/integer
text separated by `|`, ending in LF. The area value uses production rational
arithmetic and additionally checks the actual orientation predicate's sign.

Lean's domain is separately encoded in its bridge source; a drift from JSON
inputs must fail comparison. The frozen oracle summary binds both the JSON input
SHA-256 and the entire ordered stream digest. `--check` regenerates expected bytes
in memory; it never silently rewrites a failed fixture. This is finite conformance,
not universal implementation correspondence. Prior ALIEN-MATH-001–005 independent
oracles also rerun unchanged for their larger domains and rejection cases.

Frozen input SHA-256: `390a7400f1ab01b0243979ea707e1498d5090fe64afccd9b38962ec878782c7c`.
Oracle fixture SHA-256: `1866040c3fdd08477f190b47c44f6bfb47c9ca66d3e51c7352d8a6b417a23b45`.
Observation-stream SHA-256: `964981f119a1e8372a6dd678663d443fe363eac05c1e5886a0003fc1b6070ed9`.

## Adversarial controls and reproduction

From a full repository checkout:

```sh
node --test tests/*.test.js
uv run --no-project python scripts/alien_math_006_oracle.py --check
uv run --no-project python scripts/verify_alien_math_006.py --negative-controls --output /tmp/alien-math-006-report.json
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

Use `--lean /path/to/lean-4.35.0/bin/lean` if the pinned executable is not on PATH.
No proof succeeds by skipping an unavailable tool: missing/wrong Lean, compile or
audit errors, timeout, stale source pins or output mismatch exit nonzero. The
`--pins-only` mode explicitly reports **proof and conformance NOT RUN**.

`--negative-controls` compiles disposable mutations: removed theorem, weakened
proposition, custom axiom, proof hole and wrong graph coefficient must be refused.
A conjugated D4 representation deliberately retains valid model theorems but uses
the wrong named actions; the finite source bridge must reject it. Separate unit
controls reject forged/missing source metadata, digest drift, tool/policy changes,
missing/duplicate/unknown axiom records, and corrupted finite streams. No production
or archived file is mutated by negative controls.

After an intentional reviewed change to **new-phase inputs only**, regenerate
source inventory explicitly, inspect it, then rerun the full verifier:

```sh
uv run --no-project python scripts/pin_alien_math_006.py --write
```

This operation does not certify proofs and refuses changes to frozen baseline
files. Fixture regeneration is a separate explicit oracle `--write` operation;
it cannot substitute for Lean/source checks. The hosted
`ALIEN-MATH-006 Lean models and source correspondence` workflow performs all
proof/bridge/negative controls and publishes a short-lived observed report. Its
absence or failure means this phase's formal gate has not passed.

## Preservation and next phase

No ALIEN-MATH-001–005 implementation, Q16/QFLOAT arithmetic, replay, renderer,
Lean/SPARK historical proof, archived hardware receipt or immutable release is
changed. No GPU/RTX owner workflow or self-hosted runner is invoked. No release,
tag or Zenodo publication occurs. Phase FINAL is only planned and requires
explicit owner authorization after this PR merges. Full ECMAScript refinement,
all admission/error branches, arbitrary graph size/weighted spectra, physical
accuracy and hardware verification remain OPEN or explicitly outside scope.
