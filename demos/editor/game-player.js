// SPDX-License-Identifier: Apache-2.0
import {OptionalRenderer} from '../../modules/render-optional/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {graphicsControls} from '../gpu-lab/controls.js';
import {parseProject} from './asset-foundry.js';
import {createPreview,stepPreview} from './preview.js';
import {createSceneVertices,displayWorld,cameraMatrix} from './viewport.js';
export function mountGame(data){
  const {scene,library,graphics}=parseProject(JSON.stringify(data)),canvas=document.getElementById('view'),renderer=new OptionalRenderer(canvas);
  if(graphics?.optionalGPU)graphicsControls(renderer,document.getElementById('controls'));
  const mesh=renderer.createMesh(createSceneVertices(displayWorld(scene),null,library));
  let state=createPreview(scene),paused=false,last=null,dirty=false;
  const keys=new Set(),clock=new FixedClock({step:1/60,maxFrame:.12,maxSteps:8});
  const pause=value=>{paused=value;keys.clear();last=null;clock.setPaused(value);document.getElementById('pause').textContent=value?'Resume':'Pause';};
  document.getElementById('pause').onclick=()=>pause(!paused);
  window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
  window.addEventListener('keydown',e=>{if(e.target.matches('button,input,select'))return;if(e.code==='Space')e.preventDefault();if(!paused&&!e.repeat)keys.add(e.code);});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  function frame(now){const dt=last===null?0:Math.min(.12,(now-last)/1000);last=now;
    if(!paused)try{clock.advance(dt,()=>{state=stepPreview(scene,state,{x:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),z:Number(keys.has('KeyS'))-Number(keys.has('KeyW')),jump:keys.has('Space')});dirty=true;});}catch{pause(true);}
    if(dirty){renderer.updateMesh(mesh,createSceneVertices(displayWorld(scene,state),null,library));dirty=false;}
    renderer.beginFrame({vp:cameraMatrix({yaw:38,pitch:23,distance:18,target:[0,1,0]},canvas.width,canvas.height)});renderer.draw(mesh);renderer.endFrame();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);return renderer;
}
