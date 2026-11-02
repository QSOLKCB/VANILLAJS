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

## Proposed next slices — not implemented

1. **FPS expansion:** sloped terrain/capsules, rotating platforms, rotating-target
   queries and additional camera/weapon behaviours. Upright boxes, static steps,
   stance changes, eye poses, magazine timing, translating-target shots and platform
   riding now exist through 0.5.0. Extract further QSOL
   game behaviour only with provenance and regression tests.
2. **RTS expansion:** flow fields, continuous steering, richer formations and
   stronger multi-agent scheduling. Grids, A*, compact group destinations and
   demo selection/reservations exist through 0.6.0. Measure scaling with concrete
   workloads before claiming large armies or deadlock-free routing.
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
