# TRAJECTORY-001 — Air & FPS combat integration (P2)

**Scope:** Experimental reusable geometry and guidance adapter, independent of cockpit-owned missile gameplay. Coordinates +Y up / -Z forward; metres and seconds. Original Apache-2.0 source, zero external runtime, offline.

- `createTrajectoryWorld({actors,walls})`: owned, immutable, exact data-only geometry, ≤16 moving axis-aligned actors and ≤128 static walls. AABB actors are **not spheres**.
- `queryTrajectoryLock(world,request)`: actual SENSE-001 physical LOS check (1500 m / 90°), with occluder classification, not an on-screen crosshair flag.
- `launchTrajectory(world,request)`: explicit authenticated owner/target IDs, muzzle within 12 m of owner, physical lock, speed/turn rate/TTL, accepted/rejected receipt. Rejection never consumes ammunition because this module never owns ammo.
- `stepTrajectory(world,state,ticks)`: at most 256 committed 1/120 s updates per invocation. Existing lead-solver supplies the moving-target aiming direction; bounded angular turning determines the flight path; existing castSegment and castMovingSegment own wall and moving-AABB contact. A wall wins exact-time ties. Contacts classify actor/wall and give an actual swept fraction and point. No damage, game victory, weapon timers or scene graphics enter this authority.
- Targets move with **constant velocity** supplied in the immutable world; no dynamic manoeuvre or actor destruction is inferred. Guided movement is same-runtime reproducible with exact integer tick counts; non-associative floating-point execution across different runtimes is **not** claimed bit-exact. Stepping 20 then 30 ticks equals 50 on the same source/runtime.
- World ownership and shot ownership are separately protected by WeakMap; forged states and unknown IDs reject. Nested inputs use property descriptors and prohibit accessors, sparse arrays, prototype pollution and invalid finite values.
- Collisions are swept point/cube versus AABB, not rocket/gravity physics; this module does not alter ProjectileSystem, Combat3D, cockpit-rig or existing GFTA6 game rules.

Run `node --test tests/trajectory.test.js`, `node scripts/check.js`, `node scripts/build.js` and `node scripts/verify-offline.js`. Open `demos/trajectory-lab/index.html` locally and verify lock → launch → fixed ticks → contact receipt, then reset. Owner and CI evidence are separate requirements before merge. This phase is independent of P5 creator import/export.
