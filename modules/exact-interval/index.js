// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-003: exact, closed rational intervals for authoring-time analysis.
// No floats, implicit missing-value coercion, browser state or runtime packages.
import {ExactRational} from '../exact-rational/index.js';

const numerator = Object.getOwnPropertyDescriptor(ExactRational.prototype, 'numerator').get;
const denominator = Object.getOwnPropertyDescriptor(ExactRational.prototype, 'denominator').get;
const compare = ExactRational.prototype.compare;

function requireRational(value) {
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== ExactRational.prototype) {
    throw new TypeError('genuine ExactRational required');
  }
  try {
    // Prototype identity can be forged; private-field access cannot.
    numerator.call(value);
    denominator.call(value);
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError('genuine ExactRational required');
    throw error;
  }
  return value;
}

function cmp(a, b) { return compare.call(a, b); }

/** Immutable, non-subclassable closed interval [lower, upper]; touching counts. */
export class ExactInterval {
  #lower;
  #upper;
  constructor(lower, upper) {
    if (new.target !== ExactInterval) throw new TypeError('ExactInterval subclass forbidden');
    lower = requireRational(lower);
    upper = requireRational(upper);
    if (cmp(lower, upper) > 0) throw new RangeError('reversed closed interval');
    this.#lower = lower;
    this.#upper = upper;
    Object.freeze(this);
  }
  get lower() { return this.#lower; }
  get upper() { return this.#upper; }
  contains(value) {
    value = requireRational(value);
    return cmp(this.#lower, value) <= 0 && cmp(value, this.#upper) <= 0;
  }
  relate(other) {
    other = ExactInterval.#require(other);
    if (cmp(this.#upper, other.#lower) < 0) return 'a_below_b';
    if (cmp(other.#upper, this.#lower) < 0) return 'b_below_a';
    return 'overlap';
  }
  /** Returns a closed interval, a singleton for touching, or null if disjoint. */
  intersect(other) {
    other = ExactInterval.#require(other);
    if (cmp(this.#upper, other.#lower) < 0 ||
        cmp(other.#upper, this.#lower) < 0) return null;
    const lower = cmp(this.#lower, other.#lower) >= 0 ? this.#lower : other.#lower;
    const upper = cmp(this.#upper, other.#upper) <= 0 ? this.#upper : other.#upper;
    return new ExactInterval(lower, upper);
  }
  static #require(value) {
    if (value === null || typeof value !== 'object' ||
        Object.getPrototypeOf(value) !== ExactInterval.prototype ||
        !(#lower in value) || !(#upper in value)) {
      throw new TypeError('genuine ExactInterval required');
    }
    return value;
  }
  toString() { return '[' + this.#lower.toString() + ',' + this.#upper.toString() + ']'; }
  valueOf() { throw new TypeError('implicit ExactInterval numeric conversion forbidden'); }
  [Symbol.toPrimitive](hint) {
    if (hint === 'string') return this.toString();
    throw new TypeError('implicit ExactInterval numeric conversion forbidden');
  }
}
