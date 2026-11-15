# FPS Foundry donor review

All sources were inspected at the exact commits below before implementation decisions. This is design research, not an indiscriminate donor import. New combat, arena content, bot policy and presentation are independently authored under Apache-2.0. Existing VANILLAJS provenance and NOTICE entries remain intact.

## QwakeTF

Pinned commit: [`3852d20c9744350b883e38560f492a5683f2e492`](https://github.com/QSOLKCB/QwakeTF/tree/3852d20c9744350b883e38560f492a5683f2e492). Licence reviewed: **Apache-2.0 code; separately licensed assets**.

Inspected: [src/weapons.js](https://github.com/QSOLKCB/QwakeTF/blob/3852d20c9744350b883e38560f492a5683f2e492/src/weapons.js), [src/bots.js](https://github.com/QSOLKCB/QwakeTF/blob/3852d20c9744350b883e38560f492a5683f2e492/src/bots.js), [ASSET_LICENSES.md](https://github.com/QSOLKCB/QwakeTF/blob/3852d20c9744350b883e38560f492a5683f2e492/ASSET_LICENSES.md).

Reviewed distinct weapon classes, aim dispersion, perception/reaction gates and navigation. Implemented a smaller original policy over VANILLAJS APIs; no QwakeTF code, game names, maps or LibreQuake assets copied.

## QUICKSCOPER

Pinned commit: [`8da5569b1ee7565d9ae5fb0588847d262c896648`](https://github.com/QSOLKCB/QUICKSCOPER/tree/8da5569b1ee7565d9ae5fb0588847d262c896648). Licence reviewed: **Apache-2.0**.

Inspected: [src/game.js](https://github.com/QSOLKCB/QUICKSCOPER/blob/8da5569b1ee7565d9ae5fb0588847d262c896648/src/game.js).

Reviewed head/body boxes, nearest obstruction, target penetration and cover winning ties. New combat3d uses VANILLAJS raycast and an independently authored stable ordering. No scope art, skins or game systems copied.

## BLOAT-OPS

Pinned commit: [`b92ecf10036f371ea68929cb5eb7cacbb7aa4a71`](https://github.com/QSOLKCB/BLOAT-OPS/tree/b92ecf10036f371ea68929cb5eb7cacbb7aa4a71). Licence reviewed: **Apache-2.0 code; third-party assets separately noticed**.

Inspected: [src/game/replay.js](https://github.com/QSOLKCB/BLOAT-OPS/blob/b92ecf10036f371ea68929cb5eb7cacbb7aa4a71/src/game/replay.js), [src/game/enemies.js](https://github.com/QSOLKCB/BLOAT-OPS/blob/b92ecf10036f371ea68929cb5eb7cacbb7aa4a71/src/game/enemies.js), [NOTICE](https://github.com/QSOLKCB/BLOAT-OPS/blob/b92ecf10036f371ea68929cb5eb7cacbb7aa4a71/NOTICE).

Reviewed complete-tick journals, rejecting unconsumed inputs, source/level identity, delayed bot attacks and bounded replanning. New replay uses SHA-256 of its complete simulation closure and exact same-runtime state verification. No mission/checkpoint code, characters or assets copied.

## CorpoWars3d

Pinned commit: [`5701949e4ef7047b715db808b777450c3bf49d53`](https://github.com/QSOLKCB/CorpoWars3d/tree/5701949e4ef7047b715db808b777450c3bf49d53). Licence reviewed: **Apache-2.0, with upstream notices**.

Inspected: [src/simulation.js](https://github.com/QSOLKCB/CorpoWars3d/blob/5701949e4ef7047b715db808b777450c3bf49d53/src/simulation.js), [NOTICE](https://github.com/QSOLKCB/CorpoWars3d/blob/5701949e4ef7047b715db808b777450c3bf49d53/NOTICE).

Reviewed line-of-sight, bounded path search, tactical target and squad ownership. The lab owns its simple cover/strafe policy and uses the existing navigation module. No campaign, economy or squad fiction copied.

## Spooky

Pinned commit: [`0c13684a03e301e59ba5dd04c67167874ab04766`](https://github.com/QSOLKCB/Spooky/tree/0c13684a03e301e59ba5dd04c67167874ab04766). Licence reviewed: **Apache-2.0, with upstream notices**.

Inspected: [js/sim.js](https://github.com/QSOLKCB/Spooky/blob/0c13684a03e301e59ba5dd04c67167874ab04766/js/sim.js), [NOTICE](https://github.com/QSOLKCB/Spooky/blob/0c13684a03e301e59ba5dd04c67167874ab04766/NOTICE).

Reviewed finite wave pacing, difficulty, actual aim spread, hit feedback and input cancellation. Created original finite rosters, palettes, geometry and feedback. Existing VANILLAJS APIs are used directly rather than importing a vendored copy.

## OPT

Pinned commit: [`6b39a60f89a0b98e18b05ea3cbf7029f857dc41c`](https://github.com/QSOLKCB/OPT/tree/6b39a60f89a0b98e18b05ea3cbf7029f857dc41c). Licence reviewed: **Apache-2.0**.

Inspected: [optimizations/OPT-INV-001-invariant-driven-reuse.md](https://github.com/QSOLKCB/OPT/blob/6b39a60f89a0b98e18b05ea3cbf7029f857dc41c/optimizations/OPT-INV-001-invariant-driven-reuse.md).

Applied invariant-driven reuse to accepted immutable arena geometry. Independent concatenated boxVertices output must equal batched Float32 input exactly. Report actual upload/path counts and timings, with no unmeasured FPS or speedup claims.

## SONIFICATION

Pinned commit: [`2ca65c6540d7051a77ed571b83f5a9df453094ec`](https://github.com/QSOLKCB/SONIFICATION/tree/2ca65c6540d7051a77ed571b83f5a9df453094ec). Licence reviewed: **MPL-2.0**.

Inspected: [APP/js/audio.js](https://github.com/QSOLKCB/SONIFICATION/blob/2ca65c6540d7051a77ed571b83f5a9df453094ec/APP/js/audio.js), [LICENSE](https://github.com/QSOLKCB/SONIFICATION/blob/2ca65c6540d7051a77ed571b83f5a9df453094ec/LICENSE).

Reviewed bounded PCM validation, quantization and WAV separation as design context only. No MPL implementation copied or adapted. Original demo cues use VANILLAJS audio2d and the existing effect player.

## SPECTRAL

Pinned commit: [`49401fa010ed673e3d3977ccd5e06d66b0d65096`](https://github.com/QSOLKCB/SPECTRAL/tree/49401fa010ed673e3d3977ccd5e06d66b0d65096). Licence reviewed: **MIT**.

Inspected: [APP/js/audio/dsp.js](https://github.com/QSOLKCB/SPECTRAL/blob/49401fa010ed673e3d3977ccd5e06d66b0d65096/APP/js/audio/dsp.js), [LICENSE](https://github.com/QSOLKCB/SPECTRAL/blob/49401fa010ed673e3d3977ccd5e06d66b0d65096/LICENSE).

Reviewed integer phase accumulators and strict/replay-safe rendering distinctions. No DSP source, recordings or scientific mapping transplanted. Original tones and rhythm are authored locally through existing audio2d.

## Asset and integration boundary

QwakeTF's own asset review distinguishes BSD-3-Clause LibreQuake assets from GPL engine/game-code material and proprietary or uncertain assets. None is redistributed here. BLOAT-OPS and CorpoWars3d carry their own upstream/asset notices; no such files are incorporated. SONIFICATION's MPL-2.0 terms are not treated as Apache permission. No new third-party runtime notices are required for design study alone.

Games2 was inspected only as a planning reference. Its catalogue, donor list and individual game directories remain untouched. No commercial names, characters, levels, textures or audio become content in this lab. The future consumer owns its original fiction and releases separately.
