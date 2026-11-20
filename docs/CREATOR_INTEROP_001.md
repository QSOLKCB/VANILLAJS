# CREATOR-INTEROP-001 — Original Content Pipelines (P5)

**Status:** experimental source implementation for review, not an accepted stable interchange standard. Original Apache-2.0 code; source baseline `3c77c0a3da5b62a41eba69ee71da5ebeb40127f1`. No cloud, remote fetches, executable imports, third-party assets or runtime package dependency.

## Data contracts
- `qsol.vanillajs.creator-world.v1`: exact inert project fields `format,version,name,scene,assets,placements,zones,tactical`. Existing `validateSceneGraph` validates the scene rather than introducing a shadow scene implementation. Experimental scene-graph format and transforms are not silently migrated.
- `creatorCADAsset({id,kind,options})` consumes a real CAD-001 lathe or CAD-003 Geometry Forge preset through the existing `cad-geometry` authority. It welds identical XYZ vertices and emits an inert indexed asset, rejecting models outside the creator budget; it never copies executable CAD callbacks, introduces a new triangulator or mislabels code-attribution obligations. The CAD procedure's DabbleCAD provenance stays in `docs/DABBLECAD_NOTICE.md`.
- Mesh assets are original or *declared* third-party-verified 2D, 2.5D or 3D indexed triangle records; up to 24 assets, 256 finite vertices and 512 triangles per asset, with explicit licence, origin and source reference. **Declarations are not legal certifications.** 2D lies in the XY plane.
- Up to 64 typed placements (prop, target, vehicle, spawn) and 64 finite, positive-volume named AABB zones (occluder, sensor, trigger), with exact data-only record fields, global distinct IDs and resolved mesh references. +Y up, -Z forward, SI metres.
- The optional `tactical` source sidecar is validated by **real** `createTacticsWorld` before commit. `createCreatorTacticsWorld` reconstructs the actual TACTICS-001 world; sidecar ownership remains explicit. `createCreatorSightWorld` constructs physical SENSE-001 blocker AABBs from occluder zones and target points from target placements. A trigger/sensor zone is **not** an LOS blocker.
- `sealCreatorPackage` computes SHA-256 for each canonical asset and a full-project/package digest via standard offline Web Crypto; `creatorPackageJSON` returns portable inert UTF-8 JSON; `openCreatorPackage` validates strict versions, input byte budget, **every** asset hash and whole-package digest before returning an immutable owned project. External references are inert strings, never fetched or interpreted as JavaScript.
- Strict ≤256 KiB packages; reject unknown keys, accessors, sparse lists, invalid geometry/indices, duplicates, invalid asset refs, tactical collisions, tampering and out-of-range numbers without modifying the caller's current project. Canonical normalization sorts assets, placements and zones by ID.

**Important trust distinction:** SHA-256 detects unintentional modification to a previously known package and supports deterministic comparison; a malicious author can rehash forged data. Hashes are **not signatures**, proof of attribution, licences, safe gameplay or independent certification.

## Playable authoring acceptance
`demos/creator-interop-lab/index.html` is the original World Foundry authoring lab. Select mesh/CAD tower/target/vehicle/wall or either team, click an actual 12×10 grid cell, verify either atomic acceptance or documented rejection. Added wall cells update the displayed physical occluder zone and, when present, the tactical cover sidecar; they do not invent a sidecar or grant phantom cover. Projects without the optional tactical sidecar remain editable and report zero tactical units/cover while team tools are unavailable. The live report comes from actual SENSE-001 sight and, when present, TACTICS-001 validation, never from canvas pixels. Export a JSON file, import the result and confirm matching objects and sight decisions; mutate bytes and confirm import rejection without losing the active scene. Test offline in a packaged build.

## Verification commands
```sh
node --test tests/creator-interop.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

Existing scene, geometry, mod, tactics and SENSE modules retain their contracts; this opt-in adapter changes none of their authoritative behaviour. Owner browser play-through, independent code review, CI evidence and release sign-off are separate. The milestone does not import proprietary or donor-game art/code or promise universal editor-format compatibility.
