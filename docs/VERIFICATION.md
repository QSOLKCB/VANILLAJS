# Verification — Flight Lab 0.1.0

## Executed locally

- **40 Node tests passed**, including force/mass, torque/inertia, quaternion norm,
  asymmetric gyroscopic response, inertial drift, assistance, braking, frame-rate
  independence, quarter-speed simulation and pause/debt cancellation. Additional
  regressions cover post-brake result consistency and invalid controller samples.
- Collision cases include a body moving 10,000 m/s against a 2 cm wall, tangential
  sliding, two-wall corners, moving away from a surface, initial overlap and a
  bounded iteration budget.
- Deterministic control scenarios reach all six signals in each demo through the
  public simulation API and actual world colliders. These are simulated guidance
  tests, not a claim that a human played the routes.
- Syntax checks, module dependency contracts and pure-core boundary checks passed.
- Runtime packaging passed; its manifest records file sizes and SHA-256 hashes.

## Browser checks

The local cloud preview could not create a WebGL context. The visible unsupported
graphics message was observed; local rendered-flight validation is unavailable
in that browser. No GPU/browser restrictions were changed to bypass this limit.

The PR workflow runs `scripts/browser-check.js` against the packaged application
at `/VANILLAJS/` in Chromium using software WebGL. It checks actual rendered pixel
output, both flight modes, thrust, assistance, braking, rotation, pause, blur,
reset, narrow layout and the unsupported-WebGL path. Check the workflow result
for the exact commit; merely committing the script does not establish a pass.
Screenshots and the package manifest are stored as `flight-lab-evidence`.

The initial implementation at `54de65dce3014fc60bbd326ae6dd695a2383ea78` passed
[Chromium and all CI checks](https://github.com/QSOLKCB/VANILLAJS/actions/runs/41455294082).
The desktop and 390 px screenshots were inspected. The downloaded artifact's
SHA-256 matched its GitHub digest, and all 14 packaged file hashes matched the
initial source snapshot, including the unchanged licence. Later commits must
obtain their own green workflow result.

## Limits

Physical gamepads, touch devices, Firefox, Safari and diverse GPU/driver hardware
have not been validated. Pure gamepad tests use synthetic standard-mapping data.
Software WebGL does not establish physical-GPU performance or controller feel.
No benchmark FPS or maximum unit count is claimed.

The solver is deliberately limited to a moving axis-aligned cube against static
boxes. It is neither an exact sphere sweep nor a general rigid-body contact
solver. Numerical integration is approximate. Repeatability is tested within one
JS runtime; cross-engine bit-identical simulation is not claimed.
