# v2.9.0 — HORIZON 3D Racing Foundry

**Full milestone draft for owner review; v2.9.0 is not published.**
HORIZON-001 was merged in [PR #105](https://github.com/QSOLKCB/VANILLAJS/pull/105)
and HORIZON-002 in [PR #107](https://github.com/QSOLKCB/VANILLAJS/pull/107).
HORIZON-003 was merged in [PR #108](https://github.com/QSOLKCB/VANILLAJS/pull/108).
HORIZON-004 through HORIZON-010 have since merged. The latest published
release is v2.8.0. The acceptance table below distinguishes evidence on the
merged HORIZON revision from the final release decision.

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

After repeated owner reproductions of a bridge-area rollover, HORIZON-005 added bounded game-owned bridge guardrails and
automatic once-per-incident checkpoint recovery with the authored
penalty. The original vehicle solver and rendered road-contact
geometry remain unchanged. The fix merged in PR #112.

## HORIZON-006 — Playable arcade handling and real rival contact

After owner testing revealed sudden high-speed slides and a ghost rival,
the race adds a switchable **Course assist** (enabled by default). It provides
bounded speed-sensitive steering guidance and corner braking through normal
vehicle inputs; OFF retains direct unassisted physics. A deterministic paired
contact approximation prevents same-level car overlap and exchanges momentum.
The underlying `vehicle3d` solver, scenery contact triangles and accepted
project formats are unchanged. PR #113 merged these changes.

## HORIZON-007 — Checkpoint camera clarity

Owner testing exposed a giant green-and-black strip across the chase camera.
It was the already-completed checkpoint crossbar, still rendered behind the
car even after the crossing was accepted. Completed gates now stop drawing;
future gates retain their original appearance and all meshes remain available
for restart/replay. Checkpoint rules, collision physics and car handling are
unchanged. This presentation-only correction prevents a nonphysical overhead
banner from looking like an invisible wall.

## HORIZON-008 through 010 — recovery and roadside visibility

- Reversing beyond Cape Aster’s start or falling beneath terrain triggers one
  checkpoint recovery. The Vehicle Dynamics workshop gained brake-to-reverse
  controls. [HORIZON-008](HORIZON_008.md) · [PR #116](https://github.com/QSOLKCB/VANILLAJS/pull/116)
- The renderer groups opaque terrain and foliage into fixed tiles. Conservative
  frustum checks skip invisible geometry. The browser comparison checks complete
  RGBA readbacks with culling enabled and disabled. [HORIZON-009](HORIZON_009.md) · [PR #117](https://github.com/QSOLKCB/VANILLAJS/pull/117)
- Retained posts, reflectors and outside-bend chevrons mark the route. Profile
  budgets bound their geometry. Bridge and tunnel interiors stay clear.
  [HORIZON-010](HORIZON_010.md) · [PR #118](https://github.com/QSOLKCB/VANILLAJS/pull/118)

## Release acceptance

The latest HORIZON gameplay revision checked for this draft is
`4159295f8e552f31ac562c121af947e49f8e68a5`, the merge of #118.
The table identifies what can be carried forward and what must be measured
on the exact revision selected for publication.

| Check | Evidence and remaining action |
| --- | --- |
| Hosted verification and deploy | Flight Lab verification and Pages deployment succeeded on the #118 merge. Confirm both jobs again on the final merged SHA. [Run 44088584410](https://github.com/QSOLKCB/VANILLAJS/actions/runs/44088584410) |
| Browser endurance | The 1,000-cycle racing, combat, creator and visual groups passed on that SHA. Check the final revision’s run. [Run 44088584320](https://github.com/QSOLKCB/VANILLAJS/actions/runs/44088584320) |
| Physical GPU | Pending. Compare baseline `6e4831d61f284ba6b92c33ecf598897c46eb1204` and the final candidate on the same device. Record the driver, browser, both quality profiles, frame distributions, draw and vertex counts, GL status and matched screenshots. Review p95 against 16.67 ms and investigate repeatable regressions. [Measurement contract](HORIZON_010.md) |
| Owner drive on deployed main | Pending. In a fresh session, verify forward → brake → reverse → forward, same-level rival contact, bridge/tunnel travel and recovery. Complete all eight ordered checkpoints and reach the finish. [Race Foundry](https://qsolkcb.github.io/VANILLAJS/demos/horizon-lab/index.html) |
| Owner portable-race check | Pending. Export the playable ZIP from that deployment. Extract and serve on localhost, allow offline installation to finish, disconnect, reload, drive and restart. [Creator instructions](HORIZON_RACING.md) |
| Publication | After acceptance, the owner tags the selected SHA as v2.9.0 and publishes the GitHub Release. Record its URL and commit before starting [Demoscene #104](https://github.com/QSOLKCB/VANILLAJS/issues/104) or [video export #106](https://github.com/QSOLKCB/VANILLAJS/issues/106). |

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
