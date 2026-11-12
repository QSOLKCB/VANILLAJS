# VANILLAJS visual editor

Start with the [Creator Hub](../demos/creator-hub/index.html) and
[step-by-step creator guide](CREATOR_GUIDE.md). The workbench is an experimental
native browser editor for small 3D scenes, assets and game data.

## Open and learn

From the repository root run `python3 -m http.server 8000 --bind 127.0.0.1` and
open `http://127.0.0.1:8000/demos/editor/index.html`. Use HTTP(S), not direct
file opening. The packaged site also works offline after its first verified
service-worker installation.

Quick start offers Playground, Jumping course and Trigger trail templates.
Loading a template is one undoable scene transaction with fresh entity IDs;
existing asset attachments restore with Undo. Add piece creates configured
platforms, players, walk-through triggers and decorations. Scene checks explain
unsupported configurations and select the relevant object. Focus basics hides
advanced panels without changing the project. Play and project-download marks
apply to the current scene and reset after edits; they are reminders, not test
certificates or proof that a download was retained.

## Current capabilities

- Native WebGL viewport with hierarchy search, rotated-box picking, orbit/zoom,
  frame selection/scene, X/Y/Z move and scale, Y rotation, local/world modes,
  snapping and undoable pointer gestures.
- Schema-v2 component inspectors for meshes, colliders, rigidbody gravity,
  player movement/jump, trigger tags and camera metadata. Legacy v1 scenes
  migrate on import.
- Local OBJ, opaque PNG up to 64×64, materials, prefabs and explicit asset
  provenance. Projects preserve scene and library; scene-only files do not.
- Fixed 60 Hz Play/Pause/Stop preview with bounded catch-up, input cancellation,
  continuous AABB collision against supported static platforms, and trigger
  entry events. Stop restores the authored scene.
- Exact decimal/Q16 position authoring and explanatory conversion preview.
- Independent 4X campaign draft editing, text diagnostics, star-map layout,
  lane/home editing and hull silhouette projection. See the
  [VOIDWARD workflow](VOIDWARD_WORKFLOW.md).
- Playable HTML export and a complete runtime-folder exporter:
  `node scripts/export-game.js project.vproject.json --out NEW_FOLDER`.

## Formats, units and limits

World coordinates use metres, +Y up, -Z forward and right-handed yaw. Scene
source is bounded to 128 KiB, 128 objects and hierarchy depth 16; project source
is bounded to 256 KiB. Validation rejects unknown fields, nonfinite transforms,
cycles, dangling parents and multiple enabled players. Imported JSON is data,
never evaluated as code.

Only visible static colliders with world yaw divisible by 180 act as
axis-aligned solid platforms. Rotated triggers are also ignored. Dynamic bodies
do not collide with each other. Camera components are authored metadata; the
preview camera remains fixed by the player/editor implementation. Imported
meshes change rendering, while collision continues to use supported boxes.
Triggers report events; custom scripts, quests, scoring and victory logic are
the consuming game's responsibility. No full rigid-body solver, arbitrary-angle
collision engine or scripting VM is claimed.

Undo retains at most 64 scene snapshots. Asset placement state follows scene
history; asset definitions themselves are library operations. Recovery is
explicit and browser-local. Download projects to keep portable backups.

## Further contracts

- [Component Forge](COMPONENT_FORGE.md): components, gizmos and preview semantics.
- [Asset Foundry](ASSET_FOUNDRY.md): imports, bounds, provenance and export formats.
- [Editor QoL](EDITOR_QOL.md) and [viewport QoL](EDITOR_VIEWPORT_QOL.md).
- [Exact authoring](EDITOR_ALIEN_AUTHORING.md).
- [Optional rendering](OPTIONAL_GPU_WASM.md): CPU baseline and explicit GPU consent.
- [Creator guide](CREATOR_GUIDE.md): recipes, packaging, troubleshooting and checks.

Run `node --test tests/*.test.js`, `node scripts/check.js`,
`node scripts/build.js` and `node scripts/verify-offline.js`. The existing
packaged Chromium suite exercises authoring, valid/invalid imports, undo,
recovery, Play and mobile layout. Emulated screens and software WebGL do not
establish physical mobile, controller or hardware GPU coverage.
