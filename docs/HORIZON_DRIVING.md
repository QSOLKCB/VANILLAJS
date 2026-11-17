# Tune and test a vehicle

Open [HORIZON Driving](../demos/horizon-lab/drive.html) through a local HTTP server.
It is a small driving experiment, with real forces and contacts, for learning what
the new vehicle model does. It is not yet the complete HORIZON racing game.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Visit `http://127.0.0.1:8000/demos/horizon-lab/drive.html`. Native modules require
HTTP; double-clicking the HTML file does not provide the required browser origin.
There are no accounts, downloaded assets or package-install requirements.

## First drive

1. Leave the **Handling ground** and **Arcade** settings selected. The original
   study begins paused on a broad, flat pad.
2. Choose **Start driving**. Hold W or ↑ to accelerate. A/D or ←/→ steer.
   S/↓ brakes forward travel, then requests real reverse below 0.5 m/s.
   Hold it to drive backwards. W/↑ transitions safely back to forward;
   Space is an independent brake. There is also a Brake / reverse touch button.
3. Make a gentle right turn. The car travels through world coordinates; it does
   not follow the painted line automatically. Watch position and steering change.
4. Choose **Pause**, or press Escape. Continuous simulation and drawing stop.
   **Restart** begins the same accepted trial again. **Return to start** provides
   explicit recovery after leaving the course, overturning or hitting model limits.

The four on-screen driving buttons also accept held mouse/touch gestures and
keyboard Space/Enter. Releasing or cancelling a pointer releases its control.
Leaving the window pauses and clears controls. Choose Start/Resume and release
previously held keys before applying fresh input.

## Make a change you can feel

The Engineering desk edits a draft. **Apply tuning & reset** validates it before
replacing the accepted study, then returns the car to the start for comparison.

| Experiment | Change | Observe |
| --- | --- | --- |
| Powertrain | Set torque scale to 0.5, then compare with 1.5 from the same starting recipe | Acceleration and RPM; tyre grip still limits available force |
| Gearing | Change final drive or the comma-separated forward ratios | RPM at a given speed and shift timing; ratios must strictly decrease |
| Grip | Reduce asphalt friction to 0.35 | Longer stopping and wider/slipping turns; each wheel has its own contact |
| Steering | Reduce steering limit or increase speed reduction | Less steering angle at speed and a larger turning circle |
| Suspension | Compare spring/damper settings | Corner compression, load, settling, pitch and roll |
| Driven wheels | Compare front, rear and all four | Thrust is applied only through the selected contacted wheels |

Torque scale multiplies the currently accepted curve, then returns to 1 in the
form. For a fair fresh comparison, use **Original study** or load a handling
profile before changing the multiplier. A value is not accepted merely because
it fits in a form field: combinations must also support the static vehicle weight
within the suspension travel. Invalid tuning reports the reason and retains the
accepted study.

**Load profile** chooses a parameter set of the same model: Arcade is more
responsive, Simulation-oriented allows a different steering/traction response.
Neither is a calibrated real car. You can inspect all accepted values in
**Inspect or edit study JSON**. Undo/Redo retains up to 24 accepted studies.

Automatic gearing is enabled initially. Turn it off for manual comparison and
request a gear while driving. Direction changes need low speed; shift cooldown
still applies. Neutral disconnects engine drive/braking. Braking remains available.

## Three proving environments

- **Handling ground:** a flat pad with visible orange barriers, useful for
  isolating acceleration, turning and braking.
- **Ramp & landing:** a raised launch face over the pad. Drive up it to inspect
  contact loss, ballistic motion and suspension recovery on landing.
- **Aster Coast:** the lab-owned elevated, banked road from the scenery workshop,
  with separate road and terrain surfaces.

Orange boxes are the explicit swept collision barriers. Road, terrain, shoulder
and ramp support come from the same Float32 triangles that are drawn. Faces too
steep for the support contract are excluded. Trees, buildings, bridge masonry
and tunnel shells are visual decoration; they are not arbitrary mesh colliders.
The chassis barrier approximation is deliberately conservative and can stop the
car before its visible body touches a wall.

Chase, Bonnet and Overlook change the view. High/Low detail changes visual budgets
and resets the trial while preserving the physics parameters. Camera or material
changes do not feed back into authoritative force calculations. Native context
loss pauses the trial; restoration rebuilds the view and requires explicit resume.

## Read the diagnostics

Each wheel row shows ground/air contact, spring compression in metres, support
load in newtons and a slip diagnostic. Contact IDs are available on the contact
cell. RPM, gear and shift cooldown explain drivetrain behavior. Barrier contacts
and world position explain where motion stopped. GPU upload count helps confirm
that driving reuses retained meshes instead of rebuilding the scene each frame.

The model advances at 120 fixed calls per second, with internal 240 Hz quanta.
The HUD tick counter counts lab calls, not screen frames. Delayed frames have a
bounded catch-up budget; time beyond that budget is dropped instead of running
an unbounded simulation backlog.

## Keep and reuse your work

**Export vehicle** downloads `qsol.vanillajs.vehicle3d.v1`: validated mass/inertia,
geometry, spring/damper, tyres, steering, torque curve, gearbox and drag parameters.
It does not contain a world, current speed, callbacks or a renderer.

**Export study** downloads `qsol.vanillajs.horizon-drive.v1`: the vehicle, scenery,
course selection and three surface-friction coefficients. **Import study** or the
JSON panel validates the whole replacement before acceptance. Unsupported,
oversized, executable or malformed fields reject. The separate scenery workshop's
`qsol.vanillajs.horizon-lab.v1` and Track Foundry v1 remain unchanged.

These downloads are reusable inert data, not a complete game or saved match. A
consumer imports [`vehicle3d`](VEHICLE3D_API.md), supplies its own trusted surface
and barrier adapter, and owns input, rendering, audio, rules and packaging. Pin an
immutable reviewed engine release and preserve Apache-2.0 notices/source provenance.
For the complete racing creator workflow and playable export, open
[Race Foundry](../demos/horizon-lab/index.html).

For offline use, build and verify the repository package, serve `dist/`, and visit
while online once so its worker can install. The race, scenery and driving pages and their complete
native-module graph are included. An uncached browser cannot start offline.
Exports require a consumer package; they do not themselves install a service worker.

[API and limits](VEHICLE3D_API.md) · [Milestone and evidence](HORIZON_002.md) ·
[Scenery workshop](HORIZON_LAB.md) · [Creator Hub](../demos/creator-hub/index.html)
