// SPDX-License-Identifier: Apache-2.0
// Real LitRenderer admission/lifecycle over a resource spy; native pixels remain
// the packaged Chromium suite's responsibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import {HorizonView} from '../demos/horizon-lab/view.js';
import {DriveView} from '../demos/horizon-lab/drive-view.js';
import {RaceView} from '../demos/horizon-lab/race-view.js';
import {starterHorizonProject} from '../demos/horizon-lab/project.js';
import {starterDriveProject} from '../demos/horizon-lab/drive-project.js';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceCheckpoints} from '../demos/horizon-lab/race-course.js';
import {buildScenicWorld} from '../modules/scenic3d/index.js';
import {LIT_PROFILES} from '../modules/render-lit/index.js';

function device(){
  const buffers=new Set(),programs=new Set(),shaders=new Set(),listeners=new Set();let failAfter=Infinity,uploads=0;
  const gl={NO_ERROR:0,ARRAY_BUFFER:1,STATIC_DRAW:2,VERTEX_SHADER:3,FRAGMENT_SHADER:4,COMPILE_STATUS:5,LINK_STATUS:6,
    createShader(){const value={};shaders.add(value);return value;},shaderSource(){},compileShader(){},getShaderParameter:()=>true,deleteShader:value=>assert.ok(shaders.delete(value)),
    createProgram(){const value={};programs.add(value);return value;},attachShader(){},linkProgram(){},getProgramParameter:()=>true,deleteProgram:value=>assert.ok(programs.delete(value)),
    getAttribLocation:()=>0,getUniformLocation:()=>({}),createBuffer(){const value={};buffers.add(value);return value;},bindBuffer(){},bufferData(){if(++uploads===failAfter)throw Error('injected GPU upload failure');},getError:()=>0,deleteBuffer:value=>assert.ok(buffers.delete(value)),isContextLost:()=>false};
  const canvas={getContext:()=>gl,getBoundingClientRect:()=>({width:800,height:600}),addEventListener:(type,handler)=>listeners.add(handler),removeEventListener:(type,handler)=>assert.ok(listeners.delete(handler))};
  return {canvas,buffers,programs,shaders,listeners,failIn(n){failAfter=uploads+n;},clearFailure(){failAfter=Infinity;}};
}
function inputs(kind,maximum=false){
  const project=structuredClone(kind==='atelier'?starterHorizonProject():kind==='drive'?starterDriveProject():starterRaceProject());project.scenery.profile='low';
  if(maximum){project.scenery.environment='alpine';project.scenery.road=Array.from({length:32},(_,i)=>({id:'resource-'+i,x:0,y:12,z:-30*i,width:9,bank:0,structure:'tunnel',surface:'asphalt'}));}
  if(kind==='drive')project.course='coast';
  const world=kind==='atelier'?null:buildScenicWorld(project.scenery),gates=kind==='race'?createRaceCheckpoints(world.road):null;
  return {project,world,gates};
}
const construct=(kind,canvas,value)=>kind==='atelier'?new HorizonView(canvas,value.project):kind==='drive'?new DriveView(canvas,value.project,value.world):new RaceView(canvas,value.project,value.world,value.gates);
const replace=(kind,view,value)=>kind==='atelier'?view.replace(value.project):kind==='drive'?view.replace(value.project,value.world):view.replace(value.project,value.world,value.gates);
const renamed=value=>({...value,project:{...value.project,scenery:{...value.project.scenery,name:'Edited accepted scenery'}}});

for(const kind of ['atelier','drive','race']){
  test(`${kind}: a maximum admitted scene can be replaced without consuming both versions' per-renderer vertex budget`,()=>{
    const d=device(),value=inputs(kind,true),view=construct(kind,d.canvas,value),before=view.renderer,accepted=before.stats(),oldBuffers=[...d.buffers],oldPrograms=[...d.programs],next=renamed(value);
    assert.ok(accepted.vertices<LIT_PROFILES.low.maxVertices);assert.ok(accepted.vertices+view.world.stats.vertices>LIT_PROFILES.low.maxVertices,'fixture independently crosses the temporary staging limit');
    assert.doesNotThrow(()=>replace(kind,view,next));assert.notEqual(view.renderer,before);assert.equal(before.stats().disposed,true);assert.equal(view.project,next.project);assert.ok(view.renderer.stats().vertices<LIT_PROFILES.low.maxVertices);assert.ok(oldBuffers.every(buffer=>!d.buffers.has(buffer)));assert.ok(oldPrograms.every(program=>!d.programs.has(program)));assert.equal(d.listeners.size,1);
    view.dispose();assert.equal(d.buffers.size,0);assert.equal(d.programs.size,0);assert.equal(d.shaders.size,0);assert.equal(d.listeners.size,0);
  });
  test(`${kind}: renderer renewal failure preserves accepted GPU resources and ordinary edits still reuse them`,()=>{
    const d=device(),value=inputs(kind,true),view=construct(kind,d.canvas,value),before=view.renderer,stats=before.stats(),buffers=[...d.buffers],programs=[...d.programs];d.failIn(4);
    assert.throws(()=>replace(kind,view,renamed(value)),/injected GPU upload failure/);assert.equal(view.renderer,before);assert.equal(view.project,value.project);assert.deepEqual(before.stats(),stats);assert.deepEqual([...d.buffers],buffers);assert.deepEqual([...d.programs],programs);assert.equal(d.listeners.size,1);d.clearFailure();view.dispose();
    const small=inputs(kind),ordinary=construct(kind,d.canvas,small),same=ordinary.renderer,carHandles=ordinary.carRows.map(row=>row.handle),uploads=same.stats().uploads;
    replace(kind,ordinary,small);assert.equal(ordinary.renderer,same);assert.equal(same.stats().uploads,uploads);
    replace(kind,ordinary,renamed(small));assert.equal(ordinary.renderer,same,'ordinary edits retain the renderer');assert.deepEqual(ordinary.carRows.map(row=>row.handle),carHandles,'unchanged car uploads remain retained');ordinary.dispose();assert.equal(d.buffers.size,0);assert.equal(d.programs.size,0);assert.equal(d.listeners.size,0);
  });
}
