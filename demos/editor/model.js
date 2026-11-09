// SPDX-License-Identifier: Apache-2.0
// VANILLAJS visual editor project model. Pure JS, explicit owned snapshots.
// Experimental box-only hierarchy: +Y up, rotation about Y, local TRS.
const MAX_OBJECTS=128,MAX_DEPTH=16,MAX_COORD=1000,MAX_SCALE=100,MAX_NAME=64;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const exactKeys=(obj,keys,label)=>{
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||
     Object.keys(obj).some(k=>!keys.includes(k))||
     keys.some(k=>!own(obj,k)))throw new TypeError(label+' keys invalid');
};
const bounded=(x,label,min,max)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)
    throw new RangeError(label+' must be finite in ['+min+','+max+']');
  return x;
};
const vector=(a,label,min,max)=>{
  if(!Array.isArray(a)||a.length!==3)throw new TypeError(label+' requires XYZ');
  return a.map((x,i)=>bounded(x,label+'['+i+']',min,max));
};
const text=(s,label,max)=>{
  if(typeof s!=='string'||!s.trim()||s.length>max||/[\u0000-\u001f\u007f]/.test(s))
    throw new TypeError(label+' must be a bounded printable string');
  return s;
};
const idPattern=/^entity-[1-9][0-9]{0,5}$/;
const fields=['id','name','parent','position','rotationY','scale','color','body','visible'];
function normalize(entity){
  exactKeys(entity,fields,'entity');
  if(!idPattern.test(entity.id))throw new TypeError('invalid entity id');
  text(entity.name,'entity name',MAX_NAME);
  if(entity.parent!==null&&(!idPattern.test(entity.parent)||entity.parent===entity.id))
    throw new TypeError('invalid parent id');
  if(!['static','dynamic','player'].includes(entity.body))
    throw new TypeError('unknown body type');
  if(typeof entity.visible!=='boolean')throw new TypeError('visible must be boolean');
  return {id:entity.id,name:entity.name,parent:entity.parent,
    position:vector(entity.position,'position',-MAX_COORD,MAX_COORD),
    rotationY:bounded(entity.rotationY,'rotationY',-360000,360000),
    scale:vector(entity.scale,'scale',.01,MAX_SCALE),
    color:vector(entity.color,'color',0,1),
    body:entity.body,visible:entity.visible};
}
export function validateScene(input){
  exactKeys(input,['schemaVersion','name','nextId','objects'],'scene');
  if(input.schemaVersion!==1)throw new RangeError('unsupported scene schema');
  text(input.name,'scene name',MAX_NAME);
  if(!Number.isSafeInteger(input.nextId)||input.nextId<1||input.nextId>999999)
    throw new RangeError('invalid nextId');
  if(!Array.isArray(input.objects)||input.objects.length>MAX_OBJECTS)
    throw new RangeError('too many scene entities');
  const objects=input.objects.map(normalize),ids=new Map(objects.map(e=>[e.id,e]));
  if(ids.size!==objects.length)throw new TypeError('duplicate entity ids');
  for(const e of objects)if(e.parent!==null&&!ids.has(e.parent))
    throw new TypeError('parent does not exist');
  const done=new Set(),active=new Set();
  function visit(id,depth){
    if(depth>MAX_DEPTH)throw new RangeError('scene hierarchy too deep');
    if(active.has(id))throw new TypeError('parent cycle detected');
    if(done.has(id))return;
    active.add(id);
    const e=ids.get(id);
    if(e.parent!==null)visit(e.parent,depth+1);
    active.delete(id);done.add(id);
  }
  for(const id of ids.keys())visit(id,0);
  if(objects.some(e=>Number(e.id.slice(7))>=input.nextId))
    throw new RangeError('nextId would reuse an entity id');
  if(objects.filter(e=>e.body==='player').length>1)throw new TypeError('only one player allowed');
  if(objects.some(e=>e.body!=='static'&&e.parent!==null))
    throw new TypeError('physics bodies must be root entities in editor v0.1');
  return {schemaVersion:1,name:input.name,nextId:input.nextId,objects};
}
const entity=(id,name,position,scale,color,body='static')=>({
  id:'entity-'+id,name,parent:null,position,rotationY:0,scale,color,body,visible:true
});
export function createScene(){
  return validateScene({schemaVersion:1,name:'New World',nextId:5,objects:[
    entity(1,'Ground',[0,-.35,0],[16,.7,16],[.22,.32,.40]),
    entity(2,'Platform',[-2,.65,-1],[3,.5,3],[.3,.68,.64]),
    entity(3,'Player',[0,2.5,2],[.75,1.2,.75],[.98,.70,.36],'player'),
    entity(4,'Beacon',[3,1,-3],[1.1,2,1.1],[.86,.35,.53])
  ]});
}
export function addEntity(scene,{parent=null,name='Cube'}={}){
  const s=validateScene(scene);
  if(s.objects.length>=MAX_OBJECTS||s.nextId>=999999)throw new RangeError('scene capacity exhausted');
  if(parent!==null&&!s.objects.some(e=>e.id===parent))throw new TypeError('missing parent');
  const next=entity(s.nextId,text(name,'name',MAX_NAME),[0,1,0],[1,1,1],[.37,.78,.93]);
  next.parent=parent;
  s.objects.push(next);s.nextId++;
  return validateScene(s);
}
export function updateEntity(scene,id,changes){
  const s=validateScene(scene),i=s.objects.findIndex(e=>e.id===id);
  if(i<0)throw new TypeError('unknown entity');
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||
      Object.keys(changes).some(k=>!fields.includes(k)||k==='id'))
    throw new TypeError('invalid edit fields');
  s.objects[i]={...s.objects[i],...changes};
  return validateScene(s);
}
export function removeEntity(scene,id){
  const s=validateScene(scene);
  if(!s.objects.some(e=>e.id===id))throw new TypeError('unknown entity');
  const deleted=new Set([id]);let changed=true;
  while(changed){changed=false;for(const e of s.objects)if(deleted.has(e.parent)&&!deleted.has(e.id)){
    deleted.add(e.id);changed=true;
  }}
  s.objects=s.objects.filter(e=>!deleted.has(e.id));
  return validateScene(s);
}
export function duplicateEntity(scene,id){
  const s=validateScene(scene);
  if(!s.objects.some(e=>e.id===id))throw new TypeError('unknown entity');
  const subtree=[],ids=new Set([id]);let changed=true;
  while(changed){changed=false;for(const e of s.objects)if(ids.has(e.parent)&&!ids.has(e.id)){
    ids.add(e.id);changed=true;
  }}
  for(const e of s.objects)if(ids.has(e.id))subtree.push(e);
  if(s.objects.length+subtree.length>MAX_OBJECTS||
     s.nextId+subtree.length>=999999)throw new RangeError('duplicate exceeds capacity');
  const map=new Map(subtree.map((e,i)=>[e.id,'entity-'+(s.nextId+i)]));
  for(const e of subtree){
    const n={...e,id:map.get(e.id),name:e.name+' Copy',
      parent:map.get(e.parent)??e.parent,position:[...e.position],
      scale:[...e.scale],color:[...e.color]};
    if(n.name.length>MAX_NAME)n.name=n.name.slice(0,MAX_NAME);
    if(n.body==='player')n.body='dynamic';
    s.objects.push(n);
  }
  s.nextId+=subtree.length;
  return {scene:validateScene(s),selected:map.get(id)};
}
export function sceneWorld(scene){
  const s=validateScene(scene),byId=new Map(s.objects.map(e=>[e.id,e])),memo=new Map();
  function world(e){
    if(memo.has(e.id))return memo.get(e.id);
    let position=[...e.position],scale=[...e.scale],rotationY=e.rotationY;
    if(e.parent!==null){
      const p=world(byId.get(e.parent)),a=p.rotationY*Math.PI/180,
        c=Math.cos(a),sin=Math.sin(a),t=e.position.map((x,i)=>x*p.scale[i]);
      position=[p.position[0]+t[0]*c+t[2]*sin,p.position[1]+t[1],
        p.position[2]-t[0]*sin+t[2]*c];
      scale=scale.map((x,i)=>x*p.scale[i]);rotationY+=p.rotationY;
    }
    const result={...e,position,scale,rotationY};
    memo.set(e.id,result);return result;
  }
  return s.objects.map(world);
}
export function serializeScene(scene){return JSON.stringify(validateScene(scene),null,2)+'\n';}
export function parseScene(source){
  if(typeof source!=='string'||source.length>128*1024)
    throw new RangeError('scene file exceeds 128 KiB');
  return validateScene(JSON.parse(source));
}
export function makeHistory(scene){
  return {past:[],present:validateScene(scene),future:[]};
}
export function commitHistory(history,scene){
  const present=validateScene(scene);
  if(serializeScene(history.present)===serializeScene(present))return history;
  return {past:[...history.past.slice(-63),history.present],present,future:[]};
}
export function undoHistory(history){
  if(!history.past.length)return history;
  return {past:history.past.slice(0,-1),present:history.past.at(-1),
    future:[history.present,...history.future]};
}
export function redoHistory(history){
  if(!history.future.length)return history;
  return {past:[...history.past.slice(-63),history.present],
    present:history.future[0],future:history.future.slice(1)};
}
