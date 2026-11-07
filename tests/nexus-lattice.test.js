// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cuboctahedron,NexusLattice} from '../modules/nexus-lattice/index.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixtures=[
  [6,0x4e455853,16,'c1174baf24ef5c902509323c5c81624e7ca81994d834a43a026d7f7e8de19d5e'],
  [2,0,1,'682357fcb1b4b57d387b0035708745b92325a1e70c36b4e72d16cf52fcf3557a'],
  [8,17,25,'401808c973f4d3635b425de7f32c1a0798f1191b4ba14544a3d9acdc1a3c229a'],
  [32,29,100,'3699de94ac9098282b6ab90512ed80932296a147c2f67a02041d08f000f82d8d']
];

test('coordinate-generated graph has 12 vertices, 24 edges, 8 faces, 4 perfect matchings',()=>{
  const g=cuboctahedron();
  assert.equal(g.vertices.length,12);
  assert.equal(g.edges.length,24);
  assert.equal(g.triangles.length,8);
  assert.equal(g.colours.length,24);
  assert.equal(g.controlFace.length,24);
  for(let v=0;v<12;v++)assert.equal(g.edges.filter(e=>e.includes(v)).length,4);
  for(let colour=0;colour<4;colour++){
    const set=new Set();
    for(const [i,edge] of g.edges.entries())if(g.colours[i]===colour)
      for(const v of edge){assert.ok(!set.has(v));set.add(v);}
    assert.equal(set.size,12);
  }
  for(const [i,[a,b]] of g.edges.entries()){
    const tri=g.triangles[g.controlFace[i]];
    assert.ok(tri.includes(a)&&tri.includes(b));
  }
  g.vertices[0][0]=999;g.colours[0]=99;
  assert.notDeepEqual(g,cuboctahedron(),'published topology is owned, not shared');
});

test('four independently specified exact NEXUS lattice byte-state vectors',()=>{
  // Digests were independently computed from docs/LATTICE.md's integer plan,
  // not from a self-issued checksum of this implementation.
  for(const [cells,seed,rounds,expected] of fixtures){
    const lattice=new NexusLattice({cells,seed});
    const initial=lattice.registers();
    lattice.forward(rounds);
    assert.equal(lattice.round,rounds);
    assert.equal(sha(lattice.registers()),expected);
    assert.ok(lattice.mismatchesFromSeed()>0);
    lattice.rewind(rounds);
    assert.equal(lattice.round,0);
    assert.deepEqual(lattice.registers(),initial);
    assert.equal(lattice.mismatchesFromSeed(),0);
  }
});

test('partial checkpoints resume identically and invert without loss',()=>{
  for(const seed of [0,1,17,29,0xffffffff]){
    const canonical=new NexusLattice({cells:18,seed}),checkpoint=new NexusLattice({cells:18,seed});
    canonical.forward(64);checkpoint.forward(21);
    const raw=checkpoint.snapshot(),restored=NexusLattice.fromSnapshot(raw);
    raw.registers.fill(3);
    restored.forward(43);
    assert.deepEqual(restored.snapshot(),canonical.snapshot());
    restored.rewind(64);
    assert.deepEqual(restored.registers(),new NexusLattice({cells:18,seed}).registers());
  }
});

test('bounded state and malformed checkpoint validation reject without mutation',()=>{
  for(const bad of [{cells:1},{cells:3},{cells:257},{cells:2,seed:-1},
    {cells:2,seed:2**32},{cells:2.5},{cells:2,seed:1.5}])
    assert.throws(()=>new NexusLattice(bad));
  const lattice=new NexusLattice({cells:6,seed:9});
  const original=lattice.snapshot();
  for(const bad of [
    {...original,schema:'broken'}, {...original,round:1025},
    {...original,registers:[...original.registers,0]},
    {...original,registers:original.registers.map((x,i)=>i===3?4:x)},
    {...original,extra:0},
    {...original,cells:undefined},
    {...original,seed:undefined},
    {...original,registers:Array(72)}
  ])assert.throws(()=>NexusLattice.fromSnapshot(bad));
  assert.throws(()=>lattice.rewind(1));
  assert.throws(()=>lattice.forward(1025));
  assert.deepEqual(lattice.snapshot(),original);
  lattice.forward(3);
  assert.throws(()=>lattice.rewind(4));
  assert.equal(lattice.round,3);
});

test('undefined seed cannot silently replan a restored checkpoint',()=>{
  const original=new NexusLattice({cells:6,seed:17}).forward(10).snapshot();
  assert.throws(()=>NexusLattice.fromSnapshot({...original,seed:undefined}),RangeError);
  assert.throws(()=>NexusLattice.fromSnapshot({...original,cells:undefined}),RangeError);
  const restored=NexusLattice.fromSnapshot(original);
  restored.forward(1);
  const reference=new NexusLattice({cells:6,seed:17}).forward(11);
  assert.deepEqual(restored.snapshot(),reference.snapshot());
});
test('different bounded partitions remain exactly reversible',()=>{
  for(const cells of [2,4,6,12,32,64,128,256]){
    const lattice=new NexusLattice({cells,seed:123});
    const start=lattice.registers();
    lattice.forward(32).rewind(32);
    assert.deepEqual(lattice.registers(),start);
  }
});
