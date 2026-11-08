# Integer vectors — experimental 3D fixed-point operators

`modules/integer-vector/index.js` extends VANILLAJS's integer simulation foundation without replacing the existing floating-point renderer or character controllers. It is a **pure JavaScript module**, depending only on `integer-math`, with no new libraries, browser state, clock, GPU access or ambient randomness.

## Representation

Each vector is an ordinary, dense, three-element array of signed int32 *subunits*: one metre is `SCALE = 65536` (Q16.16). The world is right-handed (+Y up, −Z forward). Input arrays are validated and copied by the underlying `vector3` contract. Fractions, strings, typed arrays, sparse arrays and out-of-range values are rejected; negative zero is canonicalised to zero. Operators never mutate inputs.

| Function | Result | Contract |
| --- | --- | --- |
| `add3(a,b)` | `number[3]` | Checked int32 component-wise sum |
| `subtract3(a,b)` | `number[3]` | Checked int32 component-wise difference |
| `dotRaw3(a,b)` | `bigint` | Exact raw Q32.32 sum of three products |
| `dot3(a,b)` | `number` | Raw dot divided by SCALE **once**, truncating toward zero; checked int32 |
| `crossRaw3(a,b)` | `bigint[3]` | Exact raw Q32.32 right-handed cross product |
| `cross3(a,b)` | `number[3]` | Cross components divided by SCALE, each truncated toward zero and checked int32 |
| `lengthSquaredRaw3(a)` | `bigint` | Exact sum of squared raw components (nonnegative) |
| `distanceSquaredRaw3(a,b)` | `bigint` | Exact squared raw differences, including opposing int32 extremes |
| `scaleRatio3(v,n,d)` | `number[3]` | Checked `trunc(v[i] × n / d)`, with signed int32 `n,d`, nonzero `d` |
| `lerp3(a,b,t)` | `number[3]` | `a[i] + trunc((b[i]-a[i]) × t / SCALE)`; integer `0 ≤ t ≤ SCALE` |

Raw dot/cross/squared-distance expressions use **BigInt** to preserve the public exact widened outputs. Checked scalar vector ratios instead call the independently implemented 16-bit-limb `mulDiv` kernel. Lerp products use exact `Number` arithmetic below 2^48, with once-only signed truncation and checked final int32 results. Operators returning signed int32 reject overflow with `RangeError`; there is no wrapping, saturating or silent floating-point fallback. No partial vector is returned on failure. See [Q16-INDEPENDENT-001](Q16_INDEPENDENT_REIMPLEMENTATION.md).

The `Raw3` family returns `BigInt` values that can exceed 53-bit precision. **BigInt cannot be directly serialised with `JSON.stringify`.** If a game saves snapshots or publishes receipts, convert deliberately with a documented decimal-string schema or a validated bounded result, not implicit `Number` coercion. Raw Q32.32 values represent *squared* subunits, not metres or seconds.

## Examples

```js
import {SCALE} from './modules/integer-math/index.js';
import {dotRaw3, dot3, cross3, distanceSquaredRaw3, lerp3} from './modules/integer-vector/index.js';

const right = [SCALE, 0, 0]; // one metre along +X
const up = [0, SCALE, 0];    // one metre along +Y
console.assert(dot3(right, up) === 0);
console.assert(dotRaw3(right, right) === BigInt(SCALE) ** 2n);
console.assert(JSON.stringify(cross3(right, up)) === JSON.stringify([0, 0, SCALE]));
console.assert(distanceSquaredRaw3(right, up) === 2n * BigInt(SCALE) ** 2n);
console.assert(JSON.stringify(lerp3(right, up, SCALE / 2)) ===
  JSON.stringify([SCALE / 2, SCALE / 2, 0]));
```

For integer-only proximity ordering, compare `distanceSquaredRaw3` values directly without a square root; use a chosen deterministic tie-breaker (e.g. entity ID) for equal distances. These operators do not implement a new spatial index, physics integrator, collision solver or WebGL upload path.

## Validation and limitations

```sh
node --test tests/integer-vector.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
```

Regression coverage checks the right-handed basis, overflow, negative truncation, full-range interpolation, input rejection, non-mutation, **4,096 original seeded vector cases** and **8,192 new independently refactored vector cases** against mathematical BigInt referees. These are deterministic software arithmetic tests, not RTX hardware performance evidence or proof that the JIT emits integer instructions. The existing RTX5060TI-001 receipt remains unmodified, tied to its historical source commit.
