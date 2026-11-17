# HORIZON-010 — Roadside fidelity with deterministic retained details

**Base:** merged HORIZON-009 / PR #117 on `main`.

HORIZON-009 proved that fixed-function-style retained scene tiling can
eliminate unnecessary draw submissions without changing pixels. This
phase spends a bounded portion of that geometry headroom on **visible**
HORIZON Racing Foundry graphics, with the same minimal-dependency WebGL1
renderer and exact native physics.

## Visual changes

- Road-edge safety posts at **integer-metre intervals**, in paired
  positions just outside the roadway. High detail places them every
  24 m; low detail places them every 48 m. Post faces have a
  metallic finish, and both approach-facing panels use the existing
  bounded emissive material. Coastal, alpine and dusk scenes use
  different vertex colours.
- At deterministically sampled bends, the generated course can show
  orange-and-dark direction chevrons mounted beyond the road edge on the
  **outer shoulder** (opposite the signed turning direction).
  Sign admission uses the actual local route tangent and signed
  change in heading, with 72 m spacing. Bridge and tunnel interiors
  do **not** sprout roadside installations.
- Existing terrain/foliage visibility preprocessing is reused for
  the new decoration. Geometric samples are grouped into stable
  240-m chunks, then ordered by `posts`, `reflectors`, `signs`,
  `ink`. Each chunk/material is a **retained mesh**, not a draw per
  post. No textures, GPU extensions, runtime dependencies or
  network assets are required. A validated `ScenicRoad` has no second
  2400 m length limit: its 3D spline can exceed the 2400 m
  **horizontal** knot budget; independent vertex/mesh budgets remain enforced.
- Cosmetic source arrays are independent of the authoritative road,
  `sampleSurface`, vehicle collision, recovery logic and ordered
  checkpoints. Scene edits use the same transactional renderer
  preflight as HORIZON-009. Source triangles and the road/project
  schemas remain unchanged.
- Browser snapshots expose an explicitly presentation-only
  `view.details` record with placed post pairs, warning signs,
  retained vertices, batches and visible draw calls. A non-gameplay
  `detailsEnabled=false` reference is available to the test harness.

## Determinism, budget and external research

QEC `v137.11.1` describes deterministic integer/fixed-point matrix
processing, bounded saturation and row-major replay receipts;
`v137.11.3` describes stable fixed-tile/scanline workload splitting
and merge order. **Inspired by the architecture, not a port.** This
phase uses integer station indices, stable integer chunk identifiers,
canonical Float32 mesh positions and fixed material ordering. It does
not claim bitwise equivalence to the QEC kernels, an actual hardware
fixed-point GPU, or a software rasterizer.

The deliberately bounded emission caps are **20,000 presentation
vertices** and **48 decorative meshes** before committing a scene.
Existing low/high `LIT_PROFILES` vertex, mesh and draw limits still
apply. Invalid replacement remains rejected rather than truncating
or partially accepting graphics. QEC `v74.3.0`'s discrete 8×8×8 voxel
field and `v136.1.0` settlement/infrastructure network are possible
future independent visual/world-generation experiments. They are not
implemented here.

## Correctness and visual acceptance

- Node regressions compare repeated source output byte-for-byte,
  validate both detail profiles across coast/alpine/dusk, stable
  bounds, vertex/mesh caps, materials and untouched accepted race
  snapshots, world batches and collision-surface sample results.
- Existing HORIZON-009 complete-RGBA comparison with camera culling
  toggled remains an exact pixel-parity gate.
- Packaged Chromium now also compares the real low/high WebGL1
  HORIZON scene with the new detail layer enabled/disabled. The
  visual difference must be **observable** in rendered pixels,
  while vehicle state, existing mesh upload count and physics remain
  unchanged. This intentional visual change does *not* demand pixel
  equality with v009.
- All HORIZON driving, reverse/recovery, context-loss, offline
  browser, package provenance, source-bound runtime, four endurance
  groups and independent formal/numerical gates remain required.

### Performance qualification (separate from browser correctness)

The hard 60 FPS target remains **16.67 ms per frame**. The hosted
Chromium SwiftShader run is not a substitute for a measured physical
GPU result. Before owner approval, pin baseline `main@6e4831d61f284ba6b92c33ecf598897c46eb1204`
and this PR's exact candidate SHA. Run both builds on the **same**
GPU, driver, browser, resolution, device pixel ratio, FOV, scene,
weather/environment, camera and quality profile. Compare frame
distributions for parked, driving, bridge, tunnel and recovery
scenes and record p50/p95, draw counts, vertex submissions, screenshots,
GL errors and exact package identity. Treat a new p95 above
16.67 ms or a repeatable frame-time regression as a blocker until
measured and justified. No hardware FPS claim follows from
unit tests, 1,000 browser cycles or screenshots alone.

For deterministic paired screenshot/SwiftShader *diagnostic* captures,
the existing capture workflow can be run from each matching build:

```sh
node scripts/capture-horizon-polish.mjs --dist=/path/to/baseline/dist --out=/new/before
node scripts/capture-horizon-polish.mjs --dist=/path/to/candidate/dist --out=/new/after --reference=/new/before/capture.json
```

This is an additive HORIZON Racing Foundry visual-phase PR.
No merge, release, production deployment or assertion of GPU
performance before owner review and fully green evidence.
