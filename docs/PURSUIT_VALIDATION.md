# Pursuit Lab validation

Local implementation checks, 16 November 2026 (Australia/Adelaide).
Base: VANILLAJS `3c35784636288bafe4923537463f853b6bcf0cb4`.
Donor: Outruin `c9a0839fa1f8329f3eee4c7fd8637ae78cbad8c7`.
The PR identifies the resulting commit; adaptation file identities are recorded
in `demos/pursuit-lab/PROVENANCE.json`.

| Executed check | Observed result |
| --- | --- |
| `node --test tests/*.test.js` | 883 passed, 0 failed |
| New road/display/effect/pursuit tests | 19 passed, including three complete winning campaigns, exact replay and terminal audio lifetimes |
| `node scripts/check.js` | 350 JavaScript files, 55 module contracts, two research experiments checked |
| `node scripts/build.js` and `node scripts/verify-offline.js` | Allowlisted package and complete-content manifest verified |
| Packaged Pursuit Chromium check | Keyboard launch/driving/turbo, pause and repeated-key cancellation, focus loss, native fullscreen entry/exit and denied-entry fallback passed |
| Layout checks | Complete canvas/HUD visible at 1836×888, 390×844, 844×390 and 320×568; screenshots inspected |
| Input/device checks | Pointer capture/cancellation and emulated standard-pad disconnect/neutral gating passed |
| Export/offline/recovery | Downloaded WAV matched reference PCM hash; downloaded tape replay matched state; normal URL reloaded offline; injected audio failure preserved preference and recovered on retry |
| ALIEN-MATH-006 `--pins-only` | Source inventory and reviewed baseline matched; local Lean compilation was not run |
| Browser reuse plan | Edited/unknown closures invalidate reuse; reviewed hashes were not rewritten to approve this implementation |

Local toolchain: Node 24.22.1, existing Playwright 1.62.1 and Chromium
141.0.7390.37 headless shell. No tooling installation or owner hardware runner
was used. The hosted PR workflow runs its pinned browser and full required
checks; local evidence does not substitute for that workflow's result.
Screenshots and a complete WAV are emitted into `browser-artifacts/` by
`scripts/browser-pursuit.js` and included in the existing CI artifact upload.

## Failed attempts retained as engineering notes

- The first renderer run stopped on a six-argument Canvas ellipse call. The
  missing start angle was corrected and the actual game rendered and advanced.
- A short Space press could disappear before the next fixed tick. Turbo presses
  now remain pending until consumed; pause still clears them. The focused-toolbar
  Space path is covered by the browser check.
- PR review found that clear/fail cues were cancelled by the terminal update
  and by following result-screen frames. Music/engine shutdown is now separate
  from full audio cancellation. Tests cover clear, win and loss tails, their
  natural cleanup, and cancellation on pause, focus loss, mute and failure.
- Full hosted Chromium CI found that the new Pursuit promotion shares the
  Vault card's CSS class. The Vault test's class-only locator matched both cards
  and failed strict selection. The test now also matches the Vault destination;
  its existing destination assertion and complete gameplay checks remain intact.
- Early browser assertions raced fullscreen notification and gamepad-neutral
  polling. They now wait for the displayed mode and actual animation frames.
- The first offline check used the debug query URL, which the existing worker
  intentionally excludes. The check now reloads the normal shipped URL. The demo
  also uses the shared offline registrar instead of an incorrect worker filename.
- Existing source guards rejected the new audio score branding and browser-suite
  registration until their inventories were updated. VOIDWARD's original audio2d
  commit/digest remain intact beside a separate adaptation digest; the formal
  manifest changes only the browser-policy source hash. Historical proof and
  hardware receipts were not rewritten.

This demonstrates the tested arcade rules and browser paths, not faithful
emulation of Chase H.Q., universal replay equivalence, measured performance,
mobile Safari fullscreen support, hardware-controller feel or audible device
quality. Those claims were not established by these checks.

## Post-merge capture recovery

Hosted run `43727146207`, job `132851461888`, at merge commit
`9c57d16a9a6bd4d0e9da271cd351c1b1fb813f01` timed out after 30 seconds
capturing the live 1836×888 viewport. Diagnostics showed tick 430, a fitted
canvas, and no page errors. This is separate from the earlier Vault locator
failure. The exact capture timeout did not reproduce locally with 6× CDP CPU
throttling; its Chromium 156 compositor cause is not established by that run.

The new idle-paint regression failed on the merge source: two observed frames
both repainted the unchanged briefing. The app now paints idle scenes only
after a menu or size change, while continuing input/audio lifecycle polling.
The browser check performs its driving and pointer assertions, pauses through
the real control, waits for settled frames, and checks frozen state and zero
idle paints before capturing the complete page. The pause overlay remains
visible in evidence. Failure diagnostics are logged before a separately bounded
five-second best-effort capture; the original error still fails the suite.

Executed locally with the toolchain above: 883 Node tests, source/provenance
checks, package/offline verification and the packaged Pursuit browser check
passed. All four viewport captures passed with 6× CPU throttling; desktop and
320px evidence were inspected. This regression demonstrates idle rendering and
capture preconditions; hosted CI must still validate its pinned browser.

## Existing offline visitor regression

After the successful post-merge run, the owner reported inert launch controls.
A fresh visit to the deployed URL launched and advanced, so fresh-install CI
was insufficient. A local browser installed the complete package from
`3c35784636288bafe4923537463f853b6bcf0cb4`, then navigated to the current Pursuit
page after switching the server to the new build. The old worker served its
cached audio API while the new lab arrived from the network. Module linking
failed with `does not provide an export named 'createEffectPlayer'`; the menu
remained visible and no game instance existed.

The content-addressed native module package started with that same old worker
still controlling the page and no page errors. The fixture in
`tests/fixtures/pursuit-pre89-audio.txt` preserves the exact old audio API; the
hosted browser regression installs a cache-first worker serving those bytes,
then checks launch, driving and music while the older cached API remains intact.
A separate failed-module request checks visible reload recovery. Fresh-install
offline coverage remains in the normal Pursuit suite.

Executed locally: all 886 Node tests, the legacy-cache launch/driving/music
regression, visible failed-module reload recovery, source/provenance checks,
package/offline verification and the 14 research-capsule tests passed. The
package adds 16 byte-identical native modules (about 60 KiB), without runtime
dependencies. An early fixture incorrectly polled an async predicate; a Promise
was truthy before worker activation. The final test explicitly awaits the real
worker's readiness with a timeout before changing the server's asset version.
