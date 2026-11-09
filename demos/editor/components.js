// SPDX-License-Identifier: Apache-2.0
// Component Forge v1: versioned, bounded, data-only component contracts.
// No DOM, I/O, dynamic code execution or module/plugin loading.
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function exact(o,keys,name){
  if(!o||typeof o!=='object'||Array.isArray(o)||
     Object.keys(o).length!==keys.length||
     keys.some(k=>!own(o,k)))throw new TypeError(name+' contains missing or unknown fields');
}
function finite(n,name,min,max){
  if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)
    throw new RangeError(name+' out of bounded range');
  return n;
}
function bool(value,name){
  if(typeof value!=='boolean')throw new TypeError(name+' must be boolean');
  return value;
}
export const COMPONENT_KINDS=Object.freeze([
  'mesh','collider','rigidbody','controller','trigger','camera'
]);
export function defaultComponents(body='static'){
  if(!['static','dynamic','player'].includes(body))throw new TypeError('invalid legacy body');
  return {
    mesh:{enabled:true},
    collider:{enabled:true},
    rigidbody:{mode:body==='static'?'static':'dynamic',gravityScale:1},
    controller:{enabled:body==='player',speed:4,jumpImpulse:6.2},
    trigger:{enabled:false,tag:'checkpoint'},
    camera:{enabled:false,fov:70}
  };
}
export function normalizeComponents(value){
  exact(value,COMPONENT_KINDS,'components');
  const mesh=value.mesh;exact(mesh,['enabled'],'MeshRenderer');
  const collider=value.collider;exact(collider,['enabled'],'Collider');
  const rigidbody=value.rigidbody;exact(rigidbody,['mode','gravityScale'],'Rigidbody');
  const controller=value.controller;exact(controller,['enabled','speed','jumpImpulse'],'PlayerController');
  const trigger=value.trigger;exact(trigger,['enabled','tag'],'Trigger');
  const camera=value.camera;exact(camera,['enabled','fov'],'Camera');
  if(!['static','dynamic'].includes(rigidbody.mode))throw new TypeError('invalid Rigidbody mode');
  if(typeof trigger.tag!=='string'||trigger.tag.length>48||
     !/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/.test(trigger.tag))
    throw new TypeError('invalid Trigger tag');
  return {
    mesh:{enabled:bool(mesh.enabled,'mesh.enabled')},
    collider:{enabled:bool(collider.enabled,'collider.enabled')},
    rigidbody:{mode:rigidbody.mode,gravityScale:finite(rigidbody.gravityScale,'gravityScale',0,10)},
    controller:{enabled:bool(controller.enabled,'controller.enabled'),
      speed:finite(controller.speed,'controller.speed',0,40),
      jumpImpulse:finite(controller.jumpImpulse,'controller.jumpImpulse',0,30)},
    trigger:{enabled:bool(trigger.enabled,'trigger.enabled'),tag:trigger.tag},
    camera:{enabled:bool(camera.enabled,'camera.enabled'),
      fov:finite(camera.fov,'camera.fov',25,120)}
  };
}
export function bodyForComponents(c){
  const components=normalizeComponents(c);
  return components.controller.enabled?'player':
    components.rigidbody.mode==='static'?'static':'dynamic';
}
export function reconcileComponentsForBody(c,body){
  const components=normalizeComponents(c);
  if(!['static','dynamic','player'].includes(body))throw new TypeError('invalid body');
  components.rigidbody.mode=body==='static'?'static':'dynamic';
  components.controller.enabled=body==='player';
  return normalizeComponents(components);
}
export function patchComponent(c,kind,changes){
  const original=normalizeComponents(c);
  if(!COMPONENT_KINDS.includes(kind))throw new TypeError('unknown component');
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||
     Object.keys(changes).some(k=>!own(original[kind],k)))
    throw new TypeError('invalid component patch');
  original[kind]={...original[kind],...changes};
  // The authored body role is derived from the two components.
  if(kind==='controller'&&original.controller.enabled)
    original.rigidbody.mode='dynamic';
  if(kind==='rigidbody'&&original.rigidbody.mode==='static')
    original.controller.enabled=false;
  return normalizeComponents(original);
}
