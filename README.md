<p align="center">

  <img src="assets/vanillajs-hero.svg" width="100%" alt="VANILLAJS Mod SDK — Build games. Extend the engine. Own your creations. This is not a product. This is INDEPENDENCE." />
</p>

**Start creating:** [Creator Hub](demos/creator-hub/index.html) · [Game-making guide](docs/CREATOR_GUIDE.md) · [Soundtrack Lab](demos/soundtrack-lab/index.html). New editor starters, gameplay pieces and scene checks help you reach a first playable; the game-folder exporter includes its runtime. VOIDWARD now includes eight campaigns.

<p align="center">
  <a href="https://doi.org/10.5281/zenodo.24049474"><img src="https://zenodo.org/badge/DOI/10.5281/zenodo.24049474.svg" alt="FP-HIST-001 dataset DOI" /></a>
</p>

**VANILLAJS Mod SDK — Build games. Extend the engine. Own your creations.**

**Latest release: [v1.7.0 — Reply to Your Own Tweets Edition](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.7.0)** · 11 November 2026.

Reusable JavaScript game modules, exact authoring tools and playable browser labs
built directly on web standards. The current [catalogue](MODULES.json) contains
**50 experimental modules, 23 registered recipes and two research experiments**.
The full, stable Mod SDK remains planned; local data-only packs and the
experimental Visual Workbench are available now.

**This is not a product. This is INDEPENDENCE. 👽**

**QSOL–IMC motto:** Make amazing alien tech and put it under an Apache 2.0 license. 🛸

[Run the labs](#run-the-labs) · [Build a game](BUILD_A_GAME.md) ·
[API contracts](docs/API.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Verification](docs/VERIFICATION.md) · [Roadmap](ROADMAP.md) ·
[All releases](https://github.com/QSOLKCB/VANILLAJS/releases)

## New on main

[**4X Game Lab — Ternary Reach**](demos/4x-game-lab/index.html): explore a seeded
star sector, settle colonies, develop an exact economy and command fleets against
a deterministic rival. Native controls, offline play and validated command replay.
[Rules, ALIEN MATH links and verification](docs/4X_GAME_LAB.md). Experimental.

[**VOIDWARD Campaign Lab**](demos/4x-game-lab/voidward/index.html) extends the 4X
Lab with eight moddable campaigns, selectable empires, fleet orders, production
queues, ship designs/refits, diplomacy and staged objectives. The
[**Visual Workbench campaign panel**](demos/editor/index.html#fourx) edits text packs,
places stars in the real viewport and turns selected geometry into ship hulls.
[Player and creator guide](demos/4x-game-lab/voidward/guide.html) ·
[Integration, limits and walkthrough](docs/VOIDWARD_WORKFLOW.md).
Adapted from [4XGAMES PR #2](https://github.com/QSOLKCB/4XGAMES/pull/2), using native
VANILLAJS modules. Ternary Reach replays and existing Workbench projects retain
their formats. These additions are experimental and are not part of v1.7.0.

## What's available in v1.7.0

| Play or author | What it demonstrates |
| --- | --- |
| [Ternary Constellation](demos/quantum-game-lab/index.html) | Exact GF(3) puzzles, directed state graphs, deterministic symbolic scores, reference WAV export and classical constellation motion |
| [ALIEN Circuit Foundry](demos/circuit-mod-lab/index.html) | Exact cardinal X/Z checkpoints, ordered laps and local data-only course packs |
| [ALIEN Course Foundry](demos/alien-course-lab/index.html) | Decimal-string authoring, explicit Q16.16 conversion and exact swept gate crossings |
| [Visual Workbench](demos/editor/index.html) | Typed components, transform tools, local assets/prefabs, exact position tools, project recovery and playable HTML export |
| [The Kinetic Foundry](demos/gpu-lab/index.html) | Animated procedural geometry, bounded sculpture presets and JS/WASM projection parity |
| [Orbital Proving Ground](demos/space-lab/index.html) | Navigation gates, docking, visible broadsides and classical Newtonian orbit trails |
| [Graph & Spectral Lab](demos/graph-lab/index.html) | Bounded simple graphs, deterministic traversal and exact adjacency characteristic polynomials |

**QGAME-MATH-001:** Ternary Constellation separates exact finite algebra,
declared musical/spatial mappings, Float64 orbital motion and browser presentation.
Edit, validate, export and reimport local experiment packs; export event logs,
run receipts and up to eight seconds of reference PCM audio.
[Contract](docs/QGAME_MATH_001.md) ·
[Executed evidence](evidence/QGAME-MATH-001/README.md).
Quantum-inspired means classical finite mechanics, not quantum simulation.
Exact algebra does not imply bit-exact floating-point physics, rendered pixels
or speaker output.

**Mod SDK foundations (experimental):**
[MOD-SDK-001](docs/MOD_SDK_001.md) provides a versioned, bounded data-only
manifest registry with exact-version dependencies and transactional lifecycle.
[MOD-SDK-002](docs/MOD_SDK_002.md) adds typed course adapters and cardinal
circuit math; QGAME adds typed experiment packs. These are shipped foundations,
while a full game kit and executable plugin APIs remain future work.

**Exact course authoring:** The original decreasing-Z
[course bridge](docs/ALIEN_COURSE_BRIDGE.md) and newer cardinal circuit format
coexist. The documented [DRONE-RACER v0.2.0 integration](https://github.com/QSOLKCB/DRONE-RACER/releases/tag/v0.2.0)
consumes the Q16.16 gate bridge while retaining independent Float64 flight.
[Play source-owned DRONE-RACER](https://qsolkcb.github.io/DRONE-RACER/).

**Visual Workbench:** The released [Component Forge](docs/COMPONENT_FORGE.md)
provides schema-v2 components, XYZ movement/scale handles, Y-yaw rotation,
snapping and component-driven Play mode. Existing v1 scenes migrate explicitly.
[Local OBJ/PNG assets and prefabs](docs/ASSET_FOUNDRY.md),
[search, keyboard navigation, framing and recovery](docs/EDITOR_QOL.md), and
[exact decimal/Q16 position tools](docs/EDITOR_ALIEN_AUTHORING.md) extend that
foundation. Playable HTML exports use locally served engine directories;
they are not self-contained engine bundles.

**Optional rendering:** Kinetic Foundry and Orbital Proving Ground start on CPU.
Compatible WebGPU/WASM acceleration requires explicit opt-in; simulation ticks
remain independent of the renderer. The editor can include this choice in
exported games. [Controls, export instructions and budgets](docs/OPTIONAL_GPU_WASM.md).

## Published milestones

| Release | Main additions |
| --- | --- |
| [v1.7.0 — Reply to Your Own Tweets Edition](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.7.0) | Ternary Constellation, data-only Mod SDK foundations, exact course/circuit authoring, editor QoL and distinct GPU/space labs |
| [v1.6.0 — Operation ALIEN MATH](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.6.0) | Exact rational mathematics, explicit Q16.16 conversion, geometry, D4 symmetry, graph invariants and formal correspondence |
| [v1.5.0 — The Component Forge](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.5.0) | Typed scene components, transform handles, snapping and component-driven preview |
| [v1.4.0 — The Proof of Speed](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.4.0) | Source-bound CPU/RTX evidence, complete-output parity and offline-cache negative controls |
| [v1.3.0 — The Invariant Machine](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.3.0) | Bullet Time and ARCADE labs, independent time domains and packaged offline delivery |
| [v1.2.0 — You Didn't Invent Doom Edition](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.2.0) | Independent Q16.16 scalar arithmetic, radix optimization and formal-verification evidence |

The earlier [v1.1.1](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.1.1)
added exact vectors, terrain/ballistics and the explicit WebGL API;
[v1.1.0](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.1.0)
introduced the integer engine and replayable Integer Foundry.
[The Clockwork Vault](demos/clockwork-vault/index.html) remains the
v1.0.0 showcase: six OMI seals in one expedition.

Release names above follow the published GitHub tags.
`package.json` and `MODULES.json` still carry `1.0.0` metadata;
those fields do not identify the latest published milestone. API maturity
remains experimental across these releases.

## ALIEN MATH and research boundaries

The ALIEN-MATH-001–FINAL programme shipped in v1.6.0 and remains available:

| Contract | Scope and evidence |
| --- | --- |
| [001 — Exact rationals](docs/ALIEN_MATH_001.md) | Bounded BigInt fractions and decimal-string authoring, checked with independent Node/Python oracles |
| [002 — Rational/Q16 conversion](docs/ALIEN_MATH_002.md) | Six explicit rounding policies, rejection or opt-in saturation, and 25,020 independent Python outcomes |
| [003 — Intervals and XY geometry](docs/ALIEN_MATH_003.md) | Closed intervals, orientation, segment relations and rectangle classification; 2,066 oracle cases and 4,000 metamorphic checks |
| [004 — D4 symmetry](docs/ALIEN_MATH_004.md) | Exact origin-centred rational XY point/box actions, composition, inverses and squared distance |
| [005 — Graph invariants](docs/ALIEN_MATH_005.md) | Exact characteristic polynomials and rational density; no graph-isomorphism or physical-spectrum claim |
| [006 — Formal correspondence](docs/ALIEN_MATH_006.md) | 21 Lean model theorems, audited assumptions and 856 three-way finite observations |
| [FINAL — Audit and source capsule](docs/ALIEN_MATH_FINAL.md) | Reproducible source packaging, draft publication metadata and explicit OPEN refinement obligations |

The model proofs and finite checks do not establish universal JavaScript or
ECMAScript refinement. Historical Q16/SPARK proof boundaries remain separate.

**QFLOAT-001 (experimental):** The [native QFloat facade](docs/QFLOAT_001.md)
quantizes decimal authoring into checked Q16.16. Its executed ARCADE browser
witness is preserved in the [evidence record](evidence/QFLOAT-001/README.md)
and the published [QFLOAT research prerelease](https://github.com/QSOLKCB/VANILLAJS/releases/tag/qfloat-001-research.1).
It is not a general floating-point replacement.

**CI-INVARIANT-001:** [Auditable browser reuse](docs/BROWSER_INCREMENTAL_CI.md)
requires matching source, dependencies, verifier inputs and three authenticated
reviewed-main executions. Missing approval protection or other qualification
evidence fails closed to real Chromium execution. Node, package and archival
checks still run.

[Proof of Speed contract](docs/PROOF_OF_SPEED.md) ·
[Offline build & OPT contracts](docs/DONOR_LABS_OFFLINE.md) ·
[Integer engine](docs/INTEGER_ENGINE.md) ·
[Geometry layer 2](docs/GEOMETRY_LAYER2.md) · [Module catalogue](MODULES.json)

## You Didn't Invent Doom Edition — exact Q16.16 and formal verification

**Modern convenience. Minimal dependencies. Old-school correctness.**

The integer simulation subsystem underwent an independent Q16.16 rewrite in
[PR #46](https://github.com/QSOLKCB/VANILLAJS/pull/46), followed by the
GALAXY-inspired numerical optimization in
[PR #47](https://github.com/QSOLKCB/VANILLAJS/pull/47).

- **Q16.16 simulation:** 65,536 subunits per metre; signed-int32 state,
  exact truncation toward zero, explicit overflow rejection and canonical zero.
  Existing RNG, engine snapshots and deterministic replay are preserved.
- **Optimized scalar mathematics:** safe-integer arithmetic fast path,
  corrected radix-65,536 quotient digits, and fast square-root estimates
  accepted only after exact integer-square bracketing.
- **Optional GLUBALL/QEC techniques:** exact u64 logical sampling,
  bounded partitions, and reversible GF(3) periodic lattice transforms
  validated against six pinned finite QEC fixtures. They are not changes
  to authoritative gameplay physics.

The design and limitations are documented in
[Q16-INDEPENDENT-001](docs/Q16_INDEPENDENT_REIMPLEMENTATION.md),
[Q16-GALAXY-RADIX-001](docs/Q16_GALAXY_RADIX.md), and
[GLUBALL/QEC numerical research](docs/GLUBALL_QEC_FIXEDPOINT_RESEARCH.md).
Preliminary numerical microbenchmarks are workload-specific, **not**
universal game-engine, GPU or frame-rate improvement claims.

### Q16-FORMAL-001 — Lean theorem and source-conformance evidence

Merged [PR #48](https://github.com/QSOLKCB/VANILLAJS/pull/48)
introduces **14 Lean 4.35.0 kernel-checked theorems** for quotient
certificates, exact radix-prefix invariants, signed bounds, precision
limits and integer square-root bracketing. The proof audit checks
every named declaration's transitive axioms, accepting only the
standard `propext` and `Quot.sound` where applicable. The successful
run reported no `sorryAx` or custom axioms.

The separate, finite BigInt oracle checked the exact production
`modules/integer-math/index.js` source (Git blob
`d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9`):

| Executed verification | Observed result |
| --- | ---: |
| Lean mathematical theorems | 14 PASS |
| Accepted exact quotient cases | 220,921 PASS |
| Expected arithmetic rejection cases | 33,992 PASS |
| Integer square-root brackets | 200,009 PASS |
| Existing Q16 regression tests | 17 PASS |

[Successful Lean proof CI](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42463350488)
· [Proof and claim boundaries](docs/Q16_FORMAL_001.md)
· [QSOL formalization context protocol](https://github.com/QSOLKCB/Private-Context-For-Formalization)

**Scope:** A Lean proof establishes named mathematical propositions.
Finite source-pinned testing supports the observed JavaScript implementation,
but does not prove full ECMAScript refinement, historical authorship,
copyright ownership, or the absence of copied material throughout history.
Existing provenance notices and Git history remain independently inspectable.

To reproduce after installing the toolchain pinned in `lean-toolchain`:

```sh
python3 scripts/verify-q16-proof-boundary.py
lake build Q16Formal
lake env lean Q16Audit.lean | tee q16-axiom-audit.txt
python3 scripts/verify-q16-axioms.py q16-axiom-audit.txt
node scripts/q16-formal-bridge.mjs
```

Lean is a development-time proof tool; the browser runtime remains dependency-free.

**Owner workstation (offline-first):** After a reviewed merge to `main`, open
[Q16-FORMAL-001 owner local Lean proof](.github/workflows/q16-formal-local.yml)
under **Actions → Run workflow**, choose `main`, and explicitly authorize
local execution. It targets the already-registered
`[self-hosted, linux, x64, qsol-rtx5060ti]` runner. This workflow requires a
**pre-installed or cached Lean 4.35.0** and an existing Node executable; it
does not fetch a toolchain or run any unreviewed PR code on your desktop.
Proof logs and a SHA-256 integrity manifest remain under
`~/.local/state/qsol/vanillajs/q16-formal/` by default. Artifact upload is
off unless the owner explicitly enables it. If Lean is unavailable, the
workflow fails with a prerequisite diagnosis rather than marking a theorem
as failed. The GitHub-hosted CI remains a separate validation surface.

## Qwen3-VL 2B text/image response isolation

The owner-only, no-API-credit
[QWEN2B-ISOLATE-001](experiments/freedm-open/QWEN2B-ISOLATE-001.md)
isolates the previously observed empty final output from the 2B
vision model. A pinned 14-case text-only versus original-game-image
matrix varies JSON schema mode and thinking settings, with local
Ollama version, model digest and complete source-bound JSON receipts.
It neither runs the FreeDM engine nor modifies the four-player live gate.

## FreeDM open-weight model comparison — experimental

The separate [FreeDM open-model FPS lab](experiments/freedm-open/README.md)
compares four small, locally hosted vision-language models against the **exact
48-screen Terra match evidence** (original Actions run 42374695320).
Qwen3-VL 2B/4B, Qwen2.5-VL 3B and Moondream 1.8B are executed through the
local-only Ollama API. A paired screenshot replay establishes behavioral
agreement and inference latency without randomized-spawn confounding.
A separately selected real four-client FreeDM pilot collects actual gameplay
but is explicitly marked exploratory because local model inference latency
and spawn conditions differ.

Both modes run **only after owner workflow dispatch on reviewed main**.
No paid API credentials, cloud inference, automatic model downloads or changes
to the previously preserved Terra/RTX evidence are involved.

## Experimental FreeDM × Four Terra deathmatch

The independent [FreeDM/Terra FPS research lab](experiments/freedm-terra/README.md)
introduces an **owner-dispatched, opt-in four-player Doom-engine deathmatch**
using the FreeDM WAD, four real local ViZDoom peers and four separate
GPT-6.1 Terra vision agents. It is *not* a browser runtime dependency,
packaged game or automatically running workflow.
An offline four-player smoke must pass before any API call. The per-dispatch
authorization is US$5 per agent (US$20 total), with nonrefundable conservative
pre-request reservations and no automatic retries. Source-bound screenshots,
action vectors, actual game counters, token usage and SHA-256 manifests
are collected outside the checkout. No self-hosted hardware or credits are
used by ordinary PR checks. See the lab README for local WAD setup and
the explicit owner-only [workflow](.github/workflows/freedm-terra-deathmatch.yml).

## Run the labs

Download or clone the repository, then serve its root with any static HTTP server:

```sh
python3 -m http.server 8000
# Open http://localhost:8000
# Visual Workbench: http://localhost:8000/demos/editor/index.html
# Ternary Constellation: http://localhost:8000/demos/quantum-game-lab/index.html
# 4X Game Lab: http://localhost:8000/demos/4x-game-lab/index.html
# Circuit Foundry: http://localhost:8000/demos/circuit-mod-lab/index.html
# Course Foundry: http://localhost:8000/demos/alien-course-lab/index.html
# Kinetic Foundry: http://localhost:8000/demos/gpu-lab/index.html
# Orbital Proving Ground: http://localhost:8000/demos/space-lab/index.html
# Graph & Spectral Lab: http://localhost:8000/demos/graph-lab/index.html
# Bullet Time Lab: http://localhost:8000/demos/bullet-time-lab/index.html
# ARCADE Lab: http://localhost:8000/demos/arcade-lab/index.html
# 2D Foundry: http://localhost:8000/demos/2d-lab/index.html
# Integer Foundry: http://localhost:8000/demos/integer-foundry/index.html
# Interaction Lab: http://localhost:8000/demos/interaction-lab/index.html
# FPS Lab: http://localhost:8000/demos/fps-lab/index.html
# RTS Lab: http://localhost:8000/demos/rts-lab/index.html
# OMI Lab: http://localhost:8000/demos/omi-lab/index.html
# Brass Engine: http://localhost:8000/demos/ancient-machine/index.html
# Clockwork Vault: http://localhost:8000/demos/clockwork-vault/index.html
```

Running the browser labs from source needs no build, npm runtime dependency,
CDN, account or backend. Bundled scenes use procedural geometry; the Workbench
also supports explicitly imported local assets. Flight, Interaction, FPS,
Integer Foundry and Clockwork Vault use WebGL 1. The optional-rendering labs
start on Canvas 2D; other labs use Canvas, SVG and DOM controls. Unsupported
graphics are reported visibly, with numerical fallbacks where supported.
Serve over HTTP(S): opening `file://index.html` is not supported by the
ES-module entrypoints. The local server works without internet access.

For a packaged build with offline reload, use Node.js 22+ once before serving:

```sh
node scripts/build.js
node scripts/verify-offline.js
python3 -m http.server 8080 --directory dist
# Open http://localhost:8080
```

Only the built `dist/` includes the generated service worker and hash manifest.
On HTTPS or localhost, a successful initial install verifies and caches the
packaged assets for subsequent offline navigation. An unbuilt source checkout
does not install this worker. See [offline delivery and limits](docs/DONOR_LABS_OFFLINE.md).

## 2D Foundry — gameplay movement, sound and ternary memory

The experimental <a href="demos/2d-lab/index.html">2D Foundry</a> combines
four integer-tick movement styles (RTS, shooter, platformer, top-down driving),
existing A* pathfinding and flow-field architecture, pure local PCM16 sound
effects, and a bounded 27-column ternary data store for UTF-8 `.txt` and
canonical `.json` documents. A reusable base-3 LUT and OPT-style invariant
snapshot reuse reduce redundant conversion without sacrificing independent
snapshot ownership.

**This is a 2D-first foundation, not a 3D engine or a persistent database.**
The 2D simulation has +Y up and explicit integer coordinates. The browser
converts them only for Canvas 2D; a future 3D adapter can map X/Y to a
documented world plane without rewriting source events. The ternary grid
is a lossless encoding, not compression, cryptography, storage hardware or QEC.
Save/restore explicitly downloads/uploads JSON; there is no automatic cloud
or disk persistence.

Strict sound effects are generated from sample-indexed integer PCM,
then optionally played through the browser's device pipeline; live playback
is **not** an identity-bearing renderer. All modes use independently tested
bounded input state. See [2D Foundation](docs/2D_FOUNDATION.md) for APIs,
replay claims, OPT evidence, and optional owner RTX / agent evaluation.
Hardware and OpenAI API services are never triggered by a push or pull request.

## November donor upgrade — clock pacing, lead solving and vault graphics

The pure-JS `FixedClock` optionally accepts `snapTolerance:.0005` (seconds)
to smooth browser-rounded presentation timestamps while **repaying every
accumulated clock adjustment**. The default is zero and preserves existing
timing behaviour. The `lead-solver` module computes bounded constant-velocity
intercepts, including configurable shooter-velocity inheritance. It returns
`null` for unreachable targets and does not implement gravity, target
acceleration, occlusion or gameplay auto-aim. Both features are independently
tested without changing existing games.

The Clockwork Vault now publishes its initial WebGL scene before signalling
graphics readiness. Its packaged browser test requires this first render and
samples a bounded number of actual animation frames, retaining the existing
visible-pixel threshold rather than accepting a blank canvas.

See the [source-pinned donor review, APIs and test limitations](docs/DONOR_UPGRADE_2026_11.md).
The completed owner-dispatched validation is preserved as
[RTX5060TI-005](evidence/RTX5060TI-005/README.md), with separate native WebGL
and CPU pacing/interception receipts. Further hardware runs require an explicit
**owner dispatch on reviewed main**. CPU numerical timings are not GPU-compute
or game FPS claims; RTX001–005 remain immutable historical evidence.

## BLOAT-OPS, NEXUS and UFF experimental research kernels

Four opt-in modules add a conservative Euclidean distance prefilter,
source-pinned complete integer replay validation, a bounded reversible
cuboctahedral Z4 lattice, and physically grounded **Newtonian orbital motion**
with explicit SI units and a velocity-Verlet integrator. The NEXUS model is
classical and its published Lean proofs do not automatically prove this new
JavaScript implementation. UFF's empirical extra-field galaxy model is
**not** represented as established physics. Existing simulation, collision
and rendering systems are unchanged.

Read the [source-pinned mathematical/physics contract](docs/BLOAT_NEXUS_UFF.md)
and use the new opt-in modules deliberately; no GPU or FPS improvement
is claimed from them until independently measured.

The completed [RTX5060TI-004 validation](evidence/RTX5060TI-004/README.md)
preserves three same-protocol native WebGL comparisons and a separate CPU-only
numerical report. The numerical kernels were not accelerated on RTX.
Further owner-only runs require reviewed `main`; the workflow has no PR/push
trigger, and hardware use and artifact upload are individually opt-in.

## QwakeTF-style reusable broadphase scratch

The existing `StaticAABBIndex` gains an opt-in `collectCandidates()` method,
which writes the same sorted candidate indices into a caller-reused array.
The original allocating `candidates()` remains the reference. Paired serial
measurements and exact candidate-set tests are documented alongside the
[pooled navigation experiment](docs/NAVIGATION_POOL.md).

## ARCADE-inspired idle frame reuse

An opt-in `FrameGate` uses explicit complete presentation keys to avoid
clearing or drawing unchanged images. Its synchronous transactional boundary
rejects failed renders and invalidates after resize, context change or an
explicit call. The original game loops and WebGL API are unchanged.
See [source-pinned contract and owner-only RTX comparison](docs/FRAME_GATE.md).

## Experimental pooled navigation

QwakeTF v0.2.0's exact-parity OPT work inspired a serial **pooled A***
workspace in `modules/navigation-pool`. It retains typed-array scores,
parents and a parallel heap across queries against the same immutable grid,
with generation stamps rather than full-array clearing. The original
`navigation.findPath` remains the authoritative reference and existing game
callers are unchanged. Full route and expansion parity is mandatory;
[see the source-pinned contract and workload](docs/NAVIGATION_POOL.md).

## Renderer-independent appearance composition

The opt-in `appearance` module adapts the **source-pinned colour-LUT,
deterministic actor variation, bounded hit-volume and high/low-detail emission**
architecture from QSOLKCB/CorpoWars3d PR #8. It compiles caller-defined
cuboid parts and emits them through one callback to either a software
renderer or the retained `CuboidStream`. No CorpoWars3d characters or artwork
are imported. [See the API and provenance contract](docs/APPEARANCE.md).

## Opt-in adaptive query and cuboid streaming kernels

The experimental `adaptive-circles` module compares a serial all-pairs
swept-circle reference with a bounded uniform-grid broad phase, switching
paths only above a configurable item count. The new `cuboid-stream`
module packs 12-float actor/geometry instances into retained CPU storage.
Both are informed by pinned GAMES and CorpoWars3d donor experiments and
retain independent parity and failure tests. Existing renderers and games
are unchanged. See [scope and source provenance](docs/ADAPTIVE_DONOR_EXTRACTION.md).

The completed adaptive/retained workload measurements are preserved in
[RTX5060TI-002](evidence/RTX5060TI-002/README.md), separately from RTX5060TI-001.
The [owner-run validation protocol](docs/RTX5060TI_ADAPTIVE_VALIDATION.md)
remains available for explicitly dispatched checks on reviewed `main`.
These source-pinned observations do not establish a universal GPU or FPS gain.

## Optional terrain and ballistic kernels

A small, pure-JS extraction from the owned Ski-Shooter and CorpoWars3d games
adds triangulated terrain sampling/sweeps and closed-form gravity stepping.
See [API boundaries and pinned donor provenance](docs/TERRAIN_BALLISTICS.md).
Neither kernel replaces the existing character solver, Integer Foundry or renderer.

## Integer engine — checked Q16.16 simulation

The integer core runs authoritative game state on checked signed 32-bit fixed-point
values: **65,536 subunits per metre**, integer ticks and exact
16-bit-limb scalar arithmetic with an optimized radix-65,536 quotient path.
Exact raw vector operations continue returning BigInt where required by the API.
The core provides atomic kinematic world updates,
static box collision, seeded integer randomness, canonical snapshots and bounded
input replay. Browser presentation converts positions to metres at the renderer.
No hardware oscillator, server, third-party engine or runtime package is needed.

**Integer Foundry** is the first complete recipe: climb four gantries, recover
power cells, then verify your recorded inputs against the full game state. A/D or
arrows move, Space jumps, Escape pauses; on-screen controls support touch.
The 120 Hz demo caps recording at 36,000 ticks. Serve locally as above, then open
`demos/integer-foundry/index.html`.

Existing flight/FPS controllers still use their original floating-point APIs.
This is an additive engine foundation, not a claim that all existing physics has
been converted. Static axis-ordered boxes are supported; dynamic rigid bodies,
rotations, slopes and moving platforms are outside the integer contract.
See [API, bounds and migration](docs/INTEGER_ENGINE.md).
The separate [integer-vector operators](docs/INTEGER_VECTORS.md) provide checked
3D fixed-point sums, widened dot/cross products, exact squared distances and
rational interpolation. They are experimental; existing gameplay paths are unchanged.

## Flight Lab

| Experiment | Flight model | Objective |
| --- | --- | --- |
| **The conduit** | Assisted 6DOF with velocity and angular stabilisation | Thread six signals through an industrial tunnel |
| **Open orbit** | Inertial 6DOF; momentum persists after releasing thrust | Visit six navigation beacons among static blocks and a docking structure |

Both use `createBody`, `stepFlight`, `FixedClock`, the same collision module and
the same renderer. Only world data and flight configuration change. The name
Open orbit describes the space setting: gravity and orbital mechanics are not
implemented. Signal acquisition uses a swept centre segment within each beacon's
acceptance sphere; rings are visual guides, not physical obstacles.

Tune thrust acceleration, angular acceleration, assistance and simulation speed
in the side panel. Hold **B** for quarter-speed bullet time; it scales simulation
time while keeping the interface responsive. Timing and physics use a fixed
120 Hz update with interpolated rendering. Long stalls have bounded catch-up.

| Action | Keyboard / pointer | Standard gamepad |
| --- | --- | --- |
| Forward / reverse, strafe | W / S, A / D | Left stick |
| Rise / descend | Space / Ctrl | RT / LT |
| Pitch / yaw | Mouse look (click view to capture), or arrow keys | Right stick |
| Roll | Q / E | LB / RB |
| Brake translation and rotation | Hold X | Hold A |
| Bullet time | Hold B; or use the time slider | Use the time slider |
| Pause / resume | Esc or the Pause button | Menu after launch |
| Restart | Reset | On-screen Reset |

Expand **Mouse, touch & gamepad controls** for on-screen flight buttons. Multiple
simultaneous pointers are supported. Launch, then click the view for captured mouse
look: moving turns the view directly; stopping stops the turn. Mouse takeover
levels roll, limits pitch just short of vertical and clears existing angular
momentum. Translation still follows the selected flight model. Arrows and Q/E
retain their original torque controls, including inertial angular coasting.
Escape releases the cursor and pauses; resume, then click to capture again.
Touch or denied/unavailable pointer lock uses relative drag-to-look with the same
no-spin behaviour. Keyboard controls still provide every flight axis.

Blur, hidden tabs and controller disconnect pause play. Resume is deliberate;
held inputs are cleared, and gamepads must return to neutral. Unmapped gamepads
are ignored rather than guessed. Experiments are session-only, with no saved
scores or progression. Menus support keyboard navigation and status announcements;
the 3D flight itself requires visual/spatial interaction.

## Interaction Lab

Open **Interaction Lab** from the Flight Lab header. Both new recipes share the
projectile system, conditional rule resolver and WebGL renderer:

| Recipe | Try this | What it demonstrates |
| --- | --- | --- |
| **Target practice** | Fire at a drone, open its shield field, then land four hits | Inertial 6DOF flight, swept shots, conditional damage and spent targets |
| **Reaction Bench** | Fire with ignition off; enable ignition; remove the O₂ feed; compare neon and an empty chamber | Successful, blocked and resisted outcomes with explicit reasons |

**Left click** while captured, **F**, or the on-screen **Fire** button shoots.
Clicking the view first captures mouse look without firing; arrows still turn. Target
practice retains WASD / Space / Ctrl / Q / E flight and X braking. Reaction Bench
uses a stationary observation point. **Line up a shot** repositions the camera,
clears projectiles and pauses; resume deliberately. Controls also support touch
and keyboard-activated buttons. These new recipes do not sample gamepads.

Pause, blur and hidden tabs freeze movement, projectile lifetimes and cooldowns.
Cancelled firing requires a fresh press. Slow motion scales the same simulation
clock. A bounded impact trail records the selected rule and missing conditions;
**Inspect the last outcome** exposes the structured result for debugging.

Chemistry examples are symbolic, source-backed rules with reusable specimens,
not quantitative chemistry simulation. See [model limits and sources](docs/INTERACTION_LAB.md).
No Reaction Rumble code, artwork or data is included.

## FPS Lab

Open **FPS Lab** from either lab header, then choose a proving ground:

| Recipe | Try this | Shared systems |
| --- | --- | --- |
| **Footwork** | Walk up four 25 cm steps, jump the amber hurdle, pass through the doorway and reach four markers | Upright character, static collision, eye pose and input |
| **Live range** | Clear three plates; compare instant traces and travelling bolts; empty and reload a magazine | The same character plus weapon timing, queries, projectiles and conditional effects |
| **Low passage** | Duck through two low roofs, stand in the open bay and reach the finish | Safe stance changes, headroom checks and crouched movement |
| **Tracking range** | Lead moving plates with travelling bolts; compare instant traces | Relative-motion queries, target interpolation and pause-safe tracks |
| **Clearance lift** | Ride up, duck under the beam and step onto the upper deck | Translating body collision, platform support and a safe clearance stop |
| **Shuttle run** | Ride across the gap, then walk or jump onto the far dock | Carry, jump-off momentum, landing and fall recovery |

Launch, then click the view for mouse look. **WASD** moves, **Space** jumps,
**Shift** sprints, hold **C** to crouch, **arrows** aim, captured **left click / F** fires, and **R**
reloads. Escape releases the cursor and pauses. On-screen controls and relative
look dragging remain available. A brief jump/fire/reload press survives until
its next physics tick. Pause clears controls and freezes ammunition timers;
resume requires fresh presses. The range's alignment buttons pause and reposition
the character while preserving ammunition and scores.

The default controller walks at 5 m/s, sprints at 8 m/s, and climbs steps up to
30 cm. Crouching lowers the 1.8 m body to 1.08 m and targets 2.5 m/s; releasing
C stands only when there is headroom. Feet stay in place and the eye follows the
stance. It is an upright **rectangular box**. Static courses retain automatic
stairs; the platform controller adds translating surfaces, riding and jump-off
momentum. On a blocked platform tick the demo stops the route while your controls
stay active: duck or move clear to continue. **Reverse route** pauses and changes
travel direction. Slopes, capsules and rotating platforms remain future work. See
[FPS contracts](docs/FPS_LAB.md).

## RTS Lab

| Recipe | Try this | Shared systems |
| --- | --- | --- |
| **Route planner** | Click open ground, run the route, then close the north gate | Grid snapshots, shortest paths, replanning and fixed ticks |
| **Squad orders** | Drag to select units, right-click a destination, watch them regroup | The same path search plus reachable unique destinations and cell reservations |
| **Flow convoy** | Deliver 24 couriers, move their depot, or close a gate | Incremental shared directions and safe field rebuilding |
| **Two-exit evacuation** | Evacuate 36 units; close the north exit to redirect the group | Multi-source nearest-exit fields and shared traffic reservations |

Plan while paused, then **Run routes**. Mouse drag selects; right-click moves.
Touch uses **Select / Move** tools and map taps. The roster and **Select all**
provide larger selection controls. With the map focused, arrows move the cursor,
Enter applies the tool, Space orders a move, and A selects all. Escape and lost
focus pause, cancelling unfinished gestures. Accepted orders persist on resume.

The lab uses four-neighbour cell movement and a bounded, game-owned traffic
policy. Units wait instead of swapping or overlapping; automatic retries may
still reach a stand-off. Reorder or stop selected units to resolve it. This is a
small routing slice; continuous steering and reciprocal body physics remain
future work. The flow recipes build one field over bounded fixed ticks, then
share it across every unit. Delivered units leave the map. Field rebuilding
freezes new cell moves until the new grid/destination map is complete.

See [RTS contracts and limits](docs/RTS_LAB.md) and the
[recorded search-work comparison](docs/FLOW_FIELDS.md). On the 64×64, 512-request
scenario, individual A* settles 809,826 cells; one shared field settles 3,655,
followed by 512 samples. These are search-operation counts, not measured FPS.

## Modules

The catalogue contains **50 experimental modules**. Import each through
`modules/<name>/index.js`; [MODULES.json](MODULES.json) records the exact
dependency closure and environment for every entry.

| Module names under `modules/` | Responsibility |
| --- | --- |
| `math` | Vectors, quaternions, camera matrices and seeded random numbers |
| `time`, `time-domains` | Fixed ticks, interpolation, independent clock domains, pause and catch-up limits |
| `integer-math`, `integer-vector`, `integer-time`, `integer-physics`, `integer-engine`, `integer-replay` | Checked Q16.16 simulation, exact vector intermediates, canonical snapshots and bounded replay |
| `flight`, `character`, `collision` | Assisted/inertial flight, upright movement and static/translating AABB collision |
| `projectiles`, `weapons`, `interactions`, `lead-solver` | Swept shots, weapon timing, conditional effects and constant-velocity interception |
| `input` | Pure action state, keyboard/mouse adapters and standard gamepad sampling |
| `navigation`, `navigation-pool` | Grid A*, shared flow fields, formations and reusable search workspaces |
| `geometry`, `terrain`, `ballistics`, `adaptive-circles`, `range2d` | Geometry batching/indexing, terrain queries, gravity stepping and bounded query kernels |
| `render-webgl`, `cuboid-stream`, `appearance`, `frame-gate`, `render-optional` | WebGL rendering, retained streams, appearance composition, idle reuse and CPU-first optional acceleration |
| `motion2d`, `audio2d`, `ternary-store2d` | Integer movement, procedural PCM/WAV and bounded ternary document encoding |
| `orbital-physics`, `nexus-lattice`, `logical-sampling`, `gf3-lattice` | Classical orbits and separate bounded numerical/lattice research kernels |
| `qfloat` | Decimal-authoring facade over checked Q16.16 |
| `exact-rational`, `rational-q16`, `exact-interval`, `exact-geometry`, `exact-d4`, `exact-graph` | Exact authoring, explicit quantization, geometry, symmetry and graph invariants |
| `exact-course`, `exact-circuit` | Exact checkpoint compilation, swept crossings and cardinal circuit progression |
| `mod-sdk`, `mod-course`, `mod-experiment` | Transactional data-only registry and typed course/experiment packs |
| `gf3`, `symbolic-events` | Exact finite-field operations, symbolic scores and reference audio events |

API maturity remains **experimental in v1.7.0**. Use a tagged release or exact
commit, preserve the directory structure and record what your game imports.
Pure simulation/math modules do not read the DOM or ambient time; rendering
and input adapters have the browser requirements declared in the catalogue.

## OMI Lab — research experiment

**Credit: Brian Thorne's ARCH OMI.** [ARCH-OMI-001](docs/ARCH_OMI.md) implements
the pinned sixteen-bit rotate/XOR delta law and an explicit VANILLAJS encoding
of four nibble-valued tetrahedral vertices. Inspect the four faces, flip an
observed edge bit, apply reversible masks and survey all 65,536 words.

The exhaustive result distinguishes **return after eight steps** from **minimal
period eight**: 8 words have period 1, 56 period 2, 4,032 period 4 and 61,440 period 8.
An independent arithmetic oracle agrees on every output. Six derived edge
differences have only 4,096 patterns, each shared by sixteen words; closure does
not establish absolute identity or detect every coordinated change.

This lives under `experiments/arch-omi/`, separate from the game modules. Source
pins, encoding choices, API boundaries, controls and the executed evidence are
documented together. It adds no runtime dependency and makes no pathfinding,
physics, cryptographic, compression, RNG or speedup claim.

## The Brass Engine — a mechanical OMI demonstration

[Turn the crank](demos/ancient-machine/index.html) of an imagined ancient
calculating instrument: four hexadecimal drums, an eight-detent cam, visible
rotation/XOR lanes and a bounded receipt tape. Seven detents prepare the result;
the eighth latches one exact OMI delta step. Reverse individual detents, advance
a whole revolution or run the 120 Hz integer-tick motor.

Save and restore a local JSON replay at any partial position. Pause, Escape and
focus loss freeze the motor; continued input requires a fresh press. Reduced
motion, keyboard operation and narrow touch layouts are supported. This is a
fictional mechanical presentation of discrete logic, not a historical replica or
physical analog solver. [Mechanism and replay contract](docs/BRASS_ENGINE.md)
include exhaustive evidence and attribution to **Brian Thorne’s ARCH OMI**.
It remains demo-owned; no new core API or game recipe is added.

## The Clockwork Vault — v1.0.0 showcase

[Enter the vault](demos/clockwork-vault/index.html): walk through one original
chamber, operate six OMI consoles, raise gates and a causeway, ride a counterweight
lift, and reach the keeper’s exit. WASD/mouse, arrow look and on-screen touch
controls compose existing modules without a new engine or runtime dependency.

Each console reuses the Brass Engine’s eight-detent calculation and adds XOR
levers. Independently verified shortest solutions increase from two to seven
commands. Bounded hints guide the next step; undo cancels a pending revolution
or reverses a command. Released seals stay released. Local JSON saves preserve
player pose, moving mechanisms, command histories and partial motor ticks.

**1.0.0 names the completed showcase milestone.** It does not silently promote
experimental module contracts or OMI research to stable APIs. [The game contract
and evidence](docs/CLOCKWORK_VAULT.md) document input cancellation, save validation,
approximation limits and attribution to **Brian Thorne’s ARCH OMI**.

## Explicit GPU API (experimental)

The optional [`/api/webgl` device](api/README.md) offers retained XYZ/RGB
buffers, exact Float32 change detection, partial vertex updates, explicit
frame submission, cached GL state and fail-closed recovery. It uses the
existing browser WebGL1 standard with no new runtime dependency or scene graph.
It does **not** replace the normal renderer or retroactively claim an RTX
performance improvement. Hardware measurements remain separately pinned.

## Development and verification

Node.js 22+ is development tooling only. There is no `npm install` for these checks:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/proof-speed.mjs --check
node scripts/navigation-workload.js --check
node scripts/verify-omi.js --check
node scripts/verify-machine.js --check
node scripts/verify-vault.js --check
node scripts/opt-render-workload.js --check
# Optional formal verification (requires pinned Lean in lean-toolchain)
lake build Q16Formal
lake env lean Q16Audit.lean | tee q16-axiom-audit.txt
python3 scripts/verify-q16-axioms.py q16-axiom-audit.txt
node scripts/q16-formal-bridge.mjs
```

The build stages an allowlisted `dist/` and generates `manifest.json` with sizes
and SHA-256 hashes, plus the content-versioned offline service worker. The
manifest identifies packaged bytes; it is not a signature.
`npm test`, `npm run check`, and `npm run build` are optional aliases.

The [ALIEN MATH audit](docs/ALIEN_MATH_FINAL.md) and
[QGAME reproduction guide](docs/QGAME_MATH_001.md) list the independent Python
oracles and source-pinned proof/evidence checks. Python uses its standard library;
Lean is required only for the formal-verification gates.

CI uses pinned Playwright 1.64.0 outside the checkout and verifies seven
packaged Chromium suites under `/VANILLAJS/`, with software WebGL where required.
[Browser reuse](docs/BROWSER_INCREMENTAL_CI.md) is allowed only for independently
qualified reviewed-main witnesses; missing qualification executes the real suite.
Node, package integrity and archived evidence checks always run. Screenshots and
manifest are retained as the `flight-lab-evidence` artifact. See the verification
document for executed checks and remaining coverage limits.

## GitHub Pages

Set **Settings → Pages → Source → GitHub Actions**. Pull requests verify the
package without deploying. Pushes to `main` deploy the same artifact only after
simulation, contract and Chromium checks pass. The workflow separates read-only
validation from Pages deployment permissions. No tag or release is created by CI.

## Authorship and attribution clarification — COMMENT-001

**Maintainer statement (Trent Slade, QSOL-IMC): I did not steal or copy
the work of the X account referenced in COMMENT-001 into VANILLAJS.**
I dispute the copying/attribution allegation shown in the preserved screenshot.

VANILLAJS is developed within QSOL-IMC. Its original implementations, external
references and specifically adapted donor techniques are distinguished in
[NOTICE](NOTICE), the [technical provenance documents](docs/ARCHITECTURE.md)
and Git's source history. Where another QSOL repository informs a technique,
the source commit and licence are documented; that is not a claim of authorship
over the donor's work.

The screenshot documents an **allegation**, not proof of plagiarism; it does
not identify a matching file, commit, code excerpt or asset. See the dated
[COMMENT-001 evidence and full citation](evidence/COMMENT-001/README.md),
including Slade (2026), *COMMENT-001: YouTube comment incident and AI-mediated
attribution claims — an image dataset*, v1.1.0,
[DOI:10.5281/zenodo.24026140](https://doi.org/10.5281/zenodo.24026140).
This attribution statement is the maintainer's position; it is not represented
as an independent adjudication. Specific checkable source comparisons remain welcome.

## Scope and licence

This remains an experimental engine and authoring foundation. Body movement uses
static axis-aligned boxes or translating kinematic surfaces; shot queries also
track translating boxes. General reciprocal rigid-body contacts, oriented-box
contacts, friction, atmospheric flight and network synchronisation remain outside
the core contract. Individual labs can implement their own bounded responses,
such as ARCADE puck reflections.

Classical orbital gravity, procedural PCM audio, the Visual Workbench, local asset
imports and playable HTML export are available within their documented limits.
They do not establish a general N-body solver, full audio workstation, complete
game kit or executable-plugin sandbox. Numerical tolerances and runtime limits
are documented in [API.md](docs/API.md) and the feature contracts above.

The repository's existing [Apache-2.0 licence](LICENSE) is preserved. See
[NOTICE](NOTICE) for authorship and reference provenance. No ripped assets or
third-party game engine source are included.

## Owner-activated RTX 5060 Ti full-path validation

The optional [trusted local NVIDIA validation workflow](docs/RTX5060TI_TRUSTED_VALIDATION.md)
compares the exact pre-geometry-optimization SHA against reviewed `main` on a
physical RTX 5060 Ti, recording CPU geometry, collision, statistical allocations,
submitted GPU uploads, native pixel parity and observed frame timings.
It runs only on explicit owner activation, never in a normal push or PR build;
ordinary hosted CI performs syntax preflight and verifies the immutable-content
receipt, not a physical GPU rerun. The successful owner-run validation is now
preserved as [VANILLAJS RTX5060TI-001](evidence/RTX5060TI-001/README.md),
tied to commit `240617e8bc1a935f05eaf75a10531f194f72a173`.
The recorded gains are workload-specific and do not establish an FPS increase or
cryptographic hardware attestation.
The owner independently rechecked the frozen archive on Ubuntu on 2026-11-07;
see the [offline local verification record](evidence/RTX5060TI-001/LOCAL-VERIFICATION.md)
(PASS, matching SHA-256; not a rerun of GPU measurement).

The separately dispatched adaptive-kernel and retained-rendering benchmark is
preserved as [RTX5060TI-002](evidence/RTX5060TI-002/README.md), pinned to
`b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f`. Its original Actions ZIP
is byte-identical to the uploaded artifact and verified in hosted CI.
The new serial-circle and retained/fresh WebGL workloads have **no historical
RTX5060TI-001 equivalent**, and the observed results are not universal FPS claims.

The subsequent [RTX5060TI-003 and COMMENT-001 documentary record](evidence/COMMENT-001/README.md) includes the exact original and derived screenshots, independently pinned by SHA-256 and Git blob IDs. The screenshot records a disputed public allegation and the maintainer's response; it does not independently prove that copying occurred.

The successful ARCADE frame-invalidation comparison is recorded as
[RTX5060TI-003](evidence/RTX5060TI-003/README.md), tied to
`3f5518a168652a003e8db9aa6dc0371ddb4782ea`. Both original RTX001 and
RTX002 source candidates were rerun under the same current hardware protocol.
The new FrameGate workload achieved nine matching pixel checkpoints per pair
and omitted 39 of 48 draws; the measured completion-time benefit was modest
(10.4 ms vs 10.0 ms). This is **not a native-game FPS improvement claim**.

## Optional CPU / GPU graphics and space labs

See [the GPU/WASM and Space Game Lab guide](docs/OPTIONAL_GPU_WASM.md) for the experimental
CPU-first renderer, explicit player opt-in, editor project setting and playable
HTML export, exact-math preparation, resource limits, and local test commands.
The project v2 envelope preserves graphics policy; legacy v1 projects still load.
Existing WebGL APIs remain supported.
