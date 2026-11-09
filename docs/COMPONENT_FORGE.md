# VANILLAJS v1.5.0 — The Component Forge (development)

**QSOL-IMC: Make amazing alien tech and put it under an Apache 2.0 license.**

Scope: a usable, explicit component-based Unity/Unreal-style editing **vertical
slice** built directly on the v1.4 WebGL/geometry/collision/time modules.
This is not a claim of Unity feature equivalence or standalone-game export.

## v2 scene contract and backward compatibility

- Previously released schemaVersion=1 documents are **still parsed and serialized
  without mutation** by the legacy model, including all original field names.
- The editor explicitly calls upgradeScene() after loading v1 data. The migration
  retains names, stable IDs, local transforms, parent links, visibility, colors,
  object roles and nextId, and attaches deterministic default component records.
- The new editor creates and saves schemaVersion=2 scenes. v2 files are
  validated again on import; unknown component keys, unknown fields, nonfinite
  numbers, dangling parents, cycles and mismatched body roles are rejected.
- No remote code or asset execution is enabled by importing a scene file.
  Imports remain bounded to 128 KiB and 128 entities.
- v2 keeps the legacy body property as a **strictly checked compatibility
  mirror**: body derives from Rigidbody mode and Player Controller enabled state.
  Editing the old Body selector reconciles the corresponding components.

### Typed components

| Component | Authored fields | Current consumer |
|---|---|---|
| Transform | existing position XYZ, Y yaw, scale XYZ, parent | hierarchy, gizmos, renderer and picking |
| Mesh Renderer | enabled | retained box mesh drawing and viewport picking |
| Collider | enabled | static-axis aligned continuous contact during Play |
| Rigidbody | static/dynamic mode, gravityScale [0,10] | fixed-step gravity and collision |
| Player Controller | enabled, speed [0,40], jumpImpulse [0,30] | WASD/Space movement and jumping |
| Trigger | enabled, tag | once-per-entry deterministic enter events |
| Camera | enabled, FOV [25,120] | serialized authoring metadata (runtime camera selection later) |

The editing frontend never directly mutates a committed scene. Each valid
component edit produces a new complete scene snapshot and one undo transaction.
Multiple player-role components are disallowed. Duplicating the player
reconciles the duplicate to a Dynamic body without another controller.

## Transform tools

The WebGL viewport draws **real projected world XYZ handle lines**, not
merely decorative buttons. Pointer hit testing is resolved against their
screen-space segments.

- **W / Move**: drag an X, Y or Z axis; world/local coordinates supported,
  including nested parent yaw and nonuniform parent scale.
- **E / Rotate**: Y yaw only in v1.5. Full quaternion/local XZ rotation is
  deliberately not implied.
- **R / Scale**: drag a local X, Y or Z dimension.
- **Snap**: position 0.25m, yaw 15°, scale 0.1 in the selected transform
  space; toggle on/off from the toolbar.
- A pointer drag creates **one** history transaction; pointer cancellation
  discards its uncommitted scene. Existing Shift + drag root-plane movement
  and orbit controls are preserved.

Camera orbit does not repack/upload scene geometry. Gizmo buffers are retained
through the same first-party WebGL API and rebuilt with the actual object
state, not with arbitrary per-frame simulations.

## Deterministic preview and limitations

SchemaVersion=2 Play mode runs at 60Hz using **moveAndSlideAABB** from VANILLAJS
collision, with dynamic bodies, per-body gravity scale, component-defined
player movement/jump and bounded trigger-enter events. Trigger detection is
component-authorable and uses ID-based transition tracking.

- Only static **axis-aligned** Colliders (yaw 0 or 180) are eligible collision
  obstacles; all other rotation is currently visual/authoring only.
- Dynamic–dynamic contacts are NOT solved.
- Rotated Trigger volumes and general mesh collision are NOT supported.
- Camera is typed authoring metadata, not an active scripted runtime camera.
- Objects and projects do NOT yet carry scripts, imported meshes/textures,
  prefab inheritance or standalone export.
- Failure to complete the continuous movement solve is reported, not silently
  converted into a successful world update.

Play mode starts from an immutable authored scene snapshot, deterministically
steps its own world, and Stop restores the complete authoring state.

## Verification and release gate

    node --test tests/component-forge.test.js tests/editor-gizmos.test.js
    node --test tests/editor*.test.js
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-offline.js

The existing Chromium packaged browser witness checks actual WebGL output,
new component editing, schema v2 save/import, schema v1 automatic migration,
toolbar control state, Play/Stop, responsive layout and malicious import refusal.

No changes to the frozen v1.4 CPU/RTX evidence receipts or published release tag.

Next: quaternion gizmos, real component registry/typed prefab assets, mesh
imports with byte provenance, physics interaction matrix, and standalone
HTML game export. Those are **future** projects, not v1.5 features.
