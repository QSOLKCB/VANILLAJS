# CPU-first graphics, GPU/WASM Lab and Space Game Lab

Experimental native browser APIs; no runtime packages, CDN, downloaded models,
external textures, or automatic acceleration. Existing WebGL APIs remain available.

## Try the labs

Build with `node scripts/build.js`, then serve `dist/` over HTTP (for example,
`python3 -m http.server 8080 --directory dist`). Open:

- `http://localhost:8080/demos/gpu-lab/index.html`: procedural planet/station,
  bounded star population, CPU submission timing, explicit JS/WASM parity check,
  CPU/GPU switching and simulated device loss.
- `http://localhost:8080/demos/space-lab/index.html`: inertial flight, docking,
  broadside target practice and Newtonian central-mass orbit.

Both start with Canvas 2D. Detection requests an adapter, **not a device**.
Only a non-fallback adapter and WebAssembly expose the acceleration button.
Every activation requests a **fresh adapter**. Click **Enable WebGPU + WASM**
for that session; consent is never stored. Unsupported browsers remain on CPU.
WebGPU requires localhost or HTTPS. CSP must allow WebAssembly compilation if
acceleration is offered; compilation failures return to CPU.

GPU Lab's parity button compiles the bundled WASM without enabling WebGPU. It
compares clip-space projection with an explicit Float32 JavaScript reference.
The loss button destroys only this lab's device, allowing recovery testing.
Reloading starts again in CPU mode.

Space controls: W/S thrust, A/D yaw, R/F rise/descend, X brake, E dock, Space
fire both broadsides. Select docking, approach the origin within 2.5 m, and brake
below 1.25 m/s before pressing E. Broadside target is the small sphere at
(12, 0, 8) m. Shots use swept sphere hits, finite lifetime, cooldown and a bounded
pool. Orbit uses the engine's SI velocity-Verlet solver with a fixed central
mass. It is not relativistic or a multi-body gravity model. Focus loss clears
input and pauses; click Resume and press fresh keys. Reset clears the selected
mechanic. Simulation always steps at 60 Hz with bounded catch-up, independently
of the renderer. These are test recipes, not new gameplay modes in another game.

## Add the option to an editor game

1. Open `demos/editor/index.html`; author or import the scene and local assets.
2. Check **Add CPU + optional GPU/WASM to game**. The editor preview switches to
   CPU; its separate GPU button lets you test explicit acceleration.
3. **Export project** saves the setting in the v2 asset-project envelope. Legacy
   v1 projects still load. Scene-only JSON deliberately contains no graphics policy.
4. **Export playable HTML** creates `game.html`. Put it alongside `modules/` and
   `demos/` in the built `dist/` directory; serve the directory over HTTP/HTTPS.
   The generated player includes the scene, assets and provenance. It references
   packaged engine files locally, so it is not a single-file engine bundle.
5. The player always starts on CPU. With the option checked, players may choose
   GPU/WASM on compatible devices. With it unchecked, the export is CPU-only.
   Editor device selection never grants player consent.

The exported player runs the existing fixed-step Component Forge preview
mechanics. It is a playable starting scene, not a complete custom game generator.
Assets retain their declared rights; export does not change their license.

## Reusable renderer API

```js
import {OptionalRenderer, detectGPU} from './modules/render-optional/index.js';
const renderer = new OptionalRenderer(canvas, {onMode: mode => console.log(mode)});
const mesh = renderer.createMesh([
  -1,-1,0, 1,0,0, 1,-1,0, 1,0,0, 0,1,0, 1,0,0
], 'triangles');
// Detection alone never enables acceleration.
button.disabled = !(await detectGPU());
button.onclick = async () => { try { await renderer.enableGPU(); } catch { /* CPU remains */ } };
function draw(vp) {
  renderer.beginFrame({vp, fog: 0});
  renderer.draw(mesh);
  renderer.endFrame(); // mandatory: submits the complete GPU frame
}
```

Canvas must be inside a positioned wrapper; the optional GPU canvas overlays
it with pointer events disabled. Call `useCPU()` to cancel pending activation or
release a live device; call `dispose()` when leaving the scene. `deleteMesh()`
releases retained storage. `updateMesh()` copies caller vertices and skips
identical Float32 bytes; never mutate renderer internals. `stats()` reports
mode, frame/draw counts and no-op updates. CPU `uploadedBytes` is zero; use the
lab's CPU submission timing for observations, not GPU-completed frame timing.

XYZ/RGB streams support whole triangles, lines or points. Matrices are column
major OpenGL clip matrices, +Y up and -Z forward. GPU maps clip Z into WebGPU's
0..1 interval. WASM projects with explicit f32 operations; simulation stays JS.
`beginFrame`/`draw`/`endFrame` is an explicit protocol. Bad matrices, nonfinite
vertices, foreign handles and incomplete primitives are rejected. Allocation
and runtime GPU errors, loss and WASM compilation failures recover to CPU.
A device loss during setup is rejected before promotion.

## Budgets and approximation limits

- At most 128 retained meshes, each at most 65,536 vertices; applications should
  choose a much smaller CPU scene. The labs use 256–2,048 stars (512 default),
  cached static meshes, a 960×540 canvas and a 20-segment planet.
- WASM memory is fixed at 16 MiB; matrix/input/output regions do not overlap at
  the public vertex limit. No memory growth or per-frame WASM instance creation.
- GPU keeps one buffer per mesh, grows only when required, and releases buffers,
  depth textures and the device on disposal. Projection/upload reuse requires
  identical owned vertex revision, matrix bytes and fog. Resize recreates depth.
- CPU clips all six homogeneous planes, including near-camera planetary
  triangles, then painter-sorts primitives. It has no per-pixel depth buffer and
  uses flat primitive colour; intersecting geometry can differ from GPU depth
  and interpolation. No CPU/GPU pixel-equivalence claim is made.
- This initial module supports opaque geometry, not textures or additive glows.
  It does not silently claim the OFFLINE-GAMES glow compositor as a supported API.

## Optimization contract and provenance

P = (X,F,f,d,C,B,S): X is retained versus repeated preparation and source-bound
witness reuse; F preserves fixed simulation and explicit opt-in/fallback;
f is repeated projection/upload/browser work, minimized; C is complete input
identity, Float32 projection parity, validated main-only receipts and no false
PASS; B is the mesh/WASM/lab budgets above and three qualifying main executions;
S is passing parity/failure controls and the declared local/browser checks.
Runtime timing is noisy; cache identity and work counts are deterministic.
No general GPU speedup or mathematical proof follows from three test passes.

- OPT `7556dd36acd53ed3ed538fd03b1db44e5c1ec869`: OPT-INV-001 and
  OPT-INC-001 guide complete-key reuse and success-only receipt publication.
  No GPL Wonderbuild source is copied.
- GALAXY `f219bb427b3a9b0c93900169d903f48f410ae67a`: bounded resident population
  and spiral presentation are design references. The lab independently uses
  VANILLAJS `logical-sampling`; no MPL GALAXY implementation is copied and
  16,777,216 logical stars are **not** 16,777,216 simulated/rendered bodies.
- ALIEN-MATH-001/002/003 already on main: exact decimal authoring, explicit
  nearest-even Q16 conversion and exact approach-triangle validation run at
  initialization. Hot ticks consume prepared SI Numbers, avoiding BigInt work
  in rendering. This does not change the exact math modules' contracts.
- WASM projection derives from Apache-2.0 QSOLKCB/OFFLINE-GAMES, commit
  `ec11d845f6bf284619e2f46e768ebfb326f3be3c`. Reproduce the 308-byte module with
  `NODE_PATH=/path/to/tooling/node_modules node scripts/build-optional-wasm.mjs`
  using wabt 1.0.39. `--write` regenerates the inline byte module. No runtime fetch.

## Test and diagnose

Run `node --test tests/*.test.js`, `node scripts/check.js`,
`node scripts/build.js`, and `node scripts/verify-offline.js`.
With existing external Playwright tooling on NODE_PATH, run
`node scripts/browser-check.js` for all packaged suites. The donor suite now
includes CPU labs, visible pixels, JS/WASM parity, broadside hits, blur pause,
editor option and HTML export. Hosted CI does not assume a physical GPU.

For an explicitly authorized local physical GPU check:
`NODE_PATH=/path/to/tooling/node_modules node scripts/optional-gpu-local.mjs`.
This opens headed Chromium, rejects fallback adapters through the production
path, reads actual submitted GPU pixels, cycles modes, injects device loss and
WASM failure, retries and resizes. It never dispatches PR code on a personal
GitHub runner. Other GPUs and browsers remain unverified until tested there.

## Large scenes and keyboard focus

The editor preview and exported player share whole-triangle batching: at most
65,535 vertices per scene mesh (the largest multiple of three below the renderer
limit). The existing 2 MiB scene budget remains supported; 66,048 vertices use
two retained meshes of 65,535 and 513 vertices. Updates reuse existing handles
and release surplus batches when geometry shrinks.

Resume restores focus to the playable canvas. CPU/GPU buttons also return focus
to the view when clicked, including during asynchronous GPU activation. They do
not automatically resume a paused simulation. Editable fields still suppress
gameplay keys, and held keys still require release/repress after pause.
