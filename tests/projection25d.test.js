// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjection25D,projectPoint25D,unprojectGround25D,extrudeRect25D,projectScene25D,PROJECTION25D_MAX_BOXES} from '../modules/projection25d/index.js';
const settings=()=>({viewport:[800,600],origin:[100,-50],pixelsPerUnit:2,heightRise:1,heightShear:.5,shadowDirection:[.3,.2]});
const box=(id='home',x=100,z=-50)=>({id,x,z,width:12,depth:9,height:7});
test('projection is pure, owned, affine, and round-trips on ground',()=>{
  const source=settings(),p=createProjection25D(source);source.origin[0]=1000;
  assert.deepEqual(projectPoint25D(p,[100,0,-50]),[400,300]);
  assert.deepEqual(projectPoint25D(p,[100,5,-50]),[395,290]);
  assert.deepEqual(unprojectGround25D(p,[420,318]),[110,-41]);
  assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.origin));
  assert.throws(()=>projectPoint25D(settings(),[0,0,0]),/createProjection25D/);
  assert.deepEqual(projectPoint25D(p,[100,0,-50]),[400,300]);
});
test('visual height does not change collision footprint or ground coordinates',()=>{
  const p=createProjection25D(settings()),r=box(),a=extrudeRect25D(p,r),b=extrudeRect25D(p,{...r,height:14});
  assert.deepEqual(a.footprint,[100,-50,12,9]);assert.deepEqual(b.footprint,a.footprint);
  assert.deepEqual(a.roof[0],[393,286]);assert.deepEqual(b.roof[0],[386,272]);
  assert.deepEqual(a.sideX[0],projectPoint25D(p,[112,0,-50]));
  assert.deepEqual(a.sideZ[0],projectPoint25D(p,[100,0,-41]));
  assert.deepEqual(r,box());
});
test('stable sorting regardless input order and separate shadows',()=>{
  const p=createProjection25D(settings()),data=[box('z',120,20),box('a',90,-20),box('b',90,-20)];
  const a=projectScene25D(p,data),b=projectScene25D(p,[...data].reverse());
  assert.deepEqual(a,b);assert.deepEqual(a.solids.map(x=>x.id),['a','b','z']);
  assert.deepEqual(a.shadows.map(x=>x.id),['a','b','z']);
  assert.ok(Object.isFrozen(a.solids[0].roof[0]));
});
test('admission rejects accessors, invalid points, sparse arrays and duplicate IDs',()=>{
  const good=settings(),getter=settings();let called=false;
  Object.defineProperty(getter,'origin',{get(){called=true;return [0,0];},enumerable:true});
  assert.throws(()=>createProjection25D(getter));assert.equal(called,false);
  for(const patch of [{heightRise:Infinity},{pixelsPerUnit:0},{viewport:[800,NaN]},{origin:[0,,]},{shadowDirection:[0,0,0]}])
    assert.throws(()=>createProjection25D({...good,...patch}));
  const p=createProjection25D(good);
  assert.throws(()=>projectPoint25D(p,[0,,0]));
  assert.throws(()=>extrudeRect25D(p,{...box(),x:Infinity}));
  assert.throws(()=>projectScene25D(p,[box(),box()]));
  assert.throws(()=>projectScene25D(p,Array.from({length:PROJECTION25D_MAX_BOXES+1},()=>box())));
  const items=[box()];items.length=2;assert.throws(()=>projectScene25D(p,items));
});
