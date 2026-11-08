// SPDX-License-Identifier: Apache-2.0
// Independent Q16.16 implementation: exact unsigned 16-bit limbs, checked int32
// results. No implicit modulo-2^32 arithmetic except the documented RNG.
//
// The arithmetic is intentionally defined by integer identities, not by the
// internal rounding/overflow rules of a native game, assembly instruction,
// or any reverse-engineered third-party routine.

export const SCALE = 1 << 16;
export const INT_MIN = -2147483648;
export const INT_MAX = 2147483647;

const BASE = 65536;
const UNSIGNED_MAX = 4294967295;

/** Reject fractional, non-numeric and nonrepresentable state. */
export function int32(value, name = 'value') {
  if (typeof value !== 'number' || !Number.isInteger(value) ||
      value < INT_MIN || value > INT_MAX) {
    throw new RangeError(name + ' must be a signed 32-bit integer');
  }
  return value || 0;
}

export function uint32(value, name = 'value') {
  if (typeof value !== 'number' || !Number.isInteger(value) ||
      value < 0 || value > UNSIGNED_MAX) {
    throw new RangeError(name + ' must be an unsigned 32-bit integer');
  }
  return value || 0;
}

export function vector3(value, name = 'vector') {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(name + ' must be an array of three integers');
  }
  // Deliberately index every coordinate; Array.map would skip sparse holes.
  return [int32(value[0], name + '[0]'),
          int32(value[1], name + '[1]'),
          int32(value[2], name + '[2]')];
}

export function add(a, b) {
  return int32(int32(a) + int32(b), 'sum');
}

export function subtract(a, b) {
  return int32(int32(a) - int32(b), 'difference');
}

/** Multiply nonnegative signed-int32 magnitudes into two exact uint32 limbs.
 *
 * Each 16x16 partial product is at most 65535² and all carries fit exactly
 * inside IEEE-754's 53-bit integer precision. No low product bits are lost.
 * [high, low] represents high*2^32 + low; both words are unsigned.
 */
function productWords(a, b) {
  const a0 = a % BASE, a1 = Math.floor(a / BASE);
  const b0 = b % BASE, b1 = Math.floor(b / BASE);
  const bottom = a0 * b0;
  const cross = Math.floor(bottom / BASE) + a1 * b0 + a0 * b1;
  const low = (bottom % BASE) + (cross % BASE) * BASE;
  const high = a1 * b1 + Math.floor(cross / BASE);
  return [high, low];
}

/** Binary long division of two unsigned words by one positive int32 divisor.
 *
 * Remainder remains in [0, divisor-1] after each bit. Doubling it and adding
 * one bit is <= 2^32-1, hence exactly representable as Number. We only need
 * a quotient fitting a signed int32; high quotient bits are recorded as
 * overflow without constructing an imprecise 64-bit Number.
 */
function checkedQuotient(high, low, divisor, negative) {
  let remainder = 0;
  let magnitude = 0;
  let highBits = false;
  for (let bit = 63; bit >= 0; bit--) {
    const incoming = bit >= 32
      ? ((high >>> (bit - 32)) & 1)
      : ((low >>> bit) & 1);
    remainder = remainder * 2 + incoming;
    if (remainder >= divisor) {
      remainder -= divisor;
      if (bit >= 32) highBits = true;
      else magnitude += 2 ** bit;
    }
  }
  const bound = negative ? -INT_MIN : INT_MAX;
  if (highBits || magnitude > bound) {
    throw new RangeError('quotient must be a signed 32-bit integer');
  }
  return magnitude === 0 ? 0 : negative ? -magnitude : magnitude;
}

/** Exact truncation toward zero of (a*b)/denominator; never wraps/saturates.
 *
 * Inputs and output are signed int32; the widened product is computed via
 * four unsigned 16-bit partial products, not a BigInt or floating product.
 */
export function mulDiv(a, b, denominator) {
  a = int32(a);
  b = int32(b);
  denominator = int32(denominator);
  if (denominator === 0) throw new RangeError('division by zero');
  if (a === 0 || b === 0) return 0;
  const negative = (a < 0) !== (b < 0) !== (denominator < 0);
  const [high, low] = productWords(Math.abs(a), Math.abs(b));
  return checkedQuotient(high, low, Math.abs(denominator), negative);
}

export function fromRatio(numerator, denominator = 1) {
  return mulDiv(numerator, SCALE, denominator);
}
export function multiply(a, b) {
  return mulDiv(a, b, SCALE);
}
export function divide(a, b) {
  return mulDiv(a, SCALE, b);
}

/** Integer floor sqrt(value * 65536), with no floating square root.
 *
 * value is nonnegative signed int32, so the radicand is <2^47, and every
 * trial square below 2^48 is also exactly representable in Number.
 */
export function sqrt(value) {
  value = int32(value);
  if (value < 0) throw new RangeError('negative square root');
  const radicand = value * BASE;
  let lower = 0, upper = 16777216; // 2^24 > sqrt(INT_MAX*65536)
  while (lower < upper) {
    const midpoint = Math.floor((lower + upper + 1) / 2);
    if (midpoint * midpoint <= radicand) lower = midpoint;
    else upper = midpoint - 1;
  }
  return lower;
}

/** Rendering/presentation boundary; never re-enter authoritative state. */
export function toNumber(value) {
  return int32(value) / SCALE;
}

/** The existing documented full-period modulo-2^32 PRNG sequence. */
export function nextRandom(state) {
  state = uint32(state, 'random state');
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
