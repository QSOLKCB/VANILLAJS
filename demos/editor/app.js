// SPDX-License-Identifier: Apache-2.0
// VANILLAJS Component Forge v1.5: DOM only adapts owned scene data.
import {SceneMeshes} from './scene-meshes.js';
import {OptionalRenderer} from '../../modules/render-optional/index.js';
import {graphicsControls} from '../gpu-lab/controls.js';
import {exportGame} from './game-export.js';
import {WebGLAPI} from '../../api/webgl/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {createForgeScene,upgradeScene,validateScene,addEntity,updateEntity,removeEntity,
  duplicateEntity,sceneWorld,serializeScene,parseScene,makeHistory,commitHistory,
  undoHistory,redoHistory,setEntityComponent} from './model.js';
import {cameraMatrix,cameraRay,pickObject,createGridVertices,createSceneVertices,
  displayWorld} from './viewport.js';
import {PREVIEW_DT,createPreview,stepPreview} from './preview.js';
import {gizmoLines,pickGizmo,axisDragAmount,applyGizmo} from './gizmos.js';
import {createAssetLibrary,validateAssetLibrary,addMeshAsset,addTextureAsset,
  addMaterialAsset,addPrefabAsset,instantiatePrefab,setPlacement,prunePlacements,
  parseProject,serializeProject,MAX_PROJECT_BYTES} from './asset-foundry.js';

const $=id=>document.getElementById(id),canvas=$('view');
let importGeneration=0;
let history=makeHistory(createForgeScene()),selected='entity-3',draft=null,
  library=createAssetLibrary(),chosenAsset=null,
  camera={yaw:38,pitch:23,distance:18,target:[0,1,0]},api=null,grid=null,mesh=null,
  gizmoMesh=null,gizmoTool='move',gizmoSpace='world',snapEnabled=true,
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
  for(const el of $('asset-foundry-controls').querySelectorAll('button,input,select'))el.disabled=playing;
  $('undo').disabled=playing||history.past.length===0;
  $('redo').disabled=playing||history.future.length===0;
  $('properties').hidden=!selected;$('empty').hidden=!!selected;
  for(const el of $('properties').querySelectorAll('input,select'))el.disabled=playing;
  for(const el of $('forge-tools').querySelectorAll('input,select,button'))el.disabled=playing;
  for(const name of ['move','rotate','scale']){
    $('tool-'+name).classList.toggle('active',gizmoTool===name);
    $('tool-'+name).setAttribute('aria-pressed',String(gizmoTool===name));
  }
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
  syncAssets();
  if(!selected){requestFrame();return;}
  const e=byId.get(selected);
  $('object-name').value=e.name;$('object-body').value=e.body;
  $('object-visible').checked=e.visible;$('object-yaw').value=e.rotationY;
  $('object-color').value='#'+e.color.map(c=>Math.round(c*255).toString(16).padStart(2,'0')).join('');
  for(const field of $('components').querySelectorAll('[data-component]')){
    const value=e.components?.[field.dataset.component]?.[field.dataset.field];
    if(field.type==='checkbox')field.checked=Boolean(value);
    else field.value=value??'';
  }
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
function syncAssets(){
  const list=$('asset-list'),previous=chosenAsset;
  list.replaceChildren();
  for(const asset of library.assets){
    const option=document.createElement('option');
    option.value=asset.id;
    option.textContent=asset.kind.toUpperCase()+' · '+asset.name+
      (asset.sourceSha256?' · '+asset.sourceSha256.slice(0,8):'');
    list.append(option);
  }
  if(previous&&library.assets.some(asset=>asset.id===previous))list.value=previous;
  else chosenAsset=null;
  $('asset-count').textContent=library.assets.length+' assets';
  const current=library.assets.find(asset=>asset.id===chosenAsset);
  $('asset-attach').disabled=playing||!selected||!current||
    !['mesh','material'].includes(current.kind);
  $('asset-instance').disabled=playing||current?.kind!=='prefab';
  $('asset-make-prefab').disabled=playing||!selected;
  $('asset-clear').disabled=playing||!selected;
}
function activeAsset(){return library.assets.find(asset=>asset.id===chosenAsset)??null;}
function assetUpdated(message){
  markGeometry();syncEditor();inform(message);
}
async function digestSource(bytes){
  const result=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(result)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function importObjFile(file){
  if(file.size>64*1024)throw new RangeError('OBJ source exceeds 64 KiB');
  const bytes=await file.arrayBuffer();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const result=addMeshAsset(library,{
    name:file.name.slice(0,64),sourceName:file.name.slice(0,64),
    sourceSha256:await digestSource(bytes),license:$('asset-license').value,text
  });
  library=result.library;chosenAsset=result.id;
  assetUpdated('Verified local OBJ geometry · '+file.name);
}
async function importPngFile(file){
  if(file.size>64*1024)throw new RangeError('PNG source exceeds 64 KiB');
  const raw=new Uint8Array(await file.arrayBuffer());
  const signature=[137,80,78,71,13,10,26,10];
  if(raw.length<33||!signature.every((n,i)=>raw[i]===n)||
     String.fromCharCode(...raw.slice(12,16))!=='IHDR')
    throw new TypeError('Malformed PNG header');
  const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),
    width=view.getUint32(16,false),height=view.getUint32(20,false);
  // Check declared IHDR dimensions BEFORE invoking a browser image decoder
  // to avoid decompressing an oversized untrusted local image.
  if(width<1||height<1||width>64||height>64)
    throw new RangeError('PNG IHDR exceeds 64×64 texture budget');
  const image=await createImageBitmap(new Blob([raw],{type:'image/png'}),
    {colorSpaceConversion:'none',premultiplyAlpha:'none'});
  try{
    if(image.width<1||image.height<1||image.width>64||image.height>64)
      throw new RangeError('PNG must be at most 64×64 pixels');
    const buffer=document.createElement('canvas');
    buffer.width=image.width;buffer.height=image.height;
    const ctx=buffer.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('2D image decoder unavailable');
    ctx.drawImage(image,0,0);
    const rgba=new Uint8Array(ctx.getImageData(0,0,image.width,image.height).data);
    const result=addTextureAsset(library,{
      name:file.name.slice(0,64),sourceName:file.name.slice(0,64),
      sourceSha256:await digestSource(raw),license:$('asset-license').value,
      width:image.width,height:image.height,bytes:rgba
    });
    library=result.library;chosenAsset=result.id;
    assetUpdated('Imported canonical opaque PNG texels · '+file.name);
  }finally{image.close();}
}
for(const [element,run]of [['asset-obj',importObjFile],['asset-png',importPngFile]]){
  $(element).addEventListener('change',async event=>{
    if(playing)return;
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const generation=++importGeneration;
    try{await run(file);}
    catch(error){inform('Asset rejected: '+error.message,true);}
  });
}
$('asset-list').addEventListener('change',event=>{
  chosenAsset=event.target.value||null;syncAssets();
});
$('asset-attach').addEventListener('click',()=>{
  if(playing||!selected)return;
  try{
    const asset=activeAsset();if(!asset||!['mesh','material'].includes(asset.kind))
      throw new TypeError('Select a mesh or material first');
    const clean=prunePlacements(editScene(),library),
      previous=clean.placements.find(p=>p.entityId===selected);
    library=setPlacement(editScene(),clean,selected,
      asset.kind==='mesh'?asset.id:previous?.meshId??null,
      asset.kind==='material'?asset.id:previous?.materialId??null);
    assetUpdated('Attached '+asset.kind+' · '+asset.name);
  }catch(error){inform('Attachment rejected: '+error.message,true);}
});
$('asset-clear').addEventListener('click',()=>{
  if(playing||!selected)return;
  try{
    library=setPlacement(editScene(),prunePlacements(editScene(),library),selected);
    assetUpdated('Cleared selected object asset attachments');
  }catch(error){inform(error.message,true);}
});
$('asset-make-material').addEventListener('click',()=>{
  if(playing)return;
  try{
    const color=$('asset-material-color').value,texture=activeAsset(),
      rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
    const result=addMaterialAsset(prunePlacements(editScene(),library),{
      name:'Material '+library.nextId,license:$('asset-license').value,color:rgb,
      textureId:texture?.kind==='texture'?texture.id:null
    });
    library=result.library;chosenAsset=result.id;
    assetUpdated('Authored material · '+result.id);
  }catch(error){inform('Material rejected: '+error.message,true);}
});
$('asset-make-prefab').addEventListener('click',()=>{
  if(playing||!selected)return;
  try{
    const scene=editScene(),o=scene.objects.find(e=>e.id===selected);
    const result=addPrefabAsset(scene,prunePlacements(scene,library),selected,
      (o.name+' Prefab').slice(0,64),$('asset-license').value);
    library=result.library;chosenAsset=result.id;
    assetUpdated('Saved reusable prefab · '+result.id);
  }catch(error){inform('Prefab rejected: '+error.message,true);}
});
$('asset-instance').addEventListener('click',()=>{
  if(playing)return;
  try{
    const asset=activeAsset();
    if(asset?.kind!=='prefab')throw new TypeError('Select a prefab first');
    const result=instantiatePrefab(editScene(),
      prunePlacements(editScene(),library),asset.id);
    library=result.library;
    applyScene(result.scene,result.selected);
    inform('Prefab instantiated · '+asset.name);
  }catch(error){inform('Instantiation rejected: '+error.message,true);}
});
$('asset-save-project').addEventListener('click',()=>{
  if(playing)return;
  try{
    const scene=editScene(),raw=serializeProject(scene,prunePlacements(scene,library),{optionalGPU:$('optional-gpu').checked});
    download('vanillajs-'+scene.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+
      '.vproject.json',raw);
    inform('Exported complete local project (scene + assets + provenance)');
  }catch(error){inform('Project export rejected: '+error.message,true);}
});
$('asset-open-project').addEventListener('change',async event=>{
  if(playing)return;
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const generation=++importGeneration;
  try{
    if(file.size>MAX_PROJECT_BYTES)throw new RangeError('project exceeds 256 KiB');
    const imported=parseProject(await file.text());if(generation!==importGeneration)return;
    $('optional-gpu').checked=imported.graphics?.optionalGPU??false;initGraphics();
    const scene=upgradeScene(imported.scene);
    library=validateAssetLibrary(imported.library,scene);
    history=makeHistory(scene);selected=scene.objects[0]?.id??null;draft=null;
    chosenAsset=null;markGeometry();syncEditor();
    inform('Loaded local asset project · '+file.name);
  }catch(error){inform('Project rejected: '+error.message,true);}
});

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
  try{
    const original=editScene(),subtree=new Set([selected]);let changed=true;
    while(changed){changed=false;for(const e of original.objects)
      if(subtree.has(e.parent)&&!subtree.has(e.id)){subtree.add(e.id);changed=true;}}
    const copied=original.objects.filter(e=>subtree.has(e.id)),
      result=duplicateEntity(original,selected),
      added=result.scene.objects.slice(original.objects.length);
    let nextLibrary=prunePlacements(original,library);
    for(let i=0;i<added.length;i++){
      const source=nextLibrary.placements.find(p=>p.entityId===copied[i].id);
      if(source)nextLibrary=setPlacement(result.scene,nextLibrary,added[i].id,
        source.meshId,source.materialId);
    }
    library=nextLibrary;
    applyScene(result.scene,result.selected);
  }catch(error){inform(error.message,true);}
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
  ++importGeneration;history=makeHistory(createForgeScene());selected='entity-3';draft=null;
  library=createAssetLibrary();chosenAsset=null;
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
  const generation=++importGeneration;
  try{
    if(file.size>128*1024)throw new RangeError('scene exceeds 128 KiB');
    const raw=parseScene(await file.text()),scene=upgradeScene(raw);if(generation!==importGeneration)return;
    history=makeHistory(scene);selected=scene.objects[0]?.id??null;draft=null;
    library=createAssetLibrary();chosenAsset=null;
    markGeometry();syncEditor();inform((raw.schemaVersion===1?'Migrated v1 → v2 · ':'Loaded v2 scene · ')+file.name);
  }catch(error){inform('Scene rejected: '+error.message,true);}
});
$('properties').addEventListener('change',event=>{
  if(!selected||playing)return;
  const target=event.target,entity=editScene().objects.find(e=>e.id===selected);
  if(!entity)return;
  if(target.dataset.component){
    const kind=target.dataset.component,field=target.dataset.field;
    const value=target.type==='checkbox'?target.checked:
      target.type==='number'?Number(target.value):target.value;
    try{applyScene(setEntityComponent(editScene(),selected,kind,{[field]:value}));}
    catch(error){inform('Component rejected: '+error.message,true);syncEditor();}
    return;
  }
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
let optionalCanvas=null,removeGraphics=null;
$('optional-gpu').onchange=()=>{initGraphics();markGeometry();};
$('export-game').onclick=()=>{try{download('game.html',exportGame(editScene(),prunePlacements(editScene(),library),{optionalGPU:$('optional-gpu').checked}));inform('Place game.html beside packaged modules/ and demos/; serve over HTTP.');}catch(e){inform(e.message,true);}};
function initGraphics(){
  api?.dispose();removeGraphics?.();optionalCanvas?.remove();optionalCanvas=null;
  if(!$('optional-gpu').checked){try{api=new WebGLAPI(canvas);}catch{api=null;}}
  else api=null;
  if(!api){
    optionalCanvas=document.createElement('canvas');optionalCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';canvas.after(optionalCanvas);
    api=new OptionalRenderer(optionalCanvas,{onMode:requestFrame});
    if($('optional-gpu').checked)removeGraphics=graphicsControls(api,$('graphics-controls'),requestFrame,()=>canvas.focus({preventScroll:true}));
  }
  grid=api.createMesh(createGridVertices(),'lines');
  mesh=new SceneMeshes(api);
  gizmoMesh=api.createMesh([], 'lines');
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
      if(simulation.events?.length)inform('Trigger · '+simulation.events.map(e=>e.tag).join(', '));
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
        mesh.update(createSceneVertices(world,playing?null:selected,library));
        api.updateMesh(gizmoMesh,!playing&&selected?
          gizmoLines(sceneWorld(editScene()),selected,gizmoSpace,gizmoTool):new Float32Array());
        geometryDirty=false;
      }
      if(optionalCanvas){optionalCanvas.width=width;optionalCanvas.height=height;}
      api.beginFrame({vp:cameraMatrix(camera,width,height),fog:.008});
      api.draw(grid);mesh.draw();if(!playing)api.draw(gizmoMesh);api.endFrame();
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
function selectTool(tool){
  if(playing)return;
  if(!['move','rotate','scale'].includes(tool))throw new TypeError('invalid tool');
  gizmoTool=tool;syncEditor();markGeometry();
  inform('Gizmo: '+tool+' · '+gizmoSpace+' space'+(snapEnabled?' · snap on':''));
}
for(const tool of ['move','rotate','scale'])
  $('tool-'+tool).addEventListener('click',()=>selectTool(tool));
$('gizmo-space').addEventListener('change',event=>{
  gizmoSpace=event.target.value;markGeometry();
  inform('Gizmo space: '+gizmoSpace);
});
$('gizmo-snap').addEventListener('change',event=>{
  snapEnabled=event.target.checked;inform('Gizmo snapping '+(snapEnabled?'on':'off'));
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
    if(!playing&&selected&&!event.shiftKey){
      const rect=canvas.getBoundingClientRect(),
        object=sceneWorld(editScene()).find(e=>e.id===selected);
      const axis=pickGizmo(camera,object,
        event.clientX-rect.left,event.clientY-rect.top,
        rect.width,rect.height,gizmoSpace,gizmoTool);
      if(axis&&(gizmoTool!=='rotate'||axis==='y'))
        gesture={kind:'gizmo',id:selected,axis,tool:gizmoTool,
          space:gizmoSpace,snapping:snapEnabled,object,
          scene:history.present,
          start:{x:event.clientX-rect.left,y:event.clientY-rect.top}};
    }
    if(!gesture&&!playing&&event.shiftKey&&selected){
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
  }else if(gesture.kind==='gizmo'&&!playing){
    const rect=canvas.getBoundingClientRect();
    const end={x:event.clientX-rect.left,y:event.clientY-rect.top};
    const raw=axisDragAmount(camera,gesture.object,gesture.axis,
      gesture.start,end,rect.width,rect.height,gesture.space);
    const amount=gesture.tool==='rotate'?raw*60:
      gesture.tool==='scale'?raw*.6:raw;
    try{
      draft=applyGizmo(gesture.scene,gesture.id,gesture.tool,
        gesture.axis,amount,{space:gesture.space,snapping:gesture.snapping});
      markGeometry();
    }catch(error){inform('Transform rejected: '+error.message,true);}
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
  if(gesture?.kind==='move'||gesture?.kind==='gizmo'){
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
  if(!playing&&['KeyW','KeyE','KeyR'].includes(event.code)){
    event.preventDefault();
    selectTool({KeyW:'move',KeyE:'rotate',KeyR:'scale'}[event.code]);
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
  event.preventDefault();api=null;grid=null;mesh=null;gizmoMesh=null;
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
