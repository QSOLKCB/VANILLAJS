# SKYGUARD-001 — executed integration evidence

SKYGUARD is a naval air-defence lab derived from Spooky v0.1.0. These local receipts bind the tested source to `source.json`; they are not reviewed-main CI reuse witnesses. GitHub Actions supplies its own receipts for the submitted PR.

## Executed checks

| Check | Result |
| --- | --- |
| `node --test tests/*.test.js` | 901 passed, 0 failed, 0 skipped |
| `node scripts/check.js` | 361 JavaScript files, 55 module contracts, 2 research experiments; all source-provenance checks passed |
| `node scripts/build.js` | 527 packaged files, 3,124,183 bytes; verified offline inventory |
| `node scripts/browser-check.js --suites=donor` | Full donor group passed, including all 14 Skyguard scenarios, Pursuit/cache upgrade, Touchline, CPU labs, donor labs, Soundtrack and SubHunt |
| `node scripts/browser-check.js --suites=home` | Main launcher and flight demo regressions passed |

Chromium version: **141.0.7390.37**, using the environment's existing headless-shell executable. No browser installation or physical-runner dispatch was performed. The pure Skyguard tests complete eight raids at each of seeds 47, 47047 and 2026, retaining refits across rotations. They also cover moving projectile collisions, flak clusters, continuous missile lock, lost targets, charged rail release/cancellation, overheat, reload, loss/retry, fixed-step schedule agreement and four full deterministic WAVs.

The browser suite uses actual aim/fire/refit DOM handlers and a bounded test clock; it does not inject ammunition, health, kills or offers. It clears each of the four batteries. It checks pointer alignment, toolbar Space, independent touch pointers, fullscreen and refusal, four fitted sizes down to 320 px, controller neutral/disconnect, lifecycle cancellation, WAV exports, audio failure, canonical-URL offline reload with real animation ticks, an older cached shared API and recoverable startup import failure. See `browser.json` for individual outcomes. The two PNGs show the executed desktop combat and 390×844 paused layout.

## Preserved failed attempts

The `attempts/` directory retains the failed checks that led to corrections. The two unit logs are gzip-compressed without altering their original bytes:

- Initial packaging rejected dynamic `createElement(tag)`. Refit cards now use literal element creation; the dependency recognizer was not relaxed.
- The first isolated heat test allowed 100 cooling ticks; at 0.7 heat per tick this leaves 30 heat, above the 25 release threshold. Its fixture now allows 120 ticks.
- The first full unit run correctly rejected the stale formal archive policy hash and a minimal archive fixture missing the new lab. The supported pin updater refreshed only the browser-policy digest; the fixture gained the required startup files. The pinned historical source tree was restored and checked against its recorded Git hashes before updating the manifest. No formal model or proof was changed, and no new Lean execution is claimed here.
- Browser attempts 1 and 3 ended the firing touch when intending to end the aim touch. Chrome's touch-end list identifies the contacts being ended. The harness now ends the intended contact and separately verifies normal fire release, fire cancellation and aim-only cancellation.
- Browser attempt 2 checked fullscreen exit before the display controller's asynchronous pause event. The check now waits for both the mode and paused state.
- Browser attempt 4 tried to reload `?test=1` offline. The strict root worker deliberately caches canonical asset URLs. The final offline check uses the canonical lab URL and real animation frames; no worker policy was weakened.

All failures above were followed by the recorded final passing runs. Runtime input handling also preserves a charged fire pointer when only the independent aiming pointer is cancelled. The final UI clears stale combat notices on overlays and avoids stretching the compact mobile control panel.

## Scope and limits

The source base is `QSOLKCB/VANILLAJS` commit `2d5caddc93154874e9bdb582de6a830356b360aa`. Spooky provenance is pinned to release commit `0c13684a03e301e59ba5dd04c67167874ab04766`. `source.json` records changed-source hashes, the complete packaged native graph, package hashes and evidence hashes.

These are local software tests and emulated browser touch/controller events. Physical mobile/gamepad ergonomics, other browser engines, real naval ballistics and cross-browser bit-exact floating-point audio are not established by these receipts. The simulation's logical arcade coordinate frame and approximations are documented in `docs/SKYGUARD_INTEGRATION.md`.

Evidence, test tooling and screenshots are excluded from the public package. No deployment, merge, release or tag is part of this evidence.
