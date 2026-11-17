# HORIZON-007 — Checkpoint crossbar camera occlusion

Owner screenshots show a large dark-green/black crossbar apparently blocking
the player's view of the road. The car is at rest near the first gate, the
progress indicator has advanced and an amber gate is visible ahead.

## Root cause

`RaceView.draw()` rendered all eight visual checkpoint meshes on every
frame. Completed gates turned dark green but remained behind the player.
The chase camera's elevated viewpoint can intersect an overhead crossbar
after the car has passed it; this can fill most of the foreground.

The first Cape Aster gate is approximately 72.7 m along the road, the
second approximately 133.3 m. Their decorative geometry is not registered
as a physical `vehicle3d` barrier. The screenshots therefore support a
**visual occlusion bug**, not a proven solid invisible wall. Unrelated
vehicle-collision and suspension behaviour is outside this fix.

## Fix

- Retain all gate meshes and their source/provenance identity, but only
  draw indices from the next unfinished gate onward.
- Report the presentation-only `visibleGates` count in `RaceView.snapshot()`.
- First crossing hides only the completed gate; after the finish, all
  decorative gates are hidden. Restart or replay makes them visible again,
  without GPU reuploads.
- Preserve physical checkpoint crossing, recovery, car-to-car contact,
  bridge barrier selection, Course Assist, offline packaging, project
  schemas and all reviewed historical CI/source-integrity gates.

## Regression evidence policy

Renderer-spy regression verifies gate draw calls for zero, one and all
completed checkpoints with retained mesh resources and no reuploads.
The existing full-course packaged Chromium test asserts that rendered
gate counts agree with accepted checkpoint progress throughout the race.

Only executed hosted CI may assert complete Node/browser/packaging
verification. No physical GPU/mobile claims or automatic merge/release.
