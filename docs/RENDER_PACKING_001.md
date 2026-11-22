# RENDER-PACKING-001 — bounded low-allocation render geometry

**Status:** new opt-in experimental pure-JavaScript API. This is **not** a replacement for JavaScript's garbage collector and does **not** demonstrate a browser FPS improvement.

VANILLAJS cannot configure or replace the browser's memory collector. It can, however, reduce temporary objects that the collector eventually has to reclaim. In the existing `render-webgl` path, `boxVertices` constructs 8 corner arrays, per-face shade arrays, and a growable JS number array, later converted to Float32 for GPU upload. It remains the canonical reference and is unchanged. This module adds a bounded **single-allocation Float32 stream** with byte-identical admitted output.

## API and usage

```js
import {BoxVertexStream} from './modules/render-packing/index.js';
import {Renderer} from './modules/render-webgl/index.js';

const renderer=new Renderer(canvas);
const mesh=renderer.mesh([]);
const stream=new BoxVertexStream(512); // 442,368 retained bytes

function drawBulletHeads(shots) {
  stream.reset();
  for(const s of shots) {
    // Validate admission/count before streaming; do not blindly truncate.
    stream.appendXYZRGB(s.x,s.y,s.z,.12,.12,.12,1,.5,.2);
  }
  renderer.update(mesh,stream.view()); // WebGL upload owns its bytes
  renderer.draw(mesh);
}

// Release the renderer's GPU resources on teardown.
renderer.dispose();
```

The module has **no DOM, WebGL, renderer, clock, engine or npm dependency**; games can use the writer with any compatible interleaved XYZ/RGB Float32 consumer. It is an additional source-registered module, not a new engine dependency for existing games.

| API | Contract |
| --- | --- |
| `new BoxVertexStream(capacityBoxes = 256)` | Eagerly allocates one `Float32Array(capacityBoxes × 216)`, capacity integer 1–4096. No later capacity growth. |
| `appendXYZRGB(cx,cy,cz,sx,sy,sz,r,g,b)` | Preflight all nine numbers and capacity before any output change; 36 face-shaded XYZ/RGB vertices (216 floats), original triangle order. |
| `append(center,size,color)` | Convenience adapter for existing three-component vectors, same validation and bytes. Array objects provided by caller are not copied. |
| `reset()` | Retain the backing store and reset live vertex count; does not zero stale bytes. |
| `view()` | One lightweight `Float32Array.subarray(0, usedFloats)` per upload; shares storage, never copies payload bytes. |
| `boxCount`, `vertexCount`, `usedFloats`, `capacityBoxes` | Synchronous counters for bounds, mesh sizes and work receipts. |

Valid inputs are finite XYZ positions in ±1,000,000 metres; size components 0–1,000,000; RGB components 0–4 (includes deliberate overbright tints). Invalid/over-capacity calls throw **before** changing `boxCount` or the live content. Caller must not retain a `view()` across later `reset()` / `append()`, because it shares the same typed storage. If an upload fails, the renderer's normal error and recovery policy remains authoritative. `Renderer.update` already accepts a `Float32Array` subview directly without an additional CPU Float32 copy.

**No hidden GC knob:** retained typed arrays are still managed by the JS engine, and the `view()` object is one small allocation per frame. This approach reduces the high-frequency *geometry data* allocations. It does not replace GPU resource disposal, alter render scheduling, or control V8's collector.

## Numerical equality and isolation

- Face order, shade factors, corner index bit operations and Float32 rounding match the prior `boxVertices` implementation for admitted inputs, including zero-size geometry and signed zero behavior.
- Independently authored historical-geometry oracle and native `boxVertices` are both checked against every accepted stream byte.
- New APIs are optional. Existing draw/physics/AI/replay, their tested files, and `render-webgl` source bytes are **unchanged**. No existing source-bound FPS proof/identity is regenerated or weakened.
- A full stream **rejects**, never silently discards bullets. It is a *geometry writer* only, **not** an authoritative projectile or damage simulator. A game must separately test render/HUD/projectile identity and collision fairness.

## Measurement boundaries

```sh
node --test tests/render-packing.test.js
node scripts/render-packing-workload.mjs
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
```

The opt-in workload compares 64, 256 and 512 **visual boxes** per frame for 80 frames per sample, two warmup pairs and seven alternating measured pairs. It reports raw CPU geometry assembly times, baseline per-frame JS-array/Float32 conversion versus retained-stream output. It checks byte parity, checksum equivalence and explicit retained bytes. **It does not measure V8 GC pauses, GPU performance or browser FPS**, and timing values must not be treated as CI gates or transferable speedups.

For meaningful browser GC evidence use Chrome DevTools **Memory → Allocation sampling** and Performance recordings, with exactly pinned source, seed, actor/hazard count, profile and renderer/backend. Record allocation rate (bytes/second), GC pause frequency/duration, JS/GPU work, p50/p95/p99 frame time, shader uploads, draw counts and VRAM where available. Run paired A/B scenes with identical authoritative replay and separate software-renderer from native-GPU results. Confirm no allocation retention/leaks after repeated resets and renderer disposal.

## Consumer adoption

Wait for owner-approved upstream PR, green CI and immutable engine tag. In each consuming game (Boomer-Shooter Bullet Hell, Games2, etc.), independently pin the new engine commit and record full source closure + hashes. Integrate **only the rendering writer**, keeping collision/AI/weapon/damage authority unchanged. Prove same-world snapshots and exact displayed vertices between modes, profile on identified physical hardware, then choose the better implementation. Never silently change the v3.2.0 game pin.

## Limits

This API batches **axis-aligned coloured boxes**, not lit normals/UV, sprites, point sprites, arbitrary meshes or instanced WebGL draw calls. For a field of hundreds of bullets a face-shaded box still costs **36 vertices per bullet**; lowering JS heap churn may not address rasterisation, shader or buffer bandwidth bottlenecks. Future work should measure simpler bullet meshes, pooled line trails and instancing or GPU-friendly approaches separately; those require their own conformance tests and owner review.
