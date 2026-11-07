# November 2026 donor review — precise opt-in engine additions

**Scope:** target VANILLAJS `main` at
`e82d51be222d99951d70509468eaae8f3efc9fcd`.
Provenance is source-pinned; donor benchmark results remain **donor-only**.
All changes are isolated from previously archived RTX5060TI-001/002/003/004.

## Donors inspected and disposition

| Donor | Exact reference | Extraction / deliberate boundary |
| --- | --- | --- |
| BLOAT-OPS PR #6 | head `200234c764a49f30ab1b740b78ef70a746f3532e`, merge `b92ecf10036f371ea68929cb5eb7cacbb7aa4a71` | Compensated frame-snapping concept; avoids 59/61 Hz rate drift |
| BLOAT-OPS PR #5 | merge `6f290dc818759ca49bcdec54b31d738b33c7946f` | Gameplay replay, controllers, NAV and renderer work already represented by current VANILLAJS modules; no boss/game transplant |
| ARCADE v0.4.0 | `430b16466e6c589bb92650d2a221772a3fd328d4` | Existing FrameGate remains independent |
| ARCADE PR #3 | merge `a3164f6c2c94332d7be10c324fe3cd4aa1c42fbe` | Compensation logic independently adapted for optional FixedClock snapping |
| Ski-Shooter v0.2.0 | `cb384f8e2e806604fde93140d7a4c41563d6165b` | Interception of moving airborne targets, inherited shooter motion, conservative bounded lead computation |
| CorpoWars3d v1.2.0 / PR #10 | `5701949e4ef7047b715db808b777450c3bf49d53` | Axis range rejection, orbit-free ballistics, AI and camera patterns already considered; don't transplant campaign logic |
| QwakeTF v0.2.0 | `3852d20c9744350b883e38560f492a5683f2e492` | Pooled navigation and input foundation already present; game-specific class/weapon logic remains outside engine |
| CorpoWars v0.5.0 | `289ba406e56fbc983b27613005bc12fedfeb6752` | Capture economy and squad controls remain game-specific; reusable pathfinding already present |
| GAMES v1.4.0 | `7e0a9019d07b491cffc9b698fa51acdb843c49cc` | Adaptive circle and geometry provenance already recorded in VANILLAJS; no Three.js/vendor dependency |
| AFTER//ZERO | `406a45927b819f7383f71649d261de675552ca9c` | Single-player moving-target shooting concept only; no multiplayer, server, persistence or arena source imported |

**License / derivation:** code in this PR is independently authored under
VANILLAJS's Apache-2.0 license. These references identify ideas and boundary
contracts rather than copied source, assets or benchmark claims.

## FixedClock optional drift-repaying timestamp snapping

```js
import {FixedClock} from './modules/time/index.js';
const clock=new FixedClock({step:1/120,snapTolerance:.0005});
clock.advance(elapsedSeconds,dt=>advanceSimulation(dt));
```

By default `snapTolerance:0` and all original clock semantics remain
unchanged. With opt-in tolerance expressed in **seconds**, if an incoming
frame is near an integer number of simulation ticks, snapping is allowed
only while the total signed drift remains below tolerance. The next unsnapped
frame repays the full drift and resets it. Pause and reset clear debt. Scaled
time repays drift before scaling. Fixed-step simulation still receives the
unchanged exact tick value and bounded catch-up policy.

Regression sequences: 30, 59, 60, 61, 75, 120 and 144 Hz run one minute with
no more than one tick of deviation from the expected 120 Hz tick count;
rounded 16.6/16.7 ms sequence at 60 Hz produces 3,600 ticks in 60 s when
using a 60 Hz clock. These are **synthetic timestamps**, not measurements on
physical high-refresh monitors.

## Independent lead-solver API

```js
import {leadIntercept} from './modules/lead-solver/index.js';
const solution=leadIntercept({
  shooterPosition:[0,0,0],shooterVelocity:[10,0,0],
  targetPosition:[100,0,0],targetVelocity:[0,10,0],
  projectileSpeed:50,inheritance:.5,maxTime:15
});
if(solution) {
  // solution.time, direction, launchVelocity, interceptPoint
}
```

The solver uses `||r+(targetVelocity-inheritance*shooterVelocity)*t|| =
projectileSpeed*t` and a numerically stable quadratic root evaluation
with a near-linear limit. It validates finite bounded 3D vectors, a positive
muzzle speed, inheritance fraction [0,1], and a bounded horizon. `null`
means no admissible nonnegative intercept, including coincident centres where
aim direction is undefined. Returned arrays are owned values.

**Not included:** target acceleration, gravity/drop, air drag, walls,
collision testing, weapon firing policies, AI, network prediction or
claims of perfect real-world hit probability.

## Clockwork Vault WebGL bootstrap / browser contract

The initial scene is now built and drawn before `dataset.firstFrame=ready`
is published. The packaged Chromium test waits for actual scene readiness
rather than the HTML's static `READY` label, then samples a bounded 120
animation frames until the existing >500-bright-pixel contract passes.
A genuine blank frame, context loss, GL error or absent first draw must
still fail, with diagnostic dimensions and observed pixel counts.
This is a startup synchronization correction, not a disabled graphics gate.

## Follow-up hardware evidence

The owner-only `rtx5060ti-donor-upgrade.yml` workflow is dispatchable from
reviewed `main` after merge, never on PR or push. It preserves RTX001–004,
repeats the same prior full-path WebGL benchmark against the frozen pre-upgrade
`e82d51be222d99951d70509468eaae8f3efc9fcd` source and the new exact
HEAD, and records the new **CPU-only** lead/pacing workload separately.
New results and hashes are written outside the checkout, with optional
artifact upload only after explicit owner consent. Passing this workflow
does not establish a portable FPS gain or turn CPU code into RTX compute.
