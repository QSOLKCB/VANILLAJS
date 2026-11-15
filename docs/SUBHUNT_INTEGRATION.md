# SUBHUNT-001 — controllers, soundtracks and living-toy recipes

Play [SubHunt Lab](../demos/subhunt-lab/index.html). It includes Fleet Hunt and
Pond Panic, both playable vessels, three difficulties, four power-ups, controller
setup and three deterministic chip themes. The game is an Apache-2.0 adaptation of v0.3.0;
the reusable parts are native VANILLAJS APIs.

## Source pins and boundaries

| Release | Immutable source commit | Contribution |
|---|---|---|
| QSOLKCB/SubHunt v0.1.0 | `4c5caa5db105cd1fbd08dd50bb05c1e8302bfee1` | Raw USB axes/buttons/hats, explicit centre confirmation, calibration cancellation, input release and controller handoff |
| QSOLKCB/SubHunt v0.2.0 | `1603d51e8dd40bed06dd229dea0263a0988718d2` | Four-lane score composition, tick/sample playback, living toys, power-ups, difficulty and separate records |
| QSOLKCB/SubHunt v0.3.0 | `fa8b9778575959b709f565270c5c4bc0f984c435` | Recoverable soundtrack/export failures and packaged-deployment regression coverage |

The controller source is `js/controller.js`; lifecycle/UI references are
`js/app.js` and `tests/browser.py`. Music references are `js/music.js` and
`tests/music.cjs`. Gameplay and artwork are adapted from `js/sim.js` and
`js/render.js`. Original source identities and adapted file hashes are in
`demos/subhunt-lab/PROVENANCE.json`; the donor licence is retained beside the demo.
`scripts/verify-subhunt.js` checks the complete demo inventory and adapted hashes.

Audio2d originated in VANILLAJS, was consumed by SubHunt and is now reused here
directly. There is **no second vendored audio2d**. The new code is the generic
multi-phrase sequence and playback adapter, not a replacement arithmetic engine.

Vessels, fish, ducks, difficulty, salvage and campaign progression remain in
the demo. No Atari source, art or audio is included. The demo's logical canvas
coordinates use pixels, +X right and +Y down; this does not change the engine's
SI/+Y-up/-Z-forward world conventions. Combat remains a 60 Hz floating-point
arcade simulation, not a formally verified or cross-engine bitwise contract.

## Pure gamepad mapping

```js
import {
  defaultGamepadProfile, validateGamepadProfile, createGamepadMapper,
  captureGamepadBinding, gamepadReleased
} from './modules/gamepad/index.js';

const profile = defaultGamepadProfile({jump:0, attack:1, pause:9});
const mapping = createGamepadMapper(profile);
const input = mapping.read(pad); // {x, y, jump, attack, pause}
// pad is a caller-supplied Gamepad-shaped sample; the module does not poll.
```

Profiles have `{version:1, buttons, directions}`. There are 1–16 unique
action buttons (indices 0–127), with game-owned action names of up to 24 ASCII
characters. Names `x`, `y`, `constructor`, `prototype` and `__proto__` are reserved.
Directions are exactly `left`, `right`, `up`, `down`. Each is either
`{kind:'button',index}` or `{kind:'axis',index,value,neutral,button?}`. Axis indices
are 0–31; finite learned values/centres are bounded to ±16 to accommodate raw
adapter hats. A shared axis must use the same confirmed centre. Duplicate
bindings, unknown fields, inherited records and accessor properties are rejected.
Validation owns and freezes the profile; mutating source data cannot change an
existing mapper. Compile a new mapper to apply an edited profile.

`x` and `y` are unitless normalized input axes in [-1,1], with right/down positive
(device convention, not world coordinates). Ordinary axes use a 0.22 activation
threshold. Four equally spaced learned values on one axis support circular hats
and intervening diagonals. Button D-pads and optional axis fallback buttons work
without requiring `mapping === 'standard'`. Unsupported/missing device samples
return neutral controls; axes/buttons are bounded arrays of at most 32/128 entries.

`captureGamepadBinding(pad, baseline)` accepts one button or one axis excursion
of at least 0.5; ambiguous samples return null. `gamepadReleased` requires every
button released and axes within 0.15 of the confirmed baseline. The baseline
must cover every sampled axis. The consuming application owns the calibration
steps, labels, persistence, device identity, focus cancellation and reconnect
release gate. SubHunt Lab demonstrates all of those, including a swapped face
layout and a nonzero raw hat centre. Existing `input.FlightGamepad` is unchanged.

## Pure multi-phrase soundtracks

```js
import {createSoundtrack} from './modules/soundtrack/index.js';

// Each phrase is an existing audio2d {frames, events} score.
const track = createSoundtrack({phrases:[intro, response], tickRate:60});
const position = track.position(simulationTick);
const pcm = track.renderRange(0, track.frames);
const wav = track.wav();
```

Up to eight phrases are admitted. Each keeps audio2d's original limit of eight
seconds, 128 events and four non-overlapping lanes. Total length is bounded to
64 seconds at 48 kHz mono PCM16. `tickRate` must be an integer divisor of 48,000;
phrase lengths must end on exact tick boundaries. The default 60 Hz clock maps
one tick to exactly 800 samples. Unequal phrase lengths are supported.

`position(tick)` accepts nonnegative safe-integer absolute ticks and returns
`{phrase, offsetSamples, cycleSample}` within the looping score. It reduces the
tick before multiplying, so large valid ticks cannot lose sample precision.
`renderRange(start,count)` is a non-wrapping bounded slice of one complete loop;
`renderPhrase(index)` returns one phrase. `score(index)` returns an independent
editable copy. `frames`, `sampleRate`, `tickRate`, `samplesPerTick`, `phraseCount`
and `loopTicks` describe the immutable sequence. `wav()` exports one full loop.

The three demo compositions retain the SubHunt v0.2.0 WAV SHA-256 values:

| Theme | SHA-256 |
|---|---|
| Porcelain Patrol | `c764fe7f498ac40bb6dbb2856cbb906f021817736db4798bb7ecb2cad6834a3a` |
| Bubble Bank Boogie | `0f001c0ebe874adc3960d41867c177db62f1816eb41f5ff4753d70b7a90d080d` |
| The Last Plug | `c5437b0634a46f90d3d4b4cd7e85a7951796310621b146df59e408b3f3c2c042` |

## Opt-in Web Audio adapter

```js
import {createSoundtrackPlayer} from './api/audio/index.js';

// Create/resume the context from an accepted player gesture.
const playback = createSoundtrackPlayer(audioContext, track);
playback.sync(simulationTick, playing && musicEnabled);
// On pause, blur, menu, restart or pending-gesture cancellation:
playback.stop();
// When replacing the track or closing the application:
playback.dispose();
```

The adapter accepts only an authentic `createSoundtrack` result. Playback phrases
must be at least 250 ms, bounding lookahead voice creation. At most eight PCM
buffers are retained per player. It schedules half a second ahead, cancels both
current and queued voices on stop, and resumes at the supplied tick's sample
offset. Backward seeks or presentation drift above 120 ms reanchor playback.
Suspended devices stop scheduling. Failed starts disconnect partial resources;
the adapter throws so the application can report failure or continue silently.
Disposal clears buffers and rejects further sync calls. `snapshot()` reports
activity, voice/buffer counts, starts, resyncs, the last tick and disposal state.

The adapter neither creates nor resumes an AudioContext, installs listeners nor
advances a game's clock. The caller owns gesture promises and must check its
current enabled state after an asynchronous resume. SubHunt Lab reads that state
every frame. A soundtrack playback/export failure disables music for the current
session, retains sound effects and saved preferences, reports the failure, and
allows MUSIC to retry without restarting combat. Persisted music intent changes
only when MUSIC is explicitly toggled. FX/SOUND saves after a failure retain
that intent, and reloading retries an enabled preference; an explicit MUSIC-off
choice remains off after reload. Determinism covers
scores and generated PCM; device latency/resampling and oscillator effects are
outside that contract.

## Packaging and verification

The lab uses native ES modules and must be served over HTTP(S), like VANILLAJS's
other labs. Direct file opening remains a property of the standalone SubHunt
release, not of this adaptation. The lab registers VANILLAJS's package worker,
uses `vanillajs-subhunt-*` storage keys, and includes no private service worker,
runtime CDN, package manager or copied vendor tree.

Run `node --test tests/*.test.js`, `node scripts/check.js`,
`node scripts/build.js` and `node scripts/verify-offline.js`. The ordinary
packaged Chromium donor suite runs `scripts/browser-subhunt.js`, covering real
controls, both vessels, Pond Panic, raw USB calibration/cancel/reconnect,
pause/mute/focus handling, desktop/mobile layouts, WAV download, offline reload
and an eight-case playback/export failure-and-retry matrix. The shared browser dispatcher change invalidates
reuse; new source remains unqualified until reviewed main evidence exists.

Synthetic gamepads and emulated viewports do not establish physical USB or phone
compatibility. Existing immutable proof and hardware evidence remain unchanged.

The v0.3.0 standalone fix stages its vendor audio renderer into Pages. This
adaptation uses VANILLAJS native modules: its allowlisted build already packages
all of them, verifies asset hashes, and browser-tests `dist/` under the deployment
URL prefix. It does not copy SubHunt's private deployment scripts or service worker.
