# v2.9.0 — HORIZON 3D Racing Foundry

**Partial draft for owner review. v2.9.0 is not ready for publication.**
HORIZON-001 is merged in PR #105. HORIZON-002 is the current second candidate;
HORIZON-003 still requires a separate implementation and review.

## HORIZON-001 merged additions

- Optional native WebGL1 lit rendering with mesh normals, directional/ambient
  lighting, procedural texture patterns, approximate roughness/vehicle finishes,
  glass tint, sky/atmosphere, fog and bounded contact-shadow patches.
- Validated original scenery recipes: terrain, elevated/banked road surfaces,
  roadside objects, trees, buildings and bridge/tunnel geometry. Static batches
  and low/high profiles have explicit resource budgets.
- Original detailed procedural vehicles with separate visual rig inputs for
  steering, wheel spin, suspension, body pitch/roll and brake lights.
- HORIZON Lab: inspect and author an original scenic environment, tune materials
  and visual settings, preview cameras, keep accepted history and exchange inert
  project data. The camera tour is not a driving simulation.
- Creator/API guides, agent catalogue integration, geometry/contact references,
  native Chromium rendering/lifecycle/offline tests and source-bound evidence.

These remain experimental APIs. Material/glass/shadow effects are documented
approximations. Exact numerical mathematics, existing renderer/callers, Racing
Lab, Track Foundry v1 and other authoring formats remain compatible.
No external engine, runtime package, downloaded asset, account or cloud service
is introduced. Games2 remains unchanged.

## HORIZON-002 candidate additions

- New pure `vehicle3d` API for bounded world-space vehicle state and explicit
  fixed steps: torque curves, gearbox/drivetrain, steering, tyre friction,
  four-wheel spring/damper suspension, elevation, banking and jumping/landing.
- Explicit static barrier sweeps, paused recovery, strict inert vehicle recipes
  and separate presentation. Existing road-local arcade handling remains intact.
- HORIZON Driving: steer an original test vehicle, compare handling and surface
  settings, inspect wheel contacts/loads and powertrain diagnostics, then export
  a reusable vehicle recipe. The named courses remain lab-owned.
- Independent numerical reference scenarios, actual packaged browser interactions,
  recovery/offline checks and a shared immutable namespace for both HORIZON pages.

The model is an inspectable approximation, not a full tyre or real-vehicle simulator.
See [contracts and execution record](HORIZON_002.md).

## Required before the complete v2.9.0 release

**HORIZON-003** must deliver Track/Vehicle Foundries, original vehicle audio,
a complete scenic playable race with rival and finish, camera choices, measured
budgets, recovery, offline packaging and polish.

HORIZON-002 and HORIZON-003 require their own owner review. The remaining features
must not appear as delivered release notes before implementation and verification.
See [the full programme](ENGINE_EXPANSION_001.md).

**Build the engine. Prove the physics. Make the tools. Teach the creator.**
