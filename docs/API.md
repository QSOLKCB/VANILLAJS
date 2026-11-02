# API contracts — 0.2.0 (experimental)

All paths are native ES modules. Public numerical routines require finite values
unless otherwise stated. Vector arithmetic expects correctly sized numeric arrays;
`finiteVector` is available for validation at application boundaries. Returned
math arrays are new arrays. Body state is deliberately mutable and owned by the
caller; do not replace its fields with invalid values between simulation ticks.

## Maths

`add`, `subtract`, `scale`, `dot`, `cross`, `length`, `normalize`, `mix`, `clamp`,
`finiteVector`; `quatNormalize`, `quatConjugate`, `quatMultiply`, `rotate`,
`integrateOrientation`, `quatInterpolate`; `perspective`, `viewMatrix`,
`multiplyMatrices`, `seededRandom`.

World +Y is up and forward is -Z. Positive rotations use the right-hand rule:
positive yaw turns forward toward -X. Vectors have three elements; quaternion
storage is `[x,y,z,w]`. Rotation functions expect unit quaternions. Zero vector
normalisation returns a zero vector; zero quaternion normalisation throws.
Matrices are column-major Float32Arrays for WebGL. Perspective takes vertical
field of view in radians, aspect ratio, and positive near/far clip distances.
Callers must provide `0 < fov < π`, `aspect > 0`, `0 < near < far`.

## FixedClock

```js
import {FixedClock} from '../modules/time/index.js';
const clock = new FixedClock({step: 1/120, maxFrame: 0.25, maxSteps: 32});
const {steps, alpha, dropped} = clock.advance(wallSeconds, update, timeScale);
clock.setPaused(true);
```

`advance` calls `update(step)` zero or more times. `alpha` is the interpolation
fraction between previous/current poses. `dropped` counts discarded simulated
seconds. Times must be finite and nonnegative, with `timeScale` in `[0,4]`.
Scale zero freezes updates and displays the current pose. Paused calls do no
work. `setPaused` clears the accumulator, while `reset` also clears tick count.
The caller must reset its wall-clock timestamp on resume; see the build guide.
An update can pause the clock to stop the current catch-up batch.

## Flight

```js
import {createBody, flightConfig, stepFlight} from '../modules/flight/index.js';
const body = createBody({mass: 2, halfSize: 0.45, position: [0, 0, 10]});
const config = flightConfig({assisted: false, acceleration: 20});
const result = stepFlight(body, {
  thrust: [0, 0, -1], // local x/y/z; -z is forward
  turn: [0, 0.5, 0], // local pitch/yaw/roll
  brake: false,
}, 1/120, config, staticBoxes);
```

`createBody` clones and validates position, velocity, orientation, angularVelocity,
mass, halfSize and optional positive diagonal inertia. Its default inertia is that
of a uniform cube with side length `2*halfSize`: `(2/3) * mass * halfSize²`.

`integrateBody(body, {force, torque}, dt, boxes)` accepts world-space force in N
and body-space torque in N·m. It applies acceleration `force/mass` and body-space
angular acceleration `I⁻¹(torque − ω × Iω)`. Translation is semi-implicit Euler.
Orientation uses the updated angular velocity. `dt` is in `[0,0.05]` seconds;
zero leaves the body unchanged. Use fixed ticks and validated static geometry.

`stepFlight` clamps each input channel to `[-1,1]` and limits each three-axis
command to magnitude one. It builds force/torque then calls `integrateBody`.
Acceleration-based tuning intentionally scales force with mass. For fixed-force
thrusters whose acceleration changes with mass, use `integrateBody` directly.

| Config | Units / meaning | Default |
| --- | --- | --- |
| assisted | enable velocity and angular feedback | false |
| acceleration | maximum magnitude of commanded linear acceleration, m/s² | 22 |
| maxSpeed | assisted target speed, m/s; no inertial speed cap | 32 |
| response | assisted velocity feedback gain, s⁻¹ | 3 |
| angularAcceleration | maximum commanded angular acceleration per axis, rad/s² | 3 |
| turnSpeed | assisted target angular speed, rad/s | 1.5 |
| angularResponse | angular feedback gain, s⁻¹ | 5 |
| brake | explicit exponential velocity damping rate, s⁻¹ | 4 |

Numerical config values must be finite and nonnegative. Create config through
`flightConfig`; caller edits must preserve those invariants. A non-spherical
inertia can produce gyroscopic acceleration beyond the commanded acceleration.
General asymmetric rotation can become unstable at large angular rates: smaller
steps or a more advanced integrator are needed for demanding rigid-body work.

Both integration calls return collision contacts and `truncated`. `snapshot(body)`
copies the pose for interpolation. The movement result agrees with the final body
velocity, including explicit braking. Zero-duration calls return only empty contacts
and `truncated:false`, without changing the body.

`lookFlight(body, {pitch=0, yaw=0})` is an opt-in kinematic controller for
mouse look. Deltas are finite radians, not angular rates: positive yaw turns
left around world +Y, positive pitch looks up around local +X. It derives the
current heading/pitch, adds the deltas, levels roll, clamps pitch to
`±(π/2 − 0.01)`, normalizes orientation and zeros angular velocity. Position and
linear velocity are unchanged. A zero-delta call deliberately takes over and
stops existing spin. It does not change `stepFlight` torque/inertia semantics;
keyboard/gamepad flight remains fully 6DOF when the mouse is idle.

## Collision

`aabb(min,max)` validates positive box volume. `sweepBox(origin, displacement,
halfSize, box)` returns `{time,normal}` in the segment interval `[0,1]` or null.
Supply finite 3-vectors, positive halfSize and validated box geometry. This low-level
sweep does not recover initial overlap; use `moveAndSlide` for movement.

`moveAndSlide(position,velocity,dt,halfSize,boxes,maxSlides=6)` returns cloned
`position`, `velocity`, `contacts: [{index,normal}]`, and `truncated`. It resolves
strict initial penetration, sweeps and slides. A 1e-6 metre contact separation
avoids repeated inward contacts. Box order breaks exact time/depth ties.
There is no friction, restitution, rotating collider or dynamic-body collision.
Colliders are not spheres: corner contacts are intentionally box-shaped.
An impossible overlap may remain unresolved; `truncated` is a caller-visible
failure to complete motion, not a promise that every supplied world is solvable.

### Finite queries (0.2.0)

`castSegment(origin, displacement, colliders, {halfSize=0, ignoreIds=[]})` returns
null or `{id,index,time,distance,point,normal,startedInside}`. Colliders are
`{id: 'unique-nonempty-string', box: aabb(min,max)}`. All supplied boxes and ids
are validated, including ignored colliders. Vectors must be finite, box volume
positive, and `halfSize` nonnegative. An unrepresentable segment/box extent throws.

- `displacement` is end minus origin in world metres. `time` is its fraction in
  `[0,1]`; `distance` is metres travelled, and `point` is the moving **centre**.
- The segment and expanded box are closed. Tangency and endpoint contact count.
  Starting inside or on the box gives time zero, `startedInside:true`, normal
  `[0,0,0]`, even when moving outward. A stationary query only finds start overlap.
- Positive halfSize expands boxes for a world-axis-aligned cube; it is not a
  sphere/capsule sweep. Zero is a point query.
- Nearest contact wins; exact-time ties use ascending string id (JS code-unit
  ordering), independent of input order. `index` still identifies the input row.
- These query semantics are separate from the older movement sweep's boundary
  semantics. Query results do not resolve penetration or slide a body.

`raycast(origin,direction,maxDistance,colliders,options)` normalizes a nonzero,
finite direction and delegates to the segment query. Range is finite and
nonnegative, in metres; the returned time is still a fraction of that range.

## Projectiles

`new ProjectileSystem({capacity=128})` requires a positive safe integer capacity.
It owns constant-velocity point/cube motion; targets remain static during a step.
It has no timer, renderer, damage model, gravity or automatic source exclusion.

```js
const shots = new ProjectileSystem({capacity:64});
const result = shots.spawn({position:[0,0,0], velocity:[0,0,-100],
  lifetime:1.5, halfSize:0.08, ignoreIds:['my-ship'], data:{kind:'pulse'}});
const events = shots.step(1/120, colliders);
```

`spawn` validates finite vectors, positive finite lifetime in seconds, nonnegative
finite halfSize in metres and an array of string ignoreIds. It clones vectors,
ignoreIds and structured-cloneable `data` (default null). Velocity is world m/s.
Success returns `{accepted:true,id,reason:null}`. At capacity it returns
`{accepted:false,id:null,reason:'capacity'}` without consuming an id. Invalid input
throws, including non-cloneable data. Ids are monotonically increasing integers;
exhausting safe integer ids throws. `clear()` cancels shots without emitting
events or reusing ids. Read-only `size/capacity` report bounds; `snapshots()`
returns owned copies including remaining lifetime.

`step(dt,colliders)` accepts finite nonnegative seconds. Zero is an immediate
no-op. Use fixed ticks for composition with other modules. Travel is clipped to
remaining lifetime, so a shot cannot hit beyond expiry. Contact at the exact
lifetime endpoint takes precedence over expiry. The first hit consumes the shot.
All motion is staged before commit: an invalid query leaves the system unchanged.

| Event | Fields |
| --- | --- |
| hit | `type:'hit', projectileId, time, hit, data` |
| expired | `type:'expired', projectileId, time, position, data` |

Here event `time` is **seconds from this step's start**, while nested `hit.time`
is a fraction of the shot's lifetime-clipped segment. Events sort by event time,
then projectile id. A consumed shot never emits a second event. Metadata is
cloned on output. A consumer applies effects once, in event order; this module
does not deduplicate events re-submitted by a consumer. Complexity is a direct
scan of active projectiles × colliders; no spatial acceleration is claimed.

## Interactions

`createInteractionResolver(rules)` validates and snapshots declarations, returning
an object with `evaluate({source,target,context={}})`. Each input is a record;
source and target need nonempty `kind` strings. Evaluating never mutates inputs.

```js
const resolver = createInteractionResolver([{
  id:'pulse-hull', priority:0, match:{source:'pulse',target:'drone'},
  requires:[{scope:'context', key:'shield', equals:false,
    code:'shield-active', message:'The shield is active.'}],
  effects:[{type:'damage',amount:25}],
  reason:{code:'hull-hit',message:'Shield open; hull damaged.'}
}]);
const result = resolver.evaluate({source:{kind:'pulse'},target:{kind:'drone'},
  context:{shield:false}});
```

- Rule ids are unique nonempty strings. Priority is a safe integer (default 0).
  Match source/target are exact kind strings. Highest priority wins, then ascending
  id; declaration order does not affect selection.
- Requirements default to `[]`. They compare an **own**, flat field in source,
  target or context using strict equality. Expected values are strings, booleans,
  finite numbers or null. Missing fields fail, including when `equals:null`.
  Each requirement supplies a nonempty reason code and message.
- A selected rule with unmet requirements blocks and reports every failing
  requirement in declaration order. It cannot fall through to a permissive rule.
- Effects default to `[]`; each is a flat scalar record with a nonempty `type`.
  Effects describe requested changes; application and unit meanings belong to
  the consumer. They contain no executable strings or callbacks.
- Outcome is `applied` (default) or `resisted`. Resisted rules must have no
  effects. Every rule requires a reason `{code,message}` for its successful match.

Results are `{status,ruleId,effects,reasons}` with fresh mutable arrays/records.
Statuses: `applied`, `resisted`, `blocked`, `unmatched`. Unmatched pairs have null
ruleId and a `no-rule` reason. Blocked, resisted and unmatched results emit no
effects. No rule chaining, state mutation, global event bus or domain vocabulary
is implicit. Recipes decide when to sample conditions; Interaction Lab samples
them at impact and applies hits in chronological order against updated state.

## Input and rendering

`Actions` provides `set(name,down)`, `value(name)`, `axis(negative,positive)`,
`consume(name)`, `clear()` and a flight command via `flight()`. Edges are consumed
once; clearing cancels both edges and held inputs. `attachKeyboard(target,actions,
options)` takes optional bindings/enabled predicate and returns `clear/dispose`.
After adapter `clear()` or blur, auto-repeat cannot re-arm an untracked key:
release it and press again. Repeats of a tracked key retain its held state without
creating another action edge. Ignored repeats still suppress gameplay-key browser
defaults while the adapter is enabled and focus is outside an editable control.
Text fields, controls and buttons retain their ordinary keyboard behaviour.

`attachMouseLook(canvas, options)` is an opt-in browser adapter. Options:
`enabled=()=>true`, positive finite `sensitivity=0.0025` radians per pixel, and
`onLock(event)`, `onUnlock(event)`, `onError(errorOrEvent)` callbacks. A primary
mouse press on the canvas requests Pointer Lock; touch/pen or failed capture
uses relative drag deltas. Browser support and user permission determine capture.
The adapter does not query globals at import time. Pass a canvas with an owner
document and ordinary focus/pointer-capture methods.

- `consume()` returns `{pitch,yaw,primary,pressed}`. Look deltas and the primary
  button edge are drained once; primary held state remains until mouseup.
  Rightward/upward movement produces negative yaw/positive pitch. Queued angles
  are bounded to ±π per consume; non-finite movement is ignored.
- Consume **inside a physics tick**, before updating flight or spawning shots.
  Do not multiply deltas by `dt` or repeatedly feed them into torque. A quick
  click survives until consumed; the initial capture click never fires.
- `locked` reports capture state. `release()` discards queued/held input and
  exits owned capture without invoking `onUnlock`. Unexpected capture loss clears
  input and calls `onUnlock`; apps must pause and clear other adapters there.
- Call `release()` on pause, blur, hidden tabs, reset and mode switches. Resume
  requires a new canvas press. Late acquisition after cancellation is exited.
  `dispose()` releases capture and removes listeners (pending legacy requests
  retain only settlement listeners until they finish). Promise rejection and
  `pointerlockerror` report failure once; arrows remain available.

```js
import {attachMouseLook} from '../modules/input/index.js';
import {lookFlight} from '../modules/flight/index.js';
const mouse = attachMouseLook(canvas, {
  enabled: () => running,
  onLock: () => lookFlight(body), // stop any prior keyboard-driven spin
  onUnlock: () => pause(),       // pause() also calls mouse.release()
});
// Within each fixed update, before stepFlight / projectile spawning:
const look = mouse.consume();
if (look.pitch || look.yaw) lookFlight(body, look);
// Optional fire input: look.primary || look.pressed.
```

`FlightGamepad.sample(pads)` returns a flight command plus `connected/pause`.
It accepts only the standard mapping, selects the first valid controller, and
requires neutral controls after connection or `reset()`. It does not query the
browser itself. `pause` is a rising edge. `deadzone(value,zone)` handles analog
axis deadzones and returns zero for invalid samples/zones.

`new Renderer(canvas)` requires WebGL 1. `mesh(data,primitive)` uploads
interleaved XYZ/RGB vertices with `triangles`, `lines` or `points`.
`begin(position,orientation,options)` clears, resizes and sets the camera;
`draw(mesh)` draws. `clearMeshes()` deletes buffers; `dispose()` also deletes the
program. `boxVertices` and `ringVertices` generate original simple geometry.
`update(mesh,data)` replaces an owned mesh's interleaved XYZ/RGB vertices using
a dynamic buffer upload, retaining its primitive. It rejects a mesh cleared or
owned by another renderer. Supply a finite numeric array with length divisible
by six, just as for `mesh`; geometry validity remains the caller's responsibility.
The application owns context-loss policy and animation scheduling.
