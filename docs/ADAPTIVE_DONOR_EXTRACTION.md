# Adaptive serial queries and cuboid streams — experimental

**Source-pinned donors**

- \`QSOLKCB/GAMES@7e0a9019d07b491cffc9b698fa51acdb843c49cc\`: \`LATTICE_CORSAIR/flight.js\` and \`LATTICE_CORSAIR/docs/OPTIMIZATION.md\` — brute/grid crossover and all-pairs parity.
- \`QSOLKCB/CorpoWars3d@8e86066686a575402ee2818378f1ec9323fb9ee6\`: \`src/renderer.js\` and \`src/skins.js\` — packed cuboid instances, retained CPU storage, repeated-angle reuse and distance LOD.
- Candidate base \`QSOLKCB/VANILLAJS@93ace342c11e2427ad82920c8965f16e91518fb7\`. All donors Apache-2.0. Only general-purpose algorithms are adapted; no donor characters, skins, art, Three.js, or packages.

## Design contract

\`modules/adaptive-circles/index.js\` supplies a bounded immutable snapshot of 2D \`{id,x,y,radius}\` circles. \`castSegment(origin, displacement, {ignoreIds=[]})\` returns \`{hit, mode, tested, total}\`. The first contact wins (closed segment, starts-inside time zero, lowest ID at equal hit time). Default **serial brute force** applies below 32 items; above it the **serial grid** examines candidate cells. Excessive cell visits fall back to brute force. This is an opt-in optimisation of the *same* quadratic narrowphase and is **not** a replacement for 3D static AABB collision, animated target queries, or gameplay. Positions are snapshotted, not magically updated when actors move. Grid cutoff is a tunable hypothesis, not a universal speed threshold. All caller inputs are checked before deciding hits; no worker, scheduler or concurrency is introduced.

\`modules/cuboid-stream/index.js\` offers a retained, bounded CPU-side Float32 stream of packed cuboids: 12 values each, \`xyz / dimensions / RGB / cos(yaw), sin(yaw) / glow\`. \`box()\` validates and emits a cuboid with contiguous-angle trig reuse; \`encoded()\` accepts exact prepacked values without atan2 roundtrips; \`snapshot()\` returns owned copy. \`view()\` is a borrowed view invalidated by subsequent append/growth/clear. \`CuboidStream.detail(position, eye, {distance})\` selects high versus low distance LOD with a squared-distance predicate (equality retains high detail). The 12-value format is *not* the 6-value XYZ/RGB stream expected by current \`api/webgl\`; consumers must explicitly expand it or use an instanced GPU adapter. This PR does **not** implement GPU instancing or automatically improve frame rate.

## Verification

- \`tests/adaptive-circles.test.js\`: stable hit ordering, ignore lists, empty intersections, capacity/domain checks, source-copy ownership, long-query fallback and 3,200 seeded parity comparisons against a separately written all-pairs oracle.
- \`tests/cuboid-stream.test.js\`: exact Float32 bytes, positive dimensions, signed zero, growth, ownership, LOD boundary and reused angles.
- \`node scripts/adaptive-query-workload.js --check\`: **one serial process** runs 14, 26, 58 and 128 actor datasets through all-pairs, always-grid and adaptive strategies. Index construction and 400 queries per trial are inside timing; 2 warm-ups and 7 alternating measured trials are reported with exact result SHA-256 parity. The cuboid stream has separately recorded byte hashes and work counts. **No timing threshold in CI**.

## RTX 5060 Ti — deferred physical measurement

The frozen \`evidence/RTX5060TI-001\` original archive and SHA-256 \`1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8\` remain **unchanged**. The historical benchmark did **not** measure these new adaptive and cuboid workloads: its CPU geometry/collision and native WebGL frame statistics may be compared only within their original protocol. The opt-in self-hosted hardware workflow checks this old receipt, reruns the original pinned baseline comparison against the newly reviewed \`main\` and measures *new* serial-query/retained-geometry workloads with an independent forced-fresh control. Those new workloads start a **new evidence series**, not an invented historical metric. Any proof of acceleration on physical RTX hardware requires a fresh, source-pinned receipt and a separate follow-up preservation PR.

No release/tag changes, no automatic merge, no new runtime dependencies, no shader/physics changes to existing games.