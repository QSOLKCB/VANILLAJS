# Geometry layer 2 — static batching, spatial indexing and authored E8 atlas

Status: **review candidate**, independent of the OPT hotpath PR #13.
Target branch baseline: `QSOLKCB/VANILLAJS@1f965f4e5b6669de0f954e3a39b11aa679e56720`.
This is an additive native ES-module implementation: **no Node/npm runtime dependency, third-party engine, approximate collision or modified game physics**.

## Problem and invariant

A renderer should not construct 36 box vertices as nested general JavaScript arrays when the public GPU contract already consumes a contiguous Float32 XYZ/RGB stream. A static segment cast should not narrow-phase every collider if a conservative, immutable broadphase can eliminate most of them. A frustum classifier must never misrepresent a crossing box as safely outside just to reduce draw calls.

Reference contracts: the original `boxVertices` output after Float32 conversion, the unchanged `castSegment` narrowphase (full result, ID ties, time, normal, point and **original collider index**), and the existing pixel/browser/physics regression suites. No performance threshold substitutes for correctness.

## Implemented

**1. Exact Float32 box batching — `modules/geometry/index.js`.**
`boxMeshBatch(boxes)` accepts up to 16,384 three-component finite centre, size and colour triples. It produces one owned `Float32Array` containing the same six-floats-per-vertex, 36-vertex-per-box stream as the legacy per-box concatenation. All user inputs are validated before allocating the output. No vertex-index deduplication, face removal, normal approximation, material merge or reduced fidelity. The two existing static-scene paths in Flight Lab and FPS Lab now use this helper; dynamic gameplay geometry is unchanged. A Float32 copy may still be needed by the base renderer, pending the independent PR #13.

**2. Conservative ternary frustum predicate.**
`classifyAABBPlane(box,[nx,ny,nz,d])` and `classifyAABBFrustum(box,planes)` return `-1` (definitely outside), `0` (crossing or numerically uncertain), or `+1` (definitely inside). The signed halfspace is `n·x+d >= 0`. Classification uses interval corners with a scale-sensitive floating error margin; overflow is **uncertain**, not outside. Only a definite outside result is safe to cull. No automatic renderer culling is enabled in this PR. Tests include tangent boundaries and independent corner-sign comparisons.

**3. Deterministic static AABB index.**
`new StaticAABBIndex(colliders)` validates, snapshots and freezes up to 65,536 uniquely named, positive-volume AABBs. It builds a median-split bounded binary hierarchy; `candidates(origin,displacement,{halfSize})` returns sorted original collider indices. Broadphase expansion deliberately favours false positives over false negatives. `castSegment(...)` delegates narrowphase to the existing `collision` module and remaps the hit's original index. Coordinates, travel and the segment endpoint are restricted to ±1e9 metres, with halfSize in [0,1e9], so the narrowphase arithmetic remains finite under the declared contract. Moving/rotating/edited worlds require a fresh index: **never reuse a stale static snapshot**. This API is opt-in pending a stable collision-revision stream.

**4. Procedural E8 point atlas (research-only).**
`experiments/e8-geometry/index.js` enumerates the standard 112 integer and 128 even-parity half-integer roots with squared norm 2 in rank 8. An explicitly authored 3×8 dyadic matrix projects those 240 vectors into an owned Float32 XYZ/RGB point array. The 3D projection is not an isometry or a mathematically canonical E8 embedding. It provides deterministic low-cost procedural display source geometry without importing audio libraries or changing the game's collision system. This experiment is registered separately and allowlisted into the packaged source.

## Executed local observations, not universal performance claims

Separate isolated Node v22.16.0 execution on 2026-11-05 exercised independent reference geometry, static raycasts and 240-root evidence. All 5 isolated conformance tests passed (including **1,800 randomized spatial casts**); the local setup-inclusive synthetic benchmark also passed exact-output checks.

| Isolated synthetic workload | Reference median | Candidate median | Scope |
| --- | ---: | ---: | --- |
| 20 constructions of 480 static boxes | 141.85 ms | 20.91 ms | CPU geometry creation + Float32 values; excludes GPU |
| 128 rays against 480 static colliders | 11.90 ms | 2.27 ms | Includes constructing a new index per candidate trial |
| Narrowphase candidates | 480 per reference ray | 3.59 average per ray | Work-count reduction on one fixture |

Seven alternating pairs with two warmup pairs; wall-clock timings are observations only and **not CI pass criteria**. The benchmark code and complete environment-scoped samples are recreated by `scripts/geometry-layer2-workload.js` in CI. It fails on any Float32 mismatch, any hit receipt mismatch, incorrect E8 inventory, or a fixture that does not exercise filtering. It does not prove higher FPS on a physical GPU, a speedup for small/crowded worlds, or lower memory use once a static index's lifetime is counted.

No unverified claim is made that JS outperforms native AVX2 or that Quake's approximate inverse square root improves exact collision. The inverse-square-root experiment stays isolated in PR #13.

## Cross-repository provenance: methods considered, not transplanted code

The selection follows the twelve pinned donor revisions examined 2026-11-05:

| Repository / source revision | Relevant method | Present disposition |
| --- | --- | --- |
| `486@6e202eb1319716f4b925c0bdaaf05a9fd16e7837` | independent CPU oracles | independent reference tests |
| `LHC@f9e52d5a01cb357951a0a8a2b6d26065c64dd790` | step/renderer separation | pre-existing architecture maintained |
| `YANG-MILLS@998501be9b886a477424fb77b45a68c396aabde8` | bounded lattice and mathematical invariants | validation discipline, no gauge kernel imported |
| `GALAXY@f219bb427b3a9b0c93900169d903f48f410ae67a` | locality, flat spatial hierarchies and stable ordering | independently implemented static binary bounding index, **not** Barnes–Hut forces or copied Morton implementation |
| `RUNE@d491910c9356ba132ed9a0c9b585bd82e8543a29` | minimal sufficient data movement | one packed vertex array, separate setup-inclusive timing |
| `GAMES@ea04e1d3a5eaa33a24f23d49af413af526670495` | rebuild scenery only when generation changes | static scene construction remains on world selection |
| `NS@66206230bc8504dc57808468adac6f1b5ffd39b4` | strict numerical evidence boundaries | parity and workload observations separated |
| `QNTOY@4a9612e3dd5b534c25d2b1d17a145c104f7baee8` | geometry storage/lifecycle independence | packed static data; separate opt-in sparse update API is in PR #13 |
| `LATTICE@af0dd12be0390bd4361fa2d2b90b0b17deaa25f2` | bounded deterministic traversal | no claim that logical memory addresses are world coordinates |
| `E8_MUSIC@d8e5983d84af03f03a969abe3356dcf80c0e0e97` | exact 240-root generation | independently authored E8 geometry experiment |
| `BLOCH@907c7234a2d9f02b04d2058d8e01f81c7f658b99` | octahedral direction coding | lossy normal packing deferred: would breach exact-byte contract |
| `VIZ@90a3ab3e72d7f46f3e8e99b1dbd5a68182f4c363` | visualization separated from model | research point atlas; no audio imported |

VANILLAJS stays Apache-2.0. The donor sources carry their own licenses; no other repository's implementation was copied, vendored or made a runtime dependency. QEC/SONIFICATION/SPECTRAL remain optional verification and diagnostic influences, not demonstrated renderer accelerators.

## Reproduce, gates and rollback

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/geometry-layer2-workload.js --check
node scripts/opt-render-workload.js --check
```

The packaged Chromium suite and preserved screenshot evidence remain mandatory. Any exact Float32 mismatch, native pixel difference, moving-collider stale-hit, culling false negative, incompatible arithmetic or a full-path regression blocks adoption. Revert the static batch call sites to their legacy `flatMap(boxVertices)` implementation while leaving both geometry helpers optional if a consuming game fails validation.

This PR neither merges nor deploys and does not modify or depend on PR #13.
