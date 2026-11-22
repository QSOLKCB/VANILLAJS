# MATERIAL-001 — Sediment Works

Sediment Works is the first environmental-materials follow-up to the six phases shipped in v3.1.0. It provides an experimental integer grid for sand, water and editable stone walls. Its unit of length is one cell and its unit of time is one accepted tick. The lab runs at 30 simulation ticks per second. [Open Sediment Works](../demos/material-lab/index.html).

## Try the twin hoppers

1. Choose **Twin hoppers** and press **Step one tick**. Both outlets start to empty. The sand and water counters keep their values as the materials move.
2. Press **Run** and watch the two streams hit the basin. Pause, choose **Stone**, and drag a barrier across an outlet. Select **Erase** to open it again. Keyboard users can focus the grid, move with the arrows, and paint with Space.
3. **Save JSON** captures the current tick and all cells. Advance the chamber, then **Open JSON** to return to the saved tick. Opening a file pauses the simulation. **Reset** returns to the selected preset or the last imported starting layout.
4. Try **Spillway** to cut a new channel into a retaining wall, or choose **Empty tank** to build a chamber from scratch. For offline reloads, open the lab's `index.html` on the packaged site while connected and let the service worker finish installing.

## Use the grid

```js
import {createMaterialGrid, restoreMaterialGrid, MATERIAL} from '../modules/material-grid/index.js';

const grid = createMaterialGrid(32, 24, 1701);
grid.paint(16, 18, MATERIAL.stone, 3);
grid.paint(16, 4, MATERIAL.sand, 2);
grid.step();
const resumed = restoreMaterialGrid(grid.snapshot());
resumed.step();
```

| Operation | Contract |
| --- | --- |
| `createMaterialGrid(width, height, seed = 1)` | New empty grid. Dimensions are positive integers. The seed is an unsigned 32-bit integer, including zero. |
| `paint(x, y, material, radius = 0)` | Replaces a clipped integer disk and returns the number of cells changed. The centre must be in bounds. All arguments are checked before the edit. |
| `step()` | Advances one tick and returns the number of successful transfers. A sand/water exchange counts as one transfer. |
| `population()` | Returns owned counts for air, sand, water and stone. Only painting changes the population of an existing grid. |
| `copyCells(target)` | Writes row-major material IDs into a caller-owned `Uint8Array` of exactly `width * height` elements. |
| `snapshot()`, `restoreMaterialGrid(text)` | Save canonical ASCII JSON and construct an independent grid from it. A failed import preserves the active chamber. |
| `width`, `height`, `seed`, `tick`, `bufferBytes` | Read-only dimensions, initial seed, accepted tick and actual typed-array backing bytes. |

Columns increase rightwards and rows downwards. All four edges are closed. Each tick visits rows from bottom to top. The row word starts from `(seed + tick * 0x9e3779b9) mod 2^32` and advances once per row using the public `integer-math.nextRandom`. Its high bit selects scan order (set means left to right). Bit `x % 31` selects the preferred side (set means right).

Sand and water try the cell below, then the two downward diagonals in preferred order. Water can also move sideways. Sand can exchange with water that has yet to move. A successful exchange marks both particles. Each particle moves at most once per tick, including when another particle displaces it. An empty cell can be refilled later in the same sweep. These discrete rules model settling and spreading without pressure, volume flow rates or real-world fluid units.

## Budgets and saved data

| Resource | Bound |
| --- | --- |
| World and population | At most 128 columns × 96 rows, one occupant per cell and 12,288 material cells in total |
| Persistent simulation buffers | Two one-byte-per-cell arrays and four 32-bit counters. Maximum 24,592 bytes. JS object overhead, exported text and the renderer's pixel buffers are separate. |
| Tick work | One movement-mark clear, one grid scan, and at most five neighbouring destinations considered per mobile cell. No particle list grows during a tick. |
| Paint | Radius 0–3, at most 49 candidate cells per stamp |
| Tick counter | 0 through 4,294,967,295. A further step rejects before state changes. |
| Snapshot source | At most 16 KiB of ASCII JSON, bounded before decoding |

`qsol.vanillajs.material-grid.v1` has exactly six fields (`format`, `width`, `height`, `seed`, `tick`, `cells`). The cell string has exactly one symbol per row-major cell. Air is `.`, sand is `s`, water is `w`, and stone is `#`. The movement marks expire at each tick boundary, so a resumed grid needs only the saved fields. A snapshot records current state. Reproducing an edited session from its beginning also requires the edits and their tick numbers.

## Verification and provenance

```sh
node --test tests/material-grid.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/material-browser-smoke.mjs
```

The focused Node checks compare all 256 possible two-by-two boards with an independent labelled-particle model at two seed/tick pairs. They also exercise a fully occupied world, conservation and wall positions after a dense 256-tick run, resumed snapshots, and the same edits at virtual 30, 60 and 144 Hz presentation schedules. The packaged Chromium check paints a chamber, reads the rendered cells, saves and opens real files, rejects invalid data and runs after disconnecting the origin. It uses the repository's separate Playwright tooling. These checks measure state and package behaviour. They supply no hardware frame-rate benchmark.

The module, chamber layouts and Canvas2D artwork are original Apache-2.0 work, based on VANILLAJS `d6da91b91374d28bdd7c201d214f5618b247904c`. The [OSS roadmap](OSS_GAME_REUSE_2026_ROADMAP.md) records Sandboxels as a design reference. Implementation uses VANILLAJS integer arithmetic and its fixed clock. The declared storage budget applies to each grid instance.
