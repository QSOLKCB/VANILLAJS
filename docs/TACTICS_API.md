# TACTICS-001 — Deterministic Squad Orders and Physical Cover AI

**Status:** experimental, opt-in review candidate. Based on **VANILLAJS main at `1902629f43cdbbfc6021276120381e671b53703a`**, the merge of WORLD-VIS-001 PR #144.

This implements **P4 — TACTICS-001** from [OSS-GAME-REUSE-001](OSS_GAME_REUSE_2026_ROADMAP.md): finite orders (`hold`, `move`, `suppress`, `retreat`), real line-of-sight-linked cover choice, suppression decisions and reproducible fixed turns. Engine/geometry is Apache-2.0, authored independently; no donor game source or assets are imported.

## Live demonstration

[**Squadline — Operation Quiet Relay**](../demos/tactics-lab/index.html) is an original 26×18 tactical grid with three allied operatives, three independent defenders, ten physical AABB obstacles and a relay objective. Each cell is 2 SI metres. The player must hold the relay for two uncontested, unsuppressed turns to finish the non-lethal infiltration. **That victory policy and its 64-turn timeout live only in `demos/tactics-lab/scenario.js`**, outside the reusable engine.

Select an allied operative, then queue a `MOVE`, `HOLD`, `SUPPRESS` or `RETREAT` order; one click advances one **accepted** turn. Omitted operatives HOLD. Click an open map cell for a move destination or a visible enemy to propose suppression; the engine refuses an invisible target even if it was clicked in the UI. In the cover view, green candidate cells represent walkable positions **occluded by actual named AABBs**. The browser camera choice is presentation only. Use **Suggest squad orders** for a deterministic proposed plan; these never execute automatically. Use Undo and Verify replay to inspect the fixed-turn contract.

No life/HP, invented damage, projectile bypass, secret weapon lock, networking or reinforcement spawning has been implemented. Suppression is a bounded **tactical state and behaviour modifier**, not gunfire/hit detection. This is a game/AI learning lab, not real combat targeting software.

## Pure engine API

[`modules/tactics/index.js`](../modules/tactics/index.js) exports:

- `createTacticsWorld({width,height,cellMetres,cover,units,objective,seed})`. Owns copies of a bounded source: width 6–32, height 6–24, 1–4 m/cell, ≤24 rectangular cover blocks, 2–12 distinct occupied actors and one walkable objective. Cover blocks must have exact inert fields (`id,x,z,w,h,height`) and positive volume; each source unit has exactly `id,team,cell,heading`. Teams `alpha` and `bravo` must both be represented. Source IDs are unique across world and blockers.
- `createTacticsState(world)`. Returns an owned, deeply frozen turn-zero **turn/units/events** state. There is no phase, progress, campaign clock or victory policy in the engine. No ambient clocks, asynchronous work or executable scenario fields.
- `inspectTactics(world,state,{backend})`. Uses **the original `sensing.createSightWorld` / `querySight`** with actual 3D observer/target points, finite detection range, physical cover AABBs and a 150° field of view. `backend='indexed'` and `backend='serial'` produce identical reports. Camera choice cannot change AI, sight or motion.
- `queryTacticalCover(world,state,unitId,{maxSteps=5})`. Searches reachable N/W/E/S cells up to five steps, accounting for occupied cells and the immutable NavigationGrid. Evaluates every candidate with SENSE at **360° FOV** to distinguish genuinely blocking obstacles from the accidental safety of an opponent looking away. A cover candidate is admitted only when at least one enemy ray is **occluded** (with a real named blocker ID) and **no in-range opponent has a clear sight ray**. Out-of-range or out-of-cone reports never count as cover. Ranking: shortest steps, objective distance, cell Z/X, occluder ID; deterministic even with equal distances. A valid retreat is still a normal one-cell navigation step, not teleportation.
- `planTacticalOrders(world,state,team='bravo')`. Pure deterministic squad-intelligence proposal. A suppressed unit first seeks physical cover; an unsuppressed unit proposes suppression only if a target is *currently visible*; otherwise it navigates toward the objective or holds its defending perimeter. A bounded integer seed determines only equal-distance visible-contact ties. The planner stages candidate moves against a private copy in stable unit-ID order and checks occupancy plus bounded A* before proposing them: an objective already occupied by a teammate, or an unreachable goal, produces HOLD instead of a known-rejected movement order. The planner never executes an order, changes targets invisibly or performs weapon/health simulation.
- `stepTactics(world,state,orders)`. Validates exact data-only order records (`unitId,action,to,targetId`), unique allied actors, accessible route and visible suppression targets. Updates a private copy in stable actor-ID order, then recomputes opposing AI from the resulting authoritative world. All accepted allied actions, enemy decisions and suppression decay advance exactly one turn. A rejected move or unseen suppression returns the **same unchanged state** and does **not** advance the turn. **The generic engine does not end after 64 turns, award relay victory or reject orders based on game-phase.** It returns the accepted finite turn and event record; the consuming game chooses its own objective and terminal-policy boundary.

Navigation is delegated to the existing immutable [`NavigationGrid` and `findPath`](../modules/navigation/index.js). No A* implementation is silently duplicated in the tactical module. Physical visibility, including line/AABB edge-touch semantics and same-distance ties, is delegated to [SENSE-001](SENSING_API.md). Cover uses real-world coordinate conventions (+Y up, −Z forward, metres), not a 2D collision guess. Interaction semantics here are original, not imported from third-party tactical games.

## Authority boundaries

**Explicit:** there is no direct call from a camera, renderer, animation or input event to hit registration. A queued order must be accepted through `stepTactics` before time or any units change. All players and guards remain present and simulated when offscreen or visually occluded. Suppression affects future tactical decisions, not `combat3d` health or projectile decisions. A map obstacle is both an admitted NavigationGrid blocker and a SENSE static AABB; the same data establishes both domains, with no hidden cover flags.

The consumer exports `createRelayStatus()` and `advanceRelayStatus(previous,tactical,objective,turnLimit)`, applies them *only after* a successfully accepted tactical turn, and stores/restores their status alongside the core state in Undo/Replay. The default original mission uses two uncontested unsuppressed relay turns and a 64-turn cap; a different game can reuse the tactics engine without either condition.

The original SENSE-001 Shadowline game and its 38-turn replay, the native `navigation`/`navigation-pool` oracles, `combat3d`, `interactions`, FPS/HORIZON/WORLD-VIS graphics, and existing gameplay/labs are not edited by this candidate. The seed, turn budget, side precedence, LOS range and IDs are recorded as deterministic data. No online, sensor, cloud, npm runtime or external media dependencies.

## Evidence and acceptance

~~~sh
node --test tests/tactics.test.js tests/sensing.test.js tests/sensing-mission.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
~~~

The new unfiltered [`.github/workflows/tactics-lab.yml`](../.github/workflows/tactics-lab.yml) checks these contracts and runs pinned isolated Playwright 1.64 Chromium against the **real complete offline package**. The dedicated browser exercise tests original units, three presentation modes with byte-for-byte identical perception, invisible-target suppression rejection without a turn, actual UI movement and opposing AI, Undo, deterministic accepted-order replay, suggestions and reset. It retains a Canvas screenshot, exact package manifest SHA256 and JSON execution receipt. The browser requests no external sites; any HTTP 404 or JavaScript console error fails acceptance.

Tests additionally verify independent SENSE indexed/serial parity, actual named AABB occluder rays, out-of-cone vs cover distinction, bounded navigation and occupancy, non-executable input rejection, seed-based equal-distance tie-breaking, first-class source immutability, and independently replayed fixed turns across two fresh worlds. **No fabricated FPS, hardware p95, enemy accuracy or actual weapon hits are claimed.**

## Remaining explicit limits

This first phase is a **one-tile-per-turn command AI**, not a real-time combat AI or networking framework. Cover is bounded to 5 path steps and measured from actual point-eye LOS at 1.7 m; it does not optimize suppression angles or grenade trajectories. A successful retreat can select a covered destination several tiles away but moves only one path step per turn, so intermediate approach tiles are not automatically protected. More advanced squad formation, overlapping command conflict resolution, suppression/fire dynamics with a proper weapon host, multi-tile reservations and scenario-builder exports remain separate future phases requiring independent tests and real ownership boundaries.
