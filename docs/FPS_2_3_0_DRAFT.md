# Draft — VANILLAJS v2.3.0: The FPS Foundry

For owner review. No tag or release is published by this implementation PR.

- **Block Arena Foundry:** an original native WebGL FPS lab with Arena Skirmish,
  Survival Waves, two block-built layouts, offline bots, three distinct weapons,
  pickups, respawns and match summaries.
- **Experimental 3D combat:** explicit head/body hit regions, hitscan range and
  penetration, travelling projectiles, occluded splash damage, armour, teams,
  damage provenance, elimination and assist events. Reuses existing character,
  weapon, projectile and collision contracts.
- **Arena and Weapon Foundries:** edit bounded geometry, spawns and pickups in
  the map view; tune weapons with safe fields; author rules, bots and waves in
  strict inert JSON packs. Invalid imports preserve the accepted session.
- **Creator workflow:** Build Your First Blocky FPS tutorial and a runnable
  public-module example for separately owned game projects.
- **Controls and replay:** keyboard/mouse, Pointer Lock, gamepad, touch,
  sensitivity/inversion, pause/fullscreen and complete source-bound input journals.
  Replay equality is scoped to the same source and JavaScript runtime.
- **Offline resilience:** content-derived module packaging, recoverable startup,
  and an older-worker upgrade regression extending the v2.2.0 startup fix.

Additive APIs: `WeaponTimer.addReserve` and optional renderer `fov`. Existing
lab APIs and defaults remain supported. No runtime framework, external asset
download, tracking, accounts or monetisation machinery. Games2 is unchanged.

Experimental limits: Float64 physics; AABB bodies and stair ramps; ground-plane
bot routing; finite arena/actor/projectile budgets. Network multiplayer,
destructible voxel worlds, arbitrary FPS export and Strike Pixel remain future
work. Executed verification and device-coverage limits are recorded in the PR.
