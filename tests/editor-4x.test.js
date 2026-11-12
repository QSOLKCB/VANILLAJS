// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as Flow from '../demos/editor/4x-workflow.js';
import {PACK_FILES,parsePack} from '../demos/4x-game-lab/voidward/js/content.js';
import {createEngine} from '../demos/4x-game-lab/voidward/js/core.js';
import {readWorkbenchProject} from '../demos/4x-game-lab/voidward/js/workbench-bridge.js';
import {createForgeScene,makeHistory,commitHistory,undoHistory,updateEntity,validateScene} from '../demos/editor/model.js';
import {defaultComponents} from '../demos/editor/components.js';
import {createAssetLibrary,addMeshAsset,setPlacement,parseProject,serializeProject} from '../demos/editor/asset-foundry.js';

const base=Object.fromEntries(await Promise.all(PACK_FILES.map(async name=>[name+'.txt',await fs.readFile(new URL('../demos/4x-game-lab/voidward/mods/frontier/'+name+'.txt',import.meta.url),'utf8')])));

test('campaign identity/text transactions preserve the last valid draft and independent scene undo',()=>{
  const original=Flow.makeCampaignDraft(base),scene=createForgeScene(),sceneHistory=makeHistory(scene);
  const edited=Flow.editCampaignIdentity(original,{id:'editor-universe',title:'Editor Universe',version:'1.1.0'});
  assert.equal(parsePack(edited.present).meta.id,'editor-universe');assert.equal(parsePack(original.present).meta.id,'frontier');
  const before=JSON.stringify(edited);assert.throws(()=>Flow.editCampaignFile(edited,'map.txt','0 | 999 | 0\n'));
  assert.equal(JSON.stringify(edited),before,'rejected file does not damage valid history');
  const map=Flow.campaignMapScene(edited.present),nextScene=commitHistory(sceneHistory,map);
  assert.deepEqual(undoHistory(nextScene).present,scene);assert.equal(edited.past.length,1,'scene edit never creates a campaign step');
  assert.deepEqual(Flow.travelCampaignDraft(edited,'undo').present,original.present);
  assert.deepEqual(Flow.travelCampaignDraft(Flow.travelCampaignDraft(edited,'undo'),'redo').present,edited.present);
  assert.deepEqual(parseProject(serializeProject(scene,createAssetLibrary(),{optionalGPU:false})),{scene,library:createAssetLibrary(),graphics:{optionalGPU:false}},'legacy project shape remains unchanged');
});

test('actual scene transform edits map back at2:1 scale and invalid topology stays detached',()=>{
  let draft=Flow.makeCampaignDraft(base),scene=Flow.campaignMapScene(draft.present);
  const selected=scene.objects.find(e=>e.name==='star-0').id;
  assert.equal(Flow.selectedCampaignSystem(draft.present,scene,selected),0);
  scene=updateEntity(scene,selected,{position:[-1000,21,1000]});
  draft=Flow.applyCampaignMap(draft,scene);
  assert.deepEqual(parsePack(draft.present).layout.find(s=>s.id===0),{id:0,x:-2000,y:2000});
  const saved=JSON.stringify(draft);assert.throws(()=>Flow.applyCampaignMap(draft,updateEntity(scene,selected,{name:'broken-star'})),/star-N/);assert.equal(JSON.stringify(draft),saved);
  draft=Flow.editCampaignLane(draft,0,29,true);const pack=parsePack(draft.present);assert.ok(pack.map[0].links.includes(29)&&pack.map[29].links.includes(0));
  assert.throws(()=>Flow.editCampaignHome(draft,0,pack.empires[1].home),/home|start/i);
  assert.equal(parsePack(draft.present).empires[0].home,parsePack(base).empires[0].home);
});

test('selected mesh projection preserves distinct declared sources and starts a playable reimported campaign',async()=>{
  const entity=(id,parent=null)=>({id,name:id,parent,position:[0,0,0],rotationY:0,scale:[1,1,1],color:[.3,.6,.8],body:'static',visible:true,components:defaultComponents()});
  const scene=validateScene({schemaVersion:2,name:'Source family',nextId:3,objects:[entity('entity-1'),entity('entity-2','entity-1')]}),obj='v 0 0 -1\nv 1 0 1\nv -1 0 1\nf 1 2 3\n';
  let library=createAssetLibrary();
  for(const [i,license]of ['CC-BY-4.0','MIT'].entries()){const added=addMeshAsset(library,{name:'Source '+i,sourceName:'source-'+i+'.obj',sourceSha256:'a'.repeat(64),license,text:obj});library=setPlacement(scene,added.library,'entity-'+(i+1),added.id);}
  const sourceBefore=JSON.stringify({scene,library}),projection=await Flow.previewCampaignHull(scene,library,'entity-1');
  assert.equal(projection.provenance.length,2);assert.deepEqual(new Set(projection.provenance.map(p=>p.license)),new Set(['CC-BY-4.0','MIT']));
  const draft=Flow.applyCampaignHull(Flow.makeCampaignDraft(base),'scout-0',projection),pack=parsePack(Flow.importCampaign(Flow.exportCampaign(draft.present)));
  assert.equal(pack.provenance.length,2);assert.deepEqual(pack.hulls['scout-0'].shape,projection.shape);assert.equal(JSON.stringify({scene,library}),sourceBefore);
  const bundle=readWorkbenchProject(await Flow.exportCampaignHull(draft.present,'scout-0'));assert.equal(bundle.provenance.length,2);
  const sdk=Flow.exportCampaignSDK(draft.present);assert.deepEqual(Flow.importCampaign(sdk),draft.present);
  const engine=createEngine(pack),state=engine.createGame(421);engine.validateState(state);engine.endTurn(state);assert.equal(state.turn,2);
});

test('campaign undo is bounded by both snapshot count and actual encoded bytes',()=>{
  let draft=Flow.makeCampaignDraft(base);
  for(let i=0;i<40;i++)draft=Flow.editCampaignIdentity(draft,{id:'editor-universe',title:'Revision '+i,version:'1.0.0'});
  assert.equal(draft.past.length,Flow.MAX_DRAFT_HISTORY);
  const large={...base};for(const name of ['rules','music','research','campaign'])large[name+'.txt']+='\n#'+('x'.repeat(80000))+'\n';
  draft=Flow.makeCampaignDraft(large);
  for(let i=0;i<24;i++)draft=Flow.editCampaignIdentity(draft,{id:'large-authoring',title:'Large revision '+i,version:'1.0.0'});
  assert.ok(Flow.draftHistoryBytes(draft)<=Flow.MAX_DRAFT_HISTORY_BYTES);assert.ok(draft.past.length<Flow.MAX_DRAFT_HISTORY);
  const redo=Flow.travelCampaignDraft(draft,'undo');assert.ok(Flow.draftHistoryBytes(redo)<=Flow.MAX_DRAFT_HISTORY_BYTES);
  assert.throws(()=>Flow.exportCampaignSDK(draft.present),/budget|KiB/,'native authoring never widens SDK limits');
});
