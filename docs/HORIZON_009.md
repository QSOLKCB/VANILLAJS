# HORIZON-009 — Deterministic visibility pipeline (SGI/QEC-inspired)

**Scope:** HORIZON Racing Foundry presentation only. Builds on merged
HORIZON-008 on `main`. No simulation, contact, checkpoint or authored
project/schema changes; no modifications to the existing WebGL1 shader.

## Architecture

The original fixed-function graphics lesson is to submit less work, not to
replace fast GPU rasterization with a slower JavaScript rasterizer.
`race-visibility.js` splits only the **opaque terrain and foliage** batches
into a fixed 4×4 row-major grid during scene replacement. Every complete
11-float-vertex/33-float-triangle payload is copied with `Float32Array.set`
without changing its values. Triangle ownership is determined by centroid
and stable integer tile address. A conservative world-space AABB and sphere
is retained per tile; the original physics/contact `world.batches`,
`sampleSurface`, scene materials, normals, UVs and transparency remain
unchanged. No new runtime dependency, extension, network request or
GPU buffer per simulation tick.

Each displayed frame uses the **actual filtered presentation camera** and
the existing 0.08 m near / 2000 m far / camera FOV to reject only tiles
wholly outside the perspective planes. Bounding-sphere radius contributes
to all side/near/far tests; camera degeneracy fails *open* and draws all
tiles. Non-tiled batches, translucent water/glass, car/rival and checkpoints
always follow the existing renderer path. No new forced LOD or popping
threshold. All tile meshes remain retained; visibility never deletes an
accepted GPU handle.

The renderer snapshot adds `view.visibility`:
`enabled`, `totalTiles`, `visibleTiles`, `culledTiles` and
`culledVertices`. This is a diagnostic of **submitted geometry**, not an
FPS claim. `visibilityEnabled=false` is an explicit test comparator
that draws the same retained tile meshes without culling.

## QEC/SGI research boundary

QEC v137.11.1 and v137.11.3 motivated deterministic ordering and
preprocessing; this is an independent, inspectable JavaScript
implementation. No QEC code, FP encoding, GPU pipeline implementation,
external assets or QEC verification claim is imported. QEC v74.3.0 voxel
fields and v136.1.0 settlement/network data remain separate possibilities
for future authored RTS/4X content; they are **not** part of this PR.

## Required correctness gates

- Node test compares the exact Float32 byte sequence of every source
  terrain/foliage triangle against the sum of retained tile triangles
  (including multiplicity), tests deterministic rebuilds, camera frustum
  edge cases, and confirms the original physics sampler is not mutated.
- Packaged Chromium HORIZON race workflow creates actual high/low native
  `RaceView` instances. It compares *complete RGBA WebGL readbacks* for
  chase, bonnet and cockpit views, with culling enabled versus disabled on
  the same retained tiles and unchanged source/scene/driver state.
  One byte difference fails. The same run records software-rendered
  median/p95 synchronized one-pixel readback times and rejected vertices.
- Existing browser race, edit/undo, context-loss, package,
  exact-source closure and 1,000-cycle endurance checks remain enabled.
  `race-runtime.js` must exactly match regenerated source and the live
  cache-profile hashes must represent all changed executable sources.
- The source/test/browser gates are *not* evidence of sustained
  **60 FPS** or end-user graphics quality on a physical GPU.

## 60 FPS and appearance acceptance

The next visual-quality change should use this headroom for better
materials/scene detail, *only after* device-matched evidence on the same
scene, viewport, camera, profile and graphics driver. Record the exact
baseline and candidate SHAs, original pixels/screenshots, 1st/50th/95th
percentile frame time, draw counts, tile visibility, GL errors, GPU model
and driver, with idle, chase-speed, tunnel, bridge and reverse-recovery
scenes. The 60 FPS frame budget is **16.67 ms**; require p95 at or below
that value on the owner-selected hardware and non-regression against the
pinned base on the same device. Browser software rasterization on hosted
CI is useful diagnostic evidence but not a substitute.

Existing paired capture helper:

```sh
node scripts/capture-horizon-polish.mjs --dist=/path/to/baseline/dist --out=/new/before
node scripts/capture-horizon-polish.mjs --dist=/path/to/candidate/dist --out=/new/after --reference=/new/before/capture.json
```

Never overwrite frozen evidence, assert real GPU performance based on
SwiftShader, or enable auto-merge/deployment before owner approval.
