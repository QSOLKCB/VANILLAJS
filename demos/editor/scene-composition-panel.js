// SPDX-License-Identifier: Apache-2.0
import {validateSceneGraph,serializeSceneGraph,sampleSceneGraph,SCENE_GRAPH_BYTES} from '../../modules/scene-graph/index.js';
import {captureComposition,compositionExample,compositionHistory,commitComposition,travelComposition,editCompositionNode,captureCompositionKey,saveCompositionPrefab,addCompositionInstance} from './scene-composition.js';
import {SceneCompositionPreview} from './scene-composition-preview.js';
export function mountSceneComposition(host,{getScene,getSelection,isPlaying,stopScene}){
  const factories={details:()=>document.createElement('details'),summary:()=>document.createElement('summary'),p:()=>document.createElement('p'),button:()=>document.createElement('button'),label:()=>document.createElement('label'),input:()=>document.createElement('input'),div:()=>document.createElement('div'),select:()=>document.createElement('select'),option:()=>document.createElement('option'),output:()=>document.createElement('output'),hr:()=>document.createElement('hr'),canvas:()=>document.createElement('canvas'),textarea:()=>document.createElement('textarea'),a:()=>document.createElement('a')};
  const element=(tag,attributes={},...children)=>{if(!Object.hasOwn(factories,tag))throw new TypeError('unsupported UI element');const n=factories[tag]();for(const [k,v]of Object.entries(attributes))n.setAttribute(k,v);n.append(...children);return n;};
  const el=(tag,id,attributes={},...children)=>element(tag,{id:'sc-'+id,...attributes},...children),button=(id,text)=>el('button',id,{type:'button'},text),field=(id,title,value,attributes={})=>element('label',{},title,el('input',id,{value,...attributes}));
  const details=element('details',{id:'scene-composition',class:'scene-composition-panel'},
    element('summary',{},'Scene Composition · hierarchy & animation'),
    element('p',{},'A reusable scene sidecar. Capture the Workbench hierarchy, edit full transforms, keyframe motion and nest prefabs. The scene above and its physics remain unchanged.'),
    el('p','status',{role:'status','aria-live':'polite'},'Original Lantern Assembly ready. Preview at a time, or capture your current Workbench scene.'),
    el('p','locked',{hidden:''},'Scene Play locks composition editing. Stop the scene to continue.'),button('stop-scene','Stop scene & edit composition'),
    element('div',{class:'asset-buttons'},button('capture','Capture Workbench hierarchy'),button('example','Load Lantern Assembly')),
    element('label',{},'Composition node',el('select','node')),
    element('label',{},'Parent',el('select','parent')),
    field('position','Local position XYZ · metres','0, 0, 0'),field('rotation','Local rotation · quaternion XYZW','0, 0, 0, 1'),field('scale','Local scale XYZ','1, 1, 1'),
    field('colour','Appearance colour','#80cca6',{type:'color'}),field('roughness','Roughness metadata (0–1)', '.8',{type:'number',min:'0',max:'1',step:'.05'}),
    element('label',{},el('input','visible',{type:'checkbox',checked:''}),' Visible'),element('label',{},el('input','mesh',{type:'checkbox',checked:''}),' Box mesh enabled'),
    button('apply-node','Apply local transform & appearance'),
    element('details',{},element('summary',{},'Camera & light components'),
      element('label',{},el('input','camera',{type:'checkbox'}),' Use as camera'),field('fov','Camera field of view · degrees','60',{type:'number',min:'12',max:'126',step:'1'}),
      element('label',{},'Light metadata',el('select','light',{},element('option',{value:'none'},'No light'),element('option',{value:'ambient'},'Ambient preview tint'),element('option',{value:'directional'},'Directional descriptor'))),
      field('light-colour','Light colour','#ffffff',{type:'color'}),field('intensity','Light intensity','1',{type:'number',min:'0',max:'4',step:'.1'}),button('apply-components','Apply camera & light'),
      element('p',{},'The first visible camera drives this preview. Ambient lights tint box colours. Directional light and roughness are exported metadata; this preview uses the existing flat-colour renderer.')),
    el('output','world',{'aria-live':'polite'},''),
    element('hr'),field('time','Timeline · seconds','0',{type:'number',min:'0',max:'300',step:'.1'}),
    element('div',{class:'asset-buttons'},button('key','Keyframe composition transform'),button('inspector-key','Keyframe selected inspector transform')),
    el('p','keys',{},'No keys'),button('clear-track','Remove selected node track'),
    el('canvas','preview',{'aria-label':'Scene composition preview'}),
    el('p','preview-state',{'aria-live':'polite'},'Preview idle'),
    element('div',{class:'asset-buttons'},button('seek','Preview at time'),button('play','Play animation'),button('pause','Pause'),button('restart','Restart preview')),
    element('details',{},element('summary',{},'Reusable & nested prefabs'),
      field('prefab-id','Save selected subtree as prefab ID','lantern'),button('save-prefab','Save selected subtree'),
      element('label',{},'Prefab to instance',el('select','prefab')),field('instance-id','Instance ID','instance-1'),
      field('instance-position','Instance offset XYZ · metres','3, 0, 0'),element('label',{},'Add instance to',el('select','container')),button('instance','Add prefab instance'),
      element('p',{},'Instances are independent identities. Nest one prefab inside another using Add instance to. Cycles and expansion beyond 128 nodes are rejected. Instance children are edited through their prefab data.')),
    element('div',{class:'asset-buttons'},button('undo','Undo composition'),button('redo','Redo composition')),
    button('export','Export scene composition'),element('label',{class:'import'},'Import composition',el('input','import',{type:'file',accept:'.json,application/json'})),
    element('details',{},element('summary',{},'Inspect validated JSON'),el('textarea','json',{rows:'10',spellcheck:'false','aria-label':'Scene composition JSON'}),button('apply-json','Validate & apply JSON')),
    element('p',{},'Export this sidecar separately. It contains box geometry descriptors, hierarchy, components, prefabs and keyframes; no scripts, physics runtime, imported mesh/texture payloads or complete game.'),
    element('a',{href:'../../docs/SCENE_COMPOSITION.md'},'Scene composition tutorial ↗'));
  host.replaceChildren(details);const $=id=>host.querySelector('#sc-'+id);
  let history=compositionHistory(compositionExample()),preview=null,raf=0,running=false,last=null,time=0,generation=0,lastPlaying=false,disposed=false,selected='lantern';
  const status=s=>$('status').textContent=s,vec=id=>$(id).value.split(',').map(x=>Number(x.trim())),rgb=id=>[1,3,5].map(i=>parseInt($(id).value.slice(i,i+2),16)/255),hex=c=>'#'+c.map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
  function pause(){running=false;last=null;cancelAnimationFrame(raf);raf=0;$('preview-state').textContent='Paused at '+time.toFixed(2)+' seconds';}
  function chosen(){return history.present.nodes.find(n=>n.id===selected);}
  function sync(){
    const locked=isPlaying();if(locked&&!lastPlaying)pause();lastPlaying=locked;
    for(const c of host.querySelectorAll('button,input,select,textarea'))c.disabled=locked;
    $('locked').hidden=!locked;$('stop-scene').hidden=!locked;$('stop-scene').disabled=false;
    $('undo').disabled=locked||!history.past.length;$('redo').disabled=locked||!history.future.length;
    for(const key of ['apply-node','apply-components','save-prefab'])$(key).disabled=locked||!chosen();
    $('inspector-key').disabled=locked||!getSelection()||!selected;
    $('instance').disabled=locked||!history.present.prefabs.length;
    $('key').disabled=locked||!selected;$('clear-track').disabled=locked||!history.present.tracks.some(t=>t.node===selected);
  }
  function readNode(){
    const n=chosen()??sampleSceneGraph(history.present,0).find(n=>n.id===selected);if(!n)return;
    $('position').value=n.transform.position.join(', ');$('rotation').value=n.transform.rotation.join(', ');$('scale').value=n.transform.scale.join(', ');$('colour').value=hex(n.components.appearance.color);$('roughness').value=n.components.appearance.roughness;$('visible').checked=n.visible;$('mesh').checked=n.components.mesh.enabled;
    $('camera').checked=!!n.components.camera;$('fov').value=n.components.camera?(n.components.camera.fov*180/Math.PI).toFixed(2):60;
    $('light').value=n.components.light?.kind??'none';$('light-colour').value=hex(n.components.light?.color??[1,1,1]);$('intensity').value=n.components.light?.intensity??1;
    $('parent').replaceChildren(element('option',{value:''},'Scene root'),...history.present.nodes.filter(o=>o.id!==selected).map(o=>element('option',{value:o.id},o.name)),...history.present.instances.filter(i=>i.id!==selected).map(i=>element('option',{value:i.id},i.id)));
    $('parent').value=n.parent??'';$('keys').textContent='Key times: '+(history.present.tracks.find(t=>t.node===selected)?.keys.map(k=>k.time+' s').join(' · ')??'none');sync();
  }
  function display(){
    const world=sampleSceneGraph(history.present,0);if(!world.some(n=>n.id===selected))selected=world[0]?.id??'';
    $('node').replaceChildren(...world.map(n=>element('option',{value:n.id},n.id+' · '+n.name)));$('node').value=selected;
    $('prefab').replaceChildren(...history.present.prefabs.map(p=>element('option',{value:p.id},p.id)));
    $('container').replaceChildren(element('option',{value:''},'Scene root'),...history.present.prefabs.map(p=>element('option',{value:p.id},'Inside '+p.id)));
    $('time').max=history.present.duration;$('json').value=serializeSceneGraph(history.present);readNode();sync();
  }
  function draw(){
    preview??=new SceneCompositionPreview($('preview'),history.present);const result=preview.draw(time),n=result.world.find(n=>n.id===selected);
    $('world').textContent=n?'World XYZ: '+n.position.map(n=>n.toFixed(3)).join(', '):'No node selected';
    $('preview-state').textContent=(running?'Playing':'Preview')+' at '+time.toFixed(2)+' s · '+result.nodes+' nodes · camera '+result.camera;
  }
  function accept(graph,message){
    const next=validateSceneGraph(graph),nextHistory=commitComposition(history,next);if(preview)preview.load(next);
    pause();generation++;history=nextHistory;time=Math.min(time,next.duration);$('time').value=time;display();status(message);
    if(details.open)try{draw();}catch(error){status('Accepted data. Preview unavailable: '+error.message);}
  }
  const run=fn=>async()=>{if(isPlaying()||disposed)return;try{await fn();}catch(error){status('Rejected: '+error.message);}sync();};
  $('stop-scene').onclick=()=>{stopScene();sync();};
  $('capture').onclick=run(()=>accept(captureComposition(getScene()),'Workbench hierarchy captured. Source scene and physics remain unchanged.'));
  $('example').onclick=run(()=>{selected='lantern';accept(compositionExample(),'Original Lantern Assembly restored.');});
  $('node').onchange=()=>{selected=$('node').value;readNode();if(preview)try{draw();}catch(error){status(error.message);}};
  $('apply-node').onclick=run(()=>{const n=chosen();if(!n)throw Error('Select a directly authored node');accept(editCompositionNode(history.present,selected,{parent:$('parent').value||null,transform:{position:vec('position'),rotation:vec('rotation'),scale:vec('scale')},components:{...n.components,mesh:{enabled:$('mesh').checked},appearance:{color:rgb('colour'),roughness:Number($('roughness').value)}},visible:$('visible').checked}),'Local transform and appearance accepted. Existing keys still override this base pose during preview.');});
  $('apply-components').onclick=run(()=>{const n=chosen();if(!n)throw Error('Select a directly authored node');accept(editCompositionNode(history.present,selected,{components:{...n.components,camera:$('camera').checked?{fov:Number($('fov').value)*Math.PI/180,near:.05,far:1000}:null,light:$('light').value==='none'?null:{kind:$('light').value,color:rgb('light-colour'),intensity:Number($('intensity').value)}}}),'Camera/light descriptors accepted.');});
  function captureOwnKey(){const next=validateSceneGraph(history.present),n=next.nodes.find(n=>n.id===selected)??sampleSceneGraph(next,0).find(n=>n.id===selected);if(!n)throw Error('Select a node');const at=Number($('time').value);let track=next.tracks.find(t=>t.node===selected);if(!track){track={node:selected,keys:[]};next.tracks.push(track);}track.keys=track.keys.filter(k=>k.time!==at);track.keys.push({time:at,transform:n.transform});track.keys.sort((a,b)=>a.time-b.time);accept(next,'Composition transform captured at '+at+' seconds.');}
  $('key').onclick=run(captureOwnKey);
  $('inspector-key').onclick=run(()=>accept(captureCompositionKey(history.present,selected,getScene(),getSelection(),Number($('time').value)),'Selected inspector transform captured.'));
  $('clear-track').onclick=run(()=>{const next=validateSceneGraph(history.present);next.tracks=next.tracks.filter(t=>t.node!==selected);accept(next,'Selected track removed. Base pose now controls this node.');});
  function seek(at){const before=time;time=at;try{draw();}catch(error){time=before;throw error;}}
  $('seek').onclick=run(()=>{pause();seek(Number($('time').value));});
  function tick(now){if(!running)return;if(last!==null)time=Math.min(history.present.duration,time+Math.max(0,Math.min(.1,(now-last)/1000)));last=now;$('time').value=time.toFixed(2);try{draw();}catch(error){pause();status('Preview stopped: '+error.message);return;}if(time>=history.present.duration)pause();else raf=requestAnimationFrame(tick);}
  $('play').onclick=run(()=>{pause();const at=Number($('time').value);seek(at===history.present.duration?0:at);running=true;last=null;raf=requestAnimationFrame(tick);});
  $('pause').onclick=pause;$('restart').onclick=run(()=>{pause();time=0;$('time').value='0';draw();});
  $('save-prefab').onclick=run(()=>accept(saveCompositionPrefab(history.present,selected,$('prefab-id').value),'Reusable subtree saved in this composition.'));
  $('instance').onclick=run(()=>accept(addCompositionInstance(history.present,{id:$('instance-id').value,prefab:$('prefab').value,position:vec('instance-position'),container:$('container').value||null}),'Prefab instance added with independent identities.'));
  for(const direction of ['undo','redo'])$(direction).onclick=run(()=>{const next=travelComposition(history,direction);if(preview)preview.load(next.present);history=next;pause();generation++;time=Math.min(time,history.present.duration);$('time').value=time;display();if(details.open)draw();status('Composition '+direction);});
  $('export').onclick=run(()=>{const url=URL.createObjectURL(new Blob([serializeSceneGraph(history.present)],{type:'application/json'})),a=element('a',{href:url,download:'scene-composition.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Validated scene sidecar exported. Keep it beside your own renderer/game adapter.');});
  $('import').onchange=run(async()=>{const file=$('import').files[0],token=++generation;$('import').value='';if(!file)return;if(file.size>SCENE_GRAPH_BYTES)throw Error('256 KiB composition limit');const candidate=validateSceneGraph(await file.text());if(token!==generation||isPlaying()||disposed)return;accept(candidate,'Scene composition imported.');});
  $('apply-json').onclick=run(()=>accept($('json').value,'JSON validated and accepted.'));
  const controller=new AbortController(),listen=(target,event,fn)=>target.addEventListener(event,fn,{signal:controller.signal});
  listen(window,'blur',pause);listen(document,'visibilitychange',()=>{if(document.hidden)pause();});listen(window,'pagehide',event=>{pause();generation++;if(!event.persisted)dispose();});
  listen($('preview'),'webglcontextlost',event=>{event.preventDefault();pause();preview?.dispose();preview=null;status('Graphics context lost. Data and exports are preserved. Wait for restore, then preview again.');});
  listen(details,'toggle',()=>{if(!details.open)pause();});
  function dispose(){if(disposed)return;disposed=true;pause();generation++;controller.abort();preview?.dispose();preview=null;}
  if(location.hash==='#scene-composition')details.open=true;
  display();return {sync,dispose,snapshot:()=>({graph:validateSceneGraph(history.present),time,running,selected,past:history.past.length,future:history.future.length,preview:preview?.stats()??null})};
}
