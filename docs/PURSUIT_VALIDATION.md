# Pursuit Lab validation

Local implementation checks, 16 November 2026 (Australia/Adelaide).
Base: VANILLAJS `3c35784636288bafe4923537463f853b6bcf0cb4`.
Donor: Outruin `c9a0839fa1f8329f3eee4c7fd8637ae78cbad8c7`.
The PR identifies the resulting commit; adaptation file identities are recorded
in `demos/pursuit-lab/PROVENANCE.json`.

| Executed check | Observed result |
| --- | --- |
| `node --test tests/*.test.js` | 881 passed, 0 failed |
| New road/display/effect/pursuit tests | 17 passed, including three complete winning campaigns and exact replay |
| `node scripts/check.js` | 349 JavaScript files, 55 module contracts, two research experiments checked |
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
