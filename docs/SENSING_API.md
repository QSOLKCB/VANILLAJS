# SENSE-001 — Bounded world-space visibility and perception

**Status:** experimental, opt-in implementation candidate; no release/tag/merge implied.
**Based on VANILLAJS main:** `283f34864dca5245e6b6317f3c8c41494a6ed681` (owner-merged PR #138 and #139).
**Roadmap:** [OSS-GAME-REUSE-001](OSS_GAME_REUSE_2026_ROADMAP.md), first implementation phase.
**Playable example:** [Shadowline Tactics](../demos/sensing-lab/index.html), an original turn-based stealth and guard-perception lab.

## Why and boundaries

Existing `collision` provides closed static AABB segment intersections; `geometry.StaticAABBIndex` provides conservative immutable broad-phase indexing. SENSE-001 composes these **existing, authoritative kernels** into a reusable, **pure-JS** perception snapshot and query. It does not change FPS projectiles, cockpit missiles, 6DOF, RTS navigation, vehicle contact, or physics timers. Views, scores, guard policies, sound and mission geometry belong to consumers.

- **Coordinates**: SI metres, +Y up, -Z forward, XYZW quaternions only in other modules; sensing uses ordinary XYZ.
- **Limits**: at most 256 static blockers, 64 point targets, coordinate absolute value at most 10,000 m, query distance 0–2,000 m.
- **Inputs**: plain data-only records (prototype Object.prototype/null), dense arrays, unique lowercase-slug IDs; IDs unique across blockers and targets; unknown fields, getters, sparse arrays and nonfinite numbers fail closed before ownership. Source arrays are copied and frozen.
- **Static blockers only**: no moving/rotating AABBs; build a fresh world snapshot after a change.
- **Targets**: exact 3D **points**, not capsules, heads, bounding boxes, vision volumes or rayhit damage regions. Game code owns any target pose updates.

~~~js
import {createSightWorld,querySight} from './modules/sensing/index.js';
const world=createSightWorld({
  blockers:[{id:'pillar',box:{min:[-1,0,-4],max:[1,4,-3]}}],
  targets:[{id:'guard-a',position:[0,1.7,-12]}]
});
const sight=querySight(world,
  {position:[0,1.6,0],direction:[0,0,-1]},
  {range:50,fov:Math.PI/2,backend:'indexed'});
// [{id:'guard-a',position:[0,1.7,-12], distance:..., visible:false,
//   reason:'occluded',occluderId:'pillar'}]
~~~

### Query contract

`querySight(world,observer,options?)` returns a frozen array of owned result rows with exact fields:
`id`, `position`, `distance`, `visible`, `reason`, `occluderId`.

- Result order: **distance ascending, then ASCII ID ascending** on exact numeric ties.
- `range` uses the exact Euclidean point distance and is **inclusive** at the limit. Out-of-range wins before FOV and obstruction checks.
- `fov` is a **full cone angle in radians** from 0 to 2π. Visible exactly on its boundary is admitted with 16·Number.EPSILON tolerance for floating-point rounding. Out-of-cone wins before obstruction.
- If within both range and cone, `castSegment` defines **closed** AABB obstruction: contact even at the target endpoint blocks it, and a ray beginning inside/on a wall hits at fraction zero. Nearest obstruction wins, with lexicographically ascending blocker ID on exact equal-time ties.
- An observer/target occupying precisely the same point is considered inside the cone; any enclosing wall still obstructs it. This is a geometrical query, **not** a gameplay rule for melee detection.
- Reasons are exactly `visible`, `out-of-range`, `out-of-cone`, `occluded`. `occluderId` is null except for `occluded`.
- `backend:'indexed'` (default) uses `StaticAABBIndex.castSegment` and delegates exact hit classification to `collision.castSegment`. `backend:'serial'` runs the same narrowphase over every blocker, as an explicit serial parity reference. Both return exactly identical outputs for accepted inputs.
- Queries contain no DOM, WebGL, cursor/camera state, ambient time, randomness, callbacks or side effects. At most 64 targets and 256 blockers make operation bounded.
- **Performance**: no claim of indexed speedup without paired measurements; the indexed path has tree/build overhead, and tiny worlds may favour serial. Numeric outputs are Float64. Cross-runtime bit-exactness is not promised.

### Three presentations, one authority

The bundled [Shadowline Tactics](../demos/sensing-lab/index.html) is an **original** mission: one operative must acquire a data manifest, evade three patrolling guards and escape in 80 turns. Every accepted WASD/arrow/crouch/wait action advances the guard routes once; invalid or blocked moves consume no turn. Guard eyes are at 1.7 m, operative eyes at 1.6 m standing or 0.65 m crouched, barriers have real heights. Guards use a 95-degree physical cone and 14 m range. Lower cover **only blocks** a sightline when its actual AABB intersects the sight ray.

The view selector offers **tactical overhead**, **grounded first-person presentation** and **air/space sensor/radar** views. They consume the **same result from `inspectMission`**. The last is a display abstraction; it is **not** a second aircraft or orbital physics simulator. Changing views cannot turn guards or change whether anyone is spotted. Optional transparent range wedges in overhead view are **diagnostic** (they are not wall-clipped rendered fog-of-war). The operative has omnidirectional 30 m tactical awareness for pedagogical clarity; the FPS view only draws guards that appear forward on screen, without changing that authoritative query.

A deterministic **38-command training route** demonstrates a real, playable stealth win: the command input invokes the same one-turn simulation as normal keyboard actions, not a teleport or invulnerability override. Undo restores a prior immutable state (not a command to reset guard AI). Terminal detection, escape and exhaustion are explicit mission phases.

## Evidence and acceptance

Run these from the local repository:

~~~sh
node --test tests/sensing.test.js tests/sensing-mission.test.js
node scripts/sensing-workload.mjs --check
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
~~~

The dedicated `.github/workflows/sensing-lab.yml` also runs the **actual packaged Chromium** source at an offline loopback origin and records a screenshot, acceptance JSON and package SHA-256. Browser smoke must assert: view cycling preserves all authoritative state; mouse-controlled turn actions update the game; undo restores the prior state; every one of the 38 ordinary training commands reaches extraction; invalid/dropped input does not mutate physics; no JS console errors. The separate existing full source-bound Flight Lab workflow is neither weakened nor replaced.

The seeded independent slab oracle in `tests/sensing.test.js` is **not** a call into VANILLAJS collision or indexing. It independently compares nearest occluders against 150 static random scenes. Index/serial parity is checked for each case. The small `scripts/sensing-workload.mjs` records candidate-query and allocation-scale observations without treating nondeterministic wall-clock timings as acceptance.

## Provenance and permissions

Conceptual game design comparisons from [OpenCombat](https://github.com/buxx/opencombat), [OpenRA](https://github.com/OpenRA/OpenRA) and [Godot](https://github.com/godotengine/godot) informed the roadmap. **No** GPL source, Rust/Bevy code, Godot shaders, third-party sprites, maps, names, missions, icons or sound are copied. The SENSE module, mission and geometry are original Apache-2.0 source based exclusively on preexisting VANILLAJS collision/index APIs. Any future direct MIT/BSD code transplant requires a separate exact-file audit and attribution.

**Non-goals**: pathfinding AI, fog-of-war network authority, ballistic shooting, moving collider sweeps, true stealth hearing, animation/cutscenes and historical game emulation. These belong to later roadmap phases and independent game consumers. No native GPU FPS or physical-RTX performance is claimed from hosted Chromium.
