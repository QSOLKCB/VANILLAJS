# Verification — VANILLAJS 0.7.0

## Shared flow fields: current change

- **196 Node tests passed locally**, retaining all 176 previous tests. New core
  checks cover bounded build slices, publication only on completion, ownership,
  cancellation, blocked/unreachable cells, stable multi-goal ties, descending
  paths, immutable terrain identity and the full 65,536-cell grid. Every cell on
  40 seeded maps is compared with per-goal A*; old A* has its independent BFS oracle.
- Flow convoy delivers all 24 couriers; Two-exit evacuation delivers all 36 and
  exercises both exits. Active-cell and visible-circle separation are checked
  every tick. Tests also close an exit, edit gates, replace partial builds, reject
  occupied/depot gates, hold unreachable units, pause/reset and compare identical
  30/60/144 Hz input schedules. These are automated simulations.
- `scripts/navigation-workload.js --check` reproduces the eight recorded rows in
  `docs/NAVIGATION_WORKLOAD.json`: 1/24/128/512 requests on 32×32 and 64×64 maps.
  Every route cost agrees. It records settled search cells, excluding setup,
  heap, lookup, traffic and rendering costs; it is not a browser speed benchmark.
- Syntax/purity/dependency checks cover 55 JS files and eleven modules. Packaging
  contains 33 public files and the generated SHA-256 manifest. Fourteen recipes
  are registered; all runtime code remains native and dependency-free.
- `scripts/browser-flow.js` adds partial-build pause, replacement cancellation,
  blocked goals, gate rebuilding, complete 24/36-unit delivery, exit closure,
  blur/reset, recipe switching and 390 px touch-emulated controls. All earlier
  browser checks remain enabled. Exact-head results, screenshots and workload
  artifact verification are recorded in the PR after CI actually executes.
- Local Chromium is unavailable; packaged Chromium runs in CI. Blur is synthetic
  and touch uses emulation. Physical devices, other browsers, weighted terrain,
  general crowd dynamics and large-army frame rates remain unverified.

## Historical RTS routing (0.6.0)

- **176 Node tests passed locally**, including all previous 156 regressions.
  New tests cover immutable grids, coordinate/boundary validation, shortest paths,
  ties, unreachable/blocked/budget outcomes and unique reachable formation slots.
  An independent breadth-first oracle compares costs on 80 seeded 12 × 9 maps.
- Route planner and all six Squad orders units reach their destinations through
  actual terrain. Every simulated tick checks distinct cell occupancy and visible
  unit separation. Other scenarios cover gate closure/replanning, occupied gates,
  atomic rejected group orders, in-flight replacements, stop semantics, swaps,
  vacancy chains, contention, pause/reset and 30/60/144 Hz composition.
- Syntax/purity/dependency checks cover 49 JS files and eleven modules. The
  allowlisted package has 31 public files and a SHA-256 manifest. Twelve recipes
  are registered. No runtime dependency is added; Canvas 2D is a browser API.
- `scripts/browser-rts.js` adds rendered pixels, pointer/keyboard orders, blocked
  goals, gate replanning, complete route/squad arrivals, drag selection, late
  pointer-release cancellation, blur/reset, Canvas failure and 390 px emulated
  touch controls. All prior browser scenarios remain enabled. Exact-head results
  and screenshot inspection are recorded in the PR, not inferred from test code.
- Local Chromium is unavailable; the packaged suite runs in CI. Blur and Canvas
  failure events are synthetic; mobile controls use touch emulation. Physical
  devices, other browsers and large-army performance remain unmeasured. Bounded
  traffic safety does not establish deadlock freedom or optimal squad scheduling.

## Historical platform riding (0.5.0)

- **156 Node tests passed locally**, including all previous 138 regressions.
  New movement checks cover ascending/descending/diagonal carry, stable reversals,
  inherited jump velocity once, walk-off/landing, headroom clearance,
  crush rejection with unchanged body state, side-wall sliding, stable support
  ties, initial-overlap rejection, a fast crossing wall, invalid input and zero dt.
- Recipe simulations complete both courses through real geometry and support-
  sensitive markers, test the lift interlock and crouch/reverse recovery, shuttle
  jump/landing, fall recovery, pause/reset and 30/60/144 Hz composition in one
  runtime. These are simulations, not human/device playthrough claims.
- Syntax/purity/dependency checks pass for 43 JS files and ten modules. Packaging
  contains 26 public files and a SHA-256 manifest. Ten recipes are registered;
  no runtime dependency was added.
- `scripts/browser-platforms.js` adds packaged lift carry/pause, clearance stop,
  crouch recovery and complete upper-deck transfer; shuttle jump/landing/reversal,
  blur/reset and 390 px touch-emulated layout. Earlier browser checks all remain
  enabled. Exact-head execution and screenshots are recorded in the PR; adding
  scenarios by itself does not establish a browser pass.
- Local Chromium is unavailable. CI uses packaged software WebGL; the new controls
  use native browser keyboard/tap input while blur is synthetic. Physical devices,
  additional browsers, performance and multi-rider scaling remain unmeasured.

## Historical FPS motion (0.4.0)

- **138 Node tests passed locally**, including all previous 117 regressions.
  New cases cover feet/eye anchoring, safe standing under roofs and partial
  overhangs, airborne stance changes, crouched speed/jumps, invalid dimensions,
  zero ticks, input cancellation and rejection without partial state updates.
- Relative-motion tests cover crossing targets missed by both static endpoints,
  targets escaping before impact, matching velocity, stationary shots, overlap,
  cube expansion, world-space hit points, walls, ties and ignores. Lifetimes clip
  both trajectories; contact at expiry wins. Subdivided linear movement agrees
  with a single query, including a high-speed crossing.
- Recipe scenarios traverse Low passage, clear moving plates with leading bolts
  and finite reloading, distinguish instantaneous traces from moving shots, freeze
  tracks on pause, reset/focus safely, and produce identical results at 30/60/144 Hz
  presentation schedules in the same runtime. These are automated simulations.
- Syntax/purity/dependency checks cover 40 JS files and ten modules. The allowlisted
  build contains 26 public files and a SHA-256 manifest; no runtime dependencies.
- `scripts/browser-fps-motion.js` adds packaged checks for low-ceiling entry,
  crouch/blocked-standing/clearance, held-C cancellation, target motion, paused
  tracks, delayed moving-plate impacts, instant traces, blur/reset, on-screen
  keyboard control and 390 px touch-emulated layout. All earlier browser tests
  remain enabled. Exact-head execution results and screenshots belong in the PR;
  the presence of these scenarios alone does not establish a browser pass.
- Local Chromium is unavailable; browser execution uses the existing CI workflow.
  Blur and old relative-aim checks use synthetic events. New movement/fire controls
  use browser keyboard input; mobile recipe buttons use emulated taps and crouch
  uses keyboard activation. Physical touch/mouse feel, other browsers, performance
  and scaling have not been measured.

## Historical FPS Lab (0.3.0)

- **117 Node tests passed locally**, including all previous 94 regressions.
  New checks cover rectangular extents, stable support, jump apex/landing,
  midair rejection, pitch-independent walking, diagonal/sprint speed limits,
  stairs, tall obstacles, low ceilings, ledges, snap limits and thin-wall sweeps.
- Recipe scenarios complete Footwork through actual course colliders and clear
  all three range plates with finite ammunition and reloading. Traces/bolts both
  stop at intervening cover; bolts arrive later. Pause freezes motion, projectiles
  and weapon state. 30/60/144 Hz presentation schedules produce identical outcomes
  in the same runtime. These are simulations, not human playthrough claims.
- Syntax checks, ten module dependency/purity contracts and the allowlisted
  26-file package pass. The generated manifest records SHA-256 hashes.
- `scripts/browser-fps.js` runs through the packaged project subpath, adding
  rendering, sprint/stairs/jump, input cancellation, capture/relative aiming,
  ammo/reload pause, trace/bolt outcomes, focus/reset, mobile touch taps, layout,
  context loss and unavailable-WebGL cases to the existing suite. Exact-head
  execution results and screenshot evidence are recorded in the PR.
- Local Chromium remains unavailable. Relative aim and blur use synthetic
  events; capture/click/Escape and mobile-emulated taps use browser input. No
  physical-device, cross-browser, frame-rate performance or scale claim is made.

## Historical mouse-look controls after 0.2.0

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

The solver is deliberately limited to a moving axis-aligned cube or rectangular body against static
boxes. It is neither a sphere/capsule sweep nor a general rigid-body contact
solver. Numerical integration is approximate. Repeatability is tested within one
JS runtime; cross-engine bit-identical simulation is not claimed.
