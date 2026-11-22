# COPPER-001 — The Raster Conductor

**Status:** opt-in experimental pure-JS display processor inspired by the Commodore Amiga's Copper coprocessor. **Not** hardware register emulation, a cycle-accurate raster/CRT beam, DMA control, display interrupts, copper instruction-set interpreter, unrestricted scripting or a GPU replacement.

## Architecture

Input is an inert ordered scanline programme with an initial 16-colour **RGBA byte palette**, `height` (1..384) and up to **512 commands**. Each command executes at the beginning of its selected scanline; same-line command order is preserved.

- `{line,op:'palette',index,color}`: changes one palette entry (index 0..15, four RGBA bytes).
- `{line,op:'scroll',x}`: changes signed horizontal sample shift (−511..511), wrapping within each scanline. Vertical/sprite movement, multichannel blending, hblank timing and sub-line palette transitions are **not implemented**.
- Program commands must be sorted by nondecreasing `line`, with `0 <= line < height`. Unknown fields, prototypes, accessors, array holes, invalid colours or oversized programmes reject **before** accepting a handle.

`createCopperProgram({height,palette,commands})` deep-copies accepted data into private ownership and returns a frozen public handle. The producer's later mutation cannot change the accepted palette/command program.

`new CopperDisplay(width,height)` retains exactly **width × height × 4 RGBA bytes** (width 1..512, height 1..384). `display.render(indexed,program)` accepts a native `Uint8Array(width×height)` with every index in 0..15; it validates the complete frame *before* drawing, rejecting invalid pixels without partial output. The programme must have the exact display height. No network or DOM calls are made by the core.

Every `render` begins from the programme's initial palette and zero horizontal scroll, so consecutive frames with identical input are byte-identical and independent of prior presentation. The returned `Uint8ClampedArray` is **owned mutable presentation storage**. If the caller needs a durable snapshot, copy the result before a later render; the library does not promise input alias safety after the call.

The caller controls simulation time, frame presentation and Canvas2D/WebGL uploads. Raster changes must **not** affect authoritative gameplay, collision, AI, randomness or fixed-step replay.

## Pipeline from BLIT-001

~~~js
import {BitplaneSurface} from './modules/blit/index.js';
import {createCopperProgram,CopperDisplay} from './modules/copper/index.js';

const surface=new BitplaneSurface(320,192,4).clear(3);
surface.fillRect(20,25,100,16,7);
const indexed=surface.indices(); // owned, immutable from Copper's perspective
const palette=Array.from({length:16},(_,i)=>[i*16,48,96,255]);
const program=createCopperProgram({height:192,palette,commands:[
  {line:64,op:'palette',index:7,color:[255,168,42,255]},
  {line:96,op:'scroll',x:8},
  {line:145,op:'scroll',x:0}
]});
const display=new CopperDisplay(320,192);
const rgba=display.render(indexed,program);
context.putImageData(new ImageData(rgba,320,192),0,0);
~~~

**BLIT-001 and COPPER-001 remain separately reusable:** core Copper source has **zero dependencies** in `MODULES.json`; the browser demonstration uses the two in composition. The preexisting WebGL1 renderer and FX-PIPE-001 are unchanged.

## Validation

~~~sh
node --test tests/copper.test.js
node --test tests/blit.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
# Hosted browser demonstration: isolated developer-only Playwright 1.64.0
NODE_PATH=/path/to/isolated/node_modules node scripts/copper-browser.mjs /tmp/copper-001-evidence
~~~

The independent pixel oracle tests positive/negative/wrapped scroll offsets, palette changes on the same and different scanlines, deterministic repeat frames, programme ownership, malformed input atomicity, maximum 512 commands, alpha and real BLIT source preservation.

The packaged Chromium runner checks original Canvas2D pixels, visible palette/scroll effects, bypass, phase changes, repeat/reset parity, source-index immutability, no remote requests, screenshots and SHA-256 source evidence.

**Performance scope:** indexed-to-RGBA per-pixel conversion runs on the CPU. This is a bounded software graphics effect, not proven to outperform a shader, GPU texture upload or native graphics driver. No claims of Amiga beam timing, CRT scanning or faster whole-game frame rates are warranted. Measure gameplay with existing VANILLAJS profiling before adoption.

No copyrighted ROMs, maps, graphics, music, chipset descriptions or third-party runtime packages are included. This is an original Apache-2.0 implementation.
