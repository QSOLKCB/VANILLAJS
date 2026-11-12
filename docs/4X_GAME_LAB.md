# 4X Game Lab — Ternary Reach 👽

**Experimental · Native ES modules · Apache-2.0.**

[Open the lab](../demos/4x-game-lab/index.html). Explore a seeded sixteen-system
sector, settle colonies, develop production and command fleets against the
Umbra Compact. The game runs locally, including from the packaged offline site.

For larger campaigns and editable universes, open the separate
[VOIDWARD campaign mode](../demos/4x-game-lab/voidward/index.html). It brings eight
campaigns, selectable empires, ship design, research dependencies, production
queues, diplomacy, objectives and a data-pack workshop from the pinned
4XGAMES implementation. The [VOIDWARD workflow](VOIDWARD_WORKFLOW.md) explains
playing it and moving campaigns, star charts and ship silhouettes through the
Visual Editor. Ternary Reach's rules and replay format below remain unchanged;
the two modes use separate game state and formats.

## First foothold

1. Start with sector seed `731`. Aster, system `0`, is your capital.
2. Select system `1`, then **Survey** (2 ore) and **Colonize** (12 ore).
3. Select Aster and **Build** one ship (3 ore). Your three orders
   are now spent. **End turn** collects production and advances the rival.
4. Build ships, settle more systems and develop laboratories. One colony can
   build, upgrade or dispatch only once per turn; founding a colony spends its
   action for that turn. Surveying and research consume an empire order.
5. Choose a departure colony and a surveyed destination to prepare a fleet
   order. **Send** commits it. Friendly intermediate colonies must supply the
   route; an unclaimed destination must be colonized before receiving ships.

Selecting a star, reading the manual, exporting and rejected orders spend
nothing. The chart, select menu and native buttons offer the same controls.
Nothing advances while the page is idle, hidden or unfocused. There is no
simulation clock, autoplay or held-key movement in this turn-based lab.

## Rules you can inspect

- Seed: uint32, including `0`; default browser sector `731`. Generation uses
  `integer-math.nextRandom` with explicit state. Play consumes no random draws.
- Sector: a connected 4×4 graph with seeded diagonal lanes, richness and chart
  positions. Chart coordinates are illustrative units, +X right and +Y up;
  they are not SI distances, flight trajectories or physical orbits.
- Exploration: your capital is surveyed; neighboring nodes are discovered.
  Surveying reveals a discovered frontier system's ownership and richness.
  Founding or capturing a colony discovers its neighbors. Hidden system
  details are absent from the player snapshot. Surveyed systems retain live
  information; this prototype has no line-of-sight or last-seen intelligence.
- Economy: start with 28 ore and six capital ships. Each colony produces
  `(3 + mineLevel × richness) × (4 + industryLevel) / 4` ore per turn, and
  `1 + 2 × labLevel` science. Ore remains an `ExactRational`; the inspector
  and resource headline expose its exact value; admission uses the available balance.
- Orders: three per turn plus one for each four colonies. A normal accepted
  order costs one. End Turn collects the player's production, increments the
  turn, runs one deterministic rival update, resets colony actions, restores
  the order budget and checks the outcome.
- Development: mines/labs have levels 0..3; upgrading costs `8 × (level+1)`
  ore. A ship costs 3 ore. Industry, weapons and navigation have levels 0..3;
  their next research upgrade costs `12 × (level+1)` science.
- Fleets: at most 100 ships per system, at most 20 built per order. Transfers
  and attacks resolve immediately; there is no transit queue. The shortest
  supplied route may have at most `2 + navigationLevel` lanes. Sorted graph
  adjacency makes equal-length route choices deterministic.
- Combat: attack strength is `ships × (4+weaponsLevel)/4`; defense is
  `(garrison+2) × (4+defenderWeaponsLevel)/4`. Attack must strictly exceed
  defense to capture. The winner loses the ceiling of the opponent's
  weapon-adjusted strength; a successful capture leaves at least one ship.
  A repelled attack consumes all dispatched ships and reduces the garrison.
- Rival: earns five ore per colony, expands every second turn up to five
  colonies, reinforces its leading colony and begins border attacks or
  repositioning on turn twelve. Stable IDs break ties. Its capital objective
  and topology are public; tactical choices use colony-adjacent ownership
  and garrisons, never the player's resource stockpile.
- Victory: capture Umbra (`15`) for domination, or hold four colonies and
  accumulate 120 **unspent** science for the Aster Beacon. Research upgrades
  help your empire but spend science; they are optional for the beacon.
  Losing Aster is defeat. At turn 80, compare `20 × colonies + ships`, adding
  accumulated science to the player score. Equal scores draw.

## ALIEN MATH consumption

| Existing module | Concrete use | Source contract |
| --- | --- | --- |
| `integer-math` | Explicit uint32 map generation | [Integer engine](INTEGER_ENGINE.md) |
| `exact-rational` | Fractional ore production and weapon ratios | [ALIEN MATH 001](ALIEN_MATH_001.md) |
| `exact-graph` | Connected bounded starlanes and shortest supplied BFS routes | [ALIEN MATH 005](ALIEN_MATH_005.md) |

The graph module's sixteen-vertex bound determines the sector size. Route
queries run on orders and inspector changes, rather than in an animation loop.
The demo owns its rules, fiction, AI, progression and DOM; the reusable modules
keep their existing contracts and dependency direction. No runtime packages,
CDNs, external assets or third-party engines are added.

These exact arithmetic components do not constitute a proof of the new game's
rules, balance or browser implementation. See the
[ALIEN MATH evidence boundary](ALIEN_MATH_FINAL.md). The current browser-policy
file is listed in the phase-006 source manifest; registering the lab updates
only that policy digest. This inventory update runs or certifies no Lean proof.
Historical mathematical sources and archived evidence remain unchanged.

## Replay and input boundary

**Export replay** saves `{kind:"qsol.4x-replay.v1",seed,commands}`. Import
validates this versioned data and re-executes every accepted command into a new
candidate game. It does not trust a serialized world or execute scripts. Only a
fully accepted candidate replaces the active run. There is no automatic save;
export before leaving if you want to resume a campaign.

The replay is bounded to 128 KiB and 1,024 commands. The game is bounded to 80
turns, 40 recent journal entries, 100 ships per colony and 100,000 resource units.
Commands have exact field sets and bounded integer arguments. Wrong versions,
unknown fields, invalid or illegal commands and oversized files leave the
accepted run intact. Exported data is a local resume/reproduction format, not a
signed achievement record. The demo API is not a stable engine API.

## References inspected

- GAMES: [Sovereign Lattice design](https://github.com/QSOLKCB/GAMES/blob/7e0a9019d07b491cffc9b698fa51acdb843c49cc/SOVEREIGN_LATTICE/docs/DESIGN.md)
  informed explicit turn order, bounded sector play and readable route feedback.
  Its [optimization notes](https://github.com/QSOLKCB/GAMES/blob/7e0a9019d07b491cffc9b698fa51acdb843c49cc/SOVEREIGN_LATTICE/docs/OPTIMIZATION.md)
  favor simple exhaustive searches on small graphs when pruning adds overhead.
- ARCADE: [invariants](https://github.com/QSOLKCB/ARCADE/blob/eb4649957c301f33d92b75317cd2fac58de4b37a/docs/INVARIANTS.md)
  and [controls](https://github.com/QSOLKCB/ARCADE/blob/eb4649957c301f33d92b75317cd2fac58de4b37a/docs/CONTROLS.md)
  informed selection-before-execution, free rejected/read-only actions, pure
  rendering and explicit results/retry.
- VANILLAJS: [RTS Lab](RTS_LAB.md), [2D foundations](2D_FOUNDATION.md) and
  [incremental Chromium policy](BROWSER_INCREMENTAL_CI.md).

These are design references for Ternary Reach. That mode's game and UI code
were authored here. The separate VOIDWARD mode includes attributed donor
source and its original file-level licences; see [its source boundary](VOIDWARD_WORKFLOW.md#source-and-package-boundary).

## Reproduce

```sh
node --test tests/4x-lab.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
# Use the existing external Playwright installation, as configured in CI:
node scripts/browser-check.js --suites=home,worlds
```

The packaged Chromium `worlds` suite includes `browser-4x.js`: real controls,
keyboard and touch, exploration/colonies/economy/research/fleets, strict replay
imports, zero/fractional seeds, 320/390px layout and offline reconstruction.
New runtime and test sources are registered without promoting them to reviewed
cache witnesses. CI must execute the real checks under the existing fail-closed
policy. No owner-only GPU workflow is dispatched for this feature.

Historical Ternary Reach validation: Node 22.18.0 ran all 671 Node tests, including
ten 4X regressions. Syntax/catalogue checks passed, and the 154-file offline
package verified. The packaged Chromium `home,worlds` suites passed; the 4X
regression passed again against the final package after the route-display fix.
The existing external Playwright 1.64.0 installation was used. Narrow screens
and touch were emulated; physical mobile devices and hardware GPU performance
were not measured. The 57 archival RTX receipt tests, five archive verifiers,
three phase-006 boundary tests and CI invariant workload also passed. These
local results do not report a GitHub CI outcome.
