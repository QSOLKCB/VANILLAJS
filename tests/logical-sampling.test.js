// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {logicalIndex, partitionWork, U64_MAX} from '../modules/logical-sampling/index.js';

test('full-u64 uniform population mapping is exact and strictly increasing', () => {
  let previous = -1n;
  for (let i = 0; i < 4096; i++) {
    const got = logicalIndex(U64_MAX, 4096, i);
    assert.equal(got, BigInt(i) * U64_MAX / 4096n);
    assert.ok(got > previous && got < U64_MAX);
    previous = got;
  }
  assert.equal(logicalIndex('18446744073709551615', 4096, 0), 0n);
  assert.equal(logicalIndex(2 ** 32, 4, 1), 1073741824n);
});
test('phi-weyl-64 stays in range and cannot be mistaken for uniform floor', () => {
  const n = 65536n;
  const indexes = [];
  for (let i = 0; i < 96; i++) {
    const v = logicalIndex(n, 96, i, 'phi-weyl-64');
    assert.ok(v >= 0n && v < n);
    indexes.push(v);
  }
  assert.equal(new Set(indexes.map(String)).size, 96);
  assert.notDeepEqual(indexes, indexes.map((_, i) => logicalIndex(n, 96, i)));
  assert.throws(() => logicalIndex(n, 96, 1, 'invalid'), RangeError);
});
test('contiguous deterministic partitions preserve coverage and balance', () => {
  for (const n of [1, 2, 3, 1024, 1000000]) for (const w of [1, 2, 3, 7, 32, 256]) {
    const ranges = partitionWork(n, w);
    assert.equal(ranges.length, Math.min(n, w));
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges.at(-1).end, n);
    assert.equal(ranges.reduce((total, r) => total + r.length, 0), n);
    for (let i = 1; i < ranges.length; i++) {
      assert.equal(ranges[i].start, ranges[i-1].end);
      assert.ok(Math.abs(ranges[i].length - ranges[i-1].length) <= 1);
    }
  }
});
test('invalid/rounded logical counts and unbounded resident requests fail closed', () => {
  for (const bad of [NaN, 1.5, '1.0', 0, 0n, -1n, U64_MAX+1n,
                     Number.MAX_SAFE_INTEGER+1, {}, null]) {
    assert.throws(() => logicalIndex(bad, 1, 0));
  }
  assert.throws(() => logicalIndex(3n, 4, 0));
  assert.throws(() => logicalIndex(4n, 4, -1));
  assert.throws(() => logicalIndex(4n, 4, 4));
  assert.throws(() => partitionWork(1000001, 1));
  assert.throws(() => partitionWork(10, 257));
});
