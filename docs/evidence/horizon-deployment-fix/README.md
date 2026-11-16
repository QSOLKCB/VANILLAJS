# HORIZON deployment repair — local execution record

Implementation: `e02c01ab12b4dd98a4e37d20fe60a58da2fcdf21`, based on merged
main `54634ba45d4205d2afcf0c40c61fb9bff0312a86`. The follow-up evidence commit
adds these records and clarifies the HTTP request wording in the diagnosis.
It changes no runtime, test harness, workflow or formal verifier.

The [diagnosis](../../HORIZON_DEPLOYMENT.md) links the cancelled main job and
describes the distinct public-site verification that still follows owner merge
and successful main deployment. This record is not a trusted-main receipt or a
claim that the repaired site was deployed.

Executed locally with Node 22.18.0, existing Playwright 1.64.0, Chromium
158.0.8127.18, Linux x64 and SwiftShader:

- `node --test tests/*.test.js`: 1,171 passed, no failures or skips.
- `node scripts/check.js`: 503 JavaScript files, 71 modules, two experiments;
  761 Markdown links, 153 imports and 12 agent workflows.
- `node scripts/build.js` and `node scripts/verify-offline.js`: 970 files,
  7,002,100 bytes; exact tested package identities in `identities.json`.
- `node scripts/browser-check.js --suites=donor`: all seven imported checks
  passed, exercising the normal timed dispatcher. SubHunt, interrupted in hosted
  CI, completed in 44.68 seconds in this local run. This suite ran before the
  final diagnostic prose edits; its runtime and harness bytes match the candidate.
- The captured `browser-launcher.txt` invokes all six existing HORIZON race,
  scenery, driving and older-worker checks against the candidate package at
  `/VANILLAJS/`. All passed, including canonical-index world-space movement,
  the full eight-checkpoint keyboard route, navigation, narrow/touch controls,
  graphics recovery and controlled offline startup. Diagnostics record a win at
  43.0667 simulated seconds; this is not a hardware-performance claim.
- Four Python admission tests, including exact-workflow mutation rejection,
  passed. Installed Lean 4.35.0 checked all 21 model theorems, 856 finite
  comparisons and six compiled negative controls. CI invariant oracle and
  workload also passed. Existing mathematical results remain unchanged.
- `git diff --check` passed. Actionlint was unavailable and was not installed.

The initial source-pin attempt correctly refused the changed historical workflow.
`formal.log` retains that failure and the subsequent successful exact-substitution
audit. The formal run occurred before the implementation commit: its report keeps
the then-current base HEAD, while its source-manifest SHA matches the committed
candidate. Node/source tests likewise ran on the candidate bytes before commit.
No report has been relabelled to imply execution on a different revision.

The final HORIZON package check ran after the implementation commit. The later
HTTP wording correction changes one shipped documentation file; it does not
change the game or browser assertions. Hosted CI must verify its final package.
The full seven-group browser inventory was not rerun locally for this CI-only
repair. No physical GPU, controller, mobile-device or non-Chromium validation is
claimed. Historical evidence remains untouched.
