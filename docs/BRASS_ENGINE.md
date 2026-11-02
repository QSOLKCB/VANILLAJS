# The Brass Engine — mechanical OMI demonstration

**v0.9.0 · Credit: Brian Thorne’s ARCH OMI.**

Open `demos/ancient-machine/index.html` through the same static server as the
other labs. This imagined ancient instrument exposes the pinned 16-bit OMI
delta law as a sequence of discrete cam positions. Original SVG geometry gives
the calculation a mechanical appearance. It is not a reconstruction of an
ancient device, a physical gear simulation or a continuous analog solver.

The [pinned sources, attribution and encoding boundaries](ARCH_OMI.md) still
apply. The kernel is unchanged. The four drums use our chosen FS/GS/RS/US nibble
encoding; they do not claim canonical OMI wire-format conformance. Six rails
display derived XOR differences. Four face residuals report the corresponding
closure relation, with the same ambiguity and fault-detection limits as OMI Lab.

## The cam program

Word `X` stays latched in the drums throughout preparation. Each full revolution
advances the OMI permutation once. Rotation wraps inside sixteen bits.

| Detent | Operation | Visible result for `X = 0x1234` |
| ---: | --- | --- |
| 0 | Ready; clear working lanes | Latched `1234` |
| 1 | Capture `X` | `1234` |
| 2 | `A = rotl16(X, 1)` | `2468` |
| 3 | `B = rotl16(X, 3)` | `91A0` |
| 4 | `C = rotr16(X, 2)` | `048D` |
| 5 | `M = A XOR B` | `B5C8` |
| 6 | `M = M XOR C` | `B145` |
| 7 | `Y = M XOR 0x5A3C` | `EB79` |
| 8 → 0 | Latch `Y`, increment turns, clear working lanes | Latched `EB79` |

Forward movement uses the staged result at the latch. It does not substitute
the imported kernel result behind a decorative animation. Exhaustive checks
compare this independently authored staged evaluator with the kernel and a
development-only arithmetic bit oracle.

Every word returns after eight **revolutions** (64 detents). Some have minimal
period 1, 2 or 4 revolutions. A fixed word still advances the cam and counter.
The preset seeds `1234`, `0005`, `0063` and `1477` demonstrate periods 8/4/2/1.

## Operation and lifecycle

- Click or tap the central crank or **Detent** to advance once; **Back** reverses
  one detent. **Full turn** moves eight detents from the current position, so it
  preserves the cam phase. Manual movement pauses and aligns the crank to its
  resulting detent, discarding any fractional motor position.
- Focus the crank: Left/Right step backward/forward, Enter advances a full turn,
  and Space starts/pauses the motor. Other buttons support Enter and Space.
  Repeated keydowns, cancelled gestures, drags and late releases after pause or
  focus loss do not activate controls. Escape always pauses.
- The motor consumes integer ticks from the existing 120 Hz `FixedClock`.
  Rates 2/4/8 detents per simulation second mean 60/30/15 ticks per detent.
  Long stalls use the clock’s 0.25-second/32-step catch-up bounds. Excess wall
  time is dropped; motor speed is not a wall-clock accuracy guarantee.
- Pause, blur and hidden tabs preserve all registers, counters and motor ticks.
  Resume deliberately. Rendered gear angles depend only on the saved phase and
  fractional tick; CSS/ambient-time animation does not continue after pause.
- Changing motor rate pauses and aligns to the current detent. **Reduced motion**
  initially follows the browser preference and snaps the drawing to detents;
  logical state and counters are unaffected. No audio is emitted.
- **Load** validates one to four hexadecimal digits with an optional `0x` prefix,
  then rewinds to that seed. An invalid edit changes only the message.
  **Reset** rewinds the current seed while retaining the selected motor rate.
- The 16-bit revolution counter stops at 65,535 completed turns / 524,280 detents.
  The final position has no fractional tick. Boundary actions do not wrap or
  partly apply; rewind or reset to continue. Receipts show only the last eight
  completed revolutions and are reconstructed after rewind or restore.

The receipt tape is a derived trace of this fixed transform, not a record of
arbitrary inputs, a timestamped event stream or an authenticated audit log.

## Demo model and replay contract

`demos/ancient-machine/machine.js` is a pure, demo-owned module. It has no DOM,
ambient clock or randomness. `BrassMachine` accepts `{seed=0x1234, detents=0,
ticksPerDetent=30, subTick=0}`. Inputs are strict integers and are not coerced.

| Method | Contract |
| --- | --- |
| `snapshot()` | Fresh state, four nibbles and available working registers; unavailable lanes are `null` |
| `move(amount=1)` | Nonzero integer from −8 through 8; returns `false` unchanged at a counter boundary, otherwise `true`; invalid arguments throw |
| `tick()` | One 120 Hz motor tick; returns `false` unchanged at the upper boundary, otherwise `true` |
| `setRate(ticksPerDetent)` | Accept only 60/30/15; reset fractional tick after validation |
| `receipts(limit=8)` | Fresh last 1–8 completed revolution records, bounded even at the maximum counter |
| `exportReplay()` | Fresh versioned JSON-compatible data |
| `BrassMachine.fromReplay(data)` | Validate and return a new machine; never mutate an existing machine |

The format is intentionally small:

```json
{
  "schemaVersion": 1,
  "machine": "omi-brass-1",
  "seed": 4660,
  "detents": 13,
  "ticksPerDetent": 30,
  "subTick": 12,
  "word": 60281
}
```

Here the latched word is `0xEB79`, phase is 5, and the crank is 12/30 of the way
to the next detent. `word` is a redundant consistency check, not a cryptographic
checksum. The importer reconstructs registers and receipts from seed and
counter, validates the word, and rejects unknown/missing keys, unsupported
versions, malformed values and impossible full-counter fractions. The proven
finite-domain eight-revolution return permits bounded reconstruction using at
most seven complete delta cycles regardless of the counter value.

**Save replay** pauses and downloads a local JSON file. **Restore replay** opens
a local file chooser and pauses; successful restoration stays paused. The UI
accepts at most 16 KiB, parses JSON without evaluation, validates a new machine
before replacement, and rejects stale asynchronous reads if the user has since
operated the controls. Bad files leave the logical position unchanged. No file
content is sent to a service; no backend, account or browser storage is required.

## Evidence and limits

```sh
node --test tests/brass-machine.test.js
node scripts/verify-machine.js --check
```

[`OMI_MACHINE_EVIDENCE.json`](OMI_MACHINE_EVIDENCE.json) records:

- 458,752 checks that the seven preparation detents preserve the latched word.
- All 65,536 staged outputs agree with the independent arithmetic bit oracle;
  all 65,536 full-turn reverse round trips restore the seed and counter.
- 96 replay cases spanning all eight cam phases, three motor rates and four
  cycle periods restore fractional ticks and produce identical future states.
- The same 131,072-byte little-endian transition table hash as the OMI kernel:
  `a0bb32b98090680604ff561e02db2d576194b767bd75bef7284a3d3877fa7c1a`.

The Node suite additionally covers stage values, strict boundaries, owned
snapshots, receipt rewind, counter limits, invalid replays, pause/catch-up and
30/60/144 Hz presentation schedules in one runtime. CI reproduces the committed
evidence except its runtime label, and tests the packaged page in Chromium:
actual JSON download/restore, partial state, failure paths, fresh input, focus
cancellation, reduced motion, counter stop and narrow touch-emulated layouts.
The PR records the actual CI run and artifact evidence after execution.

These are executed finite-domain results, not imported formal proof certificates.
Other browser engines, physical touch devices, real gears and analog tolerances
are unverified. Determinism describes the integer state for the same seed and
commands/ticks; it does not imply identical frame timing or pixels across devices.
This demo makes no cryptographic, compression, RNG, physics or speedup claim.
