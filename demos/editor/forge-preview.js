// SPDX-License-Identifier: Apache-2.0
// Component Forge: component-driven, bounded, deterministic 60Hz preview.
// Uses the reusable VANILLAJS continuous AABB slide kernel for collision.
// Rotated boxes, dynamic-dynamic contacts, and editor cameras are outside v1.5 scope.
import {sceneWorld,validateScene} from './model.js';
import {moveAndSlideAABB} from '../../modules/collision/index.js';
export const FORGE_DT=1/60;
const clamp=(x,a,b)=>Math.min(Math.max(x,a),b);
const VALID_INPUT=new Set([-1,0,1]);
function checkInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).some(k=>!['x','z','jump'].includes(k))||
      !VALID_INPUT.has(input.x??0)||!VALID_INPUT.has(input.z??0)||
      (input.jump!==undefined&&typeof input.jump!=='boolean'))
    throw new TypeError('invalid forge controls');
}
function worldOf(scene){
  const s=validateScene(scene);
  if(s.schemaVersion!==2)throw new TypeError('Forge preview requires schemaVersion 2');
  return sceneWorld(s);
}
const axisBox=e=>({
  id:e.id,
  min:e.position.map((v,i)=>v-e.scale[i]*.5),
  max:e.position.map((v,i)=>v+e.scale[i]*.5)
});
function staticColliders(world){
  return world.filter(e=>e.visible&&e.components.collider.enabled&&
    e.components.rigidbody.mode==='static'&&e.rotationY%180===0)
    .map(axisBox);
}
function triggerSet(world,pos,extent,exclude){
  const hit=[];
  for(const e of world){
    if(!e.visible||!e.components.trigger.enabled||e.id===exclude||
       e.rotationY%180!==0)continue;
    if([0,1,2].every(i=>Math.abs(pos[i]-e.position[i])<=
      extent[i]+e.scale[i]*.5))hit.push(e.id);
  }
  return hit.sort();
}
export function createForgePreview(scene){
  const world=worldOf(scene),bodies={};
  for(const e of world)if(e.visible&&e.components.rigidbody.mode==='dynamic'){
    bodies[e.id]={position:[...e.position],velocity:[0,0,0],
      grounded:false,insideTriggers:[]};
  }
  return {tick:0,bodies,events:[]};
}
export function stepForgePreview(scene,state,input={}){
  checkInput(input);
  if(!state||!Number.isSafeInteger(state.tick)||state.tick<0||state.tick>=36000||
     !state.bodies||typeof state.bodies!=='object')
    throw new RangeError('invalid or exhausted forge preview state');
  const world=worldOf(scene),obstacles=staticColliders(world).map(({min,max})=>({min,max})),
    byId=new Map(world.map(e=>[e.id,e]));
  const bodies={},events=[];
  for(const e of world){
    if(!e.visible||e.components.rigidbody.mode!=='dynamic')continue;
    const old=state.bodies[e.id];
    if(!old||!Array.isArray(old.position)||!Array.isArray(old.velocity)||
       !Array.isArray(old.insideTriggers))throw new TypeError('missing or corrupt preview body');
    const nextVelocity=[...old.velocity],ctrl=e.components.controller;
    if(ctrl.enabled){
      nextVelocity[0]=(input.x??0)*ctrl.speed;
      nextVelocity[2]=(input.z??0)*ctrl.speed;
      if(old.grounded&&input.jump)nextVelocity[1]=ctrl.jumpImpulse;
    }
    nextVelocity[1]-=15*e.components.rigidbody.gravityScale*FORGE_DT;
    const half=e.scale.map(v=>v*.5),swept=moveAndSlideAABB(
      old.position,nextVelocity,FORGE_DT,half,
      obstacles,6
    );
    if(swept.truncated)throw new RangeError('preview collision solve truncated');
    const position=swept.position.map(v=>clamp(v,-995,995));
    const grounded=swept.contacts.some(c=>c.normal[1]>0);
    const insideTriggers=triggerSet(world,position,half,e.id);
    const oldInside=new Set(old.insideTriggers);
    for(const triggerId of insideTriggers)if(!oldInside.has(triggerId)){
      events.push({type:'trigger-enter',entityId:e.id,triggerId,
        tag:byId.get(triggerId).components.trigger.tag,tick:state.tick+1});
    }
    bodies[e.id]={position,velocity:swept.velocity,grounded,insideTriggers};
  }
  return {tick:state.tick+1,bodies,events};
}
