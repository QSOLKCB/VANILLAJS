# RTS Lab — routing and shared fields (0.7.0)

Four native Canvas 2D recipes use the same `navigation` and `time` modules.
Route planner has one unit; Squad orders has six. Both cross a 24 × 16 map with
two walls, two passages in the west wall, one in the east wall and a raised block.
The geometry and UI are original; no assets or external game code are loaded.

Flow convoy adds 24 couriers sharing one depot; Two-exit evacuation routes 36
units to their nearest open exit and adds an upper passage in the east wall.
Those recipes build directions incrementally and retire units at destinations.
See [shared-field controls, contracts and measurements](FLOW_FIELDS.md).

## A* recipe controls and lifecycle

| Action | Mouse | Touch / keyboard |
| --- | --- | --- |
| Select | Select tool: click unit or drag rectangle; Shift adds | Tap a roster button; Select all; Select tool then map tap |
| Order | Right-click ground, or Move tool and left-click | Move tool then tap; map arrows position cursor, Space orders |
| Use current tool | Click map | Focus map, arrows then Enter; A selects all |
| Run / pause | Run routes / Pause | Same buttons; Escape pauses |
| Stop | Stop selected | Finish current cell segment, then hold |
| Change terrain | Close / open north gate | Same button; occupied gate rejects closure |

Orders can be planned while ready or paused. Closing a gate recalculates routes;
it cannot close on either endpoint of an in-flight unit segment. Blur, hidden
tabs, Escape, reset, recipe changes and lost pointer capture cancel unfinished
gestures. Blur and hidden tabs pause. A late pointer release cannot become an
order. Repeated keydown events are ignored; keyboard actions require fresh presses.
Pause preserves accepted orders and positions. Resume is explicit. Reset restores
all units, terrain, selection, clocks and counters. Stop allows the current segment
to finish after resume; it does not teleport back to a previous cell.

## A* recipe planning and traffic

Grid coordinates are `[column,row]` in X/Z, one metre per cell. Units use cardinal
movement, with a 180 ms interval per cell and presentation at 120 Hz fixed ticks.
They have no mass, inertia, attack, economy, health or unit-body collision solver.
The visible circles have a 0.23-cell radius and share movement timing.

The navigation API returns shortest paths on uniform terrain. Squad orders first
choose unique, reachable nearby destinations by breadth-first traversal, then
greedily assign slots to units in stable ID order using Manhattan distance. This
is neither globally optimal assignment nor a rigid formation during travel.
Orders reserve unselected units' current segment endpoints in the planning grid.
The full formation and all routes share a 4,096-expansion budget per order.
If any route fails, every previously accepted unit order remains unchanged.

The game-owned traffic layer permits one destination per boundary. Chains ending
at a vacant cell advance together; cycles and head-on swaps wait. Stable unit IDs
break contention. After six unsuccessful boundaries, a unit replans around all
other occupied cells. Each retry is capped at 4,096 expansions; this demo has only
384 cells and at most six units. A waiting route can still deadlock or starve.
Stop/reorder units to recover. No general multi-agent completeness, fairness,
optimality, maximum army size or performance claim is made.

## Verification and adoption

Pure tests compare A* with an independent breadth-first oracle on 80 seeded maps,
exercise work limits and immutable edits, and complete both lab recipes. Traffic
tests check unique logical cells and separated displayed circles during every
simulated tick, swaps, vacancy chains, contention, gate closure and replacement
orders. Other checks cover pause/reset and identical 30/60/144 Hz presentations
within one runtime. See `tests/navigation.test.js` and `tests/rts-lab.test.js`.

`scripts/browser-rts.js` adds real pointer/keyboard orders, rectangle selection,
gate rerouting, complete arrivals, late-release cancellation, blur/reset, rendering
and unavailable/lost Canvas paths. A 390 px touch-emulated page exercises roster,
tool and map taps. Exact-head execution belongs in the PR. Synthetic blur/context
events and emulation do not establish physical-device, cross-browser or GPU feel.

Copy only `modules/navigation/index.js` for the planner; it has no dependencies.
For an RTS game, supply its occupancy policy, inflate obstacles for the intended
body footprint, validate terrain edits and implement the desired movement model.
The existing FPS collision solver is separate; a grid route is not a body sweep.
Weighted costs, diagonals, slope navigation, navmeshes, continuous
steering and advanced multi-agent scheduling remain outside this release.
