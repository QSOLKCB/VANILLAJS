# LAB-ENDURANCE-001 — 1,000 headless Playwright cycles per lab

## Purpose

Independent GitHub Actions endurance gate for the game and creator labs.
Every PR and main push verifies four parallel groups against the
**actual built `dist/` package served at `/VANILLAJS/`** in headless
Chromium/SwiftShader. The existing Flight Lab formal, offline, browser
suite-cache and main-only Pages deployment workflows are not changed.

This is **1,000 executed, state-changing browser integration cycles for
each selected lab**, not 1,000 complete 509 m races, FPS matches,
60-second soundtracks or a claim of hardware GPU testing. Those expensive
end-to-end scenarios remain in the original browser suite; endurance
complements them by repeatedly starting, pausing, resetting and changing
valid data while observing actual application state.

| Matrix group | Lab A | Lab B | Repetitions |
|---|---|---|---|
| racing | HORIZON Racing Foundry | Racing Lab (all 7 modes across samples) | 1,000 each |
| combat | Block Arena Foundry | Weapon Feel Lab | 1,000 each |
| creator | Sprite Foundry | Game Maker Lab | 1,000 each |
| visual | Narrative Foundry | Demoscene Foundry | 1,000 each |

**Total: 8,000 separately counted browser cycles** when all four groups
execute and finish. An unchanged group may reuse an authenticated complete
main execution as described below. Reused groups report **zero new cycles**.
Never report 8,000 new cycles when a group reuses evidence, fails, is
cancelled or completes only partially.

## Real observations

- HORIZON performs a genuine 4.3-second virtual-clock driving sample
  with keyboard throttle, then 1,000 restart/start/pause state
  transitions; the optional course-assist toggle is checked repeatedly.
- Racing Lab performs a real accelerating drive, then 1,000 start/pause
  cycles. Mode selection walks the seven original racing modes.
- Block Arena and Weapon Feel execute actual match/range ticks and
  repeatedly exercise game start/pause, with periodic full reset.
- Sprite Foundry generates 1,000 deterministic seed-derived sprites
  and checks the accepted recipe and pixel frames each time.
- Game Maker runs a real gameplay tick sample, then 1,000 game
  restart/play/pause transitions with periodic authored sprite seed changes.
- Narrative Foundry plays a real choice from arrival to a validated
  terminal ending in every one of 1,000 cycles, restarting each time.
- Demoscene Foundry seeks to 1,000 sample-indexed cue positions and
  checks exact transport state, with repeated graphics-profile changes.

Rendering happens through each lab's native browser frontend. The
harness does not fabricate a successful game state by writing world
positions, checkpoint indices or simulation results.

## Runner and security boundaries

- `.github/workflows/lab-endurance.yml` has **no Pages write permission**
  and no deployment job. A PR cannot publish production pages.
- Uses pinned Playwright **1.64.0** outside the repository and isolated
  Chromium headless shell with the existing Flight browser preflight.
  Runtime games gain **no npm/Node/CDN/cloud dependencies**.
- `node scripts/check.js`, `node scripts/build.js`,
  `node scripts/verify-offline.js` execute before endurance.
- The static server binds **127.0.0.1** and serves only built files under
  `/VANILLAJS/`; contexts block service workers and non-local requests
  so the test isn't accidentally served old or remote content.
- Exact 1,000 cycles for fresh executions are hard-coded in the workflow. Manual local
  debugging may use smaller `--iterations`; accepted bounds are 1..1000.
  The seed is a recorded uint32, default **7337**, with an explicit
  manual-dispatch override.
- Browser crashes, JavaScript page exceptions, rejected state
  transitions and partial counts fail the job. No retries or
  forced PASS status. `fail-fast: false` lets all groups preserve evidence.
- CI tests the CLI plan's group inventory, seed reproducibility, invalid
  arguments and iteration count. A novel lab must be added explicitly
  to the reviewed registry, not discovered through executable imports.

## Evidence

Each matrix job records `browser-artifacts/lab-endurance/GROUP.json`:
exact lab names, required/completed iteration counts, deterministic
seed and per-iteration rolling SHA-256, package manifest SHA-256,
observed Chromium version, first/last samples, elapsed wall time and
PASS/FAIL. On failure, report the first failing lab and iteration,
a bounded error trace and a screenshot if browser capture is possible.
Results are uploaded even when an execution fails. Each lab also records
mandatory synchronous canvas/WebGL pixel probes at the first and last
accepted cycle. Playwright PNG screenshots are **best-effort** supporting
artifacts: a virtual-clock pause can prevent a compositor screenshot even
when the lab state and canvas remain responsive. Such a timeout is
recorded, and a fresh page-liveness check is required before continuing;
a failed pixel probe or unresponsive page still fails the entire job.

The digest establishes reproducible iteration inputs/observations in the
same environment; it is **not a claim of byte-identical GPU screenshots**
across drivers/OS releases. Results from different runner versions must
be compared cautiously. The separate Flight Lab suite receipts do not
qualify as endurance evidence.

## Exact endurance result reuse

Following OPT-INV-001, `scripts/lab-endurance-cache.mjs` reuses a complete
observation only when its inputs exactly match. The fingerprint covers the
entire freshly built and byte-verified package manifest, the endurance
harness and its local imports, workflow, group/lab inventory, seed, 1,000
required cycles, Node, Playwright, Chromium, browser manifest, runner image,
platform, architecture and rendering environment. Even an unrelated packaged
file change invalidates this conservative first version; it does not guess
which dynamically loaded assets matter.

The source is an immutable, SHA-256-verified Actions artifact from a successful
`main` run of this workflow. GitHub must tie that exact main commit to a merged
PR targeting this repository's `main`; its Git tree must also match the
recorded harness bytes. This owner-selected trust rule does not require branch
protection and does not change the separate Flight Lab cache's protection rule.
Direct pushes without a matching merged PR, PR executions, incomplete lab
counts, missing pixel probes, different input hashes, expired artifacts and
unavailable authentication all fall back to real browser execution.

The cache retains the full per-lab SHA-256 values and bounded report, not the
12-character progress-log prefixes. A `500/1000` hash is partial evidence and
can never qualify. A reused result is recorded as `GROUP-reuse.json` with
`executed: false`, the original report, artifact ID, merged PR and run link.
Reuse never publishes a new execution witness. Fresh main executions publish
separate artifacts retained for 90 days; the consumer searches the latest 30
successful main runs. Expiry or absence causes a fresh run.

Inventory tests, package checks/build/verification and the real Chromium
preflight still run on every job. Select **full_run** under `workflow_dispatch`
to bypass result reuse. The first eligible main execution after this change
populates the cache; older reports and the current PR's results are not
retroactively promoted into main evidence.

### Local invocation

The full runner needs the existing pinned Playwright installation
available to Node (e.g. via isolated `NODE_PATH`) and a built `dist/`.

```sh
node --test tests/lab-endurance-plan.test.js tests/lab-endurance-cache.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/lab-endurance.mjs --group=racing --iterations=1000 --seed=7337
```

The CI `workflow_dispatch` button supports a different seed and a forced full
run; PR and main-branch runs use the reviewed default seed.

**No tests are considered green until the actual hosted checks pass.**
The workflow does not merge, tag, release or deploy.
