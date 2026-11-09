// SPDX-License-Identifier: Apache-2.0
// Finite source-constrained ECMAScript Number boundary conformance.
// This is NOT a universal runtime refinement theorem.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {int32, uint32, nextRandom, INT_MIN, INT_MAX} from '../modules/integer-math/index.js';

const PINNED_BLOB = 'd457b0154d9dfc8b50fd593b5e9dff75e1ea66b9';
const CHECKED_UINT_MAX = 4294967295;
const MOD = 4294967296n;

test('production source identity remains pinned to the reviewed scalar kernel', () => {
  const observed = execFileSync('git', ['hash-object', 'modules/integer-math/index.js'], {
    encoding: 'utf8'
  }).trim();
  assert.equal(observed, PINNED_BLOB);
});

test('accepted signed 32-bit Numbers equal their bitwise int32 projection', () => {
  const edge = [
    INT_MIN, INT_MIN + 1, -65536, -1, -0, 0, 1, 65536,
    INT_MAX - 1, INT_MAX,
  ];
  let state = 0x47bd2391;
  for (let i = 0; i < 12000; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    edge.push(state | 0);
  }
  for (const value of edge) {
    const actual = int32(value);
    assert.equal(actual, value | 0);
    assert.equal(Object.is(actual, -0), false);
  }
});

test('unsigned accepted integers equal ToUint32-like >>>0 projection', () => {
  for (const value of [
    -0, 0, 1, 65536, 2147483647, 2147483648,
    CHECKED_UINT_MAX - 1, CHECKED_UINT_MAX,
  ]) {
    const actual = uint32(value);
    assert.equal(actual, value >>> 0);
    assert.equal(Object.is(actual, -0), false);
  }
});

test('unrestricted ECMAScript ToInt32 is not the checked integer API', () => {
  assert.equal(2147483648 | 0, INT_MIN);
  assert.throws(() => int32(2147483648), RangeError);
  assert.equal(NaN | 0, 0);
  assert.throws(() => int32(NaN), RangeError);
  assert.equal(Number.MAX_SAFE_INTEGER | 0, -1);
  assert.throws(() => int32(Number.MAX_SAFE_INTEGER), RangeError);
  assert.equal('1' | 0, 1);
  assert.throws(() => int32('1'), RangeError);
  assert.equal(new Int32Array([4294967295])[0], -1);
  assert.throws(() => int32(4294967295), RangeError);
  for (const invalid of [Infinity, -Infinity, null, undefined, 0.5, -0.5, {}]) {
    assert.throws(() => int32(invalid), RangeError);
  }
  for (const invalid of [-1, Infinity, NaN, 0.5, 4294967296, '0']) {
    assert.throws(() => uint32(invalid), RangeError);
  }
});

test('PRNG wraps exactly modulo uint32 against independent BigInt model', () => {
  let state = 0;
  for (let i = 0; i < 16000; i++) {
    const expected = Number((BigInt(state) * 1664525n + 1013904223n) % MOD);
    const actual = nextRandom(state);
    assert.equal(actual, expected);
    state = actual;
  }
});
