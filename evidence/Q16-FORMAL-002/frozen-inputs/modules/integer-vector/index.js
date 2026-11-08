// SPDX-License-Identifier: Apache-2.0
// Independently expressed right-handed integer vector operations (Q16.16).
// Exact raw multi-axis expressions retain BigInt because their public output
// domain can exceed 64 bits; scalar quotients use the new checked limb kernel.
import {int32, vector3, mulDiv, SCALE} from '../integer-math/index.js';

const UNIT = BigInt(SCALE);

function axes(a, b) {
  return [vector3(a, 'a'), vector3(b, 'b')];
}

function narrow(raw, label) {
  return int32(Number(raw), label);
}

function scaled(raw, label) {
  return narrow(raw / UNIT, label); // One truncation after the complete sum.
}

/** Each return value is a newly allocated, validated ordinary array. */
export function add3(a, b) {
  const [left, right] = axes(a, b);
  return left.map((value, i) => int32(value + right[i], 'sum[' + i + ']'));
}

export function subtract3(a, b) {
  const [left, right] = axes(a, b);
  return left.map((value, i) => int32(value - right[i], 'difference[' + i + ']'));
}

/** Raw Q32.32 signed sum; BigInt is required by the public return contract. */
export function dotRaw3(a, b) {
  const [u, v] = axes(a, b);
  let result = 0n;
  for (let i = 0; i < 3; i++) result += BigInt(u[i]) * BigInt(v[i]);
  return result;
}

export function dot3(a, b) {
  return scaled(dotRaw3(a, b), 'dot product');
}

/** Right-handed determinant, returned as three exact Q32.32 BigInts. */
export function crossRaw3(a, b) {
  const [u, v] = axes(a, b);
  const products = (i, j, k, l) =>
    BigInt(u[i]) * BigInt(v[j]) - BigInt(u[k]) * BigInt(v[l]);
  return [products(1, 2, 2, 1),
          products(2, 0, 0, 2),
          products(0, 1, 1, 0)];
}

export function cross3(a, b) {
  return crossRaw3(a, b).map((v, i) => scaled(v, 'cross[' + i + ']'));
}

export function lengthSquaredRaw3(a) {
  const u = vector3(a, 'a');
  return u.reduce((total, v) => total + BigInt(v) ** 2n, 0n);
}

export function distanceSquaredRaw3(a, b) {
  const [u, v] = axes(a, b);
  let total = 0n;
  for (let i = 0; i < 3; i++) {
    // Differences of two signed int32 values can require 33 bits.
    const delta = BigInt(u[i]) - BigInt(v[i]);
    total += delta * delta;
  }
  return total;
}

/** Checked rational scaling with scalar exact 16-bit-limb division. */
export function scaleRatio3(value, numerator, denominator) {
  const u = vector3(value);
  numerator = int32(numerator, 'numerator');
  denominator = int32(denominator, 'denominator');
  if (denominator === 0) throw new RangeError('division by zero');
  return u.map((x, i) => int32(mulDiv(x, numerator, denominator),
                              'scaled[' + i + ']'));
}

/** Interpolate using an exact Number product: |b-a| <2^32 and t <=2^16.
 *
 * Every widened product is below 2^48, still exact in JS Number. Division
 * by the power-of-two SCALE is exact before truncation toward zero. The
 * endpoint delta may exceed int32 and must be narrowed only at the end.
 */
export function lerp3(a, b, fraction) {
  const [u, v] = axes(a, b);
  const t = int32(fraction, 'fraction');
  if (t < 0 || t > SCALE) {
    throw new RangeError('fraction must be within [0, SCALE]');
  }
  return u.map((x, i) => {
    const delta = v[i] - x;
    return int32(x + Math.trunc(delta * t / SCALE), 'lerp[' + i + ']');
  });
}
