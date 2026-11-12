// SPDX-License-Identifier: Apache-2.0
// Original data-only loop recipe over the existing cardinal checkpoint contract.
import {MOD_PACK_KIND} from '../../modules/mod-sdk/index.js';
import {COURSE_ENTRY_KIND} from '../../modules/mod-course/index.js';
import {compileCircuitQ16} from '../../modules/exact-circuit/index.js';
export function buildLoopPack({width=80,depth=60,aperture=16,laps=2}={}){
  for(const [name,value,min,max] of [['width',width,40,400],['depth',depth,40,400],['aperture',aperture,4,30],['laps',laps,1,9]])
    if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(`${name} must be a whole number from ${min} to ${max}`);
  const gate=(id,x,z,axis,direction)=>({id,x:String(x),y:'8',z:String(z),width:String(aperture),height:'14',axis,direction});
  const course={id:'my-loop',version:2,laps,spawn:['0','8','0'],gates:[
    gate('east',width/2,0,'x',1),gate('north',width,-depth/2,'z',-1),
    gate('west',width/2,-depth,'x',-1),gate('south',0,-depth/2,'z',1)
  ],obstacles:[]};
  compileCircuitQ16(course);
  return {kind:MOD_PACK_KIND,id:'my-circuit',version:'1.0.0',requires:[],entries:[{id:'circuit',kind:'data',data:{kind:COURSE_ENTRY_KIND,course}}]};
}
export function firstGateSweep(course){
  const gate=course.gates[0],axis=gate.axis==='x'?0:2,side=axis===0?2:0;
  const from=[0,(gate.bottomRaw+gate.topRaw)/2,0],to=[...from];
  from[side]=to[side]=gate.sideRaw;
  from[axis]=gate.planeRaw-gate.direction*65536;
  to[axis]=gate.planeRaw+gate.direction*65536;
  return {from,to};
}
