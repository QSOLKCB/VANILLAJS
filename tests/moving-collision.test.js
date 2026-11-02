import test from 'node:test';
import assert from 'node:assert/strict';
import {aabb,castSegment,castMovingSegment} from '../modules/collision/index.js';
import {ProjectileSystem} from '../modules/projectiles/index.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const crossing={id:'crossing',box:aabb([-5.5,-1,-5.25],[-4.5,1,-4.75]),displacement:[10,0,0]};
const moved=c=>({...c,box:aabb(c.box.min.map((v,i)=>v+c.displacement[i]),c.box.max.map((v,i)=>v+c.displacement[i]))});
test('moving query catches a crossing target missed by both endpoint snapshots',()=>{
  assert.equal(castSegment([0,0,0],[0,0,-10],[crossing]),null);
  assert.equal(castSegment([0,0,0],[0,0,-10],[moved(crossing)]),null);
  const hit=castMovingSegment([0,0,0],[0,0,-10],[crossing]);
  near(hit.time,.475);near(hit.distance,4.75);assert.deepEqual(hit.point,[0,0,-4.75]);assert.deepEqual(hit.normal,[0,0,1]);
});
test('motion away from the path prevents a false static hit; matching velocity never catches up',()=>{
  const target={id:'target',box:aabb([-.5,-1,-5.25],[.5,1,-4.75]),displacement:[10,0,0]};
  assert.ok(castSegment([0,0,0],[0,0,-10],[target]));assert.equal(castMovingSegment([0,0,0],[0,0,-10],[target]),null);
  assert.equal(castMovingSegment([0,0,0],[0,0,-10],[{...target,displacement:[0,0,-10]}]),null);
  const headOn=castMovingSegment([0,0,0],[0,0,-10],[{...target,displacement:[0,0,10]}]);near(headOn.time,.2375);near(headOn.point[2],-2.375);
});
test('stationary shots detect an approaching box with world point and zero path length',()=>{
  const target={id:'sweeper',box:aabb([-3,-1,-1],[-1,1,1]),displacement:[4,0,0]};
  const hit=castMovingSegment([0,0,0],[0,0,0],[target]);near(hit.time,.25);near(hit.distance,0);assert.deepEqual(hit.point,[0,0,0]);
  assert.deepEqual(hit.normal,[1,0,0]);
  near(castMovingSegment([0,0,0],[0,0,0],[target],{halfSize:.2}).time,.2);
  const inside=castMovingSegment([-2,0,0],[0,0,0],[target]);assert.equal(inside.startedInside,true);assert.equal(inside.time,0);
});
test('static equivalence, occlusion, ignore ids and ties preserve existing query semantics',()=>{
  const wall={id:'wall',box:aabb([-1,-1,-3],[1,1,-2])};
  assert.deepEqual(castMovingSegment([0,0,0],[0,0,-10],[wall]),castSegment([0,0,0],[0,0,-10],[wall]));
  assert.equal(castMovingSegment([0,0,0],[0,0,-10],[crossing,wall]).id,'wall');
  assert.equal(castMovingSegment([0,0,0],[0,0,-10],[crossing,wall],{ignoreIds:['wall']}).id,'crossing');
  const twins=[{...crossing,id:'b'},{...crossing,id:'a'}];
  assert.equal(castMovingSegment([0,0,0],[0,0,-10],twins).id,'a');
  assert.equal(castMovingSegment([0,0,0],[0,0,-10],twins.reverse()).id,'a');
});
test('moving queries own results and reject invalid motion, including ignored rows and overflow',()=>{
  const before=structuredClone(crossing);const result=castMovingSegment([0,0,0],[0,0,-10],[crossing]);result.point[0]=20;assert.deepEqual(crossing,before);
  for(const displacement of [[NaN,0,0],[Infinity,0,0],[1,0]])assert.throws(()=>castMovingSegment([0,0,0],[0,0,-10],[{...crossing,displacement}],{ignoreIds:['crossing']}));
  assert.throws(()=>castMovingSegment([0,0,0],[1e308,0,0],[{...crossing,displacement:[-1e308,0,0]}]));
  assert.throws(()=>castMovingSegment([0,0,0],[0,0,-10],[crossing,crossing]));
});
test('projectile moving steps clip target motion to remaining lifetime, including an expiry contact',()=>{
  const target={id:'sweeper',box:aabb([-3,-1,-1],[-1,1,1]),displacement:[4,0,0]};
  const system=new ProjectileSystem();system.spawn({position:[0,0,0],velocity:[0,0,0],lifetime:.2});
  assert.equal(system.stepMoving(1,[target])[0].type,'expired');
  system.spawn({position:[0,0,0],velocity:[0,0,0],lifetime:.25});
  const [contact]=system.stepMoving(1,[target]);assert.equal(contact.type,'hit');near(contact.time,.25);near(contact.hit.time,1);
  assert.equal(system.size,0);assert.deepEqual(system.stepMoving(1,[target]),[]);
});
test('moving projectiles emit ordered impacts once, preserve static step and stage invalid updates',()=>{
  const p=new ProjectileSystem();p.spawn({position:[0,0,0],velocity:[0,0,-10]});
  assert.equal(p.stepMoving(1,[crossing])[0].type,'hit');assert.equal(p.size,0);
  p.spawn({position:[0,0,0],velocity:[0,0,-10]});assert.deepEqual(p.step(1,[crossing]),[]);assert.equal(p.size,1);p.clear();
  const target={id:'sweep',box:aabb([-3,-1,-1],[-1,1,1]),displacement:[4,0,0]};
  const later=p.spawn({position:[1,0,0],velocity:[0,0,0]}),earlier=p.spawn({position:[0,0,0],velocity:[0,0,0]});
  const before=p.snapshots();assert.deepEqual(p.stepMoving(0,[target]),[]);assert.deepEqual(p.snapshots(),before);
  assert.throws(()=>p.stepMoving(1,[{...target,displacement:[NaN,0,0]}]));assert.deepEqual(p.snapshots(),before);
  assert.deepEqual(p.stepMoving(1,[target]).map(e=>[e.projectileId,e.time]),[[earlier.id,.25],[later.id,.5]]);
});
test('linear target motion agrees across subdivisions, even for a fast crossing',()=>{
  const run=count=>{
    const p=new ProjectileSystem();p.spawn({position:[0,0,0],velocity:[0,0,-1000]});let found;
    for(let i=0;i<count;i++){
      const start=10*i/count,c={...crossing,box:aabb(crossing.box.min.map((v,j)=>v+(j===0?start:0)),crossing.box.max.map((v,j)=>v+(j===0?start:0))),displacement:[10/count,0,0]};
      const event=p.stepMoving(.01/count,[c])[0];if(event)found={time:i*.01/count+event.time,point:event.hit.point};
    }return found;
  };
  const once=run(1);for(const count of [2,10,100]){const split=run(count);near(split.time,once.time);split.point.forEach((v,i)=>near(v,once.point[i]));}
});
