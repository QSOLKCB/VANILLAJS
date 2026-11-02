# FPS Lab — first grounded-controller slice

Browser entry: `demos/fps-lab/index.html`. Pure demo composition:
`createFpsLab`, `stepFpsLab`, `focusPlate` in `demos/fps-lab/worlds.js`.
These recipe functions are examples, not promoted module APIs.

## Footwork

The course has four 25 cm stairs, a 1 m landing, an 80 cm hurdle and a 1.3 m
wide doorway. Four ordered markers indicate progress. Walk straight up the
stairs; jump as the amber hurdle approaches. The default 70 cm wide, 1.8 m tall
body fits the doorway. A side alcove has insufficient standing clearance and
illustrates ceiling rejection. On completion the simulation pauses; Run again
restores the course. The included scenario test reaches all four markers with
movement and a timed jump through the actual colliders.

## Live range

Three stationary plates have 100 integrity each. A successful hit removes 25;
spent plates remain solid and reject further effects. The interaction resolver
returns reasons; the recipe owns integrity, counters and bounded impact history.
No enemy AI, moving target or multiplayer system is implied.

An instant trace queries the first static obstruction out to 130 m. A bolt
travels at 65 m/s for at most 2 s with a cube half-size of .035 m. Both originate
at the tick's initial eye pose. Bolts sweep against wall/target boxes throughout
travel, so their delay changes when a hit is observed. They have no gravity or
penetration. Changing shot type pauses and cancels in-flight bolts. Plate focus
pauses and repositions/stops the player, clearing shots/visual trails while
preserving scores, ammunition and reload progress. Reset restores everything.

## Shared timing and controls

Both recipes run 120 Hz physics through `FixedClock`, with bounded catch-up and
presentation interpolation. Grounded movement uses `character`; cooldown,
magazine and reload state use `weapons`. Input and WebGL remain opt-in adapters.
The existing flight controller is untouched and stays available to space games.

The demo weapon has 8 rounds plus 32 in reserve, a 0.2 s shot interval and a
1.2 s manual reload. Reload preserves partial magazines. Held fire can repeat
when Hold to fire is enabled; disabling it consumes fresh edges only. Brief
keyboard, pointer and assistive button presses are retained until the next tick,
and blocked requests are discarded. Pause/focus loss clears those edges and
held states without advancing reload, cooldown or projectile lifetimes.

WASD movement, Space jump, Shift sprint, arrows to aim, F/left click fire and R
reload are defined by `fpsBindings` plus the mouse adapter. Capture starts from
a canvas press after launch; Escape releases and pauses. Touch and unavailable
capture use relative drag look; on-screen buttons provide movement and aiming.
FPS Lab does not sample gamepads yet; Flight Lab's original gamepad mapping remains.

## Limits and provenance

The controller is a kinematic upright rectangular box against static AABBs. It
has gravity, limited horizontal acceleration, step attempts and short ground
snap. It has no slopes, capsules, crouching, moving platforms, dynamic contacts,
coyote time, jump buffer, ladder or swimming model. The eye pose is fixed inside
the collider, with bounded pitch and zero roll; no camera collision rig or head
bob is claimed. Exact numerical contracts are in [API.md](API.md).

Shot, trail and history counts are bounded: 32 active projectiles, 16 trace
segments, 32 flashes and six receipts. Procedural meshes reuse owned WebGL
buffers. No maximum throughput, FPS or allocation-free claim is made.

All source, environments and geometry were independently authored for this repo.
No donor game code, third-party runtime, image, font or audio asset is bundled.
Existing Apache-2.0 licence and provenance remain in place.
