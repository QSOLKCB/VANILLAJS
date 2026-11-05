// SPDX-License-Identifier: Apache-2.0
// Signed int32 storage, 65536 subunits per metre. BigInt intermediates never wrap.
export const SCALE = 65536;
export const INT_MIN = -2147483648;
export const INT_MAX = 2147483647;

export function int32(value, name = 'value') {
  if (!Number.isInteger(value) || value < INT_MIN || value > INT_MAX) {
    throw new RangeError(`${name} must be a signed 32-bit integer`);
  }
  return value === 0 ? 0 : value; // Canonicalise negative zero.
}
export function uint32(value, name = 'value') {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
    throw new RangeError(`${name} must be an unsigned 32-bit integer`);
  }
  return value === 0 ? 0 : value;
}
export function vector3(value, name = 'vector') {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${name} must be an array of three integers`);
  return [0, 1, 2].map(i => int32(value[i], `${name}[${i}]`));
}
export const add = (a, b) => int32(int32(a) + int32(b), 'sum');
export const subtract = (a, b) => int32(int32(a) - int32(b), 'difference');

/** Exact product and division, rounded toward zero; reject result overflow. */
export function mulDiv(a, b, divisor) {
  int32(a); int32(b); int32(divisor);
  if (divisor === 0) throw new RangeError('division by zero');
  return int32(Number(BigInt(a) * BigInt(b) / BigInt(divisor)), 'quotient');
}
export const fromRatio = (numerator, denominator = 1) => mulDiv(numerator, SCALE, denominator);
export const multiply = (a, b) => mulDiv(a, b, SCALE);
export const divide = (a, b) => mulDiv(a, SCALE, b);

/** floor(sqrt(value / SCALE) * SCALE), with no floating square root. */
export function sqrt(value) {
  int32(value);
  if (value < 0) throw new RangeError('negative square root');
  const n = BigInt(value) * BigInt(SCALE);
  if (n < 2n) return Number(n);
  let x = n, next = (x + 1n) / 2n;
  while (next < x) { x = next; next = (x + n / x) / 2n; }
  return Number(x);
}

/** The sole explicit fixed-point-to-metres presentation boundary. */
export const toNumber = value => int32(value) / SCALE;

/** Full-period uint32 LCG. State 0 is valid. Returns the next state/output. */
export function nextRandom(state) {
  uint32(state, 'random state');
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
