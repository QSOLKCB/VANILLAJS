import test from 'node:test';
import assert from 'node:assert/strict';
import {createFpsLab,stepFpsLab} from '../demos/fps-lab/worlds.js';
import {FixedClock} from '../modules/time/index.js';
const dt=1/120,advance=(s,n,input={})=>{for(let i=0;i<n;i++)stepFpsLab(s,input,dt);};
for(const kind of ['lift','shuttle'])test(`${kind} course completes through actual moving geometry and all four markers`,()=>{
  const s=createFpsLab(kind);
  for(let i=0;i<3000&&!s.complete;i++){
    const leave=s.nextCheckpoint>=2 && s.platformTime>=(kind==='lift'?6:10);
    stepFpsLab(s,{move:leave?[0,-1]:[0,0],crouch:kind==='lift'&&s.character.position[2]>.5&&s.platformTime>3},dt);
    assert.equal(s.truncated,false);
  }
  assert.equal(s.complete,true);assert.equal(s.nextCheckpoint,4);assert.equal(s.rescues,0);
});
test('lift interlock freezes platform motion, leaves controls active and resumes after crouching',()=>{
  const s=createFpsLab('lift');advance(s,850);assert.equal(s.platformBlocked,true);
  const time=s.platformTime,position=[...s.platforms[0].center];advance(s,60);
  assert.equal(s.platformTime,time);assert.deepEqual(s.platforms[0].center,position);assert.ok(s.character.position[1]+1.8<6);
  advance(s,60,{crouch:true});assert.equal(s.platformBlocked,false);assert.ok(s.platformTime>time);assert.ok(s.character.position[1]>4.4);
});
test('reverse releases a stopped lift; jumping from a shuttle retains departure speed once',()=>{
  const s=createFpsLab('lift');advance(s,850);s.platformDirection=-1;const y=s.character.position[1];advance(s,60);assert.equal(s.platformBlocked,false);assert.ok(s.character.position[1]<y-.45);
  const shuttle=createFpsLab('shuttle');advance(shuttle,360);const before=shuttle.character.velocity[2];stepFpsLab(shuttle,{jump:true},dt);
  assert.ok(before<-3);assert.equal(shuttle.character.velocity[2],before);assert.equal(shuttle.character.supportId,null);advance(shuttle,20);assert.equal(shuttle.character.velocity[2],before);
});
test('fall recovery rewinds the route and checkpoints, restores pose and clears in-flight shots',()=>{
  const s=createFpsLab('shuttle');s.shotMode='bolt';stepFpsLab(s,{fire:true},dt);advance(s,100,{move:[1,0]});
  assert.ok(s.rescues>=1);assert.ok(s.platformTime<1);assert.ok(s.character.position[1]>=2.5);assert.equal(s.projectiles.size,0);assert.equal(s.nextCheckpoint,1);
});
test('pause freezes the rider and route together; reset restores support and direction',()=>{
  const s=createFpsLab('lift');advance(s,360);const clock=new FixedClock();clock.setPaused(true);
  const snapshot=()=>({body:s.character,platforms:s.platforms,time:s.elapsed,route:s.platformTime});const before=structuredClone(snapshot());
  clock.advance(10,step=>stepFpsLab(s,{},step));stepFpsLab(s,{},0);assert.deepEqual(snapshot(),before);
  const reset=createFpsLab('lift');assert.equal(reset.platformTime,0);assert.equal(reset.platformDirection,1);assert.equal(reset.rescues,0);assert.equal(reset.character.supportId,null);
});
test('30/60/144 Hz presentation schedules preserve riding, interlocks, jumps and projectiles',()=>{
  const runs=[30,60,144].map(hz=>{
    const s=createFpsLab('lift'),clock=new FixedClock();
    for(let frame=0;frame<hz*8;frame++)clock.advance(1/hz,step=>stepFpsLab(s,{crouch:clock.ticks>800,fire:clock.ticks===200},step));
    return {body:s.character,platforms:s.platforms,time:s.elapsed,route:s.platformTime,blocked:s.platformBlocked,history:s.history};
  });assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[1],runs[2]);
});
