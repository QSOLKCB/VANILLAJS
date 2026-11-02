# Verification — VANILLAJS 0.2.0

## Mouse-look controls: current change

- **94 Node tests passed locally**, with syntax/module checks and packaging.
  Added cases cover relative input consumption, stationary-pointer no-spin,
  short/held mouse firing, capture-click suppression, late capture cancellation,
  failed-capture drag fallback, touch cancellation and unchanged key mappings.
- Pure flight checks cover yaw/pitch direction, level roll, pitch limits, invalid
  deltas, normalized orientation and five seconds of inertial updates with no
  mouse-induced angular drift or changes to linear velocity.
- `scripts/browser-mouse.js`, called by the packaged Chromium check, exercises
  native Pointer Lock/click/Escape in both labs, synthetic relative mouse deltas
  through the real app and rendered view, arrow/WASD compatibility, blur, and
  rejected capture with real drag input and a stationary held/released view.
  Headless CDP mouse moves under lock produced cancelling cursor-warp pairs;
  explicit MouseEvent deltas test aiming separately from capture lifecycle. Exact-head CI results belong in the PR;
  adding these scenarios alone does not establish a browser pass.
- Chromium is unavailable locally; physical mouse feel, touch hardware, Firefox
  and Safari coverage remain unverified. No runtime dependencies were added.

## Interaction Lab: executed locally

- **79 Node tests passed**: the 49 Flight Lab tests plus 30 query, projectile,
  interaction and recipe regressions. Scenarios include thin-wall occlusion,
  initial overlap, finite range, stable hit ties, clipped lifetime and exact-end
  contact, capacity reclaim, snapshot ownership and atomic rejected steps.
- Rule tests cover missing conditions, resistance, unmatched pairs, strict field
  comparison, priority/id ordering and blocked-rule fallthrough prevention.
- Both recipes exercise successful and rejected impacts through the actual
  projectile/collider/resolver composition. Simultaneous lethal hits apply only
  one damage effect; a change of conditions in flight is sampled at impact.
- 30/60/144 Hz presentation schedules produce identical simulated outcomes in
  the same runtime. Pause freezes cooldown and projectile state, and firing after
  input cancellation requires a fresh keydown. Focus/reset and bounded history
  are covered.
- Syntax/module checks and packaging pass: eight module contracts and 20 public
  files, plus the generated manifest. Catalogue/package versions agree; the build
  reads its manifest version from package.json.

## Interaction Lab: browser execution

Local Playwright tooling was present but its Chromium executable was unavailable,
so the packaged browser suite could not run locally. The PR workflow installs
its own pinned browser and runs both `scripts/browser-check.js` (Flight Lab) and
`scripts/browser-interactions.js` (Interaction Lab). Exact-head results and the
workflow link are recorded in the PR; adding tests alone does not prove a pass.

The added scenarios check rendered geometry, shield rejection and hull damage,
missing ignition/oxygen, water-forming and resisted/empty-chamber outcomes,
fresh-fire pause/resume, frozen in-flight shots, blur, focus/reset, a real touch
event sequence in mobile emulation, a key press/release between physics ticks,
pointer cancellation, narrow layout, context
loss and unsupported WebGL. Screenshots for both recipes and 390 px layout join
the existing `flight-lab-evidence` artifact. Mobile emulation and synthetic
lifecycle events do not establish physical-device coverage.

## Historical Flight Lab 0.1.0 evidence

### Executed locally

- **49 Node tests passed**, including force/mass, torque/inertia, quaternion norm,
  asymmetric gyroscopic response, inertial drift, assistance, braking, frame-rate
  independence, quarter-speed simulation and pause/debt cancellation. Additional
  regressions cover post-brake result consistency and invalid controller samples.
- Keyboard regression tests reproduce the reviewed failure on the prior source:
  repeated keydown reactivated cancelled thrust, steering and braking after clear
  or blur. Eight new failure cases failed before the fix. All now require a fresh
  press; tracked repeats, action edges and multiple bindings remain covered.
- Collision cases include a body moving 10,000 m/s against a 2 cm wall, tangential
  sliding, two-wall corners, moving away from a surface, initial overlap and a
  bounded iteration budget.
- Deterministic control scenarios reach all six signals in each demo through the
  public simulation API and actual world colliders. These are simulated guidance
  tests, not a claim that a human played the routes.
- Syntax checks, module dependency contracts and pure-core boundary checks passed.
- Runtime packaging passed; its manifest records file sizes and SHA-256 hashes.

### Browser checks

The local cloud preview could not create a WebGL context. The visible unsupported
graphics message was observed; local rendered-flight validation is unavailable
in that browser. No GPU/browser restrictions were changed to bypass this limit.

The PR workflow runs `scripts/browser-check.js` against the packaged application
at `/VANILLAJS/` in Chromium using software WebGL. It checks actual rendered pixel
output, both flight modes, thrust, assistance, braking, rotation, pause, held-W
auto-repeat across Escape pause/resume, blur,
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
