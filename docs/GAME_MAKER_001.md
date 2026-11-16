# GAME-MAKER-001 — The Game Maker API

**Proposed release:** v2.8.0. **Published baseline:** v2.7.0, Scene & Narrative
Foundry, `70e63b902834ae31b994ea40ae584bd93892e6bf` (PR #102). The owner merged
and published the preceding milestone before authorising this candidate.
v2.8.0 review, merge and release remain separate owner decisions.

## What creators can build

[Game Maker Lab](../demos/game-maker-lab/index.html) teaches a small original
platform game: create/import a sprite, paint tile layers and collision, place
the player and interaction markers, test movement, collect items, avoid hazards,
reach the exit, restart and export the actual playable package.

The blank template accepts incomplete authoring data. Play/export admission
reports missing game requirements; it does not pretend an unfinished map is
playable. The original starter is a working example to inspect and modify.
Creator progress reflects accepted edits and actual play rather than merely
opening another lab. See [the practical tutorial](GAME_MAKER_LAB.md).

| Addition | Engine responsibility | Game-owned responsibility |
| --- | --- | --- |
| [Game Maker facade](GAME_MAKER_API.md) | Owned native drawing surface, validated local assets, supplied input/clock, bounded particles and sound playback | Device listeners, animation loop, authored content and game rules |
| [Tilemap module](TILEMAP_API.md) | Layered data, sprite-atlas indices, collision, markers, integer body sweeps and camera follow | What each trigger means, objectives, damage, difficulty and progression |
| [Portable export](GAME_MAKER_EXPORT.md) | Exact trusted runtime closure, package hashes, offline integrity and notices | Author's map/art rights, level reachability, balance and release approval |

No required global engine, runtime npm dependency, new WebGL backend, cloud
service or remote asset is introduced. The facade uses native Canvas2D, as the
existing 2D labs do, and composes existing `sprite2d`, `input`, `time`, `audio2d`
and audio playback facilities. `tilemap` composes `motion2d` and `sprite2d`.

## Format and numerical boundaries

- `qsol.vanillajs.tilemap.v1` contains an embedded validated Sprite Foundry
  tileset, bounded visual layers, a separate collision grid, spawn/trigger
  markers and camera settings. Visual layers can use parallax; collision never
  follows decorative parallax.
- `qsol.vanillajs.game-maker.v1` is the example's own map/player-sprite envelope.
  It admits only the original game's declared marker vocabulary. Imported
  project data cannot choose modules, URLs, scripts or executable instructions.
- Tile rows grow downward. Authoritative bodies use +Y up, integer coordinates
  and 256 subunits per tile/game unit, matching `motion2d` and `combat2d` scale.
  Pixel resolution belongs to rendering and must not change collision geometry.
- Swept axis-separated AABBs test the complete occupied tile interval. Existing
  `motion2d` point collision is not silently advertised as a body sweep or changed.
  Corners follow documented X-then-Y resolution. No slopes, rotated colliders,
  moving platforms or general dynamic-body solver is promised.
- The caller supplies fixed steps and input snapshots. Rendering and audio
  consume state; neither advances canonical game state. Float64 canvas output,
  text metrics and browser PNG encoding are outside integer-state identity.
- Validation rejects unknown, executable, unsupported or oversized data before
  accepted state replacement. Export validation cannot prove that every authored
  level can be completed; actual play remains required.

## Compatibility and ownership

Existing public modules, defaults, Workbench v1/v2 projects, scene-composition
sidecars, narrative stories, Mod SDK formats and original exporters retain their
contracts. Game Maker has its own format and fixed example rules; it does not
change the Workbench's complete-game export claims. Existing physics, exact
Q16.16/ALIEN MATH boundaries, proof requirements and historical evidence remain.

Each facade instance owns its caches, particles, input edges and clock. The
caller supplies and owns the canvas and optional AudioContext. Disposal releases
the facade's resources without closing another owner's audio device. The Lab
owns keyboard/touch listeners, gesture-activated sound, focus cancellation and
animation scheduling. Multiple facade instances can coexist independently.

The browser downloads an actual ZIP. Its trusted source archive is generated
from the portable player's static native-module closure and verified against
source before building. Imported projects never supply those code bytes. The
archive lets the same export work offline, without fetching new runtime files.
The [export guide](GAME_MAKER_EXPORT.md) specifies files, commands and limits.

## Verification

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-check.js
git diff --check
```

Browser tooling remains external development tooling. New interactions belong
to the `editor` group. Source-bound trusted-main reuse, one-run qualification,
manual full-browser execution and owner-only hardware restrictions remain intact.
The [execution record](evidence/game-maker-001/README.md) records exact candidate
source/package identities, actual tests, failure corrections and screenshots.
No physical device support or performance gain is inferred from software WebGL
or emulated touch tests.

## Games2 consumer seam

Games2 remains unchanged. A later separately reviewed game must select an
immutable owner-approved engine release, retain provenance and verify its own
runtime. This milestone does not begin a new Games2 game or promote any source.

| Genre | Implemented candidate capability | Remains game-owned or proposed |
| --- | --- | --- |
| Arcade/platformers | Sprite assets, layered tile worlds, swept body collision, drawing/input/audio facade | Original levels, enemies, scoring and game loop |
| Tactical/adventure | Tile markers and camera follow; existing narrative and scene composition | Mission logic, inventory, dialogue adapters |
| RTS/strategy | Tile layers, markers, rendering/input; existing navigation | Unit behavior, formations and economy |
| FPS | Existing weapon-feel/combat3d; facade can support an independently owned 2D HUD | FPS gameplay and integration |
| Space/intros | Existing flight, scene/narrative and Demoscene facilities | Ship systems and cinematic orchestration |
| Racing | Existing Track Foundry/road primitives; sprite HUD assets | HORIZON v2.9 rendering, vehicle dynamics and authoring remain proposed |

[Draft v2.8.0 notes](GAME_MAKER_2_8_0_DRAFT.md) ·
[Remaining programme](ENGINE_EXPANSION_001.md) ·
[Integration policy](GAMES2_INTEGRATION.md)
