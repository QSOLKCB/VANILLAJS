# Scene Composition — hierarchy, prefabs and animation

The [Visual Workbench's Scene Composition panel](../demos/editor/index.html#scene-composition)
extends the editor with an independently reusable scene sidecar. It is part of
the **v2.7.0 candidate**, not a change to existing scene/project formats.

A scene node describes an object relative to its parent. Moving a parent moves
its children. A component describes a specific role—box mesh, appearance,
camera or light—without turning data into a script. A prefab is a reusable group
of nodes, and a track records transforms at chosen times.

## Make a moving lantern

1. Open the Workbench and expand **Scene Composition · hierarchy & animation**
   below Asset Foundry and Visual FX. Choose **Load Lantern Assembly**.
2. Choose **Preview at time** at 0 seconds, then at 3 seconds. The lantern moves
   around its parent arm through the real scene graph and existing WebGL renderer.
   **Play animation**, **Pause** and **Restart preview** use the same sampler.
3. Choose `lantern`. Set local position to `3, 1, 0`, change its colour, and
   **Apply local transform & appearance**. The parent arm's existing track still
   animates; your child stays attached. Read its evaluated world position below.
4. To animate that child too, set time to 0 and choose **Keyframe composition
   transform**. Change its local position to `3, 3, 0`, apply, then capture at
   6 seconds. Preview at 3 seconds to inspect the interpolation. A node's keys
   override its base transform while sampling; **Remove selected node track**
   restores the base pose.
5. **Undo composition** and **Redo composition** apply only to the sidecar.
   Enter a zero scale and apply: validation reports the error and keeps accepted
   data. Correct the value before continuing.
6. **Export scene composition** saves validated JSON. Reimport it to restore
   nodes, components, tracks and prefabs. The export is reusable game data,
   not a complete game or executable plugin.

There is no autoplay audio. Keyboard focus indicators and labelled native controls
remain available on narrow screens. Blur/hidden-page transitions pause animation.
Workbench **Play**, including its paused state, locks sidecar editing; use
**Stop scene & edit composition** to return to authoring.

## Use your existing Workbench scene

Build or edit objects with the existing hierarchy and inspector, then choose
**Capture Workbench hierarchy**. Local positions, Y rotations, scales, colours,
visibility and enabled mesh/camera descriptors become a new scene graph. The
original scene and its physics state do not change.

**Keyframe selected inspector transform** copies the selected Workbench object's
local transform into the selected composition node at the entered time. The two
selections are independent. This allows existing gizmos, snapping and exact
position authoring to supply keys. Later edits do not silently overwrite previous
keys or recapture the scene.

This bridge captures box descriptors. It does **not** copy imported OBJ meshes,
texture payloads, physics bodies, controllers, triggers or game rules into the
sidecar. Keep the original Workbench project for those assets and semantics.
Capture preserves the authored local values. Legacy Workbench `sceneWorld` uses
a decomposed yaw/scale approximation; this sidecar composes full affine matrices.
A rotated child under a nonuniformly scaled parent can therefore look different
from the legacy preview because the sidecar retains actual shear. Uniform-scale
hierarchies and ordinary root objects retain their intended placement.

Existing v1 and v2 scene JSON roundtrips and project imports remain unchanged;
existing physics bodies still must be scene roots.

## Reusable and nested prefabs

Select a directly authored node and choose **Save selected subtree** with a unique
prefab ID such as `lantern`. The prefab captures that node and its direct authored
descendants in their base poses. Tracks remain scene-owned; they are not copied
into prefab definitions.

Choose the prefab, give the instance a unique ID and local offset, select
**Scene root**, then **Add prefab instance**. Instances receive independent paths,
for example `copy/lantern`. Select another saved prefab under **Add instance to**
to place one prefab inside another. Instancing that outer prefab expands the whole
nested assembly.

Cycles, missing parents/definitions, duplicate IDs, excessive depth and expansion
beyond 128 nodes are rejected before replacement. Saving a subtree that already
contains placed instances asks you to capture direct nodes first; definitions and
nested instance data remain editable through **Inspect validated JSON**.

## Camera and light components

Enable **Use as camera** on a node, set its position/rotation and FOV, then apply.
The first visible camera in deterministic parent-first traversal drives the
composition preview. A camera faces local −Z with +Y up. Use a unit-scale camera
and ancestors for an ordinary perspective view; nonuniform scale/shear in its
world matrix is included in the inverse view transform. Without an active camera,
the preview uses a fixed orbit view.

Ambient light components tint/expose box colours in this preview. Directional
light direction follows the node transform, and roughness is bounded appearance
metadata exported for a consumer. **Directional lighting and roughness shading
are not implemented by this flat-colour preview.** It reuses the current renderer,
not a new material system. Multiple ambient lights add with bounded display colour
clamping. Consumers may interpret the documented descriptors through their own
explicit adapters.

## Pure public API

```js
import {
  createSceneGraph, sceneNode, SceneGraph, serializeSceneGraph,
  localToWorld, worldToLocal
} from './modules/scene-graph/index.js';

const data = createSceneGraph('Signal tower');
data.nodes = [
  sceneNode('tower', {position: [0, 1, 0], mesh: false}),
  sceneNode('lamp', {
    parent: 'tower', position: [2, 1, 0],
    scale: [.5, 1, .5], color: [1, .65, .24]
  })
];
const scene = new SceneGraph(data); // owns a validated copy
const world = scene.sample(0);     // no clock or simulation advancement
const point = localToWorld(data, 'lamp', [0, 0, 0]); // [2, 2, 0]
const local = worldToLocal(data, 'lamp', point);    // [0, 0, 0]
const json = serializeSceneGraph(scene.snapshot());
scene.replace(json); // validated before replacing the accepted snapshot
```

`validateSceneGraph(objectOrJSON)` returns an owned validated record.
`sampleSceneGraph(graph, seconds)` validates and samples in one call; use
`SceneGraph` for repeated frames to validate once. `snapshot()` returns an owned
copy. `replace()` rejects invalid input without changing accepted state.

`transformMatrix(transform)`, `multiplySceneMatrices(a,b)`,
`inverseSceneMatrix(matrix)` and `transformPoint(matrix,point)` use explicit
column-major Float64 affine arrays. A sampled node includes its local transform,
components, effective visibility, world matrix and world position. Children follow
parents in stable input order. Hidden parents hide descendants.

### Versioned data contract

`qsol.vanillajs.scene-graph.v1`, version 1, contains exactly:

- `name`, `duration` (0.1–300 seconds), `nodes`, `tracks`, `prefabs`, `instances`.
- Each node: `id`, `name`, `parent`, `transform`, `components`, `visible`.
- Transform: `position` (XYZ, ±1,000 metres), `rotation` (unit XYZW quaternion),
  `scale` (positive XYZ, 0.01–100). Quaternion length tolerance is 1e−6; authored
  values are preserved and a temporary normalized copy is used for evaluation.
- Components: `mesh: {enabled}`, `appearance: {color, roughness}`,
  `camera: null | {fov, near, far}`, `light: null | {kind, color, intensity}`.
  Colours are RGB 0–1, roughness 0–1, intensity 0–4, FOV 0.2–2.2 radians;
  clip distances are 0.001–100 near and 0.01–10,000 far with far greater than near.
- Tracks: `{node, keys: [{time, transform}]}`; one track per expanded node,
  up to 32 strictly increasing keys. Before/after the keys, the endpoint is held.
- Prefabs: `{id, nodes, instances}`; instances: `{id, prefab, parent, transform}`.
  Source IDs match `[a-z][a-z0-9-]{0,31}`; expanded paths join instance IDs with `/`.

At most 128 expanded nodes, hierarchy depth 16, 16 prefab definitions, 32 nodes
per definition, 16 root instances, eight nested instances per definition and eight
prefab expansion levels. Every definition is checked, including unused ones.
Maximum project text is 256 KiB UTF-8. Exports use readable JSON when it fits and
compact JSON otherwise, so valid exports reimport within the same budget.

Unknown fields/versions, getters, executable properties, array subclasses, sparse
arrays, duplicate/missing references, invalid numeric values and excessive budgets
are rejected. Names are bounded literal text and are never inserted as HTML.

### Numerical boundary

Local matrices use translation × quaternion rotation × positive scale. Parent
and local affine matrices multiply without decomposing back into TRS: rotated
nonuniform scales can produce real shear, which the preview applies to **every
vertex**. This is stronger than summing Euler angles or multiplying scale vectors.

Positions/scales interpolate linearly; quaternions use the existing shortest-arc
normalized interpolation. This is not constant-angular-speed spherical interpolation.
Sampling depends on supplied time and data, never wall time or prior rendered frames.
It does not change authoritative simulation or extend integer/Q16.16 proofs.

World matrix/point coefficients must stay within ±10⁷; inverses reject determinant
magnitude below 10⁻¹⁰. Admission checks base/key endpoint poses. **Those checks are
not a proof of every continuous intermediate pose.** `sample()` also validates
its actual evaluated transforms and may reject an extreme intermediate result.
The accepted graph stays intact, and the preview stops with a recoverable message.
Use bounded authoring values and test the actual times your game consumes.

## Resource ownership and integration

The pure module owns only copied data. It has no DOM, GPU, clock, input, network,
audio or game-fiction dependency; its sole module dependency is `math`.

Workbench's `SceneCompositionPreview` is a small adapter over existing `WebGLAPI`
and box geometry. It owns one renderer/mesh, retains mesh storage between draws,
resizes only when necessary, validates `load()` before replacing the graph and
releases its renderer on idempotent `dispose()`. Drawing/loading after disposal
is rejected. Failed renderer creation cleans up the allocated renderer. The panel
owns animation callbacks/listeners and cancels them on pause/disposal; context
loss preserves authoring/export data and supports a subsequent restored preview.

A game or Narrative Foundry adapter chooses which declared events change an
accepted graph, then revalidates it. Imported scene data cannot select functions,
load modules, allocate arbitrary resources or execute event handlers. Games2
consumers must adopt an owner-reviewed immutable engine release separately.

## Verification

```sh
node --test tests/scene-graph.test.js tests/editor.test.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-check.js --suites=editor
```

Node coverage includes full affine/inverse roundtrips, quaternion/data stability,
legacy capture, metadata, bounded nested-prefab expansion, animation cadence,
intermediate rejection, import/export budgets, transactional replacement/history
and renderer ownership/disposal. The packaged browser scenario exercises real
Workbench controls, geometry, keyframes, camera/light, nested prefab rejection,
export/reimport, Play locks, inert names, 320 px and controlled offline startup.
Actual execution and device limits belong in the milestone's execution record;
a screenshot alone is not proof of transform or resource correctness.
