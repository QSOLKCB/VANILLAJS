# VANILLAJS — Flight Lab

Reusable, original JavaScript game modules built directly on web standards.
**v0.1.0 milestone: six modules, two flight experiments, one shared simulation.**

[Build a game](BUILD_A_GAME.md) · [API contracts](docs/API.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Verification](docs/VERIFICATION.md) ·
[Roadmap](ROADMAP.md) · [Module catalogue](MODULES.json)

## Run Flight Lab

Download or clone the repository, then serve its root with any static HTTP server:

```sh
python3 -m http.server 8000
# Open http://localhost:8000
```

There is no runtime installation, build step, npm dependency, CDN, account,
telemetry, external asset download or backend. All geometry is procedural.
WebGL 1 is required; a visible error explains unsupported graphics. Serve over
HTTP(S): opening `file://index.html` is not supported by the ES-module entrypoint.
The local server works without internet access. Hosted offline reload via a
service worker is a future feature, not included in this milestone.

## Two experiments

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
| Pitch / yaw | Arrow keys, or drag the view like a joystick | Right stick |
| Roll | Q / E | LB / RB |
| Brake translation and rotation | Hold X | Hold A |
| Bullet time | Hold B; or use the time slider | Use the time slider |
| Pause / resume | Esc or the Pause button | Menu after launch |
| Restart | Reset | On-screen Reset |

Expand **Mouse, touch & gamepad controls** for on-screen flight buttons. Multiple
simultaneous pointers are supported. Dragging the view controls angular input;
releasing it centres the input, while inertial angular motion continues.
There is no pointer lock. Keyboard controls provide every flight axis.

Blur, hidden tabs and controller disconnect pause play. Resume is deliberate;
held inputs are cleared, and gamepads must return to neutral. Unmapped gamepads
are ignored rather than guessed. Experiments are session-only, with no saved
scores or progression. Menus support keyboard navigation and status announcements;
the 3D flight itself requires visual/spatial interaction.

## Modules

| Import directory | Responsibility |
| --- | --- |
| `modules/math/` | Vectors, quaternions, camera matrices, seeded random numbers |
| `modules/time/` | Fixed ticks, interpolation fraction, pause, time scaling and catch-up limits |
| `modules/collision/` | Swept axis-aligned cube versus static AABBs, sliding and overlap recovery |
| `modules/flight/` | Force/torque integration; assisted and inertial control |
| `modules/input/` | Pure action state, keyboard adapter and standard gamepad sampling |
| `modules/render-webgl/` | Minimal WebGL 1 triangle, line and point rendering |

All APIs are **experimental** in 0.1.0. Use a tagged release or exact commit,
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
are fixed-orientation cubes against static axis-aligned boxes. There are no
dynamic body contacts, oriented-box contacts, friction, bounce, atmospheric
flight, orbital gravity, audio engine, map editor or network synchronisation yet.
Numerical tolerances and runtime limits are documented in [API.md](docs/API.md).

The repository's existing [Apache-2.0 licence](LICENSE) is preserved. See
[NOTICE](NOTICE) for authorship and reference provenance. No ripped assets or
third-party game engine source are included.
