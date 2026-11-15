# FPS-FOUNDATION-001 — Block Arena Foundry

Experimental foundation for an original blocky FPS, built on reviewed main
`e2740d009c4547321c023b32e5fe020ebac07c3f` (PRs #93 and #94). Proposed release:
**VANILLAJS v2.3.0 — The FPS Foundry**. This PR does not publish that release.

Open [Block Arena Foundry](../demos/block-arena-lab/index.html) or follow
[Build Your First Blocky FPS](BUILD_YOUR_FIRST_BLOCKY_FPS.md). The older
[FPS movement lab](FPS_LAB.md) remains available with its six existing recipes.

## Ownership and composition

`combat3d` owns combatants, weapon timers, projectile motion, hit classification,
damage attribution and bounded events. `mod-fps` owns inert arena admission and
the existing Mod SDK registry lifecycle. Neither imports a demo, creates a
device, reads a clock, or evaluates user code.

The new lab composes existing `character`, `collision`, `WeaponTimer`,
`ProjectileSystem`, `navigation`, `input`, `FixedClock`, `render-webgl`,
`geometry`, `math`, `audio2d` and `api/audio/effects`. Its bot policy, match modes,
starter layouts, visuals, music and replay session remain demo-owned. Standard
gamepads use the existing `FlightGamepad` neutral gate and mapping; there is no
second gamepad calibration or input framework.

Games2 is read-only. No Strike Pixel directory, catalogue, donor list, README,
game content or release is changed. A future game owns its own `/strikepixel/`
directory, fiction, progression and saves. See the tutorial for the public API
seam. No purchases, currency, advertising, tracking, accounts or entitlements
are built into these facilities.

## Combat API and numerical boundary

`new Combat3D({actors,weapons,solids,friendlyFire=false,selfDamage=true})`:

- Actors: `{id,team,position,health,armour}`. IDs are unique lowercase slugs
  (1–32 characters); teams 0–15; feet positions in metres; initial health
  1–1000 and armour 0–1000. At most 16 actors. `addActor` admits a new unique ID.
- Solids: `{id,box:{min,max},material}`; at most 256 positive-volume AABBs,
  coordinates −256…256, material `stone` or `wood`. No actor/actor pushing.
- `setPoses([{id,position,height}])` validates the whole batch before changing
  any pose. Height is 1–2 m; stance follows the existing character controller.
- `step(commands)` advances one 1/60 s tick. Each actor has at most one command:
  `{actor,weapon,origin,direction,fire,reload}`. Positions are bounded; a finite
  nonzero direction is normalized. Unknown fields, IDs, accessors, duplicate
  commands and malformed arrays reject before timers or combat state change.
- Origins and poses are supplied by trusted game code. This is not a network
  anti-cheat boundary. The demo always shoots from its current character eye.
- `snapshot()` / `actor(id)` return detached data. `pickup(id,'ammo'|'health',n)`
  restores bounded resources (ammo reserve caps at 1000 per weapon).
- `respawn(id,position,stats=null)` accepts only a dead actor. Optional
  `{health,armour}` replaces its archetype limits; counters persist and ammo,
  trigger latch and timers reset. The demo places respawns at admitted spawns.
  `cancelTriggers()` clears logical trigger latches; the demo records this as
  the next accepted input's cancellation bit.

This is **Float64** metre-scale simulation, right-handed, +Y up and −Z forward.
It is not Q16.16 or cross-engine bit-exact physics. Existing character contact
and weapon timer numerical thresholds are retained. Replay checks never add a
tolerance to disguise a state difference.

The upright body region is 0.7 m wide/deep and extends from feet to height−0.4 m.
The head is 0.48 m wide/deep and occupies the top 0.4 m. For hitscan, nearest
distance wins, walls win exact ties, then actor ID, then head. One actor takes
one hit per hitscan shot even if multiple regions intersect. Range falloff is
linear from full damage to the weapon's `falloff` fraction at maximum range.
Head multiplier is applied after falloff. A wood solid consumes one penetration
unit regardless of thickness; each actor consumes one. Stone always stops a
shot. A friendly actor blocks shots even when friendly fire is disabled.

Projectiles reuse straight swept cubes (half-size 0.06 m). Lifetime equals
range/speed; geometry and actor boxes compete in the existing collision query.
Projectile ties follow that query's stable collider IDs, then impact time and
projectile ID. Actors are fixed at their published pose for this tick's shot
queries; no moving-target interpolation, lag compensation or rollback is claimed.
Projectiles exclude their owner's direct regions. Configured explosions apply
linear distance falloff from the impact to body centres, within a maximum 8 m
radius. A 2 mm outward face offset avoids occluding the explosion with the face
it just hit. Every affected actor requires an unobstructed segment to its centre;
wood also blocks splash. Explosions replace direct damage rather than stacking it.

Armour absorbs 60% of incoming damage until exhausted. Damage events include
source, target, weapon, shot serial, region, point and hit kind. Death records
the final damage source; enemy eliminations increment kills; other enemy sources
that damaged the victim in the preceding 600 ticks receive assists in ID order.
Self-damage and friendly-fire policies apply to direct and splash damage. All
eligible shots are captured before resolution, so simultaneous trades work.
Hitscan resolves in actor-ID order; projectile impacts follow afterward. This
ordering is explicit and stable, not a claim of continuous simultaneous physics.

Bounds are 16 actors, 256 solids, 64 live projectiles, 4096 events per tick,
36,000 ticks. The event budget exceeds the worst bounded explosion/death/assist
fanout. At projectile capacity a shot consumes its ammunition/cooldown and emits
`projectile-rejected`; it never allocates an extra projectile. Expired shots are
removed. Rendering keeps only 64 recent effects.

## Weapon Foundry

`defineWeapon3D` accepts exactly these fields:

| Field | Bound / meaning |
| --- | --- |
| id / archetype | slug / `precision`, `automatic`, `projectile` |
| damage / headMultiplier | 1–200 / 1–4 |
| range / falloff | 2–128 m / 0–1 final range fraction |
| spread / recoil | 0–0.2 / 0–0.15 radians |
| interval / reload | 0.05–3 / 0.1–5 seconds |
| magazine / reserve | 1–100 / 0–1000 integer rounds |
| speed / radius | 4–100 m/s / 0–8 m |
| penetration | 0–3 integer traversals; hitscan only |

Hitscan radius must be zero; projectile penetration must be zero. The combat
module owns timing and hit rules; the consumer applies seeded spread and recoil
to its actual aim. Block Arena does both in simulation, including bot dispersion.
Needle requires a fresh trigger, allows headshots and one penetration; Pulse
accepts sustained fire; Orb travels and explodes. Switching preserves each
weapon's ammunition, cooldown and reload progress. Background timers advance.
Scoped Needle narrows the renderer's field of view and mouse sensitivity; scope
does not move the crosshair away from the aim ray.

`WeaponTimer.addReserve(rounds,limit=10000)` is an additive API: safe integer
amount, nonnegative limit up to 1,000,000, returns rounds added without modifying
magazine or timers. Existing constructors, step and snapshot contracts are
unchanged. `Renderer.begin` adds optional `fov` (vertical radians, 0.2–2.5);
the prior default is unchanged.

## Inert FPS pack

The native `qsol.vanillajs.mod-pack.v1` envelope contains exactly six independent
data entries and no dependencies. `settings.kind` is
`qsol.vanillajs.fps-arena.v1`. `validateFPSPack` returns an owned immutable pack;
`FPSPackSlot.replace` stages validation, registry registration and activation
before publication. The demo constructs the candidate session before replacing
the current session, so an invalid import preserves both pack and run.

| Entry | Content and limits |
| --- | --- |
| settings | title 1–48 chars; even size 24–64 m; five RGB palette colours; match rules; three difficulties |
| geometry | ≤32 grid-aligned blocks and ≤4 stair ramps; coordinates at 0.25 m increments; maximum authored top 8 m |
| spawns | one player, 1–8 bot spawns, ≤8 health/ammo pickups; supported positions with full standing clearance; spawns ≥1.5 m apart |
| arsenal | exactly three unique weapons, one of each archetype |
| bots | 1–3 types: health 20–300, armour 0–100, speed 1–6 m/s, range 3–60 m, cadence 6–180 ticks, weapon and RGB colour |
| waves | 1–5 rosters, each 1–8 known bot types and no more entries than available bot spawns |

The 32 KiB UTF-8 cap is checked before parsing. Native Mod SDK limits also
apply: 512 data nodes per entry, depth eight, no cycles/shared references,
getters, functions, prototype keys, non-finite numbers or unknown properties.
Combined geometry can therefore reach the node budget before every individual
array limit at once. Exported JSON is data, not executable code or remote URLs.

Each block has `id,x,y,z,w,h,d,material,color`; X/Y/Z are its lower corner.
Ramps replace `material` with `direction` (±1 along Z); they compile to 0.25 m
steps with depth at least twice their rise. `compileFPSArena` returns the exact
same boxes used by collision and rendering, including floor and visible walls.
The map editor adds/removes cover, relocates spawns and places pickups. Advanced
JSON edits all admitted geometry, rules, palette, bots and waves. Validation
checks bounds and clearance, not reachability, balance or guaranteed completion.
Bot routing is conservative ground-plane X/Z navigation; elevated platforms are
available to the player, not a general multi-level bot navigation mesh.

## Match, bots and controls

Skirmish starts up to four bots, respawns combatants, and ends at the score limit
or logical time limit. Survival has finite escalating rosters, pauses between
waves, no player respawn and finite pickups. Death is defeat; clearing the final
wave is victory; running out of match time is defeat. Both original arenas share
these rules. The roster retains stable bot IDs across wave respawns.

Bots idle/patrol, acquire visible enemies, wait a difficulty-defined reaction
interval, pursue last-seen positions, strafe at their archetype's combat range,
and seek occluding cover when hurt. Last-seen memory expires after 180 ticks.
Routes use existing four-neighbour A*, at most 256 expanded cells per search,
staggered on a 12-tick schedule with at least 60 ticks between each bot's searches.
Cover selection considers at most 32 nearby candidates per bot every 60 ticks;
hurt bots alternate cover and peeking windows. Work counters expose both route
expansion and cover ray queries.
All movement uses `stepCharacter`, and all shots use the same combat collision
as the player. Bots do not apply random damage directly through walls.

Keyboard/mouse, relative-drag aiming, touch buttons and standard gamepad input
converge to one command per logical tick. Mouse deltas use CSS pixels, consumed
once; pointer-lock unlock pauses. Blur, hidden tabs, reset, pause, touch cancel
and gamepad disconnect clear held/pending input and drop clock debt. Resume
requires a neutral gamepad. Sensitivity/inversion affect accepted aim commands,
so replay does not depend on the later browser settings. Fullscreen is optional.

## Replay and source identity

`FPSSession` and `ArenaWorld` are demo recipes, not stable public engine APIs.
A complete input is `[moveX,moveZ,yaw,pitch,bits,weapon]`: movement −1000…1000,
relative aim −3141593…3141593 microradians, weapon 0…2. Bits are fire=1,
reload=2, jump=4, crouch=8, sprint=16, scope=32 and cancellation=64.
All accepted channels are recorded for up to 36,000 ticks. The 8 MiB replay
budget exceeds the maximum complete journal, accepted pack and bounded state.
Inputs after terminal state reject. Nothing silently truncates the recording.

The replay includes kind/version, canonical accepted pack bytes (with its ID and
version), seed, mode, difficulty, complete journal, final state and a SHA-256
identity of the entire simulation/replay dependency closure. The generated
`identity.js` excludes only itself. Build/check reject stale identities. After
intentional simulation changes, run `node scripts/fps-source-identity.mjs --write`
and review the new identity with the source changes.

`verifyFPSReplay` reruns every command in the same source runtime, compares
canonical final state exactly, and returns `{source,ticks,complete,match,scope}`
verification results. The UI verifies before export, records that executed verification result in the
file, and reports import results;
it does not trust a claimed PASS from the file. Verification leaves the current
game intact. Different JS runtimes can differ in floating-point results; a
mismatch rejects and is not repaired with an arbitrary tolerance. This is a
logical replay, not video, physical device timing, network play or save-state
injection. Rendering frequency cannot advance or randomize the simulation.

## Packaging and measured work

PR #94's native dependency snapshot mechanism now includes Block Arena's
root-level startup. Every transitive JS byte contributes to the `runtime-<sha256>`
entry URL. Existing Pursuit, Skyguard and Arcade paths remain supported. Controls
are disabled while loading; failed imports expose a working Reload lab button.
The older verified worker regression retains incompatible pre-Foundry audio2d
bytes while starting both new modes. A separate test blocks and retries app
import. Fresh, installed-worker offline and no-external-request checks run in
packaged Chromium. No cache deletion or forced worker activation is introduced.

Static blocks and original procedural floor tiles are batched once per accepted
pack through `boxMeshBatch`; independent legacy `boxVertices` concatenation must
produce byte-identical Float32 input. Three GPU buffers are retained per scene
(static, dynamic, lines); dynamic updates reuse existing buffers. HUD changes
are gated to six ticks, with immediate lifecycle updates. Simulation never
depends on renderer work. The HUD exposes actual static upload, box, path and
expanded-cell counts. No fixed frame rate, allocation-free claim or fabricated
speedup is made. See the PR and ordinary development evidence for executed
counts and timings.

## Verification and limits

Run `node --test tests/*.test.js`, `node scripts/check.js`,
`node scripts/build.js`, `node scripts/verify-offline.js`, and the applicable
packaged browser suites. `scripts/browser-block-arena.js` is dispatched in
`worlds`. New shared/unknown dependencies fail closed to real browser execution;
the frozen source-bound reuse policy is unchanged. No personal runner, paid API,
new infrastructure or Playwright installation is requested.

The browser tests use actual controls/imports and read-only observations. They
exercise completion and defeat for both modes with admitted test packs, plus
the original layouts, movement, projectiles, pointer lock, touch, gamepad,
authoring, replay, failed imports and offline startup. Software Chromium and
emulated controllers/touch do not establish physical-device coverage. Original
starter balance still benefits from owner playtesting.

Deferred: network multiplayer, rollback, continuous slopes, capsule physics,
actor pushing, destructible terrain, chunk streaming, multi-level bot navmeshes,
arbitrary mesh collision, scripting mods and a finished Strike Pixel game.
The Visual Workbench exporter continues to package its existing scene preview;
this PR does not claim it compiles arbitrary FPS games.

See [donor review](FPS_DONOR_REVIEW.md) and [draft release notes](FPS_2_3_0_DRAFT.md).
