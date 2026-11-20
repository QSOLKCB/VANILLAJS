// SPDX-License-Identifier: Apache-2.0
// WORLD-VIS-001: one authoritative Scenic3D world, three independent camera
// visibility decisions, opt-in GPU retention/LOD and no physics mutation.
import {LitRenderer} from '../../modules/render-lit/index.js';
import {RetainedLitWorld,selectRetainedView} from '../../modules/world-vis/index.js';
import {WORLD_CAMERAS,viewCamera,createWorldVisStudy} from './world.js';

const $=id=>document.getElementById(id),canvas=$('world-canvas');
let renderer=null,retained=null,study=null,frameId=0,frames=0,lastPlan=null,
  cameraId='overlook',lastCompare=[],lastError=null,disposed=false,ready=false;
function settings(){
  return {cull:$('culling').checked,lod:$('lod').value,
    lodDistance:Number($('lod-distance').value)};
}
const text=(id,value)=>{$(id).textContent=String(value);};
const km=n=>Number((n/1024).toFixed(1)).toLocaleString()+' KiB';
function request(){
  if(!frameId&&!disposed)frameId=requestAnimationFrame(draw);
}
function updateCameraViews(aspect){
  lastCompare=Object.keys(WORLD_CAMERAS).map(id=>{
    const plan=selectRetainedView(study.world,viewCamera(id,aspect),settings());
    return {id,draws:plan.draws,culled:plan.culled,lodVertices:plan.lodVertices};
  });
  const result=lastCompare.map(data=>{
    const row=document.createElement('div');row.className='compare-row';
    const name=document.createElement('span');name.textContent=WORLD_CAMERAS[data.id].label;
    const value=document.createElement('b');value.textContent=data.draws+' draws / '+data.culled+' culled';
    row.append(name,value);return row;
  });
  $('comparison').replaceChildren(...result);
}
function draw(){
  frameId=0;if(!renderer||disposed||renderer.lost||!study)return;
  try{
    const rect=canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height),
      camera=viewCamera(cameraId,aspect),opts=settings(),
      plan=selectRetainedView(study.world,camera,opts);
    renderer.begin(camera.position,camera.orientation,{
      fov:camera.fov,near:camera.near,far:camera.far,ambient:.34,
      sunDirection:[.3,.82,.3],sunColor:[1,.94,.78],
      skyTop:[.12,.31,.49],skyBottom:[.73,.82,.77],
      fogColor:[.6,.73,.72],fogDensity:.0028,exposure:1
    });
    const receipt=retained.draw(plan),gpu=renderer.stats();
    lastPlan=plan;frames++;lastError=null;
    text('status','HORIZON static tiles · '+plan.draws+' visible / '+plan.culled+
      ' culled · '+(opts.cull?'conservative frustum ON':'full-source presentation'));
    text('renderer-status','WEBGL1 / '+gpu.profile.toUpperCase());
    text('view-caption',WORLD_CAMERAS[cameraId].label.toUpperCase());
    text('source-batches',study.world.batches+' / '+study.world.highTriangles+' triangles');
    text('visible-draws',plan.draws);
    text('culled',plan.culled);
    text('vertices',plan.lodVertices+' / '+plan.fullVertices);
    text('resident',km(receipt.residentBytes)+' / '+km(receipt.maxResidentBytes));
    text('uploads',receipt.uploads+' / '+receipt.deletions);
    text('draws',gpu.frameDraws);
    text('road-source',study.fixedSample.position.map(x=>x.toFixed(2)).join(', ')+' m');
    text('sample','SAME PHYSICAL ROAD SOURCE · '+frames+' PRESENTATIONS');
    updateCameraViews(aspect);
  }catch(error){
    lastError=error.message;text('status','Presentation rejected: '+lastError);
    text('renderer-status','RENDER ERROR');console.error('WORLD-VIS presentation error',error);
  }
}
function createGraphics(){
  const next=new LitRenderer(canvas,{profile:'high',pixelRatio:1});
  if(retained){retained.rebind(next);}else retained=new RetainedLitWorld(next,study.world,{
    maxResidentBytes:8*1024*1024,maxMeshes:128
  });
  const previous=renderer;renderer=next;
  previous?.dispose();
}
for(const control of ['camera','culling','lod','lod-distance']){
  $(control).addEventListener('input',()=>{
    cameraId=$('camera').value;
    text('lod-value',$('lod-distance').value+' m');
    request();
  });
}
$('refresh').addEventListener('click',request);
$('reset-cache').addEventListener('click',()=>{
  if(renderer){retained.rebind(renderer);request();}
});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();lastError='WebGL context lost; waiting for restoration';
  text('status',lastError);text('renderer-status','CONTEXT LOST');
});
canvas.addEventListener('webglcontextrestored',()=>{
  try{createGraphics();request();}catch(error){
    lastError='Context restoration rejected: '+error.message;text('status',lastError);
    console.error('WORLD-VIS context restore error',error);
  }
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)request();});
window.addEventListener('resize',request);
window.addEventListener('pagehide',event=>{
  cancelAnimationFrame(frameId);frameId=0;
  if(event.persisted)return;
  disposed=true;
  retained?.dispose();renderer?.dispose();
});
window.addEventListener('pageshow',event=>{if(event.persisted)request();});
try{
  study=createWorldVisStudy();
  createGraphics();ready=true;request();
  document.documentElement.dataset.worldVisReady='ready';
}catch(error){
  lastError=error.message;text('status','WORLD-VIS unavailable: '+lastError);
  document.documentElement.dataset.worldVisReady='failed';
  console.error('WORLD-VIS startup failure',error);
}
// Inspect-only browser evidence; no arbitrary setters or input bypass.
Object.defineProperty(globalThis,'__worldVis',{get:()=>Object.freeze({
  ready,frames,cameraId,plan:lastPlan&&{
    selected:lastPlan.selected,culled:lastPlan.culled,lodVertices:lastPlan.lodVertices,
    fullVertices:lastPlan.fullVertices,selectedBytes:lastPlan.selectedBytes,
    culling:lastPlan.culling,lod:lastPlan.lod,
    rows:lastPlan.rows.map(x=>({id:x.id,lod:x.lod,transparent:x.transparent}))
  },world:study&&{...study.world},gpu:renderer?.stats()??null,
  retained:retained?.stats()??null,cameraComparisons:lastCompare,
  sample:study?.fixedSample.position??null,error:lastError
})});
