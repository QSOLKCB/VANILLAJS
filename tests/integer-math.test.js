import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../modules/integer-math/index.js';

test('integer arithmetic rejects fractions, unsafe values, wraparound and zero divisors', () => {
  for (const bad of [NaN, Infinity, -Infinity, 1.5, '1', null, undefined, 2147483648, -2147483649]) assert.throws(() => m.int32(bad));
  assert.equal(Object.is(m.int32(-0), -0), false);
  assert.throws(() => m.add(m.INT_MAX, 1)); assert.throws(() => m.subtract(m.INT_MIN, 1));
  assert.throws(() => m.divide(1, 0)); assert.throws(() => m.mulDiv(m.INT_MIN, -1, 1));
  assert.throws(() => m.vector3(new Array(3))); assert.throws(() => m.sqrt(-1));
});
test('scaled ratios, signed truncation and large intermediate products are exact', () => {
  assert.equal(m.fromRatio(3, 2), 98304); assert.equal(m.toNumber(98304), 1.5);
  assert.equal(m.multiply(98304, 98304), 147456); assert.equal(m.divide(-65536, 196608), -21845);
  assert.equal(m.mulDiv(m.INT_MAX, m.INT_MAX, m.INT_MAX), m.INT_MAX);
  assert.equal(m.mulDiv(-7, 3, 2), -10); assert.equal(m.mulDiv(7, 3, -2), -10);
});
test('10000 products agree with an independent magnitude/remainder oracle', () => {
  let seed = 83;
  for (let i = 0; i < 10000; i++) {
    seed = m.nextRandom(seed); const a = seed | 0;
    seed = m.nextRandom(seed); const b = seed | 0;
    seed = m.nextRandom(seed); const d = (seed | 0) || 1;
    const product = BigInt(a) * BigInt(b), divisor = BigInt(d);
    const magnitude = product < 0n ? -product : product, denominator = divisor < 0n ? -divisor : divisor;
    const q = (magnitude - magnitude % denominator) / denominator * ((a < 0) !== (b < 0) !== (d < 0) ? -1n : 1n);
    if (q < BigInt(m.INT_MIN) || q > BigInt(m.INT_MAX)) assert.throws(() => m.mulDiv(a, b, d));
    else assert.equal(m.mulDiv(a, b, d), Number(q));
  }
});
test('integer square root brackets the exact scaled radicand', () => {
  for (const value of [0, 1, 2, 1023, 1024, 147456, 4096, 123456789, m.INT_MAX]) {
    const r = BigInt(m.sqrt(value)), n = BigInt(value) * 65536n;
    assert.ok(r * r <= n && (r + 1n) * (r + 1n) > n);
  }
  let s = 1; const sequence = [];
  for (let i = 0; i < 4; i++) { s = m.nextRandom(s); sequence.push(s); }
  assert.deepEqual(sequence, [1015568748, 1586005467, 2165703038, 3027450565]);
  assert.equal(m.nextRandom(0), 1013904223); assert.throws(() => m.nextRandom(-1));
});
