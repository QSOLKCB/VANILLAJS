# API contracts — 0.1.0 (experimental)

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

## Input and rendering

`Actions` provides `set(name,down)`, `value(name)`, `axis(negative,positive)`,
`consume(name)`, `clear()` and a flight command via `flight()`. Edges are consumed
once; clearing cancels both edges and held inputs. `attachKeyboard(target,actions,
options)` takes optional bindings/enabled predicate and returns `clear/dispose`.
Text fields, controls and buttons retain their ordinary keyboard behaviour.

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
The application owns context-loss policy and animation scheduling.
