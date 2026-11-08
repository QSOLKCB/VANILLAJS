// SPDX-License-Identifier: Apache-2.0
// Independent Q16.16 arithmetic oracle: BigInt only in tests, never as the
// scalar implementation's multiplication/division intermediate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INT_MIN, INT_MAX, SCALE, int32, uint32, vector3,
  add, subtract, mulDiv, multiply, divide, fromRatio, sqrt, nextRandom
} from '../modules/integer-math/index.js';
import {add3, subtract3, dotRaw3, dot3, crossRaw3, cross3,
  lengthSquaredRaw3, distanceSquaredRaw3, scaleRatio3, lerp3
} from '../modules/integer-vector/index.js';

const MIN = BigInt(INT_MIN), MAX = BigInt(INT_MAX), Q = BigInt(SCALE);
const edges = [
  INT_MIN, INT_MIN + 1, -1000000001, -65537, -65536, -32769,
  -32768, -2, -1, -0, 0, 1, 2, 32767, 32768, 65535,
  65536, 65537, 1000000001, INT_MAX - 1, INT_MAX
];

const reference = (a, b, divisor) => {
  if (divisor === 0) throw new RangeError('reference zero denominator');
  const quotient = BigInt(a) * BigInt(b) / BigInt(divisor);
  if (quotient < MIN || quotient > MAX) throw new RangeError('reference overflow');
  return Number(quotient);
};
function assertAgreement(a, b, divisor) {
  let expected;
  try { expected = reference(a, b, divisor); }
  catch (error) {
    assert.throws(() => mulDiv(a, b, divisor), RangeError,
      'overflow/zero divisor: ' + [a, b, divisor]);
    return;
  }
  const actual = mulDiv(a, b, divisor);
  assert.equal(actual, expected, 'mismatch for ' + [a, b, divisor]);
  assert.equal(Object.is(actual, -0), false, 'canonical zero');
}

test('new scalar kernel uses 16-bit limb arithmetic, not BigInt intermediates', async () => {
  const source = await readFile(new URL('../modules/integer-math/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /BigInt\s*\(/);
  assert.doesNotMatch(source, /from\s+['"].*(?:doom|vch|fixed|morluto)/i);
  assert.match(source, /function productWords/);
  assert.match(source, /function checkedQuotient/);
  assert.equal(SCALE, 65536);
  assert.equal(INT_MIN, -2147483648);
  assert.equal(INT_MAX, 2147483647);
});

test('exhaustive signed edge combinations agree with independent exact quotient', () => {
  for (const a of edges) for (const b of edges) for (const divisor of edges) {
    assertAgreement(a, b, divisor);
  }
  assert.equal(mulDiv(INT_MIN, 1, 1), INT_MIN);
  assert.equal(mulDiv(INT_MIN, INT_MIN, INT_MIN), INT_MIN);
  assert.equal(mulDiv(INT_MAX, INT_MAX, INT_MAX), INT_MAX);
  assert.equal(mulDiv(-1, 1, 2), 0);
  assert.equal(mulDiv(-7, 3, 2), -10);
  assert.equal(mulDiv(7, 3, -2), -10);
  assert.equal(mulDiv(-7, 3, -2), 10);
});

test('50k seeded full-range signed quotients and signed division signs match oracle', () => {
  let seed = 0x1234abcd;
  const next = () => { seed = (Math.imul(seed, 22695477) + 1) >>> 0; return seed | 0; };
  for (let i = 0; i < 50000; i++) {
    const a = next(), b = next(), denominator = next() || 1;
    assertAgreement(a, b, denominator);
  }
});

test('small exact products, exact halfway signs, extreme overflow and zero divisor', () => {
  assert.equal(fromRatio(3, 2), 98304);
  assert.equal(multiply(98304, 98304), 147456);
  assert.equal(divide(-65536, 196608), -21845);
  for (const pair of [[INT_MAX, 2], [INT_MIN, -1]]) {
    assert.throws(() => mulDiv(pair[0], pair[1], 1), RangeError);
  }
  assert.throws(() => mulDiv(0, 3, 0), RangeError);
  assert.throws(() => mulDiv(3, 0, 0), RangeError);
  assert.throws(() => divide(1, 0), RangeError);
  assert.throws(() => multiply(INT_MAX, INT_MAX), RangeError);
  assert.throws(() => fromRatio(INT_MAX, 1), RangeError);
  assert.throws(() => add(INT_MAX, 1), RangeError);
  assert.throws(() => subtract(INT_MIN, 1), RangeError);
  assert.equal(add(INT_MIN, INT_MAX), -1);
  assert.throws(() => subtract(INT_MAX, INT_MIN + 1), RangeError);
});

test('integer API rejects fractional/non-number input and sparse vectors', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 0.25, '1', null,
                         undefined, {}, [], INT_MAX + 1, INT_MIN - 1]) {
    assert.throws(() => int32(invalid), RangeError);
    assert.throws(() => mulDiv(invalid, 1, 1), RangeError);
  }
  for (const invalid of [-1, 4294967296, NaN, 0.5, '0', null]) {
    assert.throws(() => uint32(invalid), RangeError);
  }
  for (const invalid of [new Array(3), [0, 1], [1, 2, 3, 4],
                         [0, 1, 1.5], new Int32Array(3), null]) {
    assert.throws(() => vector3(invalid));
  }
  assert.equal(Object.is(int32(-0), -0), false);
  assert.equal(Object.is(uint32(-0), -0), false);
  assert.deepEqual(vector3([-0, 0, -0]), [0, 0, 0]);
});

test('integer sqrt brackets exact Q16.16 scaled radicand including extremes', () => {
  const check = value => {
    const r = BigInt(sqrt(value)), n = BigInt(value) * Q;
    assert.ok(r * r <= n, 'sqrt too large: ' + value);
    assert.ok((r + 1n) * (r + 1n) > n, 'sqrt too small: ' + value);
    assert.equal(Number.isInteger(Number(r)), true);
  };
  for (const value of [0, 1, 2, 3, 4, 1023, 1024, 65535,
                        65536, 65537, 147456, 123456789, INT_MAX - 1,
                        INT_MAX]) check(value);
  for (let v = 0; v <= 100000; v += 97) check(v);
  let seed = 0x12345;
  for (let i = 0; i < 1024; i++) {
    seed = nextRandom(seed);
    check(seed & INT_MAX);
  }
  assert.throws(() => sqrt(-1), RangeError);
  assert.throws(() => sqrt(2.5), RangeError);
});

test('deterministic RNG continuity is unchanged, including zero state', () => {
  let seed = 1;
  const observed = [];
  for (let i = 0; i < 4; i++) {
    seed = nextRandom(seed);
    observed.push(seed);
  }
  assert.deepEqual(observed, [1015568748, 1586005467, 2165703038, 3027450565]);
  assert.equal(nextRandom(0), 1013904223);
  for (let i = 0; i < 4096; i++) {
    const state = (Math.imul(i, 2750159) + 433) >>> 0;
    const expected = Number((BigInt(state) * 1664525n + 1013904223n) & 0xffffffffn);
    assert.equal(nextRandom(state), expected);
  }
});

test('raw vector exactness and right-handed determinant are independently derived', () => {
  const x = [SCALE, 0, 0], y = [0, SCALE, 0];
  assert.equal(dotRaw3(x, y), 0n);
  assert.equal(dotRaw3(x, x), Q * Q);
  assert.equal(dot3(x, x), SCALE);
  assert.deepEqual(crossRaw3(x, y), [0n, 0n, Q * Q]);
  assert.deepEqual(cross3(x, y), [0, 0, SCALE]);
  assert.deepEqual(cross3(y, x), [0, 0, -SCALE]);
  const hi = [INT_MAX, INT_MAX, INT_MAX];
  const lo = [INT_MIN, INT_MIN, INT_MIN];
  assert.equal(dotRaw3(hi, hi), 3n * BigInt(INT_MAX) ** 2n);
  assert.equal(lengthSquaredRaw3(lo), 3n * BigInt(INT_MIN) ** 2n);
  assert.equal(distanceSquaredRaw3(hi, lo),
    3n * (BigInt(INT_MAX) - BigInt(INT_MIN)) ** 2n);
  assert.throws(() => dot3(hi, hi), RangeError);
  assert.throws(() => cross3(hi, [0, INT_MAX, 0]), RangeError);
  assert.deepEqual(add3([1, 2, 3], [4, 5, 6]), [5, 7, 9]);
  assert.deepEqual(subtract3([1, 2, 3], [4, 5, 6]), [-3, -3, -3]);
});

test('vector scalar scaling and widened lerp match exact oracle over 8192 pairs', () => {
  let state = 0x87654321;
  const next = () => { state = nextRandom(state); return state | 0; };
  for (let i = 0; i < 8192; i++) {
    const a = [next(), next(), next()], b = [next(), next(), next()];
    const A = a.map(BigInt), B = b.map(BigInt);
    const t = (next() >>> 0) % (SCALE + 1);
    const blend = A.map((x, j) => Number(x + (B[j] - x) * BigInt(t) / Q));
    assert.deepEqual(lerp3(a, b, t), blend);
    const numerator = next(), divisor = next() || 1;
    const scaled = A.map(x => x * BigInt(numerator) / BigInt(divisor));
    if (scaled.some(x => x < MIN || x > MAX)) {
      assert.throws(() => scaleRatio3(a, numerator, divisor), RangeError);
    } else {
      assert.deepEqual(scaleRatio3(a, numerator, divisor), scaled.map(Number));
    }
    const expectedDot = A.reduce((acc, x, j) => acc + x * B[j], 0n);
    assert.equal(dotRaw3(a, b), expectedDot);
    assert.equal(lengthSquaredRaw3(a), A.reduce((acc, x) => acc + x * x, 0n));
    assert.equal(distanceSquaredRaw3(a, b),
      A.reduce((acc, x, j) => acc + (x - B[j]) ** 2n, 0n));
    const cross = [
      A[1] * B[2] - A[2] * B[1],
      A[2] * B[0] - A[0] * B[2],
      A[0] * B[1] - A[1] * B[0]
    ];
    assert.deepEqual(crossRaw3(a, b), cross);
    const rounded = cross.map(x => x / Q);
    if (rounded.some(x => x < MIN || x > MAX)) {
      assert.throws(() => cross3(a, b), RangeError);
    } else {
      assert.deepEqual(cross3(a, b), rounded.map(Number));
    }
  }
  assert.deepEqual(lerp3([INT_MIN, 0, 0], [INT_MAX, 0, 0], SCALE / 2),
    [-1, 0, 0]);
  assert.deepEqual(lerp3([INT_MAX, 0, 0], [INT_MIN, 0, 0], SCALE / 2),
    [0, 0, 0]);
  assert.throws(() => lerp3([0, 0, 0], [1, 1, 1], -1), RangeError);
  assert.throws(() => lerp3([0, 0, 0], [1, 1, 1], SCALE + 1), RangeError);
});
