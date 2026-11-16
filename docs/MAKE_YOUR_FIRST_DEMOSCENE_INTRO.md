<!-- SPDX-License-Identifier: Apache-2.0 -->
# Make Your First Demoscene Intro

Open the [Visual Workbench](../demos/editor/index.html#visual-fx). The Demoscene /
Visual FX panel is in the same left sidebar as the hierarchy and Asset Foundry.

1. **Choose a cube.** Select an existing visible cube in the hierarchy, or Add a
   new object. Use a small object near `[0, 3, 0]`. Instantiated prefabs and attached
   OBJ meshes also work within the panel's published budgets.
2. **Choose a palette.** Change the selected object's colour in the inspector.
   Try mint against the dark scene, with a violet material for repetition. Keep
   enough luminance contrast for the object to read as a silhouette.
3. **Give it motion.** Open Demoscene / Visual FX, choose **rotate**, set Copies
   to 1 and **Add selected object / prefab**. At Time 0, capture the inspector
   transform. Move and scale it in the inspector, set Time to 12 and capture again.
   FX Undo restores a composition edit; scene Undo restores an inspector edit.
4. **Frame the camera.** Expand Camera, typography & music. At Time 0, enter
   Camera XYZ `0, 4, 30` and Target XYZ `0, 3, 0`, then Set camera key. Existing
   keys interpolate from there. A clear foreground and receding repeated shapes
   communicate depth better than increasing the object count.
5. **Write an original scroller.** Set the 3D title and uppercase scroller text,
   then Apply original text. The final act uses real block glyph geometry.
6. **Vary a musical phrase.** Select phrase 2, choose One octave up for its
   arpeggio, then Apply phrase variation. The original full-minute score remains
   editable inert data; integer frequency limits still apply.
7. **Synchronise an effect.** Choose **radial**, set Copies to 8, then Apply
   effect & copies. Select Percussion as the cue lane and Sync effects. This is
   the same radial pulse component used around the production's cathedral core.
8. **Preview the result.** Set Time to 42 and Preview at time. Preview with sound
   enables the real audio transport from a gesture. Pause stops the old source.
   Flat lighting, strong silhouettes, restrained colours and camera framing are
   useful design tools; add complexity only when it helps the composition.
9. **Round-trip the composition.** Export validated composition. Import it back
   into the panel, then into the [Demoscene Lab](../demos/demoscene-lab/index.html).
   Geometry, source licences, effects, keys, music and text travel together. Save
   the ordinary scene/asset project separately. FX sidecars are not scene autosave.
10. **Reuse it in your own project.** Import the pure `validateDemo`,
    `compositionCommands` and `DemoGeometry` functions from `api/demoscene/index.js`.
    Evaluate at your chosen sample and upload the resulting native vertex streams
    to the existing renderer. For a title sequence, use the optional original
    [intro adapter](../demos/demoscene-lab/intro.js) and supply your own completion
    callback and menu. Respect OWNER-LOCAL-ONLY and third-party source declarations
    before distributing the composition.

The panel supports flat colours, not textured FX meshes. Clear a texture attachment
before capture. Large scenes fail visibly instead of exporting incomplete art.
New modules remain experimental; pin a reviewed engine commit in a consuming game.
