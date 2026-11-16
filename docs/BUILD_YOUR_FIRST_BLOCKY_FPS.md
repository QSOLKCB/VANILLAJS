# Build Your First Blocky FPS

Open [Block Arena Foundry](../demos/block-arena-lab/index.html). Everything runs
locally after the verified offline installation. You own the exported data.

1. **Choose an arena.** In the workshop choose Cobalt Courtyard or Violet
   Switchyard and Load draft. This changes the editable draft; Validate & test
   replaces the accepted match. Export active pack first to keep a previous edit.
2. **Build cover and spawns.** Select Add cover and click an empty grid cell, or
   enter X/Z and Place at X/Z. Remove block deletes the block at that position.
   Move player spawn or Move first bot spawn relocates a standing combatant.
   Place spawns on supported clear ground, at least 1.5 m apart. In advanced JSON,
   `spawns.bots` adds more positions and `geometry.ramps` adds shallow stair ramps.
   Existing layouts demonstrate raised decks, corridors and cover.
3. **Make two weapons feel different.** In Weapon Foundry select Needle, set
   damage to 80 and interval to 0.8, then Update weapon draft. Select Pulse,
   set magazine to 30 and spread to 0.025, then update again. Needle still needs
   a fresh trigger; Pulse fires while held. Orb is a travelling explosive: radius
   applies only to it, and nearby explosions can hurt you.
4. **Set rules and supplies.** Add health/ammo pickups using the map tool.
   Expand Advanced JSON. In `settings.rules`, set `scoreLimit` to 8 or change
   `durationTicks` (60 ticks per second). `bots.types` selects weapon, health,
   range, cadence and speed; `waves.rosters` contains bot-type IDs for each
   survival wave. Keep each roster within the available spawn count. Palette
   values are RGB fractions, not asset URLs.
5. **Validate and play.** Choose Validate & test, then Enter the arena. Test
   both modes, movement around your new cover and the weapon switch/reload flow.
   WASD moves, mouse or arrows aim, click/F fires, R reloads, Space jumps, C
   crouches, 1–3 switches and Q scopes Needle. Escape pauses. A failed import
   reports its error without replacing the accepted pack or running session.
6. **Export what you made.** Export active pack downloads the last accepted
   JSON. Import it again to check portability. Export replay verifies and saves
   the accepted pack, seed and every command. Keep the source revision with it:
   replay equality is checked in the same source and JS runtime. Export does not
   include an executable game, engine bundle, account or network service.
7. **Start a separate game project.** Vendor the required public module closure
   from an owner-reviewed immutable VANILLAJS commit or published release that
   actually includes these APIs. v2.2.0 does not include `combat3d`/`mod-fps`;
   v2.3.0 introduced them. The reviewed published baseline is
   [v2.4.0](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v2.4.0), commit
   `128d7c924513f7d8ac08e2e11cc6832c5b7082fb`. Record the commit and SHA-256
   file identities; retain LICENSE and NOTICE. Never load mutable main or a CDN
   at runtime. Preserve the relative `modules/` and `api/` paths in your vendor
   snapshot. Your game supplies its world, bots, match rules, UI and progression.

## Small public-module example

The runnable [example adapter](../api/fps/example.js) imports only public engine
modules, with no dependency on `demos/block-arena-lab/`. It demonstrates a
grounded player, a stationary opponent, the admitted arena and all three weapon
timers. It deliberately leaves bot AI, match modes and replay to your game.

```js
import {createFPSExample} from './vendor/vanillajs/api/fps/example.js';
import {FixedClock} from './vendor/vanillajs/modules/time/index.js';

// packText is your bounded locally loaded Export active pack JSON.
const game = createFPSExample(packText);
const clock = new FixedClock({step:1/60,maxFrame:0.1,maxSteps:6});
// In your loop, sample controls once per logical tick. Aim is relative radians.
clock.advance(elapsedSeconds, () => {
  const events = game.step({move:[0,-1],look:{yaw:0,pitch:0},
    fire:triggerHeld,reload:reloadPressed,weapon:0});
  // events contain shot, damage, death, elimination, reload and impact results.
  // Render game.character, game.combat.snapshot() and game.pack.solids.
});
// On pause/focus loss: cancel held inputs, stop sound and drop paused clock debt.
clock.setPaused(true);
game.combat.cancelTriggers();
```

`WeaponTimer` handles cadence and reload; the example sends trigger state to
`Combat3D`, which applies semi-automatic/automatic semantics. A finished game
also applies its weapon's spread/recoil to actual aim, places pickups, handles
death/respawn and owns its content lifecycle. The lab demonstrates that fuller
composition without making its internal files an engine API.

Use HTTP(S) to serve the complete source or packaged folder. After generating
`dist/` with the standard build, wait for service-worker installation and reload
before testing offline. Test your actual deployment prefix and an old-cache
upgrade. The existing Visual Workbench exporter produces a scene preview; it
does not generate an arbitrary FPS game from this JSON.

See [schema, limits and numerical contracts](FPS_FOUNDATION_001.md). A future
Games2 game belongs in its own directory and separately reviewed PR, preserving
existing games and catalogue entries. [The integration register](GAMES2_INTEGRATION.md)
tracks proposals, including Strike Pixel, without allocating a game directory or
authorising changes to Games2.
