# v2.9.0 — HORIZON 3D Racing Foundry

**Partial draft for owner review. v2.9.0 is not ready for publication.**
HORIZON-001 is the first of three required implementation PRs.

## HORIZON-001 candidate additions

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

## Required before the complete v2.9.0 release

**HORIZON-002** must implement and verify world-space vehicle dynamics, gearing,
tyre/grip approximations, four-wheel suspension/contact, braking, elevation,
jumps/landings and collision recovery.

**HORIZON-003** must deliver Track/Vehicle Foundries, original vehicle audio,
a complete scenic playable race with rival and finish, camera choices, measured
budgets, recovery, offline packaging and polish.

Both require separate PRs and owner review. These future features must not appear
as delivered release notes until their implementation and verification exist.
See [contracts](HORIZON_001.md) and [the full programme](ENGINE_EXPANSION_001.md).

**Build the engine. Prove the physics. Make the tools. Teach the creator.**
