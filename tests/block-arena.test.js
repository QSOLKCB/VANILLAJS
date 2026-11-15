// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {starterFPSPack} from '../demos/block-arena-lab/packs.js';
import {FPSSession,verifyFPSReplay,FPS_REPLAY_BYTES} from '../demos/block-arena-lab/replay.js';
import {FPS_MAX_TICKS} from '../demos/block-arena-lab/world.js';
import {arenaVisuals} from '../demos/block-arena-lab/render.js';
import {boxMeshBatch} from '../modules/geometry/index.js';
import {boxVertices} from '../modules/render-webgl/index.js';
import {verifyFPSSource} from '../scripts/fps-source-identity.mjs';
import {createFPSExample} from '../api/fps/example.js';
import {botCommand} from '../demos/block-arena-lab/bots.js';
import {FixedClock} from '../modules/time/index.js';
const data=(p,k)=>p.entries.find(e=>e.id===k).data;
export function encounterFixture(){const p=starterFPSPack();data(p,'geometry').blocks=[];data(p,'geometry').ramps=[];data(p,'spawns').bots=[[0,0,6]];data(p,'spawns').pickups=[];
  data(p,'settings').rules.scoreLimit=1;data(p,'settings').rules.waveGap=60;data(p,'settings').rules.playerHealth=300;
  data(p,'settings').difficulty.easy={reaction:120,error:.3};data(p,'bots').types[0].health=20;data(p,'bots').types[0].speed=1;data(p,'waves').rosters=[['scout'],['scout'],['scout']];Object.assign(data(p,'arsenal').weapons[1],{spread:0,recoil:0,magazine:100});return p;}
test('actual skirmish and survival complete through admitted inputs; no direct damage hook',()=>{
  for(const mode of ['skirmish','survival']){const s=new FPSSession(encounterFixture(),mode,'easy');for(let t=0;t<600&&s.world.status==='playing';t++)s.advance([0,0,0,0,1,1]);assert.equal(s.world.status,'victory');assert.equal(s.world.combat.actor('player').kills,mode==='survival'?3:1);assert.equal(verifyFPSReplay(s.exportReplay()).verification.match,true);}
});
test('original bots move, react, fire real colliding shots and exert pressure; bounded routing',()=>{
  const s=new FPSSession(starterFPSPack(),'skirmish','hard'),initial=s.world.snapshot(),states=new Set();let damage=0,shots=0;
  for(let t=0;t<900;t++){const r=s.advance([0,0,0,0,0,0]);for(const b of s.world.bots)states.add(b.state);damage+=r.events.filter(e=>e.type==='damage'&&e.target==='player').length;shots+=r.events.filter(e=>e.type==='shot'&&e.source!=='player').length;}
  assert.ok(damage>0&&shots>0);assert.notDeepEqual(s.world.bots[0].character.position,initial.bots[0].character.position);assert.ok(states.has('strafe'));assert.ok(s.world.work.expanded<=s.world.work.paths*256);assert.ok(s.world.work.paths<150);
});
test('source-bound complete replay, changes rejected, failed pack import preserves running session',async()=>{
  const s=new FPSSession(starterFPSPack(1),'survival','normal',77);for(let t=0;t<240;t++)s.advance([t<50?500:0,t<80?-300:0,t<30?1000:0,0,t%30===0?1:0,t%3]);
  const before=s.exportReplay(),snapshot=s.world.snapshot(),v=verifyFPSReplay(before);assert.deepEqual(v.session.world.snapshot(),snapshot);assert.equal(v.verification.ticks,snapshot.tick);
  const certified={...JSON.parse(before),verification:v.verification};assert.deepEqual(verifyFPSReplay(JSON.stringify(certified)).verification,v.verification);certified.verification.ticks++;assert.throws(()=>verifyFPSReplay(JSON.stringify(certified)),/claimed verification/);
  for(const change of [r=>r.source='forged',r=>r.inputs[0][0]=1001,r=>r.state.tick++,r=>r.extra=true]){const r=JSON.parse(before);change(r);assert.throws(()=>verifyFPSReplay(JSON.stringify(r)));}
  assert.throws(()=>s.replacePack('{}'));assert.equal(s.exportReplay(),before);assert.throws(()=>s.advance([0,0,0,0,128,0]));assert.deepEqual(s.world.snapshot(),snapshot);
  assert.match((await verifyFPSSource()).source,/^[a-f0-9]{64}$/);
});
test('recording capacity covers every accepted channel for maximum match duration',()=>{
  const row=[-1000,1000,-3141593,3141593,127,2];const worst=JSON.stringify({pack:'x'.repeat(32768),inputs:Array.from({length:FPS_MAX_TICKS},()=>row),state:'x'.repeat(131072)});assert.ok(Buffer.byteLength(worst)<FPS_REPLAY_BYTES);
  const s=new FPSSession(encounterFixture(),'skirmish','easy');s.advance([0,0,0,0,1,0]);assert.equal(s.advance(row).accepted,false);const r=JSON.parse(s.exportReplay());r.inputs.push(row);assert.throws(()=>verifyFPSReplay(JSON.stringify(r)),/unconsumed/);
});
test('retained static box batching has byte-exact independent legacy mesh parity',()=>{for(const n of [0,1]){const s=new FPSSession(starterFPSPack(n)),boxes=arenaVisuals(s.pack);assert.deepEqual(boxMeshBatch(boxes),new Float32Array(boxes.flatMap(b=>boxVertices(b.center,b.size,b.color))));}});
test('public-module consumer example runs without a demo runtime dependency',()=>{const g=createFPSExample(starterFPSPack());const before=g.character.position[2];for(let i=0;i<20;i++)g.step({move:[0,-1],fire:i===0});assert.ok(g.character.position[2]<before);assert.ok(g.combat.actor('target').health<100);});
test('maximum authored IDs compile to usable colliders and scope follows imported archetype order',()=>{
  const p=starterFPSPack();data(p,'geometry').blocks[0].id='b'.repeat(32);data(p,'geometry').ramps[0].id='r'.repeat(32);data(p,'arsenal').weapons.reverse();
  const s=new FPSSession(p);s.advance([0,0,0,0,32,0]);assert.equal(s.world.scope,false);s.advance([0,0,0,0,32,2]);assert.equal(s.world.scope,true);assert.equal(verifyFPSReplay(s.exportReplay()).verification.match,true);
});
test('fixed render partitions preserve exactly the accepted simulation ticks',()=>{
  const sessions=[new FPSSession(starterFPSPack()),new FPSSession(starterFPSPack())];
  for(const [i,s]of sessions.entries()){const c=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6});for(let n=0;n<(i?30:60);n++)c.advance(i?1/30:1/60,()=>s.advance([200,-300,0,0,0,0]));}
  assert.deepEqual(sessions[0].world.snapshot(),sessions[1].world.snapshot());
});
test('hurt bots seek occluding cover and unseen bots patrol with bounded A-star',()=>{
  const s=new FPSSession(starterFPSPack()),w=s.world,b=w.bots[0];
  // Pure policy fixture: a wounded combat observation, unchanged real geometry.
  const actual=w.combat;w.combat={actor:id=>({...actual.actor(id),health:id===b.id?20:150})};
  b.character.position=[0,0,0];b.lastSeen=null;w.tick=0;
  const command=botCommand(w,b,0);assert.equal(b.state,'cover');assert.ok(command.move.every(Number.isFinite));assert.ok(w.work.expanded<=256);assert.ok(w.work.coverRays<=32);
  const count=w.work.coverRays;w.tick=1;botCommand(w,b,0);assert.equal(w.work.coverRays,count);
  w.player.position=[-14,0,-14];b.character.position=[8,0,2];b.lastSeen=null;b.coverGoal=null;b.lostAt=-1000;w.tick=60;botCommand(w,b,0);assert.ok(['patrol','idle'].includes(b.state));
});
test('a complete 36,000-tick accepted match can be exported and verified',()=>{
  const p=encounterFixture();Object.assign(data(p,'settings').rules,{durationTicks:FPS_MAX_TICKS,scoreLimit:50,playerArmour:100});
  Object.assign(data(p,'arsenal').weapons[0],{damage:1,headMultiplier:1,range:2,interval:3});Object.assign(data(p,'bots').types[0],{weapon:'needle',range:3,cadence:180,health:300});
  const s=new FPSSession(p,'skirmish','easy');for(let i=0;i<FPS_MAX_TICKS;i++)assert.equal(s.advance([0,0,0,0,0,0]).accepted,true);
  const text=s.exportReplay();assert.ok(Buffer.byteLength(text)<FPS_REPLAY_BYTES);assert.equal(s.world.tick,FPS_MAX_TICKS);assert.equal(s.advance([0,0,0,0,0,0]).accepted,false);assert.equal(verifyFPSReplay(text).verification.ticks,FPS_MAX_TICKS);
});
