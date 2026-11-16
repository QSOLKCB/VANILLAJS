# Sprite Foundry — make original pixels

**SPRITE-FEEL-001 · experimental v2.6.0 candidate.** Open the
[Sprite Foundry](../demos/sprite-foundry/index.html) from the
[Creator Hub](../demos/creator-hub/index.html), served over HTTP.
The existing published v2.5.0 release does not contain this module.

Generate a character, draw a change, animate it and keep reusable source art.
Everything runs locally. Seven original bounded algorithms create characters,
enemies, weapons, items, terrain decorations, particles and impacts. They do not
use AI image models, downloaded art or an external engine.

## Your first animated sprite

1. Load **Relay Cadet**. This original example contains four 16 × 16 frames.
   Other example packs demonstrate every generator, including Moss Guardian,
   Signal Tool and Garden Edge.
2. Change **Seed** to `42` and choose **Generate sprite**. The same validated
   recipe and implementation version reproduce the same source pixel arrays.
   Generation replaces frames; **Undo** restores the previous accepted project.
3. Select a palette swatch and use **Pencil** to add a pixel. **Erase** paints
   transparent index zero. **Fill** changes connected pixels of the same index.
   Dragging paints continuous strokes. A cancelled gesture rolls back that stroke.
4. Choose **Duplicate**, then edit the new frame. It owns its pixels independently.
   Change its duration, or use **Earlier / Later** to reorder frames.
   **Onion skin** overlays the previous frame for drawing; it is not exported.
5. Choose **Play animation**. The preview follows authored frame durations.
   Blur, hidden tabs and navigation pause playback. Press Play again deliberately.
6. Apply a palette variation or edit a swatch's colour and alpha. Index zero stays
   transparent black. A palette change recolours existing indexed pixels without
   changing frame order or shape.
7. Apply your sprite's name and declared licence, then **Save editable project**.
   Open the saved project to continue editing; a rejected import preserves the
   complete accepted sprite and history.
8. Export **Frame PNG**, **Sheet PNG** and **Atlas + collision masks** as needed.
   The UI sheet uses four columns and one transparent padding pixel on each edge.
   Keep the matching atlas and editable project with the PNG.

All inputs are bounded. A size must be 8, 16, 32 or 64 pixels square; seeds are
integers from 0 to 4,294,967,295; there are 1–16 frames, 2–16 palette entries and
40–2,000 milliseconds per frame. Imports are at most 256 KiB. Unknown fields,
unsupported versions, bad palette indices, malformed or oversized data fail
before replacement. Imported data is never evaluated as HTML or JavaScript.

Keyboard users can tab to the pixel canvas, move the cursor with arrow keys and
paint with Space. Palette, tools, timing and frame controls are native buttons
and inputs. Pointer and touch strokes use the same transaction. **Load example**
restarts from an original pack; Undo can restore your prior accepted work.
History retains the last 20 editing transactions in memory. Download your work
before closing the page: the tool does not silently persist it or use cloud storage.

## What each export contains

| Export | Contents and intended use |
| --- | --- |
| `*.sprite.json` | Validated editable palette, generator recipe, authored indexed frames, durations, name, declared licence and implementation version |
| `*-frame-N.png` | Selected RGBA frame at original dimensions, without zoom, grid, cursor or onion skin |
| `*-sheet.png` | Ordered RGBA frames in the same layout as the atlas export |
| `*-atlas.json` | Versioned frame rectangles, timing, alpha masks, tight occupied bounds, layout, name and declared licence |
| `*-workbench-opaque.png` | Selected frame explicitly flattened over your chosen background, at its original size, for the current Asset Foundry |

The JSON sprite project is a **validated sidecar**, independent of existing
Workbench scene/project schemas. No scene migration or renderer replacement is
required. These exports are art and metadata, not a game or executable project.
Movement, physics, scoring, menus and other rules remain game-owned.

Keep the project/atlas sidecars for the declared licence: PNG export does not
embed a complete licence or provenance record. Original bundled examples declare
Apache-2.0. When distributing engine code, retain its LICENSE, NOTICE and SPDX
headers; record your chosen immutable engine revision and asset provenance.

## Asset Foundry compatibility

The current [Visual Workbench](../demos/editor/index.html) accepts **opaque**
canonical textures no larger than 64 × 64. It intentionally rejects alpha
textures. Sprite Foundry keeps transparent source pixels intact and offers an
explicit compatible bridge:

1. Select a sprite frame and expand **Send to Asset Foundry**.
2. Choose a background and download **Opaque Workbench PNG**.
3. Open Visual Workbench, choose the matching asset licence and use the Asset
   Foundry's **PNG** import.
4. Select the imported texture, create a material and attach that material to an
   appropriate scene object using the existing Workbench controls.

The flattened PNG is a texture, not an animated sprite renderer. Importing it
does not teach the Workbench new transparent/animated scene semantics. Preserve
the `.sprite.json` sidecar for transparent 2D consumers and later editing.
The browser verification actually exports this PNG and imports it into Workbench.

## Public module contract

Entry: [`modules/sprite2d/index.js`](../modules/sprite2d/index.js).
It is pure native JavaScript with **no module dependencies**, DOM, GPU, ambient
clock, device resources or unseeded randomness. Each operation returns owned data;
callers explicitly adopt an accepted result. Existing engine APIs are unchanged.

| Export | Contract |
| --- | --- |
| `SPRITE_FORMAT`, `SPRITE_IMPLEMENTATION`, `SPRITE_MAX_BYTES`, `SPRITE_SIZES`, `SPRITE_KINDS` | Public format/version/budget constants |
| `validateSpriteRecipe(recipe)` | Exact fields: `kind,size,seed,symmetry,frameCount,palette`; returns an owned validated recipe |
| `generateSprite(recipe,{name,license})` | Original seeded indexed frames, each initially 120 ms; names/licences have documented bounds |
| `validateSpriteProject(project)` | Exact versioned project admission and owned copy; rejects getters, custom array prototypes, sparse arrays and unknown keys |
| `parseSpriteProject(text)` / `serializeSpriteProject(project)` | Bounded inert JSON import/export; returns/serialises canonical property order |
| `rgbaFrame(project,index=0)` | Owned row-major `Uint8Array`, four bytes R,G,B,A per pixel |
| `paintSpritePixel(project,frame,x,y,index)` | Replace one palette index; coordinates must be in bounds |
| `fillSpritePixels(project,frame,x,y,index)` | Bounded four-neighbour flood fill, without wrapping rows |
| `setSpritePalette(project,colors)` | Recolour while preserving indices; cannot remove a referenced palette entry |
| `duplicateSpriteFrame(project,index)` / `removeSpriteFrame(project,index)` | Independent clone after selected frame / remove, maintaining the 1–16 budget |
| `moveSpriteFrame(project,from,to)` / `setSpriteDuration(project,index,ms)` | Reorder frames / set bounded authored timing |
| `spriteFrameAt(project,elapsedMs)` | Select looping frame for supplied nonnegative safe-integer milliseconds; no clock is read |
| `buildSpriteAtlas(project,{columns=4,padding=1,alphaThreshold=128})` | Owned `{rgba,metadata}`; 1–16 columns, 0–8 padding, 1–255 mask threshold; maximum 1024 pixels per side |

Project envelope:

```js
{
  format: 'qsol.vanillajs.sprite.v1',
  implementationVersion: 1,
  name: 'Relay Cadet',
  license: 'Apache-2.0',
  recipe: {kind, size, seed, symmetry, frameCount, palette},
  frames: [{durationMs, pixels: [/* row-major palette indices */]}]
}
```

Palette entries are four integer bytes. Index zero is `[0,0,0,0]`; all other
entries can use alpha 0–255. Accepted licence labels are `Apache-2.0`,
`CC0-1.0`, `CC-BY-4.0` and `OWNER-LOCAL-ONLY`. A label is a declaration by
the creator, not an automatic rights audit. Frame editing keeps the original
recipe as the starting point; **regeneration recreates generated art, not later
hand edits**. The authored frame arrays are the accepted source of edited pixels.

Atlas `qsol.vanillajs.sprite-atlas.v1` stores each frame's zero-based index,
rectangle, duration, row-major 0/1 mask and tight local bounds. Empty masks have
`bounds:null`. Frames preserve timeline order; no rotation, trimming or heuristic
packing occurs. Masks use `alpha >= alphaThreshold` and describe source pixels,
not physics contacts or a character controller.

## Use the exported sprite in a game

Vendor the reviewed module and required licence files at an immutable revision,
then load your local asset. This example uses the actual public API:

```js
import {parseSpriteProject, rgbaFrame, spriteFrameAt}
  from './vendor/vanillajs/modules/sprite2d/index.js';

const sprite = parseSpriteProject(await (await fetch('./cadet.sprite.json')).text());
const pixels = document.createElement('canvas');
pixels.width = pixels.height = sprite.recipe.size;
const source = pixels.getContext('2d');
const screen = document.querySelector('canvas').getContext('2d');

// elapsedMs is supplied by your game's own paused/fixed-step timeline.
function drawSprite(elapsedMs, x, y) {
  const index = spriteFrameAt(sprite, elapsedMs);
  source.putImageData(new ImageData(
    new Uint8ClampedArray(rgbaFrame(sprite, index)),
    sprite.recipe.size, sprite.recipe.size), 0, 0);
  screen.imageSmoothingEnabled = false;
  screen.drawImage(pixels, x, y, 64, 64);
}
```

A production consumer can cache converted frame surfaces rather than converting
unchanged pixels every draw. The consumer owns and releases these surfaces; the
module allocates no GPU resources and starts no loops or listeners.

Sprite coordinates are integer pixels, origin **top-left, +X right, +Y down**.
Choose explicit pixels-per-world-unit and origin offsets before adapting masks
to `motion2d` or `combat2d`; do not equate pixels with metres or integer combat
subunits. A mask is useful for authoring diagnostics or game-owned overlap checks,
but is not a new collision backend.

## Determinism, verification and limits

Implementation version 1 fixes the integer LCG, traversal order and generation
rules. The same validated recipe/version yields identical indexed frames and
source RGBA arrays. The test suite includes an explicit 8 × 8 pixel oracle and
the RGBA SHA-256 `8d40a512493e0c4d88af8326ef4d3d0e18de7edefda317fc6b26c0f30b4da349`
for its documented test fixture, plus every algorithm and supported size.

**PNG bytes are not the source identity.** Canvas encoders can produce different
PNG byte streams. Canvas may also round colour channels during premultiplication
of partially transparent pixels. Preserve the indexed project/palette when exact
source RGBA matters. Browser screenshots likewise are presentation evidence,
not a promise of cross-browser GPU or PNG identity.

From the repository root:

```sh
node --test tests/sprite2d.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-check.js --suites=editor
```

Use the repository's already provisioned external Playwright/Chromium tools;
they are not runtime dependencies. Node tests cover source pixels, palette/seed
stability, frame order, validation, input ownership, rejected imports and atlas
bounds. Packaged browser checks exercise actual generation, editing, animation,
downloads, Workbench import, narrow/keyboard/touch controls and offline authoring.
The shared startup checks retain an older worker and test import-failure recovery.
Actual execution results and source identity belong in the milestone verification
record, not inferred from this command list.

The tool retains bounded authoring history; it is not a general image editor,
AI generator, tilemap editor, animation rig, game compiler or remote asset store.
An installed packaged lab can work offline after the shared worker completes
installation. Opening a fresh offline client requires that completed installation;
`file://` cannot supply native module/service-worker requirements.

## Games2 consumer seam

Arcade games, platformers, particle effects, racing HUDs and strategy units can
consume the same project/atlas format. A later Games2 PR must independently
select an immutable reviewed VANILLAJS release, record the chosen module source
and asset provenance, own its gameplay and verify its renderer/unit conversion.
No game code is copied automatically and this milestone changes no Games2 files.

[Creator Hub](../demos/creator-hub/index.html) ·
[Asset Foundry / Workbench guide](EDITOR_WORKBENCH.md) ·
[Engine expansion programme](ENGINE_EXPANSION_001.md)
