# Cape Aster ownership correction — PR #105

Tested source: `6bd08698674423de4606fdffaf0df2a4ec38b130`. Previous PR head:
`4357902787d4eaa5734225261f12dffa6d319abe`.
The following evidence-only commit appends this record. The
[original milestone evidence](../README.md) is preserved.

Cape Aster's name, seed, route, banking and bridge/tunnel selections now live in
`demos/horizon-lab/scenery.js`. The lab-owned `createCapeAsterScenery()` supplies
that data to `starterHorizonProject()`. Core `scenic3d` retains validation,
road sampling and reusable geometry; its unreleased `starterScenery()` export
is removed. API examples now author a consumer-supplied recipe. Data formats,
versions and existing released engine APIs are unchanged.

[Exact before/after comparison](geometry-parity.json) verifies identical project
serialization, road contact triangles, materials and every low/high Float32
geometry batch. Existing geometry cases consume the lab recipe as a test fixture;
core modules do not depend on demos. The new file is packaged both at its source
path and inside HORIZON's content-derived runtime namespace.

## Executed checks

- `node --test tests/*.test.js`: **1,079 passed**, zero failures/skips;
  [TAP, gzip](node.tap.gz).
- `node scripts/check.js`: **471 JS files, 69 module contracts, 647 local links,
  134 imports and 12 workflows** passed; [log](source-check.log).
- `node scripts/build.js` and `node scripts/verify-offline.js`: **913 manifest
  entries**, **6,178,862 bytes**, all verified; [build](build.log),
  [offline](offline.json), [manifest, gzip](package-manifest.json.gz).
- `node scripts/browser-check.js --suites=editor`: complete packaged group
  passed, including HORIZON editing, real pixels, import/export, native context
  restoration, offline loading and retained older-worker startup;
  [browser log](browser-editor.log).
- 27 cache/provenance/receipt tests passed; [TAP](cache-tests.tap).
  All seven source closures have zero issues: [issues](profile-issues.json),
  [full local/untrusted profiles, gzip](source-profiles.json.gz).
- `git diff --check` passed. An evidence-only rebuild reproduced the tested
  manifest exactly; [parity](package-parity.log).

This focused correction reran the editor browser group. The other six browser
groups and Racing smoke were not rerun; their prior execution is recorded in
the original milestone evidence. No assertion, timeout, dependency discipline
or cache authority was weakened. Only source/runtime-namespace pins changed;
 qualification remains one authenticated reviewed-main execution.

Environment: existing Node 22.18.0, external Playwright 1.64.0 and Chromium
158.0.8127.18; Linux x64, native headless WebGL with SwiftShader. No installs,
physical-device validation, owner-runner dispatch, Games2 change, merge or
release occurred. [Execution identities](execution.json).
