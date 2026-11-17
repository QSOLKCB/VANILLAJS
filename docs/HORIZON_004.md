# HORIZON-004 — visual fidelity and driving polish

This is the final v2.9.0 pre-release quality gate after merged HORIZON-001/002/003.
The audited base is `f263d43627970d8c3cfb2d54eed8fdeed2e7c457` (reviewed main).
The published release remains v2.8.0. Owner review, merge, deployed-main testing
and explicit release approval are required before any v2.9.0 tag.

## Creator workflow

Open the [Racing Foundry](../demos/horizon-lab/index.html), start the race and use
W/Up to accelerate. S/Down brakes forward motion, then requests reverse below
0.5 m/s total speed. Hold it to drive backwards. W/Up brakes reverse motion
before requesting forward drive. Both transitions respect native shift delay.
Space is an independent brake; conflicting direction buttons brake safely.
Touch exposes left, right, brake/reverse, brake and forward. The R indicator,
RPM bar, wheel motion and audio use actual vehicle telemetry. Pause, blur,
hidden tabs and lost driving focus clear requests; resume needs a fresh press.
Recovery and restart restore forward gear. Backwards crossings earn no gates.

Use the [Scenery Atelier](HORIZON_LAB.md) for appearance, and the
[Vehicle Dynamics Workshop](HORIZON_DRIVING.md) for numerical studies. The latter
retains its existing explicit gear selection. [Race authoring/export](HORIZON_RACING.md)
includes the improved visuals and directional controls in the supported ZIP.

## Compatibility boundaries

- `scenic3d` supplies more detailed original geometry with the same API, fixed
  vehicle dimensions, wheel locations and 13 retained parts. Smooth
  visual normals are an intentional extension; planar contact normals remain
  exact. Original source vertex arrays change, so pin a reviewed release for
  reproducible geometry. No authored world moves into the core.
- `render-lit` retains its WebGL1 interface and resource ownership. Continuous
  procedural shading and analytic sky/ground reflections are approximate,
  not physically based reflection, real-time scene reflection or refraction.
- Road render positions and authoritative road triangles remain identical.
  Low/high share exact road and terrain contacts. Extra shoulder/vegetation/
  bridge/tunnel decoration does not become collision geometry.
- `vehicle3d`, race progression and rival solver are unchanged. Reverse is a
  lab-owned input adapter using native gear requests, reverse ratio and torque.
  Camera damping, checkpoint appearance and HUD never modify simulation state.
- Existing scenery, vehicle and `qsol.vanillajs.track.v1` formats are unchanged.
  No package/module metadata migration, Games2 changes or new runtime dependency.
- Large-scene edits preflight temporary mesh storage. If accepted and incoming
  meshes together exceed one renderer’s budget, all three HORIZON views stage
  a separately owned renderer and dispose the old one only after success.
  Ordinary edits retain unchanged meshes; failed uploads keep accepted resources.
- Eight gate meshes bake the existing three structural transforms per gate,
  with static decorative bands/chevrons. This reduces gate draws from 24 to 8
  while preserving independently tested structural world-space positions.

## Evidence and release review

Matching captures use the untouched base package and the candidate package,
1440×1100 viewport, identical recipe/seed, profile and camera pose/FOV. Real
keyboard input produces the at-speed views; the harness never sets vehicle
state. The comparison pins camera pose only, so presentation changes can be
assessed separately. Capture output refuses to overwrite existing evidence.

Reproduce with the existing externally provisioned Playwright/Chromium:

```sh
node scripts/capture-horizon-polish.mjs --dist=/path/to/baseline/dist --out=/new/before
node scripts/capture-horizon-polish.mjs --dist=/path/to/candidate/dist --out=/new/after --reference=/new/before/capture.json
```

Chromium uses SwiftShader here. Timing samples include submission and a
synchronous one-pixel readback after two warmups, twelve samples per view.
They describe this software-rendered observation, not physical GPU FPS.
Screenshots supplement numerical, interaction, offline and package tests.
[Execution results, matched images and measurements](evidence/horizon-004/README.md)
record the exact clean implementation source and package identities.
The initial visual pass was rejected after screenshots exposed bonnet ridges
and flat terrain lighting. Bounded longitudinal interpolation, fender-only arch
lift and shared visual normals corrected those issues; contact geometry stayed
unchanged. Excess tessellation and hidden branch caps were then reduced.

The shader audit isolated scalar procedural-noise work as a cost. The final
implementation reuses four coordinate components in a vector calculation. Native
Chromium compares complete pixel buffers against the original scalar expression
over positive/negative UVs in both profiles, with a wrong-corner negative control.
This reuse preserves observed pixels; reducing geometric tessellation is a
separate visual-quality choice and is not claimed to be pixel-identical.

The reviewed Flight Lab timeout remains 35 minutes. Every browser/Node/package
and source-authentication gate remains enabled. Changed runtime hashes force
real execution under the existing source-bound cache policy. No old PASS receipt
is rewritten or claimed for the new source.

## Remaining limits

Near fascia/lamps remain stylized, close tree crowns visibly polygonal and
glass simplified without a detailed cabin. This remains bounded procedural
artwork with approximate materials, no imported
car models, interior simulation, dynamic scene reflections or cinematic shadows.
Decorative scenery is not a new collision system. Device-specific image and
performance identity is not promised. A future Games2 adoption requires its own
reviewed immutable engine pin, provenance, tests and packaging PR.

[Draft v2.9.0 release notes](HORIZON_2_9_0_DRAFT.md).
