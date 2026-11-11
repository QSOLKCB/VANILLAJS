# CI-INVARIANT-001 — verified browser reuse

Only the seven packaged Chromium suites can reuse execution evidence. Every
applicable run still executes all Node tests, source checks, the build, independent
offline package verification, archival audits, CPU reference workloads, invariant
negative controls, independent fixture reproduction and real pinned Chromium
preflight. No mathematical oracle execution is cached by this system.

## Current trust gate

Read-only GitHub audit on 2026-11-11, base
`b9e9b1951c71ba53a132b061de09888ef712f2f8`:

- `GET /repos/QSOLKCB/VANILLAJS/branches/main`: `protected: false`.
- `GET /repos/QSOLKCB/VANILLAJS/branches/main/protection`: 404, branch not protected.
- `GET /repos/QSOLKCB/VANILLAJS/rules/branches/main`: empty list.
- Repository/inherited ruleset listing: only active tag ruleset 26862681,
  `Protect qfloat-001-research.1`, targeting that immutable release tag.

**Current main cannot supply reusable trusted receipts.** This implementation
runs Chromium and does not publish qualifying execution artifacts when it cannot
establish main protection with at least one required approving PR review. A 401,
403, missing token, unavailable controls API, missing artifacts or corrupt archive
is an ordinary fail-closed execution path. No branch settings were changed.
Owner-authorized protection configuration and three qualifying future main runs
are outstanding operational prerequisites, not evidence this PR claims to have.

The old `protected-main-only` string did not establish protection. Old v2 cache
receipts are deliberately not accepted or migrated.

## Auditable dependency model

`scripts/browser-reuse-policy.json` declares suite directories, cross-consumers,
known runtime/test entrypoints, mathematical contracts, shared verifier files and
audited source hashes. `browser-dependencies.mjs` computes the closure and a
canonical SHA-256 identity. The packaged manifest's membership, byte sizes and
hashes are checked against actual files before planning.

| Suite | Runtime scope |
| --- | --- |
| home | Flight Lab + homepage + full worker package |
| render | Integer Foundry/Vault and explicit API test roots + homepage + full worker package |
| play | Interaction/FPS + homepage/flight navigation + full worker package |
| worlds | RTS/2D directory roots and transitive runtime imports (16 members at this base) |
| research | OMI/Ancient Machine + homepage + full worker package |
| donor | Bullet Time/ARCADE/shared/GPU/Space **and editor** + full worker package |
| editor | Editor **and donor** directories + full worker package |

The audit found that render, play and research also visit the homepage, which
registers a service worker. They now conservatively bind its entire generated
precache inventory. Existing home/donor/editor worker policies remain in force.
A newly packaged standalone math module therefore invalidates these six suites,
but not the genuinely independent worlds closure. No worker behaviour or browser
test is disabled to manufacture a cache hit.

Directory ownership is not consumption independence. Donor tests open the editor
and generated player; GPU Lab imports its viewport; editor imports GPU controls.
Both sides are included even if the worker hash does not change.

Literal ES imports, re-exports and literal dynamic imports are traversed through
modules, APIs and experiments. HTML script/link/image resources and CSS URL/import
resources are resolved relative to their owners. Opaque browser test imports and
the generated player HTML have explicit, SHA-256-pinned roots; changed opaque
code cannot reuse its old analysis. The offline registrar and generated worker
are bound to the complete package plus the audited worker template.

The recognizer is intentionally **not a general ECMAScript parser or proof**.
Computed imports, escapes in specifiers, unknown modules, external specifiers,
unsupported HTML execution, dynamic code/resource constructors, unclassified
package/browser files, missing files and analysis limits force execution. Known
reachable executable and harness bytes must match the reviewed closure audit
hashes before they can qualify. This extra gate prevents unsupported language
features from silently qualifying after three tests. Updating those audit entries
requires source/dependency review; tests never automatically bless them. New,
unreachable authoring modules need no runtime audit entry until consumed.

Every identity binds:

- Exact reachable runtime bytes and paths; full inventory for worker consumers.
- Relevant MODULES descriptors, package version, identity/schema version and
  the closure policy. New unrelated catalogue entries do not affect worlds.
- Shared dispatcher, workflow, build/package verifier, preflight, receipt verifier,
  analyzer and invariant fixture/oracle implementation.
- Suite browser scripts and their static helper/reference imports, including OMI
  and renderer references previously absent from the old suite-script list.
- Reachable ALIEN MATH/QFLOAT contract documentation and applicable independent
  oracle code plus frozen fixture/domain identity. These are not blanket-excluded
  as “authoring”; the Space Lab currently consumes exact mathematics.
- Actual preflight Playwright/Chromium versions, browser manifest SHA-256, Node,
  OS/architecture, runner image, rendering mode, timezone and configuration.

## Qualification and authoritative provenance

Three **distinct successful main run IDs**, each actually executing the same
suite identity, are required. A retried attempt is not a fourth run; a reused
result never becomes a new execution. Publication includes only suites really
executed successfully with no unresolved analysis issues. PR/local runs cannot
publish qualifying receipts. The selected Chromium run must finish successfully
before the local receipt is atomically written.

The immutable v4 artifact is named `ci-invariant-main-RUN_ID-ATTEMPT` and contains
one `execution.json`. It is produced on main only after successful required gates.
The consumer independently checks:

1. Current main protection and required PR-review rules via GitHub APIs.
2. Successful completed push/manual main runs of the exact repository/workflow.
3. Artifact identity and workflow-run binding from GitHub, not from restored JSON.
4. API-provided SHA-256 of the downloaded ZIP, bounded size, exactly one expected
   archive member and valid JSON. Extraction uses Python stdlib in memory; it
   never writes archive paths to the filesystem.
5. Receipt/run/attempt/commit/event/repository/workflow agreement and unchanged
   observed approval-controls digest.
6. Canonical SHA-256 of the full suite identity and Git blob bindings against the
   independently fetched GitHub commit tree for runtime, tests, requirements and
   verifier source. Generated worker/.nojekyll outputs are instead bound by the
   verified build/worker producer and full input inventory.
7. Three unique matching execution IDs, never self-asserted qualification counts.

Only the latest 30 successful main workflow runs are searched; artifacts retain
for 30 days. Missing/expired evidence, truncated source trees, API errors and
unsupported archives trigger real execution. These limits bound lookup cost;
they can cause later requalification. A miss never reduces the threshold.

No `actions/cache/restore` or `actions/cache/save` is used for browser witnesses.
A PR may have a cache entry with the same key in its merge-ref scope; therefore a
restored filename or cache-hit flag cannot prove main provenance. Reading main
execution artifacts directly removes that shadowing path. The separate pinned
Playwright tooling cache remains, with its real launch preflight always required.

GitHub is the authoritative identity/metadata service, not a mathematical oracle.
Repository administrators, protection bypass actors, GitHub infrastructure and
the hosted execution environment remain trust principals. The API audit observes
current rules; it is not a cryptographic history of human review. Source bindings
and the exact producer workflow constrain what an old artifact can claim, but do
not constitute formal JavaScript refinement, hardware attestation or an assurance
against a malicious GitHub administrator. An isolated CI checkout/build with no
concurrent source writers is required; an actively edited local tree is not a
trusted receipt producer.

References: [GitHub cache scope](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching),
[artifact metadata and digest API](https://docs.github.com/en/rest/actions/artifacts),
[artifact digest validation](https://github.blog/changelog/2025-03-18-github-actions-now-supports-a-digest-for-validating-your-artifacts-at-runtime/).

## Diagnostics and reproduction

Each suite prints EXECUTE/REUSE, the exact gate reason, qualification IDs and
changed identity fields/paths where prior authenticated inputs exist. The
`flight-lab-evidence` artifact includes `plan.json`, profiles, dependency edges,
analysis issues, rejected-artifact diagnostics and package membership. There is
no implied GPU evidence in a reuse decision.

Run from the repository root:

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
uv run --no-project python scripts/ci_invariant_oracle.py --check
node scripts/ci-invariant-workload.mjs
```

For real browser checks, use the workflow's isolated Playwright 1.64.0 tooling,
set RUNNER_TEMP/NODE_PATH/PLAYWRIGHT_BROWSERS_PATH as the workflow does, run
`node scripts/flight-browser-preflight.mjs`, then
`node scripts/browser-suite-cache.mjs execute`. Without verified authority this
is the normal cold path and executes all seven suites.

Manual workflow_dispatch `full_browser=true` always executes all seven, including
qualified suites. A test/oracle/contract/source change must establish a new
identity; matching expected numerical output alone never admits reuse.

## Measured decision counts and independent fixture

The workload script runs the source-pinned `b9e9b19` baseline fingerprint functions
and the new planner against the actual packaged input set. Qualified registry
entries in this experiment are **test fixtures**, not authenticated GitHub runs.

| Scenario | Baseline executed/reused | New executed/reused |
| --- | --- | --- |
| Identical qualified inputs | 0 / 7 | 0 / 7 |
| Unrelated unshipped documentation | 0 / 7 | 0 / 7 |
| New genuinely unreachable math module | 7 / 0 | 6 / 1 |
| Reachable navigation change | 7 / 0 | 7 / 0 |
| Worlds browser requirement change | 1 / 6 | 1 / 6 |
| Independent ALIEN oracle/domain change | 0 / 7 (old identity omission) | 6 / 1 |

The oracle row repairs a safety gap; the old reuse count was not an optimization
benefit. No elapsed-time savings are claimed. On the current unprotected main,
production-authority decisions remain **7 executed / 0 reused**. The local real
cold run also executed all seven successfully, with no GitHub token or trusted
receipt publication. Six scopes bind 121 packaged files; worlds binds 16.

The independent Python stdlib fixture computes finite graph closures and unique
run qualification from frozen input, independently of the JS traversal algorithm.
It is not an independent general JS parser or a proof of GitHub provenance.

- Input SHA-256: `2598eaacbc4caf37af28afa8a183fadec31c473f15a48e2a78aa44c118718dab`
- Expected fixture SHA-256: `285e8aee6e447c0c4be5da298b83856735bf4d7334444f6b2fb37ffd0c320ddf`

Tests cover matrix A–M: qualified identical reuse, docs/unreachable source,
reachable code, oracle/contract/domain changes, unknown dependencies, harness
changes, environments, corruption/missing artifacts/forgeries, PR rejection,
duplicate runs, full override, and cross-suite/worker dependencies.
