// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INT_MIN, INT_MAX, SCALE, mulDiv, multiply, divide, sqrt, nextRandom} from '../modules/integer-math/index.js';

const MIN = BigInt(INT_MIN), MAX = BigInt(INT_MAX);
const edges = [INT_MIN, INT_MIN + 1, -1500000000, -1000000001,
  -65537, -65536, -65535, -2, -1, -0, 0, 1, 2, 3,
  65535, 65536, 65537, 1000000001, 1500000000,
  INT_MAX - 1, INT_MAX];

function compare(a, b, d) {
  if (d === 0) {
    assert.throws(() => mulDiv(a, b, d), RangeError);
    return;
  }
  const expected = BigInt(a) * BigInt(b) / BigInt(d);
  if (expected < MIN || expected > MAX) {
    assert.throws(() => mulDiv(a, b, d), RangeError,
      'overflow for ' + [a, b, d]);
  } else {
    const actual = mulDiv(a, b, d);
    assert.equal(actual, Number(expected), 'result for ' + [a, b, d]);
    assert.equal(Object.is(actual, -0), false);
  }
}

test('radix kernel has no BigInt production arithmetic and preserves Q16 API', async () => {
  const source = await readFile(new URL('../modules/integer-math/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /BigInt\s*\(/);
  assert.match(source, /function productWords/);
  assert.match(source, /function checkedQuotient/);
  assert.equal(SCALE, 65536);
});

test('adversarial signed boundaries and exact safe-integer quotient', () => {
  for (const a of edges) for (const b of edges) for (const d of edges) {
    compare(a, b, d);
  }
  for (const a of [INT_MAX, INT_MIN, 94906265, -94906265]) {
    for (const b of [1, 4194304, 94906265, INT_MAX]) {
      for (const d of [1, 2, 3, 65536, INT_MAX, INT_MIN]) compare(a, b, d);
    }
  }
  assert.equal(mulDiv(INT_MIN, INT_MIN, INT_MIN), INT_MIN);
  assert.equal(mulDiv(INT_MAX, INT_MAX, INT_MAX), INT_MAX);
  assert.equal(mulDiv(-1, 1, 2), 0);
  assert.equal(multiply(98304, 98304), 147456);
  assert.equal(divide(-65536, 196608), -21845);
  assert.throws(() => mulDiv(0, 1, 0), RangeError);
});

test('radix division and direct safe-integer path agree with independent oracle', () => {
  let seed = 0x18db4a31;
  const next = () => { seed = nextRandom(seed); return seed | 0; };
  for (let i = 0; i < 200000; i++) compare(next(), next(), next() || 1);
  for (let i = 0; i < 100000; i++) {
    const a = (next() & 0xffffff) - 0x7fffff;
    const b = (next() & 0xffffff) - 0x7fffff;
    const d = (next() & 0xffffff) || 1;
    compare(a, b, d);
  }
  for (let i = 0; i < 40000; i++) {
    compare(next() % 4000000, next() % 4000000,
      (next() % 4000000) || 1);
  }
});

test('sqrt exact bracketing across contiguous, seeded and extreme inputs', () => {
  const check = value => {
    const result = BigInt(sqrt(value));
    const radicand = BigInt(value) * BigInt(SCALE);
    assert.ok(result * result <= radicand, 'overestimate ' + value);
    assert.ok((result + 1n) ** 2n > radicand, 'underestimate ' + value);
  };
  for (let v = 0; v <= 200000; v++) check(v);
  let seed = 0x6a09e667;
  for (let i = 0; i < 200000; i++) {
    seed = nextRandom(seed);
    check(seed & INT_MAX);
  }
  for (let v = INT_MAX - 10000; v <= INT_MAX; v++) check(v);
  assert.throws(() => sqrt(-1), RangeError);
});
