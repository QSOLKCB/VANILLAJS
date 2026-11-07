# VANILLAJS 2D Foundation — audio, controls, A*, and ternary array memory

**Status:** experimental code on the feature PR. No release or GPU execution.
Source baseline: `34040c330a4943d4b55104c78935a25b3ab94973` (post DEMO//SYNTH plan merge).
The implementation is opt-in; the existing engine/game APIs are not migrated.

## Game genres / integer representation

`modules/motion2d/index.js` provides `createBody2D` and `stepBody2D`
for four controlled profiles: `rts`, `shmup`, `platform`, `car`.
Coordinates and velocities are signed integer subunits (256/game unit), one
update per caller-owned logical game tick. +X right; +Y up. The 2D lab
intentionally maps the height axis down to canvas rows **only in its view**,
so a later 3D adapter can decide whether the source 2D plane is XY or XZ.

RTS uses the existing immutable `NavigationGrid` and reference `findPath`.
There is no new 2D A* oracle or speculative moving-obstacle solver.
`PooledPathfinder` and existing shared `FlowFieldSearch` remain options
for future multi-agent workloads. Static collision in this first 2D slice
is **point-like and endpoint-only**, without continuous sweeping of moving
bodies or a full character capsule/vehicle collision system. Car steering
uses a declared quantized 16-direction heading table, not claimed realistic
lateral friction or tyre dynamics.

The `demos/2d-lab` browser app is the first actual consuming UI. It includes
a routed map, shooter pulses, a gravity/jump scene and top-down driving.
Pure model replays can be measured with independent field hashes. Rendered
Canvas 2D pixels are device/browser dependent and not canonical source bytes.

## Deterministic 2D sound

`modules/audio2d/index.js` supplies `createSound2D`, a bounded four-lane
`square/triangle/saw/noise` procedural effect renderer. It accepts ordered,
sample-indexed events and emits **48,000 Hz mono signed PCM16LE** in an explicit
RIFF/WAVE container. No `Math.sin`, ambient entropy or device clock enters
identity. Integer event times, gain, envelopes and xorshift noise are
versioned by the source module. A 128-event, four-lane, eight-second maximum
bounds the work. Overlapping events on the same lane are refused rather than
silently mixing or stealing voices.

The browser preview plays the already rendered WAV only after a real user
click. Hardware/device audio timing, browser resampling and audible output
are noncanonical observations. This small sound effects API is not a complete
ProTracker MOD player; that remains in the separate DEMO//SYNTH plan.

## Ternary data-store: clear data and ownership contract

`modules/ternary-store2d/index.js` supplies `TernaryGridStore2D`.
It stores validated `.txt` and `.json` UTF-8 payloads as sorted bounded
document entries, then exports a reversible **2D array of trits 0,1,2**.

Each byte b ∈ [0,255] is written as exactly six base-3 digits
`[b % 3, floor(b/3) % 3, ..., floor(b/243) % 3]`. Six trits have 729
possible codes: 256 are valid byte encodings and 473 are rejected.
The forward `BYTE_TO_TRITS` lookup holds **1,536 bytes**; the reverse
`TRITS_TO_BYTE` lookup has 729 signed-16-bit entries (**1,458 bytes**),
marking invalid codes with -1. Both are private module-level constants
and never exposed mutable to callers.

The store supports columns 9/27/81, at most 64 named documents and 16,384
total UTF-8 bytes; the 2D grid is an *encoding*, not compression or a physical
3D information array. The maximum 16,384-byte payload requires up to
98,304 trits; no claim that trits are storage-efficient is made.

**OPT-INV-001 reuse:** complete input identity is the sorted document
names and exact UTF-8 bytes. The first `snapshot()` rebuilds ordered
entries and the trit grid. Repeated calls reuse a *current-generation cache*
but return deep-enough detached copies of all mutable rows/entries. A
byte-identical replacement is a no-op; changed, deleted or cleared documents
invalidate cache exactly once after successful validation. Failed writes
preserve the previous version. `cacheStats()` reports builds, hits,
invalidations and unchanged writes; these counters are diagnostics, not
identity-bearing data.

`TernaryGridStore2D.fromSnapshot` validates exact schema fields,
sorted offsets, byte lengths, six-trit codes, padding, strict UTF-8
and canonical safe-integer JSON; it reencodes after import before success.
It does not cryptographically authenticate an input or persist anything
without an explicit user download or external save. A future persistent
browser adapter may use IndexedDB, with transaction and quota gates, but
neither `localStorage` nor the cloud is silently enabled.

## Public and hardware evidence

`scripts/lab2d-evidence.js --check` runs 240 logical ticks each across
four modes, verifies exact repeat outcomes, a 48k-sample audio render
across several differently sized partitions, and a 27-column store
roundtrip/cached-vs-fresh comparison. The JSON deliberately splits strict
source/outcome identities from noisy CPU timing observations. No GPU
performance or JavaScript heap/RSS inference follows from CPU-only results.

The hosted job adds the JSON to its ordinary CI artifact alongside the
new packaged Chromium browser screenshots; these are **hosted evidence,
not a physical RTX measurement**.

Planned post-merge owner workflow:
`.github/workflows/rtx5060ti-2d.yml` is manual-only,
`github.actor=EmergentMonk`, reviewed `main`, dedicated
`self-hosted,linux,x64,qsol-rtx5060ti`, explicit consent.
It must report actual native GPU renderer identity separately from the
2D Canvas path, and record full source pins, browser version,
CPU render timing, pixels, deterministic model/WAV receipt, and
exact immutable artifact SHA-256 before later preservation.

## Optional API-funded evidence reviewers

The user approved a total nominal **US$10 ceiling** for GPT-6.1 Sol agents.
The separate owner-dispatched workflow will require an explicit
`OPENAI_API_KEY` GitHub Actions Secret and authorization input. It
will call only the OpenAI Responses API `gpt-6.1-sol` at Standard tier,
with bounded input/output tokens and two serial evidence-only reviewer
perspectives. Hosted CI itself is free of paid inference and no automated
pull request or agent patch gets elevated to proof. Reviewers read only the
public, schema-bounded JSON fixture generated by this repository. No
personal files, secret values, device profiles or private messages are sent.

The script will conservatively reserve **long-context** pricing for all
requests, compute and record observed usage/cost, make no automatic retries
and refuse missing keys or insufficient remaining spend. This is a
per-run fail-closed cost policy, *not* an account-wide billing cap:
the owner must avoid repeated dispatches and use account-level spending
limits for a true aggregate ceiling. GitHub Actions billing, runner cost,
external monitoring and future pricing changes are not controlled by
the in-repo cost estimator. It must never claim to have charged the user's
account until an actual authorized call and confirmed provider usage.

## Test matrix

- Pure Node tests: exact 2D tick replays, all genres, bounded inputs,
  A*, pause/edge conditions, audio known WAV header and chunk-independent
  PCM, seeded noise and failure paths.
- Ternary exhaustive 0..255 LUT oracle and rejection of all 473 unused
  trit codes; detached snapshots, stale cache corruption and forged
  index/length/UTF-8 tests.
- Hosted Chromium: four game profiles, click-to-play, pause/focus,
  Canvas content, safe TXT/JSON store lifecycle, evidence download,
  320px layout and no runtime network imports.
- OPT comparison: 30 fresh store constructions versus 30 cache-reused
  detached snapshots, seven trials after two warmups. Only exact
  equality and work-count reductions are CI gates; wall times are
  observations, not assumed universal speedups.
- Owner-run physical RTX browser and bounded Sol agent review are
  separate follow-ups. Never reissue or rewrite RTX001–005 archives.
