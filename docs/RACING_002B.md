# RACING-002B — Track Foundry

**Status:** Experimental creator tool in the Racing Lab, with original
browser-native Canvas/WebGL geometry, no server and no runtime dependencies.

## Player and creator workflow

1. Open `demos/racing-lab/index.html` on a served origin and scroll to
   **Track Foundry**.
2. Give the road a name, select an environment and adjust the four section
   curves, half-widths and fork separations.
3. Choose **Scenic Tour**, **Coastal Sprint**, or **Circuit Race**.
   For circuits, drag the eight numbered gate markers or edit X/Z coordinates.
4. **Validate & Drive** creates a fresh game world with an independently owned
   validated snapshot. Rejected inputs do not replace the active game.
5. **Export JSON** / **Import JSON** exchange the inert track data. The
   imported file is reviewed in the editor before use. New field edits and
   gate drags invalidate pending asynchronous file reads. Focusing an editor
   field pauses the race and releases held driving input. **Built-in tracks**
   restores the previous RACING-001/002 behaviour.

There is no user-supplied JavaScript execution, cloud API, CDN, npm runtime
dependency or imported copyrighted game asset.

## Track pack schema

The format identifier is `qsol.vanillajs.track.v1` and the object must have
**exactly** `format, version, name, environment, sections, gates`.
Its version is exactly 1.

- Name: 1–48 characters; ASCII alphanumeric, spaces, dot, underscore, hyphen.
- Environment: exactly `coast`, `canyon`, `forest` or `night`.
- Four ordered **1,200 m** sections, each with exactly
  `curve [-1,1]`, `width [8,16]` metres (half-width) and
  `fork [6,14]` metres of lateral branch separation.
- Eight circuit gates, each with exactly finite `x,z` in [-70,70]
  metres. Every pair of gate centres must be ≥24 m apart, preventing
  stationary capture of two 12 m-radius checkpoints. Non-adjacent edges
  must not intersect, touch or collinearly overlap.
- Maximum UTF-8 import: **16 KiB**. Unknown keys, version/format errors,
  accessor-backed records or arrays, sparse/overridden arrays, non-finite
  values, invalid geometry, unsupported enums and unexpected prototypes
  are rejected without evaluating hostile getters.

The engine creates new, frozen records/arrays after validation. Pack objects
are not retained by reference from callers.

## Physical geometry and invariant rules

- The authored Scenic Tour centreline integrates each section's curvature.
  A left/right decision made at the next 1,200 m boundary adds a smooth
  diverging lateral offset across the start of the following section.
  The eight possible three-fork histories **really do follow different
  world-space centrelines**, rather than palette-only changes.
- The roadway itself remains finite and continuous at all section seams;
  rendered paths and the road-edge checks sample the same centreline and
  half-width. No instantaneous lateral teleport is applied to the player.
- Authored Coastal Sprint is **4,800 m**, distinct from the original
  RACING-002A 3,600 m default. Geometry, progress markers and finish gate
  follow the authored distance. A forward finish crossing outside the
  paved corridor is not a victory.
- Circuit racing uses the authored polygon for both the asphalt and the
  authoritative eight ordered gate targets. The collision boundary expands
  to surround any admitted geometry beyond the default ±63 m arena.
- The editor's fork indicator and the simulation both call the same
  `chooseTourFork` helper against the upcoming section centreline.
- Four scenery palettes alter presentation only. They do not alter vehicle
  acceleration or save schemas. Existing five RACING-001 modes and
  unmodified RACING-002A default tracks keep their original contracts.

## Verification and release boundary

```sh
node --test tests/track-foundry.test.js tests/racing-lab.test.js tests/voidward-browser-waits.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
```

The hosted Racing Lab workflow additionally exercises author/edit/export/
invalid-import/restore/apply in Chromium on the staged offline package. The
comprehensive Flight Lab browser suite must also pass, including VOIDWARD
reload and migrated-save checks. Hardware GPU performance, subjective human
playtests, cross-browser bit-exact Float64 and formal proof are **not** claimed.

The Track Foundry is an experimental game-owned authoring interface. This is
not yet a stable standalone public Mod SDK schema, and imported packs are not
directly interchangeable with DRONE-RACER's exact Q16.16 circuit format.

## Next phases

- Handling profiles for original vehicles and grades; independent race witnesses.
- Swept vehicle/rail contact response and stable overlap resolution.
- Four-wheel suspension and banking for Skyline Stunt.
- Formal numerical comparison with the separate Q16.16 arithmetic backend.
- More expressive track topologies, scenery, materials and audio with explicit
  resource budgets and offline provenance.
