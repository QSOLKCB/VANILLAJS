// SPDX-License-Identifier: Apache-2.0
// VANILLAJS Component Forge v1.5: DOM only adapts owned scene data.
import {hierarchyRows,eligibleParents,matchesAsset} from './workflows.js';
import {STARTER_SCENES,createStarterScene,addGameplayPiece,inspectCreatorScene} from './creator-workflow.js';
import {mount4XPanel} from './4x-panel.js';
import {parseExactPosition,previewQ16Position,transformExactPositionXY,snapEditorDelta,formatPositionNumber} from './authoring-math.js';
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
  displayWorld,frameCamera} from './viewport.js';
import {PREVIEW_DT,createPreview,stepPreview} from './preview.js';
import {gizmoLines,pickGizmo,axisDragAmount,applyGizmo} from './gizmos.js';
import {createAssetLibrary,validateAssetLibrary,addMeshAsset,addTextureAsset,
  addMaterialAsset,addPrefabAsset,instantiatePrefab,setPlacement,prunePlacements,
  parseProject,serializeProject,MAX_PROJECT_BYTES} from './asset-foundry.js';

const $=id=>document.getElementById(id),canvas=$('view');
let importGeneration=0;
let campaignPanel=null;
let checksScene=null,creatorChecks=null,lastPlayedScene=null,lastSavedScene=null,lastSavedLibrary=null,lastSavedGPU=false;
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
let treeScene=null,treeSelection=null,treeQuery=null,treePlaying=null;
let assetLibrary=null,assetQuery=null,assetChoice=null;
let exactEntity=null,exactPosition=null;
function renderHierarchy(scene){
  const query=$('hierarchy-search').value;
  if(treeScene===scene&&treeSelection===selected&&treeQuery===query&&treePlaying===playing)return;
  treeScene=scene;treeSelection=selected;treeQuery=query;treePlaying=playing;
  const hierarchy=$('hierarchy'),focused=document.activeElement?.dataset.id;
  const rows=hierarchyRows(scene.objects,query),fragment=document.createDocumentFragment();
  for(const {object:e,depth} of rows){
    const row=document.createElement('button');row.type='button';
    row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(depth+1));
    row.setAttribute('aria-selected',String(e.id===selected));
    row.tabIndex=e.id===selected||(!rows.some(r=>r.object.id===selected)&&e===rows[0]?.object)?0:-1;
    row.dataset.id=e.id;row.style.paddingLeft=(7+depth*14)+'px';
    if(!e.visible)row.classList.add('hidden');
    const glyph=document.createElement('span');glyph.textContent=e.parent?'└':'◇';glyph.setAttribute('aria-hidden','true');
    const name=document.createElement('span');name.textContent=e.name;
    const type=document.createElement('small');type.className='type';type.textContent=e.body.toUpperCase();
    row.append(glyph,name,type);fragment.append(row);
  }
  hierarchy.replaceChildren(fragment);$('hierarchy-empty').hidden=rows.length!==0;
  if(focused)hierarchy.querySelector(`[data-id="${focused}"]`)?.focus({preventScroll:true});
}
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
  $('restore-draft').disabled=playing||!recoveryAvailable;
  for(const id of editorIds)$(id).disabled=playing;
  for(const el of $('asset-foundry-controls').querySelectorAll('button,input,select'))el.disabled=playing;
  $('undo').disabled=playing||history.past.length===0;
  $('redo').disabled=playing||history.future.length===0;
  $('properties').hidden=!selected;$('empty').hidden=!!selected;
  for(const el of $('properties').querySelectorAll('input,select,button'))el.disabled=playing;
  for(const el of $('forge-tools').querySelectorAll('input,select,button'))el.disabled=playing;
  for(const name of ['move','rotate','scale']){
    $('tool-'+name).classList.toggle('active',gizmoTool===name);
    $('tool-'+name).setAttribute('aria-pressed',String(gizmoTool===name));
  }
  for(const id of ['add-child','duplicate','remove'])$(id).disabled=playing||!selected;
  renderHierarchy(scene);
  syncCreator(scene);
  campaignPanel?.sync();
  scheduleRecovery();
  syncAssets();
  if(!selected){requestFrame();return;}
  const e=byId.get(selected);
  if(exactEntity!==e.id||exactPosition!==JSON.stringify(e.position)){readExactPosition();}
  for(const field of $('properties').querySelectorAll('[aria-invalid]'))field.removeAttribute('aria-invalid');
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
  for(const parent of eligibleParents(scene.objects,selected)){
    const o=document.createElement('option');o.value=parent.id;o.textContent=parent.name;
    parentSelect.append(o);
  }
  parentSelect.value=e.parent??'';parentSelect.disabled=playing||e.body!=='static';
  requestFrame();
}
function syncAssets(){
  const list=$('asset-list'),previous=chosenAsset;
  const query=$('asset-search').value;
  if(assetLibrary!==library||assetQuery!==query||assetChoice!==chosenAsset){
    assetLibrary=library;assetQuery=query;assetChoice=chosenAsset;
    list.replaceChildren();
    for(const asset of library.assets.filter(asset=>matchesAsset(asset,query))){
      const option=document.createElement('option');option.value=asset.id;
      option.textContent=asset.kind.toUpperCase()+' · '+asset.name+
        (asset.sourceSha256?' · '+asset.sourceSha256.slice(0,8):'');list.append(option);
    }
    if(previous&&[...list.options].some(option=>option.value===previous))list.value=previous;
    else{chosenAsset=null;list.selectedIndex=-1;}
  }
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
async function importObjFile(file,generation){
  if(file.size>64*1024)throw new RangeError('OBJ source exceeds 64 KiB');
  const bytes=await file.arrayBuffer();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),sourceSha256=await digestSource(bytes);
  if(generation!==importGeneration||playing)return;
  const result=addMeshAsset(library,{
    name:file.name.slice(0,64),sourceName:file.name.slice(0,64),
    sourceSha256,license:$('asset-license').value,text
  });
  if(generation!==importGeneration||playing)return;
  library=result.library;chosenAsset=result.id;
  assetUpdated('Verified local OBJ geometry · '+file.name);
}
async function importPngFile(file,generation){
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
    const sourceSha256=await digestSource(raw);
    if(generation!==importGeneration||playing)return;
    const result=addTextureAsset(library,{
      name:file.name.slice(0,64),sourceName:file.name.slice(0,64),
      sourceSha256,license:$('asset-license').value,
      width:image.width,height:image.height,bytes:rgba
    });
    if(generation!==importGeneration||playing)return;
    library=result.library;chosenAsset=result.id;
    assetUpdated('Imported canonical opaque PNG texels · '+file.name);
  }finally{image.close();}
}
for(const [element,run]of [['asset-obj',importObjFile],['asset-png',importPngFile]]){
  $(element).addEventListener('change',async event=>{
    if(playing)return;
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    const generation=importGeneration;
    try{await run(file,generation);}
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
    lastSavedScene=scene;lastSavedLibrary=library;lastSavedGPU=$('optional-gpu').checked;syncCreator(scene);
    inform('Exported complete local project (scene + assets + provenance)');
  }catch(error){inform('Project export rejected: '+error.message,true);}
});
$('asset-open-project').addEventListener('change',async event=>{
  if(playing)return;
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const generation=++importGeneration;
  try{
    if(file.size>MAX_PROJECT_BYTES)throw new RangeError('project exceeds 256 KiB');
    const imported=parseProject(await file.text());if(generation!==importGeneration||playing)return;
    $('optional-gpu').checked=imported.graphics?.optionalGPU??false;initGraphics();
    const scene=upgradeScene(imported.scene);
    library=validateAssetLibrary(imported.library,scene);
    history=makeHistory(scene);exactEntity=null;selected=scene.objects[0]?.id??null;draft=null;
    chosenAsset=null;markGeometry();syncEditor();
    inform('Loaded local asset project · '+file.name);
  }catch(error){inform('Project rejected: '+error.message,true);}
});

$('hierarchy-search').addEventListener('input',()=>renderHierarchy(editScene()));
$('asset-search').addEventListener('input',syncAssets);
$('hierarchy').addEventListener('click',event=>{
  const row=event.target.closest('[data-id]');if(row)select(row.dataset.id);
});
$('hierarchy').addEventListener('keydown',event=>{
  const rows=[...$('hierarchy').querySelectorAll('[role=treeitem]')],index=rows.indexOf(event.target);
  if(index<0)return;
  let next=index;
  if(event.code==='ArrowDown')next=Math.min(rows.length-1,index+1);
  else if(event.code==='ArrowUp')next=Math.max(0,index-1);
  else if(event.code==='Home')next=0;
  else if(event.code==='End')next=rows.length-1;
  else return;
  event.preventDefault();event.stopPropagation();const id=rows[next].dataset.id;
  select(id);$('hierarchy').querySelector(`[data-id="${id}"]`)?.focus();
});
const RECOVERY_KEY='vanillajs.editor.recovery.v1';
let recoveryAvailable=false;
let recoveryScene=history.present,recoveryLibrary=library,recoveryGPU=false,recoveryTimer=null,recoveryPending=false;
function scheduleRecovery(){
  if(playing||draft)return;
  const gpu=$('optional-gpu').checked;
  if(recoveryScene===history.present&&recoveryLibrary===library&&recoveryGPU===gpu)return;
  recoveryScene=history.present;recoveryLibrary=library;recoveryGPU=gpu;recoveryPending=true;
  clearTimeout(recoveryTimer);recoveryTimer=setTimeout(flushRecovery,400);
  $('draft-status').textContent='Saving recovery…';
}
function flushRecovery(){
  clearTimeout(recoveryTimer);if(!recoveryPending)return;
  try{
    const raw=serializeProject(history.present,prunePlacements(history.present,library),{optionalGPU:$('optional-gpu').checked});
    localStorage.setItem(RECOVERY_KEY,raw);recoveryPending=false;recoveryAvailable=true;
    $('draft-status').textContent='Recovery saved locally';$('restore-draft').disabled=playing;
  }catch(error){$('draft-status').textContent='Recovery unavailable';$('draft-status').title=error.message;}
}
try{if(localStorage.getItem(RECOVERY_KEY)){recoveryAvailable=true;$('restore-draft').disabled=false;$('draft-status').textContent='Local draft available';}}
catch{$('draft-status').textContent='Recovery unavailable';}
$('restore-draft').addEventListener('click',()=>{
  if(playing||!confirm('Restore the local recovery copy? Current unsaved edits will be replaced.'))return;
  try{
    const project=parseProject(localStorage.getItem(RECOVERY_KEY));
    const scene=upgradeScene(project.scene),nextLibrary=validateAssetLibrary(project.library,scene);
    finishGesture(false);++importGeneration;library=nextLibrary;history=makeHistory(scene);exactEntity=null;draft=null;
    selected=scene.objects[0]?.id??null;chosenAsset=null;
    $('optional-gpu').checked=project.graphics?.optionalGPU??false;initGraphics();markGeometry();syncEditor();
    inform('Restored local scene and assets');
  }catch(error){inform('Recovery rejected: '+error.message,true);}
});
function readExactPosition(){
  const entity=editScene().objects.find(e=>e.id===selected);if(!entity)return;
  exactEntity=entity.id;exactPosition=JSON.stringify(entity.position);
  const errors=[];
  for(const [i,axis]of ['x','y','z'].entries()){
    try{$('exact-'+axis).value=formatPositionNumber(entity.position[i]);}
    catch(error){$('exact-'+axis).value='';errors.push(axis.toUpperCase()+': '+error.message);}
  }
  $('exact-result').textContent=errors.length?errors.join('\n'):'Loaded current floating-point position as decimal text. Enter decimals to author exactly.';
  $('exact-result').dataset.error=String(errors.length>0);
}
const exactInput=()=>['x','y','z'].map(axis=>$('exact-'+axis).value);
function exactAction(action){
  if(playing||!selected)return;
  try{action();$('exact-result').dataset.error='false';}
  catch(error){$('exact-result').textContent=error.message;$('exact-result').dataset.error='true';inform('Exact authoring: '+error.message,true);}
}
function showQuantization(){
  const result=previewQ16Position(exactInput(),{rounding:$('exact-rounding').value,overflow:$('exact-overflow').value});
  $('exact-result').textContent=result.raw.map((raw,i)=>['X','Y','Z'][i]+': raw '+raw+' = '+result.decimals[i]+' m; error '+result.errors[i]).join('\n');
  return result;
}
$('exact-read').addEventListener('click',readExactPosition);
$('exact-preview').addEventListener('click',()=>exactAction(showQuantization));
$('exact-apply').addEventListener('click',()=>exactAction(()=>{
  const result=parseExactPosition(exactInput());applyScene(updateEntity(editScene(),selected,{position:result.position}));
  $('exact-result').textContent='Exact decimals '+result.decimals.join(', ')+' applied at the floating-point scene boundary.';
}));
$('exact-quantize').addEventListener('click',()=>exactAction(()=>{
  const result=showQuantization(),message=$('exact-result').textContent;
  const parsed=parseExactPosition(result.decimals);applyScene(updateEntity(editScene(),selected,{position:parsed.position}));
  $('exact-result').textContent=message+'\nApplied quantized position. Runtime arithmetic is unchanged.';
}));
$('exact-transform').addEventListener('click',()=>exactAction(()=>{
  const result=transformExactPositionXY(exactInput(),$('exact-symmetry').value);
  for(const [i,axis]of ['x','y','z'].entries())$('exact-'+axis).value=result.decimals[i];
  $('exact-result').textContent='Exact local XY point transformed. Apply decimals to commit; Z and object orientation are unchanged.';
}));
function select(id){
  if(selected===id)return;
  selected=id;markGeometry();syncEditor();
}
// Placement snapshots follow scene history; asset definitions remain in the library.
// This prevents an undone duplicate's attachment leaking onto a reused entity ID.
const placementHistory=new WeakMap();
function travelHistory(direction){
  if(playing)return;
  finishGesture(false);
  placementHistory.set(history.present,prunePlacements(history.present,library).placements);
  history=direction==='undo'?undoHistory(history):redoHistory(history);
  const placements=placementHistory.get(history.present);
  library=prunePlacements(history.present,placements?{...library,placements}:library);
  draft=null;markGeometry();syncEditor();inform(direction==='undo'?'Undo':'Redo');
}
function applyScene(next,selection=selected){
  if(playing)return;
  try{
    const verified=validateScene(next);
    placementHistory.set(history.present,prunePlacements(history.present,library).placements);
    history=commitHistory(history,verified);draft=null;selected=selection;
    library=prunePlacements(history.present,library);
    placementHistory.set(history.present,library.placements);
    markGeometry();syncEditor();inform('Scene updated · '+verified.objects.length+' entities');
  }catch(error){inform(error.message,true);syncEditor();}
}
function syncCreator(scene){
  for(const id of ['creator-load','creator-add','creator-starter','creator-piece','creator-save','creator-play'])$(id).disabled=playing;
  if(checksScene!==scene){
    checksScene=scene;
    try{creatorChecks=inspectCreatorScene(scene);}
    catch(error){creatorChecks={playerId:null,issues:[{code:'invalid-world',message:error.message,entityId:null}]};}
    const list=$('creator-issues');list.replaceChildren();
    for(const issue of creatorChecks.issues){
      const item=document.createElement('li');item.dataset.code=issue.code;
      if(issue.entityId){const button=document.createElement('button');button.type='button';
        button.dataset.entityId=issue.entityId;button.textContent=issue.message;item.append(button);
      }else item.textContent=issue.message;
      list.append(item);
    }
    if(!creatorChecks.issues.length){const item=document.createElement('li');
      item.textContent='No common setup issues found. Try the scene in Play before sharing.';list.append(item);}
    $('creator-check-summary').textContent=creatorChecks.issues.length?
      'Scene checks · '+creatorChecks.issues.length+' things to review':'Scene checks · ready to try';
  }
  const steps=[['Player ready',Boolean(creatorChecks.playerId)],['Setup checked',creatorChecks.issues.length===0],
    ['Tried Play',lastPlayedScene===scene],['Project downloaded',lastSavedScene===scene&&lastSavedLibrary===library&&lastSavedGPU===$('optional-gpu').checked]];
  $('creator-progress').replaceChildren(...steps.map(([label,done])=>{const span=document.createElement('span');
    span.dataset.complete=String(done);span.textContent=(done?'✓ ':'○ ')+label;return span;}));
  for(const button of $('creator-issues').querySelectorAll('button'))button.disabled=playing;
}
function describeStarter(){
  $('creator-starter-note').textContent=STARTER_SCENES.find(s=>s.id===$('creator-starter').value)?.description??'';
}
$('creator-starter').addEventListener('change',describeStarter);describeStarter();
$('creator-load').addEventListener('click',()=>{
  if(playing)return;
  try{
    finishGesture(false);
    // Fresh IDs prevent an old asset placement from attaching to a new template object.
    const scene=createStarterScene($('creator-starter').value,{firstId:history.present.nextId});
    ++importGeneration;
    applyScene(scene,scene.objects.find(e=>e.body==='player')?.id??null);
    frameSelection(true);inform(scene.name+' loaded · Undo restores the previous scene and attachments. Asset library retained.');
  }catch(error){inform('Starter rejected: '+error.message,true);}
});
$('creator-add').addEventListener('click',()=>{
  if(playing)return;
  try{finishGesture(false);const result=addGameplayPiece(editScene(),$('creator-piece').value);
    applyScene(result.scene,result.selected);frameSelection();inform('Gameplay piece added. Move it with the coloured arrows; Undo removes it.');
  }catch(error){inform('Piece rejected: '+error.message,true);}
});
$('creator-issues').addEventListener('click',event=>{
  const button=event.target.closest('[data-entity-id]');if(!button||playing)return;
  $('hierarchy-search').value='';select(button.dataset.entityId);frameSelection();
  inform(button.textContent);
});
$('creator-play').addEventListener('click',()=>{if(!playing)start();});
$('creator-save').addEventListener('click',()=>{if(!playing)$('asset-save-project').click();});
$('creator-focus').addEventListener('click',()=>{
  const basic=document.body.classList.toggle('focus-basics');
  $('creator-focus').setAttribute('aria-pressed',String(basic));
  $('creator-focus').textContent=basic?'Show all tools':'Focus basics';
  requestFrame();
});
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
$('undo').addEventListener('click',()=>travelHistory('undo'));
$('redo').addEventListener('click',()=>travelHistory('redo'));
$('scene-name').addEventListener('change',()=>{
  const scene=editScene();applyScene({...scene,name:$('scene-name').value});
});
$('new-scene').addEventListener('click',()=>{
  if(!confirm('Start a new scene? Save your current JSON project first if needed.'))return;
  ++importGeneration;history=makeHistory(createForgeScene());exactEntity=null;selected='entity-3';draft=null;
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
    const raw=parseScene(await file.text()),scene=upgradeScene(raw);if(generation!==importGeneration||playing)return;
    history=makeHistory(scene);exactEntity=null;selected=scene.objects[0]?.id??null;draft=null;
    library=createAssetLibrary();chosenAsset=null;
    markGeometry();syncEditor();inform((raw.schemaVersion===1?'Migrated v1 → v2 · ':'Loaded v2 scene · ')+file.name);
  }catch(error){inform('Scene rejected: '+error.message,true);}
});
$('properties').addEventListener('submit',event=>event.preventDefault());
$('properties').addEventListener('change',event=>{
  if(!selected||playing)return;
  const target=event.target,entity=editScene().objects.find(e=>e.id===selected);
  if(!entity||target.closest('#exact-authoring'))return;
  if((target.type==='number'&&(!target.value.trim()||!Number.isFinite(Number(target.value))||
      target.validity.rangeUnderflow||target.validity.rangeOverflow))||
      (target.type==='text'&&!target.checkValidity())){
    target.setAttribute('aria-invalid','true');
    inform('Edit rejected: enter a valid '+(target.dataset.axis??target.name??'field')+' value within the displayed limits.',true);
    return;
  }
  target.removeAttribute('aria-invalid');
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
$('optional-gpu').onchange=()=>{initGraphics();markGeometry();scheduleRecovery();syncCreator(editScene());};
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
      if(optionalCanvas){
        if(optionalCanvas.width!==width)optionalCanvas.width=width;
        if(optionalCanvas.height!==height)optionalCanvas.height=height;
      }
      // Preserve the default view while keeping distant framed scenes visible.
      const fog=.008*Math.min(1,18/camera.distance);
      api.beginFrame({vp:cameraMatrix(camera,width,height),fog});
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
  finishGesture(false);++importGeneration;
  try{
    simulation=createPreview(history.present);playing=true;paused=false;
    lastPlayedScene=history.present;
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
function frameSelection(all=false){
  finishGesture(false);
  const rect=canvas.getBoundingClientRect();
  camera=frameCamera(camera,displayWorld(editScene(),playing?simulation:null),all?null:selected,rect.width,rect.height,library);
  requestFrame();inform(all||!selected?'Framed visible scene':'Framed selection and descendants');
}
$('frame').addEventListener('click',event=>frameSelection(event.shiftKey));
function selectTool(tool){
  if(playing)return;
  finishGesture(false);
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
    try{
    if(snapEnabled){pos[0]=snapEditorDelta(pos[0],.25);pos[2]=snapEditorDelta(pos[2],.25);}
    pos[0]=max(pos[0],-1000,1000);pos[2]=max(pos[2],-1000,1000);
    draft=updateEntity(gesture.scene,selected,{position:pos});markGeometry();}
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
  event.preventDefault();camera.distance=max(camera.distance*Math.exp(event.deltaY*.001),.05,1e9);
  requestFrame();
},{passive:false});
window.addEventListener('keydown',event=>{
  const field=event.target instanceof HTMLElement&&(
    event.target.matches('input,textarea,select')||event.target.isContentEditable);
  if(field)return;
  if(event.code==='Escape'&&gesture){event.preventDefault();finishGesture(false);inform('Transform cancelled');return;}
  if((event.ctrlKey||event.metaKey)&&!playing){
    if(event.code==='KeyS'){event.preventDefault();$('save').click();return;}
    if(event.code==='KeyD'){event.preventDefault();if(!event.repeat){finishGesture(false);$('duplicate').click();}return;}
    if(event.code==='KeyZ'){event.preventDefault();
      travelHistory(event.shiftKey?'redo':'undo');return;}
    if(event.code==='KeyY'){event.preventDefault();
      travelHistory('redo');return;}
  }
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(!playing&&event.code==='KeyF'){event.preventDefault();frameSelection(event.shiftKey);return;}
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
    event.preventDefault();finishGesture(false);applyScene(removeEntity(editScene(),selected),null);return;
  }
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)&&
    (playing||document.activeElement===canvas))event.preventDefault();
  if(!event.repeat)keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{finishGesture(false);resetKeys();if(playing&&!paused)togglePause();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){finishGesture(false);flushRecovery();resetKeys();if(playing&&!paused)togglePause();}
  else requestFrame();
});
window.addEventListener('pagehide',()=>{flushRecovery();resetKeys();clock.setPaused(true);});
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
campaignPanel=mount4XPanel($('fourx-workshop'),{
  getScene:()=>editScene(),getLibrary:()=>prunePlacements(editScene(),library),
  getSelection:()=>selected,isPlaying:()=>playing,
  replaceScene:scene=>{finishGesture(false);applyScene(scene,scene.objects[0]?.id??null);frameSelection(true);}
});
Object.defineProperty(window,'__editor4x',{get:()=>campaignPanel.snapshot()});
try{initGraphics();syncEditor();requestFrame();document.documentElement.dataset.editorReady='ready';}
catch(error){inform('WebGL unavailable: '+error.message,true);
  document.documentElement.dataset.editorReady='unavailable';syncEditor();}
