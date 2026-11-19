# VOIDWARD integration validation

This records executed local checks separately from browser checks and GitHub
CI. The integration starts from VANILLAJS
`5a91cd4cc7251c485eaf2fc80d5227a20571fd8c` and adapts 4XGAMES PR #2 at
`030859385ac8929e066702ef8af0518663480653`. Historical mathematical and hardware
archives are preserved. A source-inventory update is not a new Lean proof or a
new hardware result.

## Executed baseline

The unchanged source and built site were preserved before implementation.
On Linux x64 / Node 22:

| Check | Result | Observed elapsed time |
| --- | --- | ---: |
| `node --test tests/*.test.js` | 671 / 671 pass | 5.28 s |
| `node scripts/check.js` | 257 JavaScript files, 50 module contracts, two research experiments | 3.77 s |
| `node scripts/build.js` | 154 public files | 0.114 s |
| `node scripts/verify-offline.js` | All 154 file bytes and digests verified | 0.064 s |

The package totals 1,013,132 bytes. Its generated worker SHA-256 is
`ad9b20f3638a553d4da7d701828d49c034e7110f28528c30de659d5fdefa7931`.
The initial sandbox test attempt could not spawn required Node/Python child
processes and timed out. The passing rerun used the unchanged source snapshot
outside that restriction; the failed attempt remains separate local evidence.
The timings are observations of these commands, not a game-performance claim.
The [baseline receipt](evidence/voidward/baseline.json),
[Ternary Reach screenshot](evidence/voidward/baseline-ternary.png) and
[editor screenshot](evidence/voidward/baseline-editor.png) are retained publicly.

## Executed expanded source checks

The first complete working-tree run passed **743 / 743 Node tests** in 6.13
seconds: the 671 baseline tests, 68 VOIDWARD core/strategy/campaign/authoring/save/
parity tests, and four editor campaign-sidecar tests. Source checks passed 290
JavaScript files, the unchanged 50 module contracts and two research experiments
in 4.47 seconds. The source verifier checked the exact 4XGAMES pin, 27 copied
donor-file hashes and nine existing native dependency hashes.

Coverage includes:

- Every imported campaign's authoritative state matches the pinned 4XGAMES
  reference after twelve legal AI-driven turns at seed 42, using each scenario's
  last permitted player empire. This is five simulation hashes, not a browser
  or audio numerical-equivalence claim.
- Campaign objectives, branches, event ledgers, AI information boundaries,
  research, fleet orders and upgrades retain their source regression coverage.
- Native pack and bounded Mod SDK export/import/play, actual Workbench mesh
  projection, map coordinates, physical file/line/field diagnostics and rejected
  edits preserve the last valid content.
- Editor campaign undo/redo stays separate from scene history, validates home
  and starlane edits, respects 16-snapshot/4-MiB history budgets, and retains
  distinct source declarations through hull bundles and playable packs.
- Old save fixtures migrate, large-state byte bounds remain explicit, and
  serializing and loading valid state preserve the tested state semantics.

No test files appeared during that full run. The browser checks below ran after
the harness updates. The [source-check receipt](evidence/voidward/node-validation.json)
records the executed counts; it is a portable excerpt of the local logs.

## Existing evidence and formal boundary

Executed without hardware or browser launch:

- All five frozen RTX archive verifiers passed, including required original
  screenshot/archive bytes for COMMENT-001 and RTX003.
- Five archival `SHA256SUMS` inventories passed.
- 54 archival/receipt Python unit tests and three ALIEN-MATH-006 source-admission
  tests passed.
- Independent ALIEN-MATH-004 and ALIEN-MATH-005 Python oracle fixtures passed.
- The CI invariant workload and independent finite closure oracle passed. Its
  qualification objects are synthetic test fixtures, not authenticated GitHub
  browser receipts. Unknown source still forces execution.

Only `scripts/browser-reuse-policy.json`'s digest changes in the phase-006
manifest. Existing mathematical sources, theorem declarations and historical
archives are not rewritten or recertified. Lean is not rerun by these local
checks. No owner-only GPU workflow or GitHub CI job has been dispatched.

## Executed packaged browser verification

The owner-authorized unattended rerun **passed all four suites** on Linux x64 /
Node 22 / Chrome 156 under the `/VANILLAJS/` deployment prefix. Playwright
controlled its dedicated browser without OS keyboard or mouse injection. The
owned browser processes were closed after testing. See the
[complete portable result](evidence/voidward/owner-browser.json).

| Suite | Executed result |
| --- | --- |
| Existing Ternary Reach | PASS |
| Existing Visual Editor | PASS |
| Advanced VOIDWARD | 15 / 15 checks pass; all nine permitted campaign/empire choices launched and advanced a turn |
| Editor 4X bridge | 10 / 10 checks pass |

The [campaign receipt](evidence/voidward/campaign-browser.json) records zero
JavaScript errors, HTTP failures or external requests. Real UI actions exercised
exploration, settlement, production, research, ship design/construction/refit,
fleet groups, diplomacy and combat. Native and Mod SDK creation/export/import,
legacy save migration, objective progress reload, rejected imports, large-list
filtering, keyboard, narrow layouts, emulated touch and offline reload passed.
The chart fixture retained all 32 accessible system buttons while hiding 15
colliding visual labels; its 17 displayed labels had no overlaps.

The editor bridge checks used the actual 3D inspector, scene undo, starlanes,
home positions, text edits and campaign undo/redo. They projected primitive and
mesh geometry, retained mixed source declarations in the hull bundle, exported
and reimported native and SDK packs, restored separate campaign recovery,
played the exported draft, returned it to the editor and rejected a malformed
handoff without discarding recovery or its payload. The 320-pixel keyboard
authoring case passed. The exported
[editor campaign](evidence/voidward/editor-created-campaign.json),
[attributed hull bundle](evidence/voidward/editor-hull-bundle.json) and
[game-workshop campaign](evidence/voidward/workshop-created-campaign.json) are
reusable artifacts from those executed workflows.

The tested build contains **295 files / 1,605,756 bytes**. Its generated worker
SHA-256 is `7407807a855e59ff9e734ee9301727da3509b2b80dc3db8779d4b87f69af8791`.
Representative evidence includes the
[Grand Frontier chart](evidence/voidward/grand-frontier.png),
[editor viewport](evidence/voidward/editor-viewport.png),
[narrow campaign](evidence/voidward/campaign-mobile.png) and
[narrow editor](evidence/voidward/editor-mobile.png).

The first attempt exposed an existing test assumption: timed typing was expected
to form one native text-undo transaction, but Chrome grouped it differently.
The test now uses one `keyboard.insertText` insertion and retains the native
text-versus-scene undo assertions. Product behavior was unchanged for this
failure; the complete rerun passed. The
[failure history](evidence/voidward/failure-history.json) retains the failed
expectation, correction and original receipt digest.

## Measured observations and limits

A generated **2,429,209-byte** save with populated report history passed UI
import, actual download/export and reimport after switching active campaigns.
Every authoritative state field and pack file matched. The single observed
transfer samples were 322.9 ms import, 66.1 ms export/download and 293.9 ms
reimport; these include automation and file transfer overhead. This is a
validated synthetic size fixture, not a played late-game campaign or a
simulation-speed measurement.

For Machine Dawn and Grand Frontier, all compared RGBA bytes matched at two
map sizes and across three planet palettes with zero tolerance. The production
renderer uses the reference drawing path and reports zero raster-cache entries;
this is correctness evidence, not an optimization speedup. Five samples per
campaign from DOM click capture to the second animation frame ranged from
31.0 to 32.0 ms. They include simulation, persistence and rendering and do not
measure physical input-device latency. Approximate used JS heap at the sampled
points was 70.6 MB and 44.1 MB respectively; neither sample establishes a memory
ceiling or a leak trend.

Independent volume settings, music level zero and preference persistence across
reload passed. An analyser on nodes connected to the real audio destination
observed a nonzero peak of 0.02845 when audio was enabled. This verifies signal
delivery; no human listening assessment was performed.

The [GPU assessment](evidence/voidward/gpu-assessment.json) combines a hardware
ANGLE renderer with enabled Canvas 2D/compositing and two approximately
two-second traces around repeated game `drawMap` calls. Machine Dawn and Grand
Frontier recorded 183 and 124 `RasterDecoderImpl::DoRasterCHROMIUM` events, with
121 Skia GPU swaps each. CPU raster tasks also occurred. This supports hardware
participation during the dedicated game workload; it does not establish
exclusive GPU rendering, per-pixel attribution or a speedup. Raw traces and
detailed device diagnostics remain local; the public assessment contains their
hashes and relevant event counts.

`browser-4x.js` retains Ternary Reach coverage. `browser-voidward.js` covers the
advanced game, while `browser-editor-4x.js` covers the new editor workflow beside
the original `browser-editor.js`. The worlds/editor policy includes their
shared runtime roots and explicit save-fixture inputs. New source/harness hashes
are not automatically promoted to reviewed cache witnesses.

The browser play was scripted. Full manual campaign playthroughs, physical
mobile devices, human audio listening and other browser engines were not tested.
A local browser result does not report a GitHub CI outcome. Public JSON receipts
are sanitized excerpts, not byte-identical raw diagnostic files. Screenshots and
creator artifacts retain their original bytes; the
[artifact inventory](evidence/voidward/artifact-inventory.json) records hashes.
Detailed raw workstation metadata stays local.

## Post-merge VOIDWARD legacy-save browser fixture isolation (2026-11-19)

The first HORIZON v2.9.0 post-merge Flight Lab run, 44462829442, failed in
`worlds/verifyVoidwardLab` during the 30-second post-reload wait for a
legacy `frontier` or `machine-dawn` save. The log proves a missing expected
restored state at that wait; it does **not** prove which storage condition caused
it. All earlier phases in the shared VOIDWARD browser test had produced many
campaign autosaves, making cross-test storage pressure a potential confounder.

The migration fixture now uses a new isolated Chromium browser context with
clean localStorage. Both original v1 saves are imported through the real UI,
verified as migrated v2 states, and compared byte-for-byte in decoded persisted
save envelopes (including source identity, complete pack and full state) **before**
reloading. It then confirms the same full state and pack after reload. Rejected
imports still must preserve the accepted campaign. The original browser page
and its independent later scenarios remain intact. Service worker coverage is
provided by the separate required VOIDWARD offline check; it is disabled only
in the isolated persistence-focused context.

This does not increase timeouts, disable browser tests, publish a cache witness,
change game code or weaken rejection rules. Unknown persistence failures still
fail the run with a more specific assertion instead of only a timeout.

## Hosted offline bootstrap diagnostics for PR #127 (2026-11-19)

Local owner reproduction on the exact PR head `353776466e457de1e660427112a5400f3cdf15b6` passed 1,247/1,247 Node tests and the full shared Chromium browser dispatcher. VOIDWARD completed all 15 checks; its offline check passed in 177 ms in the full-suite run. Separate pinned Playwright 1.64.0 / Chromium 156.0.8078.4 executions passed at nominal speed, at 6x CPU throttling (634 ms offline), and at 10x CPU throttling (986 ms offline). Throttling page execution is **not** a complete emulation of hosted-runner scheduling or service-worker contention.

The hosted run 44472385630 failed during VOIDWARD's existing 12-second offline boot wait with the visible loading shell still present. This establishes an unreproduced hosted/browser-lifecycle issue; it does not establish a slow game simulation, missing asset, or worker defect.

The browser harness now writes `browser-artifacts/voidward/offline-diagnostics.json` after every attempted offline verification, including on failure. It records the pre-reload worker controller, active worker, cache namespaces and expected turn; an at-failure read-only boot snapshot; and a bounded last-96-event trace of same-origin request paths, status codes, service-worker response attribution, failed requests, browser console errors and uncaught page exceptions. A diagnostic read times out after two seconds and reports that limitation rather than substituting a PASS or mutating the browser cache. GitHub's existing unconditional `flight-lab-evidence` artifact upload retains the file.

The original 12-second Playwright readiness timeout, real offline network state, active save assertion, end-turn assertion, existing HTTP/page-error checks, and failure exit status remain unchanged. No application runtime or service worker is modified, and no reused PASS is promoted as evidence.
