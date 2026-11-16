# HORIZON-002 — Vehicle dynamics and simulation

**Second of three separately reviewed HORIZON PRs.** Reviewed main:
`69dd325243633f66844a5ef85d87ab24e8677a63`, containing merged
[HORIZON-001 / PR #105](https://github.com/QSOLKCB/VANILLAJS/pull/105).
The latest published release remains **v2.8.0**. This candidate does not complete
the v2.9.0 release gate.

## Delivered contracts

| Addition | Responsibility | Reference |
| --- | --- | --- |
| `vehicle3d` | Strict vehicle data and bounded world-space fixed-step dynamics, four-wheel suspension/tyres, torque/gearing and static barriers | [Public API](VEHICLE3D_API.md) |
| HORIZON Driving | Original proving grounds, surface adapters, drive/tune/inspect workflow and inert exports | [Creator tutorial](HORIZON_DRIVING.md) |
| Two-page offline package | Both HORIZON startup graphs share one content-derived namespace with authenticated page rewrites | [Browser cache contract](BROWSER_CACHE.md#multiple-entry-pages-in-one-runtime-package) |

The car's world position, orientation and velocity result from applied forces and
torques. Road samples do not advance a lane coordinate or prescribe its path.
Four separate contact queries supply heights, normals, friction and surface IDs.
The model includes spring/damper loads, pitch/roll response, limited tyre forces,
speed-sensitive steering, engine braking, gear ratios and shift interruption.
Supported upward-facing surface geometry is shared by drawing and the lab’s
contact adapter; overly steep faces remain visual-only.

`arcade` and `simulation` select explicit parameter sets of this approximate
model. They do not claim manufacturer data, full tyre fidelity, deformable roads
or real-world certification. The [API](VEHICLE3D_API.md) documents the numerical
and collision boundaries independently of rendering.

## Creator and ownership boundaries

The [driving experiment](../demos/horizon-lab/drive.html) provides a handling pad,
a launch ramp and the existing scenic coast. Tune accepted vehicle parameters,
drive using keyboard or on-screen controls, inspect contact/load/slip/RPM/gear
diagnostics and compare surface friction. Pause, restart or recover explicitly.
Rejected imports preserve accepted authoring and simulation state.

Core code owns reusable dynamics, not an authored world. The named Aster courses,
triangle-to-surface mapping, barriers, recovery locations, input listeners, cameras
and UI belong to `demos/horizon-lab/`. Imported vehicle data never supplies code,
URLs, callback names, renderer handles or agent instructions. Rendering reads
simulation state; cosmetic camera and wheel transforms cannot alter physics.

The vehicle export contains parameters. A driving-study export also contains the
lab's scenery/course/surface configuration. Neither is a complete racing game,
compiled application or replacement for Track Foundry v1. A consumer still needs
world data, trusted adapters, input lifecycle, rendering, audio and game rules.

## Compatibility and provenance

This is original Apache-2.0 implementation composed with existing VANILLAJS maths,
collision, scenery, rendering and time modules. No external engine/source import,
runtime dependency, downloaded art, CDN or service is introduced.

Existing `road-arcade`, Racing Lab, `qsol.vanillajs.track.v1`, scenery v1 and HORIZON
visual-study v1 remain compatible. Vehicle and driving-study data are separately
versioned additions. Historical `package.json`/`MODULES.json` metadata remains
`1.0.0`. Existing numerical/proof boundaries and archived evidence are preserved.

Package-source provenance metadata explicitly advances to v2 to authenticate both
HORIZON pages. Historical receipts remain unchanged; insufficient old metadata
causes real browser execution. Reviewed-main authority, one-run qualification,
manual full execution and owner-only runner restrictions remain intact.

## Games2 compatibility

Games2 is unchanged. Adoption requires a separate owner-reviewed game PR pinned
to an immutable published VANILLAJS release after the complete milestone gate.

| Consumer | Available seam in this candidate | Still game-owned or future work |
| --- | --- | --- |
| Racing | World-space vehicle state, four-wheel contacts, drivetrain, suspension, lit scenery and visual rig | Race rules, rivals, checkpoint progression and polished vehicle/track tools (HORIZON-003) |
| FPS/tactical | Existing combat/weapon-feel/navigation; optional lit scenery | Game-owned missions, content and vehicle interaction |
| Arcade/platformer | Existing Game Maker, sprite2d, tilemap, motion2d/combat2d | Original gameplay and content |
| RTS/strategy | Existing navigation, tilemaps and narrative/scene composition | Unit rules, economies and campaign fiction |
| Space/cinematics | Existing flight/orbital/scene/audio and lit presentation | Ship systems, missions and authored choreography |

## Review and evidence

Independent numerical tests cover force/traction, braking, steering, suspension,
surface planes, banking/elevation, jumps/landings and high-speed barrier controls.
Browser checks exercise actual driving/tuning/imports, lifecycle, retained drawing,
graphics recovery, narrow layout, offline reload and older-worker isolation.
Screenshots supplement these checks; they do not establish numerical identity.

The [execution record](evidence/horizon-002/README.md) identifies the exact
candidate source, package hashes, executed commands, corrections and limitations.
Local evidence is not trusted-main reuse authority. No physical GPU, mobile
device, controller or non-Chromium validation is implied.

HORIZON-003 remains a separate future PR for full Track/Vehicle Foundries, original
engine/tyre audio, a scenic race with rival/checkpoints/finish, portable game
packaging and polish. v2.9.0 is published only after all three owner reviews.
See [the programme](ENGINE_EXPANSION_001.md) and
[partial release notes](HORIZON_2_9_0_DRAFT.md).
