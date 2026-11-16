# Lit rendering API — HORIZON-001

[`modules/render-lit/index.js`](../modules/render-lit/index.js) is an optional,
explicitly owned native **WebGL1** material path. Existing `Renderer` and `WebGLAPI`
callers, shaders, vertex layouts and defaults are unchanged. The new renderer
uses existing `math` camera/projection operations; there is no third-party engine,
WebGL2 requirement, global frame loop or network resource loader.

Open [HORIZON Lab](../demos/horizon-lab/index.html) to inspect the actual consumer.
Geometry, environment recipes and vehicle presentation belong to the separate
[scenic3d contract](SCENIC3D_API.md). Neither renderer nor visual vehicle pose
advances racing simulation.

## Owned surface and retained meshes

```js
import {LitRenderer} from './modules/render-lit/index.js';

const renderer = new LitRenderer(canvas, {profile: 'high', pixelRatio: 1});
const mesh = renderer.mesh(triangleVertices);
renderer.begin([0, 1.5, 7], [0, 0, 0, 1], {
  sunDirection: [0.4, 0.8, 0.25], ambient: 0.32, fogDensity: 0.003
});
renderer.draw(mesh, {
  material: {color: [0.15, 0.55, 0.65], roughness: 0.2, metalness: 0.6}
});
// On removal: renderer.deleteMesh(mesh).
// When this surface leaves the application: renderer.dispose().
```

The caller supplies an HTML canvas and owns its placement, animation scheduling,
input and authoritative state. The renderer owns two shader programs, one small
sky buffer, its admitted mesh copies/GPU buffers and a context-loss listener.
Do not use another renderer on the same active context. `gl` is exposed for
inspection, not a promise to preserve unrelated external WebGL state.

| Method | Contract |
| --- | --- |
| `new LitRenderer(canvas, {profile = 'high', pixelRatio = 1})` | Request native `webgl`, antialiasing and opaque output. Unknown options/profile reject. Pixel ratio is explicit, 0.5–2. |
| `mesh(vertices)` | Admit and copy whole triangles, allocate an owned opaque handle. An empty mesh is permitted. |
| `update(handle, vertices)` | Validate first. Identical admitted Float32 components skip upload and return `false`. A change allocates a replacement GPU buffer before releasing the old one; failure preserves the accepted mesh. Return `true` on replacement. |
| `deleteMesh(handle)` | Release the admitted CPU/GPU mesh. Foreign/deleted handles reject. |
| `begin(position, orientation, settings = {})` | Validate camera/settings before changing frame state. Resize within profile budgets, clear depth, draw original atmospheric sky and set lighting. |
| `draw(handle, {matrix, material} = {})` | Draw retained triangles. Matrix defaults to identity; material defaults below. No geometry reupload is needed for camera, transform or material changes. |
| `stats()` | Frozen diagnostics: `profile`, `meshes`, `vertices`, `bytes`, `frames`, `frameDraws`, `totalDraws`, `uploads`, `skippedIdentical`, `lost`, `disposed`. |
| `lost` | True after context loss; restoration requires the owner to create a new renderer. |
| `dispose()` | Idempotently release this renderer's resources/listener and invalidate its handles. Never removes the caller's canvas. |

Mesh `vertices` are an ordinary dense array or ordinary `Float32Array` with
**11 components per vertex**: position XYZ, normal XYZ, RGB and UV. Three vertices
make a triangle. Positions/UV values are finite within ±10,000; RGB is 0–1;
normal length is 0.5–1.5 before shader normalization. Reject holes, accessors,
extra properties, non-finite components and budgets before GPU allocation.
Coordinates are right-handed, +Y up and −Z forward. Positions are metres;
UVs are dimensionless. There is no implicit index buffer or texture URL.

Draw matrices are finite column-major affine 4×4 arrays, `Float32Array` or
`Float64Array`. Components are bounded to ±10,000, the bottom row is `[0,0,0,1]`,
and the 3×3 determinant magnitude must exceed `1e-10`. The inverse-transpose normal
matrix is checked within ±100,000. Nonuniform scale and shear use that transform;
normals are normalized before interpolation and again per fragment.
`litNormalMatrix(matrix)` exposes the same calculation for independent tests.

## Materials and atmosphere

`validateLitMaterial(record)` creates a frozen, owned material with only the
following optional fields. Unknown/accessor fields and unsupported types reject.
A renderer material is an API argument, not a new Workbench project format.

| Field | Default | Admitted range |
| --- | --- | --- |
| `color` | `[1,1,1]` | Three channels, 0–1, multiplied by vertex RGB |
| `roughness` | `0.7` | 0.04–1 |
| `metalness` | `0` | 0–1 |
| `opacity` | `1` | 0–1 |
| `emission` | `0` | Scalar 0–4, additive colored presentation |
| `pattern` | `'none'` | `none`, `asphalt`, `stone`, `grass`, `glass`, `shadow` |
| `patternScale` | `1` | 0.01–256 |

Procedural UV textures are original bounded shader functions: granular asphalt,
mortared stone and grass color variation. They use no external images, texture
allocation or downloaded assets. The high profile adds fine asphalt variation;
the low profile keeps a simpler sample. Shader arithmetic is visual Float32/
implementation precision, **not exact source-pixel generation or numerical proof**.

Directional diffuse light and a roughness-controlled Blinn-style highlight sit
beside ambient illumination and a simple Fresnel/environment tint. Metalness
adjusts highlight/base contribution. This is a documented approximate material
model, **not physically based energy-conserving rendering**. Glass blends a tinted
surface with reflected sky and alpha; it does not implement refraction, scene
reflections or optical ray tracing. The sky is a camera-oriented gradient with
an original analytic sun/haze. Distance fog uses an exponential view-distance
factor. Exposure is a bounded visual multiplier.

`begin` accepts only these optional settings:

| Setting | Default | Bound |
| --- | --- | --- |
| `fov` | `1` | Vertical radians 0.2–2.5 |
| `near`, `far` | `0.1`, `2000` | Near 0.01–100, far 1–5000, far > near |
| `ambient` | `0.32` | 0–2 |
| `sunDirection` | `[0.4,0.8,0.25]` | Each component −1–1, nonzero vector; normalized toward light |
| `sunColor` | `[1,0.92,0.78]` | Each channel 0–2 |
| `skyTop`, `skyBottom` | `[0.12,0.32,0.52]`, `[0.68,0.79,0.79]` | Each channel 0–1 |
| `fogColor` | `[0.66,0.75,0.76]` | Each channel 0–1 |
| `fogDensity` | `0.003` | 0–0.1 per metre |
| `exposure` | `1` | 0.1–3 |

Camera position is a three-element array within ±10,000 metres. Orientation is
an XYZW quaternion with unit magnitude within `1e-5`; it is not silently normalized.
Camera/material settings never change canonical simulation state.

## Transparency and contact shadows

Draw opaque batches first. Draw transparent surfaces **back to front** using
an ordering chosen by the owner. Opacity below 1, `glass` and `shadow` enable
standard alpha blending and disable depth writes for that draw. Depth testing
remains active. There is no order-independent transparency guarantee. Batches
that intersect or contain multiple transparent depths may require finer sorting.

A `shadow` material uses radial UV falloff centered on `(0.5, 0.5)`. It darkens
an actual supplied receiver patch; the renderer does not guess a flat ground plane
or cast a ray. The HORIZON geometry consumer samples the same road triangles as
rendering to position its bounded contact patch with a small explicit surface
bias. This is a local contact-shadow approximation, not sun shadow mapping,
self-shadowing or a multi-receiver shadow solver.

## Budgets and failure lifecycle

| Profile | Resolution scale | Maximum surface pixels | Total mesh vertices | Meshes / draws per frame |
| --- | --- | --- | --- | --- |
| `low` | 0.7 | 1,048,576 | 180,000 | 128 / 128 |
| `high` | 1 | 2,073,600 | 600,000 | 256 / 256 |

These are allocation/admission budgets, not frame-rate claims. Profile is chosen
when creating the renderer. Canvas CSS dimensions are bounded to 10,000 per axis;
profile scale and explicit pixel ratio are applied, then the area is clamped to
the maximum pixel budget. The aspect ratio is retained within integer rounding.
Mesh draw counts exclude the single sky triangle. `bytes` reports owned mesh
storage, excluding that constant 24-byte sky buffer and shader-driver storage.
CPU snapshots and GPU storage each require at most 44 bytes per admitted vertex;
transactional replacement temporarily holds old and new allocations.

Shader/program/buffer allocation failures clean partial construction. Rejected
mesh updates preserve accepted handles/counts/data. A lost native context prevents
new begin/draw/update/mesh calls. The listener prevents the browser's default
permanent-loss behavior, but **the renderer never schedules its own restoration**.
After the browser emits `webglcontextrestored`, the owner disposes the old renderer,
creates a new one and reuploads accepted source geometry. Context loss already
releases native GPU objects; disposing the lost instance does not issue invalid
native deletes after restoration. All old handles are foreign to the new instance.

## Verification boundaries

`tests/render-lit.test.js` checks strict data admission, independent inverse-
transpose perpendicularity, resource-budget preflight, transactional failure,
retained ownership and cleanup/lifecycle. `scripts/browser-render-lit.js` checks
actual native WebGL1 pixels for lighting, roughness, procedural patterns, glass,
fog and contact shadow; identical rendering without reupload; rejected mesh parity;
low profile pixel bounds; and real `WEBGL_lose_context` loss/recreation.

Exact scene/physics reference cases remain independent of GPU pixels. No universal
cross-browser raster identity, physical GPU speed, mobile device support or
Firefox/Safari execution is inferred from Chromium software rendering.
