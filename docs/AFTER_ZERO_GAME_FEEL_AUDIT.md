# AFTER//ZERO game-feel source review

SPRITE-FEEL-001 reviewed [QSOLKCB/AFTER-ZERO](https://github.com/QSOLKCB/AFTER-ZERO/tree/406a45927b819f7383f71649d261de675552ca9c)
at **`406a45927b819f7383f71649d261de675552ca9c`**. This is a read-only
source review, not an AFTER//ZERO port, campaign playthrough or performance claim.
VANILLAJS starts from reviewed main
`433f8c87a74ed145a612510ee388a7aacc1280f6`, after published v2.5.0.

## File identities

The following identities are Git blob SHA-1 values returned by GitHub for that
immutable commit, not SHA-256 package hashes. Each source file was read in full.

| Inspected file | Git blob identity |
| --- | --- |
| [aim.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/aim.js) | `96802c088c63c26bf3b5bc4615251d54ea500ba8` |
| [controls.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/controls.js) | `555cac3b506fd92da01acf2ba7cba75c18da592b` |
| [pointer-capture.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/pointer-capture.js) | `72fb5cb15e40a35abebd239c228343943eaad7f8` |
| [sights.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/sights.js) | `054c9e28b5d9da8d38f5ace23259165096c7ec70` |
| [game.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/game.js) | `f2cf63da569bcfa0da5aaf4292ab07ab34f98aaa` |
| [campaign-frame.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/campaign-frame.js) | `4b6eb63aa69708c23b9b43b2c802378626868de3` |
| [renderer.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/renderer.js) | `12a2009cd229ec7bf038ede9f98213bb963c0f46` |
| [audio.js](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/src/audio.js) | `75354afe9453bd342850b45b840a21db9b87d876` |

## Behaviour selected for independent implementation

| Source observation | Reusable contract for VANILLAJS | Boundary retained |
| --- | --- | --- |
| CampaignFrame consumes relative look before fixed updates, including display frames with no simulation tick. Controls retains action edges until a tick reads them. | Immediate aim updates and exactly-once look consumption; preserve pending fire/reload edges across zero-tick frames. | Physics, weapon eligibility and damage remain fixed-step; display cadence is not replay time. |
| Controls sums finite relative deltas without discarding large valid swipes; drag motion uses differences between positions. | Accumulate accepted relative motion, consume once and clear pending input at pause/focus/capture boundaries. | Explicit bounds and invalid-input rejection are part of VANILLAJS's own adapter contract; donor input code is not imported. |
| Aim uses the ratio of half-FOV tangents while zooming. | Coordinate the visible ADS FOV and angular sensitivity continuously. | New profiles choose original parameters; aim remains right-handed, +Y-up/-Z-forward with documented radians. |
| Game stores a per-weapon next-ready time, imposes a switch interval and cancels buffered shots on reload/switch. | A short configured trigger buffer may defer a fresh press, but cannot bypass cooldown, reload or switching. | Existing VANILLAJS weapon/combat timing remains authoritative. |
| Seeded shot dispersion narrows while aimed; recoil drives presentation rather than player yaw/pitch. | Separate explicit seeded gameplay dispersion/recovery from cosmetic weapon kick. | A cosmetic slider must not silently alter damage, canonical aim or shot direction. |
| Sights keep their centre aligned to combat; reload hides optics and ADS changes their shape. | The displayed reticle and hit diagnostics refer to the actual combat ray, with distinct reload, change, flash and hit/damage feedback. | No donor sight drawings, names or weapon models are reused. |
| PointerCapture waits for actual ownership, cancels late grants and retries ordinary capture when raw input is unsupported. | Preserve the existing VANILLAJS capture lifecycle and deliberate resume; test failed and cancelled capture. | No new compulsory capture policy replaces existing labs or their drag/keyboard fallback. |
| Renderer retains buffers and keys weapon/sight reuse on effective inputs. | Keep static geometry retained; skip unchanged presentation work only when all effective inputs are represented. | No new renderer, shader, donor cache or performance claim is introduced by this milestone. |
| Audio synthesizes effects, requires a running context and stops owned voices. | Optional user-gesture audio and explicit cancellation/failure recovery. | Existing first-party audio facilities provide original feedback; donor score/noise generation is not copied. |

The donor uses 120 Hz campaign steps and a 150 ms trigger window; those numbers
are observations, not new universal engine constants. It has campaign-specific
weapons, progression, time powers, enemy rules and online systems. None belongs in
this adapter. The new module and training recipe must establish their own bounded
parameters and regression results; donor verification cannot serve as their witness.

## Licence and provenance

The root [LICENSE](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/LICENSE)
and `public/LICENSE` are Apache-2.0, both with Git blob identity
`261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64`.
The reviewed [public/NOTICE](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/public/NOTICE),
`c3574430c9ea6c013b6489bb1edfdf14424eb275`, identifies AFTER//ZERO's original
runtime and earlier donor relationships:

- QUICKSCOPER `7c406e2545d82ee6bdc5fda5f198eb22fa183a84` supplied mathematical
  and mesh foundations in other files. Those implementations are not imported here.
- VANILLAJS v1.0.0 `1f965f4e5b6669de0f954e3a39b11aa679e56720` informed/adapted
  retained GPU-buffer updates; its numerical/projectile tests and OPT ideas also
  informed AFTER//ZERO. Returning an idea does not make that code new provenance.
- LibreQuake is recorded as conceptual inspiration only, with no copied code/assets.
- The hosting scaffold and unrelated vendor files have their own licence context.
  Their presence does not authorise or require importing that infrastructure.

The [source import record](https://github.com/QSOLKCB/AFTER-ZERO/blob/406a45927b819f7383f71649d261de675552ca9c/docs/SOURCE_IMPORT.md)
was also inspected (blob `e89d930f8365ecdcab15552336a7a9becfd65f68`).
The review preserves these references without copying the donor's source tree.

SPRITE-FEEL-001 independently implements the selected behaviours using VANILLAJS
contracts. No AFTER//ZERO campaign, source module, graphical asset, soundtrack,
weapon identity, server or hosting dependency is included. New source retains
Apache-2.0 SPDX headers. Any later direct adaptation must identify the changed
source files and retain all applicable notices before review; this audit is not
blanket permission to copy another game.

## Verification boundary

This document records source inspection and design decisions only. AFTER//ZERO
was not built, executed or benchmarked in this review. Its own README explicitly
separates automated checks from unavailable physical/GPU coverage. New VANILLAJS
Node, packaged Chromium, source/package and stale-worker results must be recorded
against the actual candidate source and package identities by the implementation
PR. No inherited donor result proves this milestone passed.

[Programme and future contracts](ENGINE_EXPANSION_001.md) ·
[Existing FPS contracts](FPS_FOUNDATION_001.md)
