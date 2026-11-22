# BLIT-001 — The Bitplane Forge

**Status:** opt-in, experimental pure-JS graphics preparation. Historical inspiration: the Amiga blitter, later Atari Mega ST/STE blitter and Williams arcade bitmap hardware. **Not** a cycle-accurate chipset, Amiga DMA emulation, Atari hardware register emulation, alternative GPU driver or guaranteed optimization.

## Design

A `BitplaneSurface` owns a packed `Uint16Array` with **plane-major, row-major big-endian bit numbering**: the leftmost pixel in a word is bit 15. Each pixel index is reconstructed from one bit in each plane. The library keeps complete ownership; `words()` and `indices()` return independent copies. It exposes **one to four bitplanes** (2–16 colours) and a maximum **512×384** 16-multiple width, without growth or external assets.

All rendering commands affect **presentation only**, never authoritative gameplay, collision, AI or replay. The supplied game controls when to present a frame using Canvas2D, WebGL or another trusted consumer.

## Public contracts

| API | Contract |
| --- | --- |
| `new BitplaneSurface(width,height,planes=4)` | width 16..512 divisible by 16; height 1..384; planes 1..4 |
| `setPixel/getPixel(x,y[,index])` | Exact bounded integer pixel coordinates / palette index |
| `clear(index)` | Fill every plane word using integer bit patterns |
| `fillRect(x,y,width,height,index)` | Entire rectangle inside surface; invalid dimensions reject atomically |
| `line(x0,y0,x1,y1,index)` | Integer Bresenham line, both endpoints included; no silent clipping |
| `blit(src,{sx,sy,dx,dy,width,height,mask,minterm})` | Three-input A/B/C Boolean per plane; source inside bounds, destination clips; returns changed pixel count |
| `words()` | Fresh owned `Uint16Array` of packed source planes; copy, never live writable storage |
| `indices()` | Fresh `Uint8Array` of indexed pixels for palettes or scanline processors |
| `rgba(palette)` | Fresh `Uint8ClampedArray` from dense 2^planes RGBA entries (0–255) |
| `retainedBytes` | Resident packed bitplane bytes; does not include output copies |

### Boolean minterm semantics

Minterm bit `(A<<2) | (B<<1) | C` controls one destination output bit. `A` is the optional one-bit mask (default 1), `B` the corresponding source plane bit, and `C` the existing destination bit.

- `BLIT_COPY = 0xCC`: copy `B` across both mask values.
- `BLIT_COOKIE_CUT = 0xCA`: output `A ? B : C`, preserving the existing background where the mask is zero.
- Every integer minterm from 0x00 to 0xFF is valid and is independently tested.

Same-surface source/destination overlaps use a pre-write snapshot for the clipped region, rather than permitting corruption. Source and mask dimensions must match; the optional mask must have exactly one bitplane. Destination pixels outside the screen clip without wrapping, while a source rectangle outside its own buffer rejects. Invalid input is refused before publishing partial pixels.

**Performance scope:** the stored pixels are packed 16-bit planar words, but current general minterm and masking loops are **per pixel**, not a direct DMA-like whole-word accelerator. Correctness and reproducibility are established first. No faster-than-Canvas2D, SNES/Amiga speed equivalence or lower-GC claim is made without measured real workloads.

## Example

~~~js
import {BitplaneSurface,BLIT_COOKIE_CUT} from './modules/blit/index.js';

const backdrop=new BitplaneSurface(320,192,4).clear(2);
const art=new BitplaneSurface(32,16,4).fillRect(4,3,24,9,8);
const mask=new BitplaneSurface(32,16,1).fillRect(4,3,24,9,1);
backdrop.blit(art,{sx:0,sy:0,dx:120,dy:70,width:32,height:16,mask,minterm:BLIT_COOKIE_CUT});
const indexed=backdrop.indices(); // e.g. COPPER-001 input after its separate review
const rgba=backdrop.rgba(Array.from({length:16},(_,i)=>[i*16,32,128,255]));
context.putImageData(new ImageData(rgba,320,192),0,0);
~~~

## Reproduce

~~~sh
node --test tests/blit.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
# Optional hosted runner: script needs isolated Playwright 1.64.0
NODE_PATH=/path/to/isolated/node_modules node scripts/blit-browser.mjs /tmp/blit-001-evidence
~~~

The numerical tests run **all 256 minterms** against an independently expressed pixel oracle and include exact bit packing, source ownership, crossing 16-bit boundaries, clipped operations, self-overlap, malformed admission and repeatability. The browser fixture exercises genuinely rendered original pixels, moves a mask-composited sprite, copies an overlapping bitmap region, and proves reset restores the same pixel hash.

All browser image/CPU measurements must identify the actual backend and source revision. Pure unit test success cannot establish physical GPU performance; this mode uses Canvas2D and is independent from the WebGL renderer.

No licence, ROM, copyrighted art, third-party runtime, emulated chip timing or external network asset is imported.
