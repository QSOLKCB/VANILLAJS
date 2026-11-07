// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {IntegerEngine,replayInteger,integerChecksum} from '../modules/integer-engine/index.js';
import {sealIntegerReplay,validateIntegerReplay,verifyIntegerReplay}
  from '../modules/integer-replay/index.js';
const BUILD='4647261445a1128c4e0c1e065f342ac4d2133cff';
const scene=()=>new IntegerEngine({seed:17,bodies:[
  {id:1,position:[0,0,0],velocity:[0,0,0],halfSize:[1,1,1]},
  {id:2,position:[200,0,0],velocity:[0,0,0],halfSize:[1,1,1]}
]}).snapshot();
const frames=count=>Array.from({length:count},(_,tick)=>
  tick%3===0?[{id:1,velocity:[tick%2,0,0]}]:[]);
const tape=count=>sealIntegerReplay(scene(),frames(count),{build:BUILD});
test('complete source-pinned tape reproduces canonical integer engine',()=>{
  const record=tape(230);
  assert.equal(record.format,'qsol.integer-replay/1');
  assert.equal(record.ticks,230);
  assert.equal(record.truncated,false);
  assert.deepEqual(validateIntegerReplay(record,{expectedBuild:BUILD}).source,record.initial);
  const result=verifyIntegerReplay(record,{expectedBuild:BUILD});
  assert.equal(result.match,true);
  assert.equal(result.complete,true);
  assert.equal(result.consumed,230);
  assert.equal(result.unconsumed,0);
  const independent=replayInteger(record.initial,record.frames);
  assert.deepEqual(result.final,independent.snapshot());
  assert.equal(result.digest,integerChecksum(independent));
});
test('each restored checkpoint produces exactly the same subsequent state',()=>{
  const record=tape(125),original=IntegerEngine.fromSnapshot(record.initial);
  const states=[];
  for(const input of record.frames){original.step(input);states.push(original.snapshot());}
  for(const checkpoint of [1,7,16,35,50,75,100,125]){
    const restored=IntegerEngine.fromSnapshot(states[checkpoint-1]);
    for(let i=checkpoint;i<record.frames.length;i++){
      restored.step(record.frames[i]);
      assert.deepEqual(restored.snapshot(),states[i],
        'checkpoint '+checkpoint+' drifted at '+(i+1));
    }
  }
});
test('unconsumed commands after terminal status can never pass by digest alone',()=>{
  const record=tape(15);
  const result=verifyIntegerReplay(record,{
    expectedBuild:BUILD,isTerminal:s=>s.tick===record.initial.tick+8
  });
  assert.equal(result.match,false);
  assert.equal(result.complete,false);
  assert.equal(result.unconsumed,7);
  assert.equal(result.consumed,8);
});
test('unknown build, unknown fields, truncation, sparse frames and digest drift fail closed',()=>{
  const record=tape(20),mutate=change=>{
    const x=structuredClone(record);change(x);
    assert.throws(()=>verifyIntegerReplay(x,{expectedBuild:BUILD}));
  };
  mutate(x=>{x.build='f'.repeat(40);});
  mutate(x=>{x.extra=true;});
  mutate(x=>{x.truncated=true;});
  mutate(x=>{x.ticks++;});
  mutate(x=>{x.frames[4][0]={id:1,teleport:5};});
  mutate(x=>{x.frames[0]=[,{id:1}];});
  mutate(x=>{x.frames=Array(36001).fill([]);});
  mutate(x=>{x.initial.schema='forged';});
  const forged=structuredClone(record);forged.digest='00000000';
  const actual=verifyIntegerReplay(forged,{expectedBuild:BUILD});
  assert.equal(actual.complete,true);assert.equal(actual.match,false);
});
test('tape stores independently owned snapshots and command records',()=>{
  const initial=scene(),commands=frames(30);
  const record=sealIntegerReplay(initial,commands,{build:BUILD});
  const expected=structuredClone(record);
  initial.bodies[0].position[0]=9999;
  commands[0][0].velocity[0]=9999;
  assert.deepEqual(record,expected);
  assert.equal(verifyIntegerReplay(record,{expectedBuild:BUILD}).match,true);
});
test('failed input validation must not issue success records',()=>{
  const invalid=frames(5);invalid[1]=[{id:99,velocity:[1,0,0]}];
  assert.throws(()=>sealIntegerReplay(scene(),invalid,{build:BUILD}));
  const malformed=frames(5);malformed[2]=[{id:1,velocity:[1,,0]}];
  assert.throws(()=>sealIntegerReplay(scene(),malformed,{build:BUILD}));
  assert.throws(()=>sealIntegerReplay(scene(),frames(1),{build:'not-a-source'}));
  const good=tape(3);
  assert.throws(()=>verifyIntegerReplay(good,{expectedBuild:BUILD,isTerminal:'yes'}));
});
