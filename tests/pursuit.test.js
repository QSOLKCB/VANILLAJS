// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGame,step,nextCase,snapshot,runRecord,replay,roadCurve} from '../demos/pursuit-lab/js/sim.js';
import {composeTrack,FX,ENGINES} from '../demos/pursuit-lab/js/score.js';
function pilot(s){let goal=s.mode==='contact'?s.target.offset:0;
  const threat=s.traffic.find(e=>!e.hit&&e.distance-s.distance>0&&e.distance-s.distance<60&&Math.abs(goal-e.offset)<2);if(threat)goal=threat.offset>=0?-3.4:3.4;
  const error=goal-s.car.offset-s.car.lateralSpeed*.18+roadCurve(s)*s.car.speed*s.car.speed*.03;
  return 4|(error>.15?2:error<-.15?1:0)|(s.boosts&&!s.turbo&&s.tick%240===1&&s.mode==='catch'?16:0);
}
test('pursuit: five cases are beatable with legal controls and entire campaigns replay exactly',()=>{
  for(const seed of [1988,0,42]){const s=createGame({seed});while(['catch','contact','cleared'].includes(s.mode)){if(s.mode==='cleared'){assert.equal(nextCase(s),true);assert.equal(s.boosts,3);}else step(s,pilot(s));}
    assert.equal(s.mode,'won');assert.equal(s.totalHits,32);assert.ok(s.armour>0);assert.equal(s.commands.length,4);assert.ok(s.traffic.length<=24);
    assert.deepEqual(snapshot(replay(runRecord(s))),snapshot(s));assert.equal(nextCase(s),false);
  }
});
test('pursuit: standing still loses on time, turbo is edge-triggered, and brake takes priority',()=>{
  const s=createGame();step(s,16|4);assert.equal(s.boosts,2);for(let i=0;i<190;i++)step(s,16|4);assert.equal(s.boosts,2);step(s,4);step(s,16|4);assert.equal(s.boosts,1);const speed=s.car.speed;step(s,4|8|16);assert.ok(s.car.speed<speed);
  const idle=createGame();for(let i=0;i<4200;i++)step(idle,0);assert.equal(idle.mode,'lost');assert.match(idle.reason,/time/);const before=snapshot(idle);step(idle,31);assert.deepEqual(snapshot(idle),before);
});
test('pursuit: traffic damage disables the unit; target recontact requires separation',()=>{
  const s=createGame();s.car.speed=60;s.armour=14;s.traffic=[{id:1,distance:1,offset:0,speed:0,hit:false}];step(s,4);assert.equal(s.mode,'lost');assert.equal(s.armour,0);assert.equal(s.target.hits,0);
  const chase=createGame();chase.mode='contact';chase.car.speed=70;chase.target.distance=1;step(chase,4);assert.equal(chase.target.hits,1);assert.equal(chase.target.contact,true);assert.equal(chase.target.distance-chase.distance,22);step(chase,4);assert.equal(chase.target.hits,1);
});
test('pursuit: malformed and impossible replay data rejects',()=>{
  const record=runRecord(createGame());for(const bad of [{...record,seed:undefined},{...record,inputs:Array(1)},{...record,inputs:[32]},{...record,commands:[{tick:0,type:'next'}]},{...record,commands:[{tick:1,type:'next'}]},{...record,inputs:Array(54001).fill(0)}])assert.throws(()=>replay(bad));
  assert.throws(()=>replay({...record,inputs:Array(4201).fill(0)}),/terminal/);
});
test('pursuit score: deterministic complete loop and bounded effects',()=>{
  const a=composeTrack(1988),b=composeTrack(1988);assert.equal(a.frames,48000*32);assert.equal(a.loopTicks,1920);assert.equal(a.phraseCount,8);
  const digest=x=>createHash('sha256').update(x).digest('hex');assert.equal(digest(a.wav()),digest(b.wav()));assert.notEqual(digest(a.renderPhrase(0)),digest(composeTrack(42).renderPhrase(0)));
  assert.equal(new DataView(a.wav().buffer).getUint32(40,true),a.frames*2);for(const score of [...Object.values(FX),...ENGINES]){assert.ok(score.frames<=48000);assert.ok(score.eventCount<=128);}
});
