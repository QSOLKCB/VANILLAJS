import test from 'node:test';
import assert from 'node:assert/strict';
import {aabb,moveAndSlideMovingAABB} from '../modules/collision/index.js';
import {createCharacter,characterConfig,stepCharacterPlatforms} from '../modules/character/index.js';
const dt=1/120,config=characterConfig(),near=(a,b,e=2e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const platform=(displacement=[0,0,0])=>({id:'platform',box:aabb([-2,-.5,-2],[2,0,2]),displacement});
function advance(c,world,n,input={}){
  let result;for(let i=0;i<n;i++){
    result=stepCharacterPlatforms(c,input,dt,config,world);
    if(result.blocked)break;
    for(const p of world)if(p.displacement)p.box=aabb(p.box.min.map((v,j)=>v+p.displacement[j]),p.box.max.map((v,j)=>v+p.displacement[j]));
  }return result;
}
test('riders follow ascending, descending, horizontal and diagonal platforms without drift',()=>{
  for(const velocity of [[0,2,0],[0,-2,0],[2,0,0],[2,1,-3]]){
    const c=createCharacter(),world=[platform(velocity.map(v=>v*dt))];
    const r=advance(c,world,240);assert.equal(r.blocked,false);assert.equal(c.supportId,'platform');assert.equal(c.grounded,true);
    c.position.forEach((v,i)=>near(v,velocity[i]*2));c.velocity.forEach((v,i)=>near(v,velocity[i]));
  }
});
test('support speed changes and reversals preserve relative position instead of accumulating carry',()=>{
  const c=createCharacter(),p=platform([2*dt,0,0]);advance(c,[p],120);
  p.displacement=[-2*dt,0,0];advance(c,[p],120);near(c.position[0],0);near(c.velocity[0],-2);
  p.displacement=[0,0,0];advance(c,[p],120);near(c.position[0],0);near(c.velocity[0],0);
});
test('jump inherits world platform velocity once; airborne motion is not carried a second time',()=>{
  const c=createCharacter(),p=platform([2*dt,dt,0]);advance(c,[p],60);const before=[...c.position];
  const result=advance(c,[p],1,{jump:true});assert.equal(result.jumped,true);assert.equal(c.grounded,false);near(c.velocity[0],2);near(c.velocity[1],1+config.jumpSpeed-config.gravity*dt);
  advance(c,[p],20);near(c.position[0]-before[0],2*dt*21);assert.equal(c.supportId,null);
  assert.equal(advance(c,[p],1,{jump:true}).jumped,false);
});
test('walking off retains platform momentum; a falling rider lands on a translating top',()=>{
  const c=createCharacter(),p=platform([dt,0,0]);advance(c,[p],120,{move:[0,-1]});assert.equal(c.grounded,false);assert.equal(c.supportId,null);assert.ok(c.position[1]<0);
  const falling=createCharacter({position:[0,3,0]}),moving=platform([dt,0,0]);
  advance(falling,[moving],100);assert.equal(falling.grounded,true);assert.equal(falling.supportId,'platform');near(falling.position[1],0);
});
test('a rising platform cannot crush a rider into a roof; blocked ticks leave all body fields unchanged',()=>{
  const c=createCharacter(),p=platform([0,2*dt,0]),roof={id:'roof',box:aabb([-3,2,-3],[3,3,3])};
  let blocked=false;
  for(let i=0;i<40;i++){
    const before=structuredClone(c),r=stepCharacterPlatforms(c,{},dt,config,[p,roof]);
    if(r.blocked){assert.deepEqual(c,before);blocked=true;break;}
    p.box=aabb(p.box.min.map((v,j)=>v+p.displacement[j]),p.box.max.map((v,j)=>v+p.displacement[j]));
  }
  assert.equal(blocked,true);assert.ok(c.position[1]+1.8<2);
  const resume=advance(c,[p,roof],10,{crouch:true});assert.equal(resume.blocked,false);assert.equal(c.crouched,true);assert.ok(c.position[1]>.25);
});
test('sideways carry into a wall stops safely and reversing the world frees the rider',()=>{
  const c=createCharacter(),p=platform([2*dt,0,0]),wall={id:'wall',box:aabb([.8,0,-3],[1,3,3])};
  advance(c,[p,wall],90);assert.ok(c.position[0]<=.45+1e-5);assert.equal(c.grounded,true);
  // A single side wall permits the platform to slide beneath the rider; it is not a crush.
  p.displacement=[-2*dt,0,0];assert.equal(advance(c,[p,wall],90).blocked,false);assert.ok(c.position[0]<0);
});
test('standing headroom on a platform is checked before movement',()=>{
  const c=createCharacter(),p=platform(),roof={id:'roof',box:aabb([-3,1.25,-3],[3,3,3])};
  advance(c,[p,roof],1,{crouch:true});const r=advance(c,[p,roof],1);assert.equal(r.standBlocked,true);assert.equal(c.crouched,true);near(c.position[1],0);
});
test('support ties are stable by id and zero/invalid ticks cannot partially alter a rider',()=>{
  const c=createCharacter(),p=platform(),q={...platform(),id:'a'};advance(c,[p,q],1);assert.equal(c.supportId,'a');
  const before=structuredClone(c);stepCharacterPlatforms(c,{jump:true,crouch:true},0,config,[p]);assert.deepEqual(c,before);
  for(const world of [[p,p],[{...p,displacement:[NaN,0,0]}],[{...p,box:{min:[0,0,0],max:[-1,1,1]}}]])assert.throws(()=>stepCharacterPlatforms(c,{},dt,config,world));
  assert.deepEqual(c,before);assert.throws(()=>stepCharacterPlatforms(c,{move:[Infinity,0]},dt,config,[p]));assert.deepEqual(c,before);
});
test('relative movement detects a fast kinematic wall crossing a stationary body',()=>{
  const wall={id:'wall',box:aabb([-5.02,-2,-2],[-5,2,2]),displacement:[10,0,0]};
  const r=moveAndSlideMovingAABB([0,0,0],[0,0,0],.01,[.35,.9,.35],[wall]);
  assert.equal(r.truncated,false);near(r.position[0],5.35);near(r.velocity[0],1000);assert.equal(r.contacts[0].id,'wall');
});
test('opposing surfaces report an unresolved tick rather than allowing penetration',()=>{
  const left={id:'left',box:aabb([-2,-2,-2],[-1,2,2]),displacement:[2,0,0]},right={id:'right',box:aabb([1,-2,-2],[2,2,2])};
  const r=moveAndSlideMovingAABB([0,0,0],[0,0,0],1,[.35,.9,.35],[left,right]);assert.equal(r.truncated,true);assert.ok(r.fraction<1);assert.ok(r.position[0]<.66);
  const overlap=moveAndSlideMovingAABB([-1.5,0,0],[0,0,0],dt,[.35,.9,.35],[left]);assert.equal(overlap.truncated,true);assert.equal(overlap.fraction,0);
});
test('moving body queries validate geometry/motion and return independent data',()=>{
  const p=platform([dt,0,0]),position=[0,.9,0],velocity=[1,0,0],before=structuredClone(p);
  const r=moveAndSlideMovingAABB(position,velocity,dt,[.35,.9,.35],[p]);r.position[0]=100;assert.deepEqual(position,[0,.9,0]);assert.deepEqual(p,before);
  assert.throws(()=>moveAndSlideMovingAABB(position,velocity,dt,[.35,.9,.35],[p,p]));
  assert.throws(()=>moveAndSlideMovingAABB(position,velocity,dt,[.35,.9,.35],[{...p,displacement:[Infinity,0,0]}]));
  assert.throws(()=>moveAndSlideMovingAABB(position,velocity,dt,[.35,.9,.35],[p],100));
  assert.deepEqual(moveAndSlideMovingAABB(position,velocity,0,[.35,.9,.35],[p]).position,position);
});
