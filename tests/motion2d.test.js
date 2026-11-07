import test from 'node:test';
import assert from 'node:assert/strict';
import {createBody2D,stepBody2D,direction2D,MOTION2D_PROFILES,MOTION2D_SCALE}
  from '../modules/motion2d/index.js';
const bounds={minX:-50000,maxX:50000,minY:-50000,maxY:50000};
test('profiles preserve exact integer coordinates and do not mutate inputs',()=>{
  assert.equal(MOTION2D_SCALE,256);assert.deepEqual(MOTION2D_PROFILES,['rts','shmup','platform','car']);
  for(const profile of MOTION2D_PROFILES){
    const start=createBody2D(),snapshot=structuredClone(start),controls=Object.freeze({x:1,y:1,steer:1,throttle:1,jump:true});
    const a=stepBody2D(start,controls,{profile,bounds}),b=stepBody2D(start,controls,{profile,bounds});
    assert.deepEqual(a,b);assert.deepEqual(start,snapshot);
    for(const key of ['x','y','vx','vy','heading'])assert.ok(Number.isSafeInteger(a[key]));
  }
});
test('RTS top-down friction, collision and boundary clamp are deterministic',()=>{
  let a=createBody2D();for(let i=0;i<12;i++)a=stepBody2D(a,{x:1},{bounds});
  assert.ok(a.x>0&&a.vx>0);
  let b=a;for(let i=0;i<20;i++)b=stepBody2D(b,{}, {bounds});assert.equal(b.vx,0);
  const solid=(x)=>x>5;
  const blocked=stepBody2D(createBody2D(),{x:1},{blockedAt:solid,bounds});
  assert.equal(blocked.x,0);assert.equal(blocked.vx,0);
  const edge=stepBody2D(createBody2D({x:2}),{x:1},
    {bounds:{minX:-100,maxX:2,minY:-100,maxY:100}});
  assert.equal(edge.x,2);assert.equal(edge.vx,0);
});
test('SHMUP diagonal and platform jump/fall trajectories are repeatable',()=>{
  const s=stepBody2D(createBody2D(),{x:-1,y:1},{profile:'shmup',bounds});
  assert.deepEqual([s.x,s.y,s.vx,s.vy],[-16,16,-16,16]);
  const first=stepBody2D(createBody2D({grounded:true}),{jump:true},
    {profile:'platform',bounds,groundY:0});
  assert.ok(first.y>0&&first.vy>0&&!first.grounded);
  let p=first;for(let i=0;i<40;i++)p=stepBody2D(p,{}, {profile:'platform',bounds,groundY:0});
  assert.equal(p.y,0);assert.equal(p.vy,0);assert.equal(p.grounded,true);
});
test('CAR heading loop, throttle and braking require no trigonometry',()=>{
  let a=createBody2D();
  for(let i=0;i<16;i++)a=stepBody2D(a,{steer:1},{profile:'car',bounds});
  assert.equal(a.heading,0);assert.deepEqual(direction2D(0),[4096,0]);
  const b=stepBody2D(createBody2D(),{throttle:1},{profile:'car',bounds});
  assert.ok(b.x>0&&b.vx>0);assert.equal(b.y,0);
});
test('bad input types, invalid bounds and ghost modes fail closed',()=>{
  for(const inp of [{x:NaN},{vx:513},{x:1.5},{heading:16},{y:Infinity}])
    assert.throws(()=>createBody2D(inp));
  for(const x of [{x:2},{jump:1},{steer:-2}])assert.throws(()=>stepBody2D(createBody2D(),x));
  assert.throws(()=>stepBody2D(createBody2D(),{}, {profile:'ghost'}));
  assert.throws(()=>stepBody2D(createBody2D(),{}, {bounds:{minX:2,maxX:2,minY:0,maxY:20}}));
  assert.throws(()=>stepBody2D(createBody2D(),{}, {blockedAt:1}));
  assert.throws(()=>direction2D(-1));
});
test('bounded stress replay yields identical snapshots under identical commands',()=>{
  const run=()=>{let s=createBody2D();for(let i=0;i<8000;i++){
    const profile=MOTION2D_PROFILES[i%4];
    s=stepBody2D(s,{x:(i%3)-1,y:(i%5)%3-1,steer:i%2?1:-1,throttle:i%3-1,
      jump:i%19===0},{profile,bounds,groundY:-40000});
  }return s;};
  assert.deepEqual(run(),run());
});
