# Weapon Feel Foundry

The experimental `weapon-feel` module adds responsive aim, bounded input buffering,
ADS and cosmetic feedback around existing VANILLAJS weapon timers and combat.
It does not replace `weapons`, `character`, `combat3d` or the renderer.

Open [Weapon Feel Lab](../demos/weapon-feel-lab/index.html) through a local HTTP
server or the packaged site. The original **Signal House** range provides three
profiles: Lumen precision, Thread automatic and Anchor travelling bolt. These are
training instruments, not a complete FPS game or a new Block Arena pack format.

## Make your first weapon recipe

1. Select **Start range**. Aim at the moving coloured targets with the mouse
   (click the range for capture), arrow keys or a touch drag. Use **F** / **FIRE**
   to shoot. Hits and damage come from actual `Combat3D` events.
2. Try the three **Test** buttons or keys **1–3**. Lumen fires on fresh presses;
   Thread fires while held; Anchor launches a visible projectile that takes time
   to reach its target. **R** reloads; **WASD** moves; **Space** jumps.
3. Press **Q** or **Aim down sights**. Watch the FOV, sensitivity and spread
   diagnostics change. **Escape**, leaving the tab or losing focus pauses and
   cancels pending controls. Resume requires deliberate input.
4. Compare the three control columns. Increase **Cosmetic recoil** and decrease
   **Recoil recovery** to make the weapon kick sharply and settle quickly. Change
   **Base spread**, **Spread growth / shot** and **Spread recovery / s** to affect
   actual accuracy. Edit **ADS time**, FOV and the sensitivity multiplier to tune
   aiming. Editing pauses the range; **Validate & test changes** starts a fresh
   accepted session only after complete validation.
5. Disable **Moving targets** for controlled comparisons, then enable them again
   to test tracking. Optional **Return fire** makes a target shoot back through
   the same combat system. Damage can end the exercise; **Reset & start** restores
   the range. The tick budget is ten simulated minutes; reset for another run.
6. Inspect shot origin, canonical aim, actual shot direction, impact location,
   cooldown and switch lock. A large cosmetic kick must not move the combat ray.
   The centre crosshair marks the canonical aim; the ring conservatively bounds
   diagonal yaw/pitch spread around it using a √2 angular radius.
   A randomised shot can deviate within that spread. The model's barrel is visual:
   authoritative shots originate at the character eye, not the model's muzzle.
7. Choose **Export accepted recipe**. Reimport it or edit the JSON inspector and
   choose **Validate JSON**. Invalid JSON, unsupported versions, unknown fields,
   accessors, oversized data or invalid numeric values preserve the accepted
   recipe and simulation. Export always uses the last accepted recipe.

Sound is original procedural PCM through `audio2d` and the existing bounded effect
player. It is off initially and requires a user gesture; audio-device failure does
not prevent play. Small-screen controls support movement, firing, reload and drag
aim. No physical phone/controller compatibility is claimed by emulated checks.

## Public contract

Entry: [`modules/weapon-feel/index.js`](../modules/weapon-feel/index.js).
Dependencies: `combat3d` validation/weapon definitions and `math` quaternion/seeded
random utilities. Pure imports have no device, DOM, wall clock or GPU side effect.
All additions are experimental; existing APIs and pack schemas are unchanged.

| Export | Behaviour |
| --- | --- |
| `WEAPON_FEEL_FORMAT` | `qsol.vanillajs.weapon-feel.v1` |
| `WEAPON_FEEL_BYTES` | 16,384 UTF-8 bytes maximum for imported JSON |
| `validateWeaponFeel(objectOrJSON)` | Fully validates and returns an owned, recursively frozen recipe |
| `exportWeaponFeel(objectOrJSON)` | Validates and serialises an inspectable JSON recipe |
| `new WeaponFeel(recipe)` | Creates independently owned aim, seed, buffering and presentation state |

The recipe has exactly `format`, `version: 1`, a uint32 `seed` and one to three
unique `profiles`. A profile has `id`, plain-text `label`, an existing complete
`defineWeapon3D` definition in `weapon`, `view` and `handling`. Its ID must equal
the weapon ID. No URLs, scripts or executable expressions are admitted.

| Record | Fields and units |
| --- | --- |
| `weapon` | Existing `combat3d` fields. Here `spread` is canonical seeded yaw/pitch spread in radians; `recoil` is cosmetic viewmodel kick in radians. Other fields retain the combat contract. |
| `view` | `hipFov` (0.4–2 rad), `adsFov` (0.2 rad to hip FOV), `adsSeconds` (0.03–1 s), `sensitivity` (0.1–4), `adsSensitivity` (0.25–2), `recoilReturn` (0.03–2 s decay constant), `flashSeconds` (0–0.2 s), `effects` (boolean) |
| `handling` | `triggerBuffer` (0–0.25 s), `switchSeconds` (0.05–1 s), `spreadKick` (0–0.1 rad/confirmed shot), `spreadRecovery` (0.01–2 rad/s) |

`WeaponFeel` methods:

- `addLook(yawDelta, pitchDelta)` accepts finite relative radians within ±π per
  sample, applies the current sensitivity immediately, wraps yaw and clamps pitch.
  Call once per supplied input sample. It does not wait for a physics tick.
- `aim()` returns owned yaw, pitch, quaternion and the canonical −Z-forward ray.
  It is a nonmutating read. `setAim(yaw,pitch)` sets an explicit validated pose.
- `consumeLook()` returns accumulated applied deltas once and clears that diagnostic
  queue; do not apply them to `aim()` a second time. Render reads never drain it.
  The queue is bounded at ±1024 radians; normal producers drain each fixed tick.
- `setADS(boolean)` sets the next fixed-tick transition target. `presentation()`
  returns current FOV, ADS fraction, sensitivity, spread, switch/buffer state,
  viewmodel recoil, flash, hit/damage feedback and shot count.
- `trigger()` retains one fresh fire edge for the configured short window, even
  when a render frame advances zero physics ticks. `select(index)` clears that
  buffer and applies a switch lock. It never resets canonical weapon timers.
- `step({actor, origin, timer, held, reload})` advances exactly one **60 Hz** step
  and returns a complete command for `Combat3D.step`. Supply the selected weapon's
  actual `WeaponTimer.snapshot()` fields, without the enclosing ID. `held` permits
  automatic fire only; precision/projectile weapons require `trigger()` edges.
- `confirm({shot, hit, damage, reloading})` accepts an authoritative event summary
  after combat. It adds cosmetic kick/flash and bounded gameplay spread growth only
  for a confirmed shot. Never infer a hit from an animation or audio cue.
- `cancel()` clears pending look/trigger/ADS and transient hit/flash feedback at a
  lifecycle boundary. It leaves aim, canonical timers and existing recovery state
  intact. Pause the caller's clock and clear attached device state as well.
- `profile()` returns the selected immutable definition; `recipe()` returns an
  owned mutable copy suitable for drafting. Construct a validated replacement
  before replacing an accepted live instance.

## Compose a consuming game

See the runnable composition in
[`world.js`](../demos/weapon-feel-lab/world.js) and the browser lifecycle in
[`app.js`](../demos/weapon-feel-lab/app.js). A minimal command seam is:

```js
import {WeaponFeel, validateWeaponFeel} from './modules/weapon-feel/index.js';
import {Combat3D} from './modules/combat3d/index.js';

const recipe = validateWeaponFeel(localRecipeJSON);
const feel = new WeaponFeel(recipe);
const combat = new Combat3D({
  actors: [
    {id: 'player', team: 0, position: [0, 0, 0], health: 100, armour: 0},
    {id: 'target', team: 1, position: [0, 0, -10], health: 100, armour: 0}
  ],
  weapons: recipe.profiles.map(profile => profile.weapon)
});

// Feed an input delta once; render feel.aim() immediately, without a tick.
feel.addLook(-0.01, 0.002);
feel.trigger();

// Once per fixed 1/60 s tick, after committing your character/target poses:
const state = combat.snapshot().weapons.find(row => row.actor === 'player');
const {id, ...timer} = state.timers.find(row => row.id === feel.profile().id);
const command = feel.step({actor: 'player', origin: [0, 1.62, 0], timer});
const events = combat.step([command]);
const current = combat.snapshot().weapons.find(row => row.actor === 'player')
  .timers.find(row => row.id === feel.profile().id);
feel.confirm({
  shot: events.some(event => event.type === 'shot' && event.source === 'player'),
  hit: events.some(event => event.type === 'damage' && event.source === 'player'),
  damage: events.filter(event => event.type === 'damage' && event.target === 'player')
    .reduce((total, event) => total + event.amount, 0),
  reloading: current.reloadRemaining > 0
});
```

There is one canonical set of timers: `Combat3D` owns them and advances inactive
weapons too. The adapter checks those snapshots, keeps switches locked briefly and
never replenishes or resets timers during selection. Using an unrelated/stale
timer snapshot or issuing a player command for a dead actor violates the
composition contract. Pause or respawn before allowing further fire. Validate the whole game's
command batch before advancing systems; the adapter cannot roll back another
consumer's failed combat transaction.

The game owns input, character movement, world/target poses, damage policy, assets,
menus and the rendering loop. When pausing, also call `combat.cancelTriggers()` and
clear device state. Retain GPU resources and dispose them when removing the lab or
game surface. The sample uses the existing renderer's owned meshes and `dispose()`.

## Numerical and presentation boundaries

- World positions use metres in right-handed +Y-up/−Z-forward coordinates.
- Weapon, ADS and buffering policy advances at 60 Hz; imported parameters use
  seconds/radians. ADS sensitivity follows the tangent FOV ratio with the declared
  multiplier, so zoom and response remain coordinated.
- The seeded PRNG advances twice per eligible shot. Spread is a bounded square
  in yaw/pitch, not a physically simulated barrel cone. Bloom caps at 0.2 radians;
  ADS scales the total spread down to 30% at full aim.
- Viewmodel recoil never changes the camera orientation or canonical shot ray.
  This v1 contract deliberately has no gameplay recoil mode. A future mode needs
  its own explicit contract and tests, not a silent interpretation change.
- Identical recipe, seed and fixed tick inputs repeat within the same JavaScript
  runtime. Float64 trig/physics are approximate; no cross-browser bit identity or
  GPU pixel identity is promised. Live input event timing and dropped simulation
  debt remain application boundaries, not render-cadence invariance guarantees.
- Existing `combat3d` tick-start target poses, projectile and AABB limits apply.
  No full rigid-body gun simulation, network prediction or automatic game export
  is introduced.

## Verification and provenance

Run from the checkout root:

```sh
node --test tests/weapon-feel.test.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-check.js --suites=play
```

The Node cases exercise strict formats, ownership/rejection, immediate accumulated
look, zero-tick buffering, cooldown/switch/reload cancellation, ADS/ray alignment,
seeded spread, fixed-stream 30/60/144 Hz presentation, actual hits/projectile travel
and rejected replacement. Packaged Chromium checks exercise actual UI edits,
imports/exports, moving targets, movement/fire, capture, pause/reload, narrow touch,
graphics failures and a fresh controlled offline navigation. The shared startup
suite checks retained older service workers and failed-import recovery.

AFTER//ZERO was reviewed at immutable commit
`406a45927b819f7383f71649d261de675552ca9c` for useful input/aim/presentation behaviour.
This module, range, original profiles and audio were independently implemented;
no campaign code, renderer or assets were copied. See the
[donor audit](AFTER_ZERO_GAME_FEEL_AUDIT.md) and
[milestone verification record](SPRITE_FEEL_001.md) for exact file identities and
actual measured outcomes.

An exported recipe is inert data, not an executable game or engine bundle. A
future Games2 FPS can vendor the reviewed VANILLAJS release's dependency closure,
preserve its Apache-2.0 licence/notices, record immutable provenance and explicitly
adopt this sidecar in its own reviewed PR. No Games2 files are changed here.
