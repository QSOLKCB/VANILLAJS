// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-002: explicit, bounded exact-rational to checked Q16.16 boundary.
// Authoring-time quantization only: not a replacement for integer-math or QFLOAT.
import {ExactRational} from '../exact-rational/index.js';
import {SCALE, INT_MIN, INT_MAX, int32} from '../integer-math/index.js';

const SCALE_BIG = BigInt(SCALE);
const MIN_BIG = BigInt(INT_MIN);
const MAX_BIG = BigInt(INT_MAX);
const MODES = new Set(['exact', 'toward-zero', 'floor', 'ceil', 'nearest-even', 'nearest-away']);
const OVERFLOWS = new Set(['reject', 'saturate']);

/** Both rounding and overflow are mandatory, immutable-snapshot policy inputs. */
function policies(options) {
  if (options === null || typeof options !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(options)) ||
      Reflect.ownKeys(options).length !== 2) {
    throw new TypeError('explicit rounding and overflow policies required');
  }
  const desc = Object.getOwnPropertyDescriptors(options);
  if (!Object.hasOwn(desc, 'rounding') || !Object.hasOwn(desc, 'overflow') ||
      !Object.hasOwn(desc.rounding, 'value') || !Object.hasOwn(desc.overflow, 'value')) {
    throw new TypeError('rounding and overflow must be own data properties');
  }
  const rounding = desc.rounding.value;
  const overflow = desc.overflow.value;
  if (!MODES.has(rounding) || !OVERFLOWS.has(overflow) ||
      (rounding === 'exact' && overflow !== 'reject')) {
    throw new TypeError('unsupported or incompatible Q16.16 policies');
  }
  return {rounding, overflow};
}

/**
 * Deliberately quantize an ExactRational to a signed-int32 Q16.16 raw integer.
 * No floating arithmetic or implicit policy; rounding and saturation are explicit.
 * `exact` requires an integer scaled value and `overflow: 'reject'`.
 * Saturation applies only to the final rounded integer, never the input rational.
 */
export function quantizeQ16(value, options) {
  const {rounding, overflow} = policies(options);
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== ExactRational.prototype) {
    throw new TypeError('ExactRational required');
  }
  const scaled = value.numerator * SCALE_BIG;
  const denominator = value.denominator; // Canonical > 0 in ALIEN-MATH-001.
  let rounded = scaled / denominator; // BigInt truncates toward zero.
  const remainder = scaled % denominator;
  if (remainder !== 0n) {
    const sign = scaled < 0n ? -1n : 1n;
    if (rounding === 'exact') {
      throw new RangeError('rational is not exactly representable as Q16.16');
    }
    if (rounding === 'floor' && sign < 0n) rounded -= 1n;
    else if (rounding === 'ceil' && sign > 0n) rounded += 1n;
    else if (rounding === 'nearest-even' || rounding === 'nearest-away') {
      const twice = (remainder < 0n ? -remainder : remainder) * 2n;
      if (twice > denominator || (twice === denominator &&
          (rounding === 'nearest-away' || (rounded % 2n !== 0n)))) {
        rounded += sign;
      }
    }
  }
  if (rounded < MIN_BIG) {
    if (overflow === 'reject') throw new RangeError('Q16.16 signed-int32 overflow');
    return INT_MIN;
  }
  if (rounded > MAX_BIG) {
    if (overflow === 'reject') throw new RangeError('Q16.16 signed-int32 overflow');
    return INT_MAX;
  }
  return int32(Number(rounded), 'Q16.16 raw value');
}

/** Reverse conversion is exact for every signed-int32 raw Q16.16 value. */
export function rationalFromQ16(raw) {
  return new ExactRational(BigInt(int32(raw, 'Q16.16 raw value')), SCALE_BIG);
}
