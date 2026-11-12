# RACING-002 — Classic arcade racing foundations

**Status:** Experimental playable implementation. Source-owned, browser-native,
Apache-2.0. This milestone is about *mechanics and geometry inspired by a genre*,
not reproducing historical copyrighted tracks, car models, visuals or sound.

## Design intent: two lineages, one inspectable kernel

| Lineage | Intended experience | RACING-002 delivered | Not yet implemented |
| --- | --- | --- | --- |
| 1980s pseudo-3D touring (OutRun-style) | Traffic, long drives, branching stages, changing scenery | Scenic Tour: Canvas2D, 4 × 1,200 m stages, 3 explicit lane-based choices, deterministic scenery palettes, traffic and nitro | Distinct route meshes, authored forks, checkpoint clocks, horizon scenery packs |
| 1990s scenic 3D sports-car sprint (Need for Speed II-style) | Fast point-to-point roads, rivals, roadside penalties, readable high-speed handling | Coastal Sprint: WebGL, analytic 3,600 m winding centreline, four rivals, 900 m milestones, chase camera, verge costs and swept car-contact detection | Multiple authored courses, car classes/torque/gearing, replay ghosts, cockpit camera, damage models |

This is a browser research lab, not a claim of feature parity with either
historical game. All vehicle and track art in VANILLAJS remains original.

## Executed source contracts

- `createRace('tour')` and `createRace('sprint')` produce independent demo
  states. The existing five presets retain their names and goals.
- `stepRace(world,input,dt)` continues to use explicit tick inputs at a fixed
  1/60 second. Bad modes/timesteps reject. Same-runtime, same-input replay
  remains the determinism claim.
- Scenic Tour stores immutable-by-history left/right choices in `world.route`.
  At each 1,200 m boundary, negative player lateral position chooses left;
  zero/positive chooses right. Exactly three choices are recorded before the
  four-stage finish. Current branch choices affect scenery palette, not road
  topology: no claim of independently authored branch geometry.
- `sprintCenter(s)` and `sprintHeading(s)` define a finite analytic road
  in metres. Geometry and off-road checks use the same centreline.
  The stage HUD reports four 900 m milestones; completing the 3,600 m road
  requires being within the paved finishing corridor.
- `sweepVehicleContact` detects first circle overlap over a tick using
  relative motion. This prevents pass-through *detection* in Coastal Sprint
  without claiming a swept shape or full rigid-body solver. Collision impulses
  remain stylised. No public exact-arithmetic API changed.
- Existing rival contact cooldowns expire for live vehicles. Nitro permits
  accumulated boosted speed, which decays after release. Under-deck stunt
  contacts cannot pull an airborne car upward onto a platform.
- The shared UI supports keyboard and touch driving, focus-loss cancellation,
  optional sound and bounded input-tick JSON receipts. Both new modes are
  covered by the packaged Chromium smoke suite.

## Verification and compatibility

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
```

Hosted `.github/workflows/racing-lab.yml` additionally exercises all seven
modes in packaged Chromium. The full repository workflows remain authoritative
for compatibility with pre-existing labs. Distinguish checks executed by CI
from local execution, physical GPU tests and human visual evaluations.

The simulation is still Float64 arcade physics, **not** the exact Q16.16 engine,
and same-runtime replay does not establish cross-engine bit-exactness.

## Next bounded increments

1. **RACING-002B: Authored road sections.** Declarative lane widths, terrain,
   forks and weather profiles; validate finite continuity, no impassable geometry
   and bounded geometry budgets. Branches must change route topology, not merely
   colour, before they can be called different physical routes.
2. **RACING-002C: Handling profiles.** Data-only car masses, final drives,
   acceleration curves, traction and steering assist, with paired reference
   races and explicit performance/skill contracts.
3. **RACING-002D: Robust contacts.** Full continuous swept vehicle/rail
   response, initial overlap policy, stable restitution and wall/sliding
   constraints; no teleport-through-road at high speed.
4. **RACING-002E: Wheel and suspension.** Four wheel contacts, spring/damper
   response, jump/landing receipts and bounded roll/flip recovery.
5. **RACING-002F: Exact research adapter.** First define the numerical
   refinement contract against the existing Float64 world; only then attempt
   bounded Q16.16 integration using VANILLAJS's separate exact mathematics.
   Keep both profiles and report mismatches rather than silently quantising.
6. **Creator integration.** Track editor, camera options, ghost races,
   portable vehicle/course packs and original engine/exhaust synthesis.

The next phases require independent tests and owner review; none is silently
claimed as already implemented by this milestone.
