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
