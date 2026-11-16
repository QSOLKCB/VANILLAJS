# Game Maker Lab — make a small game you can keep

Open [Game Maker Lab](../demos/game-maker-lab/index.html) through a local HTTP
server or the packaged site. No installation, account, remote image or cloud
service is required. This experimental v2.8.0 workflow builds a real, bounded
platform game using native JavaScript and Canvas 2D.

The original **Signal Garden** starter is playable immediately. Move with A/D
or the arrow keys. Space or W jumps. Collect the three bright signals, jump
over the block and coral thorn, then enter the mint portal. A thorn loses the
run; Restart restores it. Sound is optional and starts only after pressing its
button. Touch controls and keyboard-focusable buttons offer the same actions.

## From an empty stage to your first game

1. Press **Start empty**. The stage now has no floor, spawn or portal. Play and
   runnable export are disabled until those required pieces exist.
2. Press **Lay starter floor**. This paints real tiles and collision along the
   bottom row. You can also paint the floor yourself: choose the Floor brush,
   then drag across cells or enter Column/Row and press Apply brush.
3. Choose **Player spawn**, enter column `2`, row `10`, and apply. Choose
   **Collectible signal** at column `5`, row `10`. Place **Portal / win** at
   column `8`, row `10`. These coordinates use the default 24 × 12 stage.
   The upper-left cell is column 0, row 0. A marker must occupy an empty
   collision cell; painting solid over a spawn is rejected without replacing
   the accepted project.
4. At the Sprite & palette desk, change the seed and press **Generate hero**.
   Pick a palette index and color, then Apply color. Click the sprite preview
   to paint individual source pixels, or use its arrow keys and Enter. Index
   zero erases; its transparent RGBA value remains unchanged.
5. Press **Play**. Move right, collect the signal and reach the portal. Jump
   to test the response. This advances the real fixed-step game and whole-body
   tile collision; the preview does not fake movement by sliding an image.
6. Add a block or thorn before the portal, then play again. Leave enough room
   for the jump. A valid data format does not prove a level can be completed.
7. Download the project and **Export playable game**. Keep the complete ZIP.
   The next section explains how to run it separately.

The progress strip is tied to actual state: a structurally playable stage,
an accepted hero change, observed horizontal movement in the current project,
and a successfully prepared portable download. It does not claim a level is
balanced, every route is reachable, or opening another lab completed a lesson.
Any accepted project edit invalidates the previous movement/export indicators.

## What the brushes change

| Brush | Accepted data changed |
| --- | --- |
| Floor | Selected normal-parallax visual layer and the separate collision grid |
| Visual tile | Selected layer only; it does not become solid automatically |
| Collision / Clear collision | Collision grid only |
| Player spawn | The single game-owned `player` spawn |
| Collectible signal | A `collect` trigger; all must be collected before winning |
| Thorn | A `hazard` trigger that ends a run on contact |
| Portal | The single `exit` trigger |
| Erase | Selected visual layer, collision and markers in that cell |

Arrow keys move the map cursor and Enter applies the current brush. Pointer
strokes are one history entry. Cancellation discards an unfinished stroke.
Undo/redo retains up to 32 accepted project versions; it is local memory, not
cloud storage or a durable save. Download files before leaving the page.

**Layers & camera** adds bounded visual layers and edits their parallax factor.
`1` follows the physical world; lower factors produce distant scenery. Collision
does not move with decorative parallax. The camera follows the player within
the map's bounds, or stays at its accepted position when follow is disabled.

Use **Palette for → Tileset** to edit the tiles' palette or paint pixels in the
selected tile frame. A tile references one frame of the embedded Sprite Foundry
project; its pixels are original reusable source data. The full
[Sprite Foundry](../demos/sprite-foundry/index.html) offers animation authoring,
fill tools, atlas exports and other generators. Import its validated sprite
project as the hero here; existing Workbench project schemas are unchanged.

## Your portable export

The ZIP is an independently runnable version of this project's **Signal Garden
rules**. It includes the actual player and native-module dependency closure,
sprites/map data, original procedural sound generation, HTML/CSS, `LICENSE`,
`NOTICE`, asset licence records, exact runtime source hashes, a SHA-256 package
manifest and the scoped offline worker. Development dependencies and editor
controls are excluded.

Extract all files into an empty folder, open a terminal there, and run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. Native browser modules require HTTP(S); double-clicking
an HTML file is not equivalent to serving the game. The package also works under
a nested path, provided all its relative files remain together.

The first visit must be served successfully. On HTTPS or local loopback, the
worker verifies the packaged bytes and installs its own directory-scoped cache;
later visits can work with networking disabled. A fresh browser has no existing
cache and still needs that first served visit. Changing an exported runtime file
without rebuilding its manifest invalidates the offline package.

`project.json` can be reopened in the lab for editing. **Download project** alone
contains data, not the player or engine. The portable download adds the complete
runtime for these particular game rules; it is not a universal compiler for
arbitrary JavaScript, every genre or all Visual Workbench scenes. Imported
project data cannot supply executable plugins or scripts.

Source sprites retain their declared licences. The generated asset record
describes those declarations; retain any required attribution for your own
imports. Keep the engine's Apache-2.0 licence and notices. Pin an immutable
reviewed VANILLAJS release when adopting this example in a separate project.

## Engine-owned and game-owned behavior

The [Game Maker API](GAME_MAKER_API.md) owns a supplied Canvas surface, bounded
local sprite/tile assets, a fixed-step clock, input snapshots, particles and
sound voices. It does not create an animation loop, listen to devices or fetch
remote assets for you. Each instance has explicit pause/reset/disposal.

The pure [tilemap module](TILEMAP_API.md) owns the validated grid, world/cell
conversion, camera bounds and swept body/tile collision. It composes `motion2d`
and uses 256 integer subunits per game unit; one tile is one game unit. Rows
increase downward in authored data while simulation +Y points upward. Decorative
pixels and cosmetic particles do not alter collision or exact integer state.

[game.js](../demos/game-maker-lab/game.js) owns the example's collect/hazard/exit
meanings and win/lose conditions. [player.js](../demos/game-maker-lab/player.js)
owns its browser input, animation scheduling, optional audio device and lifecycle.
The portable shell consumes those same files; it is not a second game simulation.
Use the public-API example linked in the API guide to begin a different game.

## Failure and recovery

- Invalid, unsupported or oversized imports leave accepted data intact. Unknown
  fields, unsafe records, bad atlas references and markers inside solid tiles
  are rejected. The complete JSON view exposes the supported data format; it
  does not evaluate text as instructions.
- Editing stops and resets the preview so it cannot silently continue an older
  level. An older file-read response cannot overwrite a newer accepted action.
- Pause, focus loss, hidden pages and navigation cancel held controls. Resume
  needs a fresh press. A completed brief jump tap is retained until a fixed tick;
  a canceled pointer gesture is not a jump.
- Returning through the browser's back/forward cache rebuilds disposed resources
  and offers a fresh paused run of the retained project. This does not promise
  persistent saves across a full reload; keep a downloaded project for that.
- Canvas failure leaves data authoring/export available. A context-loss event
  pauses the game and retains accepted state; restoration rebuilds its owned
  graphics resources. A reload may be needed if the browser cannot restore them.
- Audio failure does not disable the game. Sound is local, optional and canceled
  on pause/focus loss. A finished run stops scheduling frames.

The viewport checks use browser touch emulation. They do not establish physical
phone/controller support, Firefox/Safari compatibility or hardware performance.
There are no universal pixel-identity claims for Canvas text or GPU output.

[Creator Hub](../demos/creator-hub/index.html) ·
[Game Maker API](GAME_MAKER_API.md) · [Tilemap API](TILEMAP_API.md)
