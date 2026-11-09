# VANILLAJS Workbench — visual scene editor alpha

**v1.5 follow-up:** [The Component Forge](COMPONENT_FORGE.md) introduces schema-v2 typed components, real axis gizmos, local/world transform modes, snapping and component-driven Play/Trigger behavior. This document retains the original v1 alpha contract for migration and historical evidence.


**QSOL–IMC motto: Make amazing alien tech and put it under an Apache 2.0 license.**

This is the first **usable visual-authoring slice** of a Unity/Unreal-style
development environment. It is NOT a feature-complete replacement for
Unity or Unreal, nor a claim that all authored scenes export as games.

The application deliberately uses VANILLAJS's own native modules and
browser APIs, without an external renderer, imported framework, CDNs,
cloud services, telemetry or runtime package dependencies.

## Run the editor

From the repository root:

    python3 -m http.server 8000

Open http://localhost:8000/demos/editor/index.html.

For a deployed site, use the **Visual Editor** link on the main VANILLAJS
page. Modules require HTTP(S); direct file-open cannot load native module
imports. Only packaged HTTPS or loopback builds may install the optional
versioned offline service worker.

## Present functionality

- Real WebGL1 3D viewport using the existing WebGLAPI and
  geometry.boxMeshBatch, retained mesh buffers and persistent grids.
- Scene hierarchy, selection from hierarchy or **rotated ray–box picking**.
- Object inspector: name, parent, visibility, body type, local XYZ position,
  yaw in degrees, size and RGB color.
- Add root/child cubes, recursively duplicate/delete object subtrees,
  orbit camera with zoom, and move root cubes in the X/Z plane
  with Shift + pointer drag.
- Undo/redo of complete validated scene transactions, including transforms;
  bounded 64-snapshot undo history.
- Local JSON project save/load; **fail-closed schema validation**, a 128 KiB
  source budget and 128-object scene limit. No account, server database or
  remote persistence.
- Play, pause and stop of **one fixed-step preview**. The editor scene
  remains immutable while playing; stopping restores the authored scene.
- WebGL context restoration explicitly reconstructs all GPU resources from
  the owned scene snapshot. Rendering is performed separately from physics.
- Desktop-sized multi-pane workbench with a responsive mobile inspector and
  hierarchy. The browser remains the UI runtime on all operating systems.

### Coordinate and contract notes

The world is right-handed: +Y up and -Z forward. Parent translation, yaw
rotation and scale are applied in a local hierarchy. The box-only renderer
uses rotation around the global/local Y axis; no quaternion editor yet.

Only visible static boxes with yaw divisible by 180 degrees act as
axis-aligned platforms for the experimental Play preview. Other boxes may
appear rotated but do **not** provide a rotated physics collider.
The Play preview uses a simple 60 Hz kinematic player and vertical gravity;
it is not a rigid-body solver, full navmesh, multi-scene game runner,
scripting VM, serialized ECS, asset pipeline or game build system.

Input is cancelled on blur, visibility loss and Play/Stop transitions.
The preview uses a bounded FixedClock and cannot mutate the saved scene.

### Scene format

- schemaVersion: exactly 1.
- name: bounded printable string.
- nextId: monotonic ID counter (never reuse a deleted ID).
- objects: at most 128 scene entities, depth at most 16.
- Entity keys: id, name, parent, position, rotationY, scale, color,
  body (static, dynamic or a single player), visible.
- Recursive parent cycles, dangling parents, nonfinite transforms,
  unknown fields, duplicate IDs and multiple players are rejected.
- Physics bodies must be root entities in this editor version.

No code from the imported JSON is evaluated. Inputs are treated as
untrusted data, not scripts, HTML or remote resources.

## Checks and evidence

Run:

    node --test tests/editor-*.test.js
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-offline.js

The existing scripts/browser-check.js integration visits the packaged
editor under /VANILLAJS/ and checks rendered WebGL, hierarchy edits,
undo/redo, genuine JSON export/import, Play/Stop, invalid input rejection
and mobile layout. Browser validation uses the repository's pinned
isolated Playwright tooling in GitHub Actions and does not introduce
runtime dependencies.

The geometry mesh is rebuilt **only** after an authored-scene change,
selection highlight or simulation update; moving the editor camera
does not rebuild/upload scene geometry. Do not extrapolate the v1.4.0
Proof of Speed benchmark to this editor without instrumenting an actual
scene-workload test.

## Next phases (not implemented)

1. Independent world-space translation/rotation/scale gizmos and snapping.
2. Real entity/component architecture and typed component inspectors.
3. Material/texture import with strict provenance and asset constraints.
4. Proper dynamic AABB/rotated collision, optional Q16.16 playback and
   deterministic event/replay recording.
5. Authored gameplay scripting with explicit trust boundaries, versioned
   project files and plugin capability controls.
6. Scene packaging, first-party asset validation and standalone-game export.
7. Expanded GPU profiler, editor timeline and large-scene streaming.

Before promoting the editor beyond alpha, test its actual end-to-end
authoring workflows and independent browser/OS environments.

**QSOL–IMC — Make amazing alien tech and put it under an Apache 2.0 license.**
