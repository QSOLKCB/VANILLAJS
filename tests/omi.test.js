import test from 'node:test';
import assert from 'node:assert/strict';
import {OMICRON, VERTICES, EDGES, FACES, packState, unpackState, xor16, delta16, tetrahedron, faceResiduals, orbit16} from '../experiments/arch-omi/index.js';
import {referenceDelta, referenceXor} from '../scripts/omi-oracle.js';

test('OMI encoding assigns the four nibbles explicitly and owns result arrays', () => {
  const input = [1,2,3,4]; assert.equal(packState(input), 0x1234); assert.deepEqual(unpackState(0xabcd), [10,11,12,13]);
  input[0] = 9; assert.deepEqual(unpackState(0x1234), [1,2,3,4]);
  const shape = tetrahedron(0x1234); assert.deepEqual(shape.edges, [3,2,5,1,6,7]);
  shape.vertices[0] = 0; shape.edges[0] = 0; shape.residuals[0] = 1;
  assert.deepEqual(tetrahedron(0x1234).residuals, [0,0,0,0]);
  assert.throws(() => { VERTICES[0] = 'other'; }); assert.throws(() => { EDGES[0][0] = 3; }); assert.throws(() => { FACES[0][0] = 0; });
});
test('OMI rejects invalid words, masks, nibbles, edge arrays and work limits without coercion', () => {
  for (const value of [-1,65536,1.5,NaN,Infinity,'12',true,null,undefined]) {
    for (const fn of [unpackState, delta16, tetrahedron, orbit16]) assert.throws(() => fn(value));
    assert.throws(() => xor16(0, value)); assert.throws(() => xor16(value, 0));
  }
  for (const values of [null,[],[0,0,0],[0,0,0,16],[0,0,0,-1],[0,0,0,'1'],Array(4)]) assert.throws(() => packState(values));
  for (const values of [[],[1,2,3,4,5],[0,0,0,0,0,16],Array(6)]) assert.throws(() => faceResiduals(values));
  for (const budget of [0,-1,1.5,65537,Infinity,NaN]) assert.throws(() => orbit16(0,budget));
});
test('all 65,536 delta outputs match an independent arithmetic bit oracle and form a permutation', () => {
  const outputs = new Set();
  for (let value = 0; value < 65536; value++) {
    const next = delta16(value); assert.equal(next, referenceDelta(value), `delta(${value})`); outputs.add(next);
    assert.equal(packState(unpackState(value)), value);
    assert.equal(xor16(value, OMICRON), referenceXor(value, OMICRON));
    assert.equal(xor16(xor16(value, OMICRON), OMICRON), value);
  }
  assert.equal(outputs.size, 65536);
});
test('all delta orbits close by eight steps but include genuinely shorter minimal periods', () => {
  const states = {1:0,2:0,4:0,8:0};
  for (let value = 0; value < 65536; value++) {
    const orbit = orbit16(value); assert.equal(orbit.status, 'closed'); assert.ok(Object.hasOwn(states, orbit.period));
    assert.equal(new Set(orbit.states).size, orbit.period); assert.equal(orbit.next, value); states[orbit.period]++;
    let eighth = value; for (let i = 0; i < 8; i++) eighth = delta16(eighth); assert.equal(eighth, value);
  }
  assert.deepEqual(states, {1:8,2:56,4:4032,8:61440});
  const short = orbit16(0x1234, 1); assert.equal(short.status, 'budget'); assert.equal(short.period, null); assert.deepEqual(short.states, [0x1234]);
});
test('all 262,144 derived faces close; each single-edge bit fault opens its two incident faces', () => {
  for (let value = 0; value < 65536; value++) assert.deepEqual(tetrahedron(value).residuals, [0,0,0,0]);
  const shape = tetrahedron(0x1234);
  for (let edge = 0; edge < 6; edge++) for (const bit of [1,2,4,8]) {
    const observed = [...shape.edges]; observed[edge] ^= bit;
    assert.deepEqual(faceResiduals(observed), FACES.map(face => face.includes(edge) ? bit : 0));
  }
});
test('common-nibble XOR preserves edge differences and closure cannot recover absolute state', () => {
  const patterns = new Map();
  for (let value = 0; value < 65536; value++) {
    const edges = tetrahedron(value).edges, key = edges.join(','); patterns.set(key, (patterns.get(key) ?? 0) + 1);
    assert.deepEqual(tetrahedron(xor16(value, 0xffff)).edges, edges);
  }
  assert.equal(patterns.size, 4096); assert.ok([...patterns.values()].every(count => count === 16));
  for (let nibble = 0; nibble < 16; nibble++) assert.deepEqual(tetrahedron(xor16(0x1234, nibble * 0x1111)).edges, tetrahedron(0x1234).edges);
  // A consistent change to every edge incident to FS also passes closure.
  const changed = tetrahedron(0x1234).edges; for (const edge of [0,1,2]) changed[edge] ^= 1;
  assert.deepEqual(faceResiduals(changed), [0,0,0,0]); assert.notDeepEqual(changed, tetrahedron(0x1234).edges);
});
