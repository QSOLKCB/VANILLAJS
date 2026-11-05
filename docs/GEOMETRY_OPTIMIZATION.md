# Exact geometry hotpaths — QSOL geometry optimization experiment

Status: implementation candidate pending independent CI and browser review.
Source context: `QSOLKCB/VANILLAJS` v1.0.0; see `docs/OPTIMIZATION.md` for the pre-existing OPT-INV-001/OPT-INC-001 renderer reuse experiment. This change is additive and does **not** modify simulation, collision outcomes, shader programs, WebGL buffers, draw counts, material colours or the scene graph.

## Observed bottlenecks

- `boxVertices` built six shaded faces by recomputing the same face shade **36 times per box** (one per emitted vertex); the exact same RGB shade is required only **six** times.
- `ringVertices` evaluated sine and cosine at the same tessellation angles on every call. The built-in demos use 16, 24, 32 and 48 segments.
- FPS Lab rebuilds dynamic box/ring geometry during each render; unlike the Clockwork Vault's reusable static model, it cannot generally skip those builds.

## Implemented OPT-INV-001 adaptation

- Keep the frozen triangle face order and coordinate mapping, but hoist fixed face topology and compute each face's shaded colour once.
- Cache 64-bit cosine/sine unit-circle samples for the four known segment counts. Memory is bounded to **1,984 bytes** of typed-array samples (excluding small Map/Set bookkeeping): `(17+25+33+49)*2*8` bytes. Positions, radii, colours and returned vertex arrays are never cached.
- Custom/fractional/zero tessellation counts execute the original algorithm rather than extending the cache.
- Keep multiplication and addition in their original order and retain binary64 trig samples; no approximate inverse square root, quantization, `Math.fround`, truncation or epsilon threshold is introduced.

Acceptance gate: compare JS-number arrays including signed zero, emitted Float32 upload bytes, vertex/draw order and the existing OPT rendering hashes. Only timings are allowed to vary. The new exact-output tests run under the existing standard-library Node test command; the work script provides additional paired observations with no noisy timing gate.

## Initial local isolated-kernel observation

An independent probe on **Node v22.16.0** compared frozen source functions with their optimized equivalents. Seven non-paired post-warm-up samples gave these medians:

| Kernel | Fixed calls | Frozen median | Candidate median | Relative median change |
| --- | ---: | ---: | ---: | ---: |
| Box generation | 50,000 | 373.17 ms | 237.10 ms | 36.5% lower |
| 24-segment ring generation | 10,000 | 30.74 ms | 24.02 ms | 21.9% lower |

This is **isolated CPU geometry generation**, not a game frame-rate, physical GPU, allocation, GC or browser result. Interleaved workloads in `scripts/geometry-workload.js` provide repeatable protocol observations for the target CI runtime; do not impose arbitrary timing thresholds or transfer these numbers to other environments.

## The inverse-square-root negative control

A separate isolated Node v22.16.0 comparison of one Newton refinement of the Quake `0x5f3759df` 32-bit bit trick against `1 / Math.sqrt(x)` on positive finite float32 inputs produced **5.65 ms versus 1.62 ms** median in that probe (7 post-warm-up samples), with a worst observed relative error of approximately **0.175%** for the approximation. Different engines can differ. The candidate does not satisfy exact geometry, collision or timing contracts; **do not introduce it into the renderer or physics kernel**.

When comparing distances with a finite, bounded range, squared-distance culling may avoid the square root entirely. Handle overflow, units and boundary equality first; this is a separate future experiment. `Math.hypot` remains appropriate for robust magnitudes.

## Other QSOLKCB technologies — bounded research scope

| Source | Appropriate geometry application | Status |
| --- | --- | --- |
| `OPT` | Invariant-driven geometry/shading/trig reuse, deterministic performance receipts | Implemented here |
| `Trinite` / ternary logic | `-1/0/+1` three-way conservative classification of an AABB against a frustum plane: outside, intersects, inside. Could skip later plane tests for fully inside groups | **Proposed only**; profile with actual per-object meshes before introducing scene-graph costs |
| `QEC` | Adversarial verification, stable tie-breaking, failure receipts and independent reference oracles | Verification discipline, **not** a quantum runtime speedup |
| `SPECTRAL` / `SONIFICATION` | Optional offline sound-to-geometry, procedural shape and diagnostic visualizations with independent controls and provenance | **Proposed tooling**; not imported into runtime |
| `OPT-SIMD-001` | Profile native/wasm batch transforms if an actual native kernel is subsequently needed | **Not a WebGL1/Javascript optimization by assumption** |

Next conditional steps: benchmark frustum classification and spatial indexing against real world/target distributions; if justified, introduce an explicit indexed/static geometry path. Retain all existing collision semantics and a complete no-cull/reference path.

## Reproduction

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/opt-render-workload.js --check
node scripts/geometry-workload.js --check
```

Run packaged Chromium checks in CI. Geometry timings and inverse-square-root controls do not establish cross-browser determinism or a net frame-rate improvement. No dependency, network runtime call or release tag changes.
