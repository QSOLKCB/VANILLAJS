import test from 'node:test';
import assert from 'node:assert/strict';
import {createBody,flightConfig,integrateBody,stepFlight} from '../modules/flight/index.js';
import {length,integrateOrientation} from '../modules/math/index.js';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} ≠ ${b}`);
test('constant force obeys F=ma; semi-implicit position stays within one step of analytic motion',()=>{
  const b=createBody({mass:2});for(let i=0;i<240;i++)integrateBody(b,{force:[8,0,0]},1/120);
  near(b.velocity[0],8);near(b.position[0],8, .04);
});
test('torque uses body inertia',()=>{
  const b=createBody({inertia:[2,2,2]});for(let i=0;i<120;i++)integrateBody(b,{torque:[0,4,0]},1/120);
  near(b.angularVelocity[1],2);
});
test('inertial flight coasts without hidden damping or speed cap',()=>{
  const b=createBody({velocity:[10,0,-100],angularVelocity:[0,.7,0]}),c=flightConfig();
  for(let i=0;i<120;i++)stepFlight(b,{},1/120,c);
  near(b.position[0],10);near(b.position[2],-100);near(b.velocity[2],-100);near(b.angularVelocity[1],.7);
});
test('local forward thrust rotates into world space',()=>{
  const b=createBody({orientation:integrateOrientation([0,0,0,1],[0,Math.PI/2,0],1)});
  stepFlight(b,{thrust:[0,0,-1]},.05,flightConfig({acceleration:20}));near(b.velocity[0],-1);near(b.velocity[2],0);
});
test('assistance brakes translation and rotation when input is released',()=>{
  const b=createBody({velocity:[15,0,0],angularVelocity:[0,1,0]});
  for(let i=0;i<600;i++)stepFlight(b,{},1/120,flightConfig({assisted:true}));
  assert.ok(length(b.velocity)<.001);assert.ok(length(b.angularVelocity)<.001);
});
test('explicit braking damps inertial velocity; diagonal thrust has no extra acceleration',()=>{
  const b=createBody({velocity:[10,0,0]});for(let i=0;i<120;i++)stepFlight(b,{brake:true},1/120,flightConfig());
  near(length(b.velocity),10*Math.exp(-4));
  const d=createBody();stepFlight(d,{thrust:[1,1,1]},.05,flightConfig({acceleration:20}));near(length(d.velocity),1);
});
test('orientation stays normalized under sustained multi-axis rotation',()=>{
  const b=createBody({angularVelocity:[.4,.8,-.2]});for(let i=0;i<12000;i++)integrateBody(b,{},1/120);
  near(length(b.orientation),1);near(length(b.angularVelocity),Math.sqrt(.84));
});
test('asymmetric inertia includes the gyroscopic term',()=>{
  const b=createBody({inertia:[1,2,3],angularVelocity:[1,2,3]});integrateBody(b,{},.001);
  near(b.angularVelocity[0],.994);near(b.angularVelocity[1],2.003);near(b.angularVelocity[2],3-2/3*.001);
});
test('invalid body, config and steps fail before integration',()=>{
  assert.throws(()=>createBody({mass:0}));assert.throws(()=>createBody({inertia:[1,0,1]}));assert.throws(()=>flightConfig({acceleration:NaN}));
  const b=createBody(),before=structuredClone(b);assert.throws(()=>stepFlight(b,{},1,flightConfig()));assert.deepEqual(b,before);
  stepFlight(b,{},0,flightConfig());assert.deepEqual(b,before);
});
