# Build a game with VANILLAJS

Start from an exact release or commit, inspect `MODULES.json` and select only the
modules needed by the game. Keep all required dependencies and relative paths.
All 0.2.0 APIs are experimental; record the revision instead of silently tracking
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
