# Architecture — VANILLAJS 0.5.0

The goal is to assemble future games from small, versioned systems. The labs
prove composition against different environments and control laws.
Rendering, input events and lifecycle policy belong to the application boundary.

## Dependency direction

| Module | Depends on | Owns |
| --- | --- | --- |
| math | nothing | numeric operations and coordinate conventions |
| time | nothing | accumulator and tick budget |
| collision | math | cube/rectangular sweeps, static/kinematic sliding, static and translating-target queries |
| character | math, collision | upright grounded motion, stance clearance, platform support and eye pose |
| weapons | nothing | magazine/cooldown/reload state |
| flight | math, collision | physical state and control laws |
| input | math | actions; opt-in keyboard/mouse adapters; gamepad sampling |
| render-webgl | math | GPU buffers, shaders and rendering |
| projectiles | math, collision | bounded straight-shot motion, lifetime and ordered hit/expiry events |
| interactions | nothing | declarative rule selection, conditions, effects and reasons |
| demo worlds | math, collision, flight | environments, signal objectives and run state |
| demo app | modules and worlds | animation loop, DOM, lifecycle, controls and telemetry |

Interaction Lab recipes consume flight, collision, projectiles and interactions;
their application adds time, input, maths and the shared renderer. Static queries
find geometry; projectile events identify contacts; the recipe evaluates and
applies effects. The interactions module never imports flight or projectiles.
No recipe/domain data is imported by a module. Conditional effects do not mutate
the simulation until the consumer explicitly applies them in event order.

No dependency points back into a demo. Importing a module does not start a loop,
register events, create a canvas or access a browser global. Browser input adapters
register listeners only when explicitly attached, and returns `dispose()`.
The renderer creates resources only when constructed, and offers `dispose()`.

## Shared simulation

The world is right-handed, +Y up, -Z forward. Positions and linear velocities
are world-space. Angular velocities, diagonal inertia and control torque are
body-space. Quaternions store x, y, z, w. SI units are used throughout.

The app advances 1/120-second simulation ticks. Render interpolation uses the
two most recent poses. At a pause or completion, the current pose is displayed.
The clock caps input wall time and work per frame, reports discarded simulated
seconds, and drops paused debt. A slow machine can therefore run below real time;
unbounded catch-up is deliberately avoided. UI time is not simulation time.

`integrateBody` implements semi-implicit Euler translation, the body-space Euler
equation with a gyroscopic term for diagonal inertia, and a normalized quaternion
increment. It is a numerical approximation, not an exact energy-preserving solver.
`stepFlight` turns normalized control inputs into world force and local torque.

Inertial mode has no implicit drag or speed limiter. Assisted mode controls local
velocity and angular velocity with bounded acceleration. Explicit braking damps
both velocities exponentially. Assistance and braking are game control systems,
not an atmosphere. Spaceflight has no gravity or physical aerodynamic drag.

The body's `halfSize` defines a world-axis-aligned cube collider, independent of
visual orientation. Continuous centre sweeps against expanded static AABBs
prevent a single tick from crossing thin walls. Contact removes inward linear
velocity, preserving tangential slide. Rotation does not generate contact torque.
Spawn overlaps are recovered with bounded passes. Impossible overlapping worlds
or an exhausted slide budget return `truncated`, and do not advance unresolved
movement through geometry. This does not solve arbitrary rigid-body collisions.

## Input and presentation

Keyboard state is expressed as named actions. Standard gamepad sampling is pure
and has a neutral-input gate for connection, replacement and resume. The app
combines keyboard, on-screen controls and gamepad into one flight command.
Mouse look is a separate kinematic controller, not torque: relative deltas are
consumed once per tick before flight and shot spawning. It levels roll, limits
pitch and cancels angular momentum when taking over; translation still uses the
chosen flight model. Mouse-idle keyboard/gamepad rotation keeps the original
6DOF physics. Touch and failed Pointer Lock use relative drag, so a stationary
held pointer never commands a continuous turn. Capture is requested only by a
canvas press after launch. Escape/unexpected unlock pauses; deliberate app
release suppresses the unlock callback. Both apps guard against the same native
Escape also resuming immediately when its unlock event arrives first.

Blur, hidden tabs, reset and demo switching clear input and simulation debt.
They also release mouse capture and discard pending look/fire samples. Gamepad
disconnection pauses the active experiment.

Rendering uses one WebGL 1 shader program, static vertex buffers, depth testing,
flat face shading and distance fog. Each world uploads geometry on selection,
not every frame. Resizing changes the drawing buffer; pixel ratio is capped.
Buffer deletion occurs when switching worlds. Context loss pauses and explains
that a reload is required. Unsupported WebGL fails visibly.

Interaction Lab retains the same shader and static geometry path, with two owned
dynamic buffers for target colour changes, bolts and short-lived impact rings.
It updates those buffers instead of allocating new GPU buffers each frame. The
CPU vertex arrays are rebuilt for clarity; no allocation-free claim is made.
Both apps cancel held inputs at lifecycle boundaries. The new lab also retains
a quick fire-button tap until the next physics tick, and cancels that pending
tap on pause, focus changes, target focus or reset.

## Grounded FPS composition

FPS Lab uses the character controller instead of the free-flight body. Six
recipes share upright rectangular sweeps, yaw-only movement, gravity, support
probes, bounded up/across/down steps and stance-relative eye poses. Crouch keeps
the feet anchored; standing first checks the larger volume for headroom.
Crouch dimensions and current state belong to the character, not the input adapter.
Platform recipes replace the static stair/snap pass with continuous kinematic
movement and support tracking. Camera pitch never enters walking direction. Stair stepping is an intentional
kinematic control rule; it does not claim a general rigid-body or slope solver.
The older cube functions use the same internal solver with equal extents.

Weapon timers accept requests and emit shot/reload events in simulation time.
They know no collider, projectile, damage or key binding. A demo chooses fresh
fire edges or held requests, fires traces or spawns bolts at the tick's initial
eye pose, then advances movement and projectile motion. The existing interaction
resolver describes target effects; the recipe applies them. The original static
queries remain available. Tracking range supplies start boxes plus per-tick
translations to the moving query: it subtracts target travel from shot travel,
finds shared time of contact, then returns the world-space shot position.
Projectile lifetime clipping scales target motion by the same interval fraction.
Targets commit end poses after impacts, and interpolate only for presentation.
Tracking range character movement still uses static geometry; its shot-only
plates do not push bodies. Platform courses use the separate body solver below.

The new app retains click-to-capture mouse look, on-screen input, fresh-press
pause boundaries, bounded render work and explicit graphics failures. New browser
scenarios are additive: all earlier lab checks remain enabled.

## Translating platform transactions

`moveAndSlideMovingAABB` tracks contact time across successive linear sweeps.
Relative surface motion affects normal velocity, so an ascending lift can carry
an upright body into a ceiling. The solver bounds contact iterations and reports
unresolved geometry; it never claims to solve an impossible squeeze. Unlike the
static movement solver, it rejects initial overlap instead of depenetrating.

`stepCharacterPlatforms` adds a motor and support metadata around that solver.
It adjusts attached world velocity when a platform changes speed, retains world
velocity on departure, and probes support again at the end. The character is
updated only after a successful whole tick. A failed attempt leaves it untouched,
letting the application reject its corresponding platform movement. Exact ties
use stable surface IDs. This is kinematic control, not mutual body dynamics.

FPS Lab has one rider and a single platform per course. It computes intended
route motion, tries the rider, and on failure freezes the route and updates the
player against the stopped world. This allows a crouch or walk-out recovery.
Only accepted platform motion goes into projectile queries and end-pose commits.
Game elapsed time and route time are separate: an interlock stops the motor;
explicit pause stops both. Multi-actor consumers must stage their own complete
world transactions. No module stores a route, HUD, fall-recovery rule or game clock.

## Distribution and growth

The browser loads relative ES modules. `MODULES.json` describes actual module
dependencies, checked against source imports. The release uses one monorepo
version, with experimental APIs and explicit migration notes for later changes.
Consumers vendor the required dependency closure and record the source commit.
They do not fetch mutable `main` at runtime.

The current implementation uses small arrays for clarity. It does not claim
allocation-free hot paths, cross-browser bit-exact determinism, a particular FPS,
or a measured maximum entity count. Seeded, identical inputs produce repeatable
results in the same runtime; browser engines may differ in floating-point details.
Performance optimisation follows measured game workloads.
