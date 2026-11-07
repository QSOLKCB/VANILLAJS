# DEMO//SYNTH — deterministic audio, tracker music and demoscene visuals

**Status: implementation proposal, not an implemented API.**  
Planning base: VANILLAJS `90b2fe1f3428710eade90cc328c9e6bf7e18f457` (the reviewed post-PR #35 main).
No runtime, GPU workflow or archived RTX001–004 evidence is modified by this proposal.

## 1. Product vision and decisive design rules

Build a small, offline-first **VANILLAJS DEMO//SYNTH** API from existing engine primitives.
It should eventually support original Amiga-era-style tracker compositions, rendered
procedural instruments, Web Audio playback, beat-locked WebGL scenes, pixel-art and 3D
typography, camera choreography, and small reproducible downloadable demo packages.

The first deliverable is **one actual original 45–90-second audiovisual intro** with
four-channel synthesized music, a precise timeline, two graphics effects, one
bitmap/vector text scroller and a generated export receipt. Avoid an API that
has no consumer. No proprietary soundtrack, commercial samples, borrowed
demoscene binary/code or copied Second Reality assets; that demo is an
**aesthetic reference**, not an implementation donor.

**Non-negotiable invariants:**

1. **Music time is authoritative.** Frame presentation, DSP scheduling and
   visual events are derived from an integer sample index, never elapsed
   `requestAnimationFrame` timestamps, `Date.now` or wall-clock rounding.
2. **DSP is pure.** The source-backed synthesizer never calls Web Audio, WebGL,
   DOM, device timers, unseeded randomness or arbitrary network services.
   A browser audio adapter is a separately owned side effect.
3. **Identity has a version.** Source data, authored mapping, DSP ABI,
   sample rate, seed, pattern/order data, synthesis tables and output profile
   are all identity-bearing. A seed alone does not determine a song.
4. **Three modes, never conflated.**
   - **Canonical Strict:** bounded fixed-point/integer DSP, exact PCM16LE and
     container byte identities across supported conforming engines.
   - **Replay Safe:** explicit versioned Float64 creative DSP, reproducibility
     scoped to a declared runtime/profile, without a cross-browser bit-exact claim.
   - **Live:** device-backed Web Audio/interactive knob performance; audio timing
     and hardware output are noncanonical. Performance capture is never
     mislabeled as a Strict archive.
5. **Original MOD compatibility is tested, not assumed.** A proprietary
   `.qdem.json` project is never renamed `.mod`; only a genuine documented
   31-sample, four-channel, 64-row ProTracker-compatible byte encoder may
   export a `.mod`, with an explicit supported effect subset.
6. **Audio and graphics have distinct fidelity claims.** Samples and event
   scheduling can be byte-exact. GPU pixels may differ across drivers, shaders
   and hardware; declare native-renderer-specific pixel checks rather than
   claiming cross-platform exact framebuffer hashes.
7. **Correctness outranks speed.** Keep a slow reference DSP and forced-fresh
   renderer. OPT transformations are promoted only after exact or explicitly
   bounded equivalence evidence, never because a faster synthetic benchmark
   looks attractive.
8. **Minimal dependency discipline.** Browser-standard ES modules/typed arrays,
   Web Audio + WebGL1/2; no npm *runtime* packages, CDN, server, tracker plugin,
   game engine, Docker or cloud account. Node is acceptable for existing
   development-only CI. Optional FFmpeg is an external offline packaging step,
   not part of the deterministic core.

## 2. Source-pinned repository roles

Every source below is an input to *design*, not inherited proof coverage.
Read the exact files and their license notices before code migration.
Independent implementations plus tests are preferred, especially across
MPL-2.0 / MIT / Apache-2.0 boundaries.

| Donor | Verified reference | Role / boundary |
| --- | --- | --- |
| **E8_MUSIC** | `QSOLKCB/E8_MUSIC@d8e5983d84af03f03a969abe3356dcf80c0e0e97`, `CANONICAL_SONIFICATION.md` | Separate exact source-forced mappings from *authored* E8/ETQ composition, source/PCM/WAV SHA chain; MPL-2.0 |
| **TONELAB** | `QSOLKCB/TONELAB@1801cd3f25cf63d329ede7fdb5c26a3dd640baae`, `dsp.js` | Explicit oscillator/envelope/pulse/channel routing, Nyquist/headroom and bounded WAV export; MIT |
| **SONIFICATION** | `QSOLKCB/SONIFICATION@5a9af7876dac3f55839f2a23d7655d70c2158990`, `docs/ETQ_V3_EVENT_PROTOCOL.md` | ETQ-303 exact symbolic event documents and D4-triality event adapters, **never PCM in its root runtime**; MPL-2.0 |
| **SPECTRAL** | `QSOLKCB/SPECTRAL@49401fa010ed673e3d3977ccd5e06d66b0d65096`, `APP/README.md`, `rb-420/README.md` | Canonical Strict / Replay Safe boundary, versioned seeded PCM, 8-channel creative tracker, manifests and digest tests; MIT |
| **QEC** | `QSOLKCB/QEC@27bbc798c4e38138ca5b0fff70b15c3271a1917d` | SHA-256 replay admissions, immutable source witnesses, independent validators; do not suggest a quantum decoder changes audio quality; MPL-2.0 |
| **OPT** | `QSOLKCB/OPT@7556dd36acd53ed3ed538fd03b1db44e5c1ec869` | `OPT-DSP-001`, `OPT-INV-001`, `OPT-INC-001`, `OPT-REDUCE-001`, `OPT-POOL-001` for CI/evidence-gated DSP and rendering; Apache-2.0 |
| **CorpoWars3d DOS** | `QSOLKCB/CorpoWars3d@5701949e4ef7047b715db808b777450c3bf49d53`, `games/dos/src/mod.c`, `games/dos/tests/music.c` | Independent **C99 four-channel MOD loader/player** and three original `.MOD` fixtures; *limited* supported effects (0/no command, Cxx, Fxx), not a full ProTracker oracle; Apache-2.0 |
| **Audio-To-Video** | `QSOLKCB/Audio-To-Video@6cd8839764b4926de4bcc71463014886bcdf1aa2` | Later offline visualizer/video-export interoperability and deterministic visual test patterns; desktop dependency isolated from browser engine |
| **VANILLAJS** | `90b2fe1f3428710eade90cc328c9e6bf7e18f457` | Fixed/integer clocks, source-pinned replay, WebGL API, retained geometry, FrameGate, OMI and E8 research, original Clockwork Vault demo. Reuse rather than replace. |

**Important donor limitations:** SPECTRAL RB-420's eight-channel pattern editor
is not automatically a true `.mod` encoder, and its documented effect codes
are initially data-only; importing its UI does not confer correct tracker
semantics. CorpoWars3d's C99 player supports only a narrow, valid MOD subset
and caps its own patterns; it cannot prove compatibility with every Amiga
tracker or player. E8 and qutrit musical mappings are authored creative
receivers; they are not intrinsic frequencies derived from physics.

## 3. Proposed module boundaries (one-way imports)

```text
E8_MUSIC / SONIFICATION / QEC data     local pattern editor / authored score
                 |                                    |
      bounded source/event adapter              normalized project
                 +----------------+-------------------+
                                  |
                  canonical event / pattern document
                                  |
    sample-exact transport + four-channel tracker + oscillator/sample voices
                                  |
                 pure bounded PCM DSP (offline oracle)
                      |                         |
            PCM16 / WAV / MOD exports       immutable audio-control
                      |                     events + envelope cues
                  SHA256 receipts                  |
                      |                      scene timeline (sample indexed)
                      |                         |
                Web Audio preview         WebGL / Canvas / text objects
                 (best effort)                   |
                                         reference scene/command hashes
                                                  |
                                  archival AV bundle (project + evidence)
```

Suggested **public API** paths, each opt-in, with no ambient browser imports:

```text
modules/dsp-core/         PCM16LE mixer, fixed-phase oscillators, envelope, wave tables
modules/tracker-core/     pattern/order sequencer, four voices, deterministic tick table
modules/tracker-mod/      constrained .MOD encoder/loader and strict compatibility tests
modules/demo-timeline/    sample-indexed cues, beat/row events, seek and checkpoint
modules/demo-spectrum/    PCM-derived control envelopes / bounded spectrum analysis
modules/demo-scene/       serializable visual effect/actor commands (no WebGL dependency)
modules/demo-text/        deterministic bitmap glyphs, scroll and extruded text geometry
modules/audio-playback/   opt-in AudioWorklet bridge (browser-only)
modules/demo-receipt/     canonical project / PCM / MOD / visual source receipts
demos/demoscene-lab/      tracker UI and first complete music+visual intro
```

The first PR should **not** create every directory. Start with `dsp-core`,
`tracker-core` and `demo-timeline`, then one consuming lab. Add other modules
only when justified by a working demonstrated contract. `MODULES.json`,
`docs/API.md`, `NOTICE` and `scripts/check.js` must reflect real imports.

## 4. Authoritative timing and independent render paths

All music/visual positions are integer counts. Choose a **logical**
48,000 samples/second in the first Strict profile, independent of the live
audio device's actual negotiated sample rate. Use exactly **50 presentation
frames/second** (PAL-inspired) for the first demo; 60 fps and 25/30 fps exports
are later independent profiles.

For output frame `f` and tick `k`:

```text
firstSampleOfVisualFrame(f) = floor(f * 48000 / 50)
ProTracker tick duration     = 5 / (2 * BPM) seconds
firstSampleOfTick(k)         = floor(k * 48000 * 5 / (2 * BPM))
```

The direct `firstSampleOfTick` formula applies to a **constant BPM** segment.
Tempo changes require a carry-preserving rational accumulator; keep numerator,
denominator, cumulative sample index and carry in the snapshot. Use integer or
BigInt arithmetic for products that could exceed JS safe-integer limits.
At BPM 125, speed 6, one tick is 960 samples, one row is 5,760 samples,
and a 50 Hz scene frame is exactly 960 samples. There is no browser-clock
guesswork in that offline profile.

**Realtime Web Audio:** user-gesture gated `AudioContext` and
`audioWorklet.addModule()` run the same bounded generator logic outside the
main UI thread. Feed it versioned commands/initial snapshots with lead-time
and explicit underrun/late-command reporting. The audio render sample counter
is the transport master; the visual scheduler follows its measured position.
Device-output latency, audio context resampling and display jitter must be
recorded and are not identity-bearing audio samples. Never use
`ScriptProcessorNode` as the mandatory real-time implementation. Under
unsupported/insecure contexts, offer downloaded/offline audio or an explicit
unavailable message, **not** a fake deterministic playback claim.

**Offline render:** use the pure DSP directly (not an undocumented
`OfflineAudioContext` promise) to produce exact PCM16LE and WAV bytes.
Changing chunk size 128/256/4096/whole-file must leave PCM **identical**.
Pause, seek, rewind and replay restore sample-level state exactly.

**Visual frame function:** `frameAt(sampleIndex, projectSnapshot)` emits
bounded, complete, ordered scene commands. For a given project and sample index,
camera, glyph positions, particles and palette indices must match regardless
of previous presentation history. Where state evolution is necessary, use
exact checkpoints plus replay from the nearest checkpoint, with bounded work.

## 5. Audio features: start with real tracker constraints

### Milestone 1: deterministic synth and tiny song

- Four mono sample voices, basic note trigger, stop, instrument, volume and
  signed 8-bit sample playback. Fixed-point phase/position, explicit
  interpolation mode (initially nearest or otherwise byte-locked), bounded mix.
- Pure procedural instrument generator: four original chipsounds such as a
  bass, lead, arp and noise/percussion; integer PRNG seeds; small sample banks.
- Allow loop start/length, per-voice levels, panning in a separately declared
  stereo output profile. Do not claim Amiga Paula hardware emulation.
- PCM16LE 48 kHz archival export, SHA-256 exact fixtures for a 45–90 s tune.
- A 4-lane, 64-row piano-roll/tracker screen, song orders and a playback position
  display. Fixed notes/tempo/seed in one downloadable `.qdem.json` project.

### Milestone 2: real MOD interchange

- Real 31-sample / four-channel ProTracker-compatible `M.K.` binary layout,
  64 rows/pattern, 128 order entries, signed PCM8 sample bytes,
  big-endian period/sample metadata and explicit loop/volume limits.
- Strict **initial supported effect subset** must match independently
  exercised donor C99 behavior: 0 with zero parameter (none), Cxx
  set-volume, and Fxx speed/BPM. Validate Fxx boundaries and zero handling.
- Extend commands (slides, vibrato, break, position jump, arpeggio) only as
  separately covered patches and with independently owned test fixtures;
  never silently ignore unsupported effects when claiming exact replay.
- Compare our loader/encoder and sample clocks against original owned
  CorpoWars3d `ACTION.MOD`, `BOSS.MOD` and `MENU.MOD` using the C99
  reference in optional test-only conformance. Keep assets outside the runtime
  unless their inclusion, provenance and packaging are explicitly approved.
- MOD byte equality, track/pattern equality and **PCM equality under a declared
  restricted player model** are distinct assertions. External MOD playback
  engines may use different interpolation/mixing. A true .MOD export is
  not necessarily bit-identical to our richer stereo project.

### Milestone 3: mathematical instrument/effect adapters

- `E8`: exact root inventory → selected/root-family events → *authored*
  pitches/rhythms/timbres. Precompute static topology; no 240-root recompute per
  audio sample. Existing VANILLAJS E8 experiment can provide a pure fixture.
- `ETQ-303`: import event documents from SONIFICATION's root protocol
  **read-only**, then map them to tracker note/control events via a separate
  versioned artistic profile. Do not call an audio routine from SONIFICATION
  root or mutate its symbolic artifacts.
- `TONELAB`: deterministic sine/poly waveform recipes, pulse envelopes,
  harmonic/three-tone routing and headroom. Tone labeling is acoustical,
  not a medical treatment or physiological claim.
- `SPECTRAL`: QEC/OMI event textures, fixed-rate oscillators and
  optional Replay Safe spectral effects. Distinguish signal-derived
  creative mapping from direct source audification.
- `QEC`: use exact event streams and cryptographically identified replay
  receipts where appropriate; no live quantum decoder or claimed
  enhancement to sound quality.

## 6. Visuals: proper demoscene craft

First visual effects should be small, procedural and reproducible:

1. **Copper/raster bars + palette cycling**, in Canvas 2D or WebGL,
   seeded and sample-indexed. Use authentic-looking colour rhythms without
   asserting chipset-level Amiga emulation.
2. **Plasma and rotozoom**, fixed input/tile/grid sizes; OPT
   precomputes invariant trig/LUT data only after parity gates.
3. **3D extruded block text / perspective fly-through**, using an
   **original deterministic glyph mesh** rather than CSS/system font
   rasterization. Add an indexed bitmap scroller, sine wave glyph paths,
   kerning table, credit pages and foreground/background layers.
4. **E8 root-lattice flythrough** and procedural tunnels/voxel grid
   using retained geometry, chunk batching and FrameGate.
5. **Beat-synced spectral bars and trigger cues** derived from
   *the same canonical audio samples*, never a live microphone or
   uncontrolled browser analyser in the Strict path.

Start with a 3-scene, approximately one-minute first intro:
**COLD BOOT** (copper bars + boot text) → **LATTICE DRIVE**
(rotate/plasma + E8/ETQ beats) → **THE SCROLLER** (large 3D credits,
animated original logo and old-school greets). Scene boundaries are
explicit sample indices; arbitrary frame rates only change how often
the same timeline is sampled. The intended emotional style can salute
1990s demos such as Future Crew's *Second Reality* without copying
the music, original effects code, distinctive graphics or text.

**No visual drift:** A trigger at audio sample `s` is visible on exactly
the visual frame containing `s` under the declared sample/frame rule.
If rasterization is GPU-backed, require deterministic command and
geometry hashes plus same-device pixel/visual assertions; do **not**
claim identical pixels on NVIDIA, SwiftShader and every browser.

## 7. Pack formats and reproducible receipts

Start with a readable canonical project:

```text
demo.qdem.json
  schemaVersion, receiverMode, seed, sourcePins
  sampleRate, visualFps, tempoSegments, orders, patterns
  instrumentProfiles, waveform/sample digests
  timeline, scenes, cues, glyphAtlasVersion, exportProfile
```

Reject unknown schema, duplicate sample IDs, invalid indices, negative/overlarge
counts, nonfinite numeric values, sparse command arrays, cyclic references,
unsupported file extensions/effects, path escapes, and inconsistent total
sample counts. Canonical Strict identity uses explicitly validated safe
integers and stable-key JSON serialization. Sources, profiles and runtime
capabilities must not be inferred from filenames alone.

Result bundle (no timestamps in identity-bearing bytes):

```text
demo.qdem.json
music.mod                 (only after real MOD conformance)
music.wav                 (canonical PCM16 + RIFF)
audio-events.json         (sample-stamped)
visual-command-stream.bin (versioned, ordered)
scene-profile.json
SHA256SUMS
MANIFEST.json             (non-self-referential receipt)
```

Hash the normalized project, event stream, PCM payload, WAV bytes,
MOD bytes (if present), glyph/topology source, scene-command stream
and output receipt with **domain-separated SHA-256** preimages.
Do not derive an archive identity from its own included hash.
Keep a strict verification mode that reads and validates without rewriting
witnesses. The canonical project is the source of record; an exported MP4 is
a *distribution derivative*, with codec and encoder identities in a separate
manifest. Use TOMBSTONE-style immutability/replay patterns rather than
creating a new dependency.

A future optional `intro64k` profile may cap the **payload**
(song+scene+glyph+instrument data) to 64 KiB compressed; define exactly
what counts in that budget. The browser runtime, WebGL implementation and
web-platform library sizes do not disappear simply because the data pack
is small. A genuine 4 KiB/64 KiB executable intro is a separate future
native/WebAssembly engineering target, not a v1 claim.

## 8. CI and optimization: exact oracle first

**Host CI** (ordinary shared hosted runner, no physical GPU):
- Pure JS tests for oscillator phase, fixed-point saturation, sample-rate
  quantization, note and tracker effect ordering, independent fixtures,
  complete replay/seek and bounded input rejection.
- At least 3 chunk sizes must produce **identical PCM16LE**, track state and
  control-cue events. Different seeds differ; equal seeds alone are
  insufficient when other inputs change.
- Binary `.MOD` header, offset, 31 sample descriptors, order/pattern,
  64-row, supported-effect, loop bounds and PCM8 round-trip checks.
  Cross-check selected fixtures with the C99 reference without claiming
  full legacy-ecosystem conformance.
- Separate test for Strict and Replay Safe identities; no path by which
  an unverified browser decoder or `Math.sin` output enters Strict PCM.
- Project serialization and SHA-256 checks; mutate hashes, wrong build IDs,
  truncated inputs, oversized loops, resource/path attacks and re-ordered
  events; all fail closed without partially issued success manifests.
- Packaged Chromium: audio click-to-play, worklet installation on a secure
  local origin, pause/resume/seek, context loss, reduced motion, keyboard
  controls, denied autoplay, unsupported Web Audio, unsupported WebGL,
  zero network calls, and mobile layout.
- Visual tests: raw command/mesh bytes and sampled frame events compared with
  a forced-fresh reference. Native GPU pixel tests require device identity.
- Only generated local known-answer audio is used in hosted CI, **not**
  copyrighted commercial music and not external model downloads.

**OPT candidates:** `OPT-DSP-001` (sample-rate vs control-rate separation),
`OPT-INV-001` (static oscillator/E8 LUT reuse),
`OPT-INC-001` (signature-bound rebuilds), `OPT-REDUCE-001`
(reject inaudible/out-of-view processing), `OPT-POOL-001`
(bound typed-array buffers) and `OPT-BUDGET-001`
(environment-specific regression budgets). Keep full-lifecycle
memory/CPU/GC/underrun observations and inspect the slow/reference
path. `OPT-DSP-001` expressly warns that holding one control value
for an entire arbitrary render block is **not** a verified equivalent
optimization. No approximation goes live without a quantified error
bound, reference and test.

**Owner RTX 5060 Ti workflow:** introduce a separate, manually dispatched
`rtx5060ti-demoscene.yml` *after implementation and reviewed merge*:
`github.actor == EmergentMonk`, `main` exact SHA,
`acknowledge_local_execution=true`, runner
`[self-hosted, linux, x64, qsol-rtx5060ti]`.
Validate the original RTX archives without overwriting them.
Run same-source/same-scene forced-fresh vs retained WebGL on a visible GPU,
check framebuffer parity, measure draw calls, uploads, CPU prep,
frame intervals and driver/GPU identity. Separately run timed offline
DSP CPU profiles and exact source/PCM hashes. Report AMD Ryzen CPU / RTX
driver / Chromium versions and control ambient thermals where feasible.
No synthetic CPU timings are presented as GPU acceleration. Evidence is
written to a fresh outside-repository directory and uploaded only by
explicit `publish_evidence=true`. A later preservation PR commits the
**exact downloaded ZIP bytes** and its checked SHA-256.

## 9. Incremental delivery plan and acceptance gates

| Phase | PR-sized deliverable | Review/acceptance criterion |
| --- | --- | --- |
| **P0: Contracts** | This ADR, canonical data/identity design, donor license/source pins | Owner review only; **no audio engine code yet** |
| **P1: Audible vertical slice** | Pure four-voice PCM DSP, fixed-rate tracker clock, 1 original loop, exact WAV and digest; 1 animated scene synced to rows | 20 s offline fixture bytes identical on repeated and partitioned renders; scene-cue hashes match; full hosted CI |
| **P2: Real MOD** | Four-channel `M.K.` encoder/loader, signed PCM8 bank, C99 independent oracle, portable song project | Valid fixture `.mod` loads in the declared reference subset; invalid effects/data fail; new source/receipt tests |
| **P3: Studio and live** | Tracker editor, sample generator, AudioWorklet adapter, import/export, intentional pause/seek | Audio-visual sync under tested environment; no underrun in stated demo workload; unsupported contexts handled |
| **P4: Demoscene scenes** | Original vector/bitmap text, plasma, E8 scene, camera cue system, complete 45–90-second intro | Repeatable scene and audio events, exact asset hashes, sample-indexed full-run replay |
| **P5: OPT/RTX evidence** | A/B forced-fresh vs retained and CPU DSP comparisons; owner manual workflow and receipt | Hosted exact gates then owner-dispatched actual RTX; separate follow-up immutable evidence PR |
| **P6: 64K challenge / portable video** | Optional data-pack compression and offline WAV + frame export, external video encoder bridge | Declared byte budget, fail-closed imports, identical raw audio/scene source; no cross-encoder MP4-byte claim |

Do not merge multiple phases into one large risky PR. No version bump or release
until the source, tests, browser smoke and (if claimed) physical-hardware
evidence are green and the owner explicitly approves.

**P1 is the recommended next implementation** after the existing RTX donor
workflow is run/preserved. The first visible demo must be the test consumer,
not an afterthought.

## 10. First demo artistic direction and room to grow

Working title: **NO SUBSCRIPTIONS — QSOL DEMO 001** (original music/art only).

A boot-up text crawl, a retro 4-channel procedural beat, sample-locked
copper bars, a rotating E8-inspired structure and oversized perspective
credits. Choose deliberate CRT/pixel constraints and strong silhouettes
rather than photorealism or RGB-for-its-own-sake. The MIDI/E8 motif is
artistic source material; do not infer quantum physics, biomedical effects
or guaranteed listener outcomes from the resulting audio.

Later: demo party-style 4K/64K challenges; small native C99 player;
more advanced track patterns, intro competitions; procedural 3D scenes,
mesh text, rotozoom, signed-distance effects; cross-export to
Audio-To-Video; and synthesis-driven game soundtracks for VANILLAJS
consuming games without forcing a general DAW into the engine core.

## Useful platform references

- W3C Web Audio API Recommendation:
  https://www.w3.org/TR/webaudio-1.0/
- MDN AudioWorklet (browser-rendering-thread extension and secure-origin caveat):
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
- Standard 31-sample four-channel MOD byte layout (format orientation only,
  not a complete validation oracle):
  https://old-file-viewer.bobpritchett.com/docs/protracker-mod-format/
