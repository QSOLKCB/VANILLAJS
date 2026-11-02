import test from 'node:test';
import assert from 'node:assert/strict';
import {aabb,sweepAABB,moveAndSlideAABB} from '../modules/collision/index.js';
import {createCharacter,characterConfig,stepCharacter,lookCharacter,characterView} from '../modules/character/index.js';
import {rotate,length} from '../modules/math/index.js';
const dt=1/120,config=characterConfig(),floor=aabb([-20,-1,-50],[20,0,20]);
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const advance=(body,count,input={},boxes=[floor],settings=config)=>{let steps=0;for(let i=0;i<count;i++)steps+=Number(stepCharacter(body,input,dt,settings,boxes).stepped);return steps;};
test('rectangular sweeps use independent horizontal and vertical extents',()=>{
  const wall=aabb([5,-3,-2],[5.02,3,2]);const hit=sweepAABB([0,0,0],[10,0,0],[.35,.9,.35],wall);
  near(hit.time,.465);assert.deepEqual(hit.normal,[-1,0,0]);
  const fall=moveAndSlideAABB([0,5,0],[0,-1000,0],dt,[.35,.9,.35],[floor]);near(fall.position[1],.9);near(fall.velocity[1],0);
  assert.throws(()=>sweepAABB([0,0,0],[1,0,0],[.3,0,.3],wall));
  assert.throws(()=>moveAndSlideAABB([0,0,0],[1,0,0],Infinity,[.3,.9,.3],[wall]));
});
test('standing remains grounded without sinking; camera stays inside the upright collider',()=>{
  const body=createCharacter();advance(body,600);near(body.position[1],0);assert.equal(body.grounded,true);near(body.velocity[1],0);
  const view=characterView(body);near(view.position[1],body.position[1]+1.62);near(length(view.orientation),1);
});
test('jump has a finite apex, no midair jump, and lands back on support',()=>{
  const body=createCharacter();advance(body,1);stepCharacter(body,{jump:true},dt,config,[floor]);assert.ok(body.velocity[1]>6);
  let apex=0;for(let i=0;i<120;i++){stepCharacter(body,{jump:i===15},dt,config,[floor]);apex=Math.max(apex,body.position[1]);}
  assert.ok(apex>1.1 && apex<1.3);assert.equal(body.grounded,true);near(body.position[1],0);
});
test('WASD is yaw-relative and independent of pitch; diagonal motion has no speed boost',()=>{
  const straight=createCharacter(),diagonal=createCharacter();advance(straight,240,{move:[0,-1]});advance(diagonal,240,{move:[1,-1]});
  near(Math.hypot(...[straight.velocity[0],straight.velocity[2]]),5);near(Math.hypot(diagonal.velocity[0],diagonal.velocity[2]),5);
  const turned=createCharacter();lookCharacter(turned,{yaw:-Math.PI/2,pitch:1.4});advance(turned,120,{move:[0,-1]});
  assert.ok(turned.position[0]>4);near(turned.position[2],0);near(turned.position[1],0);
  const forward=rotate(characterView(turned).orientation,[0,0,-1]);assert.ok(forward[0]>0 && forward[1]>.9);
});
test('sprint accelerates to its cap; release brakes on the ground',()=>{
  const body=createCharacter();advance(body,120,{move:[0,-1],sprint:true});near(body.velocity[2],-8);
  advance(body,60);near(body.velocity[2],0);
});
test('grounded controller climbs successive allowed stairs without jumping',()=>{
  const boxes=[floor,aabb([-2,0,-2],[2,.25,0]),aabb([-2,0,-4],[2,.5,-2]),aabb([-2,0,-8],[2,.75,-4])];
  const body=createCharacter({position:[0,0,2]});const steps=advance(body,180,{move:[0,-1]},boxes);
  assert.ok(steps>=3);assert.ok(body.position[2]<-4);near(body.position[1],.75);assert.equal(body.grounded,true);
});
test('a tall wall and a low ceiling both reject step-up attempts',()=>{
  const tall=aabb([-2,0,-3],[2,.5,0]),body=createCharacter({position:[0,0,2]});advance(body,180,{move:[0,-1]},[floor,tall]);
  assert.ok(body.position[2]>=.35);near(body.position[1],0);
  const low=aabb([-2,1.9,-3],[2,3,2]),short=aabb([-2,0,-3],[2,.25,0]),blocked=createCharacter({position:[0,0,2]});
  advance(blocked,180,{move:[0,-1]},[floor,low,short]);assert.ok(blocked.position[2]>=.35);near(blocked.position[1],0);
});
test('jumping into a ceiling cancels upward velocity without clipping through it',()=>{
  const ceiling=aabb([-4,2,-4],[4,3,4]),body=createCharacter();advance(body,1,{},[floor,ceiling]);
  stepCharacter(body,{jump:true},dt,config,[floor,ceiling]);let max=0;
  for(let i=0;i<120;i++){stepCharacter(body,{},dt,config,[floor,ceiling]);max=Math.max(max,body.position[1]);}
  assert.ok(max<=.2+1e-5);assert.equal(body.grounded,true);
});
test('leaving a ledge removes support; snap cannot bridge a large drop or allow an air jump',()=>{
  const platform=aabb([-2,-1,-1],[2,0,2]),body=createCharacter();advance(body,80,{move:[0,-1]},[platform]);
  assert.ok(body.position[2]<-2);assert.equal(body.grounded,false);assert.ok(body.position[1]<-.3);
  const before=body.velocity[1];stepCharacter(body,{jump:true},dt,config,[platform]);assert.ok(body.velocity[1]<before);
});
test('small downward steps snap to ground while a jump remains free of snapping',()=>{
  const step=aabb([-2,0,-1],[2,.1,2]),body=createCharacter({position:[0,.1,0]});advance(body,50,{move:[0,-1]},[floor,step]);
  near(body.position[1],0);assert.equal(body.grounded,true);stepCharacter(body,{jump:true},dt,config,[floor,step]);assert.ok(body.position[1]>.04);
});
test('high speed cannot tunnel through a thin wall; glancing contact permits sliding',()=>{
  const wall=aabb([0,0,-20],[.02,5,20]),body=createCharacter({position:[-10,0,0],velocity:[10000,0,-5]});
  stepCharacter(body,{},dt,characterConfig({groundAcceleration:0}),[floor,wall]);assert.ok(body.position[0]<=-.35);assert.ok(body.position[2]<0);
});
test('invalid character inputs fail without mutation; zero ticks are inert and pitch is bounded',()=>{
  assert.throws(()=>createCharacter({eyeHeight:2}));assert.throws(()=>characterConfig({gravity:0}));
  const body=createCharacter(),before=structuredClone(body);assert.throws(()=>stepCharacter(body,{move:[NaN,0]},dt,config,[floor]));assert.deepEqual(body,before);
  assert.throws(()=>stepCharacter(body,{},.1,config,[floor]));assert.deepEqual(body,before);
  assert.throws(()=>lookCharacter(body,{yaw:NaN}));assert.deepEqual(body,before);stepCharacter(body,{jump:true},0,config,[floor]);assert.deepEqual(body,before);
  lookCharacter(body,{pitch:100});assert.ok(body.pitch<Math.PI/2);lookCharacter(body,{pitch:-200});assert.ok(body.pitch>-Math.PI/2);
});
