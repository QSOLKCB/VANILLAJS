// SPDX-License-Identifier: Apache-2.0
// CREATOR-INTEROP-001: bounded inert creator project and content-addressed offline package.
// No script imports, storage privileges, DOM, ambient clock, network or arbitrary execution.
import {validateSceneGraph} from '../scene-graph/index.js';
import {createSightWorld} from '../sensing/index.js';
import {createTacticsWorld} from '../tactics/index.js';
import {createCADPrimitive,createForgePreset} from '../cad-geometry/index.js';

export const CREATOR_FORMAT='qsol.vanillajs.creator-world.v1';
export const CREATOR_PACKAGE='qsol.vanillajs.creator-package.v1';
export const CREATOR_LIMITS=Object.freeze({bytes:262144,assets:24,vertices:256,triangles:512,
 placements:64,zones:64,coordinate:2000});
const ID=/^[a-z][a-z0-9-]{0,31}$/,HEX=/^[a-f0-9]{64}$/,ENCODER=new TextEncoder();
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
function record(v,keys,label){
  if(!v||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(label+' requires plain record');
  const d=Object.getOwnPropertyDescriptors(v),found=Reflect.ownKeys(d);
  if(found.length!==keys.length||found.some(k=>typeof k!=='string'||!keys.includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value')))
    throw TypeError(label+' requires exact, non-executable data fields');
  return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
function list(v,min,max,label){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length<min||v.length>max||
     Reflect.ownKeys(v).length!==v.length+1)throw TypeError(label+' requires dense bounded plain array');
  return Array.from({length:v.length},(_,i)=>{
    const d=Object.getOwnPropertyDescriptor(v,String(i));
    if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw TypeError(label+' has accessor or hole');
    return d.value;
  });
}
const number=(v,lo,hi,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw RangeError(label+' out of bounds');return v===0?0:v;};
function vector(v,bound,label){return list(v,3,3,label).map(n=>number(n,-bound,bound,label));}
function identifier(v,ids,label){if(typeof v!=='string'||!ID.test(v)||ids.has(v))throw TypeError(label+' requires distinct slug');ids.add(v);return v;}
function text(v,label,max=80){
  if(typeof v!=='string'||v.length<1||v.length>max||/[\u0000-\u001f\u007f<>]/.test(v))throw TypeError(label+' needs bounded plain text');
  return v;
}
function asset(value,ids){
  const a=record(value,['id','dimension','vertices','triangles','origin','license','sourceRef'],'asset');
  const id=identifier(a.id,ids,'asset id');
  if(!['2d','2.5d','3d'].includes(a.dimension))throw TypeError('unsupported asset dimension');
  if(!['original','verified-third-party'].includes(a.origin))throw TypeError('asset origin declaration required');
  if(!['Apache-2.0','MIT','CC0-1.0','BSD-2-Clause','BSD-3-Clause'].includes(a.license))throw TypeError('asset licence unsupported');
  const sourceRef=text(a.sourceRef,'asset source reference',160);
  const vertices=list(a.vertices,3,CREATOR_LIMITS.vertices,'vertices').map(v=>vector(v,2000,'vertex'));
  if(a.dimension==='2d'&&vertices.some(v=>v[2]!==0))throw RangeError('2d asset must occupy XY plane');
  const triangles=list(a.triangles,1,CREATOR_LIMITS.triangles,'triangles').map(t=>{
    const ix=list(t,3,3,'triangle').map(n=>number(n,0,vertices.length-1,'vertex index'));
    if(ix.some(n=>!Number.isSafeInteger(n))||new Set(ix).size!==3)throw TypeError('triangle requires three distinct integer indices');
    const [a,b,c]=ix.map(i=>vertices[i]),u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
    const area=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(Math.hypot(...area)<=1e-12)throw RangeError('triangle must have nondegenerate area');
    return ix;
  });
  return {id,dimension:a.dimension,vertices,triangles,origin:a.origin,license:a.license,sourceRef};
}
function placement(value,ids,assetIds){
  const p=record(value,['id','kind','assetId','position'],'placement');
  const id=identifier(p.id,ids,'placement id');
  if(!['prop','target','vehicle','spawn'].includes(p.kind))throw TypeError('placement kind unsupported');
  if(p.assetId!==null&&(typeof p.assetId!=='string'||!assetIds.has(p.assetId)))
    throw TypeError('placement asset reference unresolved');
  if(p.kind==='prop'&&p.assetId===null)throw TypeError('prop requires mesh asset');
  return {id,kind:p.kind,assetId:p.assetId,position:vector(p.position,2000,'placement position')};
}
function zone(value,ids){
  const z=record(value,['id','kind','min','max'],'zone');
  const id=identifier(z.id,ids,'zone id');
  if(!['occluder','trigger','sensor'].includes(z.kind))throw TypeError('zone kind unsupported');
  const min=vector(z.min,2000,'zone min'),max=vector(z.max,2000,'zone max');
  if(min.some((n,i)=>n>=max[i]))throw RangeError('zone requires positive AABB volume');
  return {id,kind:z.kind,min,max};
}
/** Convert *generated* native CAD-001/003 XYZ/UV triangle geometry into an
 * indexed, validated portable asset. CAD itself owns shape and topology rules. */
export function creatorCADAsset(input){
  const r=record(input,['id','kind','options'],'CAD asset request');
  const kind=r.kind;
  let mesh;
  if(['column','cone','urn'].includes(kind)){
    const options=record(r.options,['radius','height','segments'],'lathe options');
    mesh=createCADPrimitive({kind,...options});
  }else if(['wall','platform','tower','wedge'].includes(kind)){
    const options=record(r.options,['width','depth','height','bevel'],'forge options');
    mesh=createForgePreset({kind,...options});
  }else throw TypeError('unsupported CAD generator kind');
  const vertices=[],triangles=[],lookup=new Map(),raw=mesh.vertices;
  if(raw.length%15!==0)throw RangeError('generated mesh must be whole XYZ/UV triangles');
  for(let i=0;i<raw.length;i+=15){
    const tri=[];
    for(let j=0;j<3;j++){
      const xyz=raw.slice(i+j*5,i+j*5+3),key=xyz.join(',');
      if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(xyz);}
      tri.push(lookup.get(key));
    }
    triangles.push(tri);
  }
  return freeze(asset({id:r.id,dimension:'3d',vertices,triangles,origin:'original',
    license:'Apache-2.0',sourceRef:'qsol:cad-geometry:apache-2.0'},new Set()));
}
/** The exported core can be validated independently without DOM or file I/O. */
export function createCreatorProject(input){
  const r=record(input,['format','version','name','scene','assets','placements','zones','tactical'],'creator project');
  if(r.format!==CREATOR_FORMAT||r.version!==1)throw TypeError('unsupported creator project version');
  const ids=new Set(),assets=list(r.assets,0,CREATOR_LIMITS.assets,'assets').map(v=>asset(v,ids)),
    assetIds=new Set(assets.map(a=>a.id));
  const placements=list(r.placements,0,CREATOR_LIMITS.placements,'placements')
    .map(v=>placement(v,ids,assetIds)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const zones=list(r.zones,0,CREATOR_LIMITS.zones,'zones')
    .map(v=>zone(v,ids)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  assets.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const scene=validateSceneGraph(r.scene);
  let tactical=null;
  if(r.tactical!==null){
    // The actual tactics engine validates every cover/actor/route field.
    createTacticsWorld(r.tactical);
    // Clone only after the engine has traversed and validated exact inert data.
    tactical=JSON.parse(JSON.stringify(r.tactical));
  }
  const project=freeze({format:CREATOR_FORMAT,version:1,name:text(r.name,'project name'),scene,
    assets,placements,zones,tactical});
  if(ENCODER.encode(JSON.stringify(project)).length>CREATOR_LIMITS.bytes)
    throw RangeError('creator project exceeds 256 KiB');
  return project;
}
/** Real SENSE-001 blocker/target data: view selection never changes line of sight. */
export function createCreatorSightWorld(project){
  const p=createCreatorProject(project);
  return createSightWorld({blockers:p.zones.filter(z=>z.kind==='occluder')
    .map(z=>({id:z.id,box:{min:z.min,max:z.max}})),
    targets:p.placements.filter(x=>x.kind==='target')
    .map(x=>({id:x.id,position:x.position}))});
}
/** Explicit consumer seam: project data cannot invent tactical weapon effects. */
export function createCreatorTacticsWorld(project){
  const p=createCreatorProject(project);
  if(p.tactical===null)throw TypeError('project has no tactical scenario');
  return createTacticsWorld(p.tactical);
}
async function digest(value){
  const crypto=globalThis.crypto?.subtle;
  if(!crypto)throw Error('standard offline Web Crypto SHA-256 required');
  const bytes=ENCODER.encode(value);
  const hash=await crypto.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
/** Cryptographic integrity receipts, not independent licence verification. */
export async function sealCreatorPackage(input){
  const project=createCreatorProject(input);
  const hashes=[];
  for(const a of project.assets)hashes.push({id:a.id,sha256:await digest(JSON.stringify(a))});
  const header={format:CREATOR_PACKAGE,project,hashes};
  const pkg=freeze({...header,sha256:await digest(JSON.stringify(header))});
  if(ENCODER.encode(JSON.stringify(pkg)).length>CREATOR_LIMITS.bytes)
    throw RangeError('creator package exceeds 256 KiB');
  return pkg;
}
export function creatorPackageJSON(pkg){
  record(pkg,['format','project','hashes','sha256'],'creator package');
  const payload=JSON.stringify(pkg);
  if(ENCODER.encode(payload).length>CREATOR_LIMITS.bytes)throw RangeError('creator package exceeds byte limit');
  return payload;
}
/** Import is all-or-nothing; no state is committed until both hashes pass. */
export async function openCreatorPackage(textValue){
  if(typeof textValue!=='string'||ENCODER.encode(textValue).length>CREATOR_LIMITS.bytes)
    throw RangeError('creator import must be bounded UTF-8 text');
  const input=JSON.parse(textValue);
  const r=record(input,['format','project','hashes','sha256'],'creator package');
  if(r.format!==CREATOR_PACKAGE||typeof r.sha256!=='string'||!HEX.test(r.sha256))
    throw TypeError('unsupported or unsealed creator package');
  const expected=list(r.hashes,0,CREATOR_LIMITS.assets,'asset hashes')
    .map(x=>{const h=record(x,['id','sha256'],'asset hash');
      if(typeof h.id!=='string'||!ID.test(h.id)||typeof h.sha256!=='string'||!HEX.test(h.sha256))
        throw TypeError('invalid asset receipt');return h;});
  const verified=await sealCreatorPackage(r.project);
  if(JSON.stringify(expected)!==JSON.stringify(verified.hashes)||verified.sha256!==r.sha256)
    throw Error('creator package integrity mismatch');
  return verified.project;
}
