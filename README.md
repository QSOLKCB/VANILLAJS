# VANILLAJS — reusable game modules

Reusable, original JavaScript game modules built directly on web standards.
**v0.3.0 milestone: ten modules, Flight Lab, Interaction Lab and FPS Lab.**

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
```

There is no runtime installation, build step, npm dependency, CDN, account,
telemetry, external asset download or backend. All geometry is procedural.
WebGL 1 is required; a visible error explains unsupported graphics. Serve over
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

Launch, then click the view for mouse look. **WASD** moves, **Space** jumps,
**Shift** sprints, **arrows** aim, captured **left click / F** fires, and **R**
reloads. Escape releases the cursor and pauses. On-screen controls and relative
look dragging remain available. A brief jump/fire/reload press survives until
its next physics tick. Pause clears controls and freezes ammunition timers;
resume requires fresh presses. The range's alignment buttons pause and reposition
the character while preserving ammunition and scores.

The default controller walks at 5 m/s, sprints at 8 m/s, and climbs steps up to
30 cm. It is an upright **rectangular box**, with static world collision and a
fixed eye height. This slice does not implement capsules, slopes, crouching,
moving platforms or moving-target collision. See [FPS contracts](docs/FPS_LAB.md).

## Modules

| Import directory | Responsibility |
| --- | --- |
| `modules/math/` | Vectors, quaternions, camera matrices, seeded random numbers |
| `modules/time/` | Fixed ticks, interpolation fraction, pause, time scaling and catch-up limits |
| `modules/collision/` | Swept cube/rectangular-body movement and finite ray/segment queries against static AABBs |
| `modules/character/` | Upright walking, sprinting, jumping, stair stepping and first-person view |
| `modules/weapons/` | Simulation-time fire cadence, magazines and finite-reserve reloading |
| `modules/flight/` | Force/torque integration; assisted and inertial control |
| `modules/input/` | Pure action state, keyboard/mouse adapters and standard gamepad sampling |
| `modules/render-webgl/` | Minimal WebGL 1 triangle, line and point rendering |
| `modules/projectiles/` | Bounded constant-velocity projectiles, swept impacts and lifetimes |
| `modules/interactions/` | Ordered conditions → effects with explicit outcome reasons |

All APIs are **experimental** in 0.3.0. Use a tagged release or exact commit,
preserve the directory structure and record what your game imports. The
machine-readable catalogue lists each module's dependency closure and environment.
Core modules neither own an animation loop nor read the DOM or ambient time.

## Development and verification

Node.js 22+ is development tooling only. There is no `npm install` for these checks:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
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
are fixed-orientation cubes or rectangular bodies against static axis-aligned boxes. There are no
dynamic body contacts, oriented-box contacts, friction, bounce, atmospheric
flight, orbital gravity, audio engine, map editor or network synchronisation yet.
Numerical tolerances and runtime limits are documented in [API.md](docs/API.md).

The repository's existing [Apache-2.0 licence](LICENSE) is preserved. See
[NOTICE](NOTICE) for authorship and reference provenance. No ripped assets or
third-party game engine source are included.
