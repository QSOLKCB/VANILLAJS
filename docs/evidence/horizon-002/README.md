# HORIZON-002 execution record

Reviewed main: `69dd325243633f66844a5ef85d87ab24e8677a63` (merged PR #105).
Runtime implementation: `977130ae59ad315eafd18caa8e377ed34ca3b18b`.
Verified candidate: `08f1d47dd71eac1f3547cbfdd319a4b1f67fc564`.
The only difference between those candidate revisions is two new files in a
synthetic capsule fixture. Runtime, browser harnesses and packaged assets are
byte-identical. The subsequent evidence commit changes only this evidence folder.

## Actual execution

| Command | Result | Record |
| --- | --- | --- |
| `node --test tests/*.test.js` | 1134/1134 PASS, including the 16 Python capsule cases invoked by the Node gate | [Full output](node-tests.log.gz) |
| `node scripts/check.js` | PASS: 483 JS files, 70 module contracts, two research experiments; source/provenance checks and 690 local documentation links | [Output](source-check.log) |
| `node scripts/build.js` | PASS: 934 files; final source bytes built immediately before implementation commit | [Package identities](identities.json) |
| `node scripts/verify-offline.js` | PASS: every packaged file hash and the worker verified | [Output](offline.log) |
| `node scripts/browser-check.js --suites=editor` | PASS, including final 320px HUD correction | [Output](browser-editor.log) |
| `node scripts/browser-check.js --suites=home,render,play` | PASS | [Output](browser-home-render-play.log) |
| `node scripts/browser-check.js --suites=worlds` | PASS | [Output](browser-worlds.log) |
| `node scripts/browser-check.js --suites=research,donor` | PASS | [Output](browser-research-donor.log) |
| `git diff --check` | PASS | Final diff check repeated before evidence commit |
| `node docs/evidence/horizon-002/measure-physics.mjs` | PASS | [Reproducible observations](physics-observations.json) |

Browser commands used the already installed development tools:

```sh
export NODE_PATH=/home/trent/.local/share/qsol/browser-tools/node_modules
export PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/trent/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell
```

[Environment](environment.json): Node 22.18.0, Playwright 1.64.0, Chromium
158.0.8127.18, Linux x64, native WebGL1 with ANGLE SwiftShader launch flags.
No dependency installation, personal runner or physical GPU/device validation
was performed. Viewports and touch were Chromium emulation, not mobile hardware.
Local execution is not authenticated reviewed-main receipt authority.

## Source and package identity

[Machine-readable record](identities.json) contains source revisions, package
hashes, each browser group's fingerprint and its empty unresolved-issue list.
The final package has **934 members / 6,373,370 bytes** (manifest excluded):

- Manifest SHA-256: `5fe63dd0a025fe2360f297d0c7b88d81f757c68ae7529e5ce4869f9b25bc57d5`.
- Worker SHA-256: `00779a9fc27f79430cda3fe8c29c0b1b06a3c640abfd3f2d9761c6cb594c53c2`.

Both HORIZON pages share a content-derived runtime namespace. Provenance v2
reconstructs both HTML rewrites from their original Git-bound source and checks
every copied module. All seven local source profiles have no unresolved entries.
The authority remains unverified locally; these records cannot qualify reuse.

A Git-blob comparison confirms **316 pre-existing protected files unchanged**:
existing modules/API/experiments, workflows, historical evidence, Racing Lab,
Workbench, licence/notices, root AGENTS, package metadata, historical README/
roadmap archives and the frozen browser reuse policy. New files do not enter that
baseline comparison. Games2 was not modified.

## Numerical observations

These are model reference cases in this Node runtime, independent of browser
pixels or hardware-performance claims. [The script](measure-physics.mjs) records
its actual vehicle-module hash and complete parameters/observations.

| Scenario | Observed | Independent reference |
| --- | --- | --- |
| Brake from 20 m/s, friction 1 | 20.3457 m to below 0.08 m/s | `v²/(2μg)` = 20.3874 m |
| Brake from 20 m/s, friction 0.35 | 58.2076 m | 58.2496 m |
| Low-speed steady turn | 22.0269 m radius | Bicycle geometry 21.7284 m; +1.374% |
| Four-corner static support after settling | 11772.00000000293 N | `mass*g` = 11772 N |
| Ballistic height over 0.5 s | -0.01021875 m error | Matches the semi-implicit fixed-step error prediction |

Tests also cover separate wheel drive/surface contacts, bank/elevation traversal,
actual ramp take-off/landing, weight transfer, shift interruption, engine braking,
zero-speed braking, thin barrier sweeps, impossible ground/ceiling clearance,
rejected provider/input rollback, wheel spin sign and cadence parity. Changing
render cadence to 30/60/144 Hz leaves the same fixed input trajectory unchanged.

## Actual browser evidence

[Driving diagnostics](horizon-drive-diagnostics.json) record actual interaction
observations. The flat pad uses 17 retained meshes / 22,662 vertices / 997,128 bytes
of mesh data. Driving did not increase its 17 uploads. These are scene budgets,
not a universal frame-rate promise. A camera frame adds the renderer's sky draw.

The run exercised real W/D/S inputs, changed world position/heading, braking,
tuning data, half-torque acceleration, four-wheel airborne/landing states,
coast contact, strict invalid and stale imports, both data exports, history,
pause/fresh-input, two native touch pointers and cancellation, keyboard buttons,
context loss/restoration, graphics-unavailable authoring and offline driving.
Offline navigation reported `response.fromServiceWorker() === true` and allowed
actual movement and vehicle export. Separate startup checks retained an older
worker serving poisoned unversioned modules while the new namespace still ran;
a deliberately failed app import exposed a working reload control.

Inspected final packaged screenshots:

- [Desktop workshop](horizon-drive-desktop.png).
- [Handling pad](horizon-drive-pad.png).
- [Aster Coast](horizon-drive-coast.png).
- [Ramp airborne state](horizon-drive-ramp.png).
- [320px touch layout](horizon-drive-mobile.png).

Full TAP logs use deterministic gzip to preserve their original bytes, including
whitespace in exception output. Read them with `gzip -dc <filename.log.gz>`.

## Failed attempts and corrections

- The final branch-wide diff check identified trailing whitespace in verbatim
  TAP failure output. Archived the unmodified TAP bytes with deterministic gzip;
  the branch-wide diff check then passed. Runtime and tests were unchanged.
- Initial full Node run: 1133/1134 passed. The synthetic capsule build fixture
  lacked `drive.html` / `drive-start.js`. Added those two fixture entries, kept all
  assertions and reran the complete suite: 1134/1134 passed.
  [Original failure log](node-tests-attempt-1.log.gz).
- A combined `worlds,research,donor` browser process received SIGTERM / exit 143
  without an assertion error after multiple lab PASS messages. Its incomplete
  output is [preserved](browser-combined-terminated.log). Completion is recorded
  only from the smaller full-group runs listed above; partial output is not PASS.
- Before the committed candidate, dependency admission rejected a dynamic DOM tag
  used for table cells. Changed it to explicit literal `th`/`td` creation and kept
  the dependency guard intact. Preliminary packaging fixtures were also extended
  for the second page; their final ten package/provenance tests pass.
- During regression development, corrected bottom-out correction bypassing an
  overhead barrier, neutral gear re-engagement, low-speed brake creep, backward
  wheel presentation, terrain protruding through the flat pad, unsupported steep
  support faces and JSON negative-zero roundtrip. Those corrections precede the
  committed runtime candidate and have numerical/authoring regression coverage.
- Preliminary browser driving/startup checks passed. Visual inspection found a
  narrow-screen gear/RPM wrap; fixed CSS and verified the final editor group and
  mobile screenshot. No assertions or frozen historical evidence were relaxed.

## Limits and next gate

Vehicle dynamics uses vertical suspension queries, bounded Float64 integration,
a simplified drivetrain/tyre friction model and conservative static chassis
barrier sweeps. Arbitrarily thin terrain features, moving-body collisions,
unsprung wheel inertia and full tyre fidelity are outside the contract. Overturns
and blocked clearance require explicit recovery. Decorative scenery is not an
implicit collision mesh; steep unsupported faces are excluded.

The export is inert vehicle or driving-study data, not a complete racing game.
HORIZON-003 still owns full Track/Vehicle Foundries, original engine/tyre audio,
a scenic race with rival/checkpoints/finish, portable game packaging and polish.
No merge, tag, release, deployment or Games2 change was performed.
