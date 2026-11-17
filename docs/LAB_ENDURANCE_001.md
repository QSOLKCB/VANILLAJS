# LAB-ENDURANCE-001 — 1,000 headless Playwright cycles per lab

## Purpose

Independent GitHub Actions endurance gate for the game and creator labs.
Every PR and reviewed-main push runs four parallel groups against the
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

**Total: 8,000 separately counted browser cycles** if all four groups
finish, spread across four independently verified jobs. Never report 8,000
when one job fails, is cancelled or completes only partially.

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
- Exact 1,000 PR cycles are hard-coded in the workflow. Manual local
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
Results are uploaded even when an execution fails.

The digest establishes reproducible iteration inputs/observations in the
same environment; it is **not a claim of byte-identical GPU screenshots**
across drivers/OS releases. Results from different runner versions must
be compared cautiously. No stale run or old authenticated browser receipt
can bypass this separate endurance job.

### Local invocation

The full runner needs the existing pinned Playwright installation
available to Node (e.g. via isolated `NODE_PATH`) and a built `dist/`.

```sh
node --test tests/lab-endurance-plan.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/lab-endurance.mjs --group=racing --iterations=1000 --seed=7337
```

The CI `workflow_dispatch` button supports a different seed; PR and
main-branch runs use the reviewed default.

**No tests are considered green until the actual hosted checks pass.**
The workflow does not merge, tag, release or deploy.
