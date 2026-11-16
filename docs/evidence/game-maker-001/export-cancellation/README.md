# Export cancellation correction — PR #103

Tested source: `63fc732ee3e103dffaf1a9d5d8f50401b8da65c9`; preceding PR head: `ab0510d053f1c3140001e748e453f7a186c4f4c1`.
The following evidence-only commit adds this record without changing the tested
runtime/harness. The [original milestone evidence](../README.md) is preserved.

Restart or a failed import could invalidate a pending ZIP export but leave its
button disabled. Export activity now has explicit ownership. All invalidation
paths clear that ownership and restore eligibility immediately; refresh respects
an active export. Stale success, failure and cleanup cannot alter a newer export.
Cancellation also replaces the stale preparing status. Incomplete projects remain
ineligible. Package formats, gameplay, runtime export bytes and authority rules
are unchanged; only the editor app and its source-derived package namespace change.

## Executed verification

- The new deterministic browser test **failed on the previous packaged app** at
  the exact Restart/retry assertion: [reproduction](reproduction.log).
- After the fix, all export race cases passed. An intermediate run then failed
  only because the new test cleanup used `hero` instead of the existing `player`
  option value; that selector was corrected: [attempt](test-cleanup-failure.log).
- **1,060 Node tests passed**, zero failures/skips: [raw TAP, gzip](node.tap.gz).
- Source/documentation/provenance checks passed: [log](source-check.log).
- Build and offline verification passed: [build](build.log), [offline](offline.json),
  [exact final manifest](package-manifest.json).
- **Complete packaged `editor` Chromium group passed**: [browser log](browser.log).
  The regression holds the first native hash, uses actual controls, releases old
  success/failure in controlled order and observes real downloads. It covers
  Restart/retry, rejected-import/retry, stale completion during/after a newer
  export, palette refresh while busy and incomplete-project cancellation. All
  existing Game Maker gameplay/export/offline and other editor workflows passed.
- **27 cache/profile/provenance/receipt tests passed**: [TAP](cache-tests.tap).
  All seven source closures have zero issues, explicitly local/untrusted:
  [complete profiles, gzip](source-profiles.json.gz).
- `git diff --check` passed. Cache changes refresh only the affected source/harness
  hashes and Game Maker runtime namespace; qualification and frozen policy remain.

[Execution JSON](execution.json) records exact source and artifact hashes.
Node 22.18.0, existing external Playwright 1.64.0 / Chromium 158.0.8127.18,
Linux headless SwiftShader. No install, hardware runner or physical-device claim.
The other six browser groups were not rerun for this editor-only correction;
the preceding full milestone result remains recorded separately.
