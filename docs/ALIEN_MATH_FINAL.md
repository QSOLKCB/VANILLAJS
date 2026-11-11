# ALIEN-MATH-FINAL — research freeze candidate

**Owner review candidate. No release, tag or Zenodo deposit has been created.**
Make amazing alien tech and put it under an Apache 2.0 license.

This phase audits 001–006, prepares a deterministic scoped source capsule and
adds adversarial packaging checks. It introduces no mathematical API or new
proof claim. The integer simulation, Q16.16, QFLOAT, replay and historical
Lean/SPARK boundaries remain authoritative and unchanged.

## Audit and evidence levels

| Phase | Contract retained | Reproducible evidence | Boundary still open |
| --- | --- | --- | --- |
| [001](ALIEN_MATH_001.md) | Immutable reduced fractions; supplied and canonical component magnitudes ≤2^256−1; bounded decimal grammar | 16 CPython Fraction pairs, 12,000 seeded JS pairs and admission tests | General ECMAScript refinement; constant-time/physical claims |
| [002](ALIEN_MATH_002.md) | Six explicit rounding policies, reject/saturate overflow, signed-int32 Q16.16 | 25,020 Python outcomes plus round-trip/error-bound JS checks | Universal signed/tie/saturation source refinement |
| [003](ALIEN_MATH_003.md) | Closed intervals, directed orientation, segments and positive-area boxes | 2,066 independent Fraction cases, degeneracy/extreme-input/admission tests | Universal source refinement and arbitrary polygon/3D algorithms |
| [004](ALIEN_MATH_004.md) | Eight named D4 actions, composition, inverses, exact XY/box action and bounded squared distance | 8,320 independent observations; all products and associativity triples | Bounded-result/box source refinement |
| [005](ALIEN_MATH_005.md) | Simple undirected graphs ≤16 vertices, BFS/DFS, exact invariants and characteristic polynomials | 211 independent subset-determinant cases; 1,536 four-vertex relabelings and D4 checks | General n≤16 algorithm/traversal proof; isomorphism or physical-spectrum claims |
| [006](ALIEN_MATH_006.md) | Source-pinned Lean models and finite source correspondence | 21 kernel-checked model theorems, typed axiom audit, 856 three-way observations, six compiled negative controls | Universal JS/ECMAScript source-to-semantics relation; algorithm/resource/admission refinements |

The machine-readable [audit](../research/alien-math-final/audit.json) identifies
contracts and exact frozen fixture SHA-256 values. Fixture reproduction compares
bytes, verifier implementations, domains and source pins; a matching cached
expected result is never treated as new verification. General rational D4 model
laws are distinct from finite bridge checks. Graph spectral formal coverage is
explicitly three-vertex, not a theorem for the full 16-vertex implementation.

The new model's allowed axioms remain `propext`, `Classical.choice`, `Quot.sound`.
The older Q16 axiom policy remains its own narrower boundary. No formal files,
old receipts or archived binaries are rewritten. The active phase006 manifest
is refreshed only to bind the audited browser-policy digest following the CI
fix; its frozen baseline remains `ce7e38eb3c7412407a3ba2bc472120b589e6eb9e`.

## PR70 browser failure and repair

[Failed hosted job](https://github.com/QSOLKCB/VANILLAJS/actions/runs/43016939774/job/130510252625)
read zero `.drum-digit` elements where 64 were required. Clicking the navigation
link could return before the module initialized; the preceding word and detent
assertions read static HTML and did not establish readiness. The verifier now
awaits the page's `load` state before retaining the exact assertions. No arbitrary
wait or relaxed count is added to production verification.

`node scripts/alien-math-browser-regression.mjs` holds the module request to
reproduce the old failure deterministically, runs the actual complete verifier
with delayed requests, and confirms that an empty application still rejects
with the original 0-versus-64 assertion. The 300ms artificial delay belongs only
to the fault-injection test. It is not the readiness condition. Gameplay and
packaged assets are unchanged.

## Reproduction from the repository

Prerequisites: Git, Node 22, CPython 3.11 or newer, Lean 4.35.0 at commit
`eb6cafb7290e8bd5f2937522d8d804f58f02bafc`; the installed compiler is checked by
phase006. Python uses only its standard library. `uv run --no-project python`
is preferred locally; plain `python3` is sufficient on hosted CI. No runtime
NPM dependencies, Mathlib, cloud service or GPU are needed for the capsule.

```sh
git fetch origin main
# Check out the exact reviewed candidate SHA recorded in its PR, not a moving ref.
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
uv run --no-project python -m unittest discover -s tests -p test_alien_math_bundle.py -v
uv run --no-project python scripts/alien_math_001_oracle.py --check
uv run --no-project python scripts/alien_math_002_oracle.py --check
uv run --no-project python scripts/alien_math_003_oracle.py --check
uv run --no-project python scripts/alien_math_004_oracle.py --check
uv run --no-project python scripts/alien_math_005_oracle.py --check
uv run --no-project python scripts/alien_math_006_oracle.py --check
uv run --no-project python scripts/verify_alien_math_006.py --negative-controls --output /tmp/alien-formal.json
```

Existing archival integrity checks, Q16 formal gates and CPU reference workloads
remain in the existing workflows and must run independently. The new hosted
freeze workflow never substitutes the capsule for those gates. Browser
verification uses the isolated pinned Playwright 1.64.0 installation described
in [incremental CI](BROWSER_INCREMENTAL_CI.md): run the real preflight, all required
suite decisions, and the delayed-module regression. Existing manual full-browser
override still executes all seven suites. No self-hosted/RTX workflow is invoked.

## Build, check and reproduce the capsule

From a committed, reviewed checkout with the historical baseline locally present:

```sh
candidate_sha=$(git rev-parse HEAD)
uv run --no-project python scripts/alien_math_bundle.py build --revision "$candidate_sha" --archive /tmp/alien-final-a.tar.gz
uv run --no-project python scripts/alien_math_bundle.py build --revision "$candidate_sha" --archive /tmp/alien-final-b.tar.gz
cmp /tmp/alien-final-a.tar.gz /tmp/alien-final-b.tar.gz
sha256sum /tmp/alien-final-a.tar.gz
uv run --no-project python scripts/alien_math_bundle.py check --revision "$candidate_sha" --archive /tmp/alien-final-a.tar.gz
uv run --no-project python scripts/alien_math_bundle.py reproduce --revision "$candidate_sha" --archive /tmp/alien-final-a.tar.gz --destination /tmp/alien-final-reproduction --lean /absolute/path/to/lean
```

Archive and destination paths must not already exist. Building reads committed
Git blobs; it never includes working-tree edits, credentials, browser profiles,
installed tooling, generated reports, `.git` configuration or unrelated historical
evidence. The source commit is supplied externally and checked against original
Git commit/tree/blob objects. Do not adopt a revision merely because an untrusted
archive self-reports it. Review/trust the verifier itself before running it.

The capsule includes the public runtime, every phase006 pinned input, contracts,
fixtures, independent oracles, selected Node tests, final audit and draft metadata.
`MANIFEST.json` lists every payload path, byte length and SHA-256. `SHA256SUMS`
additionally covers that manifest; it excludes itself. Sorted regular-file tar
entries use fixed mode/owner/time and a timestamp-free gzip envelope. Rebuilding
with the same source and Python/zlib implementation must be byte-identical;
compression byte equality across different zlib versions is not claimed.

Verification checks exact membership, safe paths, bounded sizes, SHA-256,
external source identity, original Git object identities and tree-to-file
bindings before writing any files. Forged checksums alone cannot substitute a
changed source for the externally pinned commit. These hashes are integrity and
provenance links, **not signatures or proof of owner approval**.

Extraction creates a deliberately **partial Git object database** containing
only selected blobs and their original tree/commit witnesses. It lets the
unchanged phase006 verifier execute `git show BASE:path` offline. This is not a
full clone, complete history or clean Git worktree; do not use it for development,
checkout, garbage collection or publishing. Use the repository for those tasks.

`check` proves only integrity/source binding and reports `proofsExecuted:false`.
`reproduce` freshly runs the six math Node suites, browser-reuse regression suite,
all six independent math oracles, the invariant oracle, full phase006
Lean/bridge/negative controls, runtime build and independent offline verifier.
It uses installed tools without a package installer or network operation.
It is intentionally not the whole-repository archival/browser/GPU test suite.
New reproduction outputs are observations alongside the extracted source, not
immutable historical receipts and not reusable main witnesses.

## Trust, licensing and publication boundaries

Base of this phase: `dd5e1557a35f032e949fa542ee024c6b011a83ea` (merged PR70).
Read-only branch/ruleset auditing still needs to establish actual review
protection before any browser reuse. The prior main audit reported unprotected;
no PR/local result can qualify itself as reviewed-main evidence. Three distinct
authenticated successful executions remain required. A missing authority,
changed harness/domain/environment or unknown dependency forces execution.
No protection settings are changed. See the latest executed handoff for observed
suite counts and live authority status; simulated fixture reuse is not a live hit.

The six mathematical implementations, new capsule tooling and regression are
original repository code under Apache-2.0. Existing LICENSE, NOTICE and attribution
are retained byte-for-byte. Third-party architectural inspiration is not asserted
to grant rights to unrelated files. Historical screenshots, archives and hardware
receipts remain excluded from the capsule and preserved in the repository under
their existing provenance. Lean, Node and Playwright are external verification
tools, not redistributed runtime dependencies. No new external source is copied.

[Release notes](../research/alien-math-final/release-notes.draft.md) and
[Zenodo metadata](../research/alien-math-final/zenodo.draft.json) are drafts only.
Owner approval must settle the release version, authorship details, date and
publication choice. No DOI, release date or tag is fabricated. The source capsule
is a review artifact; it is not a release or deposit. Remaining engineering and
formal obligations are explicit above, not silently marked complete by freezing.
