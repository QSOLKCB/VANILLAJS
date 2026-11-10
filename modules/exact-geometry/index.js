// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-003: exact XY-plane geometry predicates for offline authoring.
// Intermediate BigInt determinants are not quantized to Q16.16.
import {ExactRational} from '../exact-rational/index.js';
import {ExactInterval} from '../exact-interval/index.js';

const rationalNumerator = Object.getOwnPropertyDescriptor(
  ExactRational.prototype, 'numerator').get;
const rationalDenominator = Object.getOwnPropertyDescriptor(
  ExactRational.prototype, 'denominator').get;
const intervalLower = Object.getOwnPropertyDescriptor(
  ExactInterval.prototype, 'lower').get;
const intervalUpper = Object.getOwnPropertyDescriptor(
  ExactInterval.prototype, 'upper').get;

function requireRational(value) {
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== ExactRational.prototype) {
    throw new TypeError('genuine ExactRational required');
  }
  try {
    rationalNumerator.call(value);
    rationalDenominator.call(value);
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError('genuine ExactRational required');
    throw error;
  }
  return value;
}
function requireInterval(value) {
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== ExactInterval.prototype) {
    throw new TypeError('genuine ExactInterval required');
  }
  try {
    return {lower: intervalLower.call(value), upper: intervalUpper.call(value)};
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError('genuine ExactInterval required');
    throw error;
  }
}
function cmp(a, b) {
  const left = rationalNumerator.call(a) * rationalDenominator.call(b);
  const right = rationalNumerator.call(b) * rationalDenominator.call(a);
  return left < right ? -1 : left > right ? 1 : 0;
}
function min(a, b) { return cmp(a, b) <= 0 ? a : b; }
function max(a, b) { return cmp(a, b) >= 0 ? a : b; }

/** An immutable XY point with exact bounded rational coordinates. */
export class ExactPoint2 {
  #x;
  #y;
  constructor(x, y) {
    if (new.target !== ExactPoint2) throw new TypeError('ExactPoint2 subclass forbidden');
    this.#x = requireRational(x);
    this.#y = requireRational(y);
    Object.freeze(this);
  }
  get x() { return this.#x; }
  get y() { return this.#y; }
  toString() { return '(' + this.#x.toString() + ',' + this.#y.toString() + ')'; }
  valueOf() { throw new TypeError('implicit point conversion forbidden'); }
  [Symbol.toPrimitive](hint) {
    if (hint === 'string') return this.toString();
    throw new TypeError('implicit point conversion forbidden');
  }
}
const pointX = Object.getOwnPropertyDescriptor(ExactPoint2.prototype, 'x').get;
const pointY = Object.getOwnPropertyDescriptor(ExactPoint2.prototype, 'y').get;
function requirePoint(value) {
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== ExactPoint2.prototype) {
    throw new TypeError('genuine ExactPoint2 required');
  }
  try {
    return {x: pointX.call(value), y: pointY.call(value)};
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError('genuine ExactPoint2 required');
    throw error;
  }
}
export function point2(x, y) { return new ExactPoint2(x, y); }

function difference(a, b) {
  const an = rationalNumerator.call(a), ad = rationalDenominator.call(a);
  const bn = rationalNumerator.call(b), bd = rationalDenominator.call(b);
  return {n: an * bd - bn * ad, d: ad * bd};
}
/** Sign of (b-a) × (c-a), positive for counterclockwise in XY (+Z). */
function orientation(a, b, c) {
  const dx1 = difference(b.x, a.x);
  const dy1 = difference(b.y, a.y);
  const dx2 = difference(c.x, a.x);
  const dy2 = difference(c.y, a.y);
  // Denominators are positive. These wide, bounded BigInt intermediates
  // avoid premature 256-bit rational-result rejection for predicates.
  const lhs = dx1.n * dy2.n * dy1.d * dx2.d;
  const rhs = dy1.n * dx2.n * dx1.d * dy2.d;
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}
export function orientation2(a, b, c) {
  return orientation(requirePoint(a), requirePoint(b), requirePoint(c));
}
function between(value, a, b) {
  return cmp(value, min(a, b)) >= 0 && cmp(value, max(a, b)) <= 0;
}
function onSegment(p, a, b) {
  return orientation(a, b, p) === 0 &&
    between(p.x, a.x, b.x) && between(p.y, a.y, b.y);
}
/** Closed segment membership; a=b is a valid point segment. */
export function pointOnSegment(p, a, b) {
  return onSegment(requirePoint(p), requirePoint(a), requirePoint(b));
}
function same(a, b) { return cmp(a.x, b.x) === 0 && cmp(a.y, b.y) === 0; }

/**
 * Classify two closed segments: disjoint, touch (one shared point),
 * cross (proper interior intersection), overlap (positive-length collinear).
 */
export function segmentRelation(a, b, c, d) {
  a = requirePoint(a);
  b = requirePoint(b);
  c = requirePoint(c);
  d = requirePoint(d);
  if (same(a, b)) return onSegment(a, c, d) ? 'touch' : 'disjoint';
  if (same(c, d)) return onSegment(c, a, b) ? 'touch' : 'disjoint';

  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
    const axis = cmp(a.x, b.x) === 0 ? 'y' : 'x';
    const lower = max(min(a[axis], b[axis]), min(c[axis], d[axis]));
    const upper = min(max(a[axis], b[axis]), max(c[axis], d[axis]));
    const relation = cmp(lower, upper);
    return relation > 0 ? 'disjoint' : relation === 0 ? 'touch' : 'overlap';
  }
  if ((o1 === 0 && onSegment(c, a, b)) ||
      (o2 === 0 && onSegment(d, a, b)) ||
      (o3 === 0 && onSegment(a, c, d)) ||
      (o4 === 0 && onSegment(b, c, d))) return 'touch';
  return o1 * o2 < 0 && o3 * o4 < 0 ? 'cross' : 'disjoint';
}

/** Closed axis-aligned XY box, defined by independently checked intervals. */
export class ExactBox2 {
  #x;
  #y;
  constructor(x, y) {
    if (new.target !== ExactBox2) throw new TypeError('ExactBox2 subclass forbidden');
    requireInterval(x);
    requireInterval(y);
    this.#x = x;
    this.#y = y;
    Object.freeze(this);
  }
  get x() { return this.#x; }
  get y() { return this.#y; }
  contains(point) {
    const p = requirePoint(point);
    const x = requireInterval(this.#x), y = requireInterval(this.#y);
    return cmp(x.lower, p.x) <= 0 && cmp(p.x, x.upper) <= 0 &&
      cmp(y.lower, p.y) <= 0 && cmp(p.y, y.upper) <= 0;
  }
}
const boxX = Object.getOwnPropertyDescriptor(ExactBox2.prototype, 'x').get;
const boxY = Object.getOwnPropertyDescriptor(ExactBox2.prototype, 'y').get;
function requireBox(value) {
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== ExactBox2.prototype) {
    throw new TypeError('genuine ExactBox2 required');
  }
  try {
    return {x: requireInterval(boxX.call(value)), y: requireInterval(boxY.call(value))};
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError('genuine ExactBox2 required');
    throw error;
  }
}
/** Construct a normalized AABB from unordered corner points. */
export function boxFromCorners(a, b) {
  a = requirePoint(a);
  b = requirePoint(b);
  return new ExactBox2(
    new ExactInterval(min(a.x, b.x), max(a.x, b.x)),
    new ExactInterval(min(a.y, b.y), max(a.y, b.y)));
}
/** disjoint, touch (zero-area intersection), overlap (positive-area intersection). */
export function boxRelation(a, b) {
  a = requireBox(a);
  b = requireBox(b);
  const xLo = max(a.x.lower, b.x.lower), xHi = min(a.x.upper, b.x.upper);
  const yLo = max(a.y.lower, b.y.lower), yHi = min(a.y.upper, b.y.upper);
  const cx = cmp(xLo, xHi), cy = cmp(yLo, yHi);
  return cx > 0 || cy > 0 ? 'disjoint' :
    cx === 0 || cy === 0 ? 'touch' : 'overlap';
}
