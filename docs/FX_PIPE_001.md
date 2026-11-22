# FX-PIPE-001 — original Super FX-inspired fixed graphics preparation

**Status:** experimental opt-in presentation module. Inspired by the separation of geometry processing and frame-buffer upload in the SNES Super FX family. **Not** a Super FX/GSU-2 hardware emulator, instruction set, 21 MHz processor, polygon rasterizer, SNES framebuffer, DMA emulator or graphics driver. The historical analogy does not imply the chip's timing or performance.

## Pipeline

1. The caller supplies data-only integer **Q16.16 raw** positions and a row-major 3×4 affine transform.
2. **FxGraphicsPipe** validates integer coordinates and colours, transforms each vertex with checked exact Number products, and writes triangles directly into one bounded retained **XYZ/RGB Float32Array**.
3. The caller uploads the live `pipe.view()` through the existing unmodified **WebGL1 Renderer.update()**, which owns GPU-buffer memory.
4. Camera/perspective, clipping, rasterization, depth and the actual display remain the responsibilities of the existing renderer. Gameplay, collision and input are **never** owned by FX-PIPE.

For admissible coordinates, every intermediate integer multiply/sum stays below 2^53, so the Number representation is exact. A single `Math.trunc(numerator / 65536)` is applied per transformed component, then Q16 translation added. An independent BigInt mathematical oracle in `tests/fx-pipe.test.js` verifies final Float32 bytes, including fractional rotation/scale matrices. No approximate inverse-square-root, unchecked wrapping or saturating arithmetic.

## Public interface

`modules/fx-pipe/index.js` exports `FxGraphicsPipe`, `FX_PIPE_FORMAT`, `FX_PIPE_DEFAULT_VERTICES` and `FX_PIPE_MAX_VERTICES`.

| API | Contract |
| --- | --- |
| `new FxGraphicsPipe(capacityVertices = 3072)` | Eager allocation of `capacityVertices × 6 × 4` bytes, integer 3..65532, divisible by 3. No runtime growth |
| `setTransform(matrix)` | Dense 12-element ordinary Array or native Int32Array; **owned copy**, row-major `[m00,m01,m02,tx,m10,m11,m12,ty,m20,m21,m22,tz]`, each raw Q16.16 |
| `resetTransform()` | Restore exact identity transform; no output change |
| `appendTriangleXYZRGB(x0,y0,z0,x1,y1,z1,x2,y2,z2,r,g,b)` | One transformed RGB triangle (three vertices), Q16 integer coordinates, byte RGB |
| `appendQuadXY(x,y,z,width,height,r,g,b)` | One transformed, untextured XY sprite card (two triangles), nonnegative width/height, byte RGB |
| `reset()` | Reset live vertex count to zero; retained buffer and chosen transform remain |
| `view()` | Live typed subarray (zero-copy payload); do **not** retain across modifications |
| `vertexCount`, `usedFloats`, `capacityVertices`, `retainedBytes` | Owned storage and live drawing diagnostics |

**Coordinate constraints:** each raw input coordinate lies within ±4096×65536; each transform's rotation/scale/shear coefficient within ±8×65536; each translation within ±4096×65536. Every transformed result must be within ±10000×65536. Invalid inputs, malformed matrices, forbidden dimensions and capacity overruns throw **before changing published vertex count or bytes**. Overflow is rejection, not wrapping or silently dropping triangles. Q16 signed zero is normalized.

Only **untextured coloured sprite cards and triangles** are supported. Arbitrary mesh texture mapping, UV transforms, alpha, perspective correction, blitting and hardware sprite DMA are not implied.

## Composition example

~~~js
import {SCALE} from './modules/integer-math/index.js';
import {FxGraphicsPipe} from './modules/fx-pipe/index.js';
import {Renderer} from './modules/render-webgl/index.js';

const pipe=new FxGraphicsPipe(3072); // up to 512 sprite cards
const renderer=new Renderer(canvas),mesh=renderer.mesh([]);
const q=SCALE;
// Original Q16 matrix representing 90-degree turn plus 2m X translation.
pipe.setTransform([0,-q,0,2*q, q,0,0,0, 0,0,q,0]);
pipe.appendQuadXY(-q,-q,-3*q,2*q,2*q,255,128,48);
renderer.update(mesh,pipe.view());
renderer.begin([0,0,0],[0,0,0,1]);
renderer.draw(mesh);
// On later frames, pipe.reset() and refill; on teardown renderer.dispose().
~~~

No mandatory npm package, WebAssembly, worker, cartridge ROM, shader replacement or runtime network request. The retained stream is created once; `view()` creates a small subarray wrapper per submission but not a second vertex payload. The GPU is free to be faster or slower depending on actual geometry and driver.

## Verification

~~~sh
node --test tests/fx-pipe.test.js
node scripts/fx-pipe-workload.mjs
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
~~~

The first test group independently computes Q16 affine output with **BigInt**, checks Float32 bytes against the module and verifies matrix ownership, capacity rejection, atomic publishing, reuse and stale-tail exclusion. A separate workload compares freshly allocated JS-array assembly against retained streaming for 64/256/512 sprite cards, with matching output and paired CPU observations. This is **not** an automatic benchmark gate, WebGL throughput/driver-memory experiment or GC-pause reduction result.

### Risks and limits

- Fixed-point conversion intentionally quantizes results; **do not** replace existing Float64 simulation, renderer transforms or replay snapshots with this writer. Output equality is against the **explicit Q16 contract**, not arbitrary Float64 rendering.
- Prevalidated scalar paths avoid per-quad geometry array allocation. This does not prove lower end-to-end browser memory/GC or increased frame rate.
- Each sprite is two triangles (six vertices), so large sprite fields can remain limited by GPU fill, bandwidth and draw calls; measure real game workloads with the v3.4.0 Allocation Observatory.
- Existing `render-packing`, `render-webgl`, `sprite2d`, `projection25d`, integer physics and older fixed-point proofs are **unchanged**.
- Rollback is trivial: stop opting into `fx-pipe`; no existing consumer imports it.

## Historical/provenance boundary

The GSU-2 supported up to approximately 21.4 MHz operation and a larger cartridge ROM/framebuffer configuration than early revisions. The transferable design principle is **a separate bounded graphics processing stage**, not its clock rate or copying its instruction set. See SNES development documentation and independent hardware research on Super FX/GSU operation. This module is original JavaScript under Apache-2.0, with no copied ROMs, chip microcode, shaders, maps, sprite art or emulator implementation.
