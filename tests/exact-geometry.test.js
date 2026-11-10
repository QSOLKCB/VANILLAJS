// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-003: independent Fraction oracle and adversarial predicate regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ExactRational} from '../modules/exact-rational/index.js';
import {ExactInterval} from '../modules/exact-interval/index.js';
import {ExactPoint2, ExactBox2, point2, orientation2, pointOnSegment,
  segmentRelation, boxFromCorners, boxRelation} from '../modules/exact-geometry/index.js';

const q = (n, d = 1) => new ExactRational(BigInt(n), BigInt(d));
const p = (x, y) => point2(q(x), q(y));
const seg = (a, b, c, d) => segmentRelation(p(...a), p(...b), p(...c), p(...d));
const rel = (a, b) => new ExactInterval(q(a[0]), q(a[1])).relate(
  new ExactInterval(q(b[0]), q(b[1])));

test('closed intervals classify disjoint, overlap and touching with exact endpoints', () => {
  const a = new ExactInterval(q(-2), q(1));
  const b = new ExactInterval(q(1), q(3));
  const c = new ExactInterval(q(2), q(4));
  assert.equal(a.relate(b), 'overlap');
  assert.equal(a.relate(c), 'a_below_b');
  assert.equal(c.relate(a), 'b_below_a');
  assert.equal(a.intersect(b).toString(), '[1,1]');
  assert.equal(a.intersect(c), null);
  assert.equal(new ExactInterval(q(0), q(0)).contains(q(0)), true);
  assert.equal(new ExactInterval(q(0), q(0)).contains(q(1)), false);
  assert.equal(a.contains(q(-2)), true);
  assert.equal(a.contains(q(1)), true);
  assert.equal(a.contains(q(2)), false);
  assert.equal(rel([1, 2], [2, 4]), 'overlap');
  const inner = new ExactInterval(q(1, 3), q(2, 3));
  const outer = new ExactInterval(q(0), q(1));
  assert.equal(outer.intersect(inner).toString(), '[1/3,2/3]');
  assert.ok(Object.isFrozen(a));
  assert.throws(() => new ExactInterval(q(3), q(2)), RangeError);
  assert.throws(() => new ExactInterval(null, q(2)), TypeError);
  assert.throws(() => new ExactInterval(q(2), undefined), TypeError);
  assert.throws(() => Number(a), TypeError);
});

test('orientation is exact, directed and handles very large cancellation', () => {
  assert.equal(orientation2(p(0, 0), p(2, 0), p(0, 2)), 1);
  assert.equal(orientation2(p(0, 0), p(0, 2), p(2, 0)), -1);
  assert.equal(orientation2(p(0, 0), p(2, 2), p(4, 4)), 0);
  const fractional = [
    point2(q(1, 3), q(1, 7)),
    point2(q(2, 3), q(2, 7)),
    point2(q(3, 3), q(3, 7)),
  ];
  assert.equal(orientation2(...fractional), 0);
  const max = (1n << 256n) - 1n;
  const m = new ExactRational(max);
  assert.equal(orientation2(point2(q(0), q(0)),
    point2(m, q(0)), point2(q(0), m)), 1);
  assert.equal(orientation2(point2(q(0), q(0)),
    point2(q(0), m), point2(m, q(0))), -1);
  // Exact sub-ULP difference, with representable 256-bit components.
  const almost = point2(q(1), new ExactRational(max - 1n, max));
  assert.equal(orientation2(p(0, 0), p(1, 1), almost), -1);
});

test('segments distinguish proper crossings, touching and positive-length overlap', () => {
  assert.equal(seg([0,0], [4,4], [0,4], [4,0]), 'cross');
  assert.equal(seg([0,0], [4,0], [2,0], [2,2]), 'touch');
  assert.equal(seg([0,0], [4,0], [4,0], [7,0]), 'touch');
  assert.equal(seg([0,0], [4,0], [2,0], [7,0]), 'overlap');
  assert.equal(seg([1,1], [1,5], [1,4], [1,2]), 'overlap');
  assert.equal(seg([0,0], [1,1], [2,2], [3,3]), 'disjoint');
  assert.equal(seg([0,0], [2,0], [0,1], [2,1]), 'disjoint');
  assert.equal(seg([0,0], [0,0], [0,0], [0,0]), 'touch');
  assert.equal(seg([0,0], [0,0], [1,1], [1,1]), 'disjoint');
  assert.equal(seg([1,1], [1,1], [0,0], [2,2]), 'touch');
  assert.equal(seg([2,3], [2,3], [0,0], [2,2]), 'disjoint');
  assert.equal(pointOnSegment(p(0,0), p(0,0), p(0,0)), true);
  assert.equal(pointOnSegment(p(1,0), p(0,0), p(0,0)), false);
  assert.equal(pointOnSegment(p(3,3), p(0,0), p(2,2)), false);
});

test('closed axis-aligned boxes distinguish area overlap, edge contact, degeneracy', () => {
  const base = boxFromCorners(p(0, 0), p(4, 4));
  const inside = boxFromCorners(p(1, 1), p(2, 2));
  const edge = boxFromCorners(p(4, 1), p(6, 3));
  const corner = boxFromCorners(p(4, 4), p(5, 5));
  const disjoint = boxFromCorners(p(5, 0), p(6, 2));
  const point = boxFromCorners(p(2, 2), p(2, 2));
  assert.equal(boxRelation(base, inside), 'overlap');
  assert.equal(boxRelation(base, edge), 'touch');
  assert.equal(boxRelation(base, corner), 'touch');
  assert.equal(boxRelation(base, disjoint), 'disjoint');
  assert.equal(boxRelation(base, point), 'touch');
  assert.equal(boxRelation(point, point), 'touch');
  assert.equal(base.contains(p(4, 4)), true);
  assert.equal(base.contains(p(4, 5)), false);
  assert.equal(edge.contains(p(4, 2)), true);
  assert.equal(boxFromCorners(p(5, 5), p(1, 1)).contains(p(2, 2)), true);
  assert.ok(Object.isFrozen(base));
  assert.ok(Object.isFrozen(p(1, 1)));
});

test('forged prototypes, proxies and shadow getters never bypass private brands', () => {
  const forgedRational = Object.create(ExactRational.prototype, {
    numerator: {value: 1n}, denominator: {value: -3n},
  });
  assert.throws(() => new ExactInterval(forgedRational, q(1)), TypeError);
  assert.throws(() => point2(forgedRational, q(0)), TypeError);
  assert.throws(() => new ExactInterval(q(0), forgedRational), TypeError);
  assert.throws(() => new ExactInterval(q(0), new Proxy(q(1), {})), TypeError);

  const valid = new ExactInterval(q(0), q(1));
  const forgedInterval = Object.create(ExactInterval.prototype, {
    lower: {value: q(0)}, upper: {value: q(1)},
  });
  assert.throws(() => valid.relate(forgedInterval), TypeError);
  assert.throws(() => valid.intersect(forgedInterval), TypeError);
  assert.throws(() => new ExactBox2(forgedInterval, valid), TypeError);
  assert.throws(() => new ExactBox2(new Proxy(valid, {}), valid), TypeError);

  let getterReads = 0;
  const forgedPoint = Object.create(ExactPoint2.prototype, {
    x: {get() { getterReads++; return q(1); }},
    y: {get() { getterReads++; return q(2); }},
  });
  assert.throws(() => orientation2(forgedPoint, p(0,0), p(1,1)), TypeError);
  assert.throws(() => pointOnSegment(forgedPoint, p(0,0), p(2,2)), TypeError);
  assert.equal(getterReads, 0);
  assert.throws(() => orientation2(new Proxy(p(1,1), {}), p(0,0), p(1,0)), TypeError);

  const box = boxFromCorners(p(0,0), p(1,1));
  assert.throws(() => boxRelation(Object.create(ExactBox2.prototype), box), TypeError);
  assert.throws(() => boxRelation(new Proxy(box, {}), box), TypeError);
  assert.throws(() => new ExactPoint2(q(0), null), TypeError);
  assert.throws(() => { class Child extends ExactPoint2 {} new Child(q(0), q(0)); }, TypeError);
  assert.throws(() => { class Child extends ExactBox2 {} new Child(valid, valid); }, TypeError);
  assert.throws(() => { class Child extends ExactInterval {} new Child(q(0), q(0)); }, TypeError);
});

test('deterministic integer-domain metamorphic orientation and segment symmetries', () => {
  let state = 0x6f351bc9;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  const rawPoint = () => [next() % 501 - 250, next() % 501 - 250];
  for (let i = 0; i < 4000; i++) {
    const ar = rawPoint(), br = rawPoint(), cr = rawPoint(), dr = rawPoint();
    const [a, b, c, d] = [ar, br, cr, dr].map(v => p(...v));
    const lhs = BigInt(br[0] - ar[0]) * BigInt(cr[1] - ar[1]);
    const rhs = BigInt(br[1] - ar[1]) * BigInt(cr[0] - ar[0]);
    const sign = lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
    assert.equal(orientation2(a, b, c), sign);
    assert.equal(orientation2(a, c, b), -sign);
    assert.equal(orientation2(b, c, a), sign);
    const forward = segmentRelation(a, b, c, d);
    assert.equal(segmentRelation(b, a, c, d), forward);
    assert.equal(segmentRelation(c, d, a, b), forward);
    assert.equal(segmentRelation(d, c, b, a), forward);
    const left = boxFromCorners(a, b), right = boxFromCorners(c, d);
    assert.equal(boxRelation(left, right), boxRelation(right, left));
  }
});

const FIXED = [
  [0,0,4,4,0,4,4,0], [0,0,2,2,2,2,3,0], [0,0,4,0,2,0,6,0],
  [1,1,1,5,1,4,1,2], [0,0,1,1,2,2,3,3], [0,0,2,0,0,1,2,1],
  [0,0,0,0,0,0,0,0], [0,0,0,0,1,1,1,1], [1,1,1,1,0,0,2,2],
  [2,3,2,3,0,0,2,2], [0,0,4,0,2,0,2,2], [0,0,2,2,0,2,2,0],
  [0,0,2,0,2,0,4,0], [0,0,2,2,2,0,4,2], [0,0,3,3,1,1,2,2],
  [0,0,2,0,2,0,2,0], [0,0,2,2,1,0,3,2], [0,0,1,1,2,2,4,4],
];
function* oracleCases() {
  for (const row of FIXED) {
    yield [p(row[0],row[1]), p(row[2],row[3]),
      p(row[4],row[5]), p(row[6],row[7])];
  }
  let state = 0x3177653d;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  function randomPoint() {
    return point2(q(next() % 81 - 40, next() % 13 + 1),
      q(next() % 81 - 40, next() % 13 + 1));
  }
  function shift(point, dx, dy) {
    return point2(point.x.add(q(dx)), point.y.add(q(dy)));
  }
  for (let i = 0; i < 2048; i++) {
    let a = randomPoint(), b = randomPoint(), c = randomPoint(), d = randomPoint();
    switch (i % 10) {
      case 0: b = a; break;
      case 1: d = c; break;
      case 2: c = b; break;
      case 3:
        b = shift(a, 1, 1); c = shift(a, 2, 2); d = shift(a, 3, 3); break;
      case 4:
        b = shift(a, 3, 3); c = shift(a, 1, 1); d = shift(a, 4, 4); break;
      case 5:
        b = shift(a, 2, 2); c = shift(a, 0, 2); d = shift(a, 2, 0); break;
      case 6:
        b = shift(a, 0, 2); c = shift(a, 0, 2); d = shift(a, 0, 3); break;
      case 7: b = a; d = c; break;
      case 8:
        b = shift(a, 4, 0); c = shift(a, 2, -1); d = shift(a, 2, 1); break;
    }
    yield [a, b, c, d];
  }
}
const sortedInterval = (a,b) => new ExactInterval(
  a.compare(b) <= 0 ? a : b, a.compare(b) <= 0 ? b : a);

test('2,066 independent CPython Fraction interval/geometry oracle rows', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('fixtures/alien-math-003-oracle.json', import.meta.url), 'utf8'));
  assert.equal(fixture.schema, 'qsol.alien-math-003.fraction-oracle.v1');
  assert.match(fixture.oracle, /CPython fractions\.Fraction/);
  assert.equal(fixture.seed, '0x3177653d');
  assert.equal(fixture.fixed_cases, FIXED.length);
  assert.equal(fixture.generated_cases, 2048);
  const digest = createHash('sha256');
  const segments = {}, boxes = {}, intervals = {};
  let observations = 0;
  for (const [a, b, c, d] of oracleCases()) {
    const x1 = sortedInterval(a.x, b.x);
    const x2 = sortedInterval(c.x, d.x);
    const relation = x1.relate(x2);
    const intersection = x1.intersect(x2);
    const orientation = orientation2(a, b, c);
    const on = pointOnSegment(c, a, b);
    const segment = segmentRelation(a, b, c, d);
    const box = boxRelation(boxFromCorners(a, b), boxFromCorners(c, d));
    const row = [
      String(observations), a.x.toString(), a.y.toString(), b.x.toString(), b.y.toString(),
      c.x.toString(), c.y.toString(), d.x.toString(), d.y.toString(), relation,
      intersection === null ? 'null' : intersection.toString(),
      String(orientation), on ? '1' : '0', segment, box
    ];
    digest.update(row.join('|') + '\n', 'ascii');
    for (const [map, key] of [[segments, segment], [boxes, box], [intervals, relation]]) {
      map[key] = (map[key] || 0) + 1;
    }
    observations++;
  }
  assert.equal(observations, fixture.observations);
  assert.deepEqual(segments, fixture.segment_counts);
  assert.deepEqual(boxes, fixture.box_counts);
  assert.deepEqual(intervals, fixture.interval_counts);
  assert.equal(digest.digest('hex'), fixture.sha256, 'independent Fraction oracle mismatch');
});

test('new module dependency boundary is authoring-only', async () => {
  const interval = await readFile(new URL('../modules/exact-interval/index.js', import.meta.url), 'utf8');
  const geometry = await readFile(new URL('../modules/exact-geometry/index.js', import.meta.url), 'utf8');
  assert.match(interval, /from '\.\.\/exact-rational\/index\.js'/);
  assert.match(geometry, /from '\.\.\/exact-rational\/index\.js'/);
  assert.match(geometry, /from '\.\.\/exact-interval\/index\.js'/);
  for (const file of [interval, geometry]) {
    assert.doesNotMatch(file, /from '\.\.\/(?:integer-math|qfloat|rational-q16)\//);
    assert.doesNotMatch(file, /\b(?:Math\.random|Date\.now|document|window|requestAnimationFrame)\b/);
  }
});
