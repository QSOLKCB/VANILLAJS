# HORIZON — Coastline Atelier

[Open HORIZON Lab](../demos/horizon-lab/index.html) through local HTTP or the
packaged site. This is **HORIZON-001**, the first of three reviewed parts of the
planned v2.9.0 milestone. It authors a real lit 3D scene and an original vehicle
visual rig. It does not yet simulate driving or provide a completed racing game.

## Make your first scene

1. Start with the original **Aster Coast** study. The hero camera shows the
   detailed procedural vehicle on the actual raised road. Drag the scene or
   focus it and use the arrow keys to orbit; plus/minus changes distance.
2. At the Director's desk, choose a road point. Change its **Road elevation**
   or **Corner bank**, then press **Apply to the scene**. These values change
   the generated road triangles and their contact-query surface together.
3. Choose an environment and terrain seed. Coast, Alpine and Dusk use original
   procedural scenery and different lighting palettes. No remote art is loaded.
4. Move the sun, change fog, and compare rough versus polished body finishes.
   Light and material edits keep the existing GPU geometry. Roughness is a
   documented approximation; glass uses reflected sky color and transparency,
   without full optical refraction or physically based ray tracing.
5. Choose the original sports, touring or utility class. Change paint, wheel
   steering, wheel rotation, suspension compression, body pitch/roll or brake
   lights. Those controls operate a visual rig with retained local mesh parts.
   They do not feed forces or movement back into simulation.
6. Inspect **Hero**, **Overlook**, **Road** and **Bonnet** cameras. The optional
   camera tour rotates a viewpoint using the existing fixed clock. It is clearly
   labeled as a camera tour, not automatic driving. Escape, Pause, focus loss
   and editing stop it. A still frame schedules no continuous render loop.
7. Use Undo/Redo to compare accepted changes. **Export study** downloads the
   accepted data; import it again to continue editing.

The selected road point changes only that knot. The scene's pure surface module
samples the same triangulated road that is rendered. A bridge is a separate
raised road surface over terrain; a tunnel roof is scenery, not a second terrain
height. Contact queries must explicitly choose the relevant road surface rather
than assume a single heightfield can describe stacked surfaces.

## What the data contains

`qsol.vanillajs.horizon-lab.v1` is a small lab-owned envelope containing:

- Study name and validated `scenic3d` environment/road recipe.
- Original vehicle class, paint, roughness/metalness and supplied visual rig pose.
- Sun direction controls and distance-fog density.

It is bounded to **32 KiB** and version 1. Unknown fields, executable fields,
unsupported classes, invalid numbers, unsafe object shapes and malformed road
recipes are rejected before replacement. Imported names remain literal text.
The complete JSON view exposes the accepted record; it never evaluates code.
An older asynchronous file read cannot replace a newer accepted edit.

The UI's compression control edits all four wheels together. Imported recipes
may retain different per-wheel compression values; unrelated edits preserve
those exact values. The checkbox can select brake lights on/off, while a supplied
fractional brake intensity is preserved until that control changes. Unchanged
angle/color controls retain accepted source values without unnecessary conversion
or geometry rebuilding.

Undo/Redo keeps up to 24 accepted records in local memory. It is not durable
storage. Export before closing the page. **Original study** restores the provided
original recipe. **Reset view** changes only the camera.

## Rendering, resources and limits

The [optional lit renderer](RENDER_LIT_API.md) owns the WebGL programs and meshes.
The [pure scenery/vehicle API](SCENIC3D_API.md) generates original geometry and
strictly admitted data. The lab owns camera interaction, history, DOM and clocks.
Existing `render-webgl`, Racing Lab behavior and `qsol.vanillajs.track.v1` remain
unchanged. HORIZON data is a separate format, not a silent track migration.

Both profiles use native WebGL1. Low reduces pixel resolution, decorative scenery and wheel detail; High supplies
more decorative detail. Both retain the same road and terrain contact triangles. Their explicit limits
are in the renderer reference. The diagnostics show current retained vertices,
mesh draw calls, GPU mesh uploads and rendered frames. One additional draw paints
the procedural sky. Counts are actual local diagnostics, not an FPS benchmark
or a promise about physical hardware.

Camera tours, lighting, fog, roughness and visual rig changes reuse the existing
static buffers. Paint/class changes replace vehicle meshes; road/terrain edits
replace the affected scenery. Profile changes rebuild the owned renderer and its
resources. Candidate allocations complete before accepted data replacement;
failed imports or allocations retain the last accepted study. The contact shadow
is a bounded soft patch on the sampled road, not a scene-wide shadow-map system.

Native WebGL context loss pauses the view. Restoration recreates the renderer
and meshes from accepted data without restarting the tour. If graphics cannot
start, the authoring controls and data export remain available. Back/forward
cache restoration recreates disposed resources; a full page reload still needs
a saved data file to restore personal changes.

## Keep it local and reusable

Serve the repository with a standard-library HTTP server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `/demos/horizon-lab/index.html`. Native modules need HTTP(S), so a double-click
on the HTML file is not equivalent. The packaged site also works at `/VANILLAJS/`.
After its integrity-verified worker installs on HTTPS or loopback, a subsequent
visit can author and export with networking disabled. A fresh browser still needs
the first successful served visit.

Export contains **inert scene settings**, not a complete game, JavaScript, engine
sources or a runnable standalone bundle. A consumer imports the public scenery
and renderer modules from an immutable reviewed engine release, preserves its
Apache-2.0 licence/notices and supplies its own application/ownership lifecycle.
HORIZON-002 adds vehicle simulation in a later PR; HORIZON-003 adds the complete
Racing Creator Tools and playable polished showcase. Games2 adoption is separate.

[Creator Hub](../demos/creator-hub/index.html) ·
[Existing Track Foundry](RACING_002B.md) ·
[Engine programme](ENGINE_EXPANSION_001.md)
