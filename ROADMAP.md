# VANILLAJS roadmap

## v1.5.0 — The Component Forge (in development)

- Typed, bounded component data: Mesh Renderer, Collider, Rigidbody, Player Controller, Trigger, Camera, with Transform retained as canonical authored fields.
- Explicit v1 scene migration to canonical schemaVersion=2 without rewriting historical input documents; strict v2 serialization and per-component validation.
- WebGL XYZ transform handles and projected hit testing, local/world movement, Y-yaw rotation, local scale, snapping and undoable drag transactions.
- Component-driven fixed 60Hz Play mode using reusable VANILLAJS AABB movement and deterministic trigger-enter events; preserve Stop rollback.
- Future phases: full quaternion transforms, true rotated collision, mesh/material asset import, prefab composition and standalone game export.

See [Component Forge contracts](docs/COMPONENT_FORGE.md).

## Visual Workbench — Unity/Unreal-style authoring (alpha)

- **Now:** browser-native WebGL1 viewport, hierarchy, property inspector, root translation drag, undo/redo, validated JSON files and bounded fixed-step Play/Stop.
- **Next:** component architecture, transform gizmos, scene assets, deterministic replay and safe standalone game packaging; not implemented by this alpha.
- **Scope:** no third-party runtime, no cloud backend and no misleading claim of Unity/Unreal feature parity.
- **Motto:** Make amazing alien tech and put it under an Apache 2.0 license.

See [Visual Editor contracts](docs/EDITOR_WORKBENCH.md).

## v1.4.0 — The Proof of Speed (implementation under review)

- Source-bound seven-case paired CPU benchmark harness with exact full-output parity admission, independent negative controls, alternating AB/BA samples and archived raw receipts.
- Offline Service Worker torture tests: interruption, corrupt installs, post-install corruption, scope isolation and fail-closed recovery.
- Optional owner-only native RTX measurement and *separate*, owner-authorized, bounded OpenAI API adversarial research. No GPU or paid API on PR/push.
- Require complete hosted tests and browser validation before publishing a v1.4.0 tag. Performance regressions are reportable results, not a reason to weaken the test oracle.

See [Proof of Speed protocol](docs/PROOF_OF_SPEED.md).

## Experimental follow-up — Open-VLM vs Terra FreeDM

- Compare four small, locally installed vision-language model candidates:
  Qwen3-VL 2B, Qwen3-VL 4B Instruct, Qwen2.5-VL 3B, Moondream 1.8B.
- Pin the owner's actual 42374695320 Terra MATCH.json and 48 original
  screenshot SHA-256 identities. Replay identical selected source frames,
  in-game variables, prior actions and Terra role prompts through local
  Ollama before considering new game skill.
- Report per-model valid JSON rate, action agreement, exact model digest,
  prompt/screenshot hashes, local request times and explicit limitations.
  Similarity to Terra is **not** a gameplay correctness or superiority oracle.
- Optionally run a second real four-player open-weight FreeDM pilot using
  original ViZDoom worker topology. Rotate serialized GPU inference order;
  report genuine engine scores but don't falsely claim equal spawns/latency.
- Do not download any model, access a cloud endpoint or dispatch GPU
  execution in PR CI. Owner must approve manual main-only workflow.
  No OpenAI API credits or account keys are consumed.

See [FreeDM Open-VLM comparison](experiments/freedm-open/README.md).

## Experimental FPS research — FreeDM four-Terra match (owner only)

- Stage real FreeDM v0.13.0 MAP01 deathmatch with four independent local
  ViZDoom multiplayer peers (one host, three loopback joiners), not a
  synthetic FPS score generator.
- Each peer is controlled by GPT-6.1 Terra vision on actual 320×240 game
  screenshots; exclude privileged labels, depth, map coordinates and console.
- Owner-only manual workflow: no API spend on PR/push; mandatory zero-cost
  four-peer smoke, then up to 12 paid requests per role with US$0.40
  nonrefundable reservations, US$5 per role / US$20 per dispatch.
- Record original screenshot PNG hashes, API decisions and usage, exact
  button vectors, engine frag/death telemetry and checksum manifest.
  Honest failure/abort receipts; no claimed win until physically played.
- Infer targeting, cover, navigation and input-cadence hypotheses only;
  evaluate any VANILLAJS optimization separately with deterministic
  golden baselines and tested invariants.
- Keep all WADs and ViZDoom engine packages outside the deployable
  VANILLAJS game bundle. No changes to RTX001–005 or 2D Foundry archives.

See [FreeDM/Terra experiment](experiments/freedm-terra/README.md).

## v0.1.0 — Flight Lab

- Shared maths, fixed-step clock, input actions, rigid-body flight and static
  swept collision modules.
- Minimal WebGL renderer and two compositions: assisted tunnel, inertial arena.
- Live tuning, time scaling, pause lifecycle, keyboard, pointer and standard
  gamepad input; responsive controls and explicit unsupported-graphics handling.
- Contract catalogue, integration guide, simulation tests and browser CI.

## v0.2.0 — Interaction Lab

- Finite ray/segment queries against static boxes with stable nearest-hit ties.
- Bounded projectile motion, swept contact, lifetimes and ordered events.
- Declarative conditional effects with applied/blocked/resisted explanations.
- Space target practice and a small source-backed Reaction Bench recipe.
- Simulation regressions, packaged browser scenarios and composition contracts.

## v0.3.0 — FPS Lab (first FPS slice)

- Rectangular upright character collision, yaw-relative walking/sprinting,
  grounded jumping, bounded stair stepping and short downward ground snapping.
- First-person eye pose, existing mouse capture and new FPS action bindings.
- Simulation-time fire cadence, finite magazines/reserve and manual reloads.
- Footwork course and Live range compose the same controller. The range compares
  existing static hitscan and swept-projectile queries with conditional damage.
- Numerical, complete-course, weapon/lifecycle and packaged-browser checks.

## v0.4.0 — FPS motion

- Feet-anchored crouch/stand, configurable stance dimensions and speed, with
  headroom rejection and fresh-input lifecycle rules.
- Relative-motion segment queries and projectile stepping against translating
  AABBs, including lifetime clipping, occlusion and stable impact ordering.
- Low passage and Tracking range demonstrate stance changes and leading moving
  targets, while all six previous recipes remain available.
- Full-course and moving-range regressions plus additive packaged-browser checks.

## v0.5.0 — Platform riding

- Continuous rectangular-body movement against translating kinematic surfaces,
  surface-normal velocity response and bounded unresolved-contact reporting.
- Explicit platform character controller with stable support IDs, world-space
  velocity, carry across route reversals, jump-off momentum and safe blocked ticks.
- Clearance lift and Shuttle run demonstrate riding, crouch clearance, transfer,
  landing, pause, route reversal and fall recovery.
- Safety interlock rejects platform movement while allowing the player to move;
  no general reciprocal rigid-body solver, rotating platforms or slope support.

## v0.6.0 — RTS routing (first RTS slice)

- Immutable X/Z occupancy grids, bounded four-neighbour A* searches and compact
  reachable group destinations. Distinguish blocked, unreachable and work limits.
- Route planner and Squad orders compose navigation with fixed-step movement,
  selection, formation destinations, gate replanning and cell reservations.
- Native Canvas 2D presentation, mouse/keyboard/touch orders and pause-safe
  gestures; independent shortest-path comparisons and packaged browser checks.
- This is a small routing slice, not a complete RTS engine or crowd solver.

## v0.7.0 — Shared flow fields

- Incremental multi-source integration over immutable uniform-cost grids. Each
  step caps expanded cells; only complete fields expose costs and next directions.
- Nearest-goal ties, cancellation, snapshot ownership and explicit unreachable
  cells, with no agent, clock or browser dependency in the planner.
- Flow convoy (24 units) and Two-exit evacuation (36) reuse cell reservations,
  rebuild on gate/destination changes and freeze build work during pause.
- Search-work comparisons for 1/24/128/512 requests on 32×32 and 64×64 grids;
  retain per-unit A* for cases where a shared full-field build is unnecessary.

## v0.8.0 — OMI finite-state experiment

- ARCH-OMI-001 credits Brian Thorne's ARCH OMI and implements the pinned delta
  law with an explicitly chosen four-nibble tetrahedral encoding.
- OMI Lab exposes bit edits, observed-edge faults, face residuals, XOR masks,
  orbit selection and a pause-safe census of all 65,536 words.
- Independent exhaustive arithmetic comparison records 8/56/4,032/61,440 states
  of minimal period 1/2/4/8. Every word returns after eight steps, with 4,096 shorter
  periods. Edge-pattern ambiguity and undetected coordinated changes are tested.
- A separate research entry, not a new core game module. See
  [encoding, pinned references and evidence](docs/ARCH_OMI.md).

## v0.9.0 — The Brass Engine

- An imagined ancient instrument presents the same OMI rule through four
  hexadecimal drums, an eight-detent cam and visible rotate/XOR working lanes.
- Forward/reverse detents, full revolutions, a fixed-tick motor and exact local
  partial-position replays stay demo-owned. No new core game API is introduced.
- Exhaustive staged-output and reverse checks, bounded counters and histories,
  strict atomic replay validation and packaged keyboard/touch lifecycle checks.
- See [mechanism, provenance and limits](docs/BRASS_ENGINE.md).

## v1.0.0 — The Clockwork Vault

- One playable first-person chamber combines existing movement, collision,
  interaction, input, timing and rendering with the Brass Engine’s staged OMI law.
- Six original XOR/rotation locks have independent shortest solutions of two
  through seven commands. Bounded hints, undo, gate/bridge/lift progression and
  validated local partial-position saves stay demo-owned.
- Full-route, collision/interlock, replay and packaged browser regressions plus
  independent complete reachable-component evidence. Fifteen game recipes.
- This is a showcase milestone; per-module experimental maturity remains explicit.
  See [game contract and evidence](docs/CLOCKWORK_VAULT.md).

## Integer engine foundation — implemented, unreleased

- Four native modules: checked fixed-point math, rational integer clock, static
  axis-sweep collision, and an atomic world with canonical snapshot/replay.
- Integer Foundry: playable 3D-presented platform course with integer game state,
  full-state replay verification and pause-safe keyboard/touch controls.
- Boundary/oracle tests, 10,000-tick replay, frame partition tests, pinned course
  evidence and packaged Chromium parity/lifecycle coverage.
- Legacy APIs remain compatible. The repository version remains 1.0.0 until an
  owner-authorised release; the new API is explicitly experimental.

### Integer migration queue — not implemented

1. Character controller parity: crouch, stairs, integer ground probes and swept
   translating-platform support before migrating existing FPS recipes.
2. Integer orientation and angular dynamics with explicit approximation/error
   contracts before migrating flight; no float quaternion round-trip in state.
3. Projectile and weapon adapters using integer lifetime/cooldown ticks and
   stable contact ordering; migrate one complete existing game at a time.
4. Broader browser/runtime conformance and measured CPU/allocation workloads.
   Exact source-independent limb arithmetic replaces scalar BigInt products;
   raw vector BigInt results remain required by the API. A performance
   improvement is not claimed without paired measurements.

## Post-v1.1.1 WebGL API research — proposed, not implemented

> When we return to it, I think the most interesting experiment will be retained
> terrain chunks with batched rendering, followed by a source-pinned comparison
> against the original renderer on your RTX 5060 Ti. That would give us concrete
> evidence about whether the API's architectural advantages translate into real
> GPU performance.

- **Retained terrain chunks:** reuse the v1.1.1 triangulated heightfield
  geometry through the opt-in `api/webgl` device. Define bounded chunk sizes,
  complete effective-input signatures, deterministic invalidation and cleanup.
- **Batched rendering:** group compatible static geometry without changing
  vertex order, colours, visible output or the owning game's simulation. Compare
  whole-buffer uploads, dirty ranges, draw calls, memory ownership and cache
  rebuild costs against forced-fresh rendering.
- **Correctness gates:** independent source-backed geometry/Float32-byte and
  rendered-pixel parity checks; camera motion, chunk edits, rebuilds,
  pause/resume and WebGL context loss must invalidate or recover correctly.
- **Physical comparison:** pin exact baseline (existing `Renderer`) and
  candidate (`api/webgl`) commits; use identical terrain workloads, frame
  schedules, viewports, driver and RTX 5060 Ti hardware. Retain paired raw CPU
  preparation, GPU submissions, allocation and frame-timing observations with
  SHA-256 receipts. Use native GPU timing queries only when supported and
  separately report their limitations.
- **Decision rule:** retain optimisations only when parity and fail-closed
  lifecycle gates pass and measured evidence supports the claimed benefit.
  Report regressions and no-change outcomes, not just speedups. Keep
  RTX5060TI-001 immutable as historical evidence; issue a **new numbered
  receipt** for this experiment.

This is a future research/benchmark slice, **not** a v1.1.1 feature or a claim
that the new WebGL API has already improved physical GPU performance.

## DEMO//SYNTH — deterministic audio and demoscene engine (proposed)

**Design proposal only — no audio API, demo, MOD export or RTX measurement
is implemented by this roadmap entry.** See the [source-pinned implementation
plan](docs/DEMO_SYNTH_PLAN.md).

- Four-channel original sample/synth tracker with exact integer sample timing,
  48 kHz PCM16LE rendering and one short audible/visible consumer from day one.
  Strict rendered audio stays separate from best-effort browser Web Audio playback.
- Independent ProTracker-compatible `M.K.` MOD encoder/loader after C99
  interoperability checks against CorpoWars3d's *limited* MOD player; no
  unsupported-effect silence or fabricated format compatibility.
- E8_MUSIC, SONIFICATION, TONELAB and SPECTRAL adapters only through declared
  versioned source-to-musical-event mappings. Preserve SONIFICATION's
  root-event-only, no-PCM policy. QEC informs receipts and replay, not audio quality.
- Sample-indexed 50 Hz visual timeline; procedural copper bars, plasma, E8
  geometry, waveform triggers and original deterministic 2D/3D text objects.
  GPU command equality is distinct from cross-device framebuffer equality.
- OPT evidence gates: invariant/control-rate reuse, bounded buffers, forced-fresh
  reference, exact PCM/chunk independence, C99 tracker oracles, invalid-file tests,
  packaged Chromium AudioWorklet and offline-export checks.
- A separate post-merge owner-only RTX 5060 Ti workflow will compare scene
  rendering and record CPU DSP timing, with exact SHA-256 receipts. Never modify
  historical RTX001–004 or dispatch an owner runner from PR/push.

Build as small reviewed phases: P0 contracts → P1 original 45–90s musical
vertical slice → P2 real MOD → P3 live studio → P4 full visual intro
→ P5 OPT/RTX evidence → P6 optional 64 KiB data-pack/portable video.
Keep tests, provenance and releases separate and obtain owner authorization
for freeze and publication.

**Phonon-inspired/QEC acoustic follow-up (proposed only):** [lattice and acoustic addendum](docs/DEMO_SYNTH_LATTICE_ACOUSTIC_ADDENDUM.md) distinguishes a 27-site GF(3) event lattice from a 512-voxel RGB scene, defines a classical coupled-oscillator audio/visual mapping and repairs the supplied Hamming syndrome mapping. QEC v177 acoustic source, noise, receiver, reference-gate, transport and evidence documents are candidate reference adapters; they are not physical-quantum audio improvements. Validate actual NB eigenvalue radius independently of normalized flow before any spectral phase-boundary claim. Reuse Psycle as a modular workflow reference, not a native plugin runtime. The first four-channel demo remains the next implementation milestone.

## 2D-first movement, sound and ternary storage — experimental

- Introduce `motion2d` with four fixed-tick bounded integer movement profiles:
  RTS top-down, SHMUP, platform jump/gravity, and top-down car steering.
  Reuse existing NavigationGrid/findPath/PooledPathfinder/FlowField, not a
  competing 2D A* implementation. Render adapter reverses the Y axis.
- Introduce `audio2d` with pure four-lane 48kHz PCM16/WAV procedural
  effects. No sample identity from live AudioContext, no automatic playback
  or third-party sound libraries.
- Introduce `ternary-store2d` with canonical TXT/JSON bytes represented
  as six trits per UTF-8 byte, 9/27/81-column arrays, full 256-entry byte LUT,
  bounded inverse decode, immutable-by-ownership snapshots and OPT invariant
  reuse. This is not compression or durable local browser storage.
- Implement four-mode `2d-lab` and retained source/JSON CPU receipts,
  visual Chromium smoke tests, a manually dispatched post-merge RTX
  browser workflow, and a separate manually approved bounded GPT-6.1 Sol
  evidence-review workflow using an owner-configured GitHub secret.
- Do not trigger physical RTX or paid agent workflows from normal PR/push CI;
  agent opinions are not correctness gates. Keep RTX001–005 archives untouched.
- Next slices: 2D collision shape sweeps, continuous platform contact, more
  complete car dynamics and configurable game sound, followed by explicit
  2D→3D scene-coordinate adapters and DEMO//SYNTH tracker integration.

See [2D Foundation](docs/2D_FOUNDATION.md); all APIs remain experimental.
Post-merge GPU and API-credit execution require a separately reviewed and
explicitly owner-dispatched workflow.

## Proposed next slices — not implemented

1. **FPS expansion:** sloped terrain/capsules, rotating platforms, rotating-target
   queries and additional camera/weapon behaviours. Upright boxes, static steps,
   stance changes, eye poses, magazine timing, translating-target shots and platform
   riding now exist through 0.5.0. Extract further QSOL
   game behaviour only with provenance and regression tests.
2. **RTS expansion:** continuous steering, weighted terrain, richer formations
   and stronger multi-agent scheduling. Grids, A*, compact group destinations,
   shared flow fields and demo reservations exist through 0.7.0. Search work is
   measured on fixed workloads; large-army browser performance and general
   deadlock-free routing still need evidence.
3. **Authoring foundation:** versioned map schema, validation, undo/redo,
   selection/transforms, snapping, prefab definitions and play-testing.
4. **Atmospheric flight:** separate aerodynamic force model, lift/drag curves,
   stalls and tunable arcade assistance. Orbital mechanics is another model.
5. **Browser services:** scoped offline caching, save migrations, procedural
   Web Audio, gamepad profiles and additional rendering adapters.
6. **Physics expansion:** additional collider shapes, dynamic contacts and
   constraints only when a game requires them and tests establish behaviour.

Promote APIs toward stability after at least two consuming games exercise them.
Keep a single monorepo release version initially. Prefer a small working slice
with a visible demo to empty scaffolding for the full roadmap.

## ARCH OMI follow-ups — not implemented

Credit: **Brian Thorne's ARCH OMI**, supplied by the repository owner as a reference
for a 16-bit state space (65,536 values), four faces, OMICRON and XOR.
Brian's [OMI repositories](https://github.com/bthornemail?tab=repositories) include
an [OMI core specification](https://github.com/bthornemail/omi-portal/blob/5d2ebac312a8d44413af2a67ca9061e66594d9c8/docs/03-network/omi-core-spec.md#6-delta-law-evaluator)
and [Omicron implementation](https://github.com/bthornemail/omi-portal/blob/5d2ebac312a8d44413af2a67ca9061e66594d9c8/src/omi/omicron-kernel.js)
with a 16-bit rotate/XOR transform and default constant `0x5A3C`.
His [OMINO tetrahedral note](https://github.com/bthornemail/omi-canon/blob/b63fcf4286a9630bd9a641625d3103453c9687d5/Untitled.md)
maps FS/GS/RS/US to four vertices and their opposite faces, with XOR incidence
rules. This is a candidate reference for the owner's four-face concept; it does
not establish a mapping to this library's grid directions.

ARCH-OMI-001 now records the chosen nibble encoding, independent exhaustive
checks and the distinction between eight-step return and minimal period eight.
The Brass Engine exposes those operations as a reversible mechanical demo.
The Clockwork Vault now demonstrates reversible-switch puzzles with independent
shortest-path evidence. Compare further consuming games and explicit game-state
representations before considering a core API. Wider OMI protocols, alternative
constants, error-correcting claims, networking and performance remain separate
work. Shared navigation continues to use cardinal breadth-first distances.
