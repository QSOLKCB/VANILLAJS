# ARCADE v0.4.0 — explicit frame invalidation

**Status:** experimental opt-in presentation optimisation. The original VANILLAJS renderers, gameplay, fixed clocks and input paths are unchanged.

## Source and contract

Source-pinned donor: QSOLKCB/ARCADE release v0.4.0 at `430b16466e6c589bb92650d2a221772a3fd328d4`, PR #2 (head `2284b78d713a46d8d51da26e4006787c95e9d326`), `js/app.js`, `js/core.js` and `js/games/void.js`, Apache-2.0. ARCADE's optimised launcher skipped drawing when the screen had not changed; Void Command reused a terminal image only when its **complete** drawing-input signature matched. Its separate input/clock changes were originally adapted from VANILLAJS, so this PR does not import them back.

`modules/frame-gate/index.js` defines `FrameGate`, a pure JavaScript presentation decision gate. It deliberately does not own a game clock, GL context, canvas, worker, DOM tree or global cache.

Call `gate.present({key,width,height,contextEpoch},()=>drawFrame())` on a presentation opportunity. The caller-supplied `key` must identify **every effective input to the drawn image**, including interpolation phase where applicable, camera, geometry, colour, UI, effects, overlays and view modes. A supported key is a primitive string, finite number or bigint—not a mutable object identity. The gate stores it and the canvas pixel dimensions and context generation. When unchanged, it returns false without drawing; otherwise it invokes the synchronous callback and returns true.

- Initial call draws. `gate.invalidate()` forces the next call to draw. Changes to key, pixel dimensions or contextEpoch likewise force drawing. **Context restoration, external GPU mutations, device-pixel ratio changes, animation, UI actions and browser image invalidation must be represented in the key or invalidate call.**
- Draws which throw or return a thenable fail closed: they never make a frame clean. Reentrant calls are rejected. Invalidation during a draw leaves the next frame dirty.
- `gate.stats()` reports attempted successful draws, skipped duplicates, explicit invalidations and dirty state. None is a GPU timer.
- Do not use the gate for scenes whose output changes without an input-key change (unrecorded wall time, random effects, shader animation or interpolation). With ordinary WebGL `preserveDrawingBuffer:false`, `readPixels` after a skipped compositor frame is not a guaranteed saved-backbuffer operation; ensure your presentation lifecycle handles preservation/restoration correctly. The gate does not promise cross-driver pixel parity.

### Minimal usage

```js
import {FrameGate} from './modules/frame-gate/index.js';
const gate=new FrameGate();
let revision=0;
// On a game tick, menu change, asset update, camera change, or animation phase:
function markChanged(){revision++;}
function frame(api,mesh){
  gate.present({
    key:revision,width:api.canvas.width,height:api.canvas.height,contextEpoch:0
  },()=>{api.beginFrame();api.draw(mesh);api.endFrame();});
}
// Before next presentation after WebGL context replacement:
// gate.invalidate(); and use an incremented contextEpoch.
```

## Verification

`tests/frame-gate.test.js` checks initial/idle frames, primitive-key identity (including signed zero), size and context invalidation, failed and reentrant draws, mid-draw invalidation, invalid input atomicity, 60/120/144 Hz fixed-step schedules, and full-image parity against an always-rendering pure-state reference over 500 frames.

`scripts/browser-frame-gate.js` verifies packaged WebGL1 output at actual redraw checkpoints versus a forced redraw of the same state. This is a same-source output correctness gate, not a hardware speed benchmark.

## Owner-run RTX 5060 Ti protocol

After this PR is reviewed and merged to main, manually dispatch `.github/workflows/rtx5060ti-arcade.yml` using the dedicated self-hosted RTX 5060 Ti runner. The actor must be `EmergentMonk`, main must be clean and exact-head, and `acknowledge_local_execution` must be true. Evidence upload is separately gated by `publish_evidence=true`. No pull_request or push event can launch it.

The workflow does **not** rewrite RTX5060TI-001 or RTX5060TI-002. It verifies both immutable archives and separately reruns the original trusted full-path workload from the exact historical candidate source commits against the new reviewed main:

| Frozen receipt | Prior candidate SHA | Archive SHA-256 |
| --- | --- | --- |
| RTX5060TI-001 | `240617e8bc1a935f05eaf75a10531f194f72a173` | `1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8` |
| RTX5060TI-002 | `b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f` | `79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef` |

These are **newly paired measurements of compatible historical workloads** on today's hardware, not a numerical comparison between unrelated archived metrics. The original pre-optimisation control remains an allowed baseline for the older workflow. An unlisted baseline SHA is rejected.

The *new feature* uses `scripts/rtx5060ti-frame-gate.mjs` on one current-source WebGL context. It compares always-draw against explicit gate on identical 48-frame synthetic scenes (2 warmups and 7 alternating measured pairs). Nine changed-state GPU checkpoints per trial must have matching pixel hashes; idle frames should skip 39 draws. CPU/driver wall time includes `gl.finish` and readback; **not GPU timer queries, vsync/frame pacing or FPS**. The new ARCADE feature did not exist in either frozen receipt and has no historical performance baseline. The finaliser writes a separate SHA-256-checked temporary evidence package after every gate passes; preserve it later through a separate source-reviewed PR.

## Deliberate exclusions

No Three.js, rendering framework, cached game texture, new controller menu implementation, altered clock tick semantics, global renderer mutation, benchmark-based speedup acceptance, or automated GPU execution. ARCADE's controller arming and rounded 60 Hz clock are useful *consumer-specific* patterns; VANILLAJS already has gamepad neutral-release and bounded `FixedClock`. Changing their existing semantics belongs in independent parity-gated work, not this rendering slice.
