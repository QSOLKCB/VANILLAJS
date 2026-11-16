# Tilemap — bounded 2D worlds

`modules/tilemap/index.js` is an experimental pure module for authored tile grids,
camera-follow coordinates and swept body motion. It depends on `sprite2d` for
validated local art and `motion2d` for existing integer motor laws. It owns no
rendering surface, device, clock, audio or game-specific rules.

Use [Game Maker Lab](../demos/game-maker-lab/index.html) to paint a map and play it.
The module can also be imported into an independently owned game:

```js
import {Tilemap, parseTilemap} from '../modules/tilemap/index.js';
import {createBody2D} from '../modules/motion2d/index.js';

// `text` is a local JSON file read by the application's explicit file picker.
const world = new Tilemap(parseTilemap(text));
const start = world.tileToWorld(2, 3);
let player = createBody2D(start);

// Call once per fixed game tick; supply a snapshot of the intended actions.
function tick(input) {
  player = world.step(player, {x: input.x, jump: input.jump}, {
    profile: 'platform', halfWidth: 80, halfHeight: 112,
    motor: {speed: 24, acceleration: 6, drag: 6,
      jumpSpeed: 72, gravity: 4, fallSpeed: 80}
  }).body;
}
```

The game must choose a clear start cell, own its input/clock lifecycle and decide
what trigger tags mean. A map's trigger cannot execute code or load a module.

## Versioned format

The strict envelope is `qsol.vanillajs.tilemap.v1`, `version: 1`:

```text
{
  format, version, name, width, height,
  tileset: <validated qsol.vanillajs.sprite.v1 project>,
  layers: [{id, name, parallax, cells: [...]}],
  collision: [...],
  spawns: [{id, column, row}],
  triggers: [{id, column, row, tag}],
  camera: {follow, deadZoneX, deadZoneY}
}
```

| Field | Contract |
| --- | --- |
| `width`, `height` | Integer 1–64; at most 4,096 cells |
| `name` | 1–80 characters, no control characters |
| `tileset` | Existing Sprite Foundry format, including its licence, palette and 1–16 ordered frames; its existing 256 KiB export limit is preserved |
| `layers` | 1–4 uniquely named IDs; names 1–48 characters; `parallax` finite 0–1 |
| `cells` | Dense array of exactly `width * height` integers; `-1` is empty, otherwise a valid tileset frame index |
| `collision` | Separate dense array of the same length; `0` empty, `1` solid |
| `spawns` | 0–32 markers in in-bounds, non-solid cells |
| `triggers` | 0–128 markers in in-bounds, non-solid cells; `tag` is an inert application-owned identifier |
| Marker IDs | Unique across spawns and triggers; each kind also has unique cell positions |
| Identifiers/tags | Lowercase initial letter, then lowercase letters, digits or hyphens; at most 48 characters |
| `camera` | Boolean `follow`; integer `deadZoneX`/`deadZoneY` 0–4,096 subunits |
| Complete JSON | At most 512 KiB UTF-8, including imported whitespace |

Each tileset frame is one tile in the virtual atlas, not an automatically advancing
animation. Frame order is significant. Tile pixel size comes from
`tileset.recipe.size` (8, 16, 32 or 64); it does not change collision units.
The drawing adapter may pack these frames with `buildSpriteAtlas`. Layer parallax
affects presentation only; collision always uses the authoritative grid. Transparent
art, solid collision and trigger semantics are deliberately separate.

Unknown fields, executable accessors, unsupported prototypes, sparse/subclassed
arrays, duplicate IDs, invalid atlas references and out-of-range values are
rejected. Admission creates an owned copy. It never repairs malformed data by
silently changing cells or dropping fields. An empty authored world may have no
spawns/triggers; a particular game adds its own required-player/exit rules.

## Public operations

| Operation | Result |
| --- | --- |
| `createTilemap({width=24,height=14,name='Untitled map',tileset})` | New admitted map with one empty `ground` layer, empty collision/markers and enabled camera follow |
| `validateTilemap(value)` | Validate object and return an owned copy |
| `parseTilemap(text)` | Enforce UTF-8 byte limit, parse inert JSON and validate |
| `serializeTilemap(value)` | Validate and produce bounded canonical-order JSON with a trailing newline |
| `tileBounds(map)` | `{minX:0,minY:0,maxX:width*256,maxY:height*256}` |
| `tileToWorld(map,column,row)` | Cell center `{x,y}` in integer subunits |
| `worldToTile(map,x,y)` | Containing `{column,row}`; reject coordinates outside the half-open world |
| `sweepTileBody(map,body,{x:dx,y:dy},shape={})` | `{body,hitX,hitY}` after axis-separated swept collision |
| `stepTileBody(map,body,controls={},options={})` | Apply one existing `motion2d` motor tick, then sweep the complete body |
| `cameraFollow(map,target,viewport,previous=target)` | Clamped camera center `{x,y}`, with optional follow deadzones |

Standalone functions admit their map argument each time. For a running game use
`new Tilemap(map)`, which retains a private validated copy. Its methods are
`snapshot()`, transactional `replace(map)`, `bounds()`, `tileToWorld(column,row)`,
`worldToTile(x,y)`, `sweep(body,delta,shape)`, `step(body,controls,options)` and
`camera(target,viewport,previous=target)`. `snapshot()` returns a fresh copy;
failed `replace()` leaves the accepted world unchanged. There are no device
resources to dispose in this pure object; the rendering facade owns those.

## Coordinates and collision

One tile equals one game unit, **256 integer subunits**, matching
`MOTION2D_SCALE`. World origin is bottom-left, +X right and +Y up. Authored arrays
are row-major with row zero at the top. For a cell `(column,row)`:

```text
center.x = column * 256 + 128
center.y = (height - row) * 256 - 128
```

World occupancy is `[0,width*256) × [0,height*256)`. Rectangle intervals are also
half-open: touching faces are permitted; positive-area overlap is blocked. A body
is centered on its `motion2d` position, with integer `halfWidth` and `halfHeight`
from 1–128 (defaults 80 and 112). An initial body outside the map or overlapping
a solid tile is rejected before motion. The four world boundaries are solid.

Sweeps resolve **X, then Y**. Every crossed tile face along each axis participates,
so a fast body cannot skip a one-tile wall merely because its endpoint lies beyond
the wall. A displacement may be up to 16,384 subunits per axis. Exact endpoint
contact clears the impacted velocity too. `hitX`/`hitY` are contact normals:
`+1` for a left wall/floor, `-1` for a right wall/ceiling, and `0` if that axis did
not collide. The body is grounded only when one subunit downward would overlap
support; walking off a ledge clears the flag.

`step` accepts existing `motion2d` controls (`x`, `y`, `steer`, `throttle`, `jump`,
`impulseX`, `impulseY`) and profiles (`platform`, `rts`, `shmup`, `car`). The
default profile is `platform`; motor settings are the existing optional integer
speed/acceleration/drag/jumpSpeed/gravity/fallSpeed contract, bounded 1–512. The
adapter obtains that module's proposed motor motion in unobstructed space and
then resolves the full body against tiles. Existing `stepBody2D` remains unchanged.

This is a bounded static axis-separated box model, not a continuous diagonal
rigid-body solver. It has no slopes, rotated bodies, one-way platforms, moving
platforms, impulses between bodies or tile destruction. Axis order can affect
corner trajectories. Reference tests compare it to an independent one-subunit
rectangle-intersection oracle. Integer source motion is separate from Canvas/GPU
pixel output and is not an extension of the repository's formal arithmetic proofs.

For `combat2d`, use the same integer +Y-up coordinates and centered bounds; convert
to its chosen hurtbox shape explicitly. The tile module does not automatically
resolve attacks or convert them into collisions. Game rules own collection,
damage, exits and spawn selection. World boundaries are solid, so a game that
uses losing pits must author an explicit hazard or separately reviewed rule.

## Camera and rendering seam

Camera target/previous are exact `{x,y}` records in integer subunits; viewport is
`{width,height}` in integer subunits. Pass position fields rather than a full body
record. Enabled follow moves only enough to bring the target back within the
configured deadzone, then clamps the center to the world. Disabled follow retains
and clamps the previous center. A viewport wider/taller than the world centers
that axis on the map. Camera output never feeds back into body simulation.

For ordinary game-unit drawing, divide subunits by 256. The lower-left drawing
position of an authored tile is `(column,height-row-1)`. Sprite pixel rows remain
top-down; the adapter draws them upright. Parallax is applied only by the view.

## Verification

```sh
node --test tests/tilemap.test.js
```

Tests include strict format/asset/marker limits and ownership, exact coordinate
boundaries, thin-wall/high-speed controls, floor/ceiling contacts, independent
sweep reference cases, existing motor parity, jump/support/walkoff, grouped fixed
ticks, camera limits and rejected replacement. The milestone's full repository
and packaged-browser checks verify the consuming Game Maker workflow separately.
