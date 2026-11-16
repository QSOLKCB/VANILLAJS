# vehicle3d — Fixed-step world-space vehicles

Experimental pure module: [`modules/vehicle3d/index.js`](../modules/vehicle3d/index.js).
The API uses metres, seconds, kilograms, newtons, newton-metres, radians and RPM.
The world is right-handed, +Y up and local -Z forward. Position is the chassis
centre of mass, not the visual mesh's neutral ground origin. Quaternions are xyzw.

## Start with an explicitly owned vehicle

```js
import {createVehicle, vehiclePreset, VEHICLE_STEP}
  from './modules/vehicle3d/index.js';

const vehicle = createVehicle(vehiclePreset('arcade'));
const world = {
  sampleSurface(x, z, maxY) {
    return maxY >= 0
      ? {height: 0, normal: [0, 1, 0], friction: 1, surfaceId: 'floor'}
      : null;
  },
  barriers: []
};
let state = vehicle.spawn({position: [0, 2, 0]});
// Run from the consumer's bounded fixed-step loop, not once per render frame.
state = vehicle.step(state, {throttle: 0.5, brake: 0, steer: 0}, world, VEHICLE_STEP);
```

This example supplies a trusted flat plane. JSON files cannot supply this callback.
The game owns its loop, listeners, devices, rendering, world and rules. No instance
starts a timer, reads browser input, draws, fetches data or mutates global state.

## Public API

| API | Contract |
| --- | --- |
| `VEHICLE_FORMAT` | `qsol.vanillajs.vehicle3d.v1` |
| `VEHICLE_BYTES` | 16 KiB serialized recipe limit |
| `VEHICLE_STEP` | Recommended external step, 1/120 second |
| `vehiclePreset('arcade' \| 'simulation')` | Owned starting parameter recipe; original approximate tuning, not real vehicle data |
| `validateVehicle(value)` | Validate and own the complete supported recipe |
| `parseVehicle(text)` / `serializeVehicle(value)` | Strict bounded JSON admission/export |
| `createVehicle(recipe)` | Explicit controller with its accepted recipe, `spawn`, `step` and `recover` |
| `spawn({position,yaw,pitch,roll,velocity})` | Create new owned state; omitted pose values use documented module defaults |
| `step(state,input,world,dt)` | Return a new state after validated bounded fixed steps; supplied state is not mutated |
| `recover(state,pose)` | Explicit reset to a caller-chosen pose, preserving the tick counter; the engine does not guess a checkpoint |
| `vehiclePose(state,recipe)` | Approximate adapter to the existing scenery visual-rig pose; wheel compression is capped to that rig’s 0.25 m limit |

Controls are optional fields `throttle` and `brake` in 0..1, `steer` in -1..1
and an integer `gear` request. Unknown control fields reject. Positive steering turns right; this corresponds to
negative right-handed Y yaw when initially facing -Z. Gear -1 is reverse, 0 is
neutral and positive values index the forward ratios. Automatic shifts use the
recipe's gearbox settings; gear changes interrupt drive for `shiftTime`. Changing
to a gear opposing the current travel direction is rejected above 2 m/s. Neutral
remains available, and a coasting vehicle can re-engage a gear matching its travel.

The default spawn has zero yaw/pitch/roll and velocity, and starts at X=Z=0 with
COM height `wheel.radius + suspension.restLength - mass*9.81/(4*suspension.spring)`.
This is the flat-ground static-height estimate, not an automatic world query.

State includes tick, centre-of-mass position, normalized orientation, world-space
linear/angular velocity, steering, gear/RPM/shift time and wheel spin. Four wheel
records are ordered front-left, front-right, rear-left, rear-right and expose hub
position, `contactPoint`, contact normal/ID, compression/load,
longitudinal/lateral speed and slip. A grounded hub is one wheel radius vertically
above its contact point. This vertical wheel/suspension approximation is explicit;
it is not a sphere contact solver on steep banks.
Contact positions describe the accepted end pose; force/slip diagnostics describe
the last internal substep. `contacts`, `truncated` and `needsRecovery` report the
current public step, accumulating events across its substeps. The lab displays
these diagnostics rather than inferring contact from pixels.

## Versioned parameter data

The complete recipe declares `format`, `version`, `name`, `mass`, diagonal
body-space `inertia`, `chassis`, `wheel`, `suspension`, `tyres`, `steering`, `engine`,
`gearbox`, `drive` and `drag`. Groups contain:

| Group | Fields |
| --- | --- |
| chassis | width, length, height |
| wheel | radius, wheelbase, track |
| suspension | restLength, travel, spring, damper |
| tyres | grip, corneringStiffness, rollingResistance |
| steering | maxAngle, rate, speedReduction |
| engine | idleRPM, redlineRPM, ordered `[rpm, torque]` torqueCurve, engineBrake |
| gearbox | forward ratios, reverseRatio, finalDrive, efficiency, shiftTime, automatic |
| drive | `front`, `rear` or `all` |

Use a preset as the complete starting envelope; unknown/missing/executable fields,
invalid versions, non-finite values and unsupported bounds reject. Validation is
not arbitrary expression evaluation. Imported text, names and numeric data cannot
change executable behavior outside the fixed vocabulary. The old road-arcade and
track formats are unchanged.

## Admission bounds

- Mass: 500–4000 kg; each diagonal inertia: 100–20000 kg·m².
- Chassis width 1–3 m, length 2.5–7 m, height 0.6–2.5 m. Wheel radius
  0.2–0.65 m, wheelbase 1.5–4.5 m and track 0.8–2.6 m; centres fit the chassis.
- Suspension rest length 0.2–0.8 m, travel 0.08–0.6 m (no more than rest), spring
  5000–120000 N/m, damper 0–14000 N·s/m. Static corner load `mass*9.81/4` must
  compress less than 90% of travel. Zero damping is permitted as an experiment.
- Tyre grip 0.1–2, lateral stiffness 100–12000 N per m/s of lateral speed,
  rolling resistance 0–0.08. Steering limit 0.1–0.65 rad, rate 0.1–5 rad/s and
  speed reduction 0–0.15 s/m.
- Idle 400–2000 RPM, redline 2500–10000 RPM. Two to twelve strictly ordered
  curve points cover exactly idle to redline; torque is 0–1000 Nm. Engine
  braking is 0–300 Nm.
- One to eight strictly descending forward ratios (0.3–6), reverse 0.5–6,
  final drive 1–6, efficiency 0.5–1 and shift interruption 0.05–1 s.
- Quadratic drag coefficient 0–2 kg/m; drag force is `-drag*|velocity|*velocity`.

Names are bounded printable text. Returned recipes are owned and deeply frozen;
`vehiclePreset` provides a mutable copy for editing. Runtime state also has finite
bounds: world coordinates ±2000 m, tick ≤1 billion, velocity and angular limits.
Spawn positions stay within ±1990 m. Invalid inputs and out-of-domain outputs throw
without mutating accepted state; a game should pause and offer recovery on failure.

## Contacts and solid barriers

`world.sampleSurface(x,z,maxY)` is a trusted synchronous function. It returns null
or the highest admitted support at/below `maxY`, with a finite height, upward unit
normal (Y ≥ 0.15), friction coefficient in 0–2 and stable surface ID. Correct height filtering is
essential: a bridge deck and ground beneath it are distinct surfaces. The engine
validates returned contacts but cannot prove a callback describes the game world.

`world.barriers` contains at most 64 uniquely named boxes: an explicit collection of static `{id,min,max}` AABBs.
Only supplied barriers are solid. The HORIZON adapter samples actual Float32 road,
terrain, shoulder and proving-ground triangles and supplies visible orange
barriers. Buildings, foliage, tunnel shells and bridge masonry are decoration;
there is no implied arbitrary mesh collision system.

Barrier sweeps use a fixed cube with half-extent equal to half the chassis diagonal,
covering every orientation over the step. This is intentionally conservative: it
can stop a car before its visible body reaches a narrow opening. It is not an OBB,
rotating mesh or moving-vehicle collision solver. Suspension bottom-out correction
uses the same sweep, and impossible ground/ceiling clearance requests recovery.
Explicit recovery locations must themselves be checked by the consumer.

Suspension queries are vertical and use prior/current wheel-mount ceilings during
landing, so a falling mount cannot simply lose a deck by passing below it. Finite
substeps and destination queries do not prove contact with every arbitrarily thin
terrain feature crossed horizontally. Use suitably resolved support geometry;
continuous no-tunnelling guarantees apply to the supplied static barrier sweeps.

## Numerical identity and approximations

Spring force uses compression and contact-point normal velocity, with each wheel's
force bounded to four times the total vehicle weight. Lateral force
opposes slip speed; longitudinal demand combines engine, braking and rolling drag.
Their vector sum is capped to `load * tyreGrip * surfaceFriction`. Weight transfer
arises from contact torques and sprung body motion; the model has no separate
unsprung wheel mass or tyre slip-ratio state. The engine couples RPM to ground
speed with a bounded response and a simplified low-speed clutch. Wheel spin is a
presentation accumulator around local +X (negative for forward -Z travel), not
an authoritative drivetrain degree of freedom.

Semi-implicit translation, quaternion rotation and a small explicit angular drag
advance the chassis. Speed is capped at 120 m/s and angular speed at 12 rad/s;
hitting those caps flags `needsRecovery`. Body-up Y below 0.2 and truncated
barrier motion also request recovery. These bounds are model limits, not normal
handling features. Free flight remains supported. When body-up Y falls to 0.15
or below, wheel support is disabled; an overturned car requires explicit recovery
because chassis-to-ground collision and rollover recovery are not implemented.

The recommended consumer step is 1/120 s. Supported call intervals are 1/240,
1/120 and 1/60 s, integrated through the same 1/240 s substeps. The state `tick`
counts those 1/240 s quanta, not public calls. Equal input schedules
at those substep boundaries are independent of drawing cadence. Changing inputs
at different times changes the trajectory. Bounded catch-up and fresh-input
requirements on pause/blur remain the consumer's responsibility.

The simulation uses Float64 arithmetic and quaternion rotation. Same-runtime
replay is tested separately from GPU output; cross-browser bitwise identity,
Q16.16 exactness or real-world vehicle fidelity is not claimed. Spring/damper
contacts and limited tyre forces approximate weight transfer, grip and recovery.
There is no full tyre thermodynamics, tyre deformation, unsprung wheel solver,
drivetrain differential or manufacturer calibration.

The [milestone](HORIZON_002.md) and [driving tutorial](HORIZON_DRIVING.md) separate
this reusable model from game content, visual presentation and HORIZON-003 work.
