// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {starterProject,emptyProject,gardenSprite} from '../demos/game-maker-lab/starter.js';
import {validateProject,parseProject,serializeProject,assertPlayable,projectIssues,GameRuntime,GAME_MAKER_BYTES} from '../demos/game-maker-lab/game.js';

test('original starter and empty-stage admission keep authoring separate from play readiness',()=>{
  const empty=emptyProject();assert.equal(empty.map.collision.reduce((a,b)=>a+b,0),0);assert.equal(projectIssues(empty).length,3);assert.throws(()=>assertPlayable(empty),/spawn/);
  const p=starterProject();assert.equal(projectIssues(p).length,0);assert.deepEqual(parseProject(serializeProject(p)),p);assert.equal(p.map.triggers.filter(t=>t.tag==='collect').length,3);assert.equal(p.playerSprite.license,'Apache-2.0');
  p.playerSprite.frames[0].pixels[0]=1;assert.notDeepEqual(p,starterProject(),'callers own independent original data');
});
test('project boundaries reject unknown versions, executable records, unknown rules and excessive bytes',()=>{
  const p=starterProject();for(const bad of [{...p,version:2},{...p,script:'alert(1)'},{...p,name:''},{...p,map:{...p.map,triggers:[{id:'bad',column:1,row:1,tag:'execute'}]}}])assert.throws(()=>validateProject(bad));
  let invoked=false;const accessor={...p};Object.defineProperty(accessor,'name',{get(){invoked=true;return 'x';},enumerable:true});assert.throws(()=>validateProject(accessor));assert.equal(invoked,false);
  const proto=Object.assign(Object.create({hidden:true}),p);assert.throws(()=>validateProject(proto));assert.throws(()=>parseProject(' '.repeat(GAME_MAKER_BYTES+1)),/MiB/);
  const unknownSpawn=starterProject();unknownSpawn.map.spawns[0].id='enemy';assert.throws(()=>validateProject(unknownSpawn),/player/);
  const twoExits=starterProject();twoExits.map.triggers.push({id:'second-exit',column:4,row:9,tag:'exit'});assert.throws(()=>validateProject(twoExits),/one exit/);
});
test('whole-body terrain actually blocks walking and a deliberate jump clears the original obstacle',()=>{
  const g=new GameRuntime(starterProject());for(let i=0;i<160;i++)g.step({x:1,jump:false});
  const blocked=g.snapshot();assert.equal(blocked.body.x,10*256-80);assert.equal(blocked.body.y,256+112);assert.equal(blocked.collected.length,1);assert.equal(blocked.status,'playing');
  g.step({x:1,jump:true});for(let i=0;i<32;i++)g.step({x:1,jump:false});assert.ok(g.snapshot().body.x>11*256);assert.equal(g.snapshot().collected.length,2);
});
test('actual fixed input sequence completes every signal and the portal without bypassing collision',()=>{
  const g=new GameRuntime(starterProject());const events=[];for(let i=0;i<400&&g.snapshot().status==='playing';i++){
    const b=g.snapshot().body,jump=b.grounded&&((b.x>8.3*256&&b.x<9.5*256)||(b.x>13.6*256&&b.x<14.5*256));events.push(...g.step({x:1,jump}).events);
  }
  const s=g.snapshot();assert.equal(s.status,'won');assert.deepEqual(s.collected,['spark-west','spark-center','spark-east']);assert.equal(events.filter(e=>e==='jump').length,2);assert.equal(events.filter(e=>e==='collect').length,3);assert.equal(events.at(-1),'won');
  assert.deepEqual(g.step({x:-1,jump:true}),s,'finished games do not continue simulation');
  const restarted=g.restart();assert.equal(restarted.tick,0);assert.equal(restarted.status,'playing');assert.deepEqual(restarted.collected,[]);
});
test('hazard loses, missing signals keep exit locked, and invalid controls preserve accepted state',()=>{
  const hazard=starterProject();hazard.map.collision[10*24+10]=0;const g=new GameRuntime(hazard);for(let i=0;i<250&&g.snapshot().status==='playing';i++)g.step({x:1,jump:false});assert.equal(g.snapshot().status,'lost');assert.equal(g.snapshot().events.at(-1),'lost');
  const locked=starterProject();locked.map.spawns[0]={id:'player',column:22,row:10};const h=new GameRuntime(locked);for(let i=0;i<10;i++)h.step({x:0,jump:false});assert.equal(h.snapshot().status,'playing');
  const before=h.snapshot();assert.throws(()=>h.step({x:2,jump:false}));assert.deepEqual(h.snapshot(),before);const copy=h.snapshot();copy.body.x=0;assert.deepEqual(h.snapshot(),before,'snapshots do not mutate runtime');
});
test('project roundtrip and sprite changes preserve deterministic game behavior',()=>{
  const p=starterProject();p.playerSprite=gardenSprite(975);const a=new GameRuntime(p),b=new GameRuntime(parseProject(serializeProject(p)));
  const inputs=Array.from({length:180},(_,i)=>({x:i<80?1:i<100?-1:1,jump:i===65||i===140}));
  for(const input of inputs)assert.deepEqual(a.step(input),b.step(input));
  const local=starterProject();const g=new GameRuntime(local);local.map.collision.fill(0);assert.ok(g.project.map.collision.some(Boolean),'accepted project is independently owned');
});
