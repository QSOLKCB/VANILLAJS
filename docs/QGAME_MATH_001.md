# QGAME-MATH-001 — Quantum-Inspired Game-Math Laboratory 👽

**Experimental, opt-in, Apache-2.0.**

**VANILLAJS Mod SDK — Build games. Extend the engine. Own your creations.**

**This is not a product. This is INDEPENDENCE.**

[Open Ternary Constellation](../demos/quantum-game-lab/index.html). Reach the
displayed target with reversible ternary moves, inspect the state graph, hear a
declared score and export your own local experiment pack. The default target
`[1,2]` is reached by `pulse-0, pulse-1, pulse-1`. Play repeats the selected
operation; Step applies it once. Escape, blur and hidden-tab transitions pause.

## Architecture inspected before integration

Verified GitHub `main` and local remote-tracking HEAD were both
`c506cdfcefe2a68928cfa7025528a82ed11d44a9`, merged PR #77. An ancestry check
passed, and `feat/qgame-math-001` was created from that exact HEAD.

The review covered `AGENTS.md`, `MODULES.json`, exact-rational, rational-q16,
exact-d4, exact-graph, exact-circuit, mod-sdk, mod-course, the Visual Editor
authoring boundary, fixed-step clocks, offline packaging and CI source pins.
Existing APIs and proof contracts remain unchanged.

| Layer | Responsibility | Dependency direction |
| --- | --- | --- |
| `modules/gf3` | Exact bounded vectors, matrices, affine maps, syndromes, directed transition graphs | No dependencies |
| `modules/symbolic-events` | Versioned composition rule and symbolic events; reference sound adapter | gf3, audio2d |
| `modules/mod-experiment` | Strict typed experiment admission and registry snapshots | mod-sdk, gf3, symbolic-events |
| `demos/quantum-game-lab/experiment.js` | Puzzle target, finite history, declared mass mapping and atomic combined tick | New modules, existing orbital-physics |
| `demos/quantum-game-lab/app.js` | Controls, Canvas/SVG/table, pacing, playback and local files | Demo model and existing IntegerClock |

The existing `gf3-lattice` API owns periodic X/Z Pauli-label SUM/SWAP circuits;
it does not expose general field/matrix/affine operations. It is preserved.
Tests compare the overlapping single-cell shear/SWAP X-lane cases exhaustively.
`ternary-store2d` remains a byte-storage layout, not the new state representation.
The existing `ExactGraph` admits simple undirected graphs with at most 16 vertices;
it cannot represent these labelled directed edges, self loops or parallel edges.
No duplicate simple-graph or D4 implementation is added. Square-dihedral D4,
Lie/root-system D4 and physical quantum state spaces are different concepts.

MOD-SDK-002's typed-adapter pattern is reused. Course schemas are not overloaded
with experiment semantics. The main engine and other labs do not depend on this
lab. The existing build allowlist automatically packages its static assets.

## Exact finite mathematics

GF(3) is the field `{0,1,2}` with addition and multiplication modulo 3. The
additive inverses are `0,2,1`; the nonzero multiplicative inverses are `1,2`.
Subtract as `(a + 3 - b) mod 3`. Numeric input must be a canonical integer
element; fractional values, negative zero, strings, NaN and infinity are rejected
by the direct field API. The existing Mod SDK snapshot normalizes JSON negative
zero to zero before typed pack admission, preserving its established contract.

Although ECMAScript uses Number storage, all arithmetic intermediates in this
kernel are small exact integers. A matrix dot product is at most 8 × 4 = 32.
There is no floating approximation inside the field operations. The division
and powers in graph enumeration decode bounded base-three indices, not field
amplitudes. Dimensions are 1..8 for vectors and matrix sides; graph dimension
is 1..4, with 1..8 distinct transformations and at most 81 states / 648 edges.
Graph state ID is `sum(x[i] * 3**i)`; the first coordinate is least significant.
Matrix rows act on column vectors. Graph edge order is source ID, then supplied
operation order, including self loops and distinct labelled parallel edges.

An affine map is `x' = A*x + b (mod 3)`. `affineTransform` accepts only square
invertible A. Gauss–Jordan elimination works entirely in GF(3); singular input
is rejected. Its inverse is `A^-1*x - A^-1*b`. Matrices, vectors, maps and
outputs are detached and frozen. Map handles are authenticated in-process;
serialized handles must be reconstructed from validated source data.

`syndrome(H,x) = H*x (mod 3)` is a parity-check calculation. A zero syndrome
only says x lies in H's kernel. This lab implements no decoder, logical-error
classification, quantum amplitude evolution or physical qutrit.

```js
import {affineTransform,applyAffine,invertAffine,syndrome}
  from './modules/gf3/index.js';
const shear=affineTransform('shear',[[1,1],[0,1]],[0,0]);
const after=applyAffine(shear,[2,1]); // [0,1]
applyAffine(invertAffine(shear),after); // [2,1]
syndrome([[1,1]],after); // [1]
```

Public operations: `add3`, `subtract3`, `multiply3`, `stateVector`,
`ternaryMatrix`, `matrixVector`, `matrixProduct`, `inverseMatrix`,
`affineTransform`, `applyAffine`, `invertAffine`, `syndrome`, `transition`,
`transitionGraph`. `transition` admits integer ticks 1..1,000,000 and does not
store a history. The demo supplies a stricter 32-transition history bound.
Input admission rejects sparse/accessor/exotic arrays and unexpected map data.
These checks are for data admission, not a sandbox against hostile JavaScript
Proxies or code that replaces built-in prototypes.

## Declared sonification, not a frequency of algebra

One canonical event is generated for each committed transition, including a
transition that leaves the vector unchanged. `note = sum(after) mod 3` selects
one of three declared integer frequencies. The starter uses `[165,220,330]` Hz,
triangle waveform, gain 3500 and the three palette colours. This is an artistic
rule. MIDI tuning, E8 spectra or measured material frequencies are not inferred.

`qsol.symbolic-event.v1` fields are `kind,id,tick,order,before,after,operation,
note,frequency,durationTicks,wave,gain,visual`. `order=0` and `durationTicks=1`.
Identity is `tick:operation:before>after` with concatenated trits. IDs identify
transitions **within the source configuration**; they are not global content
hashes. Event logs retain the source pack because changing the composition rule
can change sound while retaining the same transition ID.

`eventMapping(source)` compiles `qsol.ternary-score.v1` with exactly `kind,
frequencies,wave,gain`. Three integer frequencies must lie in 30..2000 Hz;
wave is `square`, `triangle` or `saw`; integer gain is 0..6000.
`transitionEvent(mapping,transition)` validates transition data and creates a
frozen event. It does not itself verify that the transition followed a given A;
the session obtains the transition from the GF(3) engine.

`referenceSound(events)` accepts consecutive generated events at ticks 1..32.
It reuses **unchanged** `audio2d`: 48 kHz mono PCM16LE, 12,000 samples per tick,
one nonoverlapping lane and an integer envelope. At most 384,000 frames / eight
seconds are rendered. Imported plain event objects confer no renderer handle:
replay validated source plus operations to regenerate canonical events first.

Canonical event order is independent of render mode, audio enablement and
device state. Reference PCM is independently checked sample-for-sample via its
SHA-256. AudioContext conversion, resampling, scheduling, device latency and
speaker output are downstream presentation and are **not** that PCM contract.
Unavailable/suspended audio leaves events, puzzle controls and WAV export usable.

## Classical spatial specification

The demo reuses `orbital-physics`, independently implemented in VANILLAJS before
this work. No new force solver, N-body, Barnes–Hut, WASM or GPU lane is added.
Each trit controls one noninteracting negligible-mass test particle. Its prescribed
fixed-centre parameter for the next tick is `M_i = B * (1 + x_i)`, with
`B=10^11 kg` for `gentle` or `5*10^11 kg` for `swift`. Different particles can
therefore experience different authored central potentials; this is a declared
game field, not one self-consistent physical gravitating system.

Use SI metres, seconds, kilograms; +Y up, -Z forward, right-handed axes.
Positions lie in XY at Z=0. Initial radii are `4+2*i` metres along +X,+Y,-X,-Y.
Initial velocities are counterclockwise circular velocities `sqrt(G*M_i/r)`.
The solver uses `G=6.67430e-11`, acceleration `a=-G*M*r/|r|^3`, eight
velocity-Verlet steps of exactly 1/32 second per event tick, and excluded radius
0.5 m. Its conservative chord guard rejects steps crossing that excluded region.
The demo also rejects any candidate coordinate/speed component beyond ±100.
There are only 2..4 bodies and at most 256 substeps per body per run.

The numerical solver uses Float64. Body state is computed in temporary orbits;
all candidates must succeed before committing the exact state, event or history.
Failure leaves the previous run intact. Rendered coordinates never feed back.
The trajectory is deterministic for a fixed implementation/runtime/input sequence;
cross-runtime bit-exact Float64 replay is not asserted.

Specific energy `|v|²/2 - GM/r` is a diagnostic in J/kg. The fixed-potential
fixture has relative energy error below 1e-7 over 256 substeps. A mass switch
changes the potential and gives an explicit energy-conservation counterexample.
No energy bound is claimed for arbitrary switched runs. No softening, collisions,
relativity, quantum gravity, mutual interactions or astrophysical calibration.

## Data-only pack and output schemas

[Starter pack](../examples/qgame-math-001/ternary-constellation.json).
The outer envelope is unmodified `qsol.vanillajs.mod-pack.v1`: exactly `kind,id,
version,requires,entries`; entries have exactly `id,kind,data`, with `kind=data`.
All existing 32 KiB, depth, node, dependency, duplicate-ID and registry limits
remain in force. Strings and raw file bytes are bounded **before JSON parsing**
in the browser. The typed adapter validates every entry before registration.

Each `data` record has exactly these fields:

| Field | Admission |
| --- | --- |
| kind | `qsol.ternary-experiment.v1` |
| dimension | Integer 2..4 |
| initial, target | Exactly dimension canonical trits |
| transforms | 1..8 records, exactly id/matrix/offset; distinct IDs; invertible dimension-square matrices |
| parity | 1..8 rows, each dimension trits |
| mapping | The strict composition rule above |
| spatial | `gentle` or `swift` |
| palette | Exactly three lowercase `#rrggbb` values |
| maxTicks | Integer 1..32 |

The browser previews one self-contained experiment with no pack dependencies.
The reusable adapter supports the existing registry's multiple entries and exact
dependencies. `validateExperimentMod`, `registerExperimentMod` and
`activeExperiments` mirror the typed course-adapter workflow without accepting
course or executable plugin permissions. No eval, shader upload, remote mod
loading, plugin download, trusted-code isolation or runtime dependency install.

Exports:

- Pack JSON: the accepted source, suitable for edit/validate/export/reimport.
- `qsol.symbolic-log.v1`: source plus ordered canonical events.
- `qsol.qgame-run.v1`: source, tick-indexed operations, state, syndrome, history,
  events, final numerical bodies and explicit coordinate/time/claim contracts.
  Browser exports additionally include observed SHA-256 of relevant served
  implementation assets, or explicitly say hashing is unavailable. These
  hashes identify bytes; they do not authenticate review or a Git commit.
- WAV: reference PCM from the active canonical events, without device timing.

Run receipts are for inspection/reproduction, not blindly trusted state imports.
Recreate `Experiment(receipt.source)` and call `step(operation)` for each input
in tick order. Validate ticks are consecutive when accepting a third-party run.

## Repository provenance and licensing

All inspected revisions and paths are in
[the source research record](QGAME_MATH_001_PROVENANCE.md) and
[the Git blob inventory](../research/qgame-math-001/source-inspection.json).

| Repository | Exact inspected commit | Relevant boundary |
| --- | --- | --- |
| QEC-ADA | `ec166893f0e5d415cf84b3d192754f61a33da874` | MPL-2.0 GF(3)/Pauli-label syndromes and deterministic enumeration; SPARK arithmetic-model scope |
| SONIFICATION | `2ca65c6540d7051a77ed571b83f5a9df453094ec` | MPL-2.0 exact symbolic protocols, declared mappings, separate PCM/device evidence, source-pinned proof scope |
| GALAXY | `f219bb427b3a9b0c93900169d903f48f410ae67a` | Apache root; some browser files MPL; classical prescribed fields versus separate N-body lanes |

Source inspection is research, not a rerun of donor tests/proofs. QEC-ADA's
SPARK proof does not prove this JavaScript. SONIFICATION's D4 triality is not
the square's dihedral D4. GALAXY's prescribed-field CPU/WASM parity does not
establish parity for our constellation or any N-body lane.

New code and Python references are independent Apache-2.0 implementations of
the mathematical specifications. No donor files, fixtures or algorithms were
transcribed into the runtime. Existing VANILLAJS attribution remains intact.
The owner confirmed ownership of the MPL sources; no licence change to those
repositories is performed here. Future copied/adapted files must carry their
applicable attribution and expressly selected licence. Root licence alone is
not evidence about every subcomponent.

## Reproduction and evidence

Node 22; Python standard library via `uv run --no-project python`; existing
isolated Playwright 1.64.0 / Chromium and Lean 4.35.0 for established gates.
No npm runtime dependency, Docker, server backend or GPU is required.

```sh
node --test tests/*.test.js
node scripts/check.js
uv run --no-project python scripts/qgame_math_001_oracle.py --check
node scripts/qgame-math-evidence.mjs > /tmp/qgame-observation.json
node scripts/build.js
node scripts/verify-offline.js
# With the repository's existing isolated pinned Playwright tooling configured:
node scripts/flight-browser-preflight.mjs
node scripts/browser-check.js
node scripts/alien-math-browser-regression.mjs
# Existing formal-source and finite correspondence gate, including negatives:
uv run --no-project python scripts/verify_alien_math_006.py --negative-controls --output /tmp/alien-formal.json
```

Run `alien_math_001_oracle.py --check` through `alien_math_006_oracle.py --check`
with the same uv command for the established independent references. To serve the
packaged site locally: `uv run --no-project python -m http.server 8080 --directory
dist`, then open `/demos/quantum-game-lab/index.html`. Browser ES modules require
HTTP serving; double-clicking file:// is not the supported packaged workflow.
After integrity-checked service-worker installation, a fresh offline page works.

The new oracle independently enumerates all 81 two-by-two matrices, obtains
48 inverses by finite bijection rather than elimination, checks 3,888 affine
state images and 6,561 products, produces 32 ordered events and 384,000 integer
PCM frames, and integrates both spatial presets at 60-digit Decimal precision.
Numerical comparison gate is `|actual-reference| <= 5e-10 + 5e-11*|reference|`.
This finite domain is not universal verification of every 8×8 matrix or runtime.

The evidence script records implementation hashes, fixture hashes, Git HEAD,
dirty state, machine/Node versions, all measured durations, output parity and
observed numerical error. It profiles complete 2D/4D graph + 32-transition + PCM
workloads, with three warmups and 15 repetitions. There is no candidate optimizer
or paired speedup claim. Native modules are already adequate for these bounds.

Browser verification covers desktop and touch-emulated mobile Chromium,
320/390px, keyboard activation, invalid and oversized imports, exact event
comparison across view/audio modes, pause/blur, reference downloads, numerical
fallback with Canvas/WebGL/WebGPU absent, suspended/unavailable audio, no page
errors and real packaged offline reload. Audio mocks exercise failures; no
physical mobile device, audio hardware, WebGPU or cross-browser claim follows.

See [executed verification and retained failures](../evidence/QGAME-MATH-001/README.md).
Source-pinned ALIEN MATH files, formal manifest and browser reuse policy remain
unchanged. The new dispatcher/harness and assets are intentionally unqualified
for witness reuse: the invariant-aware policy fails closed to actual Chromium.
No hash was repinned to disguise a new execution dependency. Policy promotion
requires later owner review; until then the full browser workload runs.
Hosted `qgame-math.yml` regenerates the independent reference on every PR;
the existing Flight Lab workflow runs the actual browser verifier.

## Scientific nonclaims and follow-up

Quantum-inspired means inspiration from finite notation and QEC research.
This is **not** superposition, entanglement, amplitude simulation, quantum
hardware, a physical qutrit, quantum gravity or experimental validation through
sound. Exact field values do not make numerical orbits or pixels exact.

Potential follow-ups are larger bounded algebra references, explicit symplectic
Pauli-label experiments over the existing lattice API, declared square-dihedral
actions, longer segmented scores, inverse-step puzzle tooling and separately
verified direct N-body fields. Barnes–Hut/WASM acceleration would first require
a measured workload, a retained direct reference, paired timing and numerical
error evidence. No advanced acceleration is needed for this milestone.
