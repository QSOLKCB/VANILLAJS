# QFLOAT-001 — VANILLAJS integer facade and ARCADE browser witness

## Architecture

VANILLAJS now has a first-party native ES-module QFloat authoring API:
modules/qfloat/index.js. It imports the existing checked
modules/integer-math/index.js and NEVER replaces the authoritative
Q16.16 engine. The API accepts canonical decimal strings, performs exact
BigInt rational-to-Q16.16 quantization with truncation toward zero, and
exposes immutable typed scalar/point conveniences.

Only explicit number/approx() results are presentation floats.
Implicit numeric coercion is forbidden. This is an ergonomic interface,
not a faster numeric kernel or hardware decimal floating point.

For example, 0.1 plus 0.2 yields raw 19660, exact decimal
0.2999877929687500, and an intentionally rounded 0.300 display.

## QFLOAT-RUNNER-001 — existing VANILLAJS desktop runner

The owner workstation is registered to the QSOLKCB/VANILLAJS GitHub
repository, not the ARCADE repository. The original ARCADE workflow
could not get this runner. The new VANILLAJS workflow tests the actual
ARCADE QFloat Lab page instead:

https://qsolkcb.github.io/ARCADE/arcade3/qfloat-lab.html

It is .github/workflows/rtx5060ti-qfloat.yml and runs ONLY by an
explicit owner workflow_dispatch on reviewed VANILLAJS main.
There are no push, pull request or scheduled triggers on the workstation.

### Run after merging the VANILLAJS PR

1. Confirm the VANILLAJS PR CI passed and merge it into main.
2. From your logged-in graphical Ubuntu desktop, start the existing
   ~/actions-runner/run.sh, if it is not already running. Keep the
   runner registered to VANILLAJS.
3. Open the VANILLAJS GitHub Actions tab, choose
   QFLOAT-001 — ARCADE Lab browser witness on VANILLAJS runner,
   and Run workflow on main.
4. Enable acknowledge_local_execution.
5. Optionally enable publish_evidence to upload screenshots and report
   as a short-lived GitHub artifact. Otherwise they remain local.
6. Inspect the job summary and the local source-bound evidence at
   $HOME/.local/state/qsol/vanillajs/qfloat/qfloat-RUN_ID-ATTEMPT.

The workflow uses the qsol-rtx5060ti runner label, native Chrome/Chromium
and the existing preinstalled Playwright 1.64.0 via
scripts/rtx-playwright.mjs. It installs nothing and retains no GitHub
checkout credentials.

### Source integrity and workstation safety

The browser test is pinned to ARCADE PR #16 merge commit:

f29b780734a50171d55ae2f770930db8a487b31c

It separately fetches the six executable HTML/CSS/JavaScript assets
from that immutable commit and the deployed Pages URL. Any byte
mismatch aborts before opening Chromium. When they match, Chromium
receives only the already-verified executable bytes via Playwright
request routing under the Pages origin. No extra scripts, CDNs,
unexpected requests or service workers may execute.

Future intentional ARCADE code changes require a reviewed update
to the pinned ARCADE source commit in VANILLAJS. This is not a
floating, implicitly trusted Pages test.

The real-headed browser checks:
- Canvas2D illuminated object pixel is actually rendered.
- Decimal witness: 0.1 + 0.2, raw 19660, exact
  0.2999877929687500 and displayed 0.300.
- Lost-keyup focus loss while initially paused.
- Keyboard movement of exactly 81920 Q16 raw units in one tick.
- Concurrent right-key aliases remain held independently.
- Fixed-tick progression and pause freeze.
- Invalid speed and malformed decimal input rejection.
- 390px responsive display without horizontal overflow.

The local report includes SHA-256 hashes of the six source assets,
VANILLAJS HEAD, ARCADE pinned commit, runner/CPU/Node/browser identity,
checks, screenshots, and a SHA256SUMS manifest. Cleanup failure produces
a FAIL report and nonzero process exit status.

## Local test commands

    node --test tests/qfloat.test.js tests/qfloat-arcade-witness.test.js
    node scripts/check.js
    node scripts/build.js

Complete existing Node tests also run in hosted VANILLAJS CI. The
owner-run desktop browser check has not executed just because hosted CI
is green.

## Preservation boundaries

- VANILLAJS authoritative Q16.16 math remains unchanged.
- Formal proof and exact replay artifacts remain untouched.
- No unrelated self-hosted workflow was weakened.
- No Docker, npm runtime installation or external runtime dependency.
- Existing ARCADE Pages publication remains independent; no redeploy
  of ARCADE is implied by merging this VANILLAJS change.
- No automatic merge or tag.

QSOL-IMC — Make amazing alien tech and put it under Apache-2.0.
