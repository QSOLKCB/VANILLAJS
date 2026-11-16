# Game Maker API

The experimental [Game Maker facade](../api/game-maker/index.js) gives a small
game an explicitly owned drawing surface, fixed-step clock, input snapshots,
local sprite/tile assets, procedural effects and sound playback. It composes the
existing native Canvas2D path, `time`, `input`, `sprite2d`, `tilemap`, `audio2d`
and the existing effect player. It is not another rendering engine or a global
game singleton.

The [Game Maker Lab](../demos/game-maker-lab/index.html) consumes the same public
API. Its playable game rules, authoring interface and browser lifecycle live in
the lab. The [tilemap reference](TILEMAP_API.md) describes grid authoring and swept
body collision independently of this browser adapter.

For a complete small code example, open
[Ember Relay](../demos/game-maker-lab/api-example.html) and inspect its
[single game source](../demos/game-maker-lab/api-example.js). It imports only
public API/modules, builds original sprites and a tilemap, moves/jumps against
actual tile collision, collects an ember, reaches a gate and restarts. Keyboard
input, pause/focus cancellation and disposal are explicit in the source; the
full lab supplies the richer authoring, touch and portable-export workflow.
To copy this example independently, retain these paths:

```text
my-game/
  LICENSE
  NOTICE
  api/                  # native API sources
  modules/              # native module sources
  demos/game-maker-lab/
    api-example.html
    api-example.js
```

Serve `my-game/` locally and open `/demos/game-maker-lab/api-example.html`.
Only the two example files are needed from `demos/`; remove or update their
documentation/lab links in your copy. You may relocate the files if you adjust
their relative imports together. No package install is needed. All example code,
pixel recipes and level content are original Apache-2.0 material.
This minimal example serves local files and does not install its own service
worker; use the lab's portable game export for verified cached offline navigation.

## Start with one owned surface

```js
import {createGameMaker} from './api/game-maker/index.js';

const game = createGameMaker({
  canvas: document.querySelector('canvas'),
  width: 640,
  height: 360,
  pixelsPerUnit: 32,
  step: 1 / 60,
  maxSteps: 8
});

game.setCamera({x: 10, y: 5.625, zoom: 1});
game.begin('#102430');
game.rect(1, 1, 2, 1, '#8fd3ae');
game.circle(5, 2, 0.5, '#f5be50');
game.line(1, 4, 6, 4, '#ffffff', 0.05);
game.text('Your first scene', 16, 16, {screen: true});
// When this instance leaves the application, call game.dispose().
```

Use local HTTP, for example `python3 -m http.server 8000`; native browser module
imports do not have a portable `file://` loading contract. Keep `api/`, `modules/`
and their relative paths together when copying the example. Preserve LICENSE,
NOTICE and asset licences. A later game should pin an immutable reviewed engine
release rather than silently import changing main-branch sources.

The constructor accepts only `canvas`, `width`, `height`, `pixelsPerUnit`, `step`,
`maxSteps` and optional `audioContext`. It begins paused. Surface dimensions are
1–2048 integer pixels, pixels per unit 1–256, fixed step 1/240–1 second and
catch-up budget 1–32 steps. The existing clock clamps a frame to 0.25 seconds and
reports dropped time. The application decides whether that is appropriate for
its game; this facade does not run a timer or infer elapsed wall time.

The caller owns the canvas and AudioContext. The facade owns its clocks, input
state, admitted asset copies, scratch atlas canvases, bounded particles and sound
voices/buffers. It creates no document listeners, animation loop, fetch request,
object URL or audio device. Two instances can coexist independently.

## Coordinates and drawing

World coordinates use +X right and +Y up. Rectangles and sprites are positioned
at their lower-left corner. The camera `{x,y,zoom}` is the world point at the
surface center; zoom is bounded to 0.125–8. Pixel rows grow downward, so the
facade explicitly converts world Y at the Canvas boundary. One tile is one world
unit, or **256 integer subunits** in `motion2d`, `combat2d` and `tilemap`.
Divide an authoritative body's coordinates by 256 when drawing it. Sprite source
pixel size does not change that physical unit.

| Operation | Contract |
| --- | --- |
| `begin(color = '#081526')` | Reset native transform/compositing, clear the surface and fill its background. |
| `setCamera({x = 0, y = 0, zoom = 1})` | Validate and replace this instance's camera; return a frozen copy. |
| `rect(x, y, width, height, color)` | Filled world rectangle. |
| `circle(x, y, radius, color)` | Filled world circle. |
| `line(x1, y1, x2, y2, color, width = 0.03)` | World-space line width. |
| `text(value, x, y, {color, size = 14, screen = false})` | Literal text, at most 1024 characters, local monospace font; size is 6–128 integer surface pixels. `screen` positions in top-left pixel coordinates. |
| `sprite(id, frame, x, y, {width = 1, height = 1, flipX = false})` | Upright nearest-neighbour atlas image in world coordinates. |
| `tilemap(id, {layer = null})` | Draw all visual layers in order, or one named layer; return the number of visible tiles drawn. |

Colors are `#RRGGBB` or `#RRGGBBAA`; CSS URLs, arbitrary fonts and HTML are not
accepted. `text()` calls native `fillText`, never HTML insertion. Drawing uses
native Canvas2D operations, not a custom graphics backend. Rendering does not
advance the game clock or collision state. The adapter checks numeric ranges;
it does not promise identical font rasterization or Canvas pixels across devices.

Call `begin` for a new frame. The application may avoid drawing when its state
and camera have not changed; the facade neither adds a hidden frame scheduler
nor claims universal rendering-performance gains.

## Admit local assets once

- `loadSprite(id, projectOrJSON)` validates existing Sprite Foundry v1 data and
  builds its atlas with `buildSpriteAtlas`. `spriteProject(id)` returns an owned
  data copy. IDs match `[a-z][a-z0-9-]{0,47}`.
- `loadTilemap(id, mapOrJSON)` validates `qsol.vanillajs.tilemap.v1`, including its
  embedded Sprite Foundry tileset. `tilemapData(id)` returns an owned copy.
  Each layer's cells reference frame indices; `-1` means empty. Rows grow down,
  and each layer's 0–1 parallax scales camera displacement. Collision is a separate
  grid; transparent pixels do not secretly become solid tiles.
- Each kind admits at most 16 assets. Replacing an existing ID validates and
  allocates first; failed import or atlas allocation retains the accepted asset.
  Successful replacement releases its previous scratch canvas. Returned data
  copies can be edited without mutating the active renderer.

Strings are parsed as bounded local JSON, never as URLs. There is no network
asset loader, code import from data, shader string or executable callback in an
asset. Existing Sprite Foundry palette/tileset editing operations remain the
source of truth; the facade does not change their format. Keep their licence
metadata with exported projects.

For simulation, create a `Tilemap` instance separately and use its `step`, `sweep`
and `camera` methods. It owns validated collision data without recloning it each
tick. Rendering retains its own admitted snapshot; replace both when accepting a
new level. The facade does not own game rules, pickups, win/lose state or collision.

## Supply input and elapsed time

```js
import {createBody2D} from './modules/motion2d/index.js';
import {Tilemap} from './modules/tilemap/index.js';

// level is locally admitted tilemap data; its spawn must have body clearance.
const world = new Tilemap(level);
const spawn = world.tileToWorld(level.spawns[0].column, level.spawns[0].row);
let body = createBody2D(spawn);
game.loadTilemap('level', level);
game.pause(false);

function suppliedFrame(seconds, keys) {
  game.setInput({left: keys.left, right: keys.right, jump: keys.jump});
  game.advance(seconds, (_dt, input) => {
    body = world.step(body, {x: input.x, jump: input.pressed.jump}).body;
    game.tickParticles();
  });
  game.setCamera({x: body.x / 256, y: body.y / 256});
  game.begin('#102430');
  game.tilemap('level');
  game.rect(body.x / 256 - 0.3125, body.y / 256 - 0.4375,
    0.625, 0.875, '#8fd3ae');
  game.drawParticles();
}
```

The app supplies the frame loop and keyboard/touch lifecycle; `suppliedFrame`
is an ordinary function, not automatically invoked. Existing `Actions` and
`attachKeyboard` can collect device input. When leaving the game, dispose the
keyboard adapter and cancel the app's pending frame before disposing the facade.

`setInput` accepts only optional boolean `left`, `right`, `up`, `down`, `jump`
and `action` fields; omitted fields mean false. `input()` returns a frozen,
non-consuming snapshot `{x, y, jump, action, held, pressed}`. Axes are −1/0/1;
`jump` and `action` are held values, while `pressed.jump` and `pressed.action`
are one-tick edges. A short press/release survives frames with zero simulation
steps. `advance(seconds, update)` supplies `(dt, input, tick)` and consumes edges
once on the first actual fixed tick; additional catch-up steps retain held values.

`pause(true)` stops the clock and sounds, clears held input and pending edges,
and requires a false/released sample for each action before it can rearm.
This prevents a held key from restarting movement after focus loss.
`pause(false)` resumes clock advancement, never audio or device input by itself.
Call pause on blur, hidden visibility and pagehide in the app. Do not feed OS
auto-repeat as a new press; the existing keyboard adapter already enforces that
rule. Neutral touch and keyboard snapshots release the interlock independently.

`advance` returns the existing clock's `{steps, alpha, dropped}` report. It rejects
reentrant advance and pauses on an update exception. It cannot roll back mutations
made by the application's own callback. `reset()` must be called outside that
callback; it pauses, resets ticks/camera/input/particles and retains admitted
assets and the supplied device. Game rules must reset their own state separately.

## Particles and sound

`emit({x,y,seed,count=12,color='#ffd27d',life=30,speed=0.1,
gravity=-0.005,size=0.05})` creates an original seeded burst. Seed is uint32,
count 1–64, life 1–240 ticks, speed 0–2 world units/tick, gravity −0.1–0.1
world units/tick² and size 0.001–1 world units. The pool retains the newest 256
particles; overflow discards oldest particles deterministically. Explicitly call
`tickParticles()` from a fixed update and `drawParticles()` from presentation.
Paused particle ticks do nothing. `particleSnapshot()` returns owned data.
These are cosmetic effects, never a physics or damage source. Their same-runtime
Float64 evolution depends on explicit seed and tick order, not render cadence.

`loadSound(id, {frames, events})` strictly validates local `audio2d` score fields
and creates an authentic sound object. Events require `id`, `channel`, `sample`,
`duration`, `frequency` and `wave`; optional fields are `gain` and `seed`.
Existing 48 kHz PCM, eight-second, four-lane and 128-event limits remain intact.
The underlying original synthesis is unchanged. No remote sound file is loaded.

The app creates/resumes an AudioContext in a user gesture, then explicitly calls
`setAudioContext(context)`. `playSound(id, {when,offset,pan,gain,loop})` delegates
to the existing bounded effect player, with at most 12 voices and 16 buffers.
Paused instances or missing/suspended devices produce no new voice. Invalid
options still reject without a device. `stopSounds()` cancels voices. Replacing a
device validates before disposing the old player; the caller still owns and closes
the actual context. If audio fails, the app can report it and continue playing.

## Disposal and verification boundaries

`dispose()` is idempotent. It pauses and releases voices, buffers, atlas canvases,
asset references, input and particles. It leaves the caller's canvas and audio
device owned by the caller. Operations after disposal reject; `snapshot()` remains
available for diagnostics with dimensions, camera, clock/paused state, asset and
particle counts, voice count and disposed state. There is no context to dispose
on behalf of another instance.

[Unit tests](../tests/game-maker.test.js) cover projection oracles, exact admitted
source pixels, tile row/parallax alignment, rollback, budgets, independent
instances, partial allocation cleanup, input edges/cancellation, 30/60/144 Hz
render-cadence equivalence and audio ownership. Packaged browser verification
exercises the consuming lab and portable export separately. Node mocks are not
claims about physical devices or GPU behavior. No new public signature or default
in an existing module is changed by this additive facade.
