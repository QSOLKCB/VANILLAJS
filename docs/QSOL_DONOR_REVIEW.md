# QSOLKCB donor review — VANILLAJS exact geometry

Status: source review and selective local adaptation, **not** a claim that
scientific or symbolic donor models speed up polygon rasterization.

Target: `QSOLKCB/VANILLAJS` (base `1f965f4e5b6669de0f954e3a39b11aa679e56720`).
Donor revisions below are exact Git commit IDs read on 2026-11-05.
All code added to VANILLAJS is an original, small native-JavaScript
implementation of conventional WebGL and array operations: no third-party
or cross-repository implementation copied, and no new dependencies.

## Twelve source candidates

| Donor (commit) | Examined source | Reusable invariant | Decision |
| --- | --- | --- | --- |
| `486@6e202eb1319716f4b925c0bdaaf05a9fd16e7837` | `README.md`, `tests/reference.test.mjs` | Independent instruction/reference oracles and explicit state transitions | Keep as verification design pattern; not an actual rendering primitive |
| `LHC@f9e52d5a01cb357951a0a8a2b6d26065c64dd790` | `docs/CPU-RUNTIME.md` | Bounded fixed-step simulation independent of draw cadence | VANILLAJS already has this; avoid duplicate clock |
| `YANG-MILLS@998501be9b886a477424fb77b45a68c396aabde8` | `docs/MATHEMATICAL_MODEL.md` | Exact stated domains, normalized quaternion invariants and bounded lattice indexing | Potential numerical contract tests; gauge mechanics is not a raster acceleration |
| `GALAXY@f219bb427b3a9b0c93900169d903f48f410ae67a` | `docs/CPU-SIMD.md`, `nbody/README.md`, `retro-math.js` | Data locality, flat Morton order, reference-vs-optimized parity, fixed-point oracle | Prepacked Float32 upload path implemented; spatial ordering and quantized projections deferred |
| `RUNE@d491910c9356ba132ed9a0c9b585bd82e8543a29` | `R7-MEMORY-WALL-STUDY.md` | Avoid redundant materialization; count bytes and lifetime allocations | Avoid duplicate upload-side Float32 copies for an already typed view |
| `GAMES@ea04e1d3a5eaa33a24f23d49af413af526670495` | `VECTOR_ZERO/renderer.js` | Geometry rebuild only when world signature changes | Already covered by OPT's Clockwork Vault cache; no second scene cache added |
| `NS@66206230bc8504dc57808468adac6f1b5ffd39b4` | `README.md` | Hard separation of numerical observation, model evidence, and general truth | Require workload and negative controls; no fluids/PDE kernel imported |
| `QNTOY@4a9612e3dd5b534c25d2b1d17a145c104f7baee8` | `ARCHITECTURE.md`, `src/visualizer.js` | Retain geometric storage and update only changing state entries | Added opt-in native WebGL1 `Renderer.updateRange` with bounds and byte-ownership tests; no Three.js import |
| `LATTICE@af0dd12be0390bd4361fa2d2b90b0b17deaa25f2` | `README4AI.md`, `implementations/javascript/lattice.js` | Versioned bounded deterministic 3×3×3 indexing/traversal | Possible authored spatial provenance; logical-memory cells are **not** physical scene cells |
| `E8_MUSIC@d8e5983d84af03f03a969abe3356dcf80c0e0e97` | `js/e8-core.js` | Exactly enumerated 240-root E8 coordinate families and normalization checks | Optional procedural geometry/visualisation instrument, not runtime mesh compressor |
| `BLOCH@907c7234a2d9f02b04d2058d8e01f81c7f658b99` | `docs/MODEL.md` | Explicit octahedral direction encoding with declared quantization error | Candidate compact normal representation only where lossy output is allowed; **not** used in exact vertex path |
| `VIZ@90a3ab3e72d7f46f3e8e99b1dbd5a68182f4c363` | `js/visuals.js` | Separate deterministic projection model from visualization and audio receivers | Optional developer diagnostics; not a render-loop dependency |

This table describes the inspected material and prospective transfer opportunities,
not completed modifications to donor repositories.

## Changes under the present PR

1. Invariant shading and bounded exact-angle ring samples. Preserve each existing
   XYZ/RGB value, face order, Float32 upload byte, vertex count and draw mode.
2. Accept already prepacked `Float32Array` in `Renderer.update` without
   making an otherwise redundant CPU `Float32Array` copy. WebGL uploads still
   have their own storage, so the caller may subsequently mutate the view.
3. Offer `Renderer.updateRange(mesh,firstVertex,data)` to replace a contiguous
   subset of *live* six-float XYZ/RGB vertices. All range preflight is performed
   before a GL upload. No GPU reallocation or draw-count change is needed.
   Empty range updates are no-ops. The default full-update path remains available.

`updateRange` is deliberately **opt-in**: the present demos do not have an
authoritative per-vertex dirty-index stream. Guessing dirty ranges could drop
visual updates, so no end-to-end frame-rate benefit is claimed for sparse uploads
until a consuming workload proves dirty-region correctness.

## Deferred experiments and correctness gates

- **Ternary frustum classification:** `-1` wholly outside, `0` crossing,
  `+1` wholly inside for an AABB relative to a plane, using conservative
  interval bounds. Pair with an independent brute-force oracle, prove no visible
  scene incorrectly culled, and benchmark coarse AABB groups before introducing
  branch overhead. This is classical three-way logic; no qutrit hardware.
- **Morton / spatial binning:** compare `GALAXY`-style flat layouts versus
  direct loops for large world scenes. Keep moving collider sweeps, stable
  nearest-hit ties, range invalidation and exact raycast results authoritative.
  Do not confuse classical Barnes–Hut *approximate forces* with exact collision
  detection.
- **Retro CORDIC / fixed-point:** `GALAXY`'s BAM32 and CORDIC values offer
  an explicit deterministic integer oracle, but cannot replace present binary64
  trig if exact output is required. This is a separate approximation profile.
- **Normal packing / compression:** quantify BLOCH-style octahedral encoding
  loss in a separate optional format, with memory, GPU bandwidth and visual
  quality bounds. No current API claims reversible binary64 precision.
- **Sound and spectral controls:** E8_MUSIC, VIZ, SONIFICATION, SPECTRAL and QEC
  belong to optional procedural art, event logs and diagnostic adapters, not
  collision/vertex correctness or fast inverse square root.

Mandatory regression gates remain the independent v1.0.0 geometry oracle,
exact uploaded Float32 bytes, OPT hash receipts, fixed-step physics, the entire
Node suite and packaged browser suite. Record executed evidence separately
from proposed science or future hardware claims.

## License and version boundary

VANILLAJS remains Apache-2.0. The donors include projects with different
licenses (including MPL-2.0). No donor code, Three.js, sound samples, scripts
or third-party dependencies are copied or imported. The described techniques
are reimplemented independently using WebGL1 and standard JavaScript only.

References to `main` above are frozen at the listed hashes and are not moving
runtime dependencies. No API of a donor repository is assumed to be part of
VANILLAJS merely because it appears in this review.
