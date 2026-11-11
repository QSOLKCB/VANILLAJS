# VANILLAJS — incremental packaged-browser CI

**Goal:** reuse byte-identical Chromium test work across PRs and merges,
without ever skipping verification of changed or unknown source.

This is not a blind "the tests passed last week" shortcut.

## Checks that always run

Every Flight Lab PR or push still executes its frozen RTX receipt audits,
Python and Node regression suites, source validation, CPU reference-parity
workloads, a fresh dist build, independent package membership and SHA-256
verification, and a real pinned Chromium launch preflight.

Only source-identical, previously successful, **reviewed-main browser-scope
PASS witnesses** are reusable. Browser tooling is cached separately.

## Seven browser suites

| Name | Checks |
| --- | --- |
| home | Flight Lab controls, geometry pixels, mobile, no-WebGL refusal |
| render | Integer Foundry, optimized renderer, WebGL API, FrameGate, Vault |
| play | Interaction Lab, FPS, motion, platforms |
| worlds | RTS, flow fields, 2D Foundry |
| research | OMI Lab, Ancient Machine |
| donor | Bullet Time, ARCADE, GPU/WASM Lab, Space Lab and offline navigation |
| editor | Visual Editor, scene import/export, components and gizmo drag |

The original full run remains the default:

    node scripts/browser-check.js

Developers can opt into a single group for local debugging:

    node scripts/browser-check.js --suites=editor

No Playwright dependency is added to the shipped game runtime.

## Content-based closure

A suite fingerprint uses SHA-256 of the independently verified built-package
inventory, its own browser witness scripts and common source dependencies.
The shared closure includes runtime modules, APIs, offline registrar,
packaging logic, test dispatcher and verified worker inputs, as relevant.

The fingerprint is also bound to Node version, OS and architecture, hosted
runner image version and pinned Playwright tooling identity, plus this
workflow source. Changes to shared or unknown runtime paths invalidate
the affected suites, typically all seven when a shared dependency changes.

A new editor source may require the editor, homepage and offline donor
suites because the generated service worker binds the entire published
asset inventory. This is intentional conservative invalidation.
Other unrelated suites may reuse exact evidence.

## Trust boundary

GitHub Actions restores a cache only with the exact source fingerprint.
The v2 cache must contain a bounded regular PASS receipt with matching
suite, fingerprint and protected-main provenance. A cache miss, corrupt
receipt or changed fingerprint forces a fresh Chromium execution.

Only successful push or manual-dispatch runs on reviewed main publish receipts.
Each partial receipt contains one, two or three distinct numeric GitHub run IDs.
Reused runs never add a pass. PR and local executions do not contribute maturity.
A partial receipt forces real execution; only three passes authorize reuse.
Three passes are a policy threshold, not a proof against future browser defects.

Actions caches are immutable: each publication key ends in the run ID, while
restore uses only the exact fingerprint prefix. No broad fallback prefix is
permitted. The newest valid receipt carries prior executions forward; a missing,
evicted, malformed, duplicate-run or old-v1 receipt starts fresh. The save steps
run only for suites actually executed successfully on main, so reuse does not
continually publish duplicate cache generations. Mature receipts stay at three.
The receipt is parsed into an owned snapshot and atomically replaced after the
complete selected browser run succeeds. A failed run publishes no new passes.
Trust comes from the reviewed workflow and GitHub branch-scoped cache isolation,
not the self-described provenance string. PR caches cannot promote main evidence.
CI uses its isolated checkout/package snapshot with no concurrent source writers;
this mechanism does not claim mutation-safe reuse in an actively edited local tree.
Pull requests may **read** main evidence but never publish their own
trusted cache witnesses.

On first use, no keys exist: initial PR and first merged main run will
execute all suites to seed green main evidence. Later unchanged scopes
can be reused only after three distinct successful main executions of that exact fingerprint. A retry of the same GitHub run does not add a pass.

Every job summary distinguishes **executed** suites from **reused**
suites. Neither is presented as new GPU evidence. Cache entries are
not suitable for source-altered projects or other browsers.

## Manual full audit

The Flight Lab workflow_dispatch input named full_browser ignores all
previous browser witnesses and executes all seven suites. This is
recommended before critical releases and periodically as an independent
browser-environment audit.

No source working trees, build outputs, binary evidence, credentials or
GPU results are ever cached by this new source-witness mechanism. The
package integrity verifier and all unit tests still execute on every run.

**QSOL-IMC — Make amazing alien tech and put it under an Apache 2.0 license.**

## How to inspect or invalidate reuse

Read the job summary: `Executed on current source` is fresh verification;
`Reused three protected-main executions` is inherited evidence. Download the
`flight-lab-evidence` artifact to inspect suite fingerprints and the three run
IDs. New source, test, dependency, workflow, Node/browser or runner-image inputs
create a new identity and restart qualification. Shared or unknown inputs still
fail closed. To force every suite now, use workflow_dispatch with `full_browser`
checked; this does not remove the normal unit/package/archive checks.

No three redundant executions are launched inside a single job merely to fill
the cache. Qualification accumulates across normal main runs; cache eviction or
runner-image updates may require requalification.
