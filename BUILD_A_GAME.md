# Build a game with VANILLAJS

Start from an exact release or commit, inspect `MODULES.json` and select only the
modules needed by the game. Keep all required dependencies and relative paths.
All 0.5.0 APIs are experimental; record the revision instead of silently tracking
`main`. Preserve LICENSE and NOTICE when distributing copied modules.

For example, a flight game vendors `math`, `collision`, `flight`, `time` and
`input`; it can use `render-webgl` or supply its own renderer. A physics-only test
does not need any browser adapter. No module imports from the demos.

## Minimal simulation

```js
import {createBody, flightConfig, snapshot, stepFlight} from './vendor/vanillajs/modules/flight/index.js';
import {FixedClock} from './vendor/vanillajs/modules/time/index.js';
import {Actions, attachKeyboard} from './vendor/vanillajs/modules/input/index.js';

const body = createBody({position: [0, 0, 10]});
const config = flightConfig({assisted: true});
const clock = new FixedClock();
const actions = new Actions();
const keyboard = attachKeyboard(window, actions, {enabled: () => !clock.paused});
const solids = []; // aabb(min,max) objects from your validated world
let previous = snapshot(body);
let last = null;

function frame(now) {
  const seconds = last === null ? 0 : (now-last)/1000;
  last = now;
  const command = actions.flight();
  const {alpha} = clock.advance(seconds, dt => {
    previous = snapshot(body);
    stepFlight(body, command, dt, config, solids);
  });
  // Render previous/current poses using alpha; the demo shows a WebGL example.
  requestAnimationFrame(frame);
}
function setPaused(paused) {
  clock.setPaused(paused);
  last = null; // never accumulate the hidden interval on resume
  keyboard.clear();
}
window.addEventListener('blur', () => setPaused(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
// Connect your explicit Resume button to setPaused(false).
requestAnimationFrame(frame);
```

Production games should also implement reset, teardown, controller disconnect,
touch cancellation and unsupported-renderer behaviour. The Flight Lab app is a
complete reference for those boundaries; its DOM layout is not a module contract.

## Record the dependency selection

Keep a small file in the consuming game, for example:

```json
{
  "repository": "https://github.com/QSOLKCB/VANILLAJS",
  "commit": "REPLACE_WITH_THE_EXACT_40_CHARACTER_COMMIT",
  "modules": ["math", "collision", "flight", "time", "input"],
  "localChanges": []
}
```

Copy complete module directories under `vendor/vanillajs/modules/`. Copy LICENSE
and NOTICE into `vendor/vanillajs/`. Pin a real commit when adopting; the example
is a template and is not a populated provenance record. A later bug fix belongs
upstream, with an explicit consuming-game update and its own tests.

## Recipe choices

- **Assisted tunnel:** set `assisted:true`; provide corridor collision boxes and
  ordered signals. The conduit uses 32 m/s² acceleration and a 27 m/s target speed.
- **Inertial arena:** set `assisted:false`; leave damping off except explicit
  braking. Open orbit uses 16 m/s² thrust and static obstacle boxes.
- **Different renderer:** consume pose snapshots only. Preserve the coordinate
  conventions or convert at the renderer boundary.
- **Bullet time:** pass a scale to `clock.advance`; keep UI timers independent.
- **Different ship mass:** fixed acceleration uses `stepFlight`; fixed force uses
  `integrateBody` and your own control law.

Before release, run module tests and game-level scenarios at different render
rates. Include input cancellation, pause, transitions, collisions and the actual
deployment subpath. Do not equate a headless simulation pass with graphics,
physical controller or device-performance validation.

## Add projectiles and conditional effects

Vendor `projectiles`, `collision`, `math` and `interactions`. Add `time` for a
fixed-step loop and whichever browser/flight adapters your game needs. The
Interaction Lab recipes are small complete consumers; their game data stays in
`demos/interaction-lab/recipes.js`. See [API contracts](docs/API.md) for validation,
event ordering and [recipe limits](docs/INTERACTION_LAB.md) for the examples.

```js
import {aabb} from './vendor/vanillajs/modules/collision/index.js';
import {ProjectileSystem} from './vendor/vanillajs/modules/projectiles/index.js';
import {createInteractionResolver} from './vendor/vanillajs/modules/interactions/index.js';

const shots = new ProjectileSystem({capacity:64});
const target = {kind:'drone',health:100};
const colliders = [{id:'drone',box:aabb([-2,-2,-22],[2,2,-20])}];
const rules = createInteractionResolver([{
  id:'pulse-hull',match:{source:'pulse',target:'drone'},
  requires:[{scope:'context',key:'shield',equals:false,
    code:'shield-active',message:'Open the shield first.'}],
  effects:[{type:'damage',amount:25}],
  reason:{code:'hit',message:'Pulse hit the hull.'}
}]);
shots.spawn({position:[0,0,0],velocity:[0,0,-100],data:{kind:'pulse'}});
const context = {shield:false};
function update(dt) {
  for (const event of shots.step(dt,colliders)) {
    if (event.type !== 'hit' || event.hit.id !== 'drone') continue;
    const result = rules.evaluate({source:event.data,target,context});
    for (const effect of result.effects) {
      if (effect.type === 'damage') target.health = Math.max(0,target.health-effect.amount);
    }
    // Display result.reasons, including blocked or resisted outcomes.
  }
}
// Invoke update from FixedClock.advance. Pausing the clock also pauses shots.
```

Include walls in the same collider query as targets so the nearest obstruction
wins. Explicitly ignore the shooter if its collider is included. Consume each
event once, retain the documented ordering, and choose when conditions are
sampled. If a dead target must reject further effects, add an `alive` requirement
as the complete Target practice recipe does. Keep cooldowns in simulation time.
On pause, clear the keyboard adapter, pointer states and queued fire commands;
do not recreate held firing from keyboard repeat events on resume.


## Build a grounded FPS

Vendor `character`, `collision`, `math`, `input` and `time`; add `weapons` and
optionally `projectiles`/`interactions`. The character's position is feet-centred,
not its eye or collision centre. Start on a valid floor and supply static boxes.

```js
import {createCharacter, characterConfig, lookCharacter, characterView,
  stepCharacter} from './vendor/vanillajs/modules/character/index.js';
import {WeaponTimer} from './vendor/vanillajs/modules/weapons/index.js';
import {Actions, attachKeyboard, attachMouseLook, fpsBindings}
  from './vendor/vanillajs/modules/input/index.js';

const character = createCharacter({position:[0,0,7]});
const config = characterConfig();
const weapon = new WeaponTimer({magazineSize:8, reserve:32});
const actions = new Actions();
const keys = attachKeyboard(window, actions, {bindings:fpsBindings,
  enabled:() => running});
const mouse = attachMouseLook(canvas, {enabled:() => running,
  onUnlock:() => setPaused(true)});
// Use the FixedClock/RAF lifecycle from the first example, replacing its update:
function update(dt) {
  const look = mouse.consume();
  lookCharacter(character, look); // deltas already in radians; no dt multiplier
  const previous = characterView(character);
  const fireEdge = actions.consume('fire'); // drain even when a button is held
  const events = weapon.step(dt, {
    fire:fireEdge || actions.value('fire') || look.pressed || look.primary,
    reload:actions.consume('reload'),
  });
  for (const event of events) if (event.type === 'shot') {
    // Cast a ray or spawn a bolt from previous.position / previous.orientation.
    // Query walls and targets together, then apply returned effects once.
  }
  stepCharacter(character, {
    move:[actions.axis('left','right'), actions.axis('forward','backward')],
    jump:actions.consume('jump'), sprint:!!actions.value('sprint'),
    crouch:!!actions.value('crouch'),
  }, dt, config, solids);
  // Interpolate previous and characterView(character) for presentation.
}
// setPaused must clear keys and mouse.release(), pause the clock and reset
// the RAF timestamp. Do not step the weapon while paused. Dispose adapters
// and renderer when your game tears down.
```

The snippet assumes the surrounding game's `canvas`, `running`, `solids` and
`setPaused` lifecycle. For a complete implementation, start with
`demos/fps-lab/app.js` and its six world recipes. For single-shot behaviour, omit
the held `actions.value('fire')` / `look.primary` terms and retain only edges.
Keep ammo/weapon timers separate from shot geometry and damage rules. Consult
[the contracts and limits](docs/FPS_LAB.md) before adapting steps or body sizes.


## Shoot at moving targets

Use `castMovingSegment` for a single swept query or `shots.stepMoving` for the
owned projectile system. Each collider supplies its **start box** and the full
tick's **displacement**, not its velocity or end box. Static walls omit motion.
Do not update target boxes first; shots and targets must share the same interval.

```js
const dt = 1/120;
const targetVelocity = [3,0,0];
const displacement = targetVelocity.map(v => v*dt);
const colliders = [
  {id:'wall', box:wallBox},
  {id:'plate', box:targetBox, displacement},
];
const events = shots.stepMoving(dt, colliders);
// Consume each returned hit once, then advance the target to its end pose.
targetBox = {
  min:targetBox.min.map((v,i) => v+displacement[i]),
  max:targetBox.max.map((v,i) => v+displacement[i]),
};
```

This snippet assumes your existing `shots`, `wallBox` and mutable `targetBox`.
The system clips target movement when a projectile's lifetime ends before the
tick ends. Instant hitscan still uses `raycast` against the current boxes; it
has no travel time to lead. Never use target displacement as ray travel time.
Translation is linear for each query: split at turns, teleports or discontinuities;
rotating/resizing colliders need another model. Tracking range's smooth paths
use straight segments between 120 Hz endpoints. Keep character movement on static
world geometry; these shot queries do not carry or push a character.


## Ride translating platforms

Use `stepCharacterPlatforms` instead of `stepCharacter` in a platform world.
Keep a stable id for every collider and include stationary walls and ceilings in
the same list. Supply start boxes and intended translation, then commit their
end boxes only if the rider update succeeds. This mode has no automatic stairs.

```js
import {stepCharacterPlatforms}
  from './vendor/vanillajs/modules/character/index.js';

function updatePlatformWorld(dt, input) {
  // Game-owned routes produce proposed translation; stationary walls use zero.
  const proposed = world.map(surface => ({
    id:surface.id, box:surface.box,
    displacement:plannedDisplacement(surface, dt),
  }));
  const result = stepCharacterPlatforms(character, input, dt, config, proposed);
  if (result.blocked) {
    // Body was not mutated. Stop the platforms and let the player move free.
    stepCharacterPlatforms(character, input, dt, config,
      proposed.map(c => ({...c, displacement:[0,0,0]})));
  } else {
    for (let i=0; i<world.length; i++) {
      const c=proposed[i];
      world[i].box = {
        min:c.box.min.map((v,j) => v+c.displacement[j]),
        max:c.box.max.map((v,j) => v+c.displacement[j]),
      };
    }
    // Advance route clocks only here, by accepted simulated time.
  }
}
```

The snippet assumes a game-owned `world`, `plannedDisplacement`, `character` and
`config`. Also handle a blocked stopped-world update, for example by pausing and
resetting to a validated spawn. Preserve start/end poses for interpolation and
moving-shot queries before committing geometry. The complete FPS recipe stages
platform/rider movement, resolves shots over the accepted world interval, then
commits platform end poses. Pause skips all simulation, including route clocks.

`character.velocity` is world m/s; support metadata is diagnostic and also carries
state for the next tick. Jump once from an input edge, and do not manually add
platform speed a second time. Multi-actor games must stage copies of all affected
riders and world state before committing any of them. Rotating/resizing platforms,
slopes, teleporting routes and reciprocal body dynamics need separate models.
