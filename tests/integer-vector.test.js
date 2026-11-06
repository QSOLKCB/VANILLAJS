// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {INT_MIN, INT_MAX, SCALE, nextRandom} from '../modules/integer-math/index.js';
import {add3, subtract3, dotRaw3, dot3, crossRaw3, cross3,
  lengthSquaredRaw3, distanceSquaredRaw3, scaleRatio3, lerp3
} from '../modules/integer-vector/index.js';

const Q = BigInt(SCALE);
const checkNarrowed = (raw, fn) => {
  if (raw < BigInt(INT_MIN) || raw > BigInt(INT_MAX)) assert.throws(fn, RangeError);
  else assert.equal(fn(), Number(raw));
};

test('right-handed fixed-point basis and exact raw units', () => {
  const x = [SCALE, 0, 0], y = [0, SCALE, 0], z = [0, 0, SCALE];
  assert.deepEqual(add3(x, y), [SCALE, SCALE, 0]);
  assert.deepEqual(subtract3(x, y), [SCALE, -SCALE, 0]);
  assert.equal(dotRaw3(x, x), Q * Q);
  assert.equal(dot3(x, x), SCALE);
  assert.equal(dot3(x, y), 0);
  assert.deepEqual(crossRaw3(x, y), [0n, 0n, Q * Q]);
  assert.deepEqual(cross3(x, y), z);
  assert.deepEqual(cross3(y, x), [0, 0, -SCALE]);
  assert.equal(lengthSquaredRaw3([SCALE, SCALE, 0]), 2n * Q * Q);
  assert.equal(distanceSquaredRaw3(x, y), 2n * Q * Q);
});

test('widened BigInt intermediates neither overflow nor silently round', () => {
  const hi = [INT_MAX, INT_MAX, INT_MAX], lo = [INT_MIN, INT_MIN, INT_MIN];
  assert.equal(dotRaw3(hi, hi), 3n * BigInt(INT_MAX) ** 2n);
  assert.equal(distanceSquaredRaw3(hi, lo), 3n * (BigInt(INT_MAX) - BigInt(INT_MIN)) ** 2n);
  assert.throws(() => dot3(hi, hi), RangeError);
  assert.deepEqual(crossRaw3([INT_MAX, 0, 0], [0, INT_MAX, 0]),
    [0n, 0n, BigInt(INT_MAX) ** 2n]);
  assert.throws(() => cross3([INT_MAX, 0, 0], [0, INT_MAX, 0]), RangeError);
  assert.throws(() => add3(hi, [1, 0, 0]), RangeError);
  assert.throws(() => subtract3(lo, [1, 0, 0]), RangeError);
  assert.throws(() => scaleRatio3(hi, 2, 1), RangeError);
});

test('signed truncation, zero canonicalisation and extreme interpolation', () => {
  assert.deepEqual(scaleRatio3([-7, 7, -0], 3, 2), [-10, 10, 0]);
  assert.deepEqual(scaleRatio3([-7, 7, 0], -3, 2), [10, -10, 0]);
  assert.deepEqual(lerp3([INT_MIN, 0, 0], [INT_MAX, 0, 0], SCALE / 2), [-1, 0, 0]);
  assert.deepEqual(lerp3([INT_MAX, 0, 0], [INT_MIN, 0, 0], SCALE / 2), [0, 0, 0]);
  assert.deepEqual(lerp3([INT_MIN, 5, 2], [INT_MAX, -2, 0], 0), [INT_MIN, 5, 2]);
  assert.deepEqual(lerp3([INT_MIN, 5, 2], [INT_MAX, -2, 0], SCALE), [INT_MAX, -2, 0]);
});

test('invalid array shapes, fractions and zero divisors fail closed', () => {
  const bad = [[], [0, 1], [0, 1, 2, 3], [1, 2, NaN], [0, 1, 3.1],
    [0, 0, '1'], new Int32Array(3), new Array(3), null];
  for (const input of bad) {
    for (const fn of [add3, subtract3, dotRaw3, dot3, crossRaw3, cross3,
      distanceSquaredRaw3, lerp3]) {
      assert.throws(() => fn(input, [0, 0, 0], 0));
    }
    assert.throws(() => lengthSquaredRaw3(input));
    assert.throws(() => scaleRatio3(input, 1, 1));
  }
  assert.throws(() => lerp3([0, 0, 0], [1, 1, 1], -1), RangeError);
  assert.throws(() => lerp3([0, 0, 0], [1, 1, 1], SCALE + 1), RangeError);
  assert.throws(() => scaleRatio3([0, 0, 0], 1, 0), RangeError);
  assert.throws(() => scaleRatio3([0, 0, 0], 1.5, 2), RangeError);
});

test('inputs are untouched even when a later component overflows', () => {
  const a = [1, 2, INT_MAX], b = [2, -3, 1];
  assert.throws(() => add3(a, b), RangeError);
  assert.deepEqual(a, [1, 2, INT_MAX]);
  assert.deepEqual(b, [2, -3, 1]);
  const result = add3([1, 2, 3], [4, 5, 6]);
  result[0] = 999;
  assert.deepEqual(add3([1, 2, 3], [4, 5, 6]), [5, 7, 9]);
});

test('4096 seeded cases match an independent BigInt oracle', () => {
  let seed = 17;
  const random = () => { seed = nextRandom(seed); return seed | 0; };
  for (let i = 0; i < 4096; i++) {
    const a = [random(), random(), random()], b = [random(), random(), random()];
    const A = a.map(BigInt), B = b.map(BigInt);
    const dot = A.reduce((s, x, j) => s + x * B[j], 0n);
    assert.equal(dotRaw3(a, b), dot);
    checkNarrowed(dot / Q, () => dot3(a, b));
    const c = [A[1]*B[2] - A[2]*B[1], A[2]*B[0] - A[0]*B[2], A[0]*B[1] - A[1]*B[0]];
    assert.deepEqual(crossRaw3(a, b), c);
    assert.deepEqual(crossRaw3(b, a), c.map(x => -x));
    const cScaled = c.map(x => x / Q);
    if (cScaled.some(x => x < BigInt(INT_MIN) || x > BigInt(INT_MAX)))
      assert.throws(() => cross3(a, b), RangeError);
    else assert.deepEqual(cross3(a, b), cScaled.map(Number));
    const d2 = A.reduce((s, x, j) => s + (x - B[j]) ** 2n, 0n);
    assert.equal(distanceSquaredRaw3(a, b), d2);
    const t = seed % (SCALE + 1);
    const interpolated = A.map((x, j) => x + (B[j] - x) * BigInt(t) / Q);
    assert.deepEqual(lerp3(a, b, t), interpolated.map(Number));
  }
});
