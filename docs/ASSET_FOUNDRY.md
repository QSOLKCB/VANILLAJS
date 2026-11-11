# VANILLAJS v1.6.0 — The Asset Foundry (alpha)

**QSOL-IMC: Make amazing alien tech and put it under an Apache 2.0 license.**

The Asset Foundry brings the first real reusable, imported scene resources into
VANILLAJS Workbench. It builds directly on the existing WebGL1 XYZ/RGB renderer
and the v1.5 Component Forge without adopting a third-party runtime engine.

## Open the editor

- Main site: https://qsolkcb.github.io/VANILLAJS/demos/editor/index.html
- Local development: python3 -m http.server 8000
- Then navigate to http://localhost:8000/demos/editor/index.html

These new features appear after this PR is reviewed, merged and deployed.
No cloud login, project database, CDN or asset service is required.

## Asset import and authoring

- **OBJ meshes:** import a local UTF-8 Wavefront OBJ file up to 64 KiB.
  Supported: XYZ vertices, UV coordinates, positive/negative indices, and
  triangle/quad/n-gon faces of up to eight corners, triangulated in fixed
  fan order. Normals and harmless object/group metadata are ignored.
  External material references (mtllib/usemtl), scripts and external URLs
  are rejected. Up to 512 output triangles per mesh.
- **PNG textures:** import local PNG files up to 64 KiB whose decoded size
  is at most 64 by 64. The current opaque renderer requires every pixel's
  alpha to equal 255. The browser decodes the file once into canonical RGBA
  bytes, which are stored with the project.
- **Materials:** authored RGB colors can be applied to ordinary boxes or
  imported meshes. If a material references a PNG, texture pixels are
  sampled by OBJ UV at triangle vertices and baked into the existing
  XYZ/RGB geometry format. This is **vertex-colour texture baking**, NOT
  bilinear texture filtering, a PBR material system or WebGL sampler2D.
- **Prefabs:** capture a hierarchy with component data and mesh/material
  assignments, instantiate it with new unique entity IDs, and preserve
  parent relationships. Existing player roles are reconciled to avoid
  accidentally instantiating a second controller.
- **Attachments:** attach mesh or material assets to a selected entity.
  Scene geometry is regenerated only on editor changes or preview ticks;
  camera orbit does not force a new mesh upload.
- **Provenance:** SHA-256 hashes of the original local OBJ/PNG input bytes
  and explicit, user-selected license metadata travel with the project.
  The license claim is user-declared and is NOT independently verified.
  SHA-256 is source identity evidence, not proof of ownership or origin.

**Rights caution:** the default OWNER-LOCAL-ONLY is deliberately not
Apache-2.0. Importing an external model does not automatically grant
permission to redistribute it with the engine.

## Project format and backwards compatibility

The released v1 and v2 scene parsers and serializers remain unchanged.
Assets are stored in an optional separate, strictly validated JSON wrapper:

    format: qsol.vanillajs.asset-project.v1
    scene: existing schemaVersion 2 authored scene
    library: assets and entity-to-asset placements

Use **Export project** to keep the geometry, material palette, prefab
library, canonical texture pixels, source hashes and scene together.
Use **Open project** to roundtrip the full document. The old **Save scene**
still exports only authored scene data and intentionally does not embed
assets. A legacy scene opened via **Open scene** creates an empty library.

Project data is bounded to 256 KiB, 32 assets, 128 placements, 128 scene
objects and a retained uploaded geometry limit of 2 MiB. Malformed
references, duplicate identities, unsupported syntax, invalid numeric
components, foreign project fields and dangling placements are rejected.

The library currently has its own edit history: undo/redo of asset
attachment and creation is not yet integrated with the scene-transform
history. Asset library operations are not executable code.

## Rendering, physics and determinism

The imported OBJ triangles are rendered as vertex-colored native WebGL1
triangles, transformed using the same authored position/scale/Y-yaw rules
as built-in box primitives. Each imported mesh is packed into an owned
Float32 XYZ/RGB buffer with an explicit size cap.

Existing Collider components still use the authored **axis-aligned box
proxy**, not triangle mesh collision; rotated mesh collision is not
claimed. Deterministic geometry, attachment and prefab roundtrip
behavior is unit-tested. Browser-derived PNG pixel decoding can vary
with image/color profiles across browsers; only the *stored canonical
RGBA asset* is guaranteed to replay byte-identically after import.

## Verification

    node --test tests/asset-foundry.test.js
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-offline.js

The CI browser witness also exercises actual OBJ import, attaching a
mesh, project export and roundtrip, creation of a reusable prefab, and
verifies malformed foreign assets are refused.

No new network or Node/npm dependency is included in the shipped game.

## Next: The Sound Forge

The next milestone is an explicitly versioned DSP/music layer and visual
Sound Forge lab with reproducible offline PCM/WAV receipts, demoscene-style
event trackers, audio scheduling and science-informed sonification.

Research from QSOLKCB/SPECTRAL and QSOLKCB/SONIFICATION must be treated as
attributed mathematical/surrogate inspiration, not fabricated physical
material recordings. The existing modules/audio2d and synthesis research
are suitable foundations, but sound playback, formal mathematical mapping
and scientific material claims require separate evidence.

**QSOL-IMC — Make amazing alien tech and put it under an Apache 2.0 license.**

## Optional CPU / GPU graphics and space labs

See [the GPU/WASM and Space Game Lab guide](OPTIONAL_GPU_WASM.md) for the experimental
CPU-first renderer, explicit player opt-in, editor project setting and playable
HTML export, exact-math preparation, resource limits, and local test commands.
The project v2 envelope preserves graphics policy; legacy v1 projects still load.
Existing WebGL APIs remain supported.
