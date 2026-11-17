# HORIZON-006 — Driving Feel and Real Rival Contact

After HORIZON-005, owner testing identified sudden apparent skids and the
turquoise rival visibly intersecting the player car. These are two separate
limits, not proof of a GPU or physics process crash.

## What changed

- A **Course assist ON/OFF** switch is visible in the Racing Foundry. ON by
  default, it uses authored route sampling to request bounded steering,
  throttle and braking with the unchanged native `vehicle3d` physics.
  OFF exposes direct controls for mechanical testing and skilled racing.
  Reverse, pause, focus cancellation and recovery remain unchanged.
- Player and rival now resolve *actual same-elevation overlaps* using a
  deterministic game-owned horizontal oriented-rectangle approximation.
  The symmetric response separates their bodies and applies equal/opposite
  normal velocity impulse. Cars on different vertical road levels do not
  collide. Original body dimensions and visual models remain unchanged.
- A safety recovery now labels its Resume button explicitly, so an intentional
  fail-safe pause is not mistaken for an unresponsive game.

## Verification obligations

- Repeatable pure fixed-step full-throttle course-assist drive: all eight
  checkpoints, no unsafe physics state and no off-road excursion.
- Real steering corrections must still complete, and a native assist-OFF
  run must retain historical gameplay.
- Two-car tests cover initial race-lane clearance, true collision impulse,
  immunity to cross-level ghost contacts and unchanged accepted objects.
- Packaged Chromium startup, keyboard/touch, source-bound offline ZIP,
  source/profile hashes, existing numerical proofs and trusted CI remain
  required; pass claims must be tied to actual execution.

No general-purpose 3D mesh collision, high-speed tyre certification or
physical GPU performance is claimed. This is an optional game control
policy and a bounded game-owned two-vehicle approximation.
