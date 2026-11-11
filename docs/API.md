# API contracts — 1.0.0 (experimental)

All paths are native ES modules. Public numerical routines require finite values
unless otherwise stated. Vector arithmetic expects correctly sized numeric arrays;
`finiteVector` is available for validation at application boundaries. Returned
math arrays are new arrays. Body state is deliberately mutable and owned by the
caller; do not replace its fields with invalid values between simulation ticks.

ARCH-OMI-001 is a separate research surface in `experiments/arch-omi/index.js`.
Its strict integer encoding, delta/XOR operations, tetrahedral relations and
bounded orbit API are documented in [ARCH_OMI.md](ARCH_OMI.md#experimental-api).
The Brass Engine’s staged mechanism and replay schema are demo-owned contracts
documented in [BRASS_ENGINE.md](BRASS_ENGINE.md); they are not core game APIs.
The Clockwork Vault adds demo-owned puzzle, expedition and replay contracts in
[CLOCKWORK_VAULT.md](CLOCKWORK_VAULT.md). The 1.0.0 showcase version does not change
the experimental maturity recorded in `MODULES.json`. Core game modules do not
depend on the research entry.



## Integer engine (experimental)

The four `integer-*` modules use strict integers and owned snapshots, in contrast
to the mutable legacy bodies described above. Their full public contracts,
rounding, overflow, tick units and runnable composition example are in
[INTEGER_ENGINE.md](INTEGER_ENGINE.md). Integer Foundry is the first consumer.

## Optional static geometry layer (layer 2)

```js
import {boxMeshBatch,StaticAABBIndex,classifyAABBFrustum} from '../modules/geometry/index.js';

// Builds GPU-ready triangles with exact parity to
// new Float32Array(boxes.flatMap(b => boxVertices(b.center,b.size,b.color))).
const mesh=renderer.mesh(boxMeshBatch(boxes));
const staticIndex=new StaticAABBIndex(staticColliders);
const hit=staticIndex.castSegment(start,displacement,{halfSize:0,ignoreIds:[]});
// hit.index remains the original staticColliders index, or null for a miss.
const state=classifyAABBFrustum(bounds,[[1,0,0,2],[0,1,0,3]]);
// -1 definitely outside; 0 intersects or uncertain; +1 definitely inside.
```

`boxMeshBatch` takes an array of at most 16,384 boxes. Each box has finite
three-coordinate `center`, `size`, `color`. It rejects malformed input
before output allocation and returns one new owned Float32Array of precisely
216 values per box (36 XYZ/RGB vertices). Geometry on the GPU, not the
pre-upload JS-number representation, is the exactness contract. Signed-zero
and Float32 byte parity with the legacy builder are regression-tested.

`StaticAABBIndex` owns a frozen copy of at most 65,536 unique named static
colliders, each `{id,box:{min,max}}` with a positive-volume AABB. It builds
a balanced median-split bounding hierarchy. Both the collider coordinates and
cast origin/displacement/endpoint must stay within ±1e9 metres; halfSize is a
finite value from zero to 1e9. A query returns sorted original candidate indices,
allowing false positives but not false negatives. `castSegment` invokes the
existing canonical collision narrowphase on those candidates, preserving
stable ID tie-breaks and the original collider index. It is **not** safe to
reuse after moving, resizing or replacing world collision boxes: create a new
index from the new snapshot. This implementation covers static segments only,
not translating targets, rotated bodies or general rigid-body collision.

`classifyAABBPlane(box,[nx,ny,nz,d])` and
`classifyAABBFrustum(box,planes)` use classical ternary containment status:
-1 = certainly outside, 0 = crossing/numerically uncertain, +1 = certainly
inside. The accepted halfspace is non-negative plane signed distance. A
coefficient normalization plus relative and absolute subnormal-roundoff margins protect exact boundaries. Zeroed **or nonzero-subnormal** normalized coefficients are conservatively uncertain, preventing magnification of division rounding errors by large box coordinates. The functions are
pure helpers; they do not automatically cull or alter draw order. Only -1
authorizes skipping geometry.

An independent research entry,
`experiments/e8-geometry/index.js`, offers `generateE8Roots()` and
`projectE8RootPoints({scale})`. The first returns 240 eight-component
vectors; the second emits 240 Float32 XYZ/RGB point vertices using a
declared authored 3D linear projection. It is **not** a distance-preserving E8
embedding, gameplay collider, or audio/QEC simulation.

Detailed source pinning, benchmark boundaries, and rollback:
[Geometry layer 2](GEOMETRY_LAYER2.md). This layer does not depend on the
separate OPT renderer optimization PR #13.

## Navigation

```js
import {NavigationGrid,findPath,formationSlots} from '../modules/navigation/index.js';
const grid=new NavigationGrid({width:24,height:16,cellSize:1,origin:[0,0],blocked:[[8,7]]});
const route=findPath(grid,[3,4],[21,8],{maxExpanded:4096});
if(route.status==='found') console.log(route.path,route.cost); // endpoints; metres
const closed=grid.withBlocked([[8,4]],true); // new snapshot; original is unchanged
const group=formationSlots(closed,[21,8],6,{exclude:[[21,9]],maxExpanded:4096});
```

`NavigationGrid` is immutable and owns its occupancy bits; constructor/edit input
arrays are copied. `width`/`height` are positive integers, with at most 65,536 cells.
`cellSize` is finite positive metres; `origin` contains finite world `[X,Z]` for
the minimum corner. Extents and maximum route length must remain finite. Scales
too small to represent cell centres relative to world bounds are rejected.
Columns increase along +X, rows along +Z; +Y remains height outside this module.

Cells are two safe integers. `contains(cell)` tests bounds; `walkable(cell)` also
tests occupancy. Both return false outside the grid, and throw for malformed
cells. `cellCenter(cell)` returns a new world `[X,Z]` and rejects out-of-bounds
cells. `worldToCell([X,Z])` uses half-open bounds: minimum included, maximum
excluded; outside returns null, malformed/nonfinite input throws. Standard
floating-point boundary rounding applies. `withBlocked(cells,boolean=true)`
returns a new grid snapshot after validating all edits, and rejects out-of-bounds
cells. It never changes the original; duplicate edits are harmless. Returned
arrays, including centres, routes and slots, are owned by the caller.

`findPath(grid,start,goal,{maxExpanded=4096})` performs four-neighbour A* with
uniform edge costs. No diagonals or corner cutting; cells represent points,
not swept bodies. `maxExpanded` must be an integer in 1..65,536 and counts settled
cells including the goal. It bounds search work, not elapsed milliseconds; arrays
are allocated for the whole grid and heap work also depends on its frontier.
Exact ties use total cost, Manhattan heuristic, then row-major cell index.

| `status` | Meaning | `path` / `cost` |
| --- | --- | --- |
| `found` | Shortest path on this immutable grid | Both endpoints; distance in metres |
| `blocked` | Either endpoint is outside or occupied | Empty / null; zero expansions |
| `unreachable` | Entire reachable component exhausted | Empty / null |
| `budget` | More work remains after the expansion limit | Empty / null; no partial route |

The result also includes `expanded`. Start equal to goal returns one cell, zero
cost and one expansion if walkable. Route lengths optimise uniform grid steps,
not turning radius, terrain weight, moving obstacles or future traffic. A caller
must replan against changed terrain and validate movement separately.

`formationSlots(grid,anchor,count,{exclude=[],maxExpanded=4096})` collects nearby
walkable cells in breadth-first order, using north/west/east/south neighbours.
`count` is 1..256. Excluded in-bounds cells can be traversed but are never selected.
Returns `{status,slots,expanded}`: `found` means exactly the requested number;
`partial` means the connected component has too few available cells; `budget`
means more search remains; `blocked` means an occupied/outside anchor. Partial and
budget results contain only the slots found so far. Consumers requiring a whole
formation must reject both. Slots are unique and reachable from the anchor on the
supplied grid; this does not prove every agent can reach them. Assignment, spacing,
unit footprint, collision avoidance and multi-agent scheduling belong to callers.
There is no DOM, clock, random source or other module dependency.

### Shared flow fields (0.7.0)

```js
import {FlowFieldSearch} from '../modules/navigation/index.js';
const build=new FlowFieldSearch(grid,[[21,3],[21,12]]);
// Call from your own fixed update, skipping it while paused.
const progress=build.step(32);
if(build.status==='ready'){
  const field=build.result;
  const sample=field.sample([3,4]);
  // sample.next is one cardinal cell; validate occupancy before moving a body.
}
```

`new FlowFieldSearch(grid,goals)` takes a `NavigationGrid` and an array of 1..256
cells. It copies inputs, removes duplicates and sorts goals by row-major order.
Malformed cells/arguments throw. If any goal is occupied or outside the grid,
the whole request has status `blocked`, zero expansions and no result. Otherwise
the status starts as `building`. Construction allocates/initialises O(grid cells)
storage synchronously; incremental stepping does not eliminate this setup cost.

`step(maxExpanded=256)` accepts an integer 1..65,536. It settles at most that many
cells and returns `{status,processed,expanded,pending}`. `processed` is work in
this call; `expanded` is the cumulative count; `pending` is the queued frontier.
Each reachable cell is settled once. Total work is bounded by 65,536 cells per
build. Uniform edges permit breadth-first integration; no heap is needed here.
One cell expansion includes up to four neighbour checks. These limits count
algorithmic work, not milliseconds, allocation or a browser frame-rate budget.

`grid`, `status`, `expanded`, `pending` and `result` are read-only getters.
`result` is null until the entire reachable region has been settled and status
becomes `ready`. No partially built direction map is exposed. `cancel()` changes
a building search to `cancelled`, clears pending work and leaves `result` null.
Terminal states (`ready`, `blocked`, `cancelled`) remain terminal; later valid
`step` calls process zero cells, and `cancel` does not discard a ready result.
Invalid step budgets always throw without changing state.

A completed field exposes its immutable `grid`, a deeply frozen `goals` list,
and `sample(cell)`. Samples are new owned objects/arrays:

| Sample `status` | `cost` | `next` / `direction` | `goal` |
| --- | --- | --- | --- |
| `reachable` | Shortest distance in metres | Next cardinal cell / unit `[X,Z]` vector | Nearest reachable goal |
| `goal` | 0 | null / `[0,0]` | This cell |
| `unreachable` | null | null / `[0,0]` | null |
| `blocked` | null | null / `[0,0]` | null |

`blocked` includes out-of-bounds cells; malformed cells throw. Equidistant goals
prefer the smallest row-major goal, independent of input order or build chunking.
Equal-cost next steps toward that goal use north/west/east/south order. A reachable
step reduces cost by exactly one `cellSize`; following these steps reaches a goal
on this snapshot without loops. A* may return a different equally short route.
`sample` examines at most four neighbours and owns no moving-agent state.

Fields never update automatically: after a terrain edit, old fields still describe
the old snapshot. Check `field.grid===currentGrid` and track the active destination
generation in the consumer. Cancel superseded builds and publish only the current
completed result. Destination edits also require a rebuild, even on the same grid.
Fields optimise distance, not congestion, exit capacity, formation shape, physical
collision or mutual steering. See [the lab composition](FLOW_FIELDS.md).

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

## Grounded character (0.3.0, stance extension in 0.4.0)

`createCharacter({position=[0,0,0], velocity=[0,0,0], halfExtents=[.35,.9,.35],
eyeHeight=1.62, crouchHalfHeight=halfExtents[1]*.6,
crouchEyeHeight=eyeHeight*.6, yaw=0, pitch=0})` creates mutable, caller-owned state. Position
is the **centre of the feet**, velocity is world m/s, and the upright collider
centre is `position + [0,halfExtents[1],0]`. Vectors are cloned and finite;
extents must be positive and eyeHeight strictly inside the full body height.
The initial `grounded:false` is resolved against real support on the first tick.
The initial stance is standing. State retains `standingHalfHeight`,
`standingEyeHeight`, `crouchHalfHeight`, `crouchEyeHeight` and `crouched`.
`halfExtents[1]` and `eyeHeight` describe the **current** stance. Crouch half-height
must be positive and smaller than standing half-height; its eye must be positive,
below crouch full height and below standing eye height. Do not mutate these
fields to invalid values between calls.

`characterConfig(options)` validates and returns these finite values:

| Setting | Default | Meaning |
| --- | --- | --- |
| walkSpeed / sprintSpeed | 5 / 8 | Local horizontal target speed, m/s |
| crouchSpeed | 2.5 | Crouched target speed, m/s; overrides sprint |
| groundAcceleration / airAcceleration | 40 / 8 | Horizontal acceleration limit, m/s² |
| gravity | 22 | Positive downward acceleration, m/s² |
| jumpSpeed | 7.2 | Vertical take-off velocity, m/s |
| stepHeight | 0.3 | Maximum attempted static stair rise, m; zero disables stepping |
| groundSnap | 0.12 | Maximum downward ground-follow distance, m; zero disables snap |

All settings are nonnegative, with strictly positive gravity. The config remains
caller-owned; edits must preserve its invariants.

`stepCharacter(character, {move=[0,0], sprint=false, jump=false, crouch=false}, dt, config, boxes)`
mutates pose, velocity and grounded state. `move` is local `[x,z]`, with **-z
forward**; components are clamped and diagonals limited to magnitude one. Movement
uses yaw only, so looking up never turns walking into flight. Ground acceleration
also brakes toward rest; airborne motion keeps horizontal momentum when there is
no movement command. Gravity uses semi-implicit Euler. `jump` is a **fresh-press
request**, ignored without actual support; callers consume an input edge once.

`dt` must be in `[0,.05]` seconds; zero changes nothing. Return value is
`{contacts:[{index,normal}], grounded, crouched, standBlocked, jumped, stepped, truncated}`. Contacts refer
to the supplied static box array. Grounded state is probed at the final position,
not inferred from a contact left behind earlier in the tick.

`crouch` is held state, not a press edge. Stance changes are instantaneous at
tick start, preserve feet position and use the same acceleration/gravity rules.
Releasing requests standing. If its full candidate body has positive-volume
overlap with any static box, the smaller stance remains and `standBlocked:true`
reports that decision. Face tangency is allowed; walking free of the roof permits
standing on the next tick. Blocked-standing checks occur before movement. Zero
dt returns current stance and `standBlocked:false` without a geometry query.
Crouched jumping is allowed; the smaller collider still hits ceilings. In air,
changing stance does not anchor the head or change the feet's ballistic path.
The eye changes with stance; render interpolation is the consumer's choice.

The controller shares the rectangular swept/slide solver. While grounded and
horizontally obstructed it compares the direct path with a bounded up/across/down
step. A step needs full overhead clearance, landing support and improved forward
progress. Ground snap follows only short downward drops and never pulls a jumping
character down. Support probing uses 2 mm; comparison tolerance is 10 µm. This is
an arcade controller for metre-scale environments, not force-based biomechanics.

`lookCharacter(character,{yaw=0,pitch=0})` consumes finite relative **radians**.
Yaw wraps, pitch clamps to `±(π/2 − .01)`, and no angular velocity is stored.
`characterView(character)` returns owned `{position,orientation}` arrays for the
current stance eye height and roll-free yaw/pitch view. Positive yaw turns toward -X,
positive pitch looks up. Input deltas are applied once, without multiplying mouse
movement by dt; keyboard angular rates are converted to deltas using dt.

The static `stepCharacter` API has no moving platforms, slopes, capsules, coyote
time, jump buffering or head bob. Use the explicit platform controller below
for translating surfaces. Shot queries alone never carry or push a body.
The eye lies inside the body; this is not a separate third-person camera sweep.

### Platform character (0.5.0)

`stepCharacterPlatforms(character, input, dt, config, colliders)` uses characters
from `createCharacter`, the same movement/crouch/jump/look conventions and `[0,.05]`
second dt limit. Every surface is `{id,box,displacement?}`: unique nonempty string
id, start-of-tick AABB and world translation over the whole tick. Omit displacement
for a stationary wall/floor. IDs must persist while riding a surface. Supply **all**
obstacles, including static walls/ceilings. Initial body overlap is rejected.

Unlike `stepCharacter`, this controller uses continuous relative-motion body
queries and does **not** run stair stepping or the `groundSnap` distance pass;
`stepHeight` and `groundSnap` are unused. The small 2 mm support probe still applies.
It supports walking/sprinting/crouching, gravity, landing and fresh-press jumps.
There is no rotation, resizing, slopes, capsules or reciprocal body dynamics.
Choose one controller for a world instead of invoking both in the same tick.

`createCharacter` now also initializes `supportId:null` and
`supportVelocity:[0,0,0]`. Platform updates set these to the final support's id and
world m/s, or null/zero when airborne. **`character.velocity` remains world m/s**:
horizontal target speeds are relative to support. An attached rider adjusts for
changes in support velocity, so acceleration/reversal does not accumulate carry.
A resting spawn can acquire a descending surface. Landing resolves normal speed;
horizontal motor acceleration then matches the surface plus commanded movement.

Jump adds `jumpSpeed` to the support's vertical speed, retaining horizontal world
velocity. Walking off retains world velocity too. Subsequent airborne ticks do
not add carry again; existing air control/gravity apply. Support is re-probed at
the final world pose using relative vertical velocity; exact ties use string id.
Crouch keeps feet anchored and checks standing headroom against start boxes;
continuous movement detects approaching ceilings later in the tick. The static
controller clears support metadata on a successful nonzero update.

Returns `{contacts,grounded,crouched,standBlocked,jumped,stepped:false,truncated,
blocked,supportId}`. Moving contacts are `{id,index,normal,time}` with time in
seconds from tick start. Successful calls mutate body state. If the collision
budget is exhausted or geometry cannot fit the body, `blocked` and `truncated`
are true and **every character field is unchanged**. Transition flags are false;
contacts describe the rejected attempt. Invalid input throws without mutation;
zero dt returns current state without geometry queries.

The caller MUST NOT advance collider poses after a blocked attempt. Stage all
riders/world objects if a game has more than one actor; this API is not a global
transaction manager. FPS Lab rejects that platform tick, then updates the rider
against stopped surfaces so they can duck or move clear. Collision skin is 1 µm;
provide real clearance, rather than relying on an exactly body-sized enclosure.

## Weapon timing (0.3.0)

`new WeaponTimer({magazineSize=8, ammo=magazineSize, reserve=32, interval=.2,
reloadTime=1.2})` owns magazine, cooldown and reload state, with no geometry, input,
randomness, renderer or damage policy. Magazine size is a positive safe integer;
ammo is a safe integer in `[0,magazineSize]`; reserve is a nonnegative safe integer.
Both timings are finite seconds, at least `.05`.

`step(dt,{fire=false,reload=false})` accepts `dt` in `[0,.05]`. Zero is inert.
Fire is a request at the tick start: a fresh edge gives single-shot behaviour;
a held request gives automatic fire. At most one shot occurs per call, and
cooldown-blocked requests are discarded, never queued for a later burst. With
fixed ticks, cadence rounds conservatively to a tick boundary. The minimum
interval matches the maximum step size.

Reload takes priority when the magazine is not full and reserve is available.
It preserves existing rounds and transfers only the missing amount at completion.
Held fire cannot interrupt reload or fire on its completion tick. No automatic
reload, chambered extra round, ammo pickup or trigger-edge tracking is implicit.

| Event | Fields |
| --- | --- |
| shot | `type:'shot', time:0, id` (monotonic integer) |
| reload-start | `type:'reload-start', time:0` |
| reload-complete | `type:'reload-complete', time, rounds` |

Event time is seconds within the supplied tick. A reload started and completed
in one call reports both events in order. Empty or blocked fire emits no event.
`snapshot()` returns an owned record with `ammo`, `reserve`, `magazineSize`,
`cooldown`, `reloadRemaining`, and `phase` (`ready`, `cooldown`, `reloading`,
`empty`). Not calling `step` pauses all timers. Clear gameplay input at pause;
this timer cannot distinguish a fresh physical press from a caller's stale flag.

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

### Rectangular body queries (0.3.0)

`sweepAABB(origin,displacement,halfExtents,box)` has the movement sweep's semantics,
with positive xyz half-extents. It sweeps an upright rectangular **centre** against
one static AABB; initial overlap is not recovered. It validates finite vectors,
positive box volume and representable expanded extents.

`moveAndSlideAABB(position,velocity,dt,halfExtents,boxes,maxSlides=6)` performs
bounded penetration recovery, continuous collision and sliding with rectangular
extents, returning the same shape as `moveAndSlide`. It validates the supplied
geometry and nonnegative finite dt, without mutating inputs. Exact contact ties
retain box-array order. The existing `sweepBox` and `moveAndSlide` scalar cube
APIs keep their signatures and behaviour; ray/projectile queries keep their
separate closed-volume initial-overlap semantics.

### Moving rectangular-body solver (0.5.0)

`moveAndSlideMovingAABB(position, velocity, dt, halfExtents, colliders, maxSlides=8)`
uses a body's **centre**, finite world m/s and positive xyz half-extents. dt is
finite and nonnegative; the slide budget is an integer in `[1,32]`. Collider
records use unique IDs, validated tick-start boxes and optional finite translation
for the same dt. Static geometry omits translation. Zero dt returns copies of the
input pose/velocity with empty contacts, fraction one and no geometry query.

For each remaining subinterval it sweeps relative body/surface displacement,
chooses earliest contact (exact ties by string id), advances both on the same
clock, nudges the body by 1 µm and removes only inward **relative normal velocity**.
Tangential surface velocity is not automatically inherited: the character layer
supplies riding behaviour. Initial penetration is not recovered; it returns a
truncated attempt. No friction, restitution, mass, angular motion or mutual push
response is modeled. All paths are linear within the supplied interval; split
at discontinuities. There is no claim of general constraint solving.

Returns `{position,velocity,contacts,fraction,truncated}`. `fraction` is the
normalized resolved time; contacts contain `{id,index,normal,time}` with time in
seconds. An exhausted budget, initial overlap or unresolved penetration sets
`truncated:true` and returns zero velocity and the partial candidate position.
That position can belong to an unresolved enclosure: **never blindly commit it
or full collider end poses**. Roll back the whole transaction, or use a separate
world-level recovery policy. `stepCharacterPlatforms` handles body rollback.
Finite vector/box/relative-travel overflows throw; supplied arrays are not mutated.

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

### Translating-target queries (0.4.0)

`castMovingSegment(origin, displacement, colliders, options)` has the same result,
options, id validation, closed-volume contact and exact-time tie rules as
`castSegment`. Each collider adds optional `displacement:[dx,dy,dz]` (default
zero), a finite **world translation over the entire query interval**. Its box is
at interval start. Query displacement and all collider displacements share that
interval. Geometry may translate only: no rotation, scale change or teleport.

The query subtracts collider translation from segment translation, then sweeps
against the start box. A moving box can therefore hit a stationary shot; its
`distance` stays zero. The result `time` is a normalized shared-interval fraction,
`point` follows the shot's **world-space centre**, and `normal` is the box-face
normal at contact. It is not a target-relative point or a rendered decal position.
`startedInside` checks time zero. A target that escapes the path before arrival
is missed even if a static snapshot would intersect. Walls and moving targets
compete in the same nearest-hit ordering.

Motion is validated even on ignored colliders; non-finite or unrepresentable
relative travel/translated expanded extents throw. Inputs are not mutated. Split
queries at path changes; this is linear continuous collision, not continuous
collision for arbitrary curved/rotating bodies. Static `castSegment` and
`raycast` deliberately ignore extra `displacement` fields and keep their original
instant/static semantics.

## Projectiles

`new ProjectileSystem({capacity=128})` requires a positive safe integer capacity.
It owns constant-velocity point/cube motion. `step` treats targets as static;
`stepMoving` accepts their translation over the tick.
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

`stepMoving(dt,colliders)` has the same lifecycle and event semantics, using
`castMovingSegment`. Collider displacement covers **all dt**, not the shorter
lifetime of an individual shot. For each shot the system scales target travel by
`min(dt,remaining)/dt`, so a box cannot hit it after expiry. Event `time` is seconds
from this tick's start; nested `hit.time` remains a fraction of that shot's clipped
travel interval. World impact point/normal follow the query contract. Omit
collider displacement for static walls. Zero dt is inert, and an empty system
performs no collision query. The caller advances target boxes after the query;
the system neither owns target paths nor resolves target/target collisions.

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

`fpsBindings` maps WASD to movement actions, C to held crouch, Space to jump, either Shift to
sprint, arrows to pitch/yaw, F to fire and R to reload. `flightBindings` is
unchanged. FPS consumers use `Actions.axis` and consume jump/reload/fire edges;
`Actions.flight()` remains a flight-specific convenience.

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
Storage grows to the exact byte length when necessary and is reused with
`bufferSubData` for equal/smaller updates. Empty updates draw zero vertices; old
tail bytes are never drawn. Capacity remains at the mesh's largest upload until
`clearMeshes()` or `dispose()`. Ordinary input arrays still convert to Float32; prepacked `Float32Array` views
are passed directly to WebGL without a redundant CPU conversion/copy. WebGL
copies submitted bytes to its buffer before returning, so changing the input
after upload cannot alter a draw. No global pool or cross-renderer reuse is used.

`updateRange(mesh,firstVertex,data)` uploads only a **whole-vertex contiguous
subrange** of the existing live XYZ/RGB data (six floats per vertex). The
zero-based `firstVertex` is not a byte offset, its range must fit
`mesh.count`, and the draw count and existing GPU allocation are unchanged.
Invalid or stale handles and out-of-draw-range writes are rejected before upload.
An empty range at the end is a no-op. The caller tracks dirty vertices and
supplies the complete replacement values for that range; the renderer does not
infer dirty state. Upload errors propagate; a GL failure does not constitute a
transactional rollback guarantee. These are optional APIs, and the default full
`update` path remains available for fast-changing complete meshes.

The application owns context-loss policy and animation scheduling.

## Optional CPU / GPU graphics and space labs

See [the GPU/WASM and Space Game Lab guide](OPTIONAL_GPU_WASM.md) for the experimental
CPU-first renderer, explicit player opt-in, editor project setting and playable
HTML export, exact-math preparation, resource limits, and local test commands.
The project v2 envelope preserves graphics policy; legacy v1 projects still load.
Existing WebGL APIs remain supported.

## Exact D4 authoring symmetry (experimental)

`modules/exact-d4/index.js` exports `D4_ELEMENTS`, `composeD4`, `inverseD4`,
`determinantD4`, `transformPoint2`, `transformBox2` and `squaredDistance2`.
Composition applies the right operand first. Actions use existing genuine rational
XY points/boxes; reduced squared-distance overflow rejects rather than quantizes.
See [ALIEN-MATH-004](ALIEN_MATH_004.md) for the complete bounded contract and example.

## Exact graph authoring (experimental)

`modules/exact-graph/index.js`: `ExactGraph`, `MAX_VERTICES`, `breadthFirst`,
`depthFirst`, `connectedComponents`, `relabelGraph`, `graphInvariants`,
`characteristicPolynomial`, `closedWalkCounts`. Simple undirected graphs with
0–16 vertices; no loops or duplicate edges. Exact BigInt polynomial coefficients
are in descending powers. See [ALIEN-MATH-005](ALIEN_MATH_005.md) for bounds,
traversal tie rules, input admission, invariance limits and the standalone lab.


## QGAME-MATH-001 experimental modules

`gf3` provides bounded exact finite-field vectors, matrices, affine transformations, syndromes and directed state graphs. `symbolic-events` declares deterministic composition rules and adapts canonical events to existing audio2d reference PCM. `mod-experiment` adds typed inert experiment admission over MOD-SDK-001. See [the API, schemas and numerical boundaries](QGAME_MATH_001.md). Existing gf3-lattice, exact math, course and registry APIs are unchanged.
