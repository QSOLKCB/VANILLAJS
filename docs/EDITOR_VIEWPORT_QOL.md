# Editor framing and measured texture preparation

The editor can frame the selected entity and its visible descendants, or the
visible scene when there is no selection. Framing preserves orbit yaw/pitch and
uses rotated world-space box corners or the actual imported mesh vertices. A
hidden selection can still be located. Empty scenes preserve the current camera.
The horizontal and vertical field of view both constrain the fit, including
portrait viewports. The orbit-distance-dependent clipping range accommodates
small selections and scenes larger than the old 300 m far plane.

This is a presentation operation. Authored transforms, physics, replay, asset
contents, proof sources and Alien Math kernels are unchanged. Imported geometry
is still selected through the existing box picking approximation; framing does
not introduce triangle picking.

## Profile before optimization

Before changing `viewport.js`, the benchmark instrumented base64 decode calls
and timed both geometry preparation and resource estimation against main commit
`f91c14628e5700ed4eb69c28cd301a712f3ad967`. A synthetic scene with 128 placements
sharing one 64×64 texture decoded it 130 times per operation: two validation
decodes plus 128 presentation decodes. Geometry preparation took a median
106.925 ms/call and resource estimation took 105.495 ms/call in that initial
run. The unchanged-vs-unchanged measurements are retained in
[`viewport-before.json`](../research/editor-qol/viewport-before.json).

The optimization creates one decoded texture per unique texture ID per
preparation call. Resource estimation and framing do not decode presentation
pixels. Both still run the complete existing asset validation, including alpha,
size and reference checks. The cache is discarded after each call; it cannot
retain stale assets across an edit or project import. Geometry layout, texel
rounding, colours, selection highlighting, draw calls and uploaded byte counts
are unchanged.

## Reproduce

```sh
node scripts/bench-editor-viewport.mjs f91c14628e5700ed4eb69c28cd301a712f3ad967
node --test tests/editor-viewport-qol.test.js tests/editor-viewport.test.js tests/asset-foundry.test.js
```

The benchmark reads baseline source with Git into a temporary directory outside
the package tree. Both variants use the same current dependencies and workload.
It asserts byte-for-byte equality of packed Float32 geometry and deep equality
of resource budgets before measuring. Each operation has four warmups followed
by nine pairs, alternating baseline/candidate order, with five calls per sample.
It records every sample, environment details, baseline revision, and candidate
viewport/benchmark SHA-256 hashes.

The three workloads are the default four boxes, one textured triangle, and 128
placements of the same textured triangle. The last workload deliberately exposes
shared texture overhead; it is not a representative FPS benchmark for complex
meshes. These are local Node CPU measurements, with no GPU, browser frame-time,
physical-device or universal performance claim.

Final paired results are in
[`viewport-after.json`](../research/editor-qol/viewport-after.json).

Executed on Linux x64, Node v22.18.0, AMD Ryzen 9 5950X. Values are median
milliseconds per call; positive changes are regressions.

| Workload | Operation | Baseline ms | Candidate ms | Change |
| --- | --- | ---: | ---: | ---: |
| Four boxes | Geometry | 0.046494 | 0.051124 | +10.0% (+0.004630 ms) |
| Four boxes | Resource budget | 0.000922 | 0.000858 | −6.9% |
| One textured mesh | Geometry | 0.981108 | 0.981787 | +0.07% (+0.000678 ms) |
| One textured mesh | Resource budget | 0.955373 | 0.111088 | −88.4% |
| 128 shared textured meshes | Geometry | 107.360444 | 1.227385 | −98.9% |
| 128 shared textured meshes | Resource budget | 105.506805 | 0.169744 | −99.8% |

All six parity comparisons passed. A shared texture now requires three base64
decodes for geometry preparation and two for resource estimation, including the
unchanged validator. Low-workload regressions are reported alongside wins; small
timings are especially sensitive to JIT, garbage collection and timer noise.
The new Node regression tests also cover rotated/portrait framing, descendants,
hidden/empty selections, imported mesh extents, large-scene clipping, unchanged
input objects, shared-texture output parity, texture updates and malformed alpha.

The repository-wide checks and packaged Chromium integration remain required by
`AGENTS.md`; these focused tests and CPU measurements do not replace them.
