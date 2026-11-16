// SPDX-License-Identifier: Apache-2.0
import {machineRemembers} from '../demoscene-lab/preset.js';
import {DemoPlayer} from '../demoscene-lab/player.js';
import {validateDemo,DEMO_EFFECTS} from '../../modules/mod-demo/index.js';
import {demoSample} from '../../modules/demo-timeline/index.js';
import {demoDraft,commitDemo,travelDemo,addSelectedDemo,editDemoNode,captureDemoKey,editDemoData} from './demoscene-workflow.js';
export function mountDemoscenePanel(host,{getScene,getLibrary,getSelection,isPlaying,stopScene}){
  host.innerHTML=`<details id="visual-fx" class="demoscene-panel"><summary>Demoscene / Visual FX</summary><p>Use the hierarchy, transform inspector and Asset Foundry above. Selected objects and visible descendants become an inert audiovisual composition. Flat materials only; existing scene formats stay compatible.</p>
  <div class="fx-feedback"><p id="fx-mode" role="status" hidden>Scene Play locks Visual FX editing, including when paused. Stop the scene to use these controls.</p><button type="button" id="fx-edit" hidden>Stop scene & edit Visual FX</button><p id="fx-status" role="status" aria-live="polite">Original production template ready. Add a selected object, then preview or export the composition.</p></div>
  <label>Effect<select id="fx-effect">${DEMO_EFFECTS.map(e=>'<option>'+e+'</option>').join('')}</select></label><label>Copies<input id="fx-copies" type="number" min="1" max="48" value="1"></label><button type="button" id="fx-add">Add selected object / prefab</button><label>Composition object<select id="fx-node"></select></label><button type="button" id="fx-effect-apply">Apply effect & copies</button>
  <label>Time in seconds<input id="fx-time" type="number" min="0" max="60" step=".02" value="0"></label><button type="button" id="fx-key">Capture inspector transform + colour as keyframe</button><p>Move, rotate, scale and recolour the selected object in the main inspector, then capture at another time. Up to eight ordered keys.</p>
  <details><summary>Camera, typography & music</summary><label>Camera XYZ<input id="fx-camera" value="0, 4, 30"></label><label>Camera target XYZ<input id="fx-target" value="0, 3, 0"></label><button type="button" id="fx-camera-key">Set camera key at time</button><label>3D title<input id="fx-title" value="VANILLAJS" maxlength="32"></label><label>Scroller<input id="fx-scroller" maxlength="96" value="MAKE AMAZING ALIEN TECH"></label><button type="button" id="fx-text">Apply original text</button><label>Musical phrase (0–7)<input id="fx-phrase" type="number" min="0" max="7" value="2"></label><label>Arpeggio frequency multiplier<select id="fx-transpose"><option value="1">Original</option><option value="2">One octave up</option><option value="0.5">One octave down</option></select></label><button type="button" id="fx-music">Apply phrase variation</button><label>Visual cue lane<select id="fx-cue"><option value="3">Percussion</option><option value="0">Bass</option><option value="1">Lead</option><option value="2">Arpeggio</option></select></label><button type="button" id="fx-sync">Sync effects to cue lane</button></details>
  <div class="asset-buttons"><button type="button" id="fx-undo">Undo FX</button><button type="button" id="fx-redo">Redo FX</button></div><p id="fx-preview-state">Preview idle. Press Preview with sound, or choose a time and Preview at time. The production opens on black at 0 seconds.</p><canvas id="fx-preview" style="width:100%;height:200px;background:#000" aria-label="Demoscene effect preview"></canvas><div class="asset-buttons"><button type="button" id="fx-preview-play">Preview with sound</button><button type="button" id="fx-preview-stop">Pause</button><button type="button" id="fx-preview-seek">Preview at time</button></div><button type="button" id="fx-export">Export validated composition</button><label class="import">Import composition<input id="fx-import" type="file" accept=".json,application/json"></label><p>FX undo/redo keeps a separate composition history. Export it separately from the scene.</p><a href="../demoscene-lab/index.html">Open Demoscene Lab ↗</a></details>`;
  const $=id=>host.querySelector('#fx-'+id);let history=demoDraft(machineRemembers()),player=null,raf=0,generation=0,lastPlaying=false;
  if(location.hash==='#visual-fx')host.querySelector('details').open=true;
  const status=s=>$('status').textContent=s;
  function previewState(){
    if(!player)return;
    const transport=player.transport,out=$('preview-state');
    out.textContent=`Preview ${transport.playing?'playing':'paused'} at ${(transport.sample/48000).toFixed(2)} seconds`;
  }
  function pausePreview(){generation++;player?.transport.pause();cancelAnimationFrame(raf);previewState();}
  function sync(){
    const disabled=isPlaying();if(disabled&&!lastPlaying)pausePreview();lastPlaying=disabled;
    for(const c of host.querySelectorAll('button,input,select'))c.disabled=disabled;
    $('mode').hidden=!disabled;$('edit').hidden=!disabled;$('edit').disabled=false;
    $('add').disabled=disabled||!getSelection();
    for(const id of ['node','effect-apply','key'])$(id).disabled=disabled||!history.present.nodes.length;
    $('key').disabled||=!getSelection();
    $('undo').disabled=disabled||!history.past.length;$('redo').disabled=disabled||!history.future.length;
    $('preview-stop').disabled=disabled||!player;
  }
  $('edit').onclick=()=>{stopScene();sync();status('Visual FX editing ready. The authored scene and composition are preserved.');};
  function selectedNode(){const node=history.present.nodes.find(n=>n.id===$('node').value);if(node){$('effect').value=node.effect;$('copies').value=node.copies;}}
  $('node').onchange=selectedNode;
  function display(){const chosen=$('node').value;$('node').replaceChildren(...history.present.nodes.map(n=>{const o=document.createElement('option');o.value=n.id;o.textContent=n.id+' / '+n.name;return o;}));if(history.present.nodes.some(n=>n.id===chosen))$('node').value=chosen;selectedNode();sync();}
  function accept(project,message){const at=sample();history=commitDemo(history,project);generation++;if(player){cancelAnimationFrame(raf);player.load(history.present);player.transport.seek(at);player.draw(at);previewState();}display();status(message);}
  const run=fn=>async()=>{if(isPlaying())return;try{await fn();}catch(error){status('Rejected: '+error.message);}sync();};
  const sample=()=>demoSample(Math.round(Number($('time').value)*48000));
  $('add').onclick=run(()=>accept(addSelectedDemo(history.present,getScene(),getLibrary(),getSelection(),{effect:$('effect').value,copies:Number($('copies').value)}),'Selected geometry and declared provenance captured. Export to keep this sidecar.'));
  $('effect-apply').onclick=run(()=>accept(editDemoNode(history.present,$('node').value,{effect:$('effect').value,copies:Number($('copies').value)}),'Effect applied'));
  $('key').onclick=run(()=>accept(captureDemoKey(history.present,$('node').value,getScene(),getSelection(),sample()),'Inspector transform captured at sample '+sample()));
  $('camera-key').onclick=run(()=>accept(editDemoData(history.present,'timeline',t=>{const key={sample:sample(),position:$('camera').value.split(',').map(Number),target:$('target').value.split(',').map(Number),fov:1.05};t.camera=t.camera.filter(k=>k.sample!==key.sample);t.camera.push(key);t.camera.sort((a,b)=>a.sample-b.sample);}), 'Camera key applied'));
  $('text').onclick=run(()=>accept(editDemoData(history.present,'settings',s=>{s.text.title=$('title').value;s.text.scroller=$('scroller').value;}),'3D typography applied'));
  $('music').onclick=run(()=>accept(editDemoData(history.present,'phrase-'+Number($('phrase').value),p=>{p.notes[2]=p.notes[2].map(n=>Math.round(n*Number($('transpose').value)));}),'Integer score phrase changed; cues follow the score'));
  $('sync').onclick=run(()=>accept(editDemoData(history.present,'timeline',t=>t.cueChannel=Number($('cue').value)),'Effect envelopes now follow the selected voice'));
  for(const direction of ['undo','redo'])$(direction).onclick=run(()=>{history=travelDemo(history,direction);pausePreview();if(player){player.load(history.present);player.draw();previewState();}display();status('FX '+direction);});
  function preview(){player??=new DemoPlayer($('preview'),history.present);return player;}
  function tick(){if(!player)return;player.draw();previewState();if(player.transport.playing)raf=requestAnimationFrame(tick);}
  $('preview-play').onclick=run(async()=>{
    const at=sample();pausePreview();const token=generation,p=preview(),transport=p.transport;
    await transport.seek(at);if(token!==generation||isPlaying()||document.hidden)return;
    await transport.play();if(token!==generation)return;
    tick();status('Previewing the same effects used by the production');
  });
  $('preview-stop').onclick=run(()=>{pausePreview();status('Preview paused. Choose a time to seek, or Preview with sound to play again.');});
  $('preview-seek').onclick=run(async()=>{const at=sample();pausePreview();const p=preview();await p.transport.seek(at);p.draw();previewState();status('Absolute-time preview at sample '+sample());});
  $('export').onclick=run(()=>{const url=URL.createObjectURL(new Blob([history.present.bytes],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='visual-fx.demoscene.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Validated project exported with source declarations');});
  $('import').onchange=run(async()=>{const token=++generation,file=$('import').files[0];$('import').value='';if(!file)return;if(file.size>32768)throw Error('32 KiB project limit');const project=validateDemo(await file.text());if(token!==generation||isPlaying())return;accept(project,'Composition imported. Geometry, effects, keys and provenance retained.');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pausePreview();});
  window.addEventListener('pagehide',event=>{pausePreview();if(!event.persisted&&player)void player.dispose();});display();return {sync,snapshot:()=>history.present.bytes};
}
