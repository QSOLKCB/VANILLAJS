# VANILLAJS roadmap

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
   BigInt exactness is implemented; a performance improvement is not claimed.

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
