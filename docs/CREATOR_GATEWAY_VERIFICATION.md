# Creator Gateway audit and execution record

## Audited baseline

Inspected 16 November 2026. Fresh VANILLAJS main checkout:
`128d7c924513f7d8ac08e2e11cc6832c5b7082fb`. GitHub release metadata reports
v2.4.0 published at `2026-11-16T03:47:55Z` from that commit.
Games2 main is `0329dd9b5a6ba8912b062696afdff6a3944619ab`, matching the requested
starting revision. Its tracked tree contains README.md and an Apache-2.0 LICENSE. No Games2 edits.

Confirmed `MODULES.json`: 62 modules, all experimental; 43 recipes; two research
experiments. `package.json` is private tooling metadata; `scripts/build.js` uses
its version in the site manifest and `scripts/check.js` requires the catalogue
release to match. Both historical `1.0.0` fields are retained. Neither determines
the published GitHub release. Any version migration needs separate contract review.

Audited README, roadmap, root policy, BUILD_A_GAME, MODULES, architecture, API,
creator guide, Workbench and verification history; Creator Hub, editor, Block Arena,
Arcade Combat and Demoscene sources; build, source and offline checks. Existing
references include historical counts and release wording; they are dated evidence,
not replacements for the current catalogue. README_HISTORY.md and
ROADMAP_HISTORY.md preserve the old root documents byte-for-byte and retain relative
link context. No proof or historical evidence is edited.

## Validation scope

`audit-docs.mjs` runs from the normal source check. It validates local Markdown
links and new navigation anchors, tutorial/hub HTML links, static imports reachable
from catalogue HTML script and JS entry points, README module names, baseline counts/metadata,
unchanged archives and the agent catalogue. External URLs are references, not
network-tested documentation promises. Historical archive links are checked for
local target existence; their original fragments/text are preserved.

The schema validator rejects unsupported keywords, unknown data fields, missing
or duplicate workflow IDs, unknown modules/commands, stale files and escaping
paths/symlinks. It never executes catalogue commands or imported data.

Tutorial tests cover movement through real Forge physics, zero-speed diagnostic
and rejection, project round-trip, actual browser downloads, edit invalidation,
keyboard activation, restart, 320px layout and cached offline startup. Existing
creator browser coverage packages a project and checks nested-path offline reload.
No engine APIs, schemas, mathematical proofs or browser trust rules are changed.

## Initial recovery execution results

Recovery review on 16 November 2026 used Node v22.18.0, Python 3.14.4 and existing
external Playwright tooling with Chromium 158.0.8127.18 / software rendering.
The previous uncommitted implementation was recovered on `feat/creator-gateway-001`.
Fresh execution, rather than the previous agent's logs, supplies the results below.

- `node scripts/check.js`: passed source checks and archived donor/Demoscene
  checks; documentation audit covers 401 local links, 97 imported source files
  and six workflows.
- `node scripts/validate-agent-catalog.mjs` and `node scripts/audit-docs.mjs`:
  passed, including invalid-entry, unused-schema-keyword and symlink rejection
  coverage in `tests/creator-gateway.test.js`.
- `node scripts/build.js` and `node scripts/verify-offline.js`: passed;
  776 packaged files verified at the final build.
- `node scripts/browser-check.js --suites=editor`: passed existing Workbench,
  4X authoring and creator export coverage plus the new Tutorial Lab.
  The tutorial's downloaded project was imported into the Workbench and played.
- `node scripts/browser-check.js --suites=home,render,play,worlds,research,donor`:
  passed. Together these two commands executed all seven browser groups;
  none of these local results were reused from cache or issued as trusted CI receipts.
- `node scripts/export-game.js` on the actual browser-downloaded tutorial
  project: passed, producing 24 files. Generated LICENSE and NOTICE matched
  the repository byte-for-byte.
- `git diff --check`: passed.

Initial PR submission's `node --test tests/*.test.js`: **976 passed, one failed, 977 total**.
The sole failure is the root policy source-pin conflict described below.
No physical RTX, controller or mobile-device validation is claimed.
Chromium narrow-viewport testing is emulation, not physical hardware. No new
Lean proof execution or hardware benchmark is claimed.

### Failures found during recovery

The previous browser run stopped at disabled tutorial controls. A fresh build
included the recovered startup readiness guard. Subsequent execution found that
the floor hid the player in the existing CPU renderer at the tutorial's camera
angle. The tutorial now uses a near-top-down camera; browser assertions require
visible orange player pixels and distinct rendered positions. The engine renderer
was not changed. Unapplied input now invalidates test/export readiness, and the
browser checks this rejection path.

An initial sandboxed Node run stalled in existing process-based tests and was
stopped. Running with normal process access completed 968 tests: 967 passed and
one rejected the proposed AGENTS.md expansion because ALIEN-MATH-006 pins its
exact bytes. No assertion, frozen manifest, proof or evidence was changed to
hide this failure. The initial run including cache repairs completed 977 tests,
with the same sole failure. At initial submission the requested root expansion
was retained pending the owner's decision, and the PR was opened as a draft.
The recommended resolution was to preserve the original root file and use README,
the new agent guide and catalogue for onboarding. Moving root policy out of the
historical proof input requires separate approval and verification-boundary work.

### Browser cache repair requested during recovery

The existing cache could not qualify current packages: its live classifications
were stale, generated runtime/HTML bytes did not map to tracked Git source, and
seven duplicated input inventories exceeded the existing receipt JSON limit.
The repair adds a separately reviewable profile, independently checks the six
existing package transforms, and deduplicates receipt input blocks. Frozen policy,
workflow, three-distinct-execution threshold and required-main-review checks stay
unchanged. Original cache tests and nine additional profile/provenance/codec tests
pass in the final Node run. `node scripts/ci-invariant-workload.mjs` and
`python3 scripts/ci_invariant_oracle.py --check` also passed. Their qualification
cases are synthetic test fixtures, not trusted executions or performance results.

A final seven-suite fixture was encoded, ZIP-wrapped, decoded through the actual
artifact reader and checked against the staged Git source identities. All source
bindings and reconstructed HTML/copies passed. Expanded JSON was 1,448,813 bytes;
the deduplicated JSON was 229,528 bytes and ZIP 229,654 bytes, within the unchanged
wire/archive limits. Synthetic qualification reused seven groups, while an
unprotected-authority fixture reused zero. The fixture lacks real run/authority
metadata and cannot serve as a CI witness.

All seven source profiles have no dependency-analysis issues when supplied an
explicit test environment. Real CI still requires its pinned browser preflight.
GitHub reported main as unprotected during this audit, so live trusted reuse is
not activated. Protection settings, qualification workflow dispatches and Pages
deployment were not changed or triggered. All browser results above were freshly
executed. Packaged-input changes continue to invalidate every offline suite.

## CI correction after initial PR submission

The owner requested that the CI failures be fixed. The initial hosted Flight Lab,
ALIEN-MATH-006 and ALIEN-MATH-FINAL capsule jobs all rejected the changed
`AGENTS.md` source pin. Root policy is now restored byte-for-byte to reviewed
main; the new onboarding remains in README, the agent guide and catalogue.
The frozen manifest, verifier, proofs and workflow assertions remain unchanged.

Review also found that capsule reproduction imported new cache helpers absent
from its explicit source inventory. The capsule now includes those four helper/
profile files and three test files, and executes their tests during reproduction.
A new regression runs the browser-cache tests inside an authenticated extracted
capsule, so the developer checkout cannot conceal a missing packaged import.

Executed locally after these corrections:

- `node --test tests/*.test.js`: **977 passed, zero failed**.
- Capsule Python suite: **16 tests passed**, including extracted cache tests and
  identical offline builds from original and extracted fixture source.
- `python3 scripts/verify_alien_math_006.py --pins-only`: passed unchanged pins.
- Pinned Lean 4.35.0 verification with `--negative-controls`: passed all 21 model
  theorems, 856 finite observations and six negative controls. JavaScript
  refinement remains open; these results do not widen the formal claim.
- Source/documentation check: passed, with 399 local links, 97 imported sources
  and six workflows. Build/offline verification: passed, 776 files.
- `git diff --check`: passed.

These observations supplement the initial failure record above. Hosted results
for the correction are reported on PR #99's checks and PR description.

### Tutorial offline-startup CI correction

Hosted run `43806265994` passed the preceding browser interactions, including
tutorial download and Workbench import/Play, but timed out waiting for the
tutorial's reloaded tab to become service-worker controlled. The unchanged
editor suite subsequently passed locally; the hosted timeout was not reproduced
locally. Six other hosted workflows passed at commit `90eddb4`.

The tutorial check now opens a fresh tab in the same browser context after
worker activation, disables networking before navigation, and requires both a
service-worker response and a controlled document. It then executes the existing
offline lesson and restart assertions. This tests a new offline visit directly
without depending on the original tab's reload/control timing. No product code,
worker activation policy, test assertion or CI trust condition was removed.

After this correction, the packaged Chromium `editor` group passed, including
the fresh offline navigation, lesson interactions and Workbench import/Play.
All 977 Node tests passed again. Source/documentation checks, build, offline
verification and whitespace checks also passed. Hosted confirmation remains
recorded separately in PR #99's checks and description.

The next hosted run, `43807901679` at `e28a033`, still failed: the fresh offline
navigation returned `ERR_INTERNET_DISCONNECTED`. Inspection then established
the cause in pinned Playwright 1.64.0: `waitForFunction` treats the Promise
returned by an async predicate as truthy, ending its polling even if the Promise
resolves to false. A local minimal probe returned false in 16 ms for the async
predicate; the synchronous false control correctly timed out at 502 ms. Thus the
original activation check never established readiness, and the first correction
was insufficient.

The check now explicitly awaits `navigator.serviceWorker.ready` and activation
inside `page.evaluate`, with the same 45-second bound, timer/listener cleanup,
and exact scope/script checks. Fresh offline navigation and all subsequent
assertions remain. Local Chromium is 158.0.8127.18; hosted preflight reports
156.0.8078.4, both through Playwright 1.64.0. These are distinct environments,
and local success is not presented as hosted confirmation.

A local real-browser regression deliberately withheld `docs/ARCHITECTURE.md`
from the package server while its worker was installing. Release was scheduled
500 ms after the tutorial reached its readiness check. The old `e28a033` harness
returned early and attempted to switch offline while the response was still
withheld (expected negative-control failure). The corrected harness waited for
release and completed the full tutorial, Workbench import/Play and verified
offline lesson. This reproduced the defect locally and distinguished the fix
from the earlier timing-dependent passes. All 977 Node tests also passed after
the explicit readiness correction.
