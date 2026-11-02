import test from 'node:test';
import assert from 'node:assert/strict';
import {WeaponTimer} from '../modules/weapons/index.js';
const dt=1/120;
test('held fire respects cadence and magazine capacity without catch-up bursts',()=>{
  const gun=new WeaponTimer({magazineSize:4,interval:.2}),shots=[];
  for(let i=0;i<120;i++)for(const event of gun.step(dt,{fire:true}))if(event.type==='shot')shots.push({tick:i,...event});
  assert.deepEqual(shots.map(s=>s.tick),[0,24,48,72]);assert.deepEqual(shots.map(s=>s.id),[1,2,3,4]);assert.equal(gun.snapshot().ammo,0);
});
test('a blocked fire request is discarded instead of being queued after cooldown',()=>{
  const gun=new WeaponTimer();gun.step(dt,{fire:true});gun.step(dt,{fire:true});
  let shots=0;for(let i=0;i<120;i++)shots+=gun.step(dt).filter(e=>e.type==='shot').length;
  assert.equal(shots,0);assert.equal(gun.snapshot().ammo,7);
});
test('reload transfers only missing rounds and respects finite reserve',()=>{
  const gun=new WeaponTimer({magazineSize:8,ammo:3,reserve:2,reloadTime:.5});
  assert.equal(gun.step(dt,{reload:true,fire:true})[0].type,'reload-start');assert.equal(gun.snapshot().ammo,3);
  let completed=0;for(let i=1;i<60;i++)completed+=gun.step(dt,{fire:true,reload:true}).filter(e=>e.type==='reload-complete').length;
  assert.equal(completed,1);assert.equal(gun.snapshot().ammo,5);assert.equal(gun.snapshot().reserve,0);assert.equal(gun.snapshot().phase,'ready');
  assert.deepEqual(gun.step(dt,{reload:true}),[]);assert.equal(gun.step(dt,{fire:true})[0].type,'shot');
});
test('pause leaves reload/cooldown unchanged; completion cannot fire in the same tick',()=>{
  const gun=new WeaponTimer({ammo:0,reloadTime:.05});gun.step(.025,{reload:true});const before=gun.snapshot();
  assert.deepEqual(gun.step(0,{fire:true}),[]);assert.deepEqual(gun.snapshot(),before);
  const events=gun.step(.025,{fire:true});assert.deepEqual(events.map(e=>e.type),['reload-complete']);assert.equal(events[0].time,.025);
  assert.equal(gun.step(dt,{fire:true})[0].type,'shot');
});
test('full magazines reject reloads; snapshots are owned; invalid config and dt reject',()=>{
  const gun=new WeaponTimer();assert.deepEqual(gun.step(dt,{reload:true}),[]);const state=gun.snapshot();state.ammo=0;assert.equal(gun.snapshot().ammo,8);
  for(const options of [{magazineSize:0},{ammo:9},{reserve:-1},{interval:.01},{reloadTime:NaN}])assert.throws(()=>new WeaponTimer(options));
  const before=gun.snapshot();assert.throws(()=>gun.step(.1,{fire:true}));assert.deepEqual(gun.snapshot(),before);
});
