# Integer engine — experimental contract

VANILLAJS now has a reusable integer simulation core and a complete playable
consumer, Integer Foundry. The existing floating-point controllers remain
available. This foundation is unreleased; it does not change the 1.0.0 tag.

## Representation and arithmetic

| Quantity | Contract |
| --- | --- |
| Position / size | Signed int32 subunits; `SCALE = 65536` per metre (16.16 fixed point) |
| Coordinate convention | Right-handed, +Y up, -Z forward |
| Velocity | Signed int32 subunits per simulation tick |
| Acceleration | Signed int32 subunits per tick squared |
| Tick | Nonnegative signed int32; exhaustion rejects the next step |
| RNG | Explicit uint32 LCG state; seed 0 is valid |
| Static / body IDs | Unique positive signed int32 within each collection |
| Numeric range | −32768 to 32767 + 65535/65536 metres; body extents must also fit |
| Multiply/divide | Exact signed widened arithmetic via unsigned 16-bit limbs; quotient truncates toward zero |
| Overflow | Throws; no saturating, wrapping or silently rounded world state |
| Square root | Integer floor of the scaled square root |

JavaScript stores these integers in `Number`, exactly within their admitted
ranges. Checked addition/subtraction and collision intermediates stay below
2^53. Scalar Q16.16 multiply/divide now uses independently designed
unsigned 16-bit limb products and checked binary long division. All partials,
carry terms and division remainders stay exactly representable as Number,
so no low bits can silently disappear before signed truncation. The algorithm,
proof bounds and historical baseline are in [Q16-INDEPENDENT-001](Q16_INDEPENDENT_REIMPLEMENTATION.md). Only the explicit PRNG uses
specified modulo-2^32 arithmetic. This is an integer arithmetic contract, not a
claim about the CPU instructions emitted by a JavaScript JIT.

`integer-math` exports `int32`, `uint32`, `vector3`, `add`, `subtract`, `mulDiv`,
`fromRatio`, `multiply`, `divide`, `sqrt`, `toNumber`, `nextRandom`, `SCALE`,
`INT_MIN` and `INT_MAX`. `vector3` accepts dense ordinary three-element arrays;
there is no implicit coercion from strings, fractions or typed arrays. Negative
zero is normalised. `fromRatio(n, d=1)` encodes metres from an integer ratio;
`multiply(a,b)` divides the exact product by SCALE; `divide(a,b)` multiplies a by
SCALE before division. `mulDiv(a,b,d)` takes three signed int32 operands.
`toNumber` divides by SCALE **only at the presentation boundary**.

The additive [integer-vector module](INTEGER_VECTORS.md) supplies 3D
component-wise arithmetic, exact widened dot/cross/distance expressions, and
rational interpolation using the same 16.16 coordinates. Raw results are
`BigInt` and require explicit serialisation; int32 results reject overflow.
It is an experimental reusable API, not yet a replacement for integer-physics
sweeps or any visual renderer path.

At 120 Hz, encode 6 m/s as `fromRatio(6,120)` subunits/tick, and −10 m/s² as
`fromRatio(-10,14400)` subunits/tick². These values are quantised (3276 and −45);
constant −45 corresponds to −9.8876953125 m/s². There is no residual-carry
integrator. Choose the tick rate and constants deliberately. Integer Foundry
uses intentionally stronger arcade gravity (−384) and jump velocity (14080).

## Collision and world ownership

`createIntegerBody({id,position,halfSize,velocity})` copies/validates a body;
default position/velocity are zero and default half sizes are 32768 subunits (half a metre).
All half sizes must be positive. `createIntegerScene(boxes)` validates, sorts and
deep freezes at most 4096 static `{id,min,max}` AABBs of positive volume.

`new IntegerCollider(boxes)` owns its geometry. `validate(body)` returns a
validated copy and rejects initial penetration. `move(body,displacement)` returns
`{body,contacts}` and leaves the caller's body untouched. It sweeps along X, then
Y, then Z, clamps at the first face on each axis, and zeroes the hit velocity
component. Contact records are `{boxId,axis,normal}`, in axis order; equal-distance
contacts choose the lowest box ID. Touching and grazing are allowed. A movement
ending exactly on a blocking face reports contact. Zero displacement reports no
contact; gravity or an explicit probe is needed for support detection.

These are exact sweeps along the **ordered axis path**, not a simultaneous-vector
time-of-impact solver. Fast movement cannot skip a thin obstacle intersecting
that axis path, but diagonal movement can differ from a straight-line sweep.
The requested endpoint and extents must fit int32 even if a wall would stop the
body earlier. No epsilon or floating normal is used.

`IntegerEngine({boxes=[],bodies=[],seed=1})` owns up to 256 bodies. IDs and contact
output are sorted deterministically. Bodies collide with static geometry only;
bodies may overlap/pass through one another. No rotating boxes, slopes, rigid
impulses, dynamic contacts or moving platforms are implemented here.

`step(commands=[])` accepts at most one command per existing body:
`{id,velocity?:[x,y,z],acceleration?:[x,y,z]}`. Unknown/duplicate IDs, extra command
fields and explicitly invalid optional fields are rejected. Missing velocity
retains the previous velocity; missing acceleration is zero for that tick.
Velocity override is applied first, then acceleration, then movement. Every body
moves even if it receives no command. All resulting bodies are computed before
commit. Any failed command/overflow leaves tick, bodies and RNG unchanged.
Each successful tick advances the LCG once; the result is
`{tick,random,contacts:[{bodyId,boxId,axis,normal}]}`.

Getters `tick`, `randomState`, `boxes` and `bodies` expose integers, immutable
geometry and detached body copies. Modify bodies through commands; mutating a
copy cannot change engine state. There is no implicit global clock or entropy.

## Snapshots and replay

`snapshot()` returns a detached, JSON-safe record containing the schema, scale,
tick, RNG state, all static boxes and all bodies. `serialize()` emits that state
in fixed field/ID order. `IntegerEngine.fromSnapshot(record)` validates the exact
version-1 schema, integer ranges, collection limits, IDs and nonpenetrating state
before creating an independent engine. Future schemas and extra/missing fields
are rejected. No partial restore occurs.

`replayInteger(initialSnapshot, frames)` restores and runs at most 100,000 command
arrays in order. The input contract includes exact initial state, commands and
code version. Live browser input timing can differ across frame rates; replay
reproduces **recorded tick inputs**, not arbitrary wall-clock gestures.

`integerChecksum(engine)` is eight hexadecimal FNV-1a digits over canonical engine
JSON. It is a convenient diagnostic with possible collisions, not integrity or
security proof. Compare full serialised state for equality. The offline evidence
script separately computes SHA-256 over full game state and recorded inputs.

Game-specific progression, cooldowns, inventory and input history belong in the
consumer's complete state/recording. Integer Foundry includes its grounded flag,
collected-cell mask and completion flag in its replay comparison. A matching
engine checksum alone cannot certify that progression matches.

## Clock and lifecycle

`new IntegerClock({hz=120,maxFrameUs=250000,maxSteps=32})` accepts 1–1000 Hz,
1–1,000,000 maximum frame microseconds, and 1–1000 updates per advance.
`advance(elapsedUs, update)` accepts nonnegative int32 microseconds and calls
`update(nextTick)` without a floating `dt`. It adds `elapsedUs * hz` to integer
phase and consumes 1,000,000 phase units per tick. Thus 120 Hz is represented
exactly, without rounding a tick to 8333 microseconds.

The result is `{steps,phase,denominator:1000000,clampedUs,discardedTicks}`. Long
frames are clamped before accumulation; whole excess ticks are discarded after
the work budget, retaining fractional phase. Under overload this slows simulation
relative to real time. Frame partitions are invariant only when no time/work is
dropped and the same tick inputs are supplied.

`setPaused(bool)` clears phase; paused advances do nothing. `reset()` clears ticks
and phase, preserving pause state. Getters expose `hz,ticks,phase,paused`.
Recursive advance/reset during callbacks throws. A throwing update pauses and
clears remaining phase, does not increment the failed tick, and rethrows; callers
must make their own updates atomic. Engine ticks are atomic. Pausing inside a
successful callback commits that tick and prevents further catch-up.

At the browser boundary, quantise absolute animation timestamps to integer
microseconds, then take differences. The Foundry discards elapsed time on
resume, clears key and pointer state, rejects held-key repeats and buffers jump
presses until a tick. Blur/hidden tabs pause. There is no additional hardware
oscillator requirement. Tick replay does not require elapsed wall time at all.

## Compose a game

```js
import {fromRatio as q, toNumber} from './modules/integer-math/index.js';
import {IntegerEngine, replayInteger} from './modules/integer-engine/index.js';
import {IntegerClock} from './modules/integer-time/index.js';

const game = new IntegerEngine({
  seed: 83,
  boxes: [{id: 1, min: [q(-10), q(-1), q(-10)], max: [q(10), 0, q(10)]}],
  bodies: [{id: 1, position: [0, q(1), 0], halfSize: [q(1,4), q(1,2), q(1,4)]}]
});
const initial = game.snapshot(), frames = [], clock = new IntegerClock();
const inputForTick = () => [{id: 1, acceleration: [0, q(-10,14400), 0]}];
clock.advance(16667, () => {
  const command = inputForTick();
  game.step(command);
  frames.push(command);
});
const metresForRenderer = game.bodies[0].position.map(toNumber);
const replay = replayInteger(initial, frames);
console.assert(replay.serialize() === game.serialize());
```

The renderer can use interpolated floats, WebGL matrices, lighting and shader
math. Those quantities must never enter the authoritative integer update.
Integer Foundry displays the latest committed pose (no interpolation).

## Migration and validation

| Existing subsystem | Integer path / status |
| --- | --- |
| math | New checked integer module; legacy float math retained for visuals/controllers |
| time | New rational integer clock; legacy `FixedClock` retained |
| collision | New static axis sweeps; not a drop-in for simultaneous/kinematic sweeps |
| character / flight | Foundry proves grounded box motion; feature-parity migration remains planned |
| weapons / projectiles | Integer-tick adapters remain planned |
| renderer / input | Reuse renderer and discrete `Actions` through explicit boundaries |
| OMI / navigation | Existing discrete APIs unchanged; no untested global conversion claim |

Run `node --test tests/*.test.js`, `node scripts/check.js`,
`node scripts/build.js`, and `node scripts/verify-integer.js --check`.
The existing CI browser job now also tests the packaged Foundry, including a full
Node-versus-Chromium replay comparison, rendering, movement/jump, keyboard/touch
cancellation, mobile layout, unsupported WebGL and context loss. CI preserves
`integer-evidence.json` and screenshots with its existing evidence artifact.

Tests include 10,000 arithmetic cases against a magnitude/remainder oracle,
exhaustive small axis sweeps against a unit-step collision oracle, 10,000-tick
snapshot/replay continuation, fractional/range/schema rejection, whole-world
failure atomicity, clock partition/catch-up controls and complete-course replay.
`INTEGER_EVIDENCE.json` pins the course's full-state and input SHA-256 values.

Deterministic state is the contract being checked. Visual pixel equality across
drivers, all-browser conformance, production API stability and performance wins
are not claimed. Exact scalar limb arithmetic, widened BigInt raw-vector
results and full-state validation prioritise correctness; the rewrite has
no claimed speedup without paired measurements on equivalent workloads.
