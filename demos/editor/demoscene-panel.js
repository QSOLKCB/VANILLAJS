// SPDX-License-Identifier: Apache-2.0
import {machineRemembers} from '../demoscene-lab/preset.js';
import {DemoPlayer} from '../demoscene-lab/player.js';
import {validateDemo,DEMO_EFFECTS} from '../../modules/mod-demo/index.js';
import {demoSample} from '../../modules/demo-timeline/index.js';
import {demoDraft,commitDemo,travelDemo,addSelectedDemo,editDemoNode,captureDemoKey,editDemoData} from './demoscene-workflow.js';
export function mountDemoscenePanel(host,{getScene,getLibrary,getSelection,isPlaying,stopScene}){
  let history=demoDraft(machineRemembers());
  // Dynamic labels are text nodes; no value is parsed as HTML.
  const element=(tag,attributes,...children)=>{
    const node=document.createElement(tag);
    for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);
    node.append(...children);return node;
  };
  host.replaceChildren(element("details",{"id":"visual-fx","class":"demoscene-panel"},
      element("summary",{},
        "Demoscene / Visual FX"),
      element("p",{},
        "Use the hierarchy, transform inspector and Asset Foundry above. Selected objects and visible descendants become an inert audiovisual composition. Flat materials only; existing scene formats stay compatible."),
      element("div",{"class":"fx-feedback"},
        element("p",{"id":"fx-mode","role":"status","hidden":""},
          "Scene Play locks Visual FX editing, including when paused. Stop the scene to use these controls."),
        element("button",{"type":"button","id":"fx-edit","hidden":""},
          "Stop scene & edit Visual FX"),
        element("p",{"id":"fx-status","role":"status","aria-live":"polite"},
          "Original production template ready. Add a selected object, then preview or export the composition.")),
      element("label",{},
        "Effect",
        element("select",{"id":"fx-effect"})),
      element("label",{},
        "Copies",
        element("input",{"id":"fx-copies","type":"number","min":"1","max":"48","value":"1"})),
      element("button",{"type":"button","id":"fx-add"},
        "Add selected object / prefab"),
      element("label",{},
        "Composition object",
        element("select",{"id":"fx-node"})),
      element("button",{"type":"button","id":"fx-effect-apply"},
        "Apply effect & copies"),
      element("label",{},
        "Time in seconds",
        element("input",{"id":"fx-time","type":"number","min":"0","max":"60","step":".02","value":"0"})),
      element("button",{"type":"button","id":"fx-key"},
        "Capture inspector transform + colour as keyframe"),
      element("p",{},
        "Move, rotate, scale and recolour the selected object in the main inspector, then capture at another time. Up to eight ordered keys."),
      element("details",{},
        element("summary",{},
          "Camera, typography & music"),
        element("label",{},
          "Camera XYZ",
          element("input",{"id":"fx-camera","value":"0, 4, 30"})),
        element("label",{},
          "Camera target XYZ",
          element("input",{"id":"fx-target","value":"0, 3, 0"})),
        element("button",{"type":"button","id":"fx-camera-key"},
          "Set camera key at time"),
        element("label",{},
          "3D title",
          element("input",{"id":"fx-title","value":"VANILLAJS","maxlength":"32"})),
        element("label",{},
          "Scroller",
          element("input",{"id":"fx-scroller","maxlength":"96","value":"MAKE AMAZING ALIEN TECH"})),
        element("button",{"type":"button","id":"fx-text"},
          "Apply original text"),
        element("label",{},
          "Musical phrase (0–7)",
          element("input",{"id":"fx-phrase","type":"number","min":"0","max":"7","value":"2"})),
        element("label",{},
          "Arpeggio frequency multiplier",
          element("select",{"id":"fx-transpose"},
            element("option",{"value":"1"},
              "Original"),
            element("option",{"value":"2"},
              "One octave up"),
            element("option",{"value":"0.5"},
              "One octave down"))),
        element("button",{"type":"button","id":"fx-music"},
          "Apply phrase variation"),
        element("label",{},
          "Visual cue lane",
          element("select",{"id":"fx-cue"},
            element("option",{"value":"3"},
              "Percussion"),
            element("option",{"value":"0"},
              "Bass"),
            element("option",{"value":"1"},
              "Lead"),
            element("option",{"value":"2"},
              "Arpeggio"))),
        element("button",{"type":"button","id":"fx-sync"},
          "Sync effects to cue lane")),
      element("div",{"class":"asset-buttons"},
        element("button",{"type":"button","id":"fx-undo"},
          "Undo FX"),
        element("button",{"type":"button","id":"fx-redo"},
          "Redo FX")),
      element("p",{"id":"fx-preview-state"},
        "Preview idle. Press Preview with sound, or choose a time and Preview at time. The production opens on black at 0 seconds."),
      element("canvas",{"id":"fx-preview","style":"width:100%;height:200px;background:#000","aria-label":"Demoscene effect preview"}),
      element("div",{"class":"asset-buttons"},
        element("button",{"type":"button","id":"fx-preview-play"},
          "Preview with sound"),
        element("button",{"type":"button","id":"fx-preview-stop"},
          "Pause"),
        element("button",{"type":"button","id":"fx-preview-seek"},
          "Preview at time")),
      element("button",{"type":"button","id":"fx-export"},
        "Export validated composition"),
      element("label",{"class":"import"},
        "Import composition",
        element("input",{"id":"fx-import","type":"file","accept":".json,application/json"})),
      element("p",{},
        "FX undo/redo keeps a separate composition history. Export it separately from the scene."),
      element("a",{"href":"../demoscene-lab/index.html"},
        "Open Demoscene Lab ↗")));
  const $=id=>host.querySelector('#fx-'+id);
  $('effect').replaceChildren(...DEMO_EFFECTS.map(effect=>element('option',{value:effect},effect)));
  let player=null,raf=0,generation=0,lastPlaying=false;
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
    const at=sample();pausePreview();const token=generation,p=preview(),transport=p.transport;sync();
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
