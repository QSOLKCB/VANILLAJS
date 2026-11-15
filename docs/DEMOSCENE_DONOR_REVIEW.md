<!-- SPDX-License-Identifier: Apache-2.0 -->
# DEMOSCENE-001 — pinned design review and provenance

Implementation base: VANILLAJS `3d5f9f93e124da5598b4181e344471477968e6e1`, released as v2.3.0. The existing DEMO_SYNTH plan and lattice/acoustic addendum were reviewed against the actual Soundtrack, audio2d, render-webgl, FrameGate, Mod SDK, editor history and Asset Foundry APIs. The current full-production brief supersedes the old plan's staged first-deliverable restriction; future acoustic and MOD research stays future.

All eight donors below were inspected at immutable commits. Licence files were checked at those commits, including upstream-specific headers where relevant. **This is design research only: no donor code, samples, fonts, meshes, score, media or binaries were copied.** New production assets and code carry Apache-2.0; imported user assets retain their declarations.

## SPECTRAL

- Commit: [`49401fa010ed673e3d3977ccd5e06d66b0d65096`](https://github.com/QSOLKCB/SPECTRAL/tree/49401fa010ed673e3d3977ccd5e06d66b0d65096).
- Inspected: [APP/js/audio/dsp.js](https://github.com/QSOLKCB/SPECTRAL/blob/49401fa010ed673e3d3977ccd5e06d66b0d65096/APP/js/audio/dsp.js) and [LICENSE](https://github.com/QSOLKCB/SPECTRAL/blob/49401fa010ed673e3d3977ccd5e06d66b0d65096/LICENSE).
- Licence boundary: MIT.
- Decision: Integer oscillator/envelope boundaries and explicit PCM identity. Reuse VANILLAJS audio2d instead of importing a second DSP engine.

## SONIFICATION

- Commit: [`2ca65c6540d7051a77ed571b83f5a9df453094ec`](https://github.com/QSOLKCB/SONIFICATION/tree/2ca65c6540d7051a77ed571b83f5a9df453094ec).
- Inspected: [APP/js/audio.js](https://github.com/QSOLKCB/SONIFICATION/blob/2ca65c6540d7051a77ed571b83f5a9df453094ec/APP/js/audio.js) and [LICENSE](https://github.com/QSOLKCB/SONIFICATION/blob/2ca65c6540d7051a77ed571b83f5a9df453094ec/LICENSE).
- Licence boundary: MPL-2.0.
- Decision: Distinguish source identity, quantisation and WAV container bytes; no floating DSP or UI copied.

## PSYCLE-LINUX

- Commit: [`86f959951a98d07fd5972b828c238d86fa7667f6`](https://github.com/QSOLKCB/PSYCLE-LINUX/tree/86f959951a98d07fd5972b828c238d86fa7667f6).
- Inspected: [PROVENANCE.md](https://github.com/QSOLKCB/PSYCLE-LINUX/blob/86f959951a98d07fd5972b828c238d86fa7667f6/PROVENANCE.md); [cpsycle/audio/src/sequencer.c](https://github.com/QSOLKCB/PSYCLE-LINUX/blob/86f959951a98d07fd5972b828c238d86fa7667f6/cpsycle/audio/src/sequencer.c) and [LICENSE](https://github.com/QSOLKCB/PSYCLE-LINUX/blob/86f959951a98d07fd5972b828c238d86fa7667f6/LICENSE).
- Licence boundary: Apache-2.0 repository additions; inspected upstream C-Psycle sequencer is GPL-2.0-or-later.
- Decision: Pattern/sequence scheduling and voice ownership inform the architecture only. The upstream file header governs that source; the root licence is not permission to relicense it. No sequencer code copied.

## E8

- Commit: [`292cc9a41dd08bb8bc48b060c9e36157dbe3d1f0`](https://github.com/QSOLKCB/E8/tree/292cc9a41dd08bb8bc48b060c9e36157dbe3d1f0).
- Inspected: [audio-core.js](https://github.com/QSOLKCB/E8/blob/292cc9a41dd08bb8bc48b060c9e36157dbe3d1f0/audio-core.js) and [LICENSE](https://github.com/QSOLKCB/E8/blob/292cc9a41dd08bb8bc48b060c9e36157dbe3d1f0/LICENSE).
- Licence boundary: MPL-2.0.
- Decision: Separate authored mappings from mathematical source identity. Radial motifs here are original art, not an E8 or physical model.

## E8_MUSIC

- Commit: [`d8e5983d84af03f03a969abe3356dcf80c0e0e97`](https://github.com/QSOLKCB/E8_MUSIC/tree/d8e5983d84af03f03a969abe3356dcf80c0e0e97).
- Inspected: [CANONICAL_SONIFICATION.md](https://github.com/QSOLKCB/E8_MUSIC/blob/d8e5983d84af03f03a969abe3356dcf80c0e0e97/CANONICAL_SONIFICATION.md) and [LICENSE](https://github.com/QSOLKCB/E8_MUSIC/blob/d8e5983d84af03f03a969abe3356dcf80c0e0e97/LICENSE).
- Licence boundary: MPL-2.0.
- Decision: Keep interpretive music separate from source-forced observation profiles; this soundtrack is an authored composition.

## OPT

- Commit: [`6b39a60f89a0b98e18b05ea3cbf7029f857dc41c`](https://github.com/QSOLKCB/OPT/tree/6b39a60f89a0b98e18b05ea3cbf7029f857dc41c).
- Inspected: [optimizations/OPT-INV-001-invariant-driven-reuse.md](https://github.com/QSOLKCB/OPT/blob/6b39a60f89a0b98e18b05ea3cbf7029f857dc41c/optimizations/OPT-INV-001-invariant-driven-reuse.md) and [LICENSE](https://github.com/QSOLKCB/OPT/blob/6b39a60f89a0b98e18b05ea3cbf7029f857dc41c/LICENSE).
- Licence boundary: Apache-2.0.
- Decision: Reuse only complete equivalent inputs, retain a fresh reference path and measure actual work counters.

## ARCADE

- Commit: [`f29b780734a50171d55ae2f770930db8a487b31c`](https://github.com/QSOLKCB/ARCADE/tree/f29b780734a50171d55ae2f770930db8a487b31c).
- Inspected: [arcade2/vendor/vanillajs/modules/frame-gate/index.js](https://github.com/QSOLKCB/ARCADE/blob/f29b780734a50171d55ae2f770930db8a487b31c/arcade2/vendor/vanillajs/modules/frame-gate/index.js) and [LICENSE](https://github.com/QSOLKCB/ARCADE/blob/f29b780734a50171d55ae2f770930db8a487b31c/LICENSE).
- Licence boundary: Apache-2.0.
- Decision: Explicit presentation invalidation and fail-closed reuse. Use the already-attributed VANILLAJS FrameGate, not another copied implementation.

## CorpoWars3d

- Commit: [`5701949e4ef7047b715db808b777450c3bf49d53`](https://github.com/QSOLKCB/CorpoWars3d/tree/5701949e4ef7047b715db808b777450c3bf49d53).
- Inspected: [games/dos/src/mod.c](https://github.com/QSOLKCB/CorpoWars3d/blob/5701949e4ef7047b715db808b777450c3bf49d53/games/dos/src/mod.c); [NOTICE](https://github.com/QSOLKCB/CorpoWars3d/blob/5701949e4ef7047b715db808b777450c3bf49d53/NOTICE) and [LICENSE](https://github.com/QSOLKCB/CorpoWars3d/blob/5701949e4ef7047b715db808b777450c3bf49d53/LICENSE).
- Licence boundary: Apache-2.0 for inspected DOS MOD source; repository NOTICE retains other provenance.
- Decision: Real MOD parsing has a specific format/effect contract. Defer MOD rather than rename project JSON or claim tracker compatibility.

## Historical references

[Assembly Archive](https://archive.assembly.org/) was consulted as a catalogue of complete productions, and [Assembly × Demoscene](https://demoscene.assembly.org/) for the history of noninteractive realtime audiovisual art and size-constrained intros. Their creative constraints informed the five-act presentation, not asset reuse. No archive binaries or media were downloaded into the engine.

The requested [Assembly Summer 2025 demo competition rules](https://assembly.org/en/events/summer25/info-en/demo-competition-rules) URL returned HTTP 403 during retrieval. Its current rules were therefore not verified. The implementation makes no Assembly eligibility, category, submission or competition-compliance claim. Full-runtime byte accounting and originality are engineering requirements of this project, not a substitute for checking current event rules.

## Reused local contracts

- Soundtrack already supports eight bounded phrases and renderRange across phrase boundaries. Eight 360,000-sample phrases supply the full minute without new DSP.
- audio2d already has four integer lanes, indexed noise and explicit PCM16LE WAV output. Browser sample conversion happens only in the adapter.
- The native renderer accepts retained XYZ/RGB buffers, lines and points. No new renderer, external shaders or engine framework is needed.
- FrameGate, Mod SDK and editor asset validators keep their existing caps and licences. The new strict sidecar leaves old scene and project schemas compatible.
- Fresh geometry reconstruction is the correctness reference; low-detail settings change rendering work without changing sample/score identity. No universal speedup claim is made.

