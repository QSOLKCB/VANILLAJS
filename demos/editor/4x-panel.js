// SPDX-License-Identifier: Apache-2.0
// DOM adapter for a separately validated campaign draft; no imported code runs.
import {parsePack,loadPack} from '../4x-game-lab/voidward/js/content.js';
import * as Flow from './4x-workflow.js';

export function mount4XPanel(host,{getScene,getLibrary,getSelection,isPlaying,replaceScene}){
  host.innerHTML=`<details class="fourx-panel"><summary>4X campaign workshop</summary>
  <p>A separate campaign draft. Scene Play remains the physics preview. Export your campaign before replacing it.</p>
  <div class="fourx-actions"><button id="fourx-starter" type="button">Load frontier template</button><label class="import">Import campaign<input id="fourx-import" type="file" accept=".json,application/json"></label><button id="fourx-restore" type="button">Restore campaign draft</button></div>
  <p id="fourx-status" role="status" aria-live="polite">Loading local template…</p><p id="fourx-summary"></p>
  <label>Campaign ID<input id="fourx-id" maxlength="40"></label><label>Title<input id="fourx-title" maxlength="80"></label><label>Version<input id="fourx-version" maxlength="16"></label><button id="fourx-identity" type="button">Apply campaign identity</button>
  <div class="fourx-actions"><button id="fourx-undo" type="button">Undo campaign</button><button id="fourx-redo" type="button">Redo campaign</button></div>
  <details><summary>Galaxy in the 3D viewport</summary><p>One viewport unit = two chart units. X/Z becomes chart X/Y. Map replacement is one scene undo step. Move star-N objects with Shift-drag, gizmos or the inspector, then apply positions.</p>
  <div class="fourx-actions"><button id="fourx-map-scene" type="button">Map draft → viewport</button><button id="fourx-map-apply" type="button">Apply viewport positions</button></div>
  <p id="fourx-selected-star">Select a star-N object.</p><label>Starlane target<select id="fourx-lane-target"></select></label><div class="fourx-actions"><button id="fourx-connect" type="button">Connect lane</button><button id="fourx-disconnect" type="button">Remove lane</button></div><label>Empire starting position<select id="fourx-home-empire"></select></label><button id="fourx-home" type="button">Set home at selected star</button></details>
  <details><summary>Selected geometry → ship hull</summary><label>Campaign hull<select id="fourx-hull"></select></label><button id="fourx-project" type="button">Preview selected geometry</button><canvas id="fourx-preview" width="240" height="180" aria-label="Projected hull silhouette"></canvas><p id="fourx-projection-note">Convex X/Z projection discards height, concavities, materials and physics. Source declarations are retained.</p><div class="fourx-actions"><button id="fourx-project-apply" type="button">Apply projected hull</button><button id="fourx-hull-export" type="button">Export hull + provenance</button></div></details>
  <details><summary>Campaign text files</summary><p>All names, empires, ships, components, rules, maps, objectives and events use the same validated text formats as the advanced lab. Apply before switching files; unapplied text stays in this editor only.</p><label>File<select id="fourx-file"></select></label><label>Text<textarea id="fourx-text" spellcheck="false" rows="12"></textarea></label><button id="fourx-text-apply" type="button">Validate & apply text</button></details>
  <div class="fourx-actions"><button id="fourx-export" type="button">Export campaign</button><button id="fourx-sdk" type="button">Export Mod SDK</button><button id="fourx-play" class="primary" type="button">Play 4X draft ↗</button></div>
  <p>Native packs support the full text budget. Mod SDK keeps its separate 32 KiB limit. Export scene/assets separately with Export project. Campaign undo and recovery do not alter scene history.</p></details>`;
  const $=id=>host.querySelector('#fourx-'+id);
  if(location.hash==='#fourx')host.querySelector('details').open=true;
  let history=null,generation=0,busy=false,file='campaign.txt',projection=null,projectionSource=null,previousPlaying=isPlaying(),dirtyText=new Map();
  const status=(text,error=false)=>{$('status').textContent=text;$('status').dataset.error=String(error);};
  const projectIdentity=()=>[getScene(),getLibrary(),getSelection()];
  const sameScene=(a,b)=>a&&b&&a[0]===b[0]&&a[2]===b[2]&&JSON.stringify(a[1])===JSON.stringify(b[1]);
  function saveRecovery(){try{localStorage.setItem(Flow.RECOVERY_KEY,Flow.exportCampaign(history.present));}catch(error){status('Draft accepted; local recovery unavailable. Export a campaign file. '+error.message,true);}}
  function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function options(select,rows,wanted=select.value){select.replaceChildren(...rows.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));if([...select.options].some(o=>o.value===wanted))select.value=wanted;}
  function paintProjection(){const canvas=$('preview'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(!projection)return;ctx.save();ctx.translate(120,90);ctx.scale(1.45,1.45);ctx.beginPath();projection.shape.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='#265f62';ctx.strokeStyle='#80f3d0';ctx.fill();ctx.stroke();ctx.restore();}
  function renderDraft(){
    if(!history){sync();return;}const p=parsePack(history.present);
    $('summary').textContent=`${p.meta.title} · ${p.map.length} stars · ${p.empires.length} empires · ${p.objectives.length} objectives`;
    $('id').value=p.meta.id;$('title').value=p.meta.title;$('version').value=p.meta.version;
    options($('file'),Flow.campaignFiles().map(name=>[name,name]),file);$('text').value=dirtyText.get(file)??history.present[file]??'';
    options($('lane-target'),p.map.map(s=>[String(s.id),`${s.id} · ${p.systemNames[s.id]}`]));
    options($('home-empire'),p.empires.map(e=>[String(e.id),`${e.name} · home ${e.home}`]));
    options($('hull'),Object.values(p.hulls).map(h=>[h.id,`${h.name} · ${h.id}`]));sync();
  }
  function accept(next,message){history=next;projection=null;projectionSource=null;paintProjection();renderDraft();status(message);saveRecovery();}
  function run(fn){if(isPlaying()||busy)return;try{fn();}catch(error){status(error.message,true);}sync();}
  async function asynchronous(fn){if(isPlaying()||busy)return;const token=++generation;busy=true;sync();try{await fn(token);}catch(error){if(token===generation)status(error.message,true);}finally{if(token===generation){busy=false;sync();}}}
  function sync(){
    if(isPlaying()&&!previousPlaying){++generation;busy=false;projection=null;projectionSource=null;paintProjection();}
    previousPlaying=isPlaying();
    const blocked=isPlaying()||busy;
    for(const control of host.querySelectorAll('button,input,select,textarea'))control.disabled=blocked||!history;
    for(const id of ['starter','import','restore'])$(id).disabled=blocked;
    $('undo').disabled=blocked||!history?.past.length;$('redo').disabled=blocked||!history?.future.length;
    const current=projectIdentity();if(projectionSource&&!sameScene(projectionSource,current)){projection=null;projectionSource=null;paintProjection();$('projection-note').textContent='Scene changed. Preview geometry again before applying.';}
    const selected=history?Flow.selectedCampaignSystem(history.present,current[0],current[2]):null;
    $('selected-star').textContent=selected===null?'Select a star-N object in the viewport or hierarchy.':`Selected star ${selected}: ${parsePack(history.present).systemNames[selected]}`;
    for(const id of ['connect','disconnect','home'])$(id).disabled=blocked||selected===null;
    $('project').disabled=blocked||!history||!current[2];$('project-apply').disabled=blocked||!projection;
  }
  async function starter(token){const p=await loadPack(new URL('../4x-game-lab/voidward/mods/frontier/',import.meta.url));if(token!==generation||isPlaying())return;dirtyText.clear();accept(history?Flow.commitCampaignDraft(history,p.raw):Flow.makeCampaignDraft(p.raw),'Frontier template loaded. Change its ID before sharing.');}
  $('starter').onclick=()=>asynchronous(starter);
  $('import').onchange=event=>{const chosen=event.target.files?.[0];event.target.value='';if(!chosen)return;asynchronous(async token=>{if(chosen.size>1000000)throw new RangeError('Campaign envelope exceeds 1 MB');const raw=Flow.importCampaign(await chosen.text());if(token!==generation||isPlaying())return;dirtyText.clear();accept(history?Flow.commitCampaignDraft(history,raw):Flow.makeCampaignDraft(raw),'Campaign imported and validated; scene unchanged.');});};
  $('restore').onclick=()=>run(()=>{const text=localStorage.getItem(Flow.RECOVERY_KEY);if(!text)throw new Error('No saved campaign draft');const raw=Flow.importCampaign(text);dirtyText.clear();accept(history?Flow.commitCampaignDraft(history,raw):Flow.makeCampaignDraft(raw),'Campaign recovery restored; scene unchanged.');});
  $('identity').onclick=()=>run(()=>{const next=Flow.editCampaignIdentity(history,{id:$('id').value,title:$('title').value,version:$('version').value});dirtyText.delete('campaign.txt');accept(next,'Campaign identity applied.');});
  for(const direction of ['undo','redo'])$(direction).onclick=()=>run(()=>{dirtyText.clear();accept(Flow.travelCampaignDraft(history,direction),'Campaign '+direction+' applied; scene history unchanged.');});
  $('file').onchange=()=>{dirtyText.set(file,$('text').value);file=$('file').value;$('text').value=dirtyText.get(file)??history.present[file]??'';};
  $('text').oninput=()=>dirtyText.set(file,$('text').value);
  $('text-apply').onclick=()=>run(()=>{const next=Flow.editCampaignFile(history,file,$('text').value);dirtyText.delete(file);accept(next,`${file} validated and applied.`);});
  $('map-scene').onclick=()=>run(()=>{replaceScene(Flow.campaignMapScene(history.present));status('Map loaded into the viewport. Scene Undo restores the previous scene; move stars, then Apply viewport positions.');});
  $('map-apply').onclick=()=>run(()=>accept(Flow.applyCampaignMap(history,getScene()),'Viewport X/Z positions applied at 2:1 chart scale.'));
  for(const [id,enabled]of [['connect',true],['disconnect',false]])$(id).onclick=()=>run(()=>accept(Flow.editCampaignLane(history,Flow.selectedCampaignSystem(history.present,getScene(),getSelection()),Number($('lane-target').value),enabled),'Reciprocal lane validated and applied.'));
  $('home').onclick=()=>run(()=>accept(Flow.editCampaignHome(history,Number($('home-empire').value),Flow.selectedCampaignSystem(history.present,getScene(),getSelection())),'Empire starting position applied.'));
  $('project').onclick=()=>asynchronous(async token=>{const source=projectIdentity(),revision=history.revision,result=await Flow.previewCampaignHull(...source.slice(0,2),source[2]);if(token!==generation||isPlaying()||history.revision!==revision||!sameScene(source,projectIdentity()))return;projection=result;projectionSource=source;paintProjection();$('projection-note').textContent=result.warnings.join(' ')+' '+result.provenance.length+' source declaration(s). '+(result.shareable?'Retain all declared licence terms when sharing.':'Contains owner-local geometry; resolve sharing rights.');status('Projection preview ready. Apply explicitly to the selected campaign hull.');});
  $('project-apply').onclick=()=>run(()=>{if(!sameScene(projectionSource,projectIdentity()))throw new Error('Scene changed; preview again');accept(Flow.applyCampaignHull(history,$('hull').value,projection),'Hull and all source declarations applied atomically.');});
  $('hull-export').onclick=()=>asynchronous(async token=>{const text=await Flow.exportCampaignHull(history.present,$('hull').value);if(token===generation&&!isPlaying())download('campaign-hull.vhull.json',text);});
  $('export').onclick=()=>run(()=>{download(parsePack(history.present).meta.id+'.json',Flow.exportCampaign(history.present));status('Native campaign exported. Unapplied text edits are excluded.');});
  $('sdk').onclick=()=>run(()=>{download(parsePack(history.present).meta.id+'.mod.json',Flow.exportCampaignSDK(history.present));status('Mod SDK exchange exported under its unchanged 32 KiB budget.');});
  $('play').onclick=()=>run(()=>{localStorage.setItem(Flow.HANDOFF_KEY,Flow.exportCampaign(history.present));window.open(new URL('../4x-game-lab/voidward/index.html?draft=editor',import.meta.url),'_blank','noopener');status('Validated draft sent to the local advanced 4X lab. If a popup is blocked, export and import the pack there.');});
  // Do not overwrite a recovery draft simply by opening the editor.
  busy=true;const initial=++generation;sync();loadPack(new URL('../4x-game-lab/voidward/mods/frontier/',import.meta.url)).then(p=>{
    if(initial!==generation||isPlaying())return;history=Flow.makeCampaignDraft(p.raw);renderDraft();status('Frontier template ready. Restore campaign draft to recover previous edits.');
    if(new URL(location.href).searchParams.get('draft')==='voidward')try{
      const text=localStorage.getItem(Flow.INCOMING_KEY);if(!text)throw new Error('No campaign handoff found; import an exported campaign file');
      const next=Flow.commitCampaignDraft(history,Flow.importCampaign(text));accept(next,'Campaign draft received from the advanced 4X lab. Scene unchanged.');
      localStorage.removeItem(Flow.INCOMING_KEY);host.querySelector('details').open=true;
    }catch(error){status('Campaign handoff rejected: '+error.message,true);}
  }).catch(error=>status('Template unavailable: '+error.message,true)).finally(()=>{if(initial===generation){busy=false;sync();}});
  return {sync, snapshot:()=>history?{files:structuredClone(history.present),revision:history.revision,past:history.past.length,future:history.future.length,historyBytes:Flow.draftHistoryBytes(history)}:null};
}
