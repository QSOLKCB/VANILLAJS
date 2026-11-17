# v2.9.0 — HORIZON 3D Racing Foundry

**Full milestone draft for owner review; v2.9.0 is not published.**
HORIZON-001 was merged in [PR #105](https://github.com/QSOLKCB/VANILLAJS/pull/105)
and HORIZON-002 in [PR #107](https://github.com/QSOLKCB/VANILLAJS/pull/107).
HORIZON-003 was merged in [PR #108](https://github.com/QSOLKCB/VANILLAJS/pull/108).
HORIZON-004 is the final visual and driving polish candidate. Its verification,
owner review, merge and release approval remain separate gates. The current
published baseline is v2.8.0; these notes describe the proposed v2.9.0 release.

HORIZON connects original 3D scenery, world-space vehicle dynamics and creator
tools in one offline racing workflow. Make an elevated road, tune the car and
its sound, race a physical rival, then keep an editable recipe or export the
complete supported race.

## Make the road and the car

- Optional native WebGL1 lit rendering adds mesh normals, directional/ambient
  lighting, procedural materials, approximate roughness and vehicle finishes,
  glass tint, sky, fog and bounded contact-shadow patches. Existing rendering
  entry points remain compatible.
- Original scenery recipes generate terrain, trees, roadside buildings,
  bridges, tunnels and elevated/banked road geometry. Static batches and
  low/high profiles have explicit resource budgets. Continuous terrain shading,
  distance-faded road grain and approximate sky/ground metallic reflections
  improve presentation without changing road contacts.
- Original sport, touring and utility vehicles have distinct proportions,
  detailed body silhouettes, windows, lights, individual wheels, steering,
  wheel rotation, suspension response and brake-light feedback. HORIZON-004 adds
  curved lofted bodywork, smooth normals, open arches, profiled tyres and alloy
  wheels, integrated fascias, original lamps, trim and glazing.
- [Scenery Atelier](HORIZON_LAB.md) remains the focused environment/appearance
  tool. Its camera tour and JSON study are not a driving simulation or game.

## Drive through the actual world

- The pure [vehicle3d API](VEHICLE3D_API.md) advances explicit vehicle state
  with fixed steps, torque curves, forward/reverse gearing, driven-wheel
  configuration, steering, tyre grip, four-wheel spring/damper suspension,
  elevation, banking and jumping/landing.
- Static barrier sweeps, explicit recovery and strict vehicle data remain
  separate from camera, wheel presentation and audio. Existing road-local
  arcade handling remains intact.
- [Vehicle Dynamics](HORIZON_DRIVING.md) provides handling, ramp and coastal
  experiments with wheel contacts/loads and powertrain diagnostics. Exported
  vehicle recipes can be reused with a consuming game's own world and rules.

## Author and keep a complete race

- [Race Foundry](HORIZON_RACING.md) joins route and vehicle authoring with the
  original **Cape Aster — Sunward Run**: approximately 509 m of elevated,
  banked coastal road, a bridge, a tunnel, eight ordered gates and a finish.
- The cyan rival drives a separate vehicle through the same physics using
  throttle, steering and braking. Player and rival now collide through a bounded game-owned chassis contact solver. The
  player wins or loses according to finish time, including recovery penalties.
- Chase, bonnet and cockpit-style cameras accompany speed, gear/RPM, race time,
  route and checkpoint HUDs. Keyboard and pointer/touch controls support pause,
  restart, recovery and explicit resumption after focus/graphics loss.
- W/Up drives forward; S/Down brakes forward motion, then requests the real
  reverse gear below 0.5 m/s. Forward return also brakes through that threshold
  and respects gearbox shift time. Space brakes independently. Touch offers
  the same controls; R, RPM, wheel motion and audio follow actual telemetry.
  Pause/focus cancellation requires a fresh press before motion resumes.
- The creator desk edits road positions/elevation/bank, surfaces, environment,
  vehicle classes, paint/materials, mass, torque/gears, suspension, grip,
  cameras and sound. Accepted history supports undo/redo; rejected imports
  preserve the accepted project. Authored routes still require test-driving.
- The new experimental [vehicle-audio API](VEHICLE_AUDIO_API.md) creates original
  engine, exhaust, tyre/brake and gear-change PCM from explicit telemetry,
  seeded noise and owned sample state. The browser adapter owns optional,
  gesture-started playback and cancels sound on pause or failure.
- Export an inert race recipe, a reusable vehicle recipe, or a **complete
  playable race ZIP**. The ZIP includes the accepted project, native local
  runtime, procedural art/audio, controls/HUD, source hashes, licences/notices
  and a scoped SHA-256 offline worker. Extract and serve it through local HTTP;
  later offline visits work after successful installation. No account, package
  installation, CDN or downloaded asset is required.

## HORIZON-005 — Guardrails and recoverable driving

After repeated owner reproductions of a bridge-area rollover, the final
pre-release correction adds bounded game-owned bridge guardrails and
automatic once-per-incident checkpoint recovery with the authored
penalty. The original vehicle solver and rendered road-contact
geometry remain unchanged. Separate review/CI and owner acceptance
are required before tagging v2.9.0.

## HORIZON-006 — Playable arcade handling and real rival contact

After owner testing revealed sudden high-speed slides and a ghost rival,
the race adds a switchable **Course assist** (enabled by default). It provides
bounded speed-sensitive steering guidance and corner braking through normal
vehicle inputs; OFF retains direct unassisted physics. A deterministic paired
contact approximation prevents same-level car overlap and exchanges momentum.
The underlying `vehicle3d` solver, scenery contact triangles and accepted
project formats are unchanged. A separate PR and verified post-merge test
remain required before the v2.9.0 tag.

## Compatibility and limits

The candidate catalogue contains **71 experimental modules, 51 recipes and two
research experiments**. Release publication does not make these APIs stable.

`qsol.vanillajs.track.v1`, the original HORIZON visual/driving studies, Mod SDK
formats, Game Maker exports and current engine callers remain compatible.
The new `qsol.vanillajs.horizon-race.v1` sidecar does not migrate old track data.
Exact maths, proofs and historical evidence remain unchanged. Package/catalogue
`1.0.0` metadata retains its historical purpose.

Vehicle dynamics, materials, glass and shadows are documented approximations.
Cars exchange bounded approximate collision impulses; decorative buildings, trees and tunnel walls remain non-colliding.
Cockpit-style is a driving viewpoint, not a detailed interior. The race export
supports this single-route game, not arbitrary scripts, multiplayer, an authoring
editor or saved race progress. Geometry and source PCM identity are distinct
from GPU pixels, cross-engine floating-point identity and device audio output.
No unmeasured physical GPU, phone or controller performance is claimed.

[HORIZON-001](HORIZON_001.md), [HORIZON-002](HORIZON_002.md) and
[HORIZON-003](HORIZON_003.md) and [HORIZON-004](HORIZON_004.md) document contracts, verification boundaries and
execution records. The final candidate must pass Node, package, offline and
actual Chromium gameplay/export checks before release approval; screenshots
supplement those checks.

Games2 is unchanged. A later Games2 PR must choose an owner-approved immutable
release, retain provenance and run its own game and packaging checks. No
cross-repository copying, merge, tag or release occurs automatically.

**Build the engine. Prove the physics. Make the tools. Teach the creator.**
