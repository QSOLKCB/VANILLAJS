// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-001: no production helper is used to calculate expected values.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ExactRational, parseDecimal, fromJSON, SERIAL_KIND,
  MAX_COMPONENT_BITS, MAX_WHOLE_DIGITS, MAX_FRACTION_DIGITS
} from '../modules/exact-rational/index.js';

const r = (n, d = 1n) => new ExactRational(n, d);
function checkFraction(actual, n, d) {
  assert.equal(actual.numerator * d, actual.denominator * n);
  assert.ok(actual.denominator > 0n);
  const abs = x => x < 0n ? -x : x;
  let a = abs(actual.numerator), b = actual.denominator;
  while (b !== 0n) [a, b] = [b, a % b];
  assert.equal(a, 1n, 'result must be normalized');
  assert.ok(abs(actual.numerator) < (1n << 256n));
  assert.ok(actual.denominator < (1n << 256n));
  assert.ok(Object.isFrozen(actual));
}

test('bounded exact decimal syntax and normalized base-10 output', () => {
  assert.equal(parseDecimal('0.1').add(parseDecimal('0.2')).toDecimalExact(), '0.3');
  assert.equal(parseDecimal('0.1').toString(), '1/10');
  assert.equal(parseDecimal('-0.00').toString(), '0');
  assert.equal(parseDecimal('1.23000').toDecimalExact(), '1.23');
  assert.equal(parseDecimal('0.000000000000000001').toDecimalExact(), '0.000000000000000001');
  assert.equal(parseDecimal('999999999999999999.999999999999999999').toDecimalExact(),
    '999999999999999999.999999999999999999');
  assert.equal(parseDecimal('-12').toDecimalExact(), '-12');
  assert.equal(parseDecimal('0').denominator, 1n);
  assert.equal(MAX_COMPONENT_BITS, 256);
  assert.equal(MAX_WHOLE_DIGITS, 18);
  assert.equal(MAX_FRACTION_DIGITS, 18);
});

test('malformed, ambiguous, overlength and non-string decimals fail closed', () => {
  for (const value of ['', '01', '-01', '+1', '1.', '.1', '-.1', ' 1', '1 ',
    '1e1', '1E-1', '0x10', 'Infinity', 'NaN', '1_000', '--1', '1.0.0',
    '1000000000000000000', '0.1234567890123456789', '0'.repeat(50000),
    0.1, null, undefined, new String('1')]) {
    assert.throws(() => parseDecimal(value), TypeError, String(value).slice(0, 24));
  }
});

test('component types, sign, canonical zero and overflow bounds', () => {
  assert.equal(r(0, -123).toString(), '0');
  assert.equal(r(-6, -8).toString(), '3/4');
  assert.equal(r(21n, -6n).toString(), '-7/2');
  assert.equal(r(-0, 2).toString(), '0');
  for (const [n, d] of [[0, 0], [1n, 0n]]) {
    assert.throws(() => r(n, d), RangeError);
  }
  for (const bad of [0.3, Number.MAX_SAFE_INTEGER + 1, 1e100, NaN,
    Infinity, -Infinity, '1', {}, null, undefined]) {
    assert.throws(() => r(bad), TypeError);
  }
  const max = (1n << 256n) - 1n;
  assert.equal(r(max).numerator, max);
  assert.throws(() => r(max + 1n), RangeError);
  assert.throws(() => r(1n, -(max + 1n)), RangeError);
  assert.throws(() => r(max).multiply(r(2n)), RangeError);
  assert.throws(() => r(max).add(r(1n)), RangeError);
});

test('arithmetic, exact ordering and cancellation are independent of Number', () => {
  const a = r(-7n, 12n), b = r(5n, 18n);
  checkFraction(a.add(b), -7n * 18n + 5n * 12n, 12n * 18n);
  checkFraction(a.subtract(b), -7n * 18n - 5n * 12n, 12n * 18n);
  checkFraction(a.multiply(b), -35n, 216n);
  checkFraction(a.divide(b), -126n, 60n);
  assert.equal(a.compare(b), -1);
  assert.equal(b.compare(a), 1);
  assert.equal(a.compare(r(-14, 24)), 0);
  assert.equal(a.negate().toString(), '7/12');
  assert.equal(a.abs().toString(), '7/12');
  assert.equal(r(0).negate().toString(), '0');
  assert.throws(() => a.divide(r(0)), RangeError);
  assert.throws(() => a.add(2), TypeError);
  assert.throws(() => a.compare(null), TypeError);
  const huge = 1n << 250n;
  assert.equal(r(1n, huge).multiply(r(huge)).toString(), '1');
  assert.equal(r(huge).divide(r(huge)).toString(), '1');
  assert.equal(r(1n, huge).add(r(1n, huge)).toString(), '1/' + String(huge / 2n));
  assert.equal(r(huge).compare(r(huge - 1n)), 1);
});

test('finite decimal boundary is explicit; never approximate repeating decimals', () => {
  for (const [n, d, expected] of [
    [1, 8, '0.125'], [-7, 40, '-0.175'], [1, 262144, '0.000003814697265625'],
    [0, 3, '0'], [200, 2, '100'], [1, 5, '0.2']
  ]) assert.equal(r(n, d).toDecimalExact(), expected);
  assert.throws(() => r(1, 3).toDecimalExact(), /nonterminating/);
  assert.throws(() => r(1n, 1n << 19n).toDecimalExact(), /18 places/);
  assert.throws(() => r(1n, 5n ** 19n).toDecimalExact(), /18 places/);
});

test('canonical versioned serialization and strict decoding', () => {
  const a = parseDecimal('-12.5');
  const encoded = JSON.parse(JSON.stringify(a));
  assert.deepEqual(encoded, {kind: SERIAL_KIND, numerator: '-25', denominator: '2'});
  assert.equal(fromJSON(encoded).toString(), '-25/2');
  assert.equal(fromJSON(Object.assign(Object.create(null), encoded)).toString(), '-25/2');
  for (const bad of [null, [], 3, {}, {...encoded, extra: 1},
    {...encoded, kind: 'alien.v0'}, {...encoded, numerator: '02'},
    {...encoded, numerator: '+2'}, {...encoded, numerator: '-0'},
    {...encoded, numerator: '2/1'}, {...encoded, denominator: '0'},
    {...encoded, denominator: '-2'}, {...encoded, denominator: '02'},
    {...encoded, numerator: '2', denominator: '4'},
    {...encoded, numerator: '1'.repeat(300)},
    Object.assign(Object.create({inherited: true}), encoded),
    Object.assign({...encoded}, {[Symbol('extra')]: 1}),
    Object.defineProperty({...encoded}, 'hidden', {value: 1}),
    Object.defineProperty({...encoded}, 'numerator', {get: () => '2'})]) {
    assert.throws(() => fromJSON(bad), /rational|component/);
  }
  const max = (1n << 256n) - 1n;
  assert.throws(() => fromJSON({...encoded, numerator: String(max + 1n)}), RangeError);
});

test('no accidental implicit float conversion or mutable/subclass state', () => {
  const a = r(1, 10);
  assert.equal(String(a), '1/10');
  assert.throws(() => Number(a), /implicit/);
  assert.throws(() => a + 1, /implicit/);
  assert.throws(() => Math.cos(a), /implicit/);
  assert.throws(() => { a.numerator = 2n; }, TypeError);
  assert.throws(() => { class Sub extends ExactRational {} ; new Sub(1n); }, TypeError);
});

test('seeded cross-products: all operations agree with independent integer oracle', () => {
  let seed = 0x7c3a42d1;
  function next() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
  for (let i = 0; i < 12000; i++) {
    const an = BigInt((next() % 20001) - 10000);
    const ad = BigInt(1 + next() % 10000);
    const bn = BigInt((next() % 20001) - 10000);
    const bd = BigInt(1 + next() % 10000);
    const a = r(an, ad), b = r(bn, bd);
    checkFraction(a.add(b), an * bd + bn * ad, ad * bd);
    checkFraction(a.subtract(b), an * bd - bn * ad, ad * bd);
    checkFraction(a.multiply(b), an * bn, ad * bd);
    if (bn !== 0n) checkFraction(a.divide(b), an * bd, ad * bn);
    else assert.throws(() => a.divide(b), RangeError);
    const left = an * bd, right = bn * ad;
    assert.equal(a.compare(b), left < right ? -1 : left > right ? 1 : 0);
    assert.equal(a.add(b).toString(), b.add(a).toString());
  }
});

test('independent CPython fractions.Fraction vector fixture', async () => {
  const url = new URL('fixtures/alien-math-001-vectors.json', import.meta.url);
  const fixture = JSON.parse(await readFile(url, 'utf8'));
  assert.equal(fixture.schema, 'qsol.alien-math-001.oracle.v1');
  assert.equal(fixture.oracle, 'CPython fractions.Fraction');
  for (const item of fixture.cases) {
    const a = parseDecimal(item.a), b = parseDecimal(item.b);
    assert.equal(a.add(b).toString(), item.add);
    assert.equal(a.subtract(b).toString(), item.subtract);
    assert.equal(a.multiply(b).toString(), item.multiply);
    assert.equal(a.compare(b), item.compare);
    if (item.divide === null) assert.throws(() => a.divide(b), RangeError);
    else assert.equal(a.divide(b).toString(), item.divide);
  }
});
