# Architecture — VANILLAJS 1.0.0

The goal is to assemble future games from small, versioned systems. The labs
prove composition against different environments and control laws.
Rendering, input events and lifecycle policy belong to the application boundary.

## Research experiments

`MODULES.json` registers ARCH-OMI-001 separately under `experiments`. Its pure
`experiments/arch-omi/index.js` entry owns strict finite-word transforms and an
explicit tetrahedral encoding. OMI Lab owns the census, animation, DOM, SVG and
Canvas atlas and consumes the existing fixed clock. The Brass Engine owns a
pure staged cam model in `demos/ancient-machine/machine.js`, bounded receipts,
strict replay validation, SVG geometry and browser lifecycle policy. Its motor
uses integer subdivisions of the same 120 Hz clock; drawn angles never feed
back into computation. The Clockwork Vault composes the same staged model with character movement,
kinematic collision, declarative interactions, input, the clock and rendering.
Its puzzle graph, bounded hint search, progression, chamber and strict local
replay format remain demo-owned. All three demonstrations are registered under
the same research entry. No core module imports the
experiment. There are now sixteen core modules and sixteen game recipes; the optional geometry layer is a runtime module, while the E8 point atlas remains research-only.

The build allowlists only the research kernel plus its demos; the independent
arithmetic oracle, evidence generator, tests and evidence JSON stay outside the
runtime. [ARCH_OMI.md](ARCH_OMI.md) separates source formulas, our encoding and
executed results. Enumeration proves the stated finite cases; it does not
establish a physics model, compressed state, cryptography or a speedup.

## Dependency direction

| Module | Depends on | Owns |
| --- | --- | --- |
| integer-math | nothing | checked fixed-point operations and uint32 PRNG |
| integer-time | integer-math | integer microseconds, rational phase and tick budget |
| integer-physics | integer-math | immutable static boxes and X/Y/Z ordered sweeps |
| integer-engine | integer-math, integer-physics | atomic ticks, owned snapshots, replay |
| math | nothing | numeric operations and coordinate conventions |
| time | nothing | accumulator and tick budget |
| collision | math | cube/rectangular sweeps, static/kinematic sliding, static and translating-target queries |
| character | math, collision | upright grounded motion, stance clearance, platform support and eye pose |
| weapons | nothing | magazine/cooldown/reload state |
| flight | math, collision | physical state and control laws |
| input | math | actions; opt-in keyboard/mouse adapters; gamepad sampling |
| render-webgl | math | GPU buffers, shaders and rendering |
| geometry | collision | Immutable static AABB index, conservative three-way culling, exact Float32 box batching |
| projectiles | math, collision | bounded straight-shot motion, lifetime and ordered hit/expiry events |
| interactions | nothing | declarative rule selection, conditions, effects and reasons |
| navigation | nothing | immutable grids, bounded paths, destinations and incremental shared fields |
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

## Integer simulation boundary

The new integer core has no dependency on legacy floating math, browser clocks,
DOM or the renderer. It stores signed 32-bit subunits, uses BigInt for products
and quotients, and rejects overflow before committing a tick. Static collision
uses exact integer comparisons in a documented X/Y/Z order. Snapshots include
all engine state, geometry, tick and RNG state. Game-specific state and input
recording remain in the recipe. Integer Foundry renders the latest committed
pose through the existing WebGL module; no rendered quantity feeds back into it.

The browser quantises **absolute** frame timestamps to whole microseconds before
differencing; `IntegerClock` accumulates `elapsedUs * hz` and consumes 1,000,000
phase units per tick. Rendering cadence and live input sampling are outside the
replay contract. See [INTEGER_ENGINE.md](INTEGER_ENGINE.md).

## Shared simulation (legacy controllers)

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

## RTS routing composition

Navigation uses integer `[column,row]` cells in the X/Z plane; columns increase
along +X and rows along +Z. Cell centres convert to metres. The immutable grid
owns its blocked bits. Editing returns another snapshot, leaving old searches
well-defined; consumers explicitly replan when terrain changes.

Four-neighbour A* uses a Manhattan heuristic and a binary heap ordered by total
cost, heuristic, then row-major cell index. Paths include both endpoints and have
uniform edge cost. A separate breadth-first traversal collects nearby reachable
destinations. Neither routine owns an agent, order, animation or clock. Both cap
expanded cells and distinguish budget exhaustion from proven unreachability.

The original route/squad recipes own selection, greedy assignment and traffic. Each plans
all selected units before replacing any route. On a shared 180 ms cell boundary,
unique-destination reservations accept chains ending in vacant cells and reject
cycles/swaps. Waiting units retry around occupied cells after six failed moves.
This bounded policy prioritises safety; it does not guarantee eventual arrival
for every arrangement. Routes and unit centres are not physical collider shapes.

The lab advances the same 120 Hz clock and interpolates 2D unit positions. Native
Canvas 2D supplies a top-down view; it has no dependency on the WebGL adapter.
Pause freezes routes and current segments. Gesture capture, selection and pending
pointer releases belong to the app; lifecycle changes cancel unfinished gestures.
Accepted orders survive pause and require deliberate resume. No tactical rules,
world geometry or traffic policy are imported by the navigation module.

## Shared-field publication

`FlowFieldSearch` expands outwards from one or more canonically ordered goals.
On a uniform cardinal grid, breadth-first integration gives each reachable cell
its minimum distance and stable nearest-goal owner. The builder accepts a work
budget per call; allocation/setup still happens in its constructor. Partial
arrays remain private. Only a complete immutable result can be sampled.

The flow recipes own one current build, a grid identity and a destination
generation. Editing either cancels unfinished work, invalidates the old field
and increments the generation. Simulation ticks advance the current build only;
paused clocks freeze both build work and unit motion. New moves require a complete
field matching the current snapshot and generation. A safe in-flight segment may
finish while rebuilding. Gate edits cannot intersect either segment endpoint.

Both navigation modes use the same game-owned cell reservations, now in a shared
demo helper. Flow units sample a next cell instead of storing a full A* path.
Convoy/evacuation arrivals leave the map, releasing the destination for following
units. Closed exits stop consuming units but remain walkable terrain. Nearest
distance does not account for queue length. There is no body dynamics, weighted
terrain, continuous steering, async worker or network state in this slice.

`scripts/navigation-workload.js` compares settled-cell counts for independent A*
requests and one shared field plus samples. CI regenerates the fixed workloads
and compares them with the documented rows. The measurements exclude setup, heap,
sampling, traffic and drawing costs; they do not establish browser throughput.

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

## Optional CPU / GPU graphics and space labs

See [the GPU/WASM and Space Game Lab guide](OPTIONAL_GPU_WASM.md) for the experimental
CPU-first renderer, explicit player opt-in, editor project setting and playable
HTML export, exact-math preparation, resource limits, and local test commands.
The project v2 envelope preserves graphics policy; legacy v1 projects still load.
Existing WebGL APIs remain supported.
