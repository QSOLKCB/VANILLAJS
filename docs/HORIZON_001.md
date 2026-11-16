# HORIZON-001 — Rendering, materials and environments

**Programme:** HORIZON v2.9.0, first of three separately reviewed implementation
PRs. **Published baseline:** v2.8.0 at
`f7cd8d6a61791128b12fd72f8c94b6481889d197`, merged PR #103.
This rendering/environment candidate does not complete the v2.9.0 release gate.

## What this PR delivers

[HORIZON Lab](../demos/horizon-lab/index.html) is an original environment and
vehicle-appearance workshop. Shape elevated, banked road geometry; inspect the
terrain, bridge/tunnel and roadside setting; tune light, fog and vehicle finish;
preview wheel/steering/suspension visual inputs; export and reimport inert data.
The camera tour is a presentation preview. It is not a vehicle simulation or race.

The named Cape Aster route and seed are authored in
[`demos/horizon-lab/scenery.js`](../demos/horizon-lab/scenery.js). The core accepts
consumer-supplied scenery data; it contains no named starter world. The removed
`starterScenery()` helper was part of this unreleased PR candidate only. Existing
scenery/project formats and generated geometry remain compatible.

| Public addition | Responsibility | Reference |
| --- | --- | --- |
| `render-lit` | Optional owned native WebGL1 lit meshes, materials, procedural texture patterns, atmosphere/fog and explicit resource budgets | [Rendering API](RENDER_LIT_API.md) |
| `scenic3d` | Validated bounded scenery, actual road surfaces and terrain, static geometry batches, detailed original vehicle geometry and supplied visual rig | [Scenery API](SCENIC3D_API.md) |
| HORIZON Lab | Creator controls, accepted history, camera framing, browser lifecycle and its own project envelope | [Creator tutorial](HORIZON_LAB.md) |

The original `render-webgl.Renderer`, existing Racing Lab and
`qsol.vanillajs.track.v1` remain unchanged. This is an opt-in native WebGL path,
not an external 3D engine or an implicit replacement for existing callers.
No runtime packages, external shaders, downloaded art, remote fonts or services
are required. Code, recipes, scenery and vehicle designs are original Apache-2.0
material composed with existing VANILLAJS maths and terrain contracts.

## Rendering and numerical boundaries

The lit renderer consumes explicitly supplied camera/mesh/material state.
It owns GPU resources, not simulation time, input listeners or game rules.
Meshes use XYZ positions, normals, RGB colour and UV coordinates. Correct
normal transformation is separate from position transformation under nonuniform
scale. Drawing and resource disposal have bounded, inspectable contracts.

Directional and ambient light, roughness/specular finish and glass/environment
tint use a documented approximation. Procedural texture patterns are local shader
expressions. Glass has no general refraction, transmission solver or physically
based material guarantee. Contact-shadow patches are bounded geometry on a
chosen receiver surface; they are not general scene shadow maps or a proof of
occlusion. Transparency ordering and limitations are documented in the API.

Pure scene construction uses bounded Float64 arithmetic and emits Float32 mesh
positions. Road contact samples reference those same rendered triangles. SI
metres, right-handed +Y up / -Z forward and explicit surface IDs apply. Terrain
is a single-valued heightfield; an elevated road/bridge is a separate surface.
Callers must select the intended road surface/height bound rather than assume
one terrain height represents every level of a tunnel or bridge.

A visual vehicle rig consumes pose, steering, wheel rotation, suspension and
brake-light inputs. Cosmetic pitch/roll and wheel movement do not integrate
forces, infer grip or update authoritative vehicle state. No lane-following or
camera-tour motion is advertised as world-space physical steering.

Exact Q16.16/ALIEN MATH and archived proof boundaries are unchanged. Float64/32
geometry, trigonometric generation and GPU rasterization are not cross-device
integer identity or physical accuracy claims. Numerical geometry/contact tests
run independently of screenshots and shader output.

## Creator workflow and portable data

Use the [tutorial](HORIZON_LAB.md) to edit a supported scenery recipe and inspect
its actual render result. Low/high profiles have explicit geometry/render budgets;
they are not guarantees of a frame rate on unspecified hardware. Accepted data
is distinct from a draft. Invalid/unsupported/oversized inputs must leave the
accepted project, scene and history intact.

Exports contain reusable scenery/visual configuration, not JavaScript, a complete
racing game or a migration of the existing Track Foundry format. No imported
value can select executable modules, remote URLs or arbitrary shader code.
Independent games retain their own rules, audio, progression and device lifecycle.
Pin an immutable reviewed release and retain its source/licence provenance.

The lab is part of the existing offline package. Guarded startup and a complete
content-derived native-module namespace isolate it from older workers. Offline
startup requires a successful first served visit and worker activation. A fresh
browser has no previously installed package to load offline.

## Three review gates

| PR | Scope | Status |
| --- | --- | --- |
| HORIZON-001 | Lit rendering, environment/road surfaces, detailed procedural vehicle visuals and authoring preview | This candidate, owner review pending |
| HORIZON-002 | World-space vehicle dynamics, torque/gears, grip/slip, four-wheel contacts/suspension, braking, landing and recovery | Proposed; use the reviewed surface and visual seams from 001 |
| HORIZON-003 | Track/Vehicle Foundries, original audio, playable scenic race with rival/checkpoints/finish, cameras and polish | Proposed after dynamics review |

v2.9.0 publication requires all three PRs and the complete milestone review.
No merge, tag, release or deployment is part of this implementation task.
The [programme](ENGINE_EXPANSION_001.md) retains the later contracts and reference
scenarios. Existing racing behavior remains available during this work.

## Games2 compatibility

Games2 remains unmodified. The following are integration seams, not automatic
source promotion or permission to begin another game:

| Consumer | Baseline available through v2.8.0 | HORIZON-001 candidate seam |
| --- | --- | --- |
| Racing | Existing arcade road/track primitives | Explicit elevated road surfaces, lit scenery and vehicle visuals; new dynamics await 002 |
| FPS/tactical | character, combat3d, weapon-feel, navigation | Optional lit environments and material presentation |
| Arcade/strategy | Game Maker API, tilemap, sprite2d, navigation | Independently owned optional 3D presentation |
| Space | flight, orbital-physics, scene-graph, audio | Optional normal/material lighting; ship mechanics stay game-owned |
| Intros/cinematics | Demoscene, soundtrack, scene animation | Reusable environment/vehicle geometry and supplied camera rendering |

A later separately reviewed Games2 change must pin an owner-published immutable
engine release, preserve provenance and run its own gameplay/packaging tests.

## Verification and visual review

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-check.js
git diff --check
```

[Execution record](evidence/horizon-001/README.md) records actual commands,
candidate SHA, source/package identities, corrections, inspected screenshots and
measured budgets. The visual target is recognizable original car silhouettes,
visible wheel/finish differences, readable road elevation/bank and a coherent
scenic setting. It is assessed from actual packaged screenshots, not mock-ups.

Browser tests exercise real creator controls and rendering, strict import
rollback, resource lifecycle, low detail, offline startup and older-worker
isolation. Measurements identify software versus physical GPU execution; there
are no universal photorealism, hardware-performance or unexecuted-device claims.
Source-bound browser receipt qualification and owner-only runner restrictions
remain unchanged. Local execution is not trusted-main cache authority.

[Draft programme release notes](HORIZON_2_9_0_DRAFT.md).
