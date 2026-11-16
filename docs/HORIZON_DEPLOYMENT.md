# HORIZON deployment diagnosis

PR #108 merged the playable Racing Foundry at
`demos/horizon-lab/index.html`. The scenery workshop remains available at
`demos/horizon-lab/scenery.html`; its camera-tour button intentionally orbits a
parked car. `race.html` remains a compatible racing entry point.

## Why the public URL still showed the scenery workshop

Main source: `54634ba45d4205d2afcf0c40c61fb9bff0312a86`.
The [post-merge verification job](https://github.com/QSOLKCB/VANILLAJS/actions/runs/43943875751/job/133568221094)
started on 2026-11-16 at 19:52:35 UTC and was cancelled at 20:12:47 UTC,
at the workflow's 20-minute job limit. Its browser checks reported:

- 19:57:07: canonical-index car movement, actual keyboard course completion,
  checkpoints, finish, editing, input recovery and offline startup passed.
- 19:59:08: the exported race's full keyboard route, nested offline play and
  tampered-install rejection passed.
- 20:00:05: the remaining HORIZON driving, scenery and older-worker checks had
  also passed.
- 20:12:02: Soundtrack Lab passed. Cancellation then interrupted the remaining
  browser work; the whole verification run did **not** pass.

The Pages artifact staging and deployment were skipped. Fresh HTTP requests
(including a query URL with `Cache-Control: no-cache`) and Chromium with service workers blocked
both returned the old **Coastline Atelier** from the public server. Its
`Last-Modified` was 2026-11-16 18:11:20 UTC, before the merge. Clicking its camera
tour reproduced the stationary-car symptom. This establishes an outdated server
deployment independently of any saved browser cache.

The hosted verification job now has a bounded 35-minute allowance for the complete
cold run. Each imported browser check logs START, PASS or FAIL with elapsed time;
exceptions still fail the process. This provides headroom and diagnostics, not
a claimed speed improvement. Every existing test, source-bound receipt rule,
main-only deployment condition and success dependency remains required. The
failed run reported unprotected-main authority and executed all seven suites;
no new reusable witness or weaker cache policy is implied by this correction.

The formal source audit also pins the historical hosted workflow. It now accepts
only this exact timeout/comment substitution and the historical-source preparation
below against the original Git blob and its independently checked SHA-256.
Negative controls reject any other command,
action, permission, branch-condition or budget change. Mathematical sources,
proofs, fixtures and archived execution evidence remain unchanged.

## PR #109 shallow-checkout correction

[Run 43958284878](https://github.com/QSOLKCB/VANILLAJS/actions/runs/43958284878)
failed one of 1,171 Node tests before reaching Chromium. Checkout fetched only the
PR merge commit (`fetch-depth: 1`), so the new historical admission test could not
read the older baseline. The file was not missing from the historical revision.

A disposable depth-one checkout reproduced the same Git error. Fetching only
`ce7e38eb3c7412407a3ba2bc472120b589e6eb9e` with `--no-tags --depth=1` restored the
admission tests while preserving HEAD and the shallow history boundary. The
workflow now performs that exact fetch immediately after checkout and runs
`python3 scripts/verify_alien_math_006.py --pins-only` before the Node suite.
That verifies the current source manifest and historical source bytes; it does
not claim to execute Lean proofs.

Historical workflow Git blob: `544edab10a462991540b6192acf21b244e75bd42`.
Historical workflow SHA-256:
`dee8b35061e6768a76aad700e30486f1d13a4cfcfcdaaef16f1dcf5ef7f0f4b9`.
The audit still reads the immutable baseline rather than HEAD. A small local Git
fixture tests missing history, exact shallow fetch, wrong/changed historical
source, and unchanged HEAD/history depth without a network dependency. Exact
workflow admission also rejects an omitted, altered or misplaced preparation
step. Only the active workflow/verifier/test manifest hashes are regenerated;
frozen proofs, fixtures and execution records are retained.

## Checking the deployment

After the owner merges the repair, wait for **Flight Lab checks and Pages** on
that main commit to finish both verification and deployment. A merged PR alone
does not establish that the public site changed.

Open [the canonical lab](https://qsolkcb.github.io/VANILLAJS/demos/horizon-lab/index.html)
in a fresh private window. It should show **Racing Foundry**, not **Coastline
Atelier**. Start the race, wait for the countdown, focus the driving canvas and
hold W or the on-screen throttle. Confirm speed, road progress and checkpoint
changes, rather than camera motion alone.

Existing offline sessions intentionally keep a coherent, verified package. Once
the replacement service worker has finished installing, close **all** VANILLAJS
tabs, then reopen. Refresh alone need not activate a waiting worker. There is no
fixed installation-time guarantee; clearing saved site data is not the first
remedy. If a fresh private window still receives the old title, inspect the
main deployment before troubleshooting local caches.

No feature-branch deployment, release, tag, engine change or service-worker
integrity change is part of this repair. Local validation and candidate identities
are recorded separately from the failed hosted run and the eventual deployment.
