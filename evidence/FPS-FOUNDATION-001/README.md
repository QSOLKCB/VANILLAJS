# FPS Foundry development evidence

These are ordinary local development observations for FPS-FOUNDATION-001.
They are **not** formal results, authenticated main receipts, or CI reuse
witnesses. Existing frozen archives and browser reuse policy are unchanged.

`verification.json` binds the changed implementation, docs, tests and tooling
by SHA-256. `source-identity.json` separately records the complete simulation
dependency closure used by replay. The reviewed base is the PR #94 merge,
`e2740d009c4547321c023b32e5fe020ebac07c3f`.

Executed on Linux x64, Node 24.22.1, existing Playwright 1.57.0 and system
Chromium 156.0.8078.79 with software WebGL:

- All 954 Node tests passed, including the actual complete 36,000-tick match
  export/verification, independent geometry parity, package rejection and
  transactional replay/import controls, and zero-damage assist rejection. See `node-tests.log.gz`.
- Source checks passed: 389 JavaScript files, 59 module contracts and two
  research experiments. See `check.log.gz`.
- The standard build and independent offline verifier passed: 600 distributed
  files, 3,628,034 bytes, within the 16 MiB precache limit. See `build.log.gz`
  and `offline-package.json` for the actual worker digest.
- Packaged Block Arena passed actual controls, movement/jump, selected-weapon
  ammunition, scope, WebGL pixels, relative touch aim, Pointer Lock unlock,
  hidden-tab cancellation, cleared held-key repeat, emulated gamepad disconnect,
  both victory/defeat modes, authoring, replay and rejected import rollback,
  320px layout, fullscreen controls, audio cancellation and full offline reload.
  The older-worker test retained the real incompatible audio fixture while both
  modes played; the blocked startup import exposed Reload lab and recovered.
  See `packaged-block-arena.log.gz` and the screenshots.
- `workload.json` records three same-state simulation samples for each original
  arena/mode. Geometry output matched independent legacy Float32 concatenation:
  165 static boxes / 5,940 vertices, 120 reference constructions versus one
  retained construction for 120 observations. Timings are local CPU samples,
  exclude GPU/input/audio and establish no frame-rate or speedup guarantee.

Reproduce with the repository's standard Node/check/build/offline commands,
`node scripts/fps-workload.mjs` and `node scripts/browser-check.js` using an
already available Playwright/Chromium environment. The full local regression reached an existing Kinetic Foundry idle-draw check
that sampled wall time before its pending pause frame had completed. That test
now drains actual animation frames before retaining its exact idle-draw equality
assertion. The corrected CPU labs and all later donor/editor/creator/audio checks passed
(`remaining-browser.log.gz`); the complete home group also passed
(`home-browser.log.gz`). The full hosted browser run
and its authenticated artifacts are reported by the PR checks; these local logs
do not substitute for them.

The mode-completion browser cases use admitted bounded fixture packs; original
layouts are exercised separately. Screenshots show the original running arena,
the 320px workshop and a completed fixture encounter. Touch/controller signals
are emulated; physical mobile, console controllers and other JS engines remain
unmeasured. Starter balance still benefits from owner playtesting.
