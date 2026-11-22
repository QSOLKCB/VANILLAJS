# GC-PROFILE-001 — The Allocation Observatory

**Status:** opt-in development measurement infrastructure; not a new garbage collector or a claimed performance improvement. The browser JavaScript runtime manages its collector. This programme measures application allocation pressure and observable collection activity *before* proposing reusable engine changes.

## Actual implementation

- **Real gameplay:** loads the built `demos/block-arena-lab/index.html` at a local HTTP origin. It starts an ordinary skirmish, holds movement and firing via keyboard while the usual CPU opponents, Combat3D, navigation, HUD, and WebGL render loop execute, verifies the match remains active, and captures a screenshot.
- **Controlled visual stress:** uses the actual public `render-webgl` and v3.3.0 `render-packing` modules in an isolated browser document. It renders 64/128/256/512 original moving boxes, comparing historical JS-array assembly to the retained `BoxVertexStream`. Every sample uses a new browser context, the same geometry sequence, exact initial Float32 parity checks, one shared GPU buffer and one draw call per frame.
- **Instrumentation:** CDP `HeapProfiler.startSampling/stopSampling`, `Performance.getMetrics` before/after, and bounded `Tracing` GC event extraction. Actual RAF intervals and JS work durations are retained as raw arrays, not just percentiles.
- **Analysis and evidence:** an independently tested pure Node summarizer for p50/p95/p99, allocation callsites, event durations and malformed-data rejection; an SHA-256 sealed report identifying exact source revision, environment, shader backend, counts, warmup and sample windows.
- **Hosted workflow:** isolated pinned Playwright Chromium tooling on GitHub-hosted Ubuntu, never on an owner's machine. The measured profiler is a script under `scripts/` only; it is not packaged in `dist/` and adds no runtime dependencies or engine modules.

## Running the tool

Check the deterministic postprocessor and existing engine gates:

```sh
node --test tests/gc-profile.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

For an optional full instrumented browser run, supply an isolated externally installed Playwright 1.64.0/Chromium installation (as the hosted workflow does). `NODE_PATH` must refer to its containing `node_modules` folder.

```sh
NODE_PATH=/path/to/isolated/node_modules \
node scripts/gc-profile-browser.mjs \
  --out /tmp/new-gc-profile-001 \
  --frames 60 --warmup 20 --backend software
(cd /tmp/new-gc-profile-001 && sha256sum -c SHA256SUMS)
```

Output directory must not already exist. `--executable /path/to/chromium` and `--backend default` allow a separately approved native-device run. `--help` prints accepted arguments. A supplied `GITHUB_SHA` must match the actual checkout.

The default run contains **17 independent samples**: one unchanged FPS skirmish and 16 visual measurements (4 box capacities × 2 assembly modes × 2 passes). The order is **legacy→stream, then stream→legacy**, with 20 warmup and 60 observed frames. These are bounded **observations**, not a statistically established speedup. Longer runs should repeat A/B trials, not fabricate deterministic timing thresholds.

## Interpret the data correctly

| Evidence | Observed meaning | Exclusions |
| --- | --- | --- |
| `allocationSampling.samples` / `sampledBytes` / `topSites` | V8's statistical sampled allocation records and attribution | Not all allocations, absolute allocation rate, or collection frequency |
| `cdpBefore` / `cdpAfter` `JSHeapUsedSize` | Heap occupancy before and after a workload | Not cumulative allocation, RSS, retained leaks or GPU memory |
| `gc.observedEvents` / `observedDurationMs` | Recognized complete CDP trace events and their reported duration | May miss events, may overlap or include non-pausing phases; no events does **not** prove zero GC |
| `frameIntervals` | RAF callback spacing under instrumentation | Not native GPU completion or confirmed 60 FPS |
| `jsWork` | FPS game's JS callback duration, or visual geometry build+WebGL submission | Not asynchronous driver work or compositor time |
| `scene.retainedStreamBytes` | Explicit typed-array capacity allocated by the visual stream | Not engine heap size or VRAM |
| `scene.float32Parity` | Exact Float32 bits for independently generated render boxes at fixed states | Not real combat damage, collision or entire-game replay |

Sampling and tracing can themselves change timings and allocation behaviour. Record the *actual* WebGL renderer identity rather than trusting only a software/native launch option. Browser-level instrumented time, CPU preparation time, GPU time and authoritative simulation time are different domains.

## Game and provenance boundaries

The 512 **visual** boxes are not bullets with authoritative collision or damage. No Combat3D pool limit is raised, and no existing game is modified. Existing FPS tests, original replay evidence, package allowlists, SHA pins and resource teardown remain in force. No third-party runtime dependency is added. No browser profiles, personal cookies, accounts or external websites are read. The tool serves only a verified local copy of the VANILLAJS distribution and disables service workers during measurement.

This profiler does not promise fewer pauses, better frame rates, or cross-browser bit-exactness. Its purpose is to identify candidate causes under controlled conditions, preserve raw evidence, and guide the **next separate** optimization PR.

## Suggested follow-on optimizations — not implemented

1. Verify high-allocation sites in repeated Block Arena runs; examine `Combat3D.snapshot()`, temporary render geometry, UI churn and state copies.
2. Characterize GC pauses and allocation sample variance on controlled hosted and separately approved native GPU runs.
3. If justified, add bounded lifetime-managed effect pools, retained geometry staging or reusable snapshot serializers, always with independent correctness/replay oracles.
4. Recheck 64–512 visual stresses and real gameplay on the exact accepted game/engine pins. An improvement in one fixture never automatically proves a benefit in other titles.
5. Promote adopted optimizations to later VANILLAJS versions, and only then let Boomer-Shooter, Games2 or other games deliberately vendor/pin them.

**Correctness outranks speed.**
