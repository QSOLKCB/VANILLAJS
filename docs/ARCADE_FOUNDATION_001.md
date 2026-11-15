# ARCADE-FOUNDATION-001 — The Arcade Combat Foundry

**Experimental implementation for proposed VANILLAJS v2.2.0.** This PR does not
publish a release, change historical release claims, or promote these APIs to
stable. Modern convenience. Minimal dependencies. Old-school correctness.

## Audit and implementation boundary

Implementation baseline: VANILLAJS `main` at
`00401479163b775a43f4afe5577fecc289052de8`. Games2 design reference: `main` at
`2f3cd4d7e8fa6e1568922e1d7a269fe650196b58`. Both matched the supplied starting
references at audit. Games2 has no source changes, submodule or runtime dependency.

The audit covered AGENTS.md, MODULES.json, ROADMAP.md, ARCHITECTURE.md,
2D_FOUNDATION.md, MOD_SDK_001.md, CREATOR_GUIDE.md, motion2d, collision,
projectiles, weapons, interactions, audio2d, mod-sdk, both existing 2D/arcade
labs, the packaging allowlist and Chromium dispatcher/reuse machinery.

Existing facilities are composed as follows:

| Facility | Use / boundary |
| --- | --- |
| motion2d | Existing integer point movement; additive optional motor tuning and impulses, unchanged defaults |
| time.FixedClock | 60 logical ticks/second; six-tick, 100 ms catch-up cap; pause discards debt |
| input.Actions / attachKeyboard | Held actions, retained tap edges, repeat suppression and cancellation |
| input.FlightGamepad | Existing standard-pad neutral gate, connection identity and Menu edge |
| audio2d / api/audio/effects | Original PCM music/effects and bounded, gesture-gated device playback |
| mod-sdk.DataModRegistry | Domain validation, register/activate and atomic registry replacement |
| collision.castSegment | Independent existing slab-query oracle in tests; not the state backend |
| projectiles / weapons | Existing Float64 3D shots and seconds-based magazine timers stay unchanged; integer combat owns its own tick windows |
| interactions | Declarative rule resolver remains available; deterministic direct damage does not need another general rules engine |

Only `combat2d` and `mod-arcade` are new engine modules. Combat owns identity,
teams, health, hurtboxes, attack windows, hit ordering, projectiles, stun and
invulnerability. The lab owns enemy decisions, stage/platform policy, scoring,
pickups, encounters, completion, replay/session orchestration, UI and fiction.
Neither module imports any demo or accesses ambient input, entropy or time.

## Experimental combat API

`modules/combat2d/index.js` exports:

- `createCombatWorld({actors, solids, limits})`: validated immutable world.
- `defineAttack2D(spec)`: detached frozen move; accepts an already compiled move.
- `stepCombat2D(world, {poses, attacks, shots}, {reference=false})`:
  `{world, events, work}`; one tick, no mutation of the previous world.
- `addCombatActors(world, sources)`: new IDs must exceed every previously used ID.
  Knocked-out actors retain their slots; the caller starts a new world for reuse.
- `healCombatActor(world, id, amount)`: living actors only, capped at max health.
- `combatSnapshot(world)`: detached JSON-compatible full state. This is not a
  core state loader; only owned worlds can be stepped.
- `hurtbox2D(actor)`, `hitbox2D(actor)`, `overlaps2D(a,b)`,
  `sweepContact2D({x,y,dx,dy,radius}, box)`: closed contact helpers.
- `COMBAT2D_LIMITS`, plus strict integer/record/dense-array admission helpers
  (`combatInteger`, `combatRecord`, `combatArray`) used by the typed pack adapter.

Actor source fields are exactly `id, team, x, y, faceX, faceY, health, hurtbox`.
IDs are 1–1,000,000; teams 0–255; health 1–10,000. A hurtbox has local
`minX,minY,maxX,maxY` in −2048…2048 and positive area. Facing is one of the four
cardinal integer vectors. Diagonal projectile velocities are supported.

Move fields are exactly:

| Field | Inclusive bounds / meaning |
| --- | --- |
| windup | 0–180 ticks before the active window |
| active | 1–120 ticks of closed hitbox contact |
| recovery | 1–240 ticks before another attack |
| reach | 1–2048 forward subunits |
| halfWidth | 1–1024 perpendicular subunits |
| offset | −1024…1024 world-Y offset from actor origin |
| damage | 1–1000 health units |
| knockback | 0–512 subunits/tick on each facing component |
| stun, invulnerability | 0–240 ticks |
| interruptible | Boolean; false retains the attack when hit, but does not prevent damage |

Attacks are `{id, move}` commands. Poses have exactly
`id,x,y,faceX,faceY`. A shot has exactly
`id,vx,vy,lifetime,radius,damage,knockback,stun,invulnerability` where `id`
is its owner. Shots start at the owner's hurtbox centre in Y and origin in X.
Velocity components are −4096…4096, not both zero; lifetime is 1–600 ticks;
radius 0–512 expands targets as a square. Other effect bounds match moves.
One command per actor per category is allowed per tick. Commands for unknown
or duplicate IDs reject. Dead, stunned or recovering actors ignore new attacks
and shots. A simultaneously requested eligible melee takes priority over a shot.

Default/hard maxima: 64 actors, 128 projectiles, 512 events per tick, 32 static
shot-blocking solids and 108,000 combat ticks. Limits may be reduced, not raised.
All inputs are checked and a candidate world is staged before publication.
Event overflow, shot overflow, invalid commands or invalid additions throw
without changing the supplied world. Core arrays are bounded; this is not an
allocation-free simulation. Public snapshot objects cannot be passed as worlds.

## Coordinates, timing and contact ordering

+X is right; +Y is up. Integers are **256 subunits per game unit**, as in
motion2d. Positions are bounded to ±1,000,000. Velocities are displacement per
logical tick. This is neither Q16.16 nor the Float64 3D projectile system.
The Canvas adapter alone inverts Y and scales to logical pixels.

Attack age zero is the initiation tick. Ages
`windup <= age < windup + active` are active. Age advances at tick end;
recovery begins after the last active sample. Completion follows the last
recovery sample. A victim is considered at most once per attack, including an
invulnerable contact. Facing is latched on attack initiation; poses may move
the hitbox origin while its direction stays fixed.

Existing stun/invulnerability counters decrement at tick start. A new counter
N protects/locks the remainder of this tick and the next N−1 ticks. New stun
blocks subsequent input; `recovered` marks its transition to zero. Knockback
components decay by eight subunits/tick and reset on recovery. The consumer
feeds them into motion2d impulses; combat itself does not integrate movement.
Interruptible attacks emit completion with reason `interrupted` when damaged.
Uninterruptible attacks continue their window while the actor is stunned.

Melee contact is endpoint-based and closed at edges/corners. Projectiles sweep
the full tick segment against expanded endpoint hurtboxes and static solids.
The integer slab predicate returns a rational `n/d`; comparisons use exact
bounded integer cross-products below 2^53. Equal-time shot contacts prefer a
solid, then the lower numeric ID. Projectiles end at the first eligible contact,
including invulnerable targets. No piercing or bounce is implied.

Event phases are: timer recovery, accepted attack/shot starts, no-contact shot
expiry, ordered contacts, attack recovery/completion. Within contacts, order is
time fraction, source ID, kind (ASCII), attack/projectile serial, victim ID.
Melee contacts have time zero. Contacts are collected before effects: simultaneous
melee attacks can trade even when one source is interrupted or knocked out;
target invulnerability established by the earlier contact still suppresses
later damage. `hit.damage` is the actual applied amount (zero when suppressed).
Every knockout and projectile completion is emitted once. Stable order is not
a claim that all event categories share one continuous physical timestamp.

Actor/static collision remains motion2d's axis-separated **point endpoint**
query. The lab adds one-way ledge landing by downward Y crossing at endpoint X.
No body sweep, slopes, actor separation, relative moving-target projectile
sweep, rotating boxes, rigid-body impulse solver or arbitrary thin-wall actor
collision is claimed. Fast actor movement can cross thin obstacles. Projectile
sweeps cover thin targets only at the supplied endpoint pose, not targets that
cross the shot and leave within the tick. No full belt-scrolling or fighting-game
frame parity is claimed.

The optional motion2d `motor` fields are `speed, acceleration, drag, jumpSpeed,
gravity, fallSpeed` (integers 1–512); platform and shmup use the relevant fields.
Other profiles retain their original laws. `controls.impulseX/impulseY` are
−512…512, added before the existing collision/bounds path and clamped to ±512.
Omitted options preserve historical behavior, including the default jump.

## Playable compositions

[Arcade Combat Foundry](../demos/arcade-combat-lab/index.html) includes:

- **Iron Meridian:** horizontal run-and-gun, jumpable ledges/obstacles,
  eight-way shooting, quick melee, pursuit enemies, telegraphed sentries,
  heavy attackers, three encounters, healing/score pickups and extraction.
  A/D or arrows move, W/S aim, Space jumps, J fires, K uses quick melee.
- **Ring // Zero:** flat XY arena movement, light/heavy melee, pursuit and
  long windups, interruptible light strikes, committed heavy attacks and
  three staged encounters. WASD/arrows move, J light, K heavy.

Both use exactly the same combat resolution. The stage, silhouettes, background,
parallax, attack trails, sparks, original music and effects are procedural.
Audio uses audio2d at 48 kHz and the existing bounded effect player (12 voices,
eight cached buffers); enabling sound requires a gesture. Pause stops voices.
Music/device presentation is not canonical simulation state.

Touch buttons use pointer capture and track pointer IDs. Pointer cancellation,
lost capture, pause, blur, hiding, restart and mode changes clear held actions
and pending taps. The existing gamepad neutral gate prevents held controls from
rearming after resume; disconnection pauses. The standard mapping uses the left
stick, A, the two triggers and Menu. Both triggers together cancel through the
existing flight adapter's signed trigger axis. No physical-controller test is
claimed. Canvas has no pointer-position aiming; touch uses semantic buttons,
so scaling/letterboxing never converts a screen coordinate into world state.

## Typed data packs

`mod-arcade.validateArcadePack(source)` accepts a native Mod SDK manifest object
or bounded JSON text. `ArcadePackSlot.replace(source)` validates the entire
candidate, registers/activates it in a fresh DataModRegistry, and replaces the
slot only after success. `slot.pack`, `slot.list()` expose accepted content/status.
The lab separately constructs the candidate simulation before replacing its
session. Rejected imports preserve active pack bytes, game and journal. Valid
pack/difficulty/mode changes explicitly start new runs.

The native envelope has `kind: qsol.vanillajs.mod-pack.v1`, canonical slug `id`,
exact `version`, empty `requires` and exactly four `kind:data` entries:

| Entry ID | Exact data fields |
| --- | --- |
| settings | kind, title, palette, music, rules |
| combat | kind, moves, actors |
| run / arena | kind, width, height, ground, spawn, exit, solids, platforms, encounters, pickups |

Each entry's `data.kind` is `qsol.vanillajs.arcade-action.v1`. Export either
original starter (Iron Meridian / Neon Shift) from the workshop for a complete
editable example. `packs.js` is the original starter authoring source.

- **Envelope:** 32 KiB UTF-8 before text parsing; native registry limits of
  depth eight, 512 visited nodes per entry and 128 members per object also apply.
  Unknown fields, getters, exotic/aliased/cyclic structures, functions, unsafe
  prototype keys, non-finite numbers and unsupported versions reject.
- **settings:** title 1–60 characters; palette exactly `sky,ink,accent,enemy,steel`
  as six-digit hex colours; music `forge` or `pulse`. Rules exactly
  `killScore,pickupScore` (0–10,000), `heal` (1–1000), and `easy,normal,hard`,
  each exactly `healthPercent,damagePercent` (25–300), applied to enemies. Scaled damage must remain
  within combat limits.
- **combat:** up to eight unique `{id,attack}` moves and five actor definitions.
  Each actor has exactly `id,health,speed,behaviour,light,heavy,hurtbox,projectile`.
  IDs are lowercase slugs up to 32 characters. A unique `player` is required.
  Health is 1–3000; speed 1–128. Behavior is `player,pursue,sentry,brute`;
  light/heavy reference existing moves. Projectile fields are
  `speed,damage,lifetime,radius,cooldown,knockback,stun,invulnerability`:
  speed 1–4096, damage 1–300, lifetime 1–600, radius 0–128, cooldown 2–240;
  remaining fields use combat effect bounds.
- **stage:** width 9600–60,000; height 5400–12,000; ground 0–1000.
  Spawn/exit are `{x,y}`. Exit X must be reachable within motion bounds; run completion also requires Y within 600 subunits of the gate. Actor spawns stay within motion bounds
  X 180…width−180, Y ground…height−600. At most 32 solids `{id,box}` with
  positive geometry inside the stage, 16 one-way platforms `{x1,x2,y}` (none
  in arena), six ordered encounters `{trigger,spawns}` each with 1–6
  `{actor,x,y}` enemy spawns, and 16 `{x,y}` pickups. Total enemies ≤36 per mode.
  Unknown definitions and spawns inside point-blocking solids reject.

This validation bounds work and admits data; it cannot prove that every authored
stage is fun or completable. Creators must play-test geometry, damage and reach.
There is no script evaluation, URL fetch, asset download or arbitrary plugin hook.

## Journals, snapshots and numerical identity

`world.js` provides pure `createArcadeGame`, `stepArcadeGame`, `arcadeSnapshot`.
`replay.js` provides `ArcadeSession`, `readArcadeReplay`, `readArcadeSnapshot`.
The pure game consumes one seven-bit word per accepted tick:
left=1, right=2, up=4, down=8, jump=16, primary=32, secondary=64. Opposing directions
cancel; every integer 0–127 is accepted. Jump uses a rising logical edge; attacks
may be held. Input sampling in real time is outside replay identity.

A replay has exactly `kind,engine,mode,difficulty,seed,pack,inputs`:
kind `qsol.vanillajs.arcade-replay.v1`, engine `arcade-foundation-001/1`, seed
uint32, and up to 36,000 input words. `pack` contains **all canonical accepted
manifest bytes**, including its actual ID and version, not a substituted default
or a weak checksum. Engine identity must be bumped for future semantic changes;
archive the consuming source commit with replays. The existing integer-math
`nextRandom` owns the explicit initialization stream.

Replay import is capped at 256 KiB, enough for the worst 36,000 three-digit
commands plus the escaped 32 KiB pack. A snapshot is capped at 512 KiB and has
exactly `{kind,replay,state}`, with kind `qsol.vanillajs.arcade-snapshot.v1`.
Import regenerates all state from the journal and compares canonical sorted-key
JSON, rejecting tampered state. It never installs untrusted raw combat worlds.
Inputs after terminal state, malformed words, unsupported versions and oversized
files reject. The 36,000th accepted tick ends an unfinished run with `limit`;
no further commands enter its journal. Capacity/validation errors publish neither
the candidate game nor a partial journal entry.

Same source, seed, accepted pack and journal produce exact canonical simulation
state within these bounded integer operations. Tested frame partitions run the
same logical ticks with the existing FixedClock. Catch-up dropping can change the
number of live ticks and input samples; replay records what was actually accepted.
No universal engine/runtime proof, identical rendered pixels, exact device audio
timing, fixed FPS, GPU result or network/rollback determinism is claimed.

## OPT scope and executed work comparison

The combat query retains a bounded full-scan `reference:true` path. The default
sorts endpoint hurtboxes by minimum X once per tick and rejects candidates whose
X intervals cannot intersect the query envelope. Exact predicates, ordering and
effects are unchanged. Worst-case dense contacts still require quadratic work
within the 64-actor bound; no large-population spatial index claim is made.

The 1200-tick/24-actor comparison produced **25,416 full-scan actor candidates
versus 3,237 retained candidates**, with identical full worlds and events every
tick. These are candidate counts, excluding sorting/setup, solid queries and
rendering; they are not elapsed-time speedup percentages.

`SceneryCache` retains one immutable scene keyed by all accepted pack bytes and
mode. Geometry, palette, version or mode changes invalidate it. Rendering never
feeds simulation. In a 600-frame source-identical workload, the cache builds
once and reuses 599 times versus 600 forced reference constructions; deep
outputs match. It is a bounded CPU construction count, not GPU evidence.

## Offline use, verification and CI

From the repository root:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8000/demos/arcade-combat-lab/index.html`.
Native modules need HTTP(S); this local server needs no internet. Keep the
complete package together. On localhost/HTTPS the existing service worker
installs the content-hashed package; wait for installation before offline reload.
The lab is linked from the root catalogue and Creator Hub. Build registration is
automatic through the existing allowlisted `modules/`, `demos/`, Markdown docs.

The packaged test is `scripts/browser-arcade-combat.js`, dispatched in the
existing `worlds` group of `scripts/browser-check.js`. Use preinstalled external
Playwright tooling (NODE_PATH), optionally PLAYWRIGHT_CHROMIUM_EXECUTABLE; it is
never a runtime dependency. Normal CI runs the existing external pinned tooling.
The historical browser reuse policy is a formal source pin and remains
byte-identical. The changed dispatcher and unknown new harness/runtime fail
closed to real Chromium; no new PASS witness is invented or auto-qualified.
Owner-only runners, manual full-browser override, formal assets, immutable
archives and historical tags are untouched.

Executed locally on 2026-11-15 UTC: Linux, Node v24.22.1, preinstalled
Playwright 1.57.0 and system Chromium 156.0.8078.79 with software rendering.
This differs from hosted CI's Node 22 / pinned Playwright tooling; hosted CI
results belong to the PR checks, not these local observations. No tooling was
installed and no physical owner runner was triggered.

| Executed command | Actual result |
| --- | --- |
| `node --test tests/*.test.js` | PASS: 925 tests, zero failures, including 24 new arcade tests |
| `node scripts/check.js` | PASS: 372 JavaScript files, 57 module contracts, two research experiments |
| `node scripts/build.js` | PASS: 539 allowlisted files and SHA-256 manifest |
| `node scripts/verify-offline.js` | PASS: all 539 packaged files verified |
| `node scripts/lab2d-evidence.js --check` | PASS: historical default-motion/PCM/ternary identity preserved |
| `node scripts/browser-check.js --suites=worlds` | PASS on final runtime: RTS, flow fields, 2D, new Arcade Combat Foundry, 4X and VOIDWARD |
| `node scripts/browser-check.js --suites=home,donor,editor` | PASS: all selected existing checks |

Browser commands used
`NODE_PATH=/opt/codex/cua_node/lib/node_modules` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. These are local tooling
locations, not requirements for a consuming game.

The initial full `node scripts/browser-check.js` invocation passed render,
play, worlds and research checks, then failed an unchanged Kinetic Foundry
pause assertion (`browser-optional-labs.js:37`, draw count 11 versus 10).
The home/donor/editor follow-up passed that assertion and every remaining
check without edits to existing assertions. This is a recorded failed full
attempt plus successful follow-up coverage, not a claim that one complete
invocation passed. The final worlds run followed the last arcade ledge fix.

[Local evidence](../evidence/ARCADE-FOUNDATION-001/source.json) records final
source hashes, commands, raw logs, the failed attempt and desktop/mobile
screenshots. It is ordinary development evidence, not a formal proof or a
qualified browser-reuse witness.

New Node coverage includes closed boundaries, 2000 independent existing-collision oracle
queries, fast thin contacts, stable ties, simultaneous attacks, deduplication,
stun/armour/recovery, bounded atomic failures, encounter progression, actual
ledge landing, unmodified starter-stage completion, elevated exit admission, pack rejection, replay/snapshot identity, all input words,
36,000 accepted ticks, cadence partitioning, PCM and reference-cache parity.
Browser coverage exercises public UI/imports, real damage and completion/defeat
fixtures in both modes, keyboard lifecycle, synthetic standard gamepad input,
native Chromium touch cancellation, audio voice cancellation, 320px layout and
offline reload. Browser fixtures use valid user-facing pack imports, never
hidden health setters or test-only simulation paths.

## Source provenance and licences

All new implementation, artwork, stage layouts and music are original under
Apache-2.0. Existing VANILLAJS code is imported, not copied into a competing
engine. The following donor revisions were selectively inspected; **no donor
code or assets were adapted/copied in this PR**.

| Reference | Exact inspected commit | Licence / inspected scope / influence |
| --- | --- | --- |
| ARCADE | `f29b780734a50171d55ae2f770930db8a487b31c` | Apache-2.0; arcade3/commando.js, knockout.js; bounded enemies, aim and readable windup/recovery |
| GAMES | `7e0a9019d07b491cffc9b698fa51acdb843c49cc` | MIT; CARTRIDGE_ZERO/docs/DESIGN.md, DETERMINISM.md; original arcade presentation and complete input-word receipts |
| Spooky | `0c13684a03e301e59ba5dd04c67167874ab04766` | Apache-2.0; docs/GAMEPLAY.md, ARCHITECTURE.md; distinct enemy pressure, cadence, pause-safe inputs |
| QUICKSCOPER | `8da5569b1ee7565d9ae5fb0588847d262c896648` | Apache-2.0; src/game.js traceShot and hitboxes; one victim per attack, cover-winning ties |
| Bullet-Time | `03d4af42107124b581e3404b2396f53cdca52016` | Apache-2.0; src/clock.js, lead.js; logical timing separate from rendering; no slow-time system imported |
| OPT | `6b39a60f89a0b98e18b05ea3cbf7029f857dc41c` | Apache-2.0; OPT-INV-001 and OPT-PRUNE-001; all-input cache identity and reference comparisons; no inherited speedup claim |
| SONIFICATION | `2ca65c6540d7051a77ed571b83f5a9df453094ec` | MPL-2.0; APP/js/audio.js, composition.js; reference PCM separated from device playback; no scientific mapping or code imported |

Apache-2.0 donor adaptation would require retained attribution/notices; MIT code
would require its copyright/permission notice. MPL-2.0 is file-level copyleft,
not permission to relabel copied files Apache-2.0. Since no donor code/assets
are copied, this PR introduces no such third-party files or licence obligations.
The existing repository LICENSE/NOTICE and historical donor attribution remain.

## Future Games2 integration contract

Games2 may later vendor a reviewed, pinned VANILLAJS dependency closure with its
licence/notice. It supplies its own integer poses and commands, consumes combat
events and renders with its own DOM/CSS/audio. For example, no lab import:

```js
import {createCombatWorld, stepCombat2D} from './vendor/vanillajs/modules/combat2d/index.js';
const body = (id, team, x) => ({id, team, x, y:0, faceX:1, faceY:0,
  health:100, hurtbox:{minX:-100,minY:0,maxX:100,maxY:500}});
let world = createCombatWorld({actors:[body(1,0,0),body(2,1,500)]});
const move = {windup:0,active:2,recovery:12,reach:600,halfWidth:250,
  offset:250,damage:20,knockback:64,stun:10,invulnerability:8,interruptible:true};
const result = stepCombat2D(world, {attacks:[{id:1,move}]});
world = result.world; // Commit only after the complete tick succeeds.
for (const event of result.events) {
  if (event.type === 'hit' && event.damage > 0) {
    // Consumer-owned effects, animation, score and sound.
    console.log(event.target, event.damage);
  }
}
```

The consuming game should use its own bounded encounter/input journal or adopt
the documented format with a distinct game identity. Copying lab fiction or
assuming stable experimental APIs is not required. Games2 remains unchanged.

## Deferred capabilities

No copyrighted remakes/assets/ROMs; full Mortal Kombat/Street Fighter systems;
network multiplayer/rollback; full 2.5D belt-scrolling/local co-op; voxel worlds;
crafting/survival progression; replacement 3D renderer; executable mods; cloud
accounts, telemetry or external runtime services. These remain later milestones.

Draft release notes: proposed **v2.2.0 — The Arcade Foundry** adds shared integer
2D combat, native typed arcade packs, two original playable compositions,
bounded replay/snapshot exchange and independently checked offline/browser
coverage. Release/tag/publication still requires separate owner authorization.
