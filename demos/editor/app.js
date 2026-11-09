// SPDX-License-Identifier: Apache-2.0
// VANILLAJS Workbench v0.1: DOM is the adapter; project/simulation stay pure.
import {WebGLAPI} from '../../api/webgl/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {createScene,validateScene,addEntity,updateEntity,removeEntity,
  duplicateEntity,sceneWorld,serializeScene,parseScene,makeHistory,commitHistory,
  undoHistory,redoHistory} from './model.js';
import {cameraMatrix,cameraRay,pickObject,createGridVertices,createSceneVertices,
  displayWorld} from './viewport.js';
import {PREVIEW_DT,createPreview,stepPreview} from './preview.js';

const $=id=>document.getElementById(id),canvas=$('view');
let history=makeHistory(createScene()),selected='entity-3',draft=null,
  camera={yaw:38,pitch:23,distance:18,target:[0,1,0]},api=null,grid=null,mesh=null,
  playing=false,paused=false,simulation=null,geometryDirty=true,frameId=0,
  lastTime=null,rendered=0,gesture=null;
const keys=new Set(),clock=new FixedClock({step:PREVIEW_DT,maxFrame:.12,maxSteps:8});
const editorIds=['new-scene','add','add-child','duplicate','remove','undo','redo','scene-name','open'];
const editScene=()=>draft??history.present;
const max=(v,a,b)=>Math.max(a,Math.min(b,v));
function inform(message,error=false){
  $('status').textContent=message;
  $('status').style.color=error?'#ffb6a4':'';
}
function resetKeys(){keys.clear();}
function markGeometry(){geometryDirty=true;requestFrame();}
function requestFrame(){if(!frameId)frameId=requestAnimationFrame(frame);}
function syncEditor(){
  const scene=editScene(),byId=new Map(scene.objects.map(e=>[e.id,e]));
  if(selected&&!byId.has(selected))selected=null;
  $('scene-name').value=scene.name;$('active-scene').textContent=scene.name;
  $('count').textContent=String(scene.objects.length);
  $('selection-name').textContent=selected?(byId.get(selected)?.name??''):'No selection';
  $('mode').textContent=playing?(paused?'PAUSED':'PLAY'):'EDIT';
  $('play').disabled=playing;$('pause').disabled=!playing;
  $('pause').textContent=paused?'Resume':'Pause';
  $('stop').disabled=!playing;
  for(const id of editorIds)$(id).disabled=playing;
  $('undo').disabled=playing||history.past.length===0;
  $('redo').disabled=playing||history.future.length===0;
  $('properties').hidden=!selected;$('empty').hidden=!!selected;
  for(const el of $('properties').querySelectorAll('input,select'))el.disabled=playing;
  const hierarchy=$('hierarchy');hierarchy.replaceChildren();
  const visit=(parent,depth)=>{
    for(const e of scene.objects.filter(e=>e.parent===parent)){
      const row=document.createElement('button');
      row.type='button';row.setAttribute('role','treeitem');
      row.setAttribute('aria-selected',String(e.id===selected));
      row.dataset.id=e.id;row.style.paddingLeft=(7+depth*14)+'px';
      if(!e.visible)row.classList.add('hidden');
      const glyph=document.createElement('span');glyph.textContent=e.parent?'└':'◇';
      const name=document.createElement('span');name.textContent=e.name;
      const type=document.createElement('small');type.className='type';
      type.textContent=e.body==='player'?'PLAYER':e.body==='dynamic'?'DYNAMIC':'BOX';
      row.append(glyph,name,type);row.addEventListener('click',()=>select(e.id));
      hierarchy.append(row);visit(e.id,depth+1);
    }
  };visit(null,0);
  if(!selected){requestFrame();return;}
  const e=byId.get(selected);
  $('object-name').value=e.name;$('object-body').value=e.body;
  $('object-visible').checked=e.visible;$('object-yaw').value=e.rotationY;
  $('object-color').value='#'+e.color.map(c=>Math.round(c*255).toString(16).padStart(2,'0')).join('');
  for(const el of $('properties').querySelectorAll('[data-axis]')){
    el.value=e[el.dataset.axis][Number(el.dataset.i)];
  }
  const parentSelect=$('object-parent');parentSelect.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='Scene root';parentSelect.append(empty);
  for(const parent of scene.objects)if(parent.id!==selected){
    const o=document.createElement('option');o.value=parent.id;o.textContent=parent.name;
    parentSelect.append(o);
  }
  parentSelect.value=e.parent??'';
  requestFrame();
}
function select(id){
  if(selected===id)return;
  selected=id;markGeometry();syncEditor();
}
function applyScene(next,selection=selected){
  if(playing)return;
  try{
    const verified=validateScene(next);
    history=commitHistory(history,verified);draft=null;selected=selection;
    markGeometry();syncEditor();inform('Scene updated · '+verified.objects.length+' entities');
  }catch(error){inform(error.message,true);syncEditor();}
}
function add(parent=null){
  const before=editScene();
  try{applyScene(addEntity(before,{parent}), 'entity-'+before.nextId);}
  catch(error){inform(error.message,true);}
}
$('add').addEventListener('click',()=>add());
$('add-child').addEventListener('click',()=>add(selected));
$('duplicate').addEventListener('click',()=>{
  if(!selected)return;
  try{const {scene,selected:id}=duplicateEntity(editScene(),selected);applyScene(scene,id);}
  catch(error){inform(error.message,true);}
});
$('remove').addEventListener('click',()=>{
  if(selected)try{applyScene(removeEntity(editScene(),selected),null);}
    catch(error){inform(error.message,true);}
});
$('undo').addEventListener('click',()=>{if(playing)return;history=undoHistory(history);
  draft=null;markGeometry();syncEditor();inform('Undo');});
$('redo').addEventListener('click',()=>{if(playing)return;history=redoHistory(history);
  draft=null;markGeometry();syncEditor();inform('Redo');});
$('scene-name').addEventListener('change',()=>{
  const scene=editScene();applyScene({...scene,name:$('scene-name').value});
});
$('new-scene').addEventListener('click',()=>{
  if(!confirm('Start a new scene? Save your current JSON project first if needed.'))return;
  history=makeHistory(createScene());selected='entity-3';draft=null;
  markGeometry();syncEditor();inform('New scene created');
});
function download(name,content){
  const blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
$('save').addEventListener('click',()=>{
  const scene=editScene();download('vanillajs-'+scene.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.vscene.json',
    serializeScene(scene));inform('Scene saved to a local JSON file');
});
$('open').addEventListener('change',async event=>{
  if(playing)return;
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
    if(file.size>128*1024)throw new RangeError('scene exceeds 128 KiB');
    const scene=parseScene(await file.text());
    history=makeHistory(scene);selected=scene.objects[0]?.id??null;draft=null;
    markGeometry();syncEditor();inform('Loaded validated scene · '+file.name);
  }catch(error){inform('Scene rejected: '+error.message,true);}
});
$('properties').addEventListener('change',event=>{
  if(!selected||playing)return;
  const target=event.target,entity=editScene().objects.find(e=>e.id===selected);
  if(!entity)return;
  let patch;
  if(target.dataset.axis){
    const name=target.dataset.axis,vector=[...entity[name]];
    vector[Number(target.dataset.i)]=Number(target.value);
    patch={[name]:vector};
  }else if(target.id==='object-color'){
    const h=target.value;
    patch={color:[0,2,4].map(i=>parseInt(h.slice(i+1,i+3),16)/255)};
  }else if(target.id==='object-visible')patch={visible:target.checked};
  else if(target.id==='object-parent')patch={parent:target.value||null};
  else if(target.id==='object-yaw')patch={rotationY:Number(target.value)};
  else if(target.id==='object-name')patch={name:target.value};
  else if(target.id==='object-body')patch={body:target.value};
  if(!patch)return;
  try{applyScene(updateEntity(editScene(),selected,patch));}
  catch(error){inform('Edit rejected: '+error.message,true);syncEditor();}
});
function initGraphics(){
  api=new WebGLAPI(canvas);
  grid=api.createMesh(createGridVertices(),'lines');
  mesh=api.createMesh([], 'triangles');
  geometryDirty=true;
}
function input(){
  return {x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-
    Number(keys.has('KeyA')||keys.has('ArrowLeft')),
    z:Number(keys.has('KeyS')||keys.has('ArrowDown'))-
    Number(keys.has('KeyW')||keys.has('ArrowUp')),jump:keys.has('Space')};
}
function frame(now){
  frameId=0;
  if(playing&&!paused){
    const dt=lastTime===null?0:max((now-lastTime)/1000,0,.12);
    lastTime=now;
    try{clock.advance(dt,()=>{simulation=stepPreview(history.present,simulation,input());
      geometryDirty=true;});}
    catch(error){inform('Play preview stopped: '+error.message,true);stop();}
  }
  try{
    if(api){
      const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
      const width=Math.max(1,Math.round(rect.width*dpr)),
        height=Math.max(1,Math.round(rect.height*dpr));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      if(geometryDirty){
        const world=displayWorld(history.present===editScene()?history.present:editScene(),
          playing?simulation:null);
        api.updateMesh(mesh,createSceneVertices(world,playing?null:selected));
        geometryDirty=false;
      }
      api.beginFrame({vp:cameraMatrix(camera,width,height),fog:.008});
      api.draw(grid);api.draw(mesh);api.endFrame();
      rendered++;
      const metrics=api.stats();
      $('stats').textContent=rendered+' frames · '+metrics.uploadedBytes+
        ' bytes uploaded · '+metrics.drawCalls+' draw calls';
    }
  }catch(error){inform('Renderer: '+error.message,true);}
  if(playing&&!paused)requestFrame();
}
function start(){
  try{
    simulation=createPreview(history.present);playing=true;paused=false;
    clock.reset();clock.setPaused(false);lastTime=null;resetKeys();
    markGeometry();syncEditor();inform('Playing immutable scene snapshot · WASD to move, Space to jump');
    canvas.focus({preventScroll:true});
  }catch(error){inform(error.message,true);}
}
function stop(){
  if(!playing)return;
  playing=false;paused=false;simulation=null;lastTime=null;
  clock.setPaused(true);resetKeys();markGeometry();syncEditor();
  inform('Stopped · authored scene restored unchanged');
}
function togglePause(){
  if(!playing)return;
  paused=!paused;clock.setPaused(paused);lastTime=null;resetKeys();
  syncEditor();requestFrame();inform(paused?'Play preview paused':'Play preview resumed');
}
$('play').addEventListener('click',start);
$('stop').addEventListener('click',stop);
$('pause').addEventListener('click',togglePause);
$('frame').addEventListener('click',()=>{
  camera={yaw:38,pitch:23,distance:18,target:[0,1,0]};requestFrame();
});
function planeContact(ray,y){
  if(Math.abs(ray.dir[1])<1e-9)return null;
  const t=(y-ray.origin[1])/ray.dir[1];
  if(t<=0||!Number.isFinite(t))return null;
  return [ray.origin[0]+ray.dir[0]*t,y,ray.origin[2]+ray.dir[2]*t];
}
const mouseRay=event=>{
  const rect=canvas.getBoundingClientRect();
  return cameraRay(camera,event.clientX-rect.left,event.clientY-rect.top,
    rect.width,rect.height);
};
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown',event=>{
  if(!api||event.button===1||event.button===2||(event.altKey&&event.button===0)){
    if(!api)return;
    gesture={kind:'orbit',x:event.clientX,y:event.clientY};
  }else if(event.button===0){
    if(!playing&&event.shiftKey&&selected){
      const e=editScene().objects.find(e=>e.id===selected);
      if(e&&e.parent===null){
        const world=sceneWorld(editScene()).find(o=>o.id===selected),
          hit=planeContact(mouseRay(event),world.position[1]);
        if(hit)gesture={kind:'move',scene:history.present,entity:e,hit};
      }
    }
    if(!gesture&&!playing){
      const chosen=pickObject(displayWorld(editScene()),mouseRay(event));
      select(chosen);
    }
  }
  if(gesture){canvas.setPointerCapture(event.pointerId);event.preventDefault();}
  canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointermove',event=>{
  if(!gesture)return;
  if(gesture.kind==='orbit'){
    camera.yaw+=.35*(event.clientX-gesture.x);
    camera.pitch=max(camera.pitch+.30*(event.clientY-gesture.y),-80,80);
    gesture.x=event.clientX;gesture.y=event.clientY;requestFrame();
  }else if(gesture.kind==='move'&&!playing){
    const hit=planeContact(mouseRay(event),gesture.entity.position[1]);
    if(!hit)return;
    const pos=[gesture.entity.position[0]+hit[0]-gesture.hit[0],
      gesture.entity.position[1],gesture.entity.position[2]+hit[2]-gesture.hit[2]];
    pos[0]=max(Math.round(pos[0]*10)/10,-1000,1000);
    pos[2]=max(Math.round(pos[2]*10)/10,-1000,1000);
    try{draft=updateEntity(gesture.scene,selected,{position:pos});markGeometry();}
    catch(error){inform(error.message,true);}
  }
});
function finishGesture(commit){
  if(gesture?.kind==='move'){
    const next=draft;draft=null;
    if(commit&&next)applyScene(next);
    else{markGeometry();syncEditor();}
  }
  gesture=null;
}
canvas.addEventListener('pointerup',()=>finishGesture(true));
canvas.addEventListener('pointercancel',()=>finishGesture(false));
canvas.addEventListener('lostpointercapture',()=>{if(gesture)finishGesture(false);});
canvas.addEventListener('wheel',event=>{
  event.preventDefault();camera.distance=max(camera.distance*Math.exp(event.deltaY*.001),3,80);
  requestFrame();
},{passive:false});
window.addEventListener('keydown',event=>{
  const field=event.target instanceof HTMLElement&&(
    event.target.matches('input,textarea,select')||event.target.isContentEditable);
  if((event.ctrlKey||event.metaKey)&&!playing){
    if(event.code==='KeyZ'){event.preventDefault();
      history=event.shiftKey?redoHistory(history):undoHistory(history);
      draft=null;markGeometry();syncEditor();return;}
    if(event.code==='KeyY'){event.preventDefault();
      history=redoHistory(history);draft=null;markGeometry();syncEditor();return;}
  }
  if(field)return;
  if(event.code==='Escape'){
    if(playing)togglePause();else{selected=null;markGeometry();syncEditor();}
    return;
  }
  if(!playing&&(event.code==='Delete'||event.code==='Backspace')&&selected){
    event.preventDefault();applyScene(removeEntity(editScene(),selected),null);return;
  }
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)&&
    (playing||document.activeElement===canvas))event.preventDefault();
  keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{resetKeys();if(playing&&!paused)togglePause();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){resetKeys();if(playing&&!paused)togglePause();}
  else requestFrame();
});
window.addEventListener('pagehide',()=>{resetKeys();clock.setPaused(true);});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();api=null;grid=null;mesh=null;
  if(playing&&!paused)togglePause();inform('WebGL context lost; preview paused',true);
});
canvas.addEventListener('webglcontextrestored',()=>{
  try{initGraphics();markGeometry();inform('WebGL context rebuilt from scene state');}
  catch(error){inform(error.message,true);}
});
new ResizeObserver(requestFrame).observe(canvas);
clock.setPaused(true);
try{initGraphics();syncEditor();requestFrame();document.documentElement.dataset.editorReady='ready';}
catch(error){inform('WebGL unavailable: '+error.message,true);
  document.documentElement.dataset.editorReady='unavailable';syncEditor();}
