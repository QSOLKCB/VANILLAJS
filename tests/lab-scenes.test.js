// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSculpture,stepSculpture,sculpture,plinth,PATTERNS,SIZES} from '../demos/gpu-lab/scene.js';
import {createWorld,stepWorld,COURSE,TARGET} from '../demos/space-lab/world.js';
import {ship,projectiles,sphere,station,trail} from '../demos/space-lab/geometry.js';
import {packedVertices} from '../modules/render-optional/index.js';
test('kinetic presets are deterministic, distinct and bounded at every budget',()=>{
  const variants=[];
  for(const pattern of PATTERNS)for(const size of SIZES){
    const state=createSculpture(pattern,size),a=sculpture(state);
    assert.equal(a.length/6,size*size*36);assert.deepEqual(a,sculpture(createSculpture(pattern,size)));
    assert.equal(packedVertices(a).length,a.length);for(let i=0;i<60;i++)stepSculpture(state);
    assert.notDeepEqual(a,sculpture(state));if(size===8)variants.push(a);
  }
  assert.notDeepEqual(variants[0],variants[1]);assert.notDeepEqual(variants[1],variants[2]);
  assert.throws(()=>createSculpture('unknown'));assert.throws(()=>createSculpture('ripple',1000));
  assert.ok(packedVertices(plinth()).length/6<3000);
});
test('flight gates progress in order and detect a swept high-speed crossing',()=>{
  const w=createWorld();w.position=[...COURSE[1]];stepWorld(w);assert.equal(w.checkpoint,0);
  w.position=[0,0,1];w.velocity=[0,0,-600];stepWorld(w);assert.equal(w.checkpoint,1);
  w.velocity=[0,0,0];w.position=[...COURSE[1]];stepWorld(w);assert.equal(w.checkpoint,2);
  w.position=[...COURSE[2]];stepWorld(w);assert.equal(w.checkpoint,3);assert.equal(w.completed,true);
  for(let i=0;i<20;i++)stepWorld(w);assert.equal(w.checkpoint,3);
  assert.equal(createWorld().checkpoint,0);assert.equal(createWorld('broadside').completed,false);
});
test('orbit state starts on its trajectory and bounds independent trail snapshots',()=>{
  const w=createWorld('orbit');assert.equal(Math.hypot(...w.position),25);assert.ok(Math.hypot(...w.velocity)>0);
  for(let i=0;i<1500;i++)stepWorld(w);
  assert.equal(w.trail.length,128);assert.ok(Math.abs(Math.hypot(...w.position)-25)<.01);
  const point=[...w.trail[0]];w.position[0]=0;assert.deepEqual(w.trail[0],point);
  assert.equal(trail(w.trail).length/6,254);assert.equal(createWorld('orbit').trail.length,0);
});
test('ship turns in world space while independently streamed shots keep their positions',()=>{
  const w=createWorld('broadside');w.position=[3,2,7];w.shots=[{p:[12,2,7],v:[25,0,0],life:1}];
  const shots=projectiles(w),body=ship(w);w.yaw=Math.PI/2;
  assert.deepEqual(projectiles(w),shots);assert.notDeepEqual(ship(w),body);
  for(const data of [ship(w),shots,sphere([0,0,0],6),station()])assert.ok(packedVertices(data).length>0);
  assert.throws(()=>sphere([0,0,0],6,9999));assert.deepEqual(TARGET,[12,0,8]);
});
test('exercise completion respects docking speed and broadside hit count',()=>{
  const dock=createWorld('docking');dock.position=[0,0,0];dock.velocity=[3,0,0];stepWorld(dock,{dock:true});assert.equal(dock.completed,false);
  dock.velocity=[0,0,0];stepWorld(dock,{dock:true});assert.equal(dock.completed,true);
  const fire=createWorld('broadside');for(let i=0;i<300;i++)stepWorld(fire,{fire:true});assert.ok(fire.hits>=5);assert.equal(fire.completed,true);assert.ok(fire.shots.length<=32);
});
