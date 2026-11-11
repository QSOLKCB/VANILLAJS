// SPDX-License-Identifier: Apache-2.0
import {OptionalRenderer,projectVertices} from '../../modules/render-optional/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {cameraMatrix} from '../editor/viewport.js';
import {graphicsControls} from './controls.js';
import {createSculpture,stepSculpture,sculpture,plinth,grid} from './scene.js';
const $=id=>document.getElementById(id);
async function mount(){
  const canvas=$('view'),renderer=new OptionalRenderer(canvas),clock=new FixedClock({step:1/60,maxFrame:.12,maxSteps:8});
  let state=createSculpture(),paused=matchMedia('(prefers-reduced-motion: reduce)').matches,last=null,lastDraw=-Infinity,dirty=true,angle=35;
  let total=0,samples=0,displayedTick=-1;
  const stage=renderer.createMesh(plinth()),lines=renderer.createMesh(grid(),'lines'),field=renderer.createMesh(sculpture(state));
  const names={ripple:'RADIAL RIPPLE',conveyor:'ASSEMBLY LINE',weave:'INTERFERENCE'};
  function focus(){canvas.focus({preventScroll:true});}
  function update(){dirty=true;$('population').textContent=state.size**2+' PILLARS';$('scene-name').textContent=names[state.pattern];
    for(const button of document.querySelectorAll('[data-pattern]'))button.setAttribute('aria-pressed',String(button.dataset.pattern===state.pattern));}
  function pause(value){paused=value;clock.setPaused(value);last=null;dirty=true;$('pause').textContent=value?'Resume':'Pause';$('state-label').textContent=value?'PAUSED':'RUNNING';if(!value)focus();}
  function reset(){state=createSculpture(state.pattern,Number($('count').value));clock.reset();last=null;displayedTick=-1;total=0;samples=0;update();}
  graphicsControls(renderer,$('graphics'),()=>{dirty=true;$('loss').disabled=!renderer.gpu;});
  $('pause').onclick=()=>pause(!paused);$('reset').onclick=()=>{reset();focus();};
  for(const button of document.querySelectorAll('[data-pattern]'))button.onclick=()=>{state.pattern=button.dataset.pattern;reset();focus();};
  $('count').onchange=reset;$('angle').oninput=()=>{angle=Number($('angle').value);dirty=true;};$('rotate').onchange=()=>{dirty=true;};
  $('loss').onclick=()=>{renderer.gpu?.device.destroy();focus();};
  $('parity').onclick=async()=>{
    $('parity').disabled=true;
    try{
      const {default:bytes}=await import('../../modules/render-optional/wasm-bytes.js');
      const {instance}=await WebAssembly.instantiate(bytes),data=sculpture(state),vp=cameraMatrix({yaw:angle,pitch:35,distance:36,target:[0,1,0]},canvas.width,canvas.height);
      const memory=instance.exports.memory.buffer;new Float32Array(memory,0,16).set(vp);new Float32Array(memory,64,data.length).set(data);
      instance.exports.project(64,4194304,0,data.length/6);
      const a=projectVertices(data,vp),b=new Float32Array(memory,4194304,a.length),error=a.reduce((m,v,i)=>Math.max(m,Math.abs(v-b[i])),0);
      $('result').textContent=(error===0?'PASS':'FAIL')+' · maximum absolute clip-space error '+error+' · '+data.length/6+' vertices. Rendering mode unchanged.';
    }catch(e){$('result').textContent='Unavailable: '+e.message;}finally{$('parity').disabled=false;focus();}
  };
  window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
  function resize(){canvas.width=Math.min(960,Math.max(240,Math.round(canvas.clientWidth)));canvas.height=Math.round(canvas.width*canvas.clientHeight/canvas.clientWidth);dirty=true;}
  window.addEventListener('resize',resize);resize();pause(paused);
  function frame(now){
    const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
    if(!paused)clock.advance(dt,()=>{stepSculpture(state);if($('rotate').checked)angle=(angle+.08)%360;});
    // Bounded CPU presentation, retained static meshes and no redraw while idle.
    if(dirty||(!paused&&now-lastDraw>=1000/(renderer.gpu?60:30))){
      const start=performance.now();
      if(displayedTick!==state.tick){renderer.updateMesh(field,sculpture(state));displayedTick=state.tick;}
      renderer.beginFrame({vp:cameraMatrix({yaw:angle,pitch:35,distance:36,target:[0,1,0]},canvas.width,canvas.height)});
      renderer.draw(stage);renderer.draw(lines);renderer.draw(field);renderer.endFrame();
      total+=performance.now()-start;samples++;lastDraw=now;dirty=false;
      if(samples%10===1||paused)$('metrics').textContent=renderer.mode+' · '+state.size**2*12+' animated triangles · '+(total/samples).toFixed(2)+' ms CPU submission';
    }
    requestAnimationFrame(frame);
  }
  window.lab={kind:'kinetic-foundry',renderer,get world(){return state;},pause,reset};document.documentElement.dataset.labReady='ready';requestAnimationFrame(frame);
}
mount().catch(error=>{$('error').hidden=false;$('error').textContent='This demo needs Canvas 2D. '+error.message;document.documentElement.dataset.labReady='failed';for(const b of document.querySelectorAll('button'))b.disabled=true;});
