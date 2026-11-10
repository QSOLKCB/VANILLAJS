// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-001: bounded, exact authoring rationals. Not a Q16.16 backend.
// No imports, ambient state, floating rational arithmetic or implicit float coercion.

export const MAX_COMPONENT_BITS = 256;
export const MAX_WHOLE_DIGITS = 18;
export const MAX_FRACTION_DIGITS = 18;
export const SERIAL_KIND = 'qsol.exact-rational.v1';

const MAX_MAGNITUDE = (1n << BigInt(MAX_COMPONENT_BITS)) - 1n;
const DECIMAL = /^-?(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,18})?$/;
const INTEGER = /^(?:0|-?[1-9][0-9]*)$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

function magnitude(n) { return n < 0n ? -n : n; }
function integer(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  throw new TypeError('integer must be bigint or a safe integer Number');
}
function bounded(n) {
  if (magnitude(n) > MAX_MAGNITUDE) {
    throw new RangeError('rational component exceeds 256 bits');
  }
  return n;
}
function gcd(a, b) {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}
function operand(value) {
  if (value === null || Object.getPrototypeOf(value) !== ExactRational.prototype) {
    throw new TypeError('ExactRational operand required');
  }
  return value;
}

/** Exact reduced rational (immutable, non-subclassable, bounded numerator/denominator). */
export class ExactRational {
  #n;
  #d;
  constructor(numerator, denominator = 1n) {
    if (new.target !== ExactRational) throw new TypeError('rational subclassing forbidden');
    let n = bounded(integer(numerator));
    let d = bounded(integer(denominator));
    if (d === 0n) throw new RangeError('zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const common = gcd(magnitude(n), d);
    this.#n = n / common;
    this.#d = d / common;
    Object.freeze(this);
  }
  get numerator() { return this.#n; }
  get denominator() { return this.#d; }
  add(other) {
    other = operand(other);
    const common = gcd(this.#d, other.#d);
    const left = this.#d / common;
    const right = other.#d / common;
    const sum = this.#n * right + other.#n * left;
    const cancel = gcd(magnitude(sum), common);
    return new ExactRational(sum / cancel, (left * other.#d) / cancel);
  }
  subtract(other) {
    other = operand(other);
    const common = gcd(this.#d, other.#d);
    const left = this.#d / common;
    const right = other.#d / common;
    const difference = this.#n * right - other.#n * left;
    const cancel = gcd(magnitude(difference), common);
    return new ExactRational(difference / cancel, (left * other.#d) / cancel);
  }
  multiply(other) {
    other = operand(other);
    const a = gcd(magnitude(this.#n), other.#d);
    const b = gcd(magnitude(other.#n), this.#d);
    return new ExactRational((this.#n / a) * (other.#n / b),
      (this.#d / b) * (other.#d / a));
  }
  divide(other) {
    other = operand(other);
    if (other.#n === 0n) throw new RangeError('division by zero');
    const a = gcd(magnitude(this.#n), magnitude(other.#n));
    const b = gcd(this.#d, other.#d);
    return new ExactRational((this.#n / a) * (other.#d / b),
      (this.#d / b) * (other.#n / a));
  }
  compare(other) {
    other = operand(other);
    const a = this.#n * other.#d;
    const b = other.#n * this.#d;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  negate() { return new ExactRational(-this.#n, this.#d); }
  abs() { return new ExactRational(magnitude(this.#n), this.#d); }
  /** Exact finite base-10 spelling, with at most 18 fractional places. */
  toDecimalExact() {
    let remaining = this.#d;
    let twos = 0;
    let fives = 0;
    while (remaining % 2n === 0n) {
      remaining /= 2n;
      if (++twos > MAX_FRACTION_DIGITS) throw new RangeError('decimal exceeds 18 places');
    }
    while (remaining % 5n === 0n) {
      remaining /= 5n;
      if (++fives > MAX_FRACTION_DIGITS) throw new RangeError('decimal exceeds 18 places');
    }
    if (remaining !== 1n) throw new RangeError('nonterminating decimal expansion');
    const places = Math.max(twos, fives);
    const scaled = magnitude(this.#n) * (10n ** BigInt(places)) / this.#d;
    const sign = this.#n < 0n ? '-' : '';
    if (places === 0) return sign + String(scaled);
    const digits = String(scaled).padStart(places + 1, '0');
    const fraction = digits.slice(-places).replace(/0+$/, '');
    return sign + digits.slice(0, -places) + (fraction ? '.' + fraction : '');
  }
  toString() { return this.#d === 1n ? String(this.#n) : String(this.#n) + '/' + String(this.#d); }
  toJSON() {
    return {kind: SERIAL_KIND, numerator: String(this.#n), denominator: String(this.#d)};
  }
  valueOf() { throw new TypeError('implicit rational-to-Number coercion forbidden'); }
  [Symbol.toPrimitive](hint) {
    if (hint === 'string') return this.toString();
    throw new TypeError('implicit rational-to-Number coercion forbidden');
  }
}

/** Restricted decimal grammar; preserves exact value, not redundant trailing zeros. */
export function parseDecimal(text) {
  if (typeof text !== 'string' || text.length > 38 || !DECIMAL.test(text)) {
    throw new TypeError('bounded plain decimal string required');
  }
  const negative = text[0] === '-';
  const body = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = body.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const digits = BigInt(whole) * scale + BigInt(fraction || '0');
  return new ExactRational(negative ? -digits : digits, scale);
}

/** Accept only canonical, normalized, version-tagged JSON rational records. */
export function fromJSON(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(record)) ||
      Reflect.ownKeys(record).length !== 3) {
    throw new TypeError('invalid rational JSON record');
  }
  const desc = Object.getOwnPropertyDescriptors(record);
  if (!['kind', 'numerator', 'denominator'].every(k =>
    Object.hasOwn(desc, k) && Object.hasOwn(desc[k], 'value'))) {
    throw new TypeError('invalid rational JSON fields');
  }
  const {kind, numerator, denominator} = record;
  if (kind !== SERIAL_KIND || typeof numerator !== 'string' ||
      typeof denominator !== 'string' || numerator.length > 79 ||
      denominator.length > 78 || !INTEGER.test(numerator) ||
      !POSITIVE_INTEGER.test(denominator)) {
    throw new TypeError('noncanonical rational JSON');
  }
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  const result = new ExactRational(n, d);
  if (result.numerator !== n || result.denominator !== d) {
    throw new TypeError('unreduced rational JSON');
  }
  return result;
}
