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

## Proposed next slices — not implemented

1. **FPS kit:** character controller, step/slope handling, ray and projectile
   moving-target queries, camera rigs and richer weapon timing. Static ray and
   projectile queries now exist in 0.2.0. Extract useful QSOL game behaviour
   with provenance and regression tests.
2. **RTS kit:** navigation grids, A*, flow fields, selection, formations and
   steering. Measure scaling with concrete workloads.
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
