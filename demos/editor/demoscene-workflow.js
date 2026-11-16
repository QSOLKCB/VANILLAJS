// SPDX-License-Identifier: Apache-2.0
import {validateDemo,DEMO_KIND} from '../../modules/mod-demo/index.js';
import {sceneWorld,undoHistory,redoHistory} from './model.js';
import {validateAssetLibrary} from './asset-foundry.js';
export const demoDraft=source=>({past:[],present:validateDemo(source),future:[]});
export function commitDemo(history,source){const project=validateDemo(source);if(project.bytes===history.present.bytes)return history;return {past:[...history.past.slice(-63),history.present],present:project,future:[]};}
export const travelDemo=(history,direction)=>direction==='undo'?undoHistory(history):redoHistory(history);
const raw=project=>JSON.parse(validateDemo(project).bytes);
const label=s=>s.toUpperCase().replace(/[^A-Z0-9 .,!?/:\-]/g,' ').slice(0,64)||'OBJECT';
const original=()=>({author:'Local creator',license:'OWNER-LOCAL-ONLY',source:'Visual Workbench authored primitive',sha256:'original-procedural'});
export function addSelectedDemo(project,scene,library,selection,{effect='rotate',copies=1}={}){
  const next=raw(project),lib=validateAssetLibrary(library,scene),world=sceneWorld(scene),ids=new Set([selection]);if(!world.some(e=>e.id===selection))throw new TypeError('Select an object first');
  for(let n=0;n<world.length;n++)for(const e of world)if(ids.has(e.parent))ids.add(e.id);
  const entries=next.manifest.entries,assets=new Map(lib.assets.map(a=>[a.id,a])),meshRefs=new Map();let index=0;
  const free=prefix=>{while(entries.some(e=>e.id===prefix+index))index++;return prefix+index++;};
  for(const e of world.filter(e=>ids.has(e.id)&&e.visible)){
    const placement=lib.placements.find(p=>p.entityId===e.id),mesh=assets.get(placement?.meshId),material=assets.get(placement?.materialId);
    if(material?.textureId)throw new TypeError('Visual FX currently supports flat materials; clear the texture attachment before capture');
    const refs=[];if(mesh){if(!meshRefs.has(mesh.id)){
      const xyz=mesh.vertices.filter((_,i)=>i%5<3),parts=[];
      for(let start=0;start<xyz.length;start+=360){const id=free('mesh-');entries.push({id,kind:'data',data:{vertices:xyz.slice(start,start+360),provenance:{author:'Asset Foundry import',license:mesh.license,source:mesh.sourceName,sha256:mesh.sourceSha256}}});parts.push(id);}meshRefs.set(mesh.id,parts);
    }refs.push(...meshRefs.get(mesh.id));}
    const provenance=material?{author:'Asset Foundry material author',license:material.license,source:material.name,sha256:'original-procedural'}:original();
    entries.push({id:free('node-'),kind:'data',data:{name:label(e.name),meshes:refs,effect,copies,color:[...(material?.color??e.color)],keys:[{sample:0,position:[...e.position],rotation:[0,e.rotationY*Math.PI/180,0],scale:[...e.scale]}],provenance}});
  }return validateDemo(next);
}
export function editDemoNode(project,nodeId,patch){const next=raw(project),entry=next.manifest.entries.find(e=>e.id===nodeId&&e.id.startsWith('node-'));if(!entry)throw new TypeError('Choose a composition object');entry.data={...entry.data,...patch};return validateDemo(next);}
export function captureDemoKey(project,nodeId,scene,selection,sample){const e=sceneWorld(scene).find(e=>e.id===selection);if(!e)throw new TypeError('Select the source object');const node=validateDemo(project).nodes.find(n=>n.id===nodeId);if(!node)throw new TypeError('Choose a composition object');const keys=node.keys.filter(k=>k.sample!==sample).map(k=>({...k}));keys.push({sample,position:e.position,rotation:[0,e.rotationY*Math.PI/180,0],scale:e.scale});keys.sort((a,b)=>a.sample-b.sample);return editDemoNode(project,nodeId,{keys,color:e.color});}
export function editDemoData(project,id,edit){const next=raw(project),entry=next.manifest.entries.find(e=>e.id===id);if(!entry)throw new TypeError('Unknown entry');edit(entry.data);return validateDemo({kind:DEMO_KIND,manifest:next.manifest});}
