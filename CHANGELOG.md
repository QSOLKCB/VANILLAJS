# Changelog

## 0.8.0 — OMI finite-state experiment (release candidate)

- Add ARCH-OMI-001, attributed to Brian Thorne: strict sixteen-bit delta/XOR
  operations, an explicit four-nibble encoding and tetrahedral face relations.
- Add an interactive OMI Lab with bit controls, face selection/fault inspection,
  reversible masks, orbit inspection and an incremental 65,536-word atlas.
- Exhaustively compare every delta output with an independent arithmetic oracle;
  record cycle counts, packing/inversion checks and a transition-table SHA-256.
- Establish return-after-eight for every word, while recording 4,096 words with
  shorter minimal periods. Demonstrate sixteen-to-one edge-pattern ambiguity and
  the limits of face closure; no full OMI protocol or game-engine claim.
- Add eleven regressions (207 total), packaged Chromium scenarios and CI evidence
  reproduction. Keep eleven game modules and fourteen recipes; register the
  research experiment separately. No runtime dependencies or assets are added.

## 0.7.0 — Shared flow fields (release candidate)

- Add `FlowFieldSearch` to navigation: bounded incremental multi-source builds,
  cancellable work, complete immutable fields, nearest-goal costs and directions.
- Add Flow convoy and Two-exit evacuation: 24/36 units follow a shared field,
  retire at destinations, and safely rebuild after gate or exit changes.
- Reuse the existing demo cell-reservation policy without changing A* recipes.
  Add direction overlays, build-budget controls and build/lookup/exit telemetry.
- Add 20 regressions (196 total), including A* distance comparisons on 40 seeded
  maps, the 65,536-cell limit, stale-build cancellation and complete deliveries.
- Record reproducible search-work comparisons and check them in CI. Add packaged
  browser scenarios. Eleven modules, fourteen recipes, zero runtime dependencies.

## 0.6.0 — RTS routing (release candidate)

- Add the pure `navigation` module: immutable X/Z occupancy grids, bounded A*
  search with explicit outcomes, and unique reachable formation destinations.
- Add Route planner and Squad orders in a Canvas 2D RTS Lab: drag selection,
  keyboard/touch orders, gate changes, group routes, cell reservations and retries.
- Preserve accepted orders across pause while cancelling incomplete gestures;
  reject failed group plans atomically and expose waiting/unreachable states.
- Add 20 Node regressions (176 total), including an independent shortest-path
  oracle on 80 seeded maps, complete courses, traffic safety and timing schedules.
  Add packaged browser scenarios and contracts. Eleven modules, twelve recipes,
  no runtime dependencies; all earlier 3D labs remain available.

## 0.5.0 — Platform riding (release candidate)

- Add `moveAndSlideMovingAABB` for bounded rectangular-body movement against
  translating surfaces, with normal velocity response and partial-step reporting.
- Add `stepCharacterPlatforms` for support tracking, riding, route reversals,
  crouching and jumping with inherited world velocity. Blocked ticks leave the
  rider unchanged so the caller can safely stop its world transaction.
- Add Clearance lift and Shuttle run with a clearance interlock, route reversal,
  interpolation, pause/reset/fall recovery and on-screen support telemetry.
- Keep the static stair controller and all prior recipes available. Catalogue:
  ten modules, ten recipes, zero runtime dependencies. Add 18 Node regressions
  (156 total), plus packaged browser scenarios and explicit integration contracts.

## 0.4.0 — FPS motion (release candidate)

- Add safe held crouch/stand to the character controller, with feet-anchored
  dimensions, crouch speed and blocked-standing feedback; bind C in FPS controls.
- Add `castMovingSegment` and `ProjectileSystem.stepMoving` for translating AABBs
  over a shared interval. Return world-space impacts and clip target travel to
  projectile lifetime. Existing static APIs and flight mappings remain intact.
- Add Low passage and Tracking range recipes, moving-target interpolation,
  stance/track telemetry and keyboard/on-screen input lifecycle checks.
- Add 21 Node regressions (138 total), packaged browser scenarios and updated
  contracts/examples. Ten modules, eight recipes, no runtime dependencies.
- No slopes, capsules, moving platforms, rotating targets or dynamic body solver.

## 0.3.0 — FPS Lab (release candidate)

- A pure upright character controller: walking/sprinting, gravity, fresh-press
  jumping, stair stepping, ground snapping and a first-person eye pose.
- Rectangular AABB movement queries reuse the existing swept/slide solver while
  preserving the cube APIs used by flight and projectile consumers.
- A pure weapon timer: finite magazines/reserve, cooldowns, ordered reload events
  and simulation-time pause behaviour, independent of input or damage rules.
- Footwork and Live range demos, instant-trace/travelling-bolt comparison,
  keyboard/mouse/touch controls, telemetry, target focus and bounded feedback.
- Regression coverage for stairs, ceilings, ledges, wall tunnelling, course
  completion, ammunition, reload/pause and fixed-step composition. Browser checks
  exercise the packaged lab and keep earlier lab regressions enabled.
- Ten-module catalogue, adoption examples and explicit approximation limits.

## Mouse-look controls (after 0.2.0)

- Both labs use click-to-capture relative mouse look with WASD movement. Mouse
  takeover cancels spin, levels roll and clamps pitch; stopping the mouse stops
  turning. Original arrow, Q/E and gamepad flight controls remain available.
- Reusable `attachMouseLook` browser adapter and pure `lookFlight` controller;
  relative drag fallback for touch or unavailable capture, Escape/focus-safe
  cancellation, and left-click firing in Interaction Lab.
- Regression coverage for input lifecycle, no-spin aiming, keyboard compatibility
  and packaged Chromium pointer capture in both labs.

## 0.2.0 — Interaction Lab (release candidate)

- Finite ray and segment queries with stable nearest-hit selection, explicit
  initial-overlap semantics, cube extents and collider filters.
- A bounded projectile module with simulation-time lifetimes, swept hits,
  ordered events, snapshots and cancellation.
- A pure declarative interaction resolver with priority/id ordering, conditions,
  effects and explanatory applied/blocked/resisted/unmatched results.
- Space target practice and Reaction Bench compose the same modules, with
  conditional shields and small source-backed chemistry examples.
- Responsive WebGL range, on-screen/keyboard controls, quick fire taps, focus-safe
  pause/resume, slow motion, target focus, impact trail and inspectable outcomes.
- Dynamic mesh updates reuse owned GPU buffers. Flight Lab remains available.
- New numerical, scenario and packaged Chromium checks; catalogue and manifest
  version consistency; API and scientific approximation documentation.

## 0.1.0 — Flight Lab (release candidate)

- Six original, browser-native ES modules: math, time, collision, flight, input
  and render-webgl; no third-party runtime dependencies.
- Force/torque integration, quaternion orientation, assisted and inertial 6DOF
  controls, explicit braking and swept axis-aligned collision against static boxes.
- The conduit and Open orbit share simulation and rendering while providing
  different worlds and flight settings, each with six ordered signal objectives.
- Live dynamics tuning, slow motion, keyboard/pointer/on-screen/gamepad controls,
  focus-safe pause/resume, telemetry and mobile layout.
- Module catalogue, public contracts, reusable integration recipe and roadmap.
- Numerical and scenario regressions, module checks, packaged browser CI and
  a gated GitHub Pages workflow. Existing Apache-2.0 licence retained.

This document describes the milestone; it does not create a Git tag or release.
