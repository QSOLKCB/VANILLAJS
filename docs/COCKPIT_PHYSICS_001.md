# COCKPIT-001 — Reusable cockpit, sight alignment and physics proving ground

**Status:** COCKPIT-001 merged. COCKPIT-002 is an opt-in experimental candidate. No existing FPS/Flight Lab
physics, vehicle dynamics, collision, weapon timers, replay, audio or game worlds
are changed by this work. Original pure Apache-2.0 modules; no downloaded models,
maps, scenery, aviation manuals or third-party game engines are bundled.

[Play the Cockpit & Physics Lab](../demos/cockpit-physics-lab/index.html) —
three selectably different authoritative physical models, one reusable camera,
instrument and boresight interface.

## Composition

| Layer | Source | Responsibility |
| --- | --- | --- |
| Space interceptor | Existing [flight](../modules/flight/index.js) | Newtonian 6DOF rigid-body translation, angular inertia, assisted/inertial thrust, fixed ticks |
| Propeller fighter | New [airframe](../modules/airframe/index.js) using flight.integrateBody | Simplified bounded aerodynamic lift, drag, gravity, angle of attack, stall indication, thrust and body-rate command |
| Road coupe | Existing [vehicle3d](../modules/vehicle3d/index.js) | Real four-wheel suspension, tyres, gearbox, propulsion, ground sampling |
| Cameras and guns | New [cockpit-rig](../modules/cockpit-rig/index.js) | Read-only camera transform, first-person/head look, chase/external views, derived instruments, physical sight rays |
| Visuals | Existing [render-webgl](../modules/render-webgl/index.js) | Low-poly procedural scenery and vehicle silhouette, no imported textures or dependency |

**No generic vehicle physics engine is introduced.** The presentation rig reads
the same finite SI pose shape from flight and vehicle3d:
position [x,y,z], orientation xyzw, velocity [vx,vy,vz]. The published
configurations are explicitly versionless experimental JS objects. A game that
uses another coordinate system must provide a separately tested adapter.

The proving ground includes a stylised **1940s-inspired prop fighter**, an
inertial space interceptor and a road coupe. It is intended to recall a simple
old flight-sim cockpit demonstration, not reproduce a particular commercial game
or claim a historically accurate Spitfire. Art is original geometric primitives.

## Independent camera/boresight contract

~~~js
import {
  createCockpitRig,sampleCockpitCamera,inspectCockpitSight,testCockpitTarget
} from './modules/cockpit-rig/index.js';

const rig=createCockpitRig({
  seat:[0,.6,.5],nose:[0,.2,-2],chase:[0,2.5,10],external:[9,4,13],
  guns:[[-3,0,-1.5],[3,0,-1.5]],convergence:240,fov:1.05
});
const camera=sampleCockpitCamera(physicalState,rig,'cockpit',{yaw:0,pitch:0});
const sight=inspectCockpitSight(physicalState,rig,camera,{
  range:240,width:1280,height:720
});
const shots=testCockpitTarget(physicalState,rig,[0,150,-200],5);
~~~

The rig owns and freezes validated local XYZ offsets, gun mounts,
convergence in metres and FOV in radians. Camera sampling cannot advance,
reorient, or silently correct a physical state. Mouse head-look changes the
camera's local rotation **only**, so the reflector reticle moves naturally
relative to the viewer while physical gun rays remain unchanged.

Every muzzle's world ray is aimed at the common body-forward convergence point.
The sight inspector intersects each *actual* gun ray with a selected physical
range plane perpendicular to the craft's forward direction; it then projects
the impact into the **same** pinhole FOV as the WebGL1 renderer. Results include
per-gun XYZ hit points, metres of sight offset and screen pixel coordinates.
At the chosen convergence range, both wing rays should meet the boresight;
near/far planes exhibit real parallax. The test target uses an independent
geometric ray/sphere intersection from each muzzle, not a screen-centre
hit approximation. No ballistics, bullet drop, muzzle dispersion or target
motion is modelled in this first slice.

View modes: cockpit, nose/first person, chase and external quarter.
Telemetry is derived from body velocity and orientation: speed, forward
speed, altitude, vertical speed, heading, pitch and bank. It is not fake HUD
state. Existing FPS reticles and weapon origins are intentionally unmodified;
future FPS/air-combat consumers may opt into these shared contracts.

## Airframe research boundary

The airframe calculates dynamic pressure from 3D velocity and configured air
density; uses an approximate lift coefficient from angle of attack, bounded
post-stall reduction, profile drag plus induced/stall drag, local thrust and
world gravity. Aerodynamic forces are integrated with the original flight
6DOF `integrateBody`; body-space command moments use bounded pitch/yaw/roll
rate response. The defaults are original arcade tuning, **not** Spitfire Mk I,
Mk V, or any type-certified flight data.

No ground effect, propeller slipstream, sideslip tyre coupling, compressibility,
wind field, damage, flaps, fuel, landing gear, realistic spins, slipstream,
ground collision or validated stall recovery exists. Aircraft are reset when
they approach ground instead of pretending landings have been simulated.
A few seconds in the lab are **not** an evidence-based aerodynamic certification.

## Input and test protocol

In the lab: choose Prop Fighter / Space / Car; Launch. W/S change throttle
(road car: forward/brake), arrow keys control pitch/yaw, Q/E roll; space A/D
provide strafe while car A/D steer. F or the Fire/Test control evaluates the
actual world ray/sphere intersection. Optional pointer lock changes **head
look only**, not the airframe or gun boresight. Esc, focus loss or hiding the
tab pauses physics and clears held input.

Play-test sight convergence and parallax at 100, 240 and 400 m; switch
cockpit/nose/chase/external without touching the underlying state. The
moving space, air and car models use actual preexisting physics; display
cadence is decoupled through a bounded 120 Hz `FixedClock`.

Verification commands:

~~~sh
node --test tests/cockpit-rig.test.js tests/airframe.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
~~~

Full browser performance, pointer lock, physical GPU frame p50/p95, flight
handling acceptance, actual audio and cross-browser numerical parity are
**separate gates**. Hosted Chromium SwiftShader should never be presented as
native GPU timing. If any existing tests or source-bound package checks fail,
the PR is not ready for merge.

## External technical research and licensing

- SourceForge Linux FPS directory: study historical weapon camera/origin
  separation, scene-budget practices and first-person control ergonomics in
  OpenArena, Hammer of Thyrion and related engines. No GPL source or assets
  were ported into this Apache-2.0 work.
- Historical Spitfire pilot documentation describes a **reflector gunsight**,
  not a modern HUD. A range setting and weapon harmonisation motivate this
  illustrative convergence demo. No source manuals are packaged or copied.
- The actual animation, world geometry, controls, physics integration and
  projectile geometry here are independently written over existing QSOLKCB
  Apache-2.0 modules.

### Known presentation limits

The WebGL1 demo uses ordinary stylised boxes and line rings; the canopy,
dashboard and reflector-like reticle are cosmetic 2D overlays. The sight
calculation uses actual camera/gun/world geometry, but the art is not a
simulated collimating optical surface or verified historical gun sight.
Collision and damage are not inferred from pixels. Device input and colour
reproduction may differ across browsers; the lab makes no 60 FPS guarantee
until paired hardware profiling is recorded.

## COCKPIT-002 — TOO CLOSE FOR GUNS — SWITCHING TO MISSILES!

The lab now has its official title, while retaining the prior
`demos/cockpit-physics-lab/` URL for compatibility. This is a deliberate
parody of a familiar cinema line, not a reproduction of film audio or art.

In **propeller fighter** and **space interceptor** modes, the M key or Missile
button requests one of four arcade missiles. The **car** has no missile system.
Guns remain the F button and use the exact unchanged world-space gun rays.
A launch originates from alternating local pylons, obeys an independent
physical forward lock (30-degree cone, maximum 2,000 m), consumes ammunition,
starts an 0.8-second simulation-time cooldown and advances at fixed 120 Hz.
All inputs are latched and consumed at simulation-tick boundaries.
Pause, reset, blur and hidden-tab events cancel pending inputs or simulation.

The lab-owned [missile model](../demos/cockpit-physics-lab/missiles.js) is
independently authored, bounded and deterministic: four simultaneous projectiles
maximum, two alternating pylon positions, eight-second lifetime, direction and
speed advanced on physical ticks, turn-rate-limited homing toward the current
authored target, and analytical swept segment/sphere impact (no tunnelling).
A shot that cannot lock does **not** spend ammunition. The output includes an
immutable event receipt, ammo/cooldown/active counts and impact/expiry totals.
The renderer only draws coloured missile streaks from accepted snapshots.

The missile model is **not** a real guided-weapon specification, certified
aerodynamic model, missile seeker, battlefield simulation, terrain/vehicle
collision system, or accurate 1940s military inventory. Its simplified
homing and static training target are strictly arcade mechanics; realistic
gunnery, moving-target guidance and full game hit resolution remain future
independent studies. No third-party textures, movie dialogue audio, missiles
or source code are included.

Acceptance:
- `node --test tests/cockpit-missiles.test.js` with lock, launch/cooldown,
  swept impacts, deterministic split/repeated ticks, expiry, validation and
  separate camera/vehicle state.
- Existing cockpit / airframe and complete repository tests unchanged.
- Packaged Chromium acceptance checks an actual missile launch and delayed
  physical impact in air mode, launches in space mode and verifies the car
  cannot equip missiles; the source-bound artifact records the exact package.
- No hardware-FPS, historical accuracy or game-damage claims are made.
