# Pooled A* workspace — QwakeTF v0.2.0 extraction

**Status:** experimental, opt-in, and serial. The original `findPath()` remains unchanged and is used as the exact-result reference. No GPU, worker threads, external libraries or game-specific code.

## Source and provenance

- **Donor:** QSOLKCB/QwakeTF PR #4, head `46367b7b946b0254aa7cbdbb4a454735b81e3052`, merged as `3852d20c9744350b883e38560f492a5683f2e492`, release `v0.2.0`.
- **Original optimisation record:** `QSOLKCB/QwakeTF/docs/OPTIMIZATION.md` (OPT-INV-001 and OPT-POOL-001), source file `src/nav.js`.
- **VANILLAJS reference before extraction:** `88c72367391286f8fcd95c6ded078144e84f1e43`, `modules/navigation/index.js`.

QwakeTF demonstrated that stable per-search **generation stamps** and persistent typed arrays can avoid repeatedly allocating/clearing navigation search state, while a parallel-array heap avoids one temporary object per frontier insertion. Its own 8v8 bot-match parity gate and timing results motivated this slice, but its numbers are **not** VANILLAJS benchmark results.

## Implementation

`new PooledPathfinder(grid)` accepts one immutable `NavigationGrid`. Constructor builds a private walkability mask, and allocates score, parent, closed and seen typed arrays. Subsequent `pool.findPath(start,goal,{maxExpanded=4096})` calls reuse those arrays with uint32 search-generation stamps instead of clearing every cell. Generation wrap clears stamps before reuse.

The frontier has reusable, grow-only typed arrays for node indices, g, h and f. It preserves VANILLAJS's existing **total** heap order `(f,h,index)` and north/west/east/south neighbour order; QwakeTF's less-specific f-only ties would not preserve every route. Stale entries, budget exhaustion, unreachable paths and parent reconstruction retain the original `findPath()` contract.

One pool is bound to a single grid snapshot. A `grid.withBlocked(...)` edit returns a **different immutable grid** and requires a new `PooledPathfinder`. The implementation does not retain search results, cache paths, mutate the grid or touch simulation state. Result paths are newly owned arrays. A pool must be used sequentially, not reentrantly or simultaneously across workers.

### Example

~~~js
import {NavigationGrid} from './modules/navigation/index.js';
import {PooledPathfinder} from './modules/navigation-pool/index.js';

const grid=new NavigationGrid({width:64,height:64,blocked:[]});
const pool=new PooledPathfinder(grid);
const a=pool.findPath([2,3],[50,42],{maxExpanded:4096});
const b=pool.findPath([4,3],[50,42],{maxExpanded:4096});
// For a later terrain edit:
const edited=grid.withBlocked([[10,10]]);
const nextPool=new PooledPathfinder(edited);
~~~

## Evidence protocol and limitations

- `node --test tests/navigation-pool.test.js` includes 2,560 seeded route/budget comparisons against unchanged `navigation.findPath()`, independent BFS shortest-distance checks, repeated invalid and successful searches, frozen-grid edit isolation, and the full 256 × 256 grid.
- `node scripts/navigation-pool-workload.js --check` runs **serial** A* on 24² and 48² fixed grids at 1, 24 and 96 queries. Each scenario has two warm-ups and seven *alternating* baseline/pooled trials. The entire returned path objects and expansion totals must match. It reports per-trial timing and the **cold walkability-mask creation cost** separately. CI enforces correctness, never noisy elapsed-time thresholds.
- **No universal speedup claim.** One-shot or small-grid queries may be faster using the existing allocation-on-demand `findPath()`; the new workspace is intended for repeated searches against one grid. Real workload crossover must determine adoption.
- Existing `FlowFieldSearch` and `formationSlots` remain unchanged. No memoised A* result cache is introduced; QwakeTF rejected that approach because only ~10–15% of its paths repeated.
- QwakeTF's render/light optimisations and controller handling were assessed but mostly overlap with existing VANILLAJS facilities. They are not mixed into this navigation PR.
- Preserved RTX5060TI-001 and RTX5060TI-002 artifacts are **unchanged**. This Node-only navigation workload has no directly comparable metric in either historical GPU receipt; no GPU benchmark is claimed.

To verify: `node --test tests/*.test.js`, `node scripts/check.js`, `node scripts/build.js`, and packaged Chromium CI.
