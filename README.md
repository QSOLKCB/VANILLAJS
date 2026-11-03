# VANILLAJS — reusable game modules

Reusable, original JavaScript game modules built directly on web standards.
**v1.0.0 — The Clockwork Vault: six OMI seals in one playable expedition.**
Eleven experimental game modules; fifteen recipes including The Clockwork Vault;
one separately registered research experiment with three demonstrations.

[Build a game](BUILD_A_GAME.md) · [API contracts](docs/API.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Verification](docs/VERIFICATION.md) ·
[Roadmap](ROADMAP.md) · [Module catalogue](MODULES.json)

## Run the labs

Download or clone the repository, then serve its root with any static HTTP server:

```sh
python3 -m http.server 8000
# Open http://localhost:8000
# Interaction Lab: http://localhost:8000/demos/interaction-lab/index.html
# FPS Lab: http://localhost:8000/demos/fps-lab/index.html
# RTS Lab: http://localhost:8000/demos/rts-lab/index.html
# OMI Lab: http://localhost:8000/demos/omi-lab/index.html
# Brass Engine: http://localhost:8000/demos/ancient-machine/index.html
# Clockwork Vault: http://localhost:8000/demos/clockwork-vault/index.html
```

There is no runtime installation, build step, npm dependency, CDN, account,
telemetry, external asset download or backend. All geometry is procedural.
The three 3D labs and The Clockwork Vault require WebGL 1; RTS Lab uses Canvas 2D. OMI Lab uses SVG and
Canvas 2D, retaining numerical controls if its atlas is unavailable. The Brass
Engine uses native SVG and DOM controls. A visible
message explains unsupported graphics. Serve over
HTTP(S): opening `file://index.html` is not supported by the ES-module entrypoint.
The local server works without internet access. Hosted offline reload via a
service worker is a future feature, not included in this milestone.

## Flight Lab

| Experiment | Flight model | Objective |
| --- | --- | --- |
| **The conduit** | Assisted 6DOF with velocity and angular stabilisation | Thread six signals through an industrial tunnel |
| **Open orbit** | Inertial 6DOF; momentum persists after releasing thrust | Visit six navigation beacons among static blocks and a docking structure |

Both use `createBody`, `stepFlight`, `FixedClock`, the same collision module and
the same renderer. Only world data and flight configuration change. The name
Open orbit describes the space setting: gravity and orbital mechanics are not
implemented. Signal acquisition uses a swept centre segment within each beacon's
acceptance sphere; rings are visual guides, not physical obstacles.

Tune thrust acceleration, angular acceleration, assistance and simulation speed
in the side panel. Hold **B** for quarter-speed bullet time; it scales simulation
time while keeping the interface responsive. Timing and physics use a fixed
120 Hz update with interpolated rendering. Long stalls have bounded catch-up.

| Action | Keyboard / pointer | Standard gamepad |
| --- | --- | --- |
| Forward / reverse, strafe | W / S, A / D | Left stick |
| Rise / descend | Space / Ctrl | RT / LT |
| Pitch / yaw | Mouse look (click view to capture), or arrow keys | Right stick |
| Roll | Q / E | LB / RB |
| Brake translation and rotation | Hold X | Hold A |
| Bullet time | Hold B; or use the time slider | Use the time slider |
| Pause / resume | Esc or the Pause button | Menu after launch |
| Restart | Reset | On-screen Reset |

Expand **Mouse, touch & gamepad controls** for on-screen flight buttons. Multiple
simultaneous pointers are supported. Launch, then click the view for captured mouse
look: moving turns the view directly; stopping stops the turn. Mouse takeover
levels roll, limits pitch just short of vertical and clears existing angular
momentum. Translation still follows the selected flight model. Arrows and Q/E
retain their original torque controls, including inertial angular coasting.
Escape releases the cursor and pauses; resume, then click to capture again.
Touch or denied/unavailable pointer lock uses relative drag-to-look with the same
no-spin behaviour. Keyboard controls still provide every flight axis.

Blur, hidden tabs and controller disconnect pause play. Resume is deliberate;
held inputs are cleared, and gamepads must return to neutral. Unmapped gamepads
are ignored rather than guessed. Experiments are session-only, with no saved
scores or progression. Menus support keyboard navigation and status announcements;
the 3D flight itself requires visual/spatial interaction.

## Interaction Lab

Open **Interaction Lab** from the Flight Lab header. Both new recipes share the
projectile system, conditional rule resolver and WebGL renderer:

| Recipe | Try this | What it demonstrates |
| --- | --- | --- |
| **Target practice** | Fire at a drone, open its shield field, then land four hits | Inertial 6DOF flight, swept shots, conditional damage and spent targets |
| **Reaction Bench** | Fire with ignition off; enable ignition; remove the O₂ feed; compare neon and an empty chamber | Successful, blocked and resisted outcomes with explicit reasons |

**Left click** while captured, **F**, or the on-screen **Fire** button shoots.
Clicking the view first captures mouse look without firing; arrows still turn. Target
practice retains WASD / Space / Ctrl / Q / E flight and X braking. Reaction Bench
uses a stationary observation point. **Line up a shot** repositions the camera,
clears projectiles and pauses; resume deliberately. Controls also support touch
and keyboard-activated buttons. These new recipes do not sample gamepads.

Pause, blur and hidden tabs freeze movement, projectile lifetimes and cooldowns.
Cancelled firing requires a fresh press. Slow motion scales the same simulation
clock. A bounded impact trail records the selected rule and missing conditions;
**Inspect the last outcome** exposes the structured result for debugging.

Chemistry examples are symbolic, source-backed rules with reusable specimens,
not quantitative chemistry simulation. See [model limits and sources](docs/INTERACTION_LAB.md).
No Reaction Rumble code, artwork or data is included.

## FPS Lab

Open **FPS Lab** from either lab header, then choose a proving ground:

| Recipe | Try this | Shared systems |
| --- | --- | --- |
| **Footwork** | Walk up four 25 cm steps, jump the amber hurdle, pass through the doorway and reach four markers | Upright character, static collision, eye pose and input |
| **Live range** | Clear three plates; compare instant traces and travelling bolts; empty and reload a magazine | The same character plus weapon timing, queries, projectiles and conditional effects |
| **Low passage** | Duck through two low roofs, stand in the open bay and reach the finish | Safe stance changes, headroom checks and crouched movement |
| **Tracking range** | Lead moving plates with travelling bolts; compare instant traces | Relative-motion queries, target interpolation and pause-safe tracks |
| **Clearance lift** | Ride up, duck under the beam and step onto the upper deck | Translating body collision, platform support and a safe clearance stop |
| **Shuttle run** | Ride across the gap, then walk or jump onto the far dock | Carry, jump-off momentum, landing and fall recovery |

Launch, then click the view for mouse look. **WASD** moves, **Space** jumps,
**Shift** sprints, hold **C** to crouch, **arrows** aim, captured **left click / F** fires, and **R**
reloads. Escape releases the cursor and pauses. On-screen controls and relative
look dragging remain available. A brief jump/fire/reload press survives until
its next physics tick. Pause clears controls and freezes ammunition timers;
resume requires fresh presses. The range's alignment buttons pause and reposition
the character while preserving ammunition and scores.

The default controller walks at 5 m/s, sprints at 8 m/s, and climbs steps up to
30 cm. Crouching lowers the 1.8 m body to 1.08 m and targets 2.5 m/s; releasing
C stands only when there is headroom. Feet stay in place and the eye follows the
stance. It is an upright **rectangular box**. Static courses retain automatic
stairs; the platform controller adds translating surfaces, riding and jump-off
momentum. On a blocked platform tick the demo stops the route while your controls
stay active: duck or move clear to continue. **Reverse route** pauses and changes
travel direction. Slopes, capsules and rotating platforms remain future work. See
[FPS contracts](docs/FPS_LAB.md).

## RTS Lab

| Recipe | Try this | Shared systems |
| --- | --- | --- |
| **Route planner** | Click open ground, run the route, then close the north gate | Grid snapshots, shortest paths, replanning and fixed ticks |
| **Squad orders** | Drag to select units, right-click a destination, watch them regroup | The same path search plus reachable unique destinations and cell reservations |
| **Flow convoy** | Deliver 24 couriers, move their depot, or close a gate | Incremental shared directions and safe field rebuilding |
| **Two-exit evacuation** | Evacuate 36 units; close the north exit to redirect the group | Multi-source nearest-exit fields and shared traffic reservations |

Plan while paused, then **Run routes**. Mouse drag selects; right-click moves.
Touch uses **Select / Move** tools and map taps. The roster and **Select all**
provide larger selection controls. With the map focused, arrows move the cursor,
Enter applies the tool, Space orders a move, and A selects all. Escape and lost
focus pause, cancelling unfinished gestures. Accepted orders persist on resume.

The lab uses four-neighbour cell movement and a bounded, game-owned traffic
policy. Units wait instead of swapping or overlapping; automatic retries may
still reach a stand-off. Reorder or stop selected units to resolve it. This is a
small routing slice; continuous steering and reciprocal body physics remain
future work. The flow recipes build one field over bounded fixed ticks, then
share it across every unit. Delivered units leave the map. Field rebuilding
freezes new cell moves until the new grid/destination map is complete.

See [RTS contracts and limits](docs/RTS_LAB.md) and the
[recorded search-work comparison](docs/FLOW_FIELDS.md). On the 64×64, 512-request
scenario, individual A* settles 809,826 cells; one shared field settles 3,655,
followed by 512 samples. These are search-operation counts, not measured FPS.

## Modules

| Import directory | Responsibility |
| --- | --- |
| `modules/navigation/` | Immutable grids, bounded A*, group destinations and incremental flow fields |
| `modules/math/` | Vectors, quaternions, camera matrices, seeded random numbers |
| `modules/time/` | Fixed ticks, interpolation fraction, pause, time scaling and catch-up limits |
| `modules/collision/` | Static/kinematic body sliding, finite static shots and translating-target segment queries |
| `modules/character/` | Upright movement, safe crouching, static stairs, platform riding and first-person view |
| `modules/weapons/` | Simulation-time fire cadence, magazines and finite-reserve reloading |
| `modules/flight/` | Force/torque integration; assisted and inertial control |
| `modules/input/` | Pure action state, keyboard/mouse adapters and standard gamepad sampling |
| `modules/render-webgl/` | Minimal WebGL 1 triangle, line and point rendering |
| `modules/projectiles/` | Bounded constant-velocity projectiles, swept impacts and lifetimes |
| `modules/interactions/` | Ordered conditions → effects with explicit outcome reasons |

API maturity remains **experimental**, including in 1.0.0. Use a tagged release or exact commit,
preserve the directory structure and record what your game imports. The
machine-readable catalogue lists each module's dependency closure and environment.
Core modules neither own an animation loop nor read the DOM or ambient time.

## OMI Lab — research experiment

**Credit: Brian Thorne's ARCH OMI.** [ARCH-OMI-001](docs/ARCH_OMI.md) implements
the pinned sixteen-bit rotate/XOR delta law and an explicit VANILLAJS encoding
of four nibble-valued tetrahedral vertices. Inspect the four faces, flip an
observed edge bit, apply reversible masks and survey all 65,536 words.

The exhaustive result distinguishes **return after eight steps** from **minimal
period eight**: 8 words have period 1, 56 period 2, 4,032 period 4 and 61,440 period 8.
An independent arithmetic oracle agrees on every output. Six derived edge
differences have only 4,096 patterns, each shared by sixteen words; closure does
not establish absolute identity or detect every coordinated change.

This lives under `experiments/arch-omi/`, separate from the game modules. Source
pins, encoding choices, API boundaries, controls and the executed evidence are
documented together. It adds no runtime dependency and makes no pathfinding,
physics, cryptographic, compression, RNG or speedup claim.

## The Brass Engine — a mechanical OMI demonstration

[Turn the crank](demos/ancient-machine/index.html) of an imagined ancient
calculating instrument: four hexadecimal drums, an eight-detent cam, visible
rotation/XOR lanes and a bounded receipt tape. Seven detents prepare the result;
the eighth latches one exact OMI delta step. Reverse individual detents, advance
a whole revolution or run the 120 Hz integer-tick motor.

Save and restore a local JSON replay at any partial position. Pause, Escape and
focus loss freeze the motor; continued input requires a fresh press. Reduced
motion, keyboard operation and narrow touch layouts are supported. This is a
fictional mechanical presentation of discrete logic, not a historical replica or
physical analog solver. [Mechanism and replay contract](docs/BRASS_ENGINE.md)
include exhaustive evidence and attribution to **Brian Thorne’s ARCH OMI**.
It remains demo-owned; no new core API or game recipe is added.

## The Clockwork Vault — v1.0.0 showcase

[Enter the vault](demos/clockwork-vault/index.html): walk through one original
chamber, operate six OMI consoles, raise gates and a causeway, ride a counterweight
lift, and reach the keeper’s exit. WASD/mouse, arrow look and on-screen touch
controls compose existing modules without a new engine or runtime dependency.

Each console reuses the Brass Engine’s eight-detent calculation and adds XOR
levers. Independently verified shortest solutions increase from two to seven
commands. Bounded hints guide the next step; undo cancels a pending revolution
or reverses a command. Released seals stay released. Local JSON saves preserve
player pose, moving mechanisms, command histories and partial motor ticks.

**1.0.0 names the completed showcase milestone.** It does not silently promote
experimental module contracts or OMI research to stable APIs. [The game contract
and evidence](docs/CLOCKWORK_VAULT.md) document input cancellation, save validation,
approximation limits and attribution to **Brian Thorne’s ARCH OMI**.

## Development and verification

Node.js 22+ is development tooling only. There is no `npm install` for these checks:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/navigation-workload.js --check
node scripts/verify-omi.js --check
node scripts/verify-machine.js --check
node scripts/verify-vault.js --check
node scripts/opt-render-workload.js --check
```

The build stages an allowlisted `dist/` and generates `manifest.json` with sizes
and SHA-256 hashes. The manifest identifies packaged bytes; it is not a signature.
`npm test`, `npm run check`, and `npm run build` are optional aliases.

CI also installs pinned Playwright outside the checkout and exercises the
packaged `/VANILLAJS/` path in Chromium with software WebGL. Its screenshots and
manifest are retained as the `flight-lab-evidence` artifact. See the verification
document for executed checks and remaining coverage limits.

## GitHub Pages

Set **Settings → Pages → Source → GitHub Actions**. Pull requests verify the
package without deploying. Pushes to `main` deploy the same artifact only after
simulation, contract and Chromium checks pass. The workflow separates read-only
validation from Pages deployment permissions. No tag or release is created by CI.

## Scope and licence

This is a compact foundation, not a general rigid-body contact solver. Colliders
use fixed-orientation cubes or rectangular bodies. Body movement uses static
axis-aligned boxes or translating kinematic surfaces; shot queries also track
translating boxes. There are no reciprocal dynamic body contacts, oriented-box contacts, friction, bounce, atmospheric
flight, orbital gravity, audio engine, map editor or network synchronisation yet.
Numerical tolerances and runtime limits are documented in [API.md](docs/API.md).

The repository's existing [Apache-2.0 licence](LICENSE) is preserved. See
[NOTICE](NOTICE) for authorship and reference provenance. No ripped assets or
third-party game engine source are included.
