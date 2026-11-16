# Scenic3D — bounded road, environment and vehicle geometry

The experimental [`scenic3d`](../modules/scenic3d/index.js) module provides
original scenery and vehicle presentation for HORIZON-001. It is pure JavaScript:
no renderer, device listener, ambient clock, unseeded randomness or vehicle
simulation. It composes the existing `math` seeded generator/matrices and
`terrain` heightfield. Existing Racing Lab tracks and `road-arcade` are unchanged.

All distances use metres. World coordinates are right-handed, **+Y up and −Z
forward**. Positive yaw follows standard right-handed Y rotation: local −Z turns
toward −X. Do not silently substitute the older Racing Lab's positive-yaw
steering convention when adapting a future vehicle.

## Admit and author a scenery recipe

```js
import {
  starterScenery, validateScenery, serializeScenery, parseScenery,
  buildScenicWorld
} from './modules/scenic3d/index.js';

const draft = structuredClone(starterScenery());
draft.road[3].y = 19;
draft.road[3].bank = 0.15;
const accepted = validateScenery(draft); // new deeply frozen plain-data value
const world = buildScenicWorld(accepted);
const json = serializeScenery(accepted);
const restored = parseScenery(json);
```

`qsol.vanillajs.scenic3d.v1` is a separate HORIZON recipe, not a migration or
replacement for `qsol.vanillajs.track.v1`. Its exact fields are:

| Field | Accepted value |
| --- | --- |
| `format`, `version` | `qsol.vanillajs.scenic3d.v1`, integer `1` |
| `name` | 1–64 characters of trimmed plain text, no control characters |
| `seed` | Unsigned 32-bit integer |
| `profile` | `low` or `high` |
| `environment` | `coast`, `alpine` or `dusk` |
| `road` | 4–32 ordered knots |

Every road knot has exactly `id, x, y, z, width, bank, structure, surface`:

- `id`: unique `[a-z][a-z0-9-]{0,31}`. It identifies the **outgoing span** ending
  at the next knot. The final knot has no outgoing span.
- `x,z`: −1,200…1,200 m; `y`: −20…180 m.
- `width`: **full** paved width, 5…18 m. It is not a half-width.
- `bank`: −0.4…0.4 radians. Positive bank lifts the right edge of the road.
- `structure`: `ground`, `bridge` or `tunnel`, applied to the outgoing span.
- `surface`: `asphalt` or `gravel`, an inert material/contact label. This module
  does not assign tyre grip or any other physical response.

Adjacent knots require 8…200 m horizontal separation and an absolute grade no
greater than 0.7. Total knot chord length is bounded to 2,400 m. Generated road
triangles must remain nondegenerate and upward-facing with normal Y ≥0.15;
unsafe folding or extreme interpolation is rejected. Generated road-edge coordinates are
bounded to ±2,000 m. Curves use eight Catmull–Rom subdivisions per knot span;
width and bank interpolate linearly.

Imports are limited to 32 KiB UTF-8. Unknown fields, unsupported versions/enums,
non-finite values, duplicate IDs, sparse/overridden arrays, accessors and unexpected
prototypes are rejected before accepted data is returned. Validation never mutates
its input. A caller replaces its accepted recipe/world only after admission and
resource construction succeed. Imported text is not HTML, JavaScript or a URL.

## Build retained static batches

`buildScenicWorld(recipe)` returns:

- `recipe`: owned validated recipe.
- `batches`: `{id, material, vertices}` records. Each `vertices` is an owned
  `Float32Array` of triangles, **11 floats per vertex: XYZ, normal XYZ, RGB, UV**.
  Material objects match the [lit renderer](RENDER_LIT_API.md). All positions are
  already in world space, so these static batches use an identity model matrix.
- `road`: a `ScenicRoad` instance with owned surface data.
- `terrain`: the existing `Heightfield`, generated independently of the road.
- `bounds`: actual generated-mesh `{min,max}` corners.
- `stats`: actual vertex/batch/road-triangle counts, terrain-cell count and
  accepted tree count. Requested tree locations outside the bounded terrain or
  underwater are skipped rather than causing an invalid sample.

The original generator creates curved elevated/banked roads, terrain, ground
embankments down to the sampled terrain, trees, cottages, bridge decks/piers and
rails, enclosed tunnel roof surfaces, roadside markings and coastal water.
Objects with the same material are collected into a bounded static batch. The
renderer owns GPU uploads; this module creates no graphics resource.

Profiles retain **identical road and terrain contact geometry**. Both use eight
road subdivisions per span and a 56×56 terrain-cell grid. Low quality requests
30 trees with six-sided crowns and 12-segment vehicle wheels; high quality
requests 84 trees with nine-sided crowns and 24-segment wheels. Static world
vertex ceilings are respectively 100,000 and 280,000. Actual counts depend on
accepted scenery. Renderer resolution/draw budgets are separate.

Terrain grid spacing is a power of two; grid origins are aligned to that spacing
and heights are stored as Float32 values. Therefore generated terrain triangle
coordinates are exactly the coordinates supplied to the retained GPU mesh.
Profile selection cannot quietly change future wheel support surfaces.

The same validated recipe and implementation produce the same source arrays in
one JavaScript runtime. Integer seeding is explicit; trigonometric Float64
geometry is **not** a promise of cross-engine bit identity. GPU pixels, material
shading, browser encodings and physical vehicle trajectories are separate matters.

## Road sampling and the future vehicle contact seam

```js
import {ScenicRoad} from './modules/scenic3d/index.js';
const road = new ScenicRoad(accepted);
const pose = road.sample(road.length * 0.25, 1); // distance, lateral metres
const hit = road.sampleAt(pose.position[0], pose.position[2], {
  surfaceId: pose.surfaceId,
  maxY: pose.position[1] + 0.1
});
```

`road.length` is the generated center-station chord length. `stationCount` gives
the number of sampled cross sections. `stations()` and `triangles()` return
owned data copies; callers cannot mutate the road's private contact surface.
`mesh()` returns the exact triangle mesh, optionally filtered by `asphalt` or
`gravel`.

`sample(distance, lateral = 0)` requires 0…length and an offset within the
interpolated paved half-width. It returns `position`, the actual triangle
`normal`, `yaw`, `pitch`, `roll`, `distance`, `lateral`, `surfaceId`, `surface`,
`structure`, `segment` and `triangle`. Pose rotation is Y(yaw) × X(pitch) ×
Z(roll); its up axis matches the selected planar normal.

The road's quantized left/right vertices define two triangles in every strip.
Sampling uses **piecewise triangle barycentric interpolation**, not a bilinear
height estimate or a separate spline height. Tests compare rendered coordinates
and independent plane-height references for every original road triangle.

`sampleAt(x,z,{surfaceId,maxY = 2000})` queries those same triangles. It returns
`position`, `normal`, orientation and span metadata, or `null` outside the road.
A supplied `surfaceId` must identify an actual outgoing span; it restricts the
query to that surface. `maxY` is a finite −2,000…2,000 m ceiling; among eligible
triangles the query selects the highest support at or below it. Coincident
heights resolve in source traversal order. Queries scan a maximum of 496 road
triangles, with no unbounded search or external resource.

Horizontal overlaps are allowed: IDs and height bounds distinguish bridge and
lower-road surfaces. Terrain remains a separate heightfield. Neither a bridge
nor a tunnel ceiling is silently treated as the terrain's only height. Tunnel
walls, piers and vehicle-body collision are not supplied by this contact query;
future dynamics must explicitly select support/collision contracts.

This API describes surface geometry. It does not implement suspension, friction,
collision response, integration, a car constrained to rails or automatic road
following. HORIZON-002 owns the separately reviewed vehicle simulation.

## Original vehicle geometry and presentation rig

```js
import {buildVehicleVisual, vehicleDraws} from './modules/scenic3d/index.js';
const car = buildVehicleVisual('sport', {
  profile: 'high', paint: [0.10, 0.60, 0.65]
});
// Upload car.parts once. Each draw references that same retained part.
const draws = vehicleDraws(car, {
  position: pose.position,
  yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll,
  wheelSpin: 1.2, steer: 0.18,
  compression: [0.05, 0.04, 0.02, 0.03], brake: 0.8
});
```

Original `sport`, `touring` and `utility` classes have distinct lofted bodies,
bonnet/cabin/roof proportions, glass, door seams/handles, mirrors, bumpers,
headlights/brake lamps, circular tyres, alloy wheel faces and class-specific rear
wing or roof rails. These are generated original assets, not copied car models.

`buildVehicleVisual(classId, {paint,profile})` returns a branded owned visual with
`dimensions` (`length,width,height,wheelbase,track,wheelRadius`), `parts`, four
`wheels`, neutral-pose `bounds` and `stats`. Each of its 13 parts has `id`, `group`,
`vertices`, `material` and `wheel` (index or null). Groups are `body`, `glass`,
`trim`, `lamp`, `brake` and `wheel`. Descriptors are frozen; vertex buffers are
owned by the consumer. Paint is an RGB triple in 0…1.

`vehicleDraws(visual, pose)` returns `{part,matrix,material}` records without
regenerating meshes. It accepts only a visual created by the builder. Optional
pose fields default to zero and position to `[0,0,0]`:

| Pose field | Bound and meaning |
| --- | --- |
| `position` | Three world metres in ±2,000; origin is the neutral ground plane |
| `yaw` | ±4π radians, standard right-handed Y rotation |
| `pitch`, `roll` | ±π radians, cosmetic/body orientation supplied by consumer |
| `wheelSpin` | ±1,000,000 radians; rotation about the wheel's local X axle |
| `steer` | ±0.65 radians, applied only to the two front wheels |
| `compression` | Four 0…0.25 m values: front-left, front-right, rear-left, rear-right |
| `brake` | 0…1, raises the brake-lamp material emission |

The rig consumes state only. It changes neither supplied pose nor source
geometry; it creates no torque, tyre forces or canonical movement. Suspension
compression is a visible wheel offset, not a claimed spring/damper solver.
A caller decides what a wheel-spin angle means and how it relates to distance.

## Contact-shadow patch

`createRoadShadow(road,{distance,lateral=0,width=3,length=5,offset=0.025})` returns
an owned 11-float triangle buffer with UV 0…1. Its small 4×2 patch samples the
road and lifts vertices along their actual normals. Use a black material with
`pattern:'shadow'` and bounded opacity in the lit renderer. This is a cosmetic
road-contact patch, not a shadow map, ray tracer, occlusion proof or new collider.

Width is 0.2…5 m, length 0.2…10 m and lift 0.005…0.1 m. The patch must fit the
road distance and lateral bounds. Invalid placement is rejected. Render it after
opaque road geometry and before/with other transparency in the application's
chosen order; the renderer does not infer arbitrary scene transparency ordering.

## Verification

```sh
node --test tests/scenic3d.test.js
```

Cases cover strict format admission and owned roundtrip, exact road mesh/contact
triangles, overlapping bridge/lower surfaces, low/high contact identity,
heightfield/mesh alignment, seeded source arrays, normal winding and budgets,
three distinct car silhouettes, real wheel geometry, rig transforms/brake state
and bounded contact shadows. Packaged renderer/Lab verification is recorded by
the HORIZON-001 PR; pure numerical tests do not establish GPU or device support.
