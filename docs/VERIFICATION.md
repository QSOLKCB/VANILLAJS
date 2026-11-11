# Verification — VANILLAJS 1.0.0

## ALIEN-MATH-006 — executed local evidence, owner review pending

Base: `ce7e38eb3c7412407a3ba2bc472120b589e6eb9e` (PR #69 merge).

- Lean 4.35.0 kernel-checked 21 model theorems; independently pinned exact types
  and transitive axioms passed. Allowed assumptions are explicitly propext,
  Classical.choice and Quot.sound, reported per theorem; no axiom-free or full
  JavaScript-refinement claim is made.
- Production JavaScript, executable Lean model and independent Python oracle
  matched all 856 finite observations. All prior ALIEN-MATH-001–005 and CI invariant
  oracle fixtures reproduced unchanged. Source/contract/verifier/domain/toolchain
  pins passed against the exact reviewed baseline and current new-phase inputs.
- All six compiled negative controls were refused: removed theorem, weakened
  type, unapproved axiom, proof hole, wrong coefficient and a mathematically valid
  D4 representation with the wrong named-action convention. Forged/missing/damaged
  metadata, axiom output and finite-stream unit controls also passed.
- During development the executable Lean bridge initially lacked default instances
  required by indexed array access; adding them fixed compilation. Final review
  also fixed elan default-toolchain drift by resolving the absolute compiler in
  the checkout before temporary builds. The full formal/negative-control gate and
  Node suite passed again through the normal launcher. No failed gate was waived.
- 589 Node tests passed; source check: 226 JavaScript files, 43 module contracts,
  two experiments. Build and offline verifier passed all 127 packaged files.
  Runtime package bytes are unchanged from phase 005.
- Pinned Playwright 1.64.0 / Chromium 156.0.8078.4 headless SwiftShader preflight
  and all seven browser suites passed: seven executed / zero reused, because local
  authenticated authority was unavailable. Separate read-only GitHub audit still
  reports main unprotected. No qualifying receipt or physical-GPU claim was issued.
- Existing 11 archival/offline blocks and 14 CPU workloads passed. Historical
  Q16 Lean compilation, typed/axiom audit (14 theorems, unchanged allowlist) and
  exact-source bridge passed: 220,921 accepted, 33,992 rejected arithmetic cases
  and 200,009 square-root checks. No old proof source or receipt was rewritten.

[ALIEN-MATH-006](ALIEN_MATH_006.md) inventories all formal coverage and OPEN
obligations, fixture hashes, assumptions and reproduction commands. New evidence
is source-pinned model proof plus finite conformance, not universal ECMAScript
refinement, arbitrary graph-size correctness, physical accuracy or hardware
attestation. No release/tag/deposit or FINAL-phase work is authorized here.


## ALIEN-MATH-005 — executed local evidence, owner review pending

Base: `e2176b0e5f04060ef4bec6acd8a11398e4b86746` (PR #68 merge).

- 587 Node tests passed with zero final failures. Coverage includes bounded graph
  admission, deterministic BFS/DFS, exact invariants/polynomials, 1,536 exhaustive
  four-vertex relabelings, D4 grid automorphisms, maximal-size Cayley-Hamilton
  checks, and a cospectral non-isomorphism counterexample.
- Independent Python subset-determinant/Fraction oracle reproduced 211 graph
  cases: seven fixed, all 76 labelled graphs on 0..4 vertices, and 128 seeded.
  ALIEN-MATH-001–004 and CI invariant oracle reproductions also passed unchanged.
- Tests failed as expected before implementation. Fault injection initially found
  that an identity/no-op relabeling escaped invariant-only comparisons. Explicit
  asymmetric expected-edge checks closed that test gap. Reruns rejected all four
  disposable faults: polynomial sign, BFS depth, ignored permutation and triangle
  double counting. The production implementation did not need a change.
- Source check passed: 225 JavaScript files, 43 module contracts, two experiments.
  Build and independent offline verification passed: 127 packaged files.
- Pinned Playwright 1.64.0 / Chromium 156.0.8078.4 headless SwiftShader preflight
  and all seven packaged suites passed. Graph Lab also passed a targeted browser
  check; desktop and 320px screenshots were visually inspected. Covered exact
  displayed polynomial, cospectral distinction, traversal/relabel/D4 controls,
  empty/disconnected states, Canvas failure and responsive layout.
- Browser decisions: seven executed / zero reused; local authenticated authority
  unavailable. Read-only GitHub audit separately confirmed main is unprotected.
  No trusted receipt was issued. New browser source/harness/contract identities
  are explicitly included in the reviewed dependency policy.
- Existing 11 archival/offline blocks and 14 CPU reference workload steps passed.
  No physical GPU, owner-only workflow or self-hosted runner was used.

See [ALIEN-MATH-005](ALIEN_MATH_005.md) for reproduction, resource bounds and
input/fixture SHA-256. Original Apache-2.0 implementation; no historical receipt,
release artifact, existing mathematics, Q16/QFLOAT backend or Lean/SPARK proof
changed. No eigensolver/physical-spectrum claim or formal source refinement.
Phase 006 and the final freeze remain unauthorized pending review and merge.


## ALIEN-MATH-004 — executed local evidence, owner review pending

Base: `0d2aaf4dd0d9e6fa889d6bb273164247e640d5a8` (PR #67 merge).

- 579 Node tests passed, zero failures in the final run. D4 checks cover all 64
  products and 512 associativity triples, point/box actions and inverses,
  orientation covariance, distance/relations, hostile inputs and 256-bit bounds.
- The independent Python integer-matrix/Fraction oracle reproduced all 8,320
  observations and the frozen Cayley table. ALIEN-MATH-001–003 and CI invariant
  Python fixture checks also passed unchanged.
- Tests first failed as expected before the new module existed. Four intentional
  defects in disposable copies (composition, reflection, distance and box action)
  were each rejected; the unmodified copy passed. No failing gate was waived.
- Source check passed: 220 JavaScript files, 42 module contracts, two experiments.
  Build and independent offline verification passed for all 122 packaged files.
- Real isolated Playwright 1.64.0 / Chromium 156.0.8078.4 headless SwiftShader
  preflight and all seven packaged suites passed. Seven executed / zero reused:
  local GitHub authority was unavailable, and a separate read-only API audit
  confirmed main remains unprotected. No qualifying receipt was published.
- The existing 11 archival/offline check blocks and 14 CPU reference workload
  steps passed. No archived receipt changed; no GPU/self-hosted workflow ran.

The new module is packaged but not imported by any game. Browser passes establish
package/lab regression coverage, not browser execution of D4 or physical hardware
verification. The contract/test/oracle/fixture identity is added to the reuse
policy for full-package consumers; source, policy and workflow changes cannot
reuse stale results. No arithmetic backend, ALIEN-MATH-001–003 semantics, QFLOAT,
Lean/SPARK proof boundary, replay, tag or release changed. Formal ECMAScript
refinement and later campaign phases remain OPEN and outside this PR.

See [ALIEN-MATH-004](ALIEN_MATH_004.md) for the full mathematical contract,
resource bounds, commands, frozen input/fixture SHA-256 and limitations.


## CI-INVARIANT-001 — local executed evidence, owner review pending

- 573 Node tests passed, including the A–M cache regression matrix; zero failures
  in the final run. Source check: 218 JavaScript files, 41 module contracts,
  two experiments. Build and offline verification: 121 packaged files passed.
- Real isolated Playwright 1.64.0 / Chromium 156.0.8078.4 headless SwiftShader
  preflight and all seven packaged browser suites passed on 2026-11-11.
  This was the cold path: seven executed, zero reused, no trusted receipt issued.
  No physical GPU, owner RTX workflow or self-hosted runner was used.
- The existing 11 archival check blocks and 14 CPU reference workload steps
  passed. ALIEN-MATH-001–003 independent Python reproductions passed unchanged.
  The new finite graph/qualification oracle reproduced its frozen expected bytes.
- Final verification followed exploratory dependency-recognizer corrections and
  additional negative controls. No failing final gate was waived. Browser runtime
  and harness bytes were unchanged by the subsequent receipt-verifier checks.
- Against the executed source-pinned baseline, adding an unreachable packaged
  math module reduces the qualified-fixture selection from seven executed to
  six executed / one reused. This is a suite-count observation, not a timing claim
  or live GitHub cache hit. Current unprotected main remains seven / zero.

See [the CI contract](BROWSER_INCREMENTAL_CI.md) for fixture SHA-256 values,
reproduction commands, authority limitations and outstanding owner-controlled
protection/qualification prerequisites. No arithmetic contract, archived receipt,
proof boundary, release or hardware claim changes in this phase.


## OPT rendering reuse: current change

Nine additional Node checks compare every vertex/colour/order with a frozen
v1.0 reference across 1,200 rendering states, verify complete-key invalidation,
immutable output, restore/clear behavior, and exact GPU buffer/draw semantics
through growth, shrink, empty updates, foreign handles and failed uploads.
Signed zero remains distinct in cache identities; non-finite colours are rejected
without publishing a new generation.
All earlier gameplay and evidence checks remain enabled. Paired workload timings,
deterministic work counts and limitations are in [OPTIMIZATION.md](OPTIMIZATION.md).

Packaged Chromium additionally checks exact pixel parity, unchanged-HUD writes,
idle/camera/partial-crank reuse, changed-glyph uploads and native retained buffers.
It records paired synchronous WebGL observations, followed by all existing lab
and complete Vault scenarios. Executed CI/head/artifact details are recorded in
the PR after verification. These observations do not establish physical-GPU
frame rates or coverage of other browser engines.

## The Clockwork Vault (1.0.0)

- **240 Node tests passed locally**, retaining all 221 previous regressions.
  Nineteen additions cover the six puzzles, bounded hints, staged latching,
  command limits, undo, 144 phase/fraction replay cases, validation failures,
  complete physical progression, moving-lift saves and kinematic interlocks.
- An independent arithmetic OMI/XOR oracle traverses all reachable states for
  each level. It confirms shortest lengths 2/3/4/5/6/7, with 28,928 reachable-state
  visits across six components and hashed complete distance tables. Runtime
  hints use separate code and bounded 512-expansion tick slices.
- A simulated player completes all six locks and the exit through actual gates,
  causeway and lift colliders, with zero rescues. Separate tests cover the closed
  gate, blocked interactions, fall recovery, preserved progression, halted world
  motion with continued crouch control, and the four-hour tick boundary.
- JSON round trips preserve player/support state and pending cam motion. Bad
  schemas, words, histories, future operated locks, release order, supports,
  overlaps, console reachability and completion are rejected before replacement.
  These are validated save snapshots, not authenticated event histories.
- Fixed pause and 30/60/144 Hz schedules preserve state in the tested runtime.
  Existing OMI, Brass Engine and navigation reports and the new vault graph
  report reproduce. Contracts/syntax cover 75 JavaScript files, eleven modules
  and one research entry. Fifteen recipes and three research demonstrations are
  registered; 47 public files plus a hash manifest are packaged.
- Packaged Chromium scenarios cover visible WebGL, the full six-lock expedition,
  real gate/bridge/lift traversal, staged motor/undo/hints, actual partial JSON
  download/restore, bad and stale file input, fresh keys, cancelled gestures,
  pointer lock, pause/blur/hidden, graphics failure and 390/320 px touch layouts.
  All previous lab scenarios remain enabled. Actual CI execution and inspected
  screenshots/artifact hashes are recorded in the PR after the run.
- Local Chromium is unavailable; browser checks execute in CI. Physical devices,
  other browser engines and performance claims remain unverified. The 1.0.0
  showcase version preserves the explicit experimental API/research labels.

## Historical Brass Engine (0.9.0)

- **221 Node tests passed locally**, retaining all 207 earlier regressions.
  Fourteen additions cover staged register values, latch timing, reversible
  detents, integer motor rates, strict boundaries, snapshot ownership, receipt
  rewind, JSON replay failure paths and the 65,535-turn counter limit.
- Every one of 65,536 staged outputs agrees with both the OMI kernel and an
  independent arithmetic bit oracle. All 458,752 preparation checks keep the
  latched word unchanged; all 65,536 reverse round trips restore the seed.
- `scripts/verify-machine.js --check` reproduces the committed mechanical report
  except its runtime label. The transition table retains the OMI kernel hash.
  Ninety-six replay cases span eight cam phases, three rates and four periods,
  restoring fractional ticks and identical future states.
- Presentation schedules at 30/60/144 Hz produce the same integer state in the
  tested runtime. Paused clocks preserve partial positions and discard time
  debt; long stalls remain bounded. Rendered angles never feed back into logic.
- Syntax/dependency checks cover 68 JavaScript files, eleven core modules and
  one research entry with two demonstrations. Packaging has 42 public files
  plus a SHA-256 manifest; evidence, browser tooling and tests remain excluded.
- Packaged Chromium scenarios exercise visible SVG geometry, exact stage
  values, reverse movement, fixed/short periods, motor pause, real JSON download
  and restore, malformed replay rejection, fresh keyboard input, cancelled
  pointer releases, blur/hidden, counter stop, reduced motion and 390/320 px
  touch-emulated layouts. All earlier lab browser checks stay enabled.
- Local Chromium is unavailable; the required browser checks execute in CI.
  The PR records the actual run and artifact evidence after execution. Other
  engines, physical touch devices, historical authenticity and real mechanical
  tolerances are not verified. This is fictional discrete integer logic.

## Historical OMI finite-state experiment (0.8.0)

- **207 Node tests passed locally**, retaining all 196 previous regressions.
  Eleven additions cover strict finite-word boundaries, owned arrays, immutable
  topology, full-domain packing and XOR inversion, and all 65,536 delta outputs
  against an independent arithmetic bit oracle.
- Complete orbit enumeration observes 8/56/4,032/61,440 states with minimal period
  1/2/4/8. Every state returns after eight steps; the stronger universal exact-
  period-eight interpretation fails for 4,096 states. A separate oracle-table
  traversal counts all cycles. The report pins a little-endian transition hash.
- All 262,144 derived faces close. All 4,096 edge patterns have exactly sixteen
  preimages. Tests demonstrate each single-edge bit fault on a representative
  word and a coordinated change that closure cannot detect. This is a relation
  test, not a general error-detection or authentication guarantee.
- Demo tests cover sliced enumeration, cancellation, independent summary/atlas
  ownership, budget rejection, zero/invalid ticks, paused work, bounded catch-up
  and identical state/survey results at 30/60/144 Hz schedules in one runtime.
- `scripts/verify-omi.js --check` reproduces every committed report field except
  the runtime label. Syntax/purity/dependency checks cover 63 JS files, eleven
  game modules and one separately registered experiment. Packaging has 38 public
  files and a SHA-256 manifest, with no tooling/evidence or runtime dependencies.
- Packaged Chromium scenarios cover word vectors, all minimal periods, the full
  census, fixed-word step counts, bit/fault/mask controls, atlas selection,
  fresh-key cancellation, pause/blur/hidden/reset, Canvas failure and 390 px touch
  emulation. All earlier browser scenarios remain enabled. The PR records the
  actual run, screenshots and evidence hashes for its commit after execution.
- Local Chromium is unavailable; browser checks run in CI. Physical devices,
  other browser engines and performance claims remain unverified. This slice
  neither imports external formal proofs nor claims full OMI conformance.

## Historical shared flow fields (0.7.0)

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


## Integer engine foundation (unreleased)

- `node --test tests/*.test.js`: 281 tests passed locally, including integer
  arithmetic/collision oracles, 10,000-tick replay and complete Foundry route.
- `node scripts/check.js` and `node scripts/build.js`: contract/import checks and
  allowlisted package passed; no runtime dependencies added.
- `node scripts/verify-integer.js --check`: pinned 482-tick full-game-state and
  input SHA-256 receipts reproduced. See `INTEGER_EVIDENCE.json`.
- Packaged Chromium Foundry coverage is integrated into the existing CI browser
  job. At d413aff4b25ca77f8bc85f012d4fbadfa2255006, run 41996848225 passed
  all new Foundry browser checks, including Node/Chromium complete-state parity.
  The same run then exposed a duplicated navigation CSS class in an older lab
  test; the Foundry link now has its own class. Final full-suite status is recorded
  on the PR. Local browser installation was unavailable because the download
  endpoint returned HTML instead of a browser archive.
- No hardware GPU, Firefox/WebKit, physical touch-device or speedup claim is made.

## Optional GPU/WASM and Space Game Lab — local validation, 2026-11-11

See [setup, API, export and test instructions](OPTIONAL_GPU_WASM.md) and
[three-execution browser reuse](BROWSER_INCREMENTAL_CI.md).

- 567 Node tests passed, including Float32 JS/WASM projection, clipping,
  retained owned snapshots, resource rejection, docking, swept broadside hits,
  orbital radius stability, project policy round-trip and receipt invalidation.
- Source/module checks and the fresh offline package verifier passed (120 files,
  approximately 780 KiB). WASM rebuild with wabt 1.0.39 matched all 308 bytes.
- Packaged Chromium covered all seven suite groups. The first full run exposed
  an existing async editor import assertion race. The test now waits for the
  actual import result; the editor also ignores superseded file reads. Targeted
  editor/donor/home runs and final editor/donor reruns passed, including the new
  v2 project envelope and executing the downloaded HTML player.
- Local tooling: Node 22.18.0, Playwright 1.65.0, Linux x64. Hosted CI remains on
  its pinned Playwright 1.64.0 and independently validates that environment.
- Explicit headed physical GPU test: NVIDIA, Blackwell, fallback=false. GPU Lab
  readback contained 4,972 bright pixels; Space Lab 5,963. Each capture verified
  exactly one submission. Three activations used three devices and four adapter
  requests including detection. Repeated unchanged frames performed zero vertex
  buffer uploads. Device destruction, CPU recovery, fresh-adapter reactivation,
  injected WASM initialization failure/retry and resize passed.
- The local GPU test is separate from hosted CPU browser witnesses. GPU evidence
  is never manufactured by cache reuse. Other browsers/devices, completed-GPU
  timing and a universal performance improvement are not claimed.

### PR #66 review regressions

- 569 Node tests pass. New closure tests mutate editor viewport/player/batching
  and GPU controls independently of the worker hash and invalidate both consumers.
- The reported 43-object, 512-triangle-per-object project builds 66,048 vertices.
  Tests preserve the complete stream across 65,535/513-vertex batches, retain
  handles during updates, and release batches on shrink/empty/dispose.
- Packaged donor/editor Chromium suites pass, including running that large
  CPU-only exported project and real W input after Resume in the exported player
  and Space Lab without clicking the canvas. CPU-button focus and Space avoiding
  accidental pause activation are also checked.
- NVIDIA Blackwell hardware tests pass with explicit focus assertions after GPU
  button activation, actual rendered pixels, CPU/GPU cycling, loss/retry, WASM
  failure recovery, resize and zero unchanged-input uploads.
- Source checks and offline package validation pass (121 packaged files).
