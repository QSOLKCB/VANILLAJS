# WORLD-VIS-001 — Retained World & LOD

**Status:** experimental, opt-in review candidate. Based on VANILLAJS `main@1cc01f715a833febd53366e49c7ca724911bd152`, including merged CAD-003 PR #143. Implements P3 of [OSS-GAME-REUSE-001](OSS_GAME_REUSE_2026_ROADMAP.md). This phase does not replace or change SENSE-001, CAD geometry, physics, HORIZON races, rendering shader source, scene serialization or historical evidence.

**Playable study:** [The Retained World](../demos/world-vis-lab/index.html). Loads the actual original HORIZON Scenic3D coast world at low source profile and partitions it with the existing `partitionRaceWorld` function from HORIZON-009. Only camera-selected render batches change; the original ScenicRoad sampler and its physical geometry are preserved.

## Public module and authority boundary

`modules/world-vis/index.js` exports:
- `createRetainedWorld(batches)`: snapshots 1–128 static, uniquely named, valid LitRenderer XYZ/normal/RGB/UV mesh batches. The input Float32 arrays and validated opaque/transparent materials are **copied**; the returned world object exposes only immutable counts and budget facts. Source is retained privately. Source budget 12 MiB (both high and coarse buffers).
- `selectRetainedView(world,camera,{cull=true,lod='auto',lodDistance=120})`: pure, deterministic, side-effect-free query for an explicit camera (`position`, unit `orientation` quaternion, radians `fov`, `aspect`, `near`, `far`). Derives the same six perspective clip planes as the existing native math pipeline and delegates conservative AABB classification to `geometry.classifyAABBFrustum`. Unknown/accessor fields, invalid cameras, unbounded inputs and forged worlds fail closed.
- `RetainedLitWorld(renderer,world,{maxResidentBytes,maxMeshes})`: opt-in GPU buffer controller for **existing LitRenderer**. Cache entries are identified by immutable source ID and LOD; repeated still-camera frames do not upload the same buffer. The controller validates the entire view's draw count and resident bytes *before evicting* anything. Explicit `rebind(newRenderer)` releases old owned handles and reuploads on the next draw after WebGL context restoration, with a caller-owned new renderer. `dispose()` is idempotent.
- `WORLD_VIS_LIMITS`: at most 128 static batches, 12 MiB full snapshot source high+coarse, 8 MiB default resident GPU-owned vertex data, 128 resident mesh handles; immutable diagnostics. These counters are **not** whole-process RAM or GPU VRAM budgets.

### Stable visibility, draw order and memory

Culling is a strict presentation decision. Bounds conservatively include every original vertex, including flat surfaces widened by 1 mm plus a precision margin. A definitely-outside frustum classification rejects a batch; uncertain/touching bounds are **kept**. Full-detail batches preserve the **source's exact Float32 vertices**. When culling is disabled with `lod='high'`, the full source is selected in original order without loss or resampling.

Opaque batches draw in original authored order. Transparent batches (`opacity<1` or the existing glass/shadow material patterns) draw **back-to-front**, sorted by source-bound centre distance and then ID for deterministic ties. This preserves existing blending semantics without changing the LitRenderer's material, shader, context or depth-write rules. Transparent geometry remains an approximation because sorting is by **batch**, not exact intersecting per-triangle depth.

Optional coarse LOD chooses a deterministic **subset of whole source triangles** (one of every three for sufficiently sized batches; tiny meshes retain full geometry) after the batch is sufficiently far beyond `lodDistance`. Crucially, this is a **visual impostor/geometry study, not a surface-preserving mesh simplifier**: far objects may visibly lose triangles or show holes. It is deliberately opt-in, never replaces source vertices, mesh colliders, road traction or export/project authority. No claim of pixel identity applies across high/coarse LOD. A future geometry-aware simplifier is an independent follow-up, not silently implied by a primitive stride-based decimator.

The selected view's retained vertex byte total is checked against the GPU buffer budget; oversubscription causes a visible error, **not silent omission of otherwise visible geometry**. GPU buffers are reused until the camera changes their required keys. Evictions and uploads are counted; the ordinary LitRenderer still independently enforces its native max-mesh, max-vertex and max-draw limits. This module does not alter texture resolution, colour precision, antialiasing or procedural material patterns; the current native LitRenderer does not fetch external textures.

### Multi-camera behaviour

The [HORIZON study](../demos/world-vis-lab/index.html) exposes Coast Overlook, Roadside and Ridge cameras and evaluates all three independently, with source-linked counts. The selected camera alone changes WebGL presentation. The original HORIZON road remains an unmodified dependency. No renderer/query output feeds physical scene geometry, real-time simulation state, network visibility or AI decisions.

**No gameplay truncation:** simulation, collision, SENSE-001 visibility and replay stay authoritative even for batches outside the camera or using a coarse display mesh. The existing HORIZON-009 tile partitions are reused *only* for render geometry.

## Verification

~~~sh
node --test tests/world-vis.test.js tests/geometry-layer2.test.js tests/horizon-visibility.test.js tests/render-lit.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/bench-world-vis.mjs
~~~

`.github/workflows/world-vis.yml` is an unfiltered source-bound PR/push workflow. It runs focused tests, source/package/offline checks, pinned isolated Playwright 1.64 Chromium and retains a real WebGL screenshot, acceptance JSON and package manifest hashes.

Core tests cover: no-mutation high-source identity, all six plane classification and seeded independent projected-corner checks, zero hidden behind-camera false positives, switching cameras, stable opaque and transparent order, LOD whole-triangle budgets, failure-before-GPU-change, resident cache reuse/eviction/rebind/dispose, invalid/sparse/accessor input rejection and no changes to the real HORIZON ScenicRoad sample and Scenic3D triangle source bytes.

The browser test exercises **real source-packaged HORIZON geometry in LitRenderer**. With the same camera and full LOD, culling on/off must produce **byte-identical canvas screenshots**, not merely similar statistics. It also checks all three cameras, display-only coarse LOD, retained upload cache, resident GPU byte cap and, when the WebGL loss/restore extension is supported, an actual lost/restored context with no modification of road data.

### Performance and 60 FPS caveat

`scripts/bench-world-vis.mjs` collects paired native-Node CPU p50/p95 view-selection times for on/off with one source, seed, process and camera sequence, plus reproducible selected-row receipts. Timings are **diagnostic only** and vary with hardware/scheduling; no CI performance threshold is asserted. Hosted SwiftShader is a functional browser surrogate, **not** a physical RTX 5060 Ti GPU benchmark, and does not establish or guarantee 60 FPS.

Before claiming physical rendering gains, execute paired *same GPU/driver/resolution*, identical camera-path tests with culling on/off and quality settings fixed, report p50/p95 CPU+GPU frame times, mesh upload/draw counts and visuals with source SHA receipts. Preserve the previous 60 FPS baseline as an acceptance condition, not an assumed benefit of this feature.

## Source attribution

Uses only existing first-party Apache-2.0 VANILLAJS `geometry`, `math`, `render-lit`, `scenic3d` and HORIZON-009 partitioner. Third-party engine names in the roadmap (Godot, Luanti, Craft) are conceptual background, **not code transplants**. No Docker, Node runtime in the browser, service, CDN, third-party art, OpenGL addon or WASM is introduced.

**Deferred:** multi-region textures, geometry-preserving LOD, asynchronous streaming, arbitrary moving collider index updates, a fully independent transparent OIT pass, and physical GPU regression certification.
