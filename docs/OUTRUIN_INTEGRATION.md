# Outruin → Pursuit Lab

**[Play Highway Intercept](../demos/pursuit-lab/index.html)** — an original
Chase H.Q.–style pursuit demo, built with native JavaScript and Canvas2D.
Catch the runner, avoid civilian traffic, and make repeated bumper contacts
before the timer expires. Five cases cross a sunset coast, desert, forest,
neon harbour and rainy expressway. Each case gives three turbo bursts; arresting
a target repairs 30 armour. Traffic collisions cost 14 armour, shoulders slow
the car and prolonged off-road driving damages it. Brake overrides acceleration.

WASD/arrows drive and brake; Space or Shift uses turbo; P pauses/resumes; F
switches fullscreen. Standard gamepads use the left stick/D-pad, RT gas, LT brake,
A turbo and Start pause. Touch buttons appear on narrow/coarse-pointer screens.
Pause, focus loss, fullscreen transitions and controller disconnect cancel input.
Held controls must be released before reuse. Native fullscreen denial falls back
to Fit window. Fullscreen is entered only by an explicit gesture, never restored
on load. Fit window preserves the complete 16:9 image and HUD with letterboxing.
Menus scroll independently on short screens; Page mode permits a larger layout.

## What came upstream

Outruin's driving, display and audio lifecycle informed three experimental,
reusable components. Game fiction, missions, traffic rules, score, controls,
DOM layout and procedural art remain under `demos/pursuit-lab/`.

| Component | Contract | Outruin source |
| --- | --- | --- |
| `modules/road-arcade/index.js` | Pure SI vehicle response and smooth periodic curvature | `js/driving.js`, `js/sim.js` |
| `api/display/index.js` | Explicit-root fullscreen state, fallback and disposal | `js/display.js` |
| `api/audio/effects.js` | Bounded authenticated PCM buffers/voices and cleanup | `js/sound.js` |
| Demo renderer and score | Road projection, original cars and eight-phrase arrangement | `js/render.js`, `js/radio.js` |

Pinned donor: `QSOLKCB/Outruin` at
`c9a0839fa1f8329f3eee4c7fd8637ae78cbad8c7` (Apache-2.0).
`demos/pursuit-lab/PROVENANCE.json` records donor Git blobs/SHA-256s and current
adaptation hashes. `scripts/verify-pursuit.js` checks the local adaptation inventory.
The donor licence and NOTICE are retained. Runtime source remains shared with VANILLAJS.

## Loading after an update

An older offline worker can know the shared engine URLs without knowing a newly
added lab. Serving the new lab from the network alongside that worker's older
audio API prevents module linking, leaving its buttons inert.

The static build now places Pursuit's complete native-module dependency graph
under a directory named by the graph's SHA-256. Relative imports remain intact,
and changing any dependency changes the entry URL. An older worker cannot
substitute its shared modules into this graph. The new worker includes every
snapshot member in its existing verified offline inventory. No runtime package,
cache purge, forced worker takeover or preference reset is used.

Source development keeps ordinary shared imports. `scripts/pursuit-package.mjs`
generates the snapshot only in `dist/`; build tooling never ships. Offline
registration loads independently, and a failed game import shows a **Reload
lab** button and status message instead of an inert Start button.

For an already-open page from before this fix, close all VANILLAJS tabs and
reopen the lab to let a fully installed waiting worker activate. Saved sound
and display preferences do not need to be deleted.

The pursuit loop is inspired by Taito's Chase H.Q. instruction booklet
([manual scan](https://www.thegameisafootarcade.com/wp-content/uploads/2017/03/Chase-H.Q.-Game-Manual.pdf)).
This is an independent genre demonstration, not an emulator or a recreation of
the commercial game. Names, routes, palettes, car drawings and music are original.
No ROMs, commercial sprites, samples, dialogue, recordings or source are included.

## Road-local vehicle API

```js
import {createRoadVehicle, createRoadCurve} from '../modules/road-arcade/index.js';
const car = createRoadVehicle({topSpeed: 82, grip: 15});
const road = createRoadCurve([0, .002, 0, -.002], {segmentLength: 280});
let state = {offset: 0, speed: 0, lateralSpeed: 0, steering: 0, slip: 0};
state = car.step(state, {throttle: 1, steer: .4}, road.sample(0), 1 / 60);
```

Positive lateral offset is right; forward distance is positive along the road
(world -Z, +Y up). Offset/road widths are metres; speed and lateral speed are m/s;
acceleration, braking and drag are m/s²; curvature is 1/m; time is seconds.
Steering is [-1,1]; throttle/brake/boost are [0,1]. `slip` is lateral response
error in m/s, not a tyre slip angle. Steering response is per second, grip is a
per-second exponential relaxation rate. This is an arcade approximation, not
a tyre, suspension, rigid-body or collision model. Curvature drift uses an
authored 0.07-second response scale; presentation bends use an independent
exaggeration. No physical fidelity or cross-engine floating-point identity claim.

Options are owned/frozen. Defaults: top speed 82 m/s, turbo +24 m/s, acceleration
15 m/s², braking 32 m/s², drag 1.8 m/s², steering rate 4.8/s, lateral speed
8.2 m/s, grip 15/s, road half-width 6 m and shoulder width 3.3 m. Values must be
finite and at least .01; top speed ≤150, grip ≤60, widths ≤50, others ≤100.
State bounds: speed [0,250], lateral speed [-150,150], steering [-1,1], slip
[0,300], offset within half-width + shoulder width. `step` returns a new state,
validates before producing a result, and accepts dt [.001,.1] and curvature
[-.05,.05]. Braking wins over gas/turbo. A stationary vehicle cannot slide from
steering. Turbo expiry decelerates naturally instead of snapping to normal speed.

Curves own 2–128 finite samples in [-.05,.05], joined periodically with smoothstep.
Segment length is [1,10000] m; `sample` accepts distance [0,1e9] m. No browser
globals, wall clock, unseeded randomness or mutation of caller state.

## Display lifecycle

```js
import {createDisplayController} from '../api/display/index.js';
const display = createDisplayController({root: document.querySelector('main'),
  initial: 'fit', onTransition: cancelInputAndPause,
  onChange: view => updateLayout(view.mode), save: persistWindowMode});
// Call from a click or key gesture:
await display.setMode('fullscreen');
```

Modes: `fit`, `page`, `fullscreen`; initial mode is windowed only. `snapshot()`
returns mode, windowed, fullscreen, pending, message and disposed. Actual
`document.fullscreenElement` is authoritative, including Escape/external changes.
Concurrent requests return false while pending. `setMode` resolves whether the
requested mode was reached; rejected/unsupported entry falls back to fit. Storage
callback failures are contained. Callback implementations own their errors.
The adapter doesn't set CSS, save preferences, acquire inputs or own game pause.
`dispose()` removes its listener and suppresses callbacks; an outstanding entry
that completes after disposal is exited if its root still owns fullscreen.
An already-completed fullscreen session remains caller-owned on disposal.

## Sound and effects

The demo reuses existing `soundtrack` and `createSoundtrackPlayer`. Eight authored
four-second phrases form **Night Shift**, a 32-second mono PCM16 48 kHz loop.
WAV export renders every phrase, not just the current one. Integer synthesis,
authored notes and seed-indexed noise are deterministic; device clocks affect
playback scheduling only. The music resumes at the simulation tick. Speed-band
engine loops, siren, turbo, impact, crash, pass, sighted, clear and failure cues
use `audio2d`. No new synthesizer backend or runtime dependency is added.

`createSound2D` results now have a private identity brand, checked by `isSound2D`;
PCM generation and existing score serialization are unchanged.

```js
import {createEffectPlayer} from '../api/audio/index.js';
const effects = createEffectPlayer(context, {maxVoices: 12, maxBuffers: 32});
const handle = effects.play(score, {pan: -.4, gain: .8});
effects.stop(handle);
effects.dispose();
```

Both budgets are integers [1,64]. Only authentic immutable `createSound2D`
objects enter the cache; same-content distinct objects have distinct identities.
Buffers use LRU eviction and active voices evict oldest first. Options: explicit
device `when` (nonnegative seconds), `offset` (nonnegative seconds), pan [-1,1],
gain [0,2], boolean loop. Late playback seeks forward; expired one-shots and
suspended devices return null. A handle is opaque and local to its player.
Source/gain/panner nodes are independently disconnected on end, stop, eviction,
partial construction failure or disposal. `stopAll`/`dispose` are idempotent;
`play`/`stop` reject after disposal. The caller owns device creation/resume,
destination, gesture and recovery. Cache bounds do not include temporary PCM
rendering allocations; each score is limited by audio2d to eight seconds.

The demo stores only the user's sound/display preference, separately from a
session audio failure. Playback and WAV-export failures cannot stop driving or
silently persist mute. Toggle Sound to retry a recoverable device failure.
Case-clear, campaign-win and failure cues finish naturally over their result
screens after the music and engine stop. Pause, focus loss, display transitions,
mute, a new shift or the next case still cancel every active voice.

## Replays and verification

`pursuit.v1` records seed, ≤54,000 input masks and ≤4 legal next-case commands.
The simulation is fixed at 60 Hz; catch-up is capped at six ticks per frame.
Five 70-second catch phases and five 60-second contact phases fit inside the
nine-minute tape bound. Timers reset when the target is first sighted. Contacts
require lateral alignment and separation before another hit; longitudinal sweeps
cover crossing between ticks. Overtaken targets accelerate back ahead until
they regain a 35 m lead. Traffic is seeded and bounded to 24 cars.
The exported record replays in the same rules version; there is no imported-code
execution. Floating-point replay identity is tested in the executing runtime,
not promised across engines. Export does not claim a cryptographic authenticity
signature. The lab currently provides export and a pure replay function, not a
user-facing replay viewer or a content-pack workshop.

Run `node --test tests/*.test.js`, `node scripts/check.js`,
`node scripts/build.js`, `node scripts/verify-offline.js`, and the packaged
Chromium suite (`node scripts/browser-check.js --suites=donor`, with Playwright
supplied as CI tooling). `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may explicitly select
an existing local Chromium; CI's default remains the pinned installation.
No browser installation is performed by this lab.

Tests cover three complete winning campaigns with legal control inputs and exact
replay, timeout and collision losses, turbo edges, invalid tapes, handling bounds,
display denial/late disposal, effect budgets and cleanup, actual keyboard/pointer
controls, pause/focus cancellation, native fullscreen, fitted layouts, downloads,
standard-pad disconnect and cached offline reload. Hardware gamepad feel, mobile
Safari fullscreen and audible device quality still need human/device coverage.
`?test=1` exposes only a bounded fast-forward helper using the same input-step
function; normal pages expose read-only snapshots and replay export.

Browser reuse still requires reviewed-main witnesses. Edited shared runtime,
dispatcher and policy bytes invalidate reuse; this change does not bless new
hashes as reviewed or trigger the owner's physical runner.
