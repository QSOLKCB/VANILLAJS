# SPRITE-FEEL-001 — Game Feel & Sprite Foundry

**Proposed release:** v2.6.0. **Published baseline:** v2.5.0 — The Creator Gateway.
**Reviewed starting main:** `433f8c87a74ed145a612510ee388a7aacc1280f6`.
This milestone is an implementation candidate for owner review, not a published
release. The [remaining programme](ENGINE_EXPANSION_001.md) stays proposed.

## Public additions and ownership

| Addition | Owns | Consumer |
| --- | --- | --- |
| [sprite2d](../modules/sprite2d/index.js) | Seeded bounded pixel generation, palettes, animation frame editing, source RGBA, masks and atlas layout | [Sprite Foundry](../demos/sprite-foundry/index.html) |
| [weapon-feel](../modules/weapon-feel/index.js) | Explicit look samples, ADS/FOV/sensitivity, trigger buffering, switch protection, seeded accuracy and cosmetic feedback | [Weapon Feel Lab](../demos/weapon-feel-lab/index.html) |

Both APIs are **experimental**, registered in `MODULES.json`. Pure modules do
not own DOM, event listeners, browser clocks, GPU resources, audio devices or game
fiction. `sprite2d` has no module dependencies; `weapon-feel` composes the existing
`combat3d` validators/weapon definitions and `math` functions. Actual magazines,
reloads, cooldowns, hits and damage remain in the existing combat systems.

The labs own the authoring UI, input/lifecycle, original examples, Canvas/WebGL
presentation and user-triggered downloads. No new rendering backend, external
engine, npm runtime dependency, remote asset, model or cloud service is introduced.

## Creator workflows

**Sprites:** choose an original generator, size, seed, symmetry and palette;
generate frames; paint, erase or fill individual pixels; duplicate/reorder/edit
frames; adjust duration and preview the animation; undo/redo; save and reimport
the validated project. Export the current PNG, sheet and atlas/mask metadata for
a consuming game. [The tutorial and API examples](SPRITE_FOUNDRY.md) define the
precise controls, data limits, export contents and coordinate conventions.

**Weapons:** enter an original training range with three profiles. Move, aim,
fire, reload and switch while targets move. Tune accuracy, recoil, ADS speed,
recovery, FOV and effects; inspect the actual origin, direction, impact and timer
state; export/reimport the versioned inert recipe.
[The tutorial and composition example](WEAPON_FEEL.md) explain which fields affect
gameplay and which only change presentation.

The [Creator Hub](../demos/creator-hub/index.html), README and
[agent catalogue](../agents/catalog.json) expose both workflows. The catalogue
validator checks module references, real entry points, schema and commands.

## Compatibility and numerical boundaries

- All pre-existing public signatures and defaults remain unchanged. Consumers
  explicitly opt into either new module. Package/catalogue historical `1.0.0`
  metadata is not migrated; GitHub release tags remain owner decisions.
- Sprite recipe + implementation version + seed + palette reproduces exact
  indexed pixels and source RGBA. Edited project frames are authoritative; a
  regeneration deliberately discards edits. Browser Canvas PNG encoders need not
  produce identical encoded bytes for identical RGBA.
- Pixel coordinates use top-left origin, +X right and +Y down. Masks use an
  explicit alpha threshold; atlas coordinates and padding are metadata, not a
  physics collision implementation.
- Transparent sprite/animation data uses `qsol.vanillajs.sprite.v1`. The existing
  Asset Foundry only supports opaque textures up to 64×64. Its bridge is an
  **explicitly flattened PNG**, with original transparent data retained separately.
  No existing Workbench project or asset schema is silently widened.
- `qsol.vanillajs.weapon-feel.v1` is a separate recipe. Existing FPS/mod formats
  remain intact. Character/combat use SI metres and seconds, right-handed +Y up,
  −Z forward and Float64 approximation. This does not extend integer proof claims.
- Look sampling is separate from the fixed 60 Hz combat step. Supplied input
  samples, their order and tick assignment are part of repeatability. Different
  live event timing is not promised to produce identical results.
- Seeded spread is gameplay-affecting. Cosmetic recoil moves the weapon model
  separately from the canonical view/shot direction. The reticle represents the
  nominal aim; spread uses bounded seeded yaw/pitch offsets around it. Ray/impact diagnostics
  report actual combat output, not a decorative crosshair assumption.

## Source and provenance

The [AFTER//ZERO audit](AFTER_ZERO_GAME_FEEL_AUDIT.md) identifies all eight requested
files at `406a45927b819f7383f71649d261de675552ca9c`, their immutable Git blob
identities, licence lineage and selected behavioural lessons. This milestone
independently implements those behaviours; it does not copy the donor campaign,
levels, renderer or audio assets. New source retains Apache-2.0 SPDX headers.

Generated project data retains explicit asset licence metadata. Keep exported
sprite metadata with PNGs. A future consuming game owns its original art, rules,
level content, menus and progression, and must preserve applicable notices.
No Games2 files are changed by this engine milestone.

## Packaging and verification

Both labs reuse the existing content-derived native-module package generator.
The entire import graph is copied byte-for-byte into a versioned runtime namespace.
The source-bound browser provenance verifier reconstructs and authenticates the
two additional namespaces alongside all six existing ones. No authority rule,
qualification threshold, archived evidence or owner-only runner policy is relaxed.

The browser checks cover real authoring/gameplay, rejected imports, accessible
narrow layouts, offline controlled navigation and recovery after a failed import.
An explicitly synthetic older-worker fixture deliberately serves poisoned
unversioned modules while current versioned startup must remain usable. It is a
negative control, not a claim that those poisoned bytes existed in a release.

Required commands from a Node 22+ source checkout:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-check.js
git diff --check
```

Browser checks use the repository's already provisioned external Playwright and
Chromium, with optional `NODE_PATH` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. They do
not install runtime dependencies. Targeted new scenarios are part of the existing
`editor` and `play` groups; shared changes still invalidate the existing witness
closures. The full-browser override remains supported.

The [execution record](evidence/sprite-feel-001/README.md) records the tested
candidate SHA, package and asset digests, commands/results, corrections and screenshots.
No physical mobile, controller or GPU validation, other browser engine, universal
Float64/pixel identity or measured performance improvement is claimed.

## Games2 compatibility

Use only the implemented APIs above and the recorded verification when reviewing
adoption. Engine tests do not automatically validate a consuming game.

| Consumer | Available baseline + this candidate seam | Still proposed |
| --- | --- | --- |
| Strike Pixel / FPS | Existing character/combat3d/weapons/input plus opt-in weapon-feel recipe | Game-owned SP-002 changes; no automatic adoption |
| Arcade / platformers | sprite2d RGBA/atlases plus existing motion2d/combat2d/audio2d | Tilemap authoring/facade in v2.8 |
| Tactical / adventure | Sprite assets and existing navigation/interactions | Scene/narrative in v2.7 |
| RTS / strategy | Sprite atlases, existing navigation and flow fields | Tilemap and narrative integration |
| Racing | Sprite HUD assets; existing racing/track primitives | HORIZON renderer/dynamics/authoring in v2.9 |
| Space | Sprite HUD/particles; existing flight/rendering/audio | General scene composition |
| Intros / cinematics | Existing Demoscene Foundry and soundtrack | General scene animation |

A later Games2 PR must select an **owner-reviewed immutable engine release**,
record selected modules and provenance, and run its own gameplay/package checks.
No automatic source copying or cross-repository coupling is introduced.

[Draft v2.6.0 release notes](SPRITE_FEEL_2_6_0_DRAFT.md) ·
[Independent Games2 integration policy](GAMES2_INTEGRATION.md)
