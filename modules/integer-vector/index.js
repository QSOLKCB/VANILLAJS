// SPDX-License-Identifier: Apache-2.0
// Right-handed world: +Y up, -Z forward. Coordinates use int32 16.16 units.
// BigInt is used for exact intermediate products; no intermediate float rounding.
import {int32, vector3, SCALE} from '../integer-math/index.js';

const Q = BigInt(SCALE);
const pair = (a, b) => [vector3(a, 'a'), vector3(b, 'b')];
const narrowed = (raw, label) => int32(Number(raw), label);
const scaled = (raw, label) => narrowed(raw / Q, label); // Round once toward zero.

/** Component-wise checked signed int32 addition; does not mutate arguments. */
export function add3(a, b) {
  [a, b] = pair(a, b);
  return a.map((x, i) => int32(x + b[i], 'sum[' + i + ']'));
}

/** Component-wise checked signed int32 subtraction. */
export function subtract3(a, b) {
  [a, b] = pair(a, b);
  return a.map((x, i) => int32(x - b[i], 'difference[' + i + ']'));
}

/** Exact dot product in Q32.32 raw units. Returns BigInt (not JSON-safe). */
export function dotRaw3(a, b) {
  [a, b] = pair(a, b);
  return a.reduce((sum, x, i) => sum + BigInt(x) * BigInt(b[i]), 0n);
}

/** Q16.16 dot product, truncating exact widened sum once toward zero. */
export const dot3 = (a, b) => scaled(dotRaw3(a, b), 'dot product');

/** Exact cross-product components in Q32.32 raw units (BigInt). */
export function crossRaw3(a, b) {
  [a, b] = pair(a, b);
  const [x, y, z] = a.map(BigInt), [X, Y, Z] = b.map(BigInt);
  return [y * Z - z * Y, z * X - x * Z, x * Y - y * X];
}

/** Q16.16 right-handed cross product, checked after truncating each axis. */
export const cross3 = (a, b) =>
  crossRaw3(a, b).map((x, i) => scaled(x, 'cross[' + i + ']'));

/** Exact sum of squared vector components in Q32.32 units (BigInt). */
export const lengthSquaredRaw3 = a => dotRaw3(a, a);

/** Exact sum of squared differences in Q32.32 units (BigInt). */
export function distanceSquaredRaw3(a, b) {
  [a, b] = pair(a, b);
  return a.reduce((sum, x, i) => {
    const delta = BigInt(x) - BigInt(b[i]);
    return sum + delta * delta;
  }, 0n);
}

/** Scale each component by an exact rational; truncate toward zero. */
export function scaleRatio3(value, numerator, denominator) {
  const a = vector3(value);
  numerator = int32(numerator, 'numerator');
  denominator = int32(denominator, 'denominator');
  if (denominator === 0) throw new RangeError('division by zero');
  return a.map((x, i) =>
    narrowed(BigInt(x) * BigInt(numerator) / BigInt(denominator), 'scaled[' + i + ']'));
}

/** Fixed-point lerp at fraction t in [0, SCALE], with widened endpoint delta. */
export function lerp3(a, b, t) {
  [a, b] = pair(a, b);
  t = int32(t, 'fraction');
  if (t < 0 || t > SCALE) throw new RangeError('fraction must be within [0, SCALE]');
  const T = BigInt(t);
  return a.map((x, i) =>
    narrowed(BigInt(x) + (BigInt(b[i]) - BigInt(x)) * T / Q, 'lerp[' + i + ']'));
}
