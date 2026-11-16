# HORIZON-003 — Racing Creator Tools, Showcase & Polish

Final **candidate** in the three-PR v2.9.0 programme. HORIZON-001 was merged in
PR #105; HORIZON-002 was merged in [PR #107](https://github.com/QSOLKCB/VANILLAJS/pull/107).
This change starts at reviewed main `718afebb7146424ed8718f80a488c3b76eea1c85`.
The published baseline remains v2.8.0. Owner review, merge and release approval
remain separate gates. Games2 is unmodified.

## Delivered composition

[Race Foundry](../demos/horizon-lab/index.html) combines the existing public
[vehicle3d](VEHICLE3D_API.md), [scenic3d](SCENIC3D_API.md) and
[render-lit](RENDER_LIT_API.md) contracts with new pure
[vehicle-audio](VEHICLE_AUDIO_API.md). Both vehicles move through actual world-space
physics. Route steering supplies the rival's throttle/brake/steer inputs; it does
not advance a route parameter and disguise that as motion.

The original Cape Aster — Sunward Run, named vehicles, checkpoints, race results,
recovery rules and DOM belong in `demos/horizon-lab/`. The reusable audio module
has no vehicle, renderer, DOM, browser-clock or Web Audio dependency. Its caller
owns telemetry and sample count. Procedural art/audio are original Apache-2.0
work; no new donor code, external engines or runtime dependencies are introduced.

[Creator walkthrough](HORIZON_RACING.md) covers route editing, vehicle classes, sound
parameters, test driving, retained history, strict imports and the complete race ZIP.
The main HORIZON `index.html` opens this playable race. `race.html` remains a
compatible race entry; the original visual atelier lives at `scenery.html`, and
`drive.html` remains the specialist vehicle study. Both tools stay independently
usable.

## Formats and compatibility

| Format / API | Compatibility boundary |
| --- | --- |
| `qsol.vanillajs.track.v1` | Legacy Racing Lab's four sections/eight X/Z gates remain unchanged; no height/bank migration is implied. Its Track Foundry links to the separate 3D workflow. |
| `qsol.vanillajs.horizon-lab.v1` | Original visual study remains scene configuration, not a game. |
| `qsol.vanillajs.horizon-drive.v1` | Original driving study remains vehicle/scenery/surface data. |
| `qsol.vanillajs.vehicle3d.v1` | Existing validated mass, dimensions, torque/gears, steering/tyres and suspension contract is reused. |
| `qsol.vanillajs.horizon-race.v1` | New bounded 64 KiB inert sidecar; scenery, vehicle, appearance, surfaces, camera, audio and race rules. |
| `qsol.vanillajs.vehicle-audio.v1` | New bounded 2 KiB sound profile; exact same-runtime held sample inputs reproduce PCM. |

Unknown versions/fields, accessors, unsafe data, invalid geometry and out-of-range
values are rejected before replacing accepted project state. The race requires
at least 120 m of road and 10 m full width. This is structural admission, not a
proof that an arbitrary authored route is finishable or well balanced.

| Race-study field | Units and limits |
| --- | --- |
| `scenery` | Existing scenic3d v1; 4–32 knots, x/z ±1200 m, elevation −20–180 m, full width 10–18 m for races, bank ±0.4 rad |
| `vehicle` | Complete existing vehicle3d v1 recipe; SI mass, geometry, torque, suspension and steering parameters |
| `appearance` | Sport/touring/utility class, three paint channels 0–1, roughness 0.08–1, metalness 0–1 |
| `surfaces` | Asphalt, gravel and terrain friction multipliers 0–2 |
| `camera` | Chase/bonnet/cockpit; chase distance 5–18 m, height 2–9 m, FOV 0.6–1.4 rad |
| `audio` | Existing vehicle-audio v1 profile; gains are linear levels, tone is a frequency multiplier |
| `race` | Countdown 0–5 s, 4–20 checkpoints, rival target 6–18 m/s, recovery penalty 1–20 s |

The authoring desk keeps up to 24 accepted states in memory. It does not save a
running race or persist project history across a page reload. Export editable
recipe data before leaving.

The pure physics and approximate rendering laws from the preceding PRs are
unchanged. Existing API callers, numerical proofs and historical evidence remain.
Package and MODULES.json historical `1.0.0` metadata are not release counters.
The shared ZIP STORE helper preserves the Game Maker export API and output format.

## Simulation and presentation

Fixed 1/120-second steps compose vehicle3d's internal 1/240-second quanta with
bounded catch-up. Checkpoints require ordered forward crossings inside the gate's
lateral/vertical bounds. Recovery returns to the last accepted checkpoint and
adds a visible time penalty; it cannot award skipped gates. Before the first
gate, recovery returns to the start. The race clock counts simulation quanta,
excluding pause/countdown time; results compare finish time plus penalties. A
penalized player may wait at the finish until that result can be determined. The rival uses the
same vehicle physics, with a bounded recovery policy for authored-route failures.
Player/rival can overlap: car-to-car rigid-body impacts are not implemented.
The race controls use automatic gearing and expose no manual shift action. A
valid vehicle recipe with automatic shifting disabled stays in its initial
forward gear in this race adapter; lower-level gearbox requests remain available
to custom consumers and the separate driving study.

Road contacts use the same triangulated geometry as the view, including elevated
bridge decks and ground shoulders. Trusted game-owned surface queries preserve
vertical layers. Decorative buildings/tunnel masonry are not collision barriers.
Vehicle dynamics remain approximations, including conservative chassis barrier
sweeps and vertical-ray suspension. See [vehicle limits](VEHICLE3D_API.md).

Chase, bonnet and cockpit-style cameras are presentation; they do not change the
canonical car state. Cockpit-style means a driving viewpoint with the local
body hidden; it does not promise a detailed interior. Original engine/exhaust,
tyre/brake and shift sound follows
RPM, throttle, load, slip and gear telemetry. Audio is optional, gesture-started,
bounded and canceled on pause/focus loss. PCM identity is separate from the
browser/device mixer and from exact integer mathematics.

The visual target is a readable scenic driving showcase: recognisable detailed
vehicle silhouette, differentiated rival, elevated/banked road, bridge/tunnel,
roadside scenery, visible checkpoint gates and a legible race HUD. Low/high detail
have explicit existing renderer budgets. Actual screenshots and measurements
belong in the execution record; no physical-GPU or universal speed claim follows
from software Chromium.

## Portable export and trust

The ZIP contains the admitted project, original race rules, native runtime,
procedural sound/art generators, root page, local CSS, source identity inventory,
LICENSE/NOTICE, declared asset notice and a scoped SHA-256 offline worker.
It is a complete instance of this single-route game, not arbitrary game compilation,
multiplayer, a saved race, a general Workbench exporter or a new track-v1 schema.

`scripts/horizon-race-runtime.mjs` resolves only literal local source imports,
rejects symlinks, checks the trusted HTML/CSS resource closure and enforces size
limits. `scripts/check.js` and the builder reject stale generated archives.
The exporter rechecks source hashes, validates data, escapes its generated literal
and emits a per-file manifest. Authored files cannot choose scripts or paths.
The package includes `project.json` for reimport, while its runtime reads generated
`project-data.js`; changing JSON after extraction does not silently alter the game.
Reimport, validate and export again after edits. `README.txt` explains local serving.

All four HORIZON page URLs share one content-derived immutable module namespace.
Browser provenance verifies the race, compatible race URL, scenery and driving
HTML rewrites and their source files;
missing/forged members fail closed. Frozen evidence, reviewed-main witness authority,
manual full-browser override and owner-only hardware policy are unchanged.

## Games2 consumer seam

A later reviewed Games2 PR may pin an owner-approved immutable v2.9.0 release,
copy its required source closure with notices and compose vehicle3d/scenic3d/
render-lit/vehicle-audio with game-owned routes, rivals and race rules. Re-run its
own gameplay, packaging and device checks. No automatic copying or cross-repository
change is authorized. [Programme compatibility table](ENGINE_EXPANSION_001.md#games2-readiness).

## Verification

Run all Node tests, `node scripts/check.js`, `node scripts/build.js`,
`node scripts/verify-offline.js`, applicable packaged Chromium suites and
`git diff --check`. New targeted coverage is in `tests/horizon-race*.test.js`,
`tests/vehicle-audio.test.js`, the browser race/export checks and startup isolation
checks. Rejected imports, wrong-direction/skipped gates, numerical route completion,
retained geometry, cameras, input cancellation, context loss, complete export,
nested offline startup and tampered worker installation are distinct checks.

Exact execution, source/package identities, failures/corrections and inspected
screenshots are recorded in the [HORIZON-003 execution record](evidence/horizon-003/README.md).
[Draft v2.9.0 release notes](HORIZON_2_9_0_DRAFT.md) remain pending owner approval.
