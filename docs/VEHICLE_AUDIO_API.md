# Vehicle audio API

`modules/vehicle-audio/index.js` provides original, continuous engine, exhaust,
tyre and gearshift synthesis. It is an **experimental presentation module**:
audio never feeds forces or timing back into `vehicle3d`.

It produces mono `Float32Array` PCM using explicit sample counts, owned phase and
filter state, and seeded noise. It does not create an audio device or read a
browser clock. The HORIZON adapter owns Web Audio separately.

## Sound recipe

```js
import {
  defaultVehicleSound, validateVehicleSound, parseVehicleSound,
  serializeVehicleSound, createVehicleVoice
} from '../modules/vehicle-audio/index.js';

const recipe = defaultVehicleSound();
recipe.cylinders = 6;
recipe.exhaustTone = 1.25;
const accepted = validateVehicleSound(recipe);
const exported = serializeVehicleSound(accepted);
const restored = parseVehicleSound(exported);
```

Adjust the relative import to the consuming project's location. These are the
actual named exports; no global engine instance is required.

| Field | Required value or bound | Meaning |
| --- | --- | --- |
| `format` | `qsol.vanillajs.vehicle-audio.v1` | Data contract identifier |
| `version` | `1` | Recipe implementation contract |
| `seed` | Integer 0–4294967295 | Deterministic procedural noise seed |
| `cylinders` | Integer 2–12 | Four-stroke firing events per two revolutions |
| `engineGain` | 0–0.4 | Linear harmonic engine contribution |
| `exhaustGain` | 0–0.4 | Linear exhaust harmonic/noise contribution |
| `tyreGain` | 0–0.4 | Linear slip and braking contribution |
| `shiftGain` | 0–0.4 | Linear gear-change transient contribution |
| `exhaustTone` | 0.5–2 | Exhaust frequency multiplier |
| `smoothingMs` | 5–120 | Per-sample control smoothing time constant, milliseconds |

All fields are required. Unknown fields, symbols, accessors, unsupported
versions, inherited records, nonfinite numbers and out-of-range values reject.
`validateVehicleSound` accepts an ordinary or null-prototype record and returns
an owned frozen copy. `defaultVehicleSound` returns a fresh mutable recipe.
`parseVehicleSound` accepts JSON text of at most `VEHICLE_AUDIO_BYTES` (2048 UTF-8
bytes), then applies the same validator. Imported values remain inert data.

The defaults are seed 7331, four cylinders, engine/exhaust/tyre/shift gains
0.2/0.15/0.14/0.08, exhaust tone 1 and smoothing 35 ms. They are generic original
voicing settings, without an authored car identity or a realism claim.

## Explicit sample stream

```js
const voice = createVehicleVoice(restored, { sampleRate: 48000 });
const input = {
  rpm: 4200, throttle: 0.8, load: 0.9, slip: 0.1,
  brake: 0, speed: 32, gear: 3
};
const first = voice.render(input, 2048);
const next = voice.render(input, 2048);
console.log(voice.snapshot().samples); // 4096
voice.reset();
```

`createVehicleVoice(profile, {sampleRate})` validates and owns its profile. The
default sample rate is 48000 Hz; integer rates from 22050 through 96000 are
accepted. Its frozen interface exposes `profile`, `sampleRate`, `render`,
`snapshot` and `reset`.

`render(input, frames)` holds one strictly validated input record for exactly
`frames` samples. The integer frame bound is 0–8192
(`VEHICLE_AUDIO_MAX_FRAMES`). Each call returns a new mono `Float32Array`.

| Input | Bound | Unit or convention |
| --- | --- | --- |
| `rpm` | 0–18000 | Revolutions per minute |
| `throttle` | 0–1 | Supplied accelerator demand |
| `load` | 0–1 | Normalized contact/load presentation control |
| `slip` | 0–1 | Normalized tyre-slip presentation control |
| `brake` | 0–1 | Supplied brake demand |
| `speed` | 0–250 | Absolute speed in metres per second |
| `gear` | Integer −1–12 | Reverse, neutral, forward gears |

RPM sets the engine firing frequency, `rpm * cylinders / 120`. Throttle and load
change its intensity; exhaust tone changes its harmonic voicing. Tyre sound
requires speed and load, then responds to slip and braking. Supply zero load and
slip for airborne wheels. A gear change after the first rendered input produces
one 90 ms mechanical transient; holding the gear does not repeat it.

Smoothing, phase, noise position and transient state continue across calls. A
zero-frame call validates but advances nothing, including gear edges. Rejected
inputs or frame counts preserve the accepted stream. `reset()` returns all
stream state to its initial condition, including sample position and seed use.

`snapshot()` returns frozen diagnostic data: `sampleRate`, `samples`, `phase`,
`exhaustPhase`, `tyrePhase`, `noiseLow`, `shift`, `gear` and smoothed `controls`.
Snapshots are inspection data, not a supported restore/import format. The
sample counter rejects advancement beyond JavaScript's safe integer range.

## Numerical and timing boundary

For an unchanged implementation, profile, rate and ordered held-input sample
spans, the same runtime produces identical PCM. Splitting a held span into
different buffer lengths preserves every sample and the ending state. Editing
returned PCM cannot mutate the voice.

Synthesis uses Float64 arithmetic and trigonometric functions, then stores
Float32 samples. The mix is clamped to ±0.95 before Float32 storage. This is not
Q16.16 mathematics, cross-engine bit-exact audio, encoded-file identity or a
physical combustion/tyre acoustics model. Seeded noise uses a 32-bit sample
index and repeats after 2³² samples; race-length use is the intended scope.

The Node regression fixture records the observed source PCM digest. Device
resampling, output hardware and browser scheduling are outside that identity
boundary. An identical *physics* replay can have different cosmetic audio when
its render cadence supplies telemetry at different sample boundaries. To compare
PCM exactly, replay explicit input/sample spans rather than wall-clock updates.

## HORIZON browser adapter

`demos/horizon-lab/race-audio.js` exports `RaceAudio` and
`vehicleSoundControls(state, input = {}, mass = 1200)`.

The latter reads the real `vehicle3d` snapshot without mutation. It uses absolute
world velocity for speed, the supplied throttle/brake demand, actual RPM and
gear, and only grounded wheels for load/slip. Summed wheel load divided by
`mass * 9.81` is clamped to 0–1; the largest grounded wheel slip proxy divided by
2 is clamped to 0–1. This is an explicit presentation mapping of the vehicle
approximation's telemetry, not a new tyre simulation. Mass is 500–4000 kg.

```js
import { RaceAudio } from '../demos/horizon-lab/race-audio.js';
const audio = new RaceAudio(restored);
soundButton.addEventListener('click', () => audio.start());
// From the consuming game's active frame callback:
audio.update(vehicleState, { throttle: 0.8, brake: 0 }, vehicleRecipe.mass);
// On pause, blur, hidden tab, restart or rendering failure:
audio.stop();
// Resume only from an explicit user gesture, if sound remains enabled:
// await audio.start();
// On teardown:
audio.dispose();
```

The consuming UI must supply the shown local variables and hook its own input
and lifecycle callbacks. Calling `update` before `start` cannot create or resume
an audio device. `start()` resolves to a success boolean and must be called from
a user gesture. `stop()` immediately silences and disconnects all scheduled
sources, resets synthesis and preserves the enabled preference. It does not
restart automatically. `disable()` also clears that preference.

`setProfile(value)` validates before replacing the accepted voice; rejected edits
preserve playback. Accepted edits cancel queued old-profile sound. `dispose()`
is idempotent and closes the owned context. Late asynchronous resume completions
cannot undo cancellation or disposal. Device or buffer failures stop the entire
queue, disable sound and expose an error; a new explicit `start()` retries with
a fresh context. Gameplay remains owned by the caller.

The adapter schedules 2048-sample mono 48 kHz buffers with 75 ms lookahead and a
maximum of four sources. It holds the newest supplied telemetry for each queued
buffer, and resets on underruns instead of replaying stale sound. There are no
background timers, worklets, downloaded assets or automatically resumed devices.
`enabled`, `context` and `snapshot()` expose diagnostics; the context remains
adapter-owned. A trusted `contextFactory` constructor option supports tests.

The complete race-project export includes this validated profile and the native
audio runtime. The profile serializer exports only sound settings; it is not a
WAV encoder or a complete game exporter.

## Verification and provenance

Run `node --test tests/vehicle-audio.test.js tests/horizon-race-audio.test.js`.
These tests cover source PCM identity and chunk continuity, actual pitch and
mix changes, bounds, seed changes, strict rejection, transient expiry, real
telemetry mapping, bounded scheduling, device failures, pending resume races,
cancelled tails, transactional edits and disposal. Packaged HORIZON browser
verification exercises the consuming game and its sound controls.

The algorithms, profiles and adapter are original VANILLAJS work under
Apache-2.0. No external recordings, music, engine source or runtime dependencies
are included. Existing `audio2d`/`soundtrack` continue to own their finite integer
PCM event/score contracts; this module adds continuous telemetry-driven audio
without changing them.
