// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/4XGAMES 030859385ac8929e066702ef8af0518663480653: native VANILLAJS imports.
// VOIDWARD adapter for the experimental VANILLAJS Workbench, pinned in provenance.
// Workbench X/Z becomes chart X/Y; -Z forward becomes the negative-Y ship nose.
// This imports inert project data, never exported preview HTML or executable code.
import {parseProject,serializeProject,createAssetLibrary,addMeshAsset,setPlacement,licenses} from '../../../editor/asset-foundry.js';
import {validateScene,sceneWorld} from '../../../editor/model.js';
import {defaultComponents} from '../../../editor/components.js';
import {readRows,writeRows,updateHull} from './workshop.js';
import {parsePack} from './content.js';
const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export const HULL_BUNDLE_KIND='voidward.workbench-hull.v1';
export const MAX_HULL_BUNDLE_BYTES=512*1024;
const sourceKey=p=>JSON.stringify([p.sha256,p.source,p.license]);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
// This demo-owned envelope retains attribution which native project v1/v2 cannot
// represent. The embedded native project and its 256 KiB budget are unchanged.
export function readWorkbenchProject(text) {
  if(typeof text!=='string') throw new Error('Choose exported Workbench project JSON.');
  if(new TextEncoder().encode(text).length>MAX_HULL_BUNDLE_BYTES)throw new Error('Hull bundle exceeds 512 KiB.');
  const value=JSON.parse(text);
  if(value?.kind!==HULL_BUNDLE_KIND)return parseProject(text);
  if(!exact(value,['kind','hull','project','provenance'])||typeof value.hull!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(value.hull)||['constructor','prototype'].includes(value.hull)||!Array.isArray(value.provenance)||value.provenance.length>128)throw new Error('Invalid hull bundle fields.');
  const provenance=value.provenance.map(p=>{
    if(!exact(p,['hull','source','sha256','license','operation'])||p.hull!==value.hull||!licenses().includes(p.license)||typeof p.sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.sha256)||[['source',160],['operation',300]].some(([key,max])=>typeof p[key]!=='string'||!p[key].trim()||p[key].length>max||/[|\r\n\0]/.test(p[key])))throw new Error('Invalid hull bundle provenance.');
    return {...p};
  });
  const parsed=parseProject(value.project);
  if(!parsed.library.assets.some(a=>a.id==='asset-1'&&a.kind==='mesh'))throw new Error('Hull bundle needs its exported projection mesh.');
  return {...parsed,hull:value.hull,provenance};
}
const project=readWorkbenchProject;
export function inspectWorkbench(text) {
  const p=project(text); return p.scene.objects.map(e=>({id:e.id,name:e.name,mesh:p.library.placements.find(a=>a.entityId===e.id)?.meshId || null,visible:e.visible}));
}
function convexHull(input) {
  const points=[...new Map(input.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>=2&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  const lower=half(points),upper=half([...points].reverse());return lower.slice(0,-1).concat(upper.slice(0,-1));
}
export async function importWorkbench(text,{entityId,extent=48}={}) {
  const p=project(text), world=sceneWorld(p.scene), selected=entityId || p.library.placements.find(a=>a.meshId)?.entityId || world.find(e=>e.visible)?.id;
  if(!world.some(e=>e.id===selected)) throw new Error('Choose a valid Workbench entity.');
  if(!Number.isFinite(extent)||extent<4||extent>60) throw new Error('Hull extent must be 4..60 chart units.');
  const ids=new Set([selected]);for(let i=0;i<world.length;i++)for(const e of world)if(ids.has(e.parent))ids.add(e.id);
  const points=[], sources=new Map(), retained=[];let primitive=false;
  for(const e of world.filter(e=>ids.has(e.id)&&e.visible&&(e.components?.mesh.enabled??true))) {
    const place=p.library.placements.find(a=>a.entityId===e.id), mesh=p.library.assets.find(a=>a.id===place?.meshId);
    let vertices=[];
    if(mesh){
      for(let i=0;i<mesh.vertices.length;i+=5)vertices.push(mesh.vertices.slice(i,i+3));
      if(p.provenance?.length&&mesh.id==='asset-1'){
        if(!retained.length)retained.push(...p.provenance.map(({hull,...row})=>row));
      }else{const source={source:mesh.sourceName,sha256:mesh.sourceSha256,license:mesh.license};sources.set(sourceKey(source),source);}
    }else{primitive=true;for(const x of [-.5,.5])for(const z of [-.5,.5])vertices.push([x,0,z]);}
    const angle=e.rotationY*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    for(const v of vertices){const x=v[0]*e.scale[0],z=v[2]*e.scale[2];points.push([e.position[0]+x*c+z*s,e.position[2]-x*s+z*c]);}
  }
  const boundary=convexHull(points);
  if(boundary.length<3) throw new Error('Selected geometry has no non-degenerate top-down silhouette.');
  if(boundary.length>40) throw new Error('Convex silhouette exceeds VOIDWARD’s 40-point limit. Simplify the source mesh.');
  const xs=boundary.map(p=>p[0]),ys=boundary.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const span=Math.max(maxX-minX,maxY-minY);if(!Number.isFinite(span)||span<=1e-9)throw new Error('Geometry is too small to project.');
  const shape=boundary.map(([x,y])=>[Number(((x-(minX+maxX)/2)*extent*2/span).toFixed(6)),Number(((y-(minY+maxY)/2)*extent*2/span).toFixed(6))]);
  if(new Set(shape.map(p=>p.join(','))).size<3)throw new Error('Projected geometry collapsed after rounding.');
  const projectSha256=await hash(text), operation=`Workbench ${selected}; convex X/Z projection; centred; extent ${extent}; six decimal chart units`;
  if(primitive||(!sources.size&&!retained.length)){const source={source:'workbench-project.json',sha256:projectSha256,license:'OWNER-LOCAL-ONLY'};sources.set(sourceKey(source),source);}
  const provenance=retained.concat([...sources.values()].map(s=>({...s,operation})));
  if(provenance.length>128)throw new Error('Projection exceeds the campaign limit of 128 provenance rows.');
  return {shape,entityId:selected,name:world.find(e=>e.id===selected).name,projectSha256,provenance,warnings:['Convex top-down silhouette: concave details and height are discarded.','Materials, textures, colliders, controllers, triggers and camera settings do not become game mechanics.'],shareable:provenance.every(s=>s.license!=='OWNER-LOCAL-ONLY')};
}
export function applyWorkbenchHull(raw,hullId,result) {
  if(!Array.isArray(result?.shape)||!Array.isArray(result.provenance))throw new Error('Use a validated Workbench projection.');
  let candidate=updateHull(raw,hullId,{shape:result.shape});
  const rows=readRows(candidate,'provenance').filter(p=>p.hull!==hullId).concat(result.provenance.map(p=>({hull:hullId,...p})));
  candidate=writeRows(candidate,'provenance',rows);return candidate;
}
async function hullProject(raw,hullId,{bundle=false}={}) {
  const pack=parsePack(raw),h=pack.hulls[hullId];if(!h)throw new Error('Unknown hull.');
  const text=h.shape.map(([x,y])=>`v ${x} 0 ${y}`).join('\n')+'\n'+h.shape.slice(2).map((_,i)=>`f 1 ${i+2} ${i+3}`).join('\n')+'\n';
  const scene=validateScene({schemaVersion:2,name:h.name.slice(0,64),nextId:2,objects:[{id:'entity-1',name:h.name.slice(0,64),parent:null,position:[0,0,0],rotationY:0,scale:[1,1,1],color:[.4,.8,.9],body:'static',visible:true,components:defaultComponents()}]});
  const provenance=pack.provenance.filter(p=>p.hull===hullId),metadata=provenance[0];
  if(!bundle&&(provenance.length>1||metadata?.source.length>64))throw new Error('Native Workbench projects cannot retain this hull attribution. Export the lossless hull bundle.');
  const created=addMeshAsset(createAssetLibrary(),{name:h.name.slice(0,64),license:provenance.length>1?'OWNER-LOCAL-ONLY':metadata?.license||'OWNER-LOCAL-ONLY',sourceName:metadata&&metadata.source.length<=64?metadata.source:`${hullId}.obj`,sourceSha256:metadata?.sha256||await hash(text),text});
  return {project:serializeProject(scene,setPlacement(scene,created.library,'entity-1',created.id)),provenance};
}
// Native geometry exchange retains one representable source/licence. Use the
// bundle API for complete provenance operation history and multiple sources.
export async function exportWorkbenchHull(raw,hullId){return (await hullProject(raw,hullId)).project;}
export async function exportWorkbenchHullBundle(raw,hullId){
  const {project,provenance}=await hullProject(raw,hullId,{bundle:true});
  const text=JSON.stringify({kind:HULL_BUNDLE_KIND,hull:hullId,project,provenance})+'\n';
  readWorkbenchProject(text);return text;
}
export function importWorkbenchLayout(raw,text) {
  const p=project(text), pack=parsePack(raw), points=[];
  // Fixed 2:1 chart scale spans the full VOIDWARD ±2000 range inside the
  // Workbench's authored-position ±1000 contract. No clipping or per-pack scale.
  for(const e of sceneWorld(p.scene)){const match=/^star-(\d+)$/.exec(e.name);if(!match)continue;points.push({id:Number(match[1]),x:e.position[0]*2,y:e.position[2]*2});}
  if(points.length!==pack.map.length||new Set(points.map(p=>p.id)).size!==pack.map.length)throw new Error('Map project needs exactly one named star-N entity for every system.');
  return writeRows(raw,'layout',points.sort((a,b)=>a.id-b.id));
}
export function exportWorkbenchLayout(raw) {
  const pack=parsePack(raw), scene=validateScene({schemaVersion:2,name:pack.meta.title.slice(0,64),nextId:pack.map.length+1,objects:pack.map.map((s,i)=>{const p=pack.layout.find(p=>p.id===s.id)||{x:80+(i%pack.rules.columns)*100,y:80+Math.floor(i/pack.rules.columns)*100};return{id:`entity-${i+1}`,name:`star-${s.id}`,parent:null,position:[p.x/2,0,p.y/2],rotationY:0,scale:[8,8,8],color:[.4,.8,.9],body:'static',visible:true,components:defaultComponents()};})});
  return serializeProject(scene,createAssetLibrary());
}
