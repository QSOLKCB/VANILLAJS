# ENGINE-EXPANSION-001 — Build the Engine First

**Published baseline:** [v2.5.0 — The Creator Gateway](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.5.0),
release commit `32b4fb1ca80e854297998aa00f87a8f012398b89`.
**Reviewed starting main:** `433f8c87a74ed145a612510ee388a7aacc1280f6`.
At that revision, `MODULES.json` registers 62 experimental modules, 43 recipes
and two research experiments. The historical package/catalogue `1.0.0` metadata
is not a release counter and is not migrated by this programme.

This document defines four sequential milestones. The current PR implements only
the **v2.6.0 candidate**; owner review, merge and release remain separate gates.
All v2.7.0–v2.9.0 interfaces and formats below are **proposed design contracts,
not available APIs**. They need their own implementations, tests, docs and reviews.

| Release | Milestone | Dependency and review gate |
| --- | --- | --- |
| v2.6.0 | SPRITE-FEEL-001 — Game Feel & Sprite Foundry | Current implementation candidate; complete Sprite/Weapon Feel labs and verification before owner review |
| v2.7.0 | SCENE-NARRATIVE-001 — Scene & Narrative Foundry | Start only in a later task after owner-approved v2.6.0 merge/release |
| v2.8.0 | GAME-MAKER-001 — Game Maker API | Reviewed scene/resource contracts and v2.7.0 merge/release |
| v2.9.0 | HORIZON-3D-001 — 3D Racing Foundry | Earlier milestones reviewed/released; three separately reviewed HORIZON implementation PRs |

Games2 is a future consumer and remains unmodified throughout this programme.
The owner decides when another game begins. No automatic code copying, mutable
runtime dependency, cross-repository PR, merge, release, tag or deployment is
authorised by this plan.

## Architectural starting point

The engine already has useful building blocks; new work must extend them rather
than claim they are absent:

| Existing source | Current contract and useful seam |
| --- | --- |
| [Workbench model](../demos/editor/model.js), [components](../demos/editor/components.js) | Validated v1/v2 scenes, parent IDs, local position/yaw/scale, depth/cycle checks, explicit upgrade and six small component kinds. Physics bodies currently remain roots. |
| [Asset Foundry](../demos/editor/asset-foundry.js) | Owned project/library, asset provenance, bounded OBJ, opaque RGBA textures up to 64×64, material and prefab records. Alpha sprites need a sidecar/explicit compatible bridge, not silent schema widening. |
| [demo-timeline](../modules/demo-timeline/index.js), [demo-scene](../modules/demo-scene/index.js) | Sample-time choreography and procedural retained geometry. The timeline currently has a specific 60-second/48 kHz contract, not arbitrary scene animation. |
| [motion2d](../modules/motion2d/index.js), [combat2d](../modules/combat2d/index.js) | Integer XY state with 256 subunits per game unit; +Y up. Motion uses bounded endpoint point-collision; combat supplies bounded hurtboxes and swept attacks. Tile-body collision must explicitly address the gap. |
| [character](../modules/character/index.js), [weapons](../modules/weapons/index.js), [combat3d](../modules/combat3d/index.js) | Float64 metre-scale grounded motion, weapon eligibility and bounded 3D combat. Presentation is outside the canonical transaction. |
| [render-webgl](../modules/render-webgl/index.js), [render-optional](../modules/render-optional/index.js) | Explicitly owned graphics resources; retained geometry and disposal. Preserve existing callers and optional CPU/GPU policy. |
| [road-arcade](../modules/road-arcade/index.js), [track authoring](../demos/racing-lab/track.js) | SI road-local arcade response and strict `qsol.vanillajs.track.v1` packs. Road-local offsets are not a four-wheel world-space vehicle simulation. |
| [terrain](../modules/terrain/index.js), [collision](../modules/collision/index.js) | Bounded triangulated heightfield with sampling/segment crossing and AABB queries. Neither is already a complete tyre/suspension solver. |

Pure modules own data and explicit transitions; apps own DOM, devices, clocks,
GPU/audio resources and authored fiction. Resource handles never enter data-only
JSON. Import admission must finish before accepted state changes. Preserve existing
formats and numerical boundaries, including Q16.16 and archived formal evidence.

## v2.6.0 — Game Feel & Sprite Foundry

The implementation candidate adds a pure `sprite2d` module and an FPS weapon-feel
adapter, with separate creator labs. Neither changes existing simulation defaults.

**Sprite contract:** validated implementation-version/seed/recipe/palette input
produces reproducible source RGBA arrays at 8, 16, 32 or 64 pixels per side.
Original bounded character/enemy, weapon/item, terrain and particle/impact
generators support transparent pixels, symmetry choices and multiple ordered
frames. Editing, palette variations, masks, atlas layout and versioned project
admission must be testable without the DOM. PNG encoding is a browser boundary:
equal RGBA does not promise identical PNG bytes across encoders.

**Creator workflow:** generate, paint/erase/fill, duplicate/edit frames, preview,
undo/redo, import validated data and export a project, PNG/sheet and atlas/mask
metadata. Keep alpha/animation in a versioned sidecar or an explicit compatible
asset addition; do not imply Workbench's opaque texture schema accepts alpha.

**Weapon-feel contract:** separate prompt look presentation from fixed-step
movement/weapon eligibility. Consume relative input once, cancel it on lifecycle
boundaries, coordinate ADS FOV/sensitivity, retain per-weapon cooldown across
switches and bound buffered presses. Seeded gameplay spread/recovery is distinct
from cosmetic recoil. The reticle, diagnostics and actual hit ray must agree.
Three original profiles and moving hittable targets must demonstrate the tuning.
See the [AFTER//ZERO source audit](AFTER_ZERO_GAME_FEEL_AUDIT.md).

**Completion evidence:** exact pixel fixtures, palette/seed/frame-order tests,
strict format limits and transactional rejection, atlas bounds, shot timing/
buffer/cancellation/switch tests, ADS-ray alignment, seeded spread and cadence
tests, actual packaged Chromium editing/play, offline startup and old-worker
recovery. Creator Hub/catalogue links and tutorials must lead to the real labs.
Only executed results against the candidate count; this roadmap is not evidence.

## v2.7.0 — Scene & Narrative Foundry (proposed)

### Scene composition

Extract or extend the Workbench's existing hierarchy with a reusable pure scene
contract before adding more editor-only rules. The initial design retains the
existing 128-object/16-depth bounds unless a separately measured capacity change
is reviewed. Validate IDs, single ownership, missing parents, cycles, transforms,
component fields and resource references before replacement.

Planned operations: validate a scene, traverse in stable order, compose a local
transform with its parent, convert world/local poses, instantiate a bounded
prefab, sample keyframed transforms and produce a renderable snapshot. Full
transform support must document scale/inversion/rotation order and reject singular
conversions rather than silently corrupting physics. Nested prefab expansion needs
explicit depth/object budgets, cycle rejection and fresh identity remapping.

Camera, light and appearance components are inert descriptors. A renderer adapter
creates owned resources, resolves local asset IDs and disposes them explicitly.
Animation tracks use caller-supplied time and defined interpolation; rendering
must not advance authoritative state. Root physics-body restrictions remain until
a separate world/local collision contract is implemented and tested.

Keep v1/v2 scene and project imports working. An extended scene envelope must have
an explicit new version or validated sidecar plus documented upgrade/downgrade
behaviour. Roundtrip legacy fixtures unchanged, test rejected-import rollback,
transform inverses, hierarchy reparenting, prefab capacity, animation seeks and
resource disposal. Do not silently generalise `demo-timeline`'s existing contract.

### Narrative engine and lab

A proposed pure `narrative` module owns a bounded story graph, declared typed
variables, dialogue, choices, conditions, objectives, events and save state.
It must not import input devices, rendering, game fiction or the scene editor.

The proposed versioned envelope contains a start node, node records, declared
variables and objective IDs. Choices reference an existing target ID and use a
fixed comparison/boolean condition vocabulary over declared variables. Effects
are allowlisted typed assignments, bounded increments, objective transitions and
named inert events. No JavaScript, HTML, expression strings, getters, external
URLs, dynamic module names or implicit evaluation are accepted.

Proposed operations: validate graph, report unreachable/missing-link nodes and
reachable endings, create initial state, list eligible choices, apply one choice,
and validate/restore an owned save. Fixed story identity plus choice sequence
must reproduce state/events. Cycles require explicit diagnostics and finite
per-action traversal/event budgets; never auto-run an unbounded chain. Save
admission verifies schema/story identity and all variables/objective/node IDs.

The Narrative Foundry must author nodes/dialogue, link choices, edit a condition,
preview an original branching story, trigger a simple scene change via an
allowlisted application event mapping, save/reimport and export reusable data.
The scene change is demonstrated application behaviour, not executable story
content. Tests cover unreachable endings, cycles, malformed effects, save
rejection, deterministic traversal, actual authoring and offline roundtrip.

Future consumer seams are tactical mission dialogue, RPG campaigns, space
missions, investigation clues, RTS briefings, survival quests and branching
endings. Those games and their fiction remain outside VANILLAJS.

## v2.8.0 — Game Maker API (proposed)

Offer an explicitly owned facade over existing drawing, asset, input, clock and
audio facilities. Initial design operations are surface creation, rectangles/
circles/lines/sprites/text/tile layers, bounded particles, camera transform,
validated local asset admission, supplied input sampling, fixed-step advance,
sound playback, pause/reset and disposal. These are planned operations, not
imports available in v2.6.0.

Each instance must own its resources; no required mutable global engine, hidden
animation loop or network loader. Existing native rendering paths remain the
backends. Drawing works from immutable snapshots and camera state; input adapters
and user-gesture audio activation are explicit. Disposal must release listeners,
buffers, voices and owned URLs. Two instances must coexist and reset independently.

### Tilemaps and portable game workflow

A proposed tilemap envelope references a local Sprite Foundry atlas, bounded
integer dimensions, visual layer cells, collision layer cells, marked spawns/
triggers, camera-follow settings and optional parallax. Reject unknown versions,
invalid atlas references, duplicate IDs, malformed arrays and resource budgets
before accepting a map. Palette/tileset edits retain history and preserve source
provenance.

Define the conversion once: authored tile columns/rows are integers; pixel rows
grow downward, while authoritative motion/combat uses +Y up at 256 subunits per
game unit. Select an integer subunit tile size and explicit origin, bounds,
rounding and boundary rules. Test overlap and motion through complete collision
cells. The existing point endpoint callback cannot be advertised as a swept
body/tile solver without implementing the missing clearance/sweep behaviour.
Keep combat hurtboxes/projectile sweeps consistent with rendered tile geometry.

Game Maker Lab must move from an empty scene through sprite import/creation,
tile editing, player movement/collision, interaction, sound, win/lose and restart
to a genuinely playable portable export. Export must include only the actual
validated runtime/module dependency closure, assets, licences and notices.
Provide a copyable public-module example that runs in an independent folder.
Tests must launch that export offline under a nested path; do not equate scene
JSON with a complete game or widen the current Workbench exporter claim.

The agent catalogue must name real entry files, schemas, modules, commands,
ownership boundaries and limits, checked against `MODULES.json`.

## v2.9.0 — HORIZON, 3D Racing Foundry (proposed)

HORIZON is **three separately reviewed implementation PRs**. The complete
milestone must pass review before v2.9.0 publication.

### HORIZON-001 — Rendering, materials and environments

Add an optional compatible native WebGL path for meshes/normals/materials,
procedural textures, directional/ambient light and a documented approximate
roughness model. Add credible glass/vehicle finishes, sky/atmosphere, fog and
bounded shadow/contact-shadow techniques. Preserve existing renderer entry
points and credible WebGL1 support; WebGL2-only effects need explicit fallback.

Environment data must generate aligned road/terrain geometry with elevation and
camber, trees/scenery, buildings, bridges and tunnels. Static batching and low/high
profiles require explicit vertex/batch/texture/shadow budgets and disposal.
Heightfield sampling can support terrain, but bridges/tunnels require an explicit
multi-surface road representation rather than pretending a single heightfield
represents stacked surfaces. Establish render/contact alignment tests now.

Procedural vehicles need distinct original silhouettes with hood/roof/doors/
windows, bumpers/lights, oriented wheels, steering and wheel rotation, suspension
compression, body pitch/roll, brake lights and paint/material options. Visual
rig state consumes simulation output and cannot feed cosmetic motion back into it.
Imported geometry must obey reviewed asset limits and source/licence obligations.

### HORIZON-002 — Vehicle dynamics and simulation

Keep `road-arcade` unchanged for current consumers. A separately versioned
world-space vehicle contract uses SI mass/inertia approximations, pose/velocity,
engine RPM/torque curves, gear ratios/final drive, driven wheels, wheel contact,
suspension and surface parameters. Controls are bounded throttle, brake, steer
and gearbox requests advanced with a fixed explicit timestep.

Provide speed-sensitive steering, braking/engine braking, grip/lateral slip,
surface friction, weight-transfer approximations, bounded spring/damper response,
four-wheel contact sampling, banking/elevation, jumping/landing, collision and
recovery. Arcade and simulation-oriented settings are explicit profiles of the
documented model, not a claim of real vehicle fidelity.

The vehicle truly steers in world-space geometry. Road-local offsets/lane shifts
cannot substitute for that behaviour. Camera shake, visual roll, wheels and audio
consume authoritative state separately. Contact queries must use the same road
surface definition as rendering, with bounded work and declared high-speed limits.

Reference cases: constant-radius turns, low/high grip, braking distance, free
coast/engine braking, static suspension equilibrium and damped settling, split
surface contacts, banked/elevated roads, loss/reacquisition of wheel contact,
jump/landing and high-speed barriers. Include negative controls for tunnelling,
energy growth and invalid states. Compare numerical trajectories independently
of GPU pixels; report approximation/error bounds and timestep sensitivity.

### HORIZON-003 — Creator tools, showcase and polish

Extend the existing Track Foundry with elevation/banking, scenery, material/
environment presets and surface classifications. Vehicle Foundry authors original
classes, torque/gears, suspension, cameras and engine/exhaust synthesis. Both
provide test-drive previews, retained history and strict data-only import/export.

Preserve `qsol.vanillajs.track.v1` unchanged: its present four road sections/eight
X/Z gates do not encode height or banking. New geometry needs a versioned sidecar
or separately reviewed explicit migration, with legacy fixtures, unsupported/
unknown-field rejection and rollback of authoring plus simulation state.

Deliver an original scenic mountain/coastal route, detailed sports car, true
elevation/banked corners, terrain/trees/roadside objects, bridge or tunnel and a
meaningful rival. Chase, bonnet and cockpit-style cameras accompany real steering,
braking/traction, engine/tyre sound, checkpoints/finish, time/speed/gear/route HUD,
pause/restart and clean input cancellation. Author a visible quality target and
record actual browser screenshots against it; avoid universal photorealism claims.

Completion includes geometry regression, camera transforms, contact/render
alignment, valid/invalid track and vehicle data, actual Chromium route completion,
offline packages, low-detail rendering, context-loss recovery and measured
performance budgets on identified hardware/software. State whether each measurement
is CPU preparation, software GPU or physical GPU work; no inferred hardware claims.

## Shared review and verification gate

Each milestone needs a reusable API or compatible substantive extension, real lab,
authoring workflow, portable validated format, tutorial, agent entry, consumer seam
and recorded tests. Run the repository's required Node, check, build, offline and
whitespace commands, plus applicable packaged Chromium suites. Preserve existing
trust/source-bound witness policy and owner-only runner restrictions.

Every implementation PR records its exact source SHA, module/asset/package
identities, failures and corrections, executed commands, unsupported platforms,
numerical limits and any measured performance. Preserve old evidence and proofs.
Do not silently reinstall browser tooling or mark a reused witness as fresh
execution. Only reviewed-main authority may permit browser receipt reuse.

## Games2 readiness

This table separates existing baseline seams from this candidate and later work.
The actual v2.6.0 adoption decision must use its verification record and an
owner-published immutable release; no row is permission to edit Games2.

| Consumer genre | Existing verified baseline facilities | Candidate / planned addition |
| --- | --- | --- |
| Strike Pixel and other FPS | character, weapons, combat3d, input, render-webgl | v2.6 candidate: weapon feel and presentation recipes; adopt only after milestone verification/release |
| Arcade platformers | motion2d, combat2d, audio2d | v2.6 candidate: sprites/atlases; tilemaps remain v2.8 proposal |
| Tactical/adventure | navigation and interactions | Scene/narrative composition remains v2.7 proposal |
| Racing | road-arcade, current Track Foundry, exact-circuit | HORIZON rendering/vehicle/authoring remains v2.9 proposal |
| RTS/strategy | navigation/flow fields, existing lab recipes | Tilemap and scene/narrative additions remain proposed |
| Space | flight, orbital-physics, rendering and audio | Richer scene composition remains proposed |
| Intros/cinematics | demo-scene, demo-timeline, soundtrack | General scene animation remains proposed |

A later Games2 consuming PR must pin an immutable release/commit, retain the
dependency closure and licences, document conversions/limits, and run its own
actual game tests. Engine verification does not automatically validate a game.
The [separate integration/promotion policy](GAMES2_INTEGRATION.md) still applies.

## Inspiration and ownership

OhMyGame informs the requested asset-creation workflow; PlayCanvas informs small
scene/component composition; raylib, LittleJS and Kontra.js inform API simplicity;
melonJS informs tilemap authoring; TIC-80 informs bounded sprite/music creation;
Twine informs branching-story editing. These are design inspirations, not copied
engines, imported APIs or claims of feature parity. No code/assets from those
projects are included by this programme plan. The specifically requested
AFTER//ZERO revision has its own [source audit](AFTER_ZERO_GAME_FEEL_AUDIT.md).
Existing VANILLAJS contracts remain the implementation starting point.

**Build the engine. Prove the physics. Make the tools. Teach the creator.**
