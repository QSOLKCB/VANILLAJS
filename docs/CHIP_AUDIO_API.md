# CHIP-AUDIO-001 — SID-style ADSR × Paula-style PCM mixing

**Status: experimental and opt-in.** Independently written Apache-2.0 hybrid.
This is **not** cycle-accurate MOS SID, Paula DMA, MOD replay or Amiga analogue-circuit emulation.

## Why this is separate

VANILLAJS already has `audio2d` (deterministic mono procedural sound),
`soundtrack` (multi-phrase composition) and `vehicle-audio` (continuous
vehicle-telemetry effects). This new module replaces **none** of them.

Four signed 8-bit PCM sample voices use Paula-style 0–64 volume and
period-controlled stepping with channel assignment **0,3 left; 1,2 right**.
A SID-style four-stage envelope controls amplitude before each channel is
mixed. ADSR is an **envelope generator**, not a low-pass filter. Optional
`led-approx` is a separate deterministic integer one-pole low-pass; it does
not assert circuit equivalence with any real Amiga model.

## Pure API

~~~js
import {createChipAudio,makeChipWave} from './modules/chip-audio/index.js';
const lead=makeChipWave({wave:'square',frames:32,duty:120});
const score=createChipAudio({
  frames:48000,clock:'pal',filter:'led-approx',
  events:[{
    id:1,channel:0,start:0,duration:12000,gate:8000,
    period:253,volume:48,attack:1,decay:4,sustain:9,release:2,
    loop:true,sample:lead
  }]
});
const interleavedStereo=score.renderRange(0,1024); // Int16Array L/R/L/R
const wavBytes=score.wav();                      // stereo PCM16LE, 48 kHz
~~~

`makeChipWave` creates an original signed-8-bit, seeded wavetable:
square, saw, triangle or noise, 8–4096 samples. The sample source is
privately copied by `createChipAudio`. Events use absolute output-frame
start, duration, gate duration, 16-position SID-inspired rate nibbles,
a sustain nibble, Paula-like period 124–65535, volume 0–64, and loop flag.
Events on the same channel cannot overlap, but all four channels may mix.
All audio scheduling is explicitly sample-indexed, independent of the host
clock or browser frame timing. PAL/NTSC clock choices are 3,546,895 Hz and
3,579,545 Hz. The WAV output rate is fixed at 48 kHz regardless of period.

**Budgets:** 1–384,000 output frames (up to eight seconds), 128 events,
65,536 source bytes per event and 262,144 copied PCM bytes per score.
An event source must be a bounded signed `Int8Array` or dense plain array.
Rejected content does not mutate existing scores.

## Historical and numerical boundaries

- ADSR time nibbles use familiar nominal SID attack/decay/release durations,
  but the envelope stages are **linear**, not the SID's exponential clocked
  counters, re-gating bug or exact ADSR implementation.
- Sample stepping is integer-indexed nearest-neighbour with no resampling
  or antialiasing; no DMA, register interrupts or chip-RAM pointers exist.
- The optional low-pass is a software approximation; physical Amiga models
  filter differently. For arbitrary ranged rendering, it replays the prefix
  to reconstruct the exact filter state, so this is **not yet an AudioWorklet
  low-latency streaming backend**.
- Stereo 16-bit output encodes the sum of four 8-bit inputs. It does **not**
  implement the Amiga 14-bit channel-stacking technique.
- No engine gameplay rules, simulation, control state, browser APIs, global
  clock, downloaded audio samples, third-party engines or copyrighted songs
  are included in this pure module.

The caller owns device activation, Web Audio playback, focus cancellation,
resampling and integration. `renderRange` produces identical bytes when the
same score is split into subranges; `renderAll` and `wav` use that kernel.

## Listening lab

[Chip Audio Lab](../demos/chip-audio-lab/index.html) plays an original
three-second generated signal, with PAL/NTSC clock and approximate filter
controls, stereo visualisation, and a downloadable WAV. Audio is initiated
by an explicit user click. No network sample downloads or autoplay.

## Acceptance

~~~sh
node --test tests/chip-audio.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
~~~

Full repository CI, packaged Chromium listening checks, source-bound performance
measurements and owner approval are separate gates. Do not adopt in GFTA6,
Spooky, SubHunt or other games before a reviewed exact release pin.

Historical reference concepts: Commodore 64 Programmer's Reference Guide SID
envelopes; Amiga Original Chip Set Paula audio registers/channel assignment.
No Commodore ROM, commercial samples, tracker modules or source code were copied.
