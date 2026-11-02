# Shared flow fields — 0.7.0

The new navigation API builds one shortest-distance map for many units sharing
destinations. It extends the existing uniform four-neighbour grid. Individual A*
remains available and can settle fewer cells for a single short route.

## Two compositions

| Recipe | Units | Arrival rule | Try this |
| --- | --- | --- | --- |
| Flow convoy | 24 | Couriers leave the map at one depot | Move the depot or close the north gate |
| Two-exit evacuation | 36 | Units leave at their nearest open exit | Close the north exit; remaining units go south |

Choose the recipe and press **Run routes**. Build work advances on the existing
120 Hz fixed clock. The field panel shows expanded cells, build ticks, generation
and unit lookups. Reduce search work to one cell per tick to observe a partial
build, pause it, or replace it. The direction overlay appears only after completion.
Changing the budget changes readiness time, not the completed distance field.

Flow convoy map clicks/taps replace the depot for every active courier. Arrow keys
move the map cursor; Space/Enter submits a depot order. The evacuation has fixed
exit markers and a **Close / open north exit** button. Completed deliveries remain
counted after edits. Reset restores all units, exits, terrain, builds and counters.
The A* route and squad recipes keep their original selection and order controls.

Pause and focus loss freeze both build work and movement. Unfinished pointer
gestures are cancelled; accepted goals survive deliberate resume. Recipe changes
and reset cancel incomplete builds. Gate or destination edits increment a generation,
discard the old field and create a new search. Only the current completed job can
publish. An occupied gate, or a gate serving as the depot, rejects closure.

Units move in shared 120 ms cardinal segments, using the existing unique-cell
reservations and stable contention policy. During a rebuild, current segments
finish, then new moves wait. Closed exits remain walkable but no longer consume
arrivals. An unreachable unit waits; field distance does not include congestion
or predict moving blockers. These recipes use point-grid routes and small visual
circles, not continuous rigid-body physics or a complete crowd/evacuation model.

## Executed search-work comparison

Run `node scripts/navigation-workload.js --check`. The committed
[`NAVIGATION_WORKLOAD.json`](NAVIGATION_WORKLOAD.json) records the runtime and
scenario. CI reproduces every row and keeps its JSON alongside screenshots.

Both grids use alternating-gap walls every eight columns, row-major walkable
starts and a common far-corner goal. Every A* cost is checked against the shared
field's cost. Building settles at most 64 cells per call.

| Grid | Requests | Independent A* cells settled | Shared-field cells settled | Field samples |
| --- | ---: | ---: | ---: | ---: |
| 32 × 32 | 1 | 504 | 931 | 1 |
| 32 × 32 | 24 | 4,733 | 931 | 24 |
| 32 × 32 | 128 | 25,211 | 931 | 128 |
| 32 × 32 | 512 | 107,717 | 931 | 512 |
| 64 × 64 | 1 | 2,812 | 3,655 | 1 |
| 64 × 64 | 24 | 65,445 | 3,655 | 24 |
| 64 × 64 | 128 | 215,005 | 3,655 | 128 |
| 64 × 64 | 512 | 809,826 | 3,655 | 512 |

The 32×32 field needs 15 build slices; the 64×64 field needs 58. These are observed
algorithmic work counts for the stated workloads. They exclude allocation/setup,
heap operations, field sampling, agent scheduling and rendering. A field and an
A* expansion are not identical CPU operations. No speedup, frame rate, physical
device coverage or maximum supported army size is established by this table.

## Correctness evidence and limits

Tests compare every cell against per-goal A* on 40 seeded maps, including tied
goals, disconnected regions and obstacles. Other cases verify bounded slices,
immutable input/results, cancellation, stale-grid identity, descending paths,
chunk independence and the full 65,536-cell limit. The existing A* is separately
checked against an independent breadth-first oracle in the earlier suite.

Recipe tests deliver all 24/36 units, check active-cell and visual separation each
tick, reroute after edits, reject occupied/depot gates, freeze partial jobs on pause,
and compare 30/60/144 Hz schedules. Packaged browser scenarios exercise build controls,
pause/replacement, gate rebuilding, complete deliveries, exit closure, blur/reset,
recipe switching and 390 px touch-emulated controls. Results for the current commit belong in
the PR. Physical devices, other browser engines, large armies, weighted costs,
continuous steering and general multi-agent scheduling remain outside this slice.
