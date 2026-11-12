// SPDX-License-Identifier: Apache-2.0
// Demo-owned campaign sidecar. Existing scene/project schemas stay unchanged.
import {parsePack,PACK_FILES,OPTIONAL_PACK_FILES} from '../4x-game-lab/voidward/js/content.js';
import * as Workshop from '../4x-game-lab/voidward/js/workshop.js';
import * as Bridge from '../4x-game-lab/voidward/js/workbench-bridge.js';
import {parseProject,serializeProject,createAssetLibrary} from './asset-foundry.js';

export const HANDOFF_KEY='vanillajs.editor.4x-handoff.v1';
export const INCOMING_KEY='vanillajs.voidward.editor-draft.v1';
export const RECOVERY_KEY='vanillajs.editor.4x-recovery.v1';
export const MAX_DRAFT_HISTORY=16;
export const MAX_DRAFT_HISTORY_BYTES=4*1024*1024;
export const campaignFiles=()=>[...PACK_FILES,...OPTIONAL_PACK_FILES].map(name=>name+'.txt');
const bytes=raw=>new TextEncoder().encode(JSON.stringify(raw)).length;
export const draftHistoryBytes=history=>[...history.past,history.present,...history.future].reduce((n,raw)=>n+bytes(raw),0);
function bounded(history){
  while(history.past.length+history.future.length>MAX_DRAFT_HISTORY||draftHistoryBytes(history)>MAX_DRAFT_HISTORY_BYTES){
    if(history.past.length)history.past.shift();else if(history.future.length)history.future.pop();else throw new RangeError('Campaign draft exceeds history budget');
  }
  return history;
}
export function makeCampaignDraft(raw){return bounded({past:[],present:parsePack(raw).raw,future:[],revision:0});}
export function commitCampaignDraft(history,raw){
  const candidate=parsePack(raw).raw;
  if(JSON.stringify(candidate)===JSON.stringify(history.present))return history;
  return bounded({past:[...history.past,history.present],present:candidate,future:[],revision:history.revision+1});
}
export function travelCampaignDraft(history,direction){
  if(!['undo','redo'].includes(direction))throw new TypeError('Choose undo or redo');
  if(direction==='undo')return history.past.length?bounded({past:history.past.slice(0,-1),present:history.past.at(-1),future:[history.present,...history.future],revision:history.revision+1}):history;
  return history.future.length?bounded({past:[...history.past,history.present],present:history.future[0],future:history.future.slice(1),revision:history.revision+1}):history;
}
export function editCampaignFile(history,file,text){return commitCampaignDraft(history,Workshop.patchFiles(history.present,{[file]:text}));}
export function editCampaignIdentity(history,{id,title,version}){
  let raw=history.present;for(const [key,value]of Object.entries({id,title,version}))raw=Workshop.editSetting(raw,'campaign',key,value,{validate:false});
  return commitCampaignDraft(history,raw);
}
export function campaignMapScene(raw){
  const pack=parsePack(raw),project=parseProject(Bridge.exportWorkbenchLayout(pack.raw));
  for(const entity of project.scene.objects){const id=Number(entity.name.slice(5)),empire=pack.empires.find(e=>e.home===id);if(empire)entity.color=[1,3,5].map(i=>parseInt(empire.color.slice(i,i+2),16)/255);}
  return project.scene;
}
export function selectedCampaignSystem(raw,scene,selected){
  const entity=scene.objects.find(e=>e.id===selected),match=/^star-(\d+)$/.exec(entity?.name||'');
  if(!match)return null;const id=Number(match[1]);return parsePack(raw).map.some(s=>s.id===id)?id:null;
}
export function applyCampaignMap(history,scene){
  const native=serializeProject(scene,createAssetLibrary());
  return commitCampaignDraft(history,Bridge.importWorkbenchLayout(history.present,native));
}
export function editCampaignLane(history,a,b,enabled){return commitCampaignDraft(history,Workshop.setLane(history.present,a,b,enabled));}
export function editCampaignHome(history,empire,system){return commitCampaignDraft(history,Workshop.updateEmpire(history.present,empire,{home:system}));}
export async function previewCampaignHull(scene,library,selected){
  if(!selected)throw new Error('Select a visible object in the viewport or hierarchy');
  return Bridge.importWorkbench(serializeProject(scene,library),{entityId:selected});
}
export function applyCampaignHull(history,hull,result){return commitCampaignDraft(history,Bridge.applyWorkbenchHull(history.present,hull,result));}
export const importCampaign=text=>Workshop.importPack(text);
export const exportCampaign=raw=>Workshop.exportPack(raw);
export const exportCampaignSDK=raw=>Workshop.exportSDKPack(raw);
export const exportCampaignHull=(raw,hull)=>Bridge.exportWorkbenchHullBundle(raw,hull);

