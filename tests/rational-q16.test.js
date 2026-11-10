// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-002: external Fraction oracle and separately stated exact properties.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {ExactRational, parseDecimal} from '../modules/exact-rational/index.js';
import {quantizeQ16, rationalFromQ16} from '../modules/rational-q16/index.js';
import {SCALE, INT_MIN, INT_MAX} from '../modules/integer-math/index.js';

const modes = ['exact', 'toward-zero', 'floor', 'ceil', 'nearest-even', 'nearest-away'];
const overflows = ['reject', 'saturate'];
const q = (numerator, denominator = 1n) => new ExactRational(BigInt(numerator), BigInt(denominator));
const cfg = (rounding, overflow = 'reject') => ({rounding, overflow});
const abs = x => x < 0n ? -x : x;

test('exact decimal authoring: quantization is a deliberate boundary', () => {
  const a = parseDecimal('0.1'), b = parseDecimal('0.2');
  const sum = a.add(b);
  assert.equal(sum.toDecimalExact(), '0.3');
  assert.equal(quantizeQ16(sum, cfg('toward-zero')), 19660);
  assert.equal(quantizeQ16(a, cfg('toward-zero')), 6553);
  assert.equal(quantizeQ16(b, cfg('toward-zero')), 13107);
  // Delayed quantization intentionally differs from quantizing each term first.
  assert.equal(quantizeQ16(a.add(a), cfg('toward-zero')), 13107);
  assert.equal(quantizeQ16(a, cfg('toward-zero')) * 2, 13106);
  assert.equal(quantizeQ16(parseDecimal('-32768'), cfg('exact')), INT_MIN);
  assert.equal(quantizeQ16(parseDecimal('32767.9999847412109375'), cfg('exact')), INT_MAX);
  assert.throws(() => quantizeQ16(a, cfg('exact')), /not exactly representable/);
});

test('all six rounding policies: signed half-ULP and ordinary fractions', () => {
  const rows = [
    [1, [null, 0, 0, 1, 0, 1]], [-1, [null, 0, -1, 0, 0, -1]],
    [3, [null, 1, 1, 2, 2, 2]], [-3, [null, -1, -2, -1, -2, -2]],
    [5, [null, 2, 2, 3, 2, 3]], [-5, [null, -2, -3, -2, -2, -3]],
  ];
  for (const [n, expected] of rows) {
    const input = q(n, 131072);
    for (let i = 0; i < modes.length; i++) {
      if (expected[i] === null) assert.throws(() => quantizeQ16(input, cfg(modes[i])), RangeError);
      else assert.equal(quantizeQ16(input, cfg(modes[i])), expected[i], `${n}: ${modes[i]}`);
    }
  }
  for (const value of [q(3, 2), q(-3, 2), q(1, 65536), q(-1, 65536)]) {
    assert.equal(quantizeQ16(value, cfg('exact')), Number(value.numerator * 65536n / value.denominator));
  }
});

test('explicit overflow: reject or opt-in saturate, with final-integer checks', () => {
  assert.throws(() => quantizeQ16(q(INT_MAX + 1, SCALE), cfg('toward-zero')), /overflow/);
  assert.throws(() => quantizeQ16(q(INT_MIN - 1, SCALE), cfg('toward-zero')), /overflow/);
  assert.equal(quantizeQ16(q(INT_MAX + 1, SCALE), cfg('toward-zero', 'saturate')), INT_MAX);
  assert.equal(quantizeQ16(q(INT_MIN - 1, SCALE), cfg('floor', 'saturate')), INT_MIN);
  assert.equal(quantizeQ16(q(2 * INT_MAX + 1, 2 * SCALE), cfg('toward-zero')), INT_MAX);
  assert.throws(() => quantizeQ16(q(2 * INT_MAX + 1, 2 * SCALE), cfg('nearest-even')), RangeError);
  assert.equal(quantizeQ16(q(2 * INT_MAX + 1, 2 * SCALE), cfg('nearest-even', 'saturate')), INT_MAX);
  assert.equal(quantizeQ16(q(2 * INT_MIN - 1, 2 * SCALE), cfg('nearest-even')), INT_MIN);
  assert.throws(() => quantizeQ16(q(2 * INT_MIN - 1, 2 * SCALE), cfg('nearest-away')), RangeError);
  assert.equal(quantizeQ16(q(2 * INT_MIN - 1, 2 * SCALE), cfg('nearest-away', 'saturate')), INT_MIN);
  const max = (1n << 256n) - 1n;
  assert.equal(quantizeQ16(q(max), cfg('ceil', 'saturate')), INT_MAX);
  assert.equal(quantizeQ16(q(-max), cfg('floor', 'saturate')), INT_MIN);
  assert.throws(() => quantizeQ16(q(max), cfg('nearest-even')), RangeError);
});

test('policy admission is explicit, strict and rejects unintended accessors', () => {
  const a = q(1, 3);
  for (const bad of [undefined, null, {}, [], 0, 'nearest-even',
    {rounding: 'nearest-even'}, {overflow: 'reject'},
    {rounding: 'automatic', overflow: 'reject'},
    {rounding: 'floor', overflow: 'wrap'},
    {rounding: 'exact', overflow: 'saturate'},
    {rounding: 'toward-zero', overflow: 'reject', allowUnsafe: true},
    Object.assign(Object.create({inherited: true}), cfg('ceil')),
    Object.assign(cfg('ceil'), {[Symbol('extra')]: 1}),
    Object.defineProperty(cfg('floor'), 'rounding', {get: () => 'floor'}),
  ]) assert.throws(() => quantizeQ16(a, bad), TypeError);
  assert.throws(() => quantizeQ16(undefined, cfg('floor')), TypeError);
  assert.throws(() => quantizeQ16({numerator: 1n, denominator: 2n}, cfg('floor')), TypeError);
  assert.throws(() => quantizeQ16(0.5, cfg('floor')), TypeError);
  assert.equal(quantizeQ16(a, Object.assign(Object.create(null), cfg('floor'))), 21845);
});

test('inverse mapping validates signed-int32 values; arbitrary raw round-trips exactly', () => {
  for (const raw of [INT_MIN, INT_MIN + 1, -65536, -1, -0, 0, 1,
    65536, INT_MAX - 1, INT_MAX]) {
    const rational = rationalFromQ16(raw);
    assert.equal(quantizeQ16(rational, cfg('exact')), raw || 0);
    assert.equal(rational.numerator * 65536n, BigInt(raw) * rational.denominator);
    assert.ok(Object.isFrozen(rational));
  }
  for (const bad of [NaN, Infinity, -Infinity, 0.5, 2147483648, -2147483649,
    '1', 1n, {}, null, undefined]) assert.throws(() => rationalFromQ16(bad), RangeError);
  let state = 0x4529e737;
  for (let i = 0; i < 25000; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const raw = state | 0;
    assert.equal(quantizeQ16(rationalFromQ16(raw), cfg('exact')), raw);
  }
});

test('exact integer error bounds when overflow is rejected', () => {
  let state = 0x12345678;
  const next = () => { state = (Math.imul(state, 22695477) + 1) >>> 0; return state; };
  for (let i = 0; i < 6000; i++) {
    const numerator = BigInt(next() % 30001 - 15000);
    const denominator = BigInt(next() % 30000 + 1);
    const rational = q(numerator, denominator);
    for (const mode of modes) {
      let raw;
      try { raw = quantizeQ16(rational, cfg(mode)); }
      catch (error) {
        assert.ok(error instanceof RangeError);
        if (mode === 'exact') continue;
        assert.match(error.message, /overflow/);
        continue;
      }
      const signedError = BigInt(raw) * rational.denominator - rational.numerator * 65536n;
      if (mode === 'exact') assert.equal(signedError, 0n);
      else if (mode === 'nearest-even' || mode === 'nearest-away') {
        assert.ok(abs(signedError) * 2n <= rational.denominator, mode);
      } else {
        assert.ok(abs(signedError) < rational.denominator, mode);
        if (mode === 'floor') assert.ok(signedError <= 0n);
        if (mode === 'ceil') assert.ok(signedError >= 0n);
      }
      assert.ok(raw >= INT_MIN && raw <= INT_MAX);
      assert.equal(Object.is(raw, -0), false);
    }
  }
});

const FIXED = [
  [0n,1n],[1n,10n],[-1n,10n],[3n,10n],[-3n,10n],
  [1n,3n],[-1n,3n],[1n,7n],[-1n,7n],
  [1n,131072n],[-1n,131072n],[3n,131072n],[-3n,131072n],
  [5n,131072n],[-5n,131072n],[1n,65536n],[-1n,65536n],
  [2147483647n,65536n],[-2147483648n,65536n],[2147483648n,65536n],
  [-2147483649n,65536n],[4294967295n,131072n],
  [4294967296n,131072n],[-4294967297n,131072n],
  [-4294967298n,131072n],[1n,(1n<<256n)-1n],[(1n<<256n)-1n,1n],[-((1n<<256n)-1n),1n],
  [(1n<<256n)-1n,(1n<<256n)-1n],[1n<<255n,(1n<<256n)-1n],[-(1n<<255n),(1n<<256n)-1n],
  [1n,1n<<18n],[1n,1n<<17n],[1n,1n<<16n],[1n,1n<<15n],
  [0n,(1n<<256n)-1n],[100000000000000001n,100000000000000000n]
];

function* inputs() {
  yield* FIXED;
  let state = 0x6a09e667;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  for (let i = 0; i < 2048; i++) {
    const a = next(), b = next();
    if (i % 4 === 0) yield [BigInt(a % 200000001 - 100000000), BigInt(b % 100000000 + 1)];
    else if (i % 4 === 1) {
      const d = BigInt(b % 4096 + 1);
      yield [2147483647n * d + BigInt(a % 7 - 3), 65536n * d];
    } else if (i % 4 === 2) {
      const d = BigInt(b % 4096 + 1);
      yield [-2147483648n * d + BigInt(a % 7 - 3), 65536n * d];
    } else yield [BigInt(a % 21 - 10), 131072n];
  }
}

test('25,020 source-independent CPython Fraction rounding/overflow observations', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('fixtures/alien-math-002-oracle.json', import.meta.url), 'utf8'));
  assert.equal(fixture.schema, 'qsol.alien-math-002.fraction-oracle.v1');
  assert.match(fixture.oracle, /CPython fractions\.Fraction/);
  assert.equal(fixture.seed, '0x6a09e667');
  assert.equal(fixture.fixed_cases, FIXED.length);
  assert.equal(fixture.generated_cases, 2048);
  const digest = createHash('sha256');
  let observations = 0;
  for (const [n, d] of inputs()) {
    const value = q(n, d);
    for (const rounding of modes) for (const overflow of overflows) {
      let outcome;
      try { outcome = String(quantizeQ16(value, cfg(rounding, overflow))); }
      catch (error) {
        if (error instanceof TypeError && rounding === 'exact' && overflow === 'saturate')
          outcome = 'invalid-policy';
        else if (error instanceof RangeError && /not exactly representable/.test(error.message))
          outcome = 'inexact';
        else if (error instanceof RangeError && /overflow/.test(error.message))
          outcome = 'overflow';
        else throw error;
      }
      digest.update(`${n}/${d}|${rounding}|${overflow}|${outcome}\n`);
      observations++;
    }
  }
  assert.equal(observations, fixture.observations);
  assert.equal(digest.digest('hex'), fixture.sha256, 'independent Fraction oracle disagreement');
});
