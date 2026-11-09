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
| donor | Bullet Time, ARCADE and offline navigation |
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
The cache must contain a bounded regular PASS receipt with matching
suite, fingerprint and protected-main provenance. A cache miss, corrupt
receipt or changed fingerprint forces a fresh Chromium execution.

Only runs on the reviewed main branch publish new reusable receipts.
Pull requests may **read** main evidence but never publish their own
trusted cache witnesses.

On first use, no keys exist: initial PR and first merged main run will
execute all suites to seed green main evidence. Later unchanged scopes
can be reused after one successful main run.

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
