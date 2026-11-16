// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {starterHorizonProject,validateHorizonProject,parseHorizonProject,serializeHorizonProject,HORIZON_PROJECT_BYTES} from '../demos/horizon-lab/project.js';
test('HORIZON authoring project roundtrips original scenery and supplied visual rig as inert owned data',()=>{
  const source=structuredClone(starterHorizonProject());source.name='<original coastline>';
  const result=parseHorizonProject(serializeHorizonProject(source));assert.deepEqual(result,source);assert.notEqual(result.scenery,source.scenery);
  source.vehicle.paint[0]=0;assert.notEqual(result.vehicle.paint[0],0);source.scenery.road[0].y+=1;assert.notEqual(result.scenery.road[0].y,source.scenery.road[0].y);
  assert.equal(result.format,'qsol.vanillajs.horizon-lab.v1');assert.equal(result.version,1);
});
test('HORIZON project rejects executable/unknown/prototype/accessor data without running getters',()=>{
  let reads=0;const source=starterHorizonProject();Object.defineProperty(source,'name',{get(){reads++;return 'wrong';},enumerable:true});assert.throws(()=>validateHorizonProject(source));assert.equal(reads,0);
  for(const patch of [{format:'wrong'},{version:2},{script:'alert(1)'},{name:''},{name:' bad'},{name:'a\nname'}])assert.throws(()=>validateHorizonProject({...starterHorizonProject(),...patch}));
  const p=starterHorizonProject();Object.setPrototypeOf(p.vehicle,{malicious:true});assert.throws(()=>validateHorizonProject(p));
  const a=starterHorizonProject();Object.defineProperty(a.vehicle.paint,'0',{get(){reads++;return 1;},enumerable:true});assert.throws(()=>validateHorizonProject(a));assert.equal(reads,0);
});
test('HORIZON visual controls preserve numerical and resource limits',()=>{
  for(const [field,value] of [['classId','remote-car'],['roughness',0],['metalness',1.01],['steer',Infinity],['wheelSpin',7],['compression',[.3,0,0,0]],['pitch',.2],['roll',NaN],['brake',2],['paint',[1,2,3]]]){
    const p=starterHorizonProject();p.vehicle[field]=value;assert.throws(()=>validateHorizonProject(p),field);
  }
  for(const [field,value] of [['azimuth',4],['elevation',0],['fogDensity',-.01]]){const p=starterHorizonProject();p.lighting[field]=value;assert.throws(()=>validateHorizonProject(p),field);}
});
test('HORIZON project composes strict scenic validation and rejects oversize text',()=>{
  const p=starterHorizonProject(),before=serializeHorizonProject(p),bad=structuredClone(p);bad.scenery.road[1].bank=1;
  assert.throws(()=>validateHorizonProject(bad));assert.equal(serializeHorizonProject(p),before);
  assert.throws(()=>parseHorizonProject(' '.repeat(HORIZON_PROJECT_BYTES+1)));assert.throws(()=>parseHorizonProject('{bad json}'));
  const accepted=structuredClone(p);accepted.vehicle.compression=[.2,.1,.15,0];accepted.vehicle.steer=.62;accepted.lighting.fogDensity=.03;assert.deepEqual(validateHorizonProject(accepted),accepted);
});
