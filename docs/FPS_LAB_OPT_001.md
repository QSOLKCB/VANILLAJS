# FPS-LAB-OPT-001 — Headless Chromium evidence

**Status:** An observational benchmark harness, not a graphics-engine optimization or a native-GPU result.

**Workload:** the packaged [FPS Lab](../demos/fps-lab/index.html), with two unchanged game scenes (Footwork / Tracking Range) and its existing full/reduced render-resolution toggle. See [benchmark script](../scripts/fps-lab-chromium-benchmark.mjs) and [hosted workflow](../.github/workflows/fps-lab-chromium-benchmark.yml).

**Motivation:** Mykel J. Kochenderfer and Tim A. Wheeler, *Algorithms for Optimization*, second edition, MIT Press (2026), §15.1, motivates representing competing design metrics as a Pareto frontier without inventing a single arbitrary quality score. QSOLKCB/OPT's OPT-PARETO-001 is a separate finite-ledger selector.

## Execution and evidence

The CI job builds the normal offline deployment package from the exact PR source and serves it over local HTTP. It creates isolated headless Chromium contexts at 1280×900 / device-scale 1, with SwiftShader requested. It runs the genuine FPS Lab, not a mock renderer or the test-only physics model, and verifies WebGL initialization, simulation progress and absence of page errors.

For each scene it alternates **full resolution → reduced resolution**, then **reduced resolution → full resolution**. Every fresh context allows 40 warmup animation callbacks and retains 120 instrumented requestAnimationFrame samples, with both RAF callback timestamp intervals and JavaScript callback entry-to-exit wall time. The script reports median, p95, min, max, mean and raw observations. It records the actual drawing-buffer resolution, WebGL renderer strings, Chrome version, checkout SHA, source-file digests, host identification, and screenshots. The output JSON is protected by SHA-256 verification and uploaded as an Actions artifact.

The FPS Lab's built-in reduced-resolution checkbox presently requests a render-resolution factor of 0.65; the benchmark does not change its settings or propose a new render path. This is **not** a blinded evaluation of perceived fidelity and *render-pixel count is not observed GPU memory*. Graphics quality is not assigned a fake quantitative score.

### What the numbers mean

- RAF timestamp interval: observed headless browser callback cadence. It is not automatically a GPU render-time measurement; compositor pacing, browser scheduling, software graphics, and CI host contention can influence it.
- JS animation callback time: the measured elapsed JavaScript frame-handler duration, including physics/render submission on that handler. It excludes asynchronous GPU completion; it cannot independently prove physical GPU FPS.
- Render surface pixels: an exact buffer-size observation / resolution proxy, not visual quality, GPU allocation, or VRAM.
- p95 with 120 samples: descriptive percentile **for this CI observation only**, not a confidence interval or universally transferable benchmark threshold.

Do not infer a native RTX 5060 Ti performance result, an actual FPS speedup, a 60 FPS game guarantee or a performance win from this harness alone. A clean A/B measurement can establish an evidence baseline for a subsequent targeted optimization. Use native GPU measurements on a controlled hardware host before changing production defaults.

## Run locally

From a reviewed VANILLAJS checkout, with its existing build procedure and Playwright tooling already available in an isolated environment:

~~~sh
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
NODE_PATH=/path/to/isolated/playwright/node_modules node scripts/fps-lab-chromium-benchmark.mjs
sha256sum -c fps-lab-chromium.SHA256SUMS
~~~

No npm dependency is added to VANILLAJS application code. The GitHub-hosted workflow's isolated pinned Playwright install follows the existing hosted Chromium test pattern; no user-owned runner is used. The benchmark writes a new report with exclusive creation, refusing to overwrite an existing receipt.

## Future selection contract

After validation, each candidate rendering profile can be represented by an independently feasible record, with comparable *measured* p95 frame interval and JS frame-handler cost. Full versus reduced render resolution is a **design constraint or preference** requiring the owner's explicit choice; treating higher pixel count as a quality objective is only a declared proxy. Under a confirmed consistent metrics/quality contract, OPT-PARETO-001 may rank observed profiles. The selector remains offline, never inside the 60 Hz frame loop.

## Rollback / limitations

Reject the run if either configuration fails to load/run, any WebGL context is unavailable, the simulation does not advance, any browser page error occurs, or any timing sample is invalid. Do not change correctness gates or hide slower samples. For native hardware evidence, benchmark on the actual target GPU and account for present/driver/synchronization costs, using independent replay or equivalent-game-state checks.
