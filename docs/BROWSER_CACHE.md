# Source-bound browser verification reuse

The browser cache reuses successful verification results only when their source,
package, harness, contract, policy and environment identities match. It does not
cache Node tests or replace the browser tooling preflight. The Playwright download
cache and trusted verification receipts are separate mechanisms.

## Current verified status and authority

On 19 November 2026, main run 44453001792 executed all seven suites and
reused zero. The source-bound policy already required **one** successful main
execution, but the unprotected-main guard blocked all receipt publication.
Worlds and editor additionally had misclassified exact import closures.

The owner-controlled **unprotected-main** mode now permits only GitHub's
completed-success **main** workflow executions, with immutable artifact ZIP
digest, exact run/attempt/commit metadata, independently verified Git source tree,
and identical source, harness, tests, package, policy and browser environment
fingerprints. A PR result, failed run, stale artifact, cache hit or reused-only
result cannot qualify. The first successful main run under the new policy seeds
the next identical run; earlier green runs lacking artifacts cannot be reused.

**Tradeoff:** unprotected main permits authorised direct pushes without required
review, a weaker trust boundary than protected main. Owners should enable required
PR reviews; once protection is enabled, the policy digest changes and qualification
must be re-earned under the stronger authority. No branch settings are changed
here.

The verified namespace audit inherits an exact reviewed source hash for generated
runtime copies only after the entire namespace is independently reproduced and
checked byte-for-byte. Literal browser imports inside Playwright's HORIZON page
and the dependency scanner's own regex are now explicitly classified.

## What remains mandatory

Every workflow still runs Node tests, source checks, the build, offline-package
verification, archived evidence checks and the real Chromium tooling preflight.
Only the seven browser-suite results are candidates for reuse: `home`, `render`,
`play`, `worlds`, `research`, `donor` and `editor`.

Every current suite consumes the service worker and therefore binds the **entire
packaged site**. A change anywhere in that package invalidates all seven groups.
This includes `docs/*.md` and `BUILD_A_GAME.md`, which ship as offline help. A
README-only change outside the package and other verification inputs can reuse
qualified results. This policy does not promise that editing one lab reruns only
that lab's suite.

Node, browser, runner image and other preflight environment changes also require
new matching executions. The loader examines the latest 30 successful main runs;
execution artifacts have 30-day retention. Expired, missing, ambiguous or
mismatching artifacts cannot provide qualification.

## Inspect a change locally

From the source root, build the current package and print its source profiles:

```sh
node scripts/build.js
node scripts/verify-offline.js
node scripts/browser-suite-cache.mjs plan > /tmp/vanillajs-browser-plan.json
```

`plan` reports each group's fingerprint, input records, dependency edges and
analysis issues. It does not run browser tests or establish GitHub authority.
Without the existing pinned preflight environment, local output reports that
missing prerequisite and cannot be treated as reusable verification evidence.

Unknown or changed executable closures, unclassified package files and unsupported
resource analysis force execution. An audit update must describe the actual
resources and bind their exact bytes; copying new hashes without reviewing the
changed code is not an audit. Preserve the frozen policy and evidence references.

The frozen [base policy](../scripts/browser-reuse-policy.json), its historical
three-run rule and its independent fixtures remain unchanged. The version 2
[live profile](../scripts/browser-cache-profile.json) explicitly selects one-run
qualification and records current
suite roots, harnesses, exact source hashes and reviewed resource mappings. Its
[strict loader](../scripts/browser-cache-profile.mjs) retains all existing suites,
whole-package worker coverage, source authentication and required-main-review
controls. The live policy and loader are fingerprinted inputs, so results from a
different policy cannot silently qualify. Historical tests still exercise the
original three-run policy; live-policy tests exercise one-run qualification.
The loader does not learn exceptions from passing tests or change GitHub
protection settings.

For a direct local run with the repository's existing external Playwright tooling,
use the normal packaged browser command:

```sh
node scripts/browser-check.js
```

This runs the real browser suites; it does not issue a trusted main receipt.
Do not silently install a browser or use an owner-only physical runner for PR code.

## CI decisions and manual override

The existing [Flight Lab workflow](../.github/workflows/flight-lab.yml) invokes
`scripts/browser-suite-cache.mjs execute` after the mandatory checks and preflight.
Its log reports `EXECUTE` or `REUSE` for each group, the reason, qualifying run IDs,
changed inputs and rejected receipt diagnostics. The `flight-lab-evidence`
artifact includes `plan.json` with the decision inputs; the workflow summary
reports actual execution separately from reuse.

When the `editor` group needs execution, the Tutorial Lab runs first, before the
longer labs. A tutorial regression therefore fails early; successful full runs
still execute every selected check.

To force all suites, the owner can manually run that workflow on reviewed `main`
with **full_browser = true**. The override ignores matching receipts. The existing
main workflow also deploys GitHub Pages after verification; dispatch is therefore
an owner-controlled operation, not a read-only inspection. No workflow is
triggered automatically by this guide.

Only actual successful executions on authenticated `main` (review-protected or the explicit lower-assurance owner-controlled fallback) can publish the
immutable `ci-invariant-main-<run>-<attempt>` artifact. A reuse result is not another
execution. PRs, forks, failed runs and local files cannot manufacture qualification.
Receipt authentication checks GitHub run metadata, archive digest and size,
source-tree identities and matching authority-mode controls. Actions cache entries
are never receipt authority.

The [receipt codec](../scripts/browser-receipt-codec.mjs) stores identical input
blocks once and restores the original full inputs before verification. It preserves
every execution fingerprint; deduplication does not create another successful run.
The limits remain 1 MiB for the artifact ZIP and 512 KiB for its JSON payload,
with an additional 4 MiB bound on expanded compact receipts. Unknown compact-envelope or result fields, changed blocks, missing references
and altered fingerprints are rejected.

## Generated package identities

Some packaged entry pages and runtime paths differ from their Git source paths.
The [package provenance helper](../scripts/browser-package-provenance.mjs) rebuilds
the six supported runtime namespaces in a temporary directory and compares their
complete generated inventory and bytes with `dist/`. Source files remain unchanged.

Receipt verification uses fixed source-path rules for those copies, checks the
original Git blobs and recomputes the namespace hashes. For rewritten HTML, it
fetches the original Git blob, verifies its identity and reconstructs only the
known entry-point substitutions. Generator and provenance-checker source files
are fingerprinted inputs too. Arbitrary aliases, extra metadata, unknown generated
namespaces and mismatched output bytes fail closed. The consumer does not execute
code supplied in an artifact.

The Workbench's broad runtime copy includes three dormant VOIDWARD application
files whose vendor imports are available only at the original game paths. Their
exact copied bytes and original dependency roots are bound explicitly; they are
not supported entry points inside the Workbench namespace. Changing an active
importer invalidates its audit and requires review before reuse.

## Troubleshooting decisions

| Diagnostic | Meaning and action |
| --- | --- |
| Unprotected main with authenticated GitHub branch identity | GitHub-successful main receipts can qualify under explicit lower-assurance owner mode. |
| Protected main without confirmed required PR approval | Reject reuse until review controls are established. |
| Qualification 0/1 | No authenticated successful main execution matches every input. |
| Unsupported dependency analysis | Inspect the listed source/resource; review and explicitly model it, or continue real execution. |
| Package inventory/digest mismatch | Rebuild from current source and investigate changed or stale package files. |
| Source tree does not bind receipt inputs | The artifact cannot prove the checked source/generated outputs; reject it. |
| Missing, expired or ambiguous execution artifact | No usable witness from that run; execute again. |
| Preflight environment missing or changed | Run the normal pinned preflight; a new environment needs new qualification. |
| Manual full-browser override | Expected: all seven suites execute regardless of cached results. |

See [Creator Gateway execution evidence](CREATOR_GATEWAY_VERIFICATION.md) for what
was actually run during this change. No physical RTX, controller or mobile-device
coverage follows from headless Chromium or a reused receipt.

## Multiple entry pages in one runtime package

HORIZON-002 explicitly packages `horizon-lab/index.html` and `drive.html` into one
content-derived native-module namespace. Both startup closures contribute to the
namespace digest. Only these named pages receive the rewrite; arbitrary HTML is
not discovered or trusted automatically.

Package-source metadata is now `qsol.browser.package-provenance.v2`: each package
contains an ordered `html` array of original Git-bound page records. Authentication
reconstructs every entry rewrite and checks all copied module bytes. Missing,
forged, duplicated or extra pages fail closed. v1 metadata cannot prove the new
two-page package and therefore causes execution, not reuse. This tooling-only
schema change does not migrate game/project formats or alter historical receipts.
The reviewed-main authority, one-execution qualification, manual override and
frozen base policy remain unchanged.

HORIZON-003 extends the explicit page inventory to four URLs. The primary
`horizon-lab/index.html` and compatible `race.html` entry both use `race-start.js`;
`scenery.html` preserves the original visual workshop through `start.js`, and
`drive.html` retains `drive-start.js`. All four source-bound HTML rewrites are
authenticated against the same complete module namespace. The additional page
does not grant trust to arbitrary HTML or relax witness qualification.
