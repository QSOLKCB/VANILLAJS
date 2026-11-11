// SPDX-License-Identifier: Apache-2.0
import {OptionalRenderer,projectVertices} from '../../modules/render-optional/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {cameraMatrix} from '../editor/viewport.js';
import {graphicsControls} from './controls.js';
import {galaxy,sphere,station,ship} from '../space-lab/geometry.js';
import {createWorld,stepWorld,aim} from '../space-lab/world.js';
const $=id=>document.getElementById(id),canvas=$('view'),space=!!$('mechanic');
const renderer=new OptionalRenderer(canvas);graphicsControls(renderer,$('graphics'));
let world=createWorld(),paused=false,last=null,angle=25,frames=0,total=0;
const keys=new Set(),clock=new FixedClock({step:1/60,maxFrame:.12,maxSteps:8});
const stars=renderer.createMesh(galaxy(),'points'),planet=renderer.createMesh(sphere([-18,0,-15],7)),base=renderer.createMesh(station()),actor=renderer.createMesh(ship(world)),target=renderer.createMesh(sphere([12,0,8],2,12));
function reset(){world=createWorld($('mechanic')?.value??'flight');keys.clear();clock.reset();last=null;}
$('reset').onclick=reset;if(space)$('mechanic').onchange=reset;
function pause(value){paused=value;keys.clear();clock.setPaused(value);last=null;$('pause').textContent=value?'Resume':'Pause';if(!value)canvas.focus({preventScroll:true});}
$('pause').onclick=()=>pause(!paused);
window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
window.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(e.code==='Space')e.preventDefault();if(!paused&&!e.repeat)keys.add(e.code);});
window.addEventListener('keyup',e=>keys.delete(e.code));
if(!space){
  $('count').onchange=()=>renderer.updateMesh(stars,galaxy(Number($('count').value)));
  $('loss').onclick=()=>{if(renderer.gpu)renderer.gpu.device.destroy();};
  $('parity').onclick=async()=>{try{
    const {default:bytes}=await import('../../modules/render-optional/wasm-bytes.js');
    const {instance}=await WebAssembly.instantiate(bytes),data=station(),vp=cameraMatrix({yaw:38,pitch:23,distance:55,target:[0,0,0]},960,540);
    const memory=instance.exports.memory.buffer;new Float32Array(memory,0,16).set(vp);new Float32Array(memory,64,data.length).set(data);
    instance.exports.project(64,4194304,0,data.length/6);
    const a=projectVertices(data,vp),b=new Float32Array(memory,4194304,a.length);
    const error=a.reduce((m,v,i)=>Math.max(m,Math.abs(v-b[i])),0);$('result').textContent=(error===0?'PASS':'FAIL')+' · maximum absolute clip-space error '+error+' · '+a.length/7+' vertices';
  }catch(e){$('result').textContent='Unavailable: '+e.message;}};
}
function frame(now){
  const dt=last===null?0:Math.min(.12,(now-last)/1000);last=now;
  if(!paused)clock.advance(dt,()=>{if(space)stepWorld(world,{thrust:Number(keys.has('KeyW'))-Number(keys.has('KeyS')),turn:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),rise:Number(keys.has('KeyR'))-Number(keys.has('KeyF')),brake:keys.has('KeyX'),dock:keys.has('KeyE'),fire:keys.has('Space')});else angle+=.15;});
  const start=performance.now();if(space&&!paused)renderer.updateMesh(actor,ship(world));
  renderer.beginFrame({vp:cameraMatrix({yaw:space?32:angle,pitch:space?48:24,distance:65,target:[0,0,0]},canvas.width,canvas.height)});
  renderer.draw(stars);renderer.draw(planet);renderer.draw(base);if(space){renderer.draw(actor);if(world.mode==='broadside')renderer.draw(target);}renderer.endFrame();
  total+=performance.now()-start;frames++;
  if(frames%15===0)$('metrics').textContent=renderer.mode+' · '+(total/frames).toFixed(2)+' ms average CPU render submission · '+(space?'tick '+world.tick+' · speed '+Math.hypot(...world.velocity).toFixed(2)+' m/s · '+(world.docked?'DOCKED':'free')+' · hits '+world.hits+' · intercept '+(aim(world)?.time.toFixed(2)??'none')+' s':'resident stars '+$('count').value+' / logical 16,777,216');
  requestAnimationFrame(frame);
}
window.lab={renderer,get world(){return world;},pause,reset};document.documentElement.dataset.labReady='ready';requestAnimationFrame(frame);
