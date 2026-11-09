// SPDX-License-Identifier: Apache-2.0
// Asset Foundry v1.6 alpha: owned local project assets and explicit provenance.
// Pure data model; no network, DOM, ambient clock, code evaluation or dependencies.
import {validateScene} from './model.js';
import {reconcileComponentsForBody} from './components.js';

export const MAX_PROJECT_BYTES=256*1024;
export const MAX_MESH_VERTICES=1536;
const LICENSES=['OWNER-LOCAL-ONLY','CC0-1.0','CC-BY-4.0','MIT','Apache-2.0'];
const assetId=/^asset-[1-9][0-9]{0,4}$/;
const entityId=/^entity-[1-9][0-9]{0,5}$/;
const exact=(obj,keys,what)=>{
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||
    Object.keys(obj).length!==keys.length||keys.some(k=>!Object.hasOwn(obj,k)))
    throw new TypeError(what+' must have exact fields');
};
const finite=(v,min,max,what)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)
    throw new RangeError('invalid '+what);
  return v;
};
function name(v){
  if(typeof v!=='string'||v.length<1||v.length>64||
    /[\u0000-\u001f\u007f]/.test(v))throw new TypeError('invalid asset name');
  return v;
}
function license(v){
  if(!LICENSES.includes(v))throw new TypeError('unsupported or undeclared asset license');
  return v;
}
function rgb(v){
  if(!Array.isArray(v)||v.length!==3)throw new TypeError('RGB triplet required');
  return v.map(x=>finite(x,0,1,'color'));
}
const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
export const licenses=()=>[...LICENSES];
export const createAssetLibrary=()=>({schemaVersion:1,nextId:1,assets:[],placements:[]});

export function parseOBJ(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>64*1024)
    throw new RangeError('OBJ must be <=64 KiB of text');
  const positions=[],uvs=[],output=[];
  const ref=(v,array,kind)=>{
    if(!/^-?[0-9]{1,6}$/.test(v))throw new TypeError('invalid OBJ '+kind+' index');
    const n=Number(v),i=n>0?n-1:array.length+n;
    if(n===0||i<0||i>=array.length)throw new RangeError('OBJ '+kind+' index out of range');
    return array[i];
  };
  for(const line of text.replaceAll('\r\n','\n').split('\n')){
    const clean=line.split('#',1)[0].trim();if(!clean)continue;
    const words=clean.split(/\s+/),key=words.shift();
    if(key==='v'){
      if(words.length!==3)throw new TypeError('OBJ positions must be XYZ');
      positions.push(words.map(x=>finite(Number(x),-100,100,'OBJ position')));
      if(positions.length>2048)throw new RangeError('too many OBJ source vertices');
    }else if(key==='vt'){
      if(words.length!==2)throw new TypeError('OBJ UV requires two values');
      uvs.push(words.map(x=>finite(Number(x),-100,100,'OBJ UV')));
      if(uvs.length>2048)throw new RangeError('too many OBJ UVs');
    }else if(key==='f'){
      if(words.length<3||words.length>8)throw new RangeError('OBJ faces must have 3..8 corners');
      const face=words.map(token=>{
        const fields=token.split('/');
        if(fields.length>3)throw new TypeError('invalid OBJ face token');
        const xyz=ref(fields[0],positions,'position'),
          uv=fields[1]?ref(fields[1],uvs,'UV'):[0,0];
        // Normals are not required by the flat-color first-party renderer.
        if(fields.length===3&&fields[2]&&!/^-?[0-9]{1,6}$/.test(fields[2]))
          throw new TypeError('invalid ignored OBJ normal index');
        return [...xyz,...uv];
      });
      for(let i=1;i<face.length-1;i++)output.push(...face[0],...face[i],...face[i+1]);
      if(output.length/5>MAX_MESH_VERTICES)throw new RangeError('OBJ triangle budget exceeded');
    }else if(['o','g','s','vn'].includes(key)){
      // Pure metadata/normals ignored by this explicitly flat-color subset.
    }else throw new TypeError('unsupported OBJ directive: '+key);
  }
  if(!output.length||output.length%15!==0)throw new TypeError('OBJ contains no usable triangles');
  return output;
}
function validateAsset(a){
  if(!assetId.test(a?.id))throw new TypeError('invalid asset identity');
  name(a.name);license(a.license);
  if(a.kind==='mesh'){
    exact(a,['id','kind','name','license','sourceName','sourceSha256','vertices'],'mesh');
    name(a.sourceName);
    if(!sha(a.sourceSha256))throw new TypeError('invalid mesh source digest');
    if(!Array.isArray(a.vertices)||!a.vertices.length||a.vertices.length%15!==0||
      a.vertices.length/5>MAX_MESH_VERTICES)throw new RangeError('invalid mesh triangles');
    for(let i=0;i<a.vertices.length;i++)
      finite(a.vertices[i],i%5<3?-100:-100,i%5<3?100:100,'mesh vertex');
  }else if(a.kind==='texture'){
    exact(a,['id','kind','name','license','sourceName','sourceSha256',
      'width','height','rgba'],'texture');
    name(a.sourceName);
    if(!sha(a.sourceSha256))throw new TypeError('invalid texture source digest');
    if(!Number.isSafeInteger(a.width)||!Number.isSafeInteger(a.height)||
      a.width<1||a.height<1||a.width>64||a.height>64)
      throw new RangeError('texture exceeds 64x64 canonical RGBA budget');
    if(typeof a.rgba!=='string'||a.rgba.length>22000||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.rgba)||
      atob(a.rgba).length!==a.width*a.height*4)
      throw new TypeError('invalid canonical texture bytes');
    const pixels=atob(a.rgba);
    for(let i=3;i<pixels.length;i+=4)if(pixels.charCodeAt(i)!==255)
      throw new TypeError('alpha textures unsupported by current opaque renderer');
  }else if(a.kind==='material'){
    exact(a,['id','kind','name','license','color','textureId'],'material');
    rgb(a.color);
    if(a.textureId!==null&&!assetId.test(a.textureId))throw new TypeError('invalid texture reference');
  }else if(a.kind==='prefab'){
    exact(a,['id','kind','name','license','objects'],'prefab');
    if(!Array.isArray(a.objects)||!a.objects.length||a.objects.length>32)
      throw new RangeError('invalid prefab object budget');
    for(let i=0;i<a.objects.length;i++){
      const o=a.objects[i];
      exact(o,['parentIndex','object','meshId','materialId'],'prefab object');
      if(o.parentIndex!==null&&(!Number.isInteger(o.parentIndex)||
        o.parentIndex<0||o.parentIndex>=i))throw new TypeError('prefab parents must precede children');
      if(o.meshId!==null&&!assetId.test(o.meshId))throw new TypeError('invalid prefab mesh ref');
      if(o.materialId!==null&&!assetId.test(o.materialId))throw new TypeError('invalid prefab material ref');
      // Canonical v2 entity shape is validated by the same scene validator.
      const entity={...o.object,id:'entity-'+(i+1),
        parent:o.parentIndex===null?null:'entity-'+(o.parentIndex+1)};
      const candidate={schemaVersion:2,name:'Prefab',nextId:i+2,objects:[entity]};
      if(entity.parent===null)validateScene(candidate);
      else {
        // Include placeholders for parents while validating the whole template below.
        name(entity.name);
      }
    }
    const items=a.objects.map((o,i)=>({...o.object,id:'entity-'+(i+1),
      parent:o.parentIndex===null?null:'entity-'+(o.parentIndex+1)}));
    validateScene({schemaVersion:2,name:'Prefab',nextId:items.length+1,objects:items});
  }else throw new TypeError('unknown asset kind');
  return structuredClone(a);
}
export function validateAssetLibrary(library,scene=null){
  exact(library,['schemaVersion','nextId','assets','placements'],'asset library');
  if(library.schemaVersion!==1||!Number.isSafeInteger(library.nextId)||
    library.nextId<1||library.nextId>99999)throw new RangeError('unsupported asset library version/ID');
  if(!Array.isArray(library.assets)||library.assets.length>32||
    !Array.isArray(library.placements)||library.placements.length>128)
    throw new RangeError('asset/placement budget exceeded');
  const assets=library.assets.map(validateAsset),map=new Map(assets.map(a=>[a.id,a]));
  if(map.size!==assets.length||assets.some(a=>Number(a.id.slice(6))>=library.nextId))
    throw new TypeError('duplicate or reused asset ID');
  for(const a of assets){
    if(a.kind==='material'&&a.textureId!==null&&
      map.get(a.textureId)?.kind!=='texture')throw new TypeError('unknown material texture');
    if(a.kind==='prefab')for(const o of a.objects){
      if(o.meshId!==null&&map.get(o.meshId)?.kind!=='mesh')
        throw new TypeError('missing prefab mesh asset');
      if(o.materialId!==null&&map.get(o.materialId)?.kind!=='material')
        throw new TypeError('missing prefab material asset');
    }
  }
  const placements=library.placements.map(p=>{
    exact(p,['entityId','meshId','materialId'],'placement');
    if(!entityId.test(p.entityId))throw new TypeError('invalid placement entity');
    if(p.meshId!==null&&map.get(p.meshId)?.kind!=='mesh')
      throw new TypeError('missing placement mesh');
    if(p.materialId!==null&&map.get(p.materialId)?.kind!=='material')
      throw new TypeError('missing placement material');
    return {...p};
  });
  if(new Set(placements.map(p=>p.entityId)).size!==placements.length)
    throw new TypeError('duplicate placement entity');
  if(scene){
    const s=validateScene(scene),ids=new Set(s.objects.map(e=>e.id));
    if(placements.some(p=>!ids.has(p.entityId)))throw new TypeError('dangling placement');
  }
  const out={schemaVersion:1,nextId:library.nextId,assets,placements};
  if(new TextEncoder().encode(JSON.stringify(out)).length>MAX_PROJECT_BYTES)
    throw new RangeError('asset library exceeds 256 KiB');
  return out;
}
function next(library,record){
  const l=validateAssetLibrary(library);
  if(l.assets.length>=32||l.nextId>=99999)throw new RangeError('asset capacity');
  const id='asset-'+l.nextId++;
  l.assets.push({id,...record});return {library:validateAssetLibrary(l),id};
}
const metadata=(nameValue,licenseValue,sourceName,sourceSha256)=>{
  name(nameValue);license(licenseValue);name(sourceName);
  if(!sha(sourceSha256))throw new TypeError('invalid source SHA-256');
  return {name:nameValue,license:licenseValue,sourceName,sourceSha256};
};
export function addMeshAsset(library,{name:label,license:lic,sourceName,sourceSha256,text}){
  return next(library,{kind:'mesh',...metadata(label,lic,sourceName,sourceSha256),
    vertices:parseOBJ(text)});
}
export function addTextureAsset(library,{name:label,license:lic,sourceName,sourceSha256,width,height,bytes}){
  if(!(bytes instanceof Uint8Array)||bytes.length!==width*height*4||
     bytes.length>16384)throw new RangeError('invalid RGBA bytes');
  const rgba=btoa(String.fromCharCode(...bytes));
  return next(library,{kind:'texture',...metadata(label,lic,sourceName,sourceSha256),
    width,height,rgba});
}
export function addMaterialAsset(library,{name:label,license:lic,color,textureId=null}){
  return next(library,{kind:'material',name:name(label),license:license(lic),
    color:rgb(color),textureId});
}
export function setPlacement(scene,library,entity,meshId=null,materialId=null){
  const s=validateScene(scene),l=validateAssetLibrary(library,s);
  if(!s.objects.some(e=>e.id===entity))throw new TypeError('unknown scene object');
  l.placements=l.placements.filter(p=>p.entityId!==entity);
  if(meshId!==null||materialId!==null)
    l.placements.push({entityId:entity,meshId,materialId});
  return validateAssetLibrary(l,s);
}
export function prunePlacements(scene,library){
  const ids=new Set(validateScene(scene).objects.map(e=>e.id)),
    l=validateAssetLibrary(library);
  l.placements=l.placements.filter(p=>ids.has(p.entityId));
  return validateAssetLibrary(l,scene);
}
export function addPrefabAsset(scene,library,root,nameValue,licenseValue){
  const s=validateScene(scene),l=validateAssetLibrary(library,s);
  if(s.schemaVersion!==2)throw new TypeError('prefabs require Component Forge v2 scenes');
  const selected=s.objects.find(e=>e.id===root);
  if(!selected)throw new TypeError('unknown prefab root');
  const subtree=new Set([root]);let changed=true;
  while(changed){changed=false;for(const e of s.objects)
    if(subtree.has(e.parent)&&!subtree.has(e.id)){subtree.add(e.id);changed=true;}}
  // Parent-first stable order even when source scene objects are interleaved.
  const items=[],pending=s.objects.filter(e=>subtree.has(e.id));
  while(pending.length){
    const index=pending.findIndex(e=>!subtree.has(e.parent)||
      items.some(parent=>parent.id===e.parent));
    if(index<0)throw new TypeError('invalid prefab dependency graph');
    items.push(pending.splice(index,1)[0]);
  }
  const indexes=new Map(items.map((e,i)=>[e.id,i]));
  const objects=items.map(e=>{
    const assignment=l.placements.find(p=>p.entityId===e.id);
    const {id,parent,...object}=structuredClone(e);
    return {parentIndex:indexes.get(parent)??null,object,
      meshId:assignment?.meshId??null,materialId:assignment?.materialId??null};
  });
  return next(l,{kind:'prefab',name:name(nameValue),license:license(licenseValue),objects});
}
export function instantiatePrefab(scene,library,prefabId){
  const s=validateScene(scene),l=validateAssetLibrary(library,s);
  if(s.schemaVersion!==2)throw new TypeError('prefab instantiation requires v2 scene');
  const prefab=l.assets.find(a=>a.id===prefabId&&a.kind==='prefab');
  if(!prefab)throw new TypeError('unknown prefab');
  if(s.objects.length+prefab.objects.length>128||s.nextId+prefab.objects.length>=999999)
    throw new RangeError('scene capacity');
  const ids=prefab.objects.map((_,i)=>'entity-'+(s.nextId+i));
  let playerExists=s.objects.some(e=>e.body==='player');
  for(let i=0;i<prefab.objects.length;i++){
    const entry=prefab.objects[i],object=structuredClone(entry.object);
    let body=object.body;
    if(body==='player'&&playerExists){
      body='dynamic';object.components=reconcileComponentsForBody(object.components,body);
    }
    if(body==='player')playerExists=true;
    s.objects.push({...object,id:ids[i],
      name:(object.name+' Instance').slice(0,64),body,
      parent:entry.parentIndex===null?null:ids[entry.parentIndex]});
    if(entry.meshId!==null||entry.materialId!==null)
      l.placements.push({entityId:ids[i],meshId:entry.meshId,materialId:entry.materialId});
  }
  s.nextId+=ids.length;
  return {scene:validateScene(s),library:validateAssetLibrary(l,s),selected:ids[0]};
}
export function serializeProject(scene,library){
  const s=validateScene(scene),l=validateAssetLibrary(library,s);
  const raw=JSON.stringify({format:'qsol.vanillajs.asset-project.v1',scene:s,library:l},null,2)+'\n';
  if(new TextEncoder().encode(raw).length>MAX_PROJECT_BYTES)
    throw new RangeError('project exceeds 256 KiB');
  return raw;
}
export function parseProject(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_PROJECT_BYTES)
    throw new RangeError('project exceeds 256 KiB');
  const value=JSON.parse(raw);
  exact(value,['format','scene','library'],'project');
  if(value.format!=='qsol.vanillajs.asset-project.v1')
    throw new TypeError('unknown asset project format');
  const scene=validateScene(value.scene),library=validateAssetLibrary(value.library,scene);
  return {scene,library};
}
