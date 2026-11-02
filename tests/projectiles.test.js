import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectileSystem} from '../modules/projectiles/index.js';
import {aabb} from '../modules/collision/index.js';
const wall={id:'wall',box:aabb([-2,-2,-5.01],[2,2,-5])};
const shot={position:[0,0,0],velocity:[0,0,-1000]};
test('a projectile emits one nearest hit and is removed before the next tick',()=>{
  const p=new ProjectileSystem();const {id}=p.spawn(shot);
  const events=p.step(1/120,[wall,{id:'target',box:aabb([-1,-1,-8],[1,1,-7])}]);
  assert.equal(events.length,1);assert.equal(events[0].projectileId,id);
  assert.equal(events[0].type,'hit');assert.equal(events[0].hit.id,'wall');
  assert.equal(events[0].time,.005);assert.equal(p.size,0);assert.deepEqual(p.step(1/120,[wall]),[]);
});
test('lifetime clips travel; contact exactly at expiry wins over expiry',()=>{
  const p=new ProjectileSystem();p.spawn({...shot,lifetime:.004});
  const [expired]=p.step(1,[wall]);assert.equal(expired.type,'expired');assert.deepEqual(expired.position,[0,0,-4]);
  p.spawn({...shot,lifetime:.005});assert.equal(p.step(1,[wall])[0].type,'hit');
});
test('simultaneous hits are ordered by impact time then creation id',()=>{
  const p=new ProjectileSystem();const slow=p.spawn({...shot,velocity:[0,0,-10]});
  const fast=p.spawn(shot),fast2=p.spawn(shot);
  assert.deepEqual(p.step(1,[wall]).map(e=>e.projectileId),[fast.id,fast2.id,slow.id]);
  assert.equal(p.size,0);
});
test('capacity is bounded, reclaimed after expiry and clear never reuses ids',()=>{
  const p=new ProjectileSystem({capacity:1});const first=p.spawn({...shot,lifetime:.1});
  assert.deepEqual(p.spawn(shot),{accepted:false,id:null,reason:'capacity'});
  p.step(.1);assert.equal(p.size,0);
  const second=p.spawn(shot);p.clear();const third=p.spawn(shot);
  assert.ok(first.id<second.id && second.id<third.id);assert.equal(p.capacity,1);
});
test('spawn data, snapshots and query inputs cannot mutate owned motion',()=>{
  const p=new ProjectileSystem(),input={...shot,position:[0,0,0],data:{kind:'pulse'},ignoreIds:[]};
  p.spawn(input);input.position[0]=50;input.data.kind='changed';input.ignoreIds.push('wall');
  const snapshot=p.snapshots();snapshot[0].position[0]=20;snapshot[0].data.kind='changed again';
  const [event]=p.step(.01,[wall]);assert.equal(event.data.kind,'pulse');assert.equal(event.hit.id,'wall');
});
test('zero dt is inert; invalid steps leave all shots untouched',()=>{
  const p=new ProjectileSystem();p.spawn(shot);p.spawn({...shot,position:[10,0,0]});
  const before=p.snapshots();assert.deepEqual(p.step(0,[wall]),[]);assert.deepEqual(p.snapshots(),before);
  assert.throws(()=>p.step(-1));assert.throws(()=>p.step(.01,[wall,wall]));assert.deepEqual(p.snapshots(),before);
});
test('explicit ignores, initial overlap and zero velocity use query semantics',()=>{
  const p=new ProjectileSystem();p.spawn({...shot,ignoreIds:['wall']});assert.deepEqual(p.step(.01,[wall]),[]);
  p.clear();p.spawn({position:[0,0,-5],velocity:[0,0,0]});
  const [event]=p.step(.01,[wall]);assert.equal(event.time,0);assert.equal(event.hit.startedInside,true);
});
test('invalid projectile configuration is rejected',()=>{
  assert.throws(()=>new ProjectileSystem({capacity:0}));const p=new ProjectileSystem();
  for(const input of [{...shot,lifetime:0},{...shot,halfSize:-1},{...shot,velocity:[0,NaN,1]},{...shot,ignoreIds:[3]}])assert.throws(()=>p.spawn(input));
  assert.equal(p.size,0);
});
