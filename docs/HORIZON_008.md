# HORIZON-008 — Start boundary, triangulated-terrain safety, workshop reverse

**Owner reproduction:** On the public Cape Aster racing page, reverse
off the raised start, leave the supporting road, then accelerate forward
beneath the displayed terrain and emerge on the other side. No
`vehicle3d.needsRecovery` flag is set by the under-terrain state.
Separately, the `drive.html` workshop still mapped S/Down to brake only.

## Executed native-model reproduction

Before this patch, at seed 7337 an exact-JavaScript fixed-step replay
used reverse with a small steering request followed by forward throttle.
The body moved almost **2 m beneath a rendered terrain triangle**
without an engine recovery request. The user independently supplied
screenshots of the under-map excursion.

## Scope and correction

The game owns the fail-safe, not the generic `vehicle3d` solver.

- `raceWorldSafety` observes the accepted vehicle state and queries
  `world.physics.sampleSurface`, which admits the exact displayed
  Float32 road/terrain triangles. It detects traversal behind the
  starting boundary while off-road **and nearest to the start of the route**,
  a true under-terrain COM position, and a bounded out-of-world fall.
  The infinite starting plane is not applied to later course segments
  that loop back behind it; those segments cannot incur a false penalty.
- Terrain tests peel away higher road layers, so passing legitimately
  below a high bridge while **above the lower terrain** is not called
  underground. All successful checks are observational: no hidden
  velocity changes, collision magic or route locking.
- The existing checkpoint recovery repositions an unsafe race player
  with **one authored +4 s penalty** and a clean fresh-input pause.
  Backwards movement cannot award any checkpoint.
- Sampling is invoked only on observed off-road frames, avoiding a
  new 120 Hz full-world query on ordinary supported racing.
- `drive.html` enables `DriveInput({directional:true})`, passes
  `readVehicle(state)` to the original gearbox, and exposes a
  separate Brake / reverse touch control. S/Down brakes forward travel
  then engages native reverse at low speed, W/Up returns to forward,
  and Space remains independent braking.
- `vehicle3d` public API, original tracks/scenery, exact contact
  triangles, rival collisions, course assist, snapshots and project
  schema are unchanged.

## Regression policy and test status

- A 355-step native-model reverse-from-start replay reaches
  `BEHIND_START` and successfully recovers to first gear with 4 s
  penalty, without an earlier native rollover flag.
- The updated Workshop's actual `vehicle3d` model reaches native
  reverse gear -1 and physically travels from Z=-8 to Z≈+5.48
  using real torque in the isolated source replay.
- A bounded actual terrain query identifies a deliberately buried
  state as `UNDER_TERRAIN`; a vehicle on a raised road stays valid.
- Node tests exercise these pure contracts. Packaged Chromium
  exercises actual keyboard reverse, brake and recovery.
- Offline ZIP module closure, Browser Cache source fingerprints,
  full hosted Flight Lab and the 1,000-cycle endurance matrix must
  be validated separately; isolated JavaScript evidence is **not**
  a substitute for their PASS receipts.

**Do not tag v2.9.0 until owner driving and full CI pass.**

This patch makes no claim about GPU image performance. The proposed
SGI/QEC-inspired visual pipeline is separate and must carry its own
16.67 ms frame-budget evidence and source-provenance review.
