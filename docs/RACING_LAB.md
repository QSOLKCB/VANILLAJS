# RACING-001 / RACING-002 — Native Browser Racing Lab

**Status:** Experimental playable demos, original art and tracks, Apache-2.0.

Open [Racing Lab](../demos/racing-lab/index.html) from the VANILLAJS Creator Hub. Serve the repository with a local HTTP server; native ES modules do not load reliably from a `file://` URL.

## Seven independent play styles

| Preset | Visual style | Challenge | Win condition |
| --- | --- | --- | --- |
| Retro Tour | Canvas 2D pseudo-3D | Curved horizon, overtaking 5 traffic cars, boost and shoulders | 3 x 1200 m stages |
| Scenic Tour (RACING-002) | Canvas 2D pseudo-3D | Three explicit lane-selected road forks and original scenery palettes | 4 x 1200 m stages |
| Circuit Race | Native WebGL low-poly 3D | Chase 8 ordered waypoints, race against 4 bots, collisions | 3 completed laps |
| Coastal Sprint (RACING-002) | Native WebGL low-poly 3D | Original 3.6 km winding coastal road, traffic, verge penalties and sprint gates | 3600 m finish |
| Demolition | Native WebGL low-poly 3D | Drive into rival cars, manage body damage and boost | 4 knockouts |
| Car Football | Native WebGL low-poly 3D | Push the ball into goals, drift, jump and boost | First to 5 goals |
| Skyline Stunt | Native WebGL low-poly 3D | Narrow elevated roadway, two jumps over real missing spans, ramps, hard landings | 2 laps |

**Classic-touring influences (RACING-002):** Scenic Tour draws from the genre of
1980s pseudo-3D highway racing (*OutRun*-style pacing, traffic and forks).
Coastal Sprint draws from 1990s point-to-point 3D sports-car racing
(*Need for Speed II*-style scenic roads and chase-camera driving). This phase
commits fork choices to the run state and changes its scenery palette; distinct
branch *geometry* and track authoring are future work. The coastal road has a
single original analytic centreline with road-edge penalties and four chasing
traffic vehicles. Neither experience copies third-party assets, routes or cars.

**Stunt Car Racer influence:** Skyline Stunt captures the *genre mechanics* of narrow elevated courses, perilous gaps, hard landings and a race against the road itself. The track, appearance, code and vehicles are original; no proprietary game assets or level data are reproduced. Other modes likewise reference broad arcade, vehicle-soccer and demolition genres rather than copying named commercial games.

## Controls and simulation

W/Up accelerate; S/Down brake and reverse; A/D or Left/Right steer; Shift boost; X drift; Space jump on 3D courses; F spin while airborne. Touch buttons expose equivalent actions. Escape pauses. Simulation stops on browser focus loss, page hide or pause and clears all held input to avoid stuck accelerators. A fixed 60 Hz `FixedClock` bounds catch-up to eight simulation steps per rendered frame.

Demo state is advanced only through `stepRace(world, input, dt)` in `world.js`. Input is the explicit caller-supplied object; there is no ambient randomness, networking, external assets, CDN, npm runtime dependency, or game rules in the reusable engine modules.

Car driving uses float64 velocity, rate-limited steering, traction blending, linear collision impulse approximations, boost, vertical gravity and ground clamping. RACING-002 detects swept circle-on-circle contact in Coastal Sprint when fast cars pass completely through one another during a simulation tick; it is not a continuous rigid-body response solver. Collision immunity expires for live rivals, nitro speed decays after release rather than snapping to the standard limit, and underside stunt-platform landings are rejected. The elevated course's ground height is piecewise-defined in `stuntRoad`, with **no floor under the two gaps**. A car falling off is returned to its last saved track interval with a damage penalty. This is stylised arcade physics, not a tyre, chassis or suspension solver.

## Replays and numerical claims

**Download Run JSON** exports mode, fixed step, explicit input per simulation tick, and a final observed snapshot. Replay is captured before each simulation update. The recording is **not** a certified cross-browser bit-exact witness, and the downloadable file is not a full self-contained asset pack or a save-game importer. The 36,000-tick bound prevents unbounded browser recording. Use the exact Q16.16 modules and [Circuit Mod Lab](../demos/circuit-mod-lab/index.html) for strict integer checkpoint contracts.

## Testing and verification

- `node --test tests/racing-lab.test.js` tests all seven modes, invalid dt, repeatability, touring forks, scenic sprint finish and fast-pass contact, boost decay, rival cooldown expiry, stunt underside rejection, course goals and bounded geometry.
- `node --test tests/*.test.js` runs existing and new unit tests.
- `node scripts/check.js` validates JavaScript syntax, module catalogue dependencies and recipe entries.
- `node scripts/build.js` verifies the offline package and 16 MiB asset budget.

Browser behaviour needs a real Chromium pass for both Canvas and WebGL, including GPU availability/context restoration and keyboard/mobile focus. CI evidence must distinguish a real browser run from static checks and pure Node simulation tests. This milestone does **not** assert real-device performance, collision realism, accurate stunt suspension, opponent pathfinding optimality or multiplayer synchronization.

## Next research upgrades

1. Full continuous rigid-body response, high-speed wall/rail contacts and resolving initial overlaps (the sprint currently detects swept vehicle pairs only).
2. An integer-bounded driving kernel leveraging VANILLAJS Q16.16 and formal refinement, with an explicit numerical contract.
3. Suspension and wheel contact solver for stunt landings, banking, rollover and midair flips.
4. Race editor integration, authored tracks, ghosts and downloadable vehicle mod packs.
5. Richer WebGL track topology, materials, UI, original PCM engine/exhaust audio and gamepad calibration.
