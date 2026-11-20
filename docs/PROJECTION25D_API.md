# VANILLAJS-25D-001 — Reusable Projection & Asset Foundation

**Status:** experimental, opt-in candidate; review and CI required. **Scope:** pure presentation geometry plus a deliberately separate offline OBJ authoring utility. This is **not** a new physics engine or a replacement for HORIZON's `scenic3d`, `scene-graph`, `sprite2d`, or `render-lit`.

## 1. Presentation-only oblique projection

[`modules/projection25d/index.js`](../modules/projection25d/index.js) uses native ES modules, no runtime dependencies, and +Y height. The flat authoritative ground is X/Z. +X appears right and +Z down on screen; local -Z remains forward. The consumer must explicitly convert its own world-unit scale and axis conventions. GFTA6's integer XY state is **not** a VANILLAJS `vehicle3d` snapshot and is **never** cast as one.

```js
import {createProjection25D,projectPoint25D,projectScene25D} from './modules/projection25d/index.js';
const camera=createProjection25D({
  viewport:[800,600],origin:[0,0],pixelsPerUnit:8,
  heightRise:0.8,heightShear:0.35,shadowDirection:[0.4,0.2]
});
const screen=projectPoint25D(camera,[2,5,-3]);
const scene=projectScene25D(camera,[{id:'house',x:1,z:-5,width:6,depth:4,height:3}]);
// Draw scene.shadows first; then each solid.sideX, solid.sideZ, solid.roof.
// The returned `footprint` is [x,z,width,depth] and is never enlarged by height.
```

The camera is an owned frozen object with exact validated fields; use `createProjection25D` for another camera or viewport. No render clock, DOM, physics state, collision callback, network or unseeded randomness enters the module. Heights and shadows affect polygons only. `unprojectGround25D` inverts *Y=0* coordinates for input hit testing; it does not reconstruct 3D geometry.

**Budgets:** at most 128 rectangles, bounded finite coordinates, dimensions, camera magnification, viewport and height. Each rectangle yields four fixed four-point polygons (shadow, side X, side Z, roof); the renderer owns colours and compositing. Object IDs are unique. The returned scene has separate shadow and solid sequences to prevent a later shadow from overdrawing a previously painted building.

**Limitations:** the visual order is a deterministic near-edge painter ordering (far ground-Z first, then X, then ID). It is not a z-buffer, and it does not resolve arbitrary intersections, occlusion cycles or overlapping building roofs correctly. Use `render-lit` and retained meshes for general 3D occlusion. No claim of photorealistic lighting, pixel-identical browser output or faster FPS is made.

[Try the dual-view demonstration](../demos/projection25d-lab/index.html). Both views read a single immutable world; no authoritative state is advanced by drawing.

## 2. Offline OBJ → original WebGL1 lit-mesh geometry

The authoring-only command parses a bounded UTF-8 `.obj` without adding an NPM package, network fetch, runtime dependency or binary executable:

```sh
node scripts/convert-obj-to-mesh.mjs --in /path/to/verified-car.obj --out /path/to/car.mesh.json --scale 1
```

This **create-only** command refuses to overwrite an existing target. It emits `qsol.vanillajs.lit-mesh.v1` JSON, an ordered XYZ / flat normal / white RGB / UV stream (11 float32 values per vertex), Float32 bounds, source geometry statistics and the SHA-256 of the original OBJ bytes. A consumer may create a `Float32Array(mesh.vertices)` for the existing lit renderer after independent format/size validation. The geometry is **not auto-loaded into VANILLAJS**.

The parser supports XYZ `v`, UV `vt`, optional validated `vn` indices, relative/absolute references, triangles and quads (triangulated in stable input order). It rejects nonfinite, degenerate, out-of-range, oversized or unknown directives. Limits include 512 KiB source, 8,192 positions, 4,096 faces and 24,576 output vertices. Source file `.mtl`, texture maps, objects/groups, source smoothing groups and vertex colours are **not imported**. Supplied normals are not used; triangle normals are recomputed from accepted Float32 geometry. UVs are retained but the runtime's material/texture authoring remains the consumer's responsibility. Source units, facing direction and scale must be verified per asset; no automatic orientation correction is claimed.

**Licensing:** no Quaternius, GGBot, TORCS, Speed Dreams or itch.io third-party source/assets are included. The tool's source digest is a provenance aid, **not proof of licence**. A game's author must record and verify its licence and redistribution permissions before committing converted assets. GPL racing code must not be ported into the Apache-2.0 core.

## 3. Integration and acceptance gates

- PR base and candidate pinned to exact SHAs; source documentation and `MODULES.json` registered.
- `node --test tests/*.test.js`, `node scripts/check.js`, `node scripts/build.js`, and `node scripts/verify-offline.js` must pass; existing browser gates remain enabled.
- Unit tests cover immutable projection, same collision footprint under different heights, deterministic sorting, dense/finite validation, OBJ face/normal/UV output, malformed input, source SHA and no-overwrite CLI.
- Packaged browser evidence must render both [demonstration views](../demos/projection25d-lab/index.html). Measure device-specific frame p50/p95 separately; do not treat SwiftShader as native RTX performance.
- **Do not merge here:** only after review/owner acceptance can GFTA6 pin the resulting approved upstream SHA and independently test unchanged gameplay and replay receipts.

The intentionally modest API is designed to support GFTA6, 2D games and editors without binding game content or mission policy to a rendering implementation.
