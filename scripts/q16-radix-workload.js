// SPDX-License-Identifier: Apache-2.0
// Paired deterministic microbench, using the merged PR #46 kernel as the
// explicitly frozen before-state. No GPU or whole-engine performance claims.
import {performance} from 'node:perf_hooks';
import {mulDiv, sqrt, int32, INT_MIN, INT_MAX} from '../modules/integer-math/index.js';

const BASE = 65536;
function oldProductWords(a, b) {
  const a0 = a % BASE, a1 = Math.floor(a / BASE);
  const b0 = b % BASE, b1 = Math.floor(b / BASE);
  const bottom = a0 * b0;
  const cross = Math.floor(bottom / BASE) + a1 * b0 + a0 * b1;
  return [a1 * b1 + Math.floor(cross / BASE),
    (bottom % BASE) + (cross % BASE) * BASE];
}
function previousMulDiv(a, b, divisor) {
  a = int32(a); b = int32(b); divisor = int32(divisor);
  if (!divisor) throw new RangeError('division by zero');
  if (!a || !b) return 0;
  const negative = (a < 0) !== (b < 0) !== (divisor < 0);
  const [high, low] = oldProductWords(Math.abs(a), Math.abs(b));
  const d = Math.abs(divisor);
  let remainder = 0, magnitude = 0, highBits = false;
  for (let bit = 63; bit >= 0; bit--) {
    const incoming = bit >= 32
      ? ((high >>> (bit - 32)) & 1) : ((low >>> bit) & 1);
    remainder = remainder * 2 + incoming;
    if (remainder >= d) {
      remainder -= d;
      if (bit >= 32) highBits = true;
      else magnitude += 2 ** bit;
    }
  }
  if (highBits || magnitude > (negative ? -INT_MIN : INT_MAX)) {
    throw new RangeError('quotient must be a signed 32-bit integer');
  }
  return magnitude === 0 ? 0 : negative ? -magnitude : magnitude;
}
function previousSqrt(value) {
  value = int32(value);
  if (value < 0) throw new RangeError('negative square root');
  const radicand = value * BASE;
  let lower = 0, upper = 16777216;
  while (lower < upper) {
    const midpoint = Math.floor((lower + upper + 1) / 2);
    if (midpoint * midpoint <= radicand) lower = midpoint;
    else upper = midpoint - 1;
  }
  return lower;
}

const n = Number(process.argv[2] ?? 80000);
if (!Number.isSafeInteger(n) || n < 1000 || n > 1000000) {
  throw new RangeError('iterations must be between 1000 and 1000000');
}
let state = 0x0a31ce97;
function next() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state | 0; }
const small = [], wide = [], roots = [];
for (let i = 0; i < n; i++) {
  small.push([next() % 10000000, next() % 10000000, 65536]);
  const x = 850000000 + (next() >>> 0) % 150000000;
  const y = 850000000 + (next() >>> 0) % 150000000;
  wide.push([i & 1 ? -x : x, i & 2 ? -y : y, 1000000001]);
  roots.push(next() & INT_MAX);
}
function run(fn, data, single) {
  let sum = 0;
  const started = performance.now();
  for (const values of data) {
    const value = single ? fn(values) : fn(values[0], values[1], values[2]);
    sum = (sum + value) | 0;
  }
  return {ms: performance.now() - started, checksum: sum};
}
function median(values) {
  return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}
const workloads = [
  ['q16-safe-product', small, previousMulDiv, mulDiv, false],
  ['q16-wide-product', wide, previousMulDiv, mulDiv, false],
  ['q16-sqrt', roots, previousSqrt, sqrt, true]
];
const results = [];
for (const [name, data, previous, candidate, single] of workloads) {
  for (let i = 0; i < 2; i++) { run(previous, data, single); run(candidate, data, single); }
  const oldTimes = [], newTimes = [];
  for (let i = 0; i < 5; i++) {
    const order = i % 2 ? [candidate, previous] : [previous, candidate];
    const actual = order.map(fn => run(fn, data, single));
    if (actual[0].checksum !== actual[1].checksum) throw new Error(name + ' checksum drift');
    if (i % 2) { newTimes.push(actual[0].ms); oldTimes.push(actual[1].ms); }
    else { oldTimes.push(actual[0].ms); newTimes.push(actual[1].ms); }
  }
  const oldMs = median(oldTimes), newMs = median(newTimes);
  results.push({name, count: n, baseline_ms: oldMs, candidate_ms: newMs,
    speedup: oldMs / newMs});
}
console.log(JSON.stringify({
  schema: 'qsol.q16-radix-bench.v1',
  baseline_commit: '199ee112d5f54c640cdd06dec352c4b1c9f6ee7e',
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  repeats: 5,
  results
}, null, 2));
