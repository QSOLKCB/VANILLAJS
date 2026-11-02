# FPS Lab — grounded movement and moving targets

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
This original recipe retains stationary targets; Tracking range adds translating
plates. No enemy AI or multiplayer system is implied.

An instant trace queries the first static obstruction out to 130 m. A bolt
travels at 65 m/s for at most 2 s with a cube half-size of .035 m. Both originate
at the tick's initial eye pose. Bolts sweep against wall/target boxes throughout
travel, so their delay changes when a hit is observed. They have no gravity or
penetration. Changing shot type pauses and cancels in-flight bolts. Plate focus
pauses and repositions/stops the player, clearing shots/visual trails while
preserving scores, ammunition and reload progress. Reset restores everything.

## Low passage

A 4 m wide corridor has two roofs with 1.25 m and 1.15 m clearance. The default
standing body is 1.8 m tall; holding C reduces it to 1.08 m and the eye to .972 m.
Its horizontal target speed becomes 2.5 m/s, even with sprint held. Feet stay put
while dimensions change. Release C under a roof and the controller remains
crouched, with LOW CEILING feedback, until standing volume is clear. There is no
automatic crouching when a standing player walks into a passage.

Four ordered markers require crouching through the first passage, standing in
the open bay, crouching through the second passage and standing at the finish.
The recipe tests traverse the actual corridor, including releasing crouch under
both roofs. Crouched jumps still collide with overhead geometry.

## Tracking range

Three plates translate sideways on bounded tracks. Default shot mode is a
travelling bolt: aim ahead, because a direct aim can miss as the plate moves.
Instant traces sample the plate's position at the moment of firing. Focus aligns
you with a plate's **current** position and pauses; it does not predict future
motion or rewind the track. Cleared plates keep moving and remain shot occluders.

Each 120 Hz tick takes target positions at its beginning and end. The demo's sine
path endpoints are joined by straight motion during that tick; the query does
not claim exact curved-path collision. `ProjectileSystem.stepMoving` compares
all plate motions and static world boxes in that same interval, then the demo
commits end positions. Rendering interpolates target centres. Instant traces run
before the target moves. Damage is consumed once, in event order, from the same
interaction resolver as Live range. Impact flashes mark the world hit location;
they are not decals attached to the plate.

These moving training plates are **shot-only** colliders, not character obstacles
or moving platforms. Character movement still uses static world solids. Motion,
shots and reloads all freeze on pause or focus loss; reset rewinds tracks and
clears ammunition/progress. The test suite clears all plates using leading bolts
and finite reloads, and checks a direct shot that misses a moving plate.

## Shared timing and controls

All four recipes run 120 Hz physics through `FixedClock`, with bounded catch-up and
presentation interpolation. Grounded movement uses `character`; cooldown,
magazine and reload state use `weapons`. Input and WebGL remain opt-in adapters.
The existing flight controller is untouched and stays available to space games.

The demo weapon has 8 rounds plus 32 in reserve, a 0.2 s shot interval and a
1.2 s manual reload. Reload preserves partial magazines. Held fire can repeat
when Hold to fire is enabled; disabling it consumes fresh edges only. Brief
keyboard, pointer and assistive button presses are retained until the next tick,
and blocked requests are discarded. Pause/focus loss clears those edges and
held states without advancing reload, cooldown or projectile lifetimes.

WASD movement, Space jump, Shift sprint, held C crouch, arrows to aim, F/left click fire and R
reload are defined by `fpsBindings` plus the mouse adapter. Capture starts from
a canvas press after launch; Escape releases and pauses. Touch and unavailable
capture use relative drag look; on-screen buttons provide movement and aiming.
FPS Lab does not sample gamepads yet; Flight Lab's original gamepad mapping remains.

## Limits and provenance

The controller is a kinematic upright rectangular box against static AABBs. It
has gravity, limited horizontal acceleration, step attempts and short ground
snap. It has no slopes, capsules, moving platforms, dynamic contacts, coyote time,
jump buffer, ladder or swimming model. Eye height follows the current stance inside
the collider, with bounded pitch and zero roll; no camera collision rig or head
bob is claimed. Exact numerical contracts are in [API.md](API.md).

Shot, trail and history counts are bounded: 32 active projectiles, 16 trace
segments, 32 flashes and six receipts. Procedural meshes reuse owned WebGL
buffers. No maximum throughput, FPS or allocation-free claim is made.

All source, environments and geometry were independently authored for this repo.
No donor game code, third-party runtime, image, font or audio asset is bundled.
Existing Apache-2.0 licence and provenance remain in place.
