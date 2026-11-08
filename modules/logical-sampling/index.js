// SPDX-License-Identifier: Apache-2.0
// Optional resident sampling over an exact logical u64 population.
// Q16.16 authoritative state and integer simulation remain independent.
export const U64_MAX = (1n << 64n) - 1n;
const PHI64 = 0x9e3779b97f4a7c15n;
const MAX_RESIDENT = 1000000;

function population(input) {
  let n;
  if (typeof input === 'bigint') n = input;
  else if (typeof input === 'number' && Number.isSafeInteger(input)) n = BigInt(input);
  else if (typeof input === 'string' && /^[1-9][0-9]*$/.test(input)) n = BigInt(input);
  else throw new TypeError('logical population must be exact');
  if (n <= 0n || n > U64_MAX) throw new RangeError('logical population outside positive u64');
  return n;
}
function positive(input, maximum, name) {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) ||
      input < 1 || input > maximum) throw new RangeError(name + ' outside supported range');
  return input;
}

/**
 * Project resident i into a potentially enormous logical population.
 * uniform-floor is strictly increasing when 1 <= R <= L.
 * phi-weyl-64 is a separate, explicitly nonmonotone sampling policy.
 */
export function logicalIndex(logicalCount, renderedCount, index, policy = 'uniform-floor') {
  const logical = population(logicalCount);
  const count = positive(renderedCount, MAX_RESIDENT, 'renderedCount');
  if (BigInt(count) > logical) throw new RangeError('renderedCount exceeds logicalCount');
  if (typeof index !== 'number' || !Number.isSafeInteger(index) ||
      index < 0 || index >= count) throw new RangeError('invalid rendered index');
  const i = BigInt(index);
  if (policy === 'uniform-floor') return i * logical / BigInt(count);
  if (policy === 'phi-weyl-64') return (((i * PHI64) & U64_MAX) * logical) >> 64n;
  throw new RangeError('unknown sampling policy');
}

/** Stable contiguous half-open work partitions; O(requestedWorkers) memory. */
export function partitionWork(itemCount, requestedWorkers) {
  const n = positive(itemCount, MAX_RESIDENT, 'itemCount');
  const requested = positive(requestedWorkers, 256, 'requestedWorkers');
  const workers = Math.min(n, requested);
  const size = Math.floor(n / workers), remainder = n % workers;
  let cursor = 0;
  const ranges = [];
  for (let worker = 0; worker < workers; worker++) {
    const length = size + (worker < remainder ? 1 : 0);
    ranges.push(Object.freeze({worker, start: cursor, end: cursor + length, length}));
    cursor += length;
  }
  return Object.freeze(ranges);
}
