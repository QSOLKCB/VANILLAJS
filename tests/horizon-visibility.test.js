// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionRaceWorld,raceBatchBounds,raceTileVisible} from '../demos/horizon-lab/race-visibility.js';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession} from '../demos/horizon-lab/race-model.js';

function triangles(batch){const rows=new Map(),v=batch.vertices;for(let i=0;i<v.length;i+=33){const key=Buffer.from(v.buffer,v.byteOffset+i*4,33*4).toString('hex');rows.set(key,(rows.get(key)??0)+1);}return rows;}
function mergeTriangles(batches){const counts=new Map();for(const batch of batches)for(const [key,n] of triangles(batch))counts.set(key,(counts.get(key)??0)+n);return counts;}

test('tile grid is deterministic, conservative and bit-identical to full original low-profile scenery',()=>{
  const project=structuredClone(starterRaceProject());project.scenery.profile='low';const race=createRaceSession(project),original=race.world.batches;
  const before=race.world.physics.sampleSurface(0,0,2000),parts=partitionRaceWorld(original),again=partitionRaceWorld(original);
  assert.deepEqual(parts,again);assert.ok(parts.length>original.length,'world has retained terrain and foliage tiles');
  assert.ok(parts.length<=original.length+30,'bounded 4x4 grids cannot exhaust low-profile mesh budget');
  for(const id of ['terrain','foliage']){
    const parent=original.find(row=>row.id===id),children=parts.filter(row=>row.id.startsWith(id+'-tile-'));
    assert.ok(parent&&children.length>1);
    assert.equal(children.reduce((n,row)=>n+row.vertices.length,0),parent.vertices.length);
    assert.deepEqual(mergeTriangles(children),triangles(parent),'every original Float32 triangle occurs exactly once');
    for(const child of children){const {min,max,center,radius}=child.visibilityBounds;
      assert.ok(radius>0);for(let i=0;i<3;i++)assert.ok(min[i]<=center[i]&&center[i]<=max[i]);
    }
  }
  for(const batch of original.filter(row=>!['terrain','foliage'].includes(row.id)))assert.strictEqual(parts.find(row=>row.id===batch.id),batch,'unpartitioned material remains exactly the original');
  assert.deepEqual(race.world.physics.sampleSurface(0,0,2000),before,'contact sampler untouched by presentation');
});

test('sphere-frustum admission never loses intersecting near/side/far tiles',()=>{
  const camera={position:[0,0,0],target:[0,0,-1]},tile=(center,radius=.25)=>({center,radius});
  assert.equal(raceTileVisible(tile([0,0,-20]),camera,1,1),true);
  assert.equal(raceTileVisible(tile([30,0,-20]),camera,1,1),false);
  assert.equal(raceTileVisible(tile([0,30,-20]),camera,1,1),false);
  assert.equal(raceTileVisible(tile([0,0,20]),camera,1,1),false);
  assert.equal(raceTileVisible(tile([0,0,-2200]),camera,1,1),false);
  assert.equal(raceTileVisible(tile([0,0,.12],.3),camera,1,1),true,'near-plane intersecting tile retained');
  assert.equal(raceTileVisible(tile([0,0,-2000],1),camera,1,1),true,'far-plane intersecting tile retained');
  assert.equal(raceTileVisible(tile([11,0,-20],1),camera,1,1),true,'side-plane intersecting tile retained');
  assert.equal(raceTileVisible(tile([0,0,-20]),{position:[0,0,0],target:[0,1,0]},1,1),false);
  assert.equal(raceTileVisible(tile([0,0,-20]),{position:[0,0,0],target:[0,0,0]},1,1),true,'bad camera fails open');
  assert.equal(raceTileVisible(null,camera,1,1),true,'missing bounds fail open');
});

test('unsupported and malformed tile data are rejected; original arrays are not mutated',()=>{
  assert.throws(()=>partitionRaceWorld(null));assert.throws(()=>partitionRaceWorld([],9));
  assert.throws(()=>raceBatchBounds(new Float32Array(5)));assert.throws(()=>raceBatchBounds([]));
  const values=new Float32Array(33);values[0]=NaN;assert.throws(()=>raceBatchBounds(values));
});
