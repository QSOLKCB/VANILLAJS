# HORIZON-005 — Bridge-edge collision and recoverable race failure

Release-blocking issue: [#111](https://github.com/QSOLKCB/VANILLAJS/issues/111).

## Executed baseline reproduction

The owner observed the same bridge-area rollover three times on the deployed
race. In an isolated V8 replay of the exact pre-fix native vehicle and race
modules at source commit `e20b163e939280366b96b75cfe9f7cadd48f3f47`,
Cape Aster seed 7337 with full throttle and no steering leaves the road near
86 km/h. At 8.458 seconds after the countdown, the model reports
`needsRecovery`: up-axis Y 0.189, all four wheels airborne, no collision
contacts, position [-8.01, 8.22, -148.23] and lateral offset -33.05 m.
This is a physical off-road/rollover fail-safe rather than evidence of an
unhandled browser exception.

## Correction

- Only actual bridge strips receive bounded race-owned guardrail AABBs
  derived from the road-edge stations that the renderer uses.
- Each vehicle's next physics step gets nearby guards only, respecting
  the solver's 64-barrier bound for long authored tracks.
- The existing `vehicle3d` sweeps execute all contact response. The
  authoritative triangle contact surfaces, other Vehicle Dynamics studies
  and legacy project formats are unchanged.
- If an unsafe rollover or solver-limit condition occurs, the browser
  automatically respawns the car at the previous completed checkpoint,
  applies the existing +4-second penalty once, and pauses for fresh input.
  The race banner explains the recovery and prevents a duplicate manual
  recovery while paused.
- New Node and browser tests cover collision, lanes, long routes,
  genuine player/rival motion and the controlled fail-safe transition.

Decorative trees, buildings and tunnel shells remain non-colliding. This
is an intentionally bounded chassis collision approximation, not a
complete collision solver or manufacturer-level vehicle deformation.

## Verification

This branch contains source and regression changes. Full Node, browser,
offline package, source-bound CI and post-merge Pages validation are
independent gates: no unexecuted test is described as passing.
No Games2 edits, tag, merge, release or Pages deployment are authorised.
