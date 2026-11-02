// SPDX-License-Identifier: Apache-2.0
import {clamp,mix,quatInterpolate,rotate,quatConjugate,subtract,length} from '../../modules/math/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {Actions,attachKeyboard,flightBindings} from '../../modules/input/index.js';
import {raycast} from '../../modules/collision/index.js';
import {Renderer,boxVertices,ringVertices} from '../../modules/render-webgl/index.js';
import {createLab,stepLab,focusTarget,LABS} from './recipes.js';

const $=id=>document.getElementById(id),canvas=$('range-view');
const clock=new FixedClock(),actions=new Actions(),screen=new Actions(),pointers=new Map(),buttonKeys=new Set();
let session=createLab(),renderer,staticMesh,geometryMesh,lineMesh,labels=[],running=false,started=false,unavailable=false;
let previousTime=null,frameHandle,lastHud=0,shownReceipt=null,drag=null,dragTurn=[0,0,0],pendingFire=false;
const keyboard=attachKeyboard(window,actions,{bindings:{...flightBindings,KeyF:'fire'},enabled:()=>running});
function clearInput(){
  keyboard.clear();screen.clear();pointers.clear();buttonKeys.clear();drag=null;dragTurn=[0,0,0];pendingFire=false;
  document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
}
function overlay(title,copy,label){
  $('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('launch').textContent=label;$('curtain').hidden=false;
}
function pause(message='Motion, projectiles and cooldowns are frozen. Resume when you are ready.'){
  if(!running)return;
  running=false;clock.setPaused(true);previousTime=null;clearInput();
  $('status').textContent='PAUSED';$('pause').textContent='Resume';$('fire').disabled=true;
  overlay('Hold that thought.',message,'Resume experiment ↗');updateHud();
}
function launch(){
  if(unavailable)return;
  clearInput();running=true;started=true;clock.setPaused(false);previousTime=null;
  $('curtain').hidden=true;$('status').textContent='RUNNING';$('pause').disabled=false;$('pause').textContent='Pause';$('fire').disabled=false;
  canvas.focus({preventScroll:true});
}
function buildScene(){
  renderer.clearMeshes();
  const vertices=session.walls.flatMap(w=>boxVertices(w.center,w.size,w.color));
  // Architectural plinths and floor strips are visual, outside the flight lanes.
  for(const t of session.targets)vertices.push(...boxVertices([t.center[0],-4,t.center[2]],[7,2,7],[.19,.26,.30]));
  staticMesh=renderer.mesh(vertices);geometryMesh=renderer.mesh([]);lineMesh=renderer.mesh([],'lines');
  $('target-labels').replaceChildren();$('target-buttons').replaceChildren();
  labels=session.targets.map(target=>{
    const label=document.createElement('div');label.className='target-label';
    const title=document.createElement('span'),sub=document.createElement('small');title.textContent=target.label;label.append(title,sub);$('target-labels').append(label);
    const button=document.createElement('button');button.textContent=target.label;button.dataset.target=target.id;
    button.setAttribute('aria-pressed',String(target.id===session.selected));
    button.addEventListener('click',()=>{
      pause('A new target is lined up. Resume to fire.');clearInput();focusTarget(session,target.id);
      document.querySelectorAll('[data-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.target===target.id)));
      updateHud();$('announcement').textContent=`${target.label} lined up. Press Enter on the launch button to continue.`;
    });$('target-buttons').append(button);
    return {target,label,sub};
  });
}
function select(kind){
  if(unavailable)return;
  running=false;started=false;clock.reset();clock.setPaused(true);previousTime=null;clearInput();session=createLab(kind);shownReceipt=null;
  if(renderer)buildScene();
  $('status').textContent='READY';$('pause').disabled=true;$('pause').textContent='Pause';$('fire').disabled=true;
  $('space-settings').hidden=kind!=='space';$('bench-settings').hidden=kind!=='bench';$('science-note').hidden=kind!=='bench';$('product-count').hidden=kind!=='bench';
  $('shields').checked=true;$('oxygen').checked=true;$('ignition').checked=false;$('slow').checked=false;
  $('range-mode').textContent=kind==='space'?'INERTIAL / FREE DRIFT':'OBSERVATION STATION';
  $('flight-hint').textContent=kind==='space'?'WASD thrust · arrows turn · X brake':'Arrows or drag to aim · focus a specimen below';
  document.querySelectorAll('[data-lab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lab===kind)));
  $('outcome-badge').dataset.state='ready';$('outcome-badge').textContent='AWAITING IMPACT';
  $('outcome-title').textContent='What will happen?';$('outcome-reason').textContent='Fire at a target. The range will explain which conditions decided the outcome.';
  $('receipt').textContent='No interaction yet.';
  $('impact-log').replaceChildren();const empty=document.createElement('li');empty.className='empty';empty.textContent='Your first impact starts the trail.';$('impact-log').append(empty);
  overlay(kind==='space'?'Make an impact.':'Ask the material.',LABS[kind].description,'Enter the range ↗');updateHud();
}
function updateHud(){
  for(const key of ['shots','hits','applied','products'])$(key).textContent=String(session[key]);
  $('elapsed').textContent=`${session.elapsed.toFixed(2)} s`;
  const last=session.history[0];
  if(last && last!==shownReceipt){
    shownReceipt=last;$('outcome-badge').textContent=last.status.toUpperCase();$('outcome-badge').dataset.state=last.status;
    $('outcome-title').textContent=last.status==='applied'?(session.kind==='bench'?'A new product.':'A clean hull hit.'):last.status==='resisted'?'No reaction here.':'A condition is missing.';
    $('outcome-reason').textContent=last.reasons.map(r=>r.message).join(' ');$('receipt').textContent=JSON.stringify(last,null,2);
    $('impact-log').replaceChildren(...session.history.map(entry=>{
      const row=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span'),status=document.createElement('span'),reason=document.createElement('small');
      time.textContent=`${entry.at.toFixed(2)}s`;text.textContent=session.targets.find(t=>t.id===entry.targetId)?.label??'Range wall';
      reason.textContent=entry.reasons.map(r=>r.message).join(' ');text.append(reason);status.textContent=entry.status.toUpperCase();row.append(time,text,status);return row;
    }));
  }
}
function render(alpha){
  const position=mix(session.previous.position,session.body.position,alpha),orientation=quatInterpolate(session.previous.orientation,session.body.orientation,alpha);
  const vertices=[],lines=[];
  for(const target of session.targets){
    const color=target.kind==='drone'?(target.alive?(session.context.shields?[.57,.50,.86]:[.40,.82,.68]):[.21,.29,.32]):target.color;
    vertices.push(...boxVertices(target.center,target.size,color));
    lines.push(...ringVertices([target.center[0],0,target.center[2]+2.2],3.3,target.alive===false?[.25,.36,.39]:color));
  }
  for(let z=20;z>=-85;z-=5)lines.push(-31,-5.48,z,.21,.33,.38,31,-5.48,z,.21,.33,.38);
  for(let x=-30;x<=30;x+=5)lines.push(x,-5.48,23,.21,.33,.38,x,-5.48,-87,.21,.33,.38);
  for(const shot of session.projectiles.snapshots()){
    // Motion interpolation remains presentation-only; collision always uses ticks.
    const p=shot.position.map((v,i)=>v-shot.velocity[i]*clock.step*(1-alpha));
    vertices.push(...boxVertices(p,[.16,.16,.7],[1,.83,.49]));
    const tail=p.map((v,i)=>v-shot.velocity[i]*.025);lines.push(...p,1,.79,.43,...tail,.65,.40,.20);
  }
  for(const f of session.flashes){
    const age=Math.max(0,session.elapsed-f.at),r=.25+age*5;
    lines.push(...ringVertices(f.position,r,f.status==='applied'?[.65,.94,.82]:[1,.65,.35],24));
  }
  renderer.update(geometryMesh,vertices);renderer.update(lineMesh,lines);
  renderer.begin(position,orientation,{fog:.004,resolution:$('eco').checked?.65:1});
  renderer.draw(staticMesh);renderer.draw(geometryMesh);renderer.draw(lineMesh);
  const f=1/Math.tan(Math.PI/5.2),aspect=canvas.clientWidth/canvas.clientHeight;
  for(const {target,label,sub} of labels){
    const local=rotate(quatConjugate(orientation),subtract([target.center[0],3.5,target.center[2]],position));
    const depth=-local[2],x=local[0]*f/depth/aspect,y=-local[1]*f/depth;
    label.hidden=depth<=.1 || Math.abs(x)>.88 || Math.abs(y)>.8;
    if(!label.hidden){label.style.left=`${50+x*50}%`;label.style.top=`${50+y*50}%`;sub.textContent=target.kind==='drone'?`${target.health} HULL / ${Math.round(length(local))} m`:`${Math.round(length(local))} m`;}
  }
  const hit=raycast(position,rotate(orientation,[0,0,-1]),150,session.colliders);
  $('aim-label').textContent=session.targets.find(t=>t.id===hit?.id)?.label.toUpperCase()??'RANGE WALL';
}
function frame(now){
  const delta=previousTime===null?0:Math.max(0,(now-previousTime)/1000);previousTime=now;
  const key=actions.flight(),touch=screen.flight();
  const command={thrust:key.thrust.map((v,i)=>clamp(v+touch.thrust[i],-1,1)),
    turn:key.turn.map((v,i)=>clamp(v+touch.turn[i]+dragTurn[i],-1,1)),brake:key.brake||touch.brake};
  const result=clock.advance(delta,dt=>{
    // Consume edges even while held, so a brief tap survives until this tick
    // without leaving a stale press to fire after release or a later cooldown.
    const keyPress=actions.consume('fire'),buttonPress=screen.consume('fire');
    stepLab(session,{...command,fire:!!(keyPress||buttonPress||actions.value('fire')||screen.value('fire')||pendingFire)},dt);pendingFire=false;
  },$('slow').checked?.25:1);
  render(running?result.alpha:1);
  if(now-lastHud>80){updateHud();lastHud=now;}frameHandle=requestAnimationFrame(frame);
}
$('launch').addEventListener('click',launch);$('pause').addEventListener('click',()=>running?pause():launch());
$('reset').addEventListener('click',()=>select(session.kind));
document.querySelectorAll('[data-lab]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.lab)));
for(const key of ['shields','oxygen','ignition'])$(key).addEventListener('change',()=>{session.context[key]=$(key).checked;});
window.addEventListener('keydown',event=>{if(event.code==='Escape'&&!event.repeat&&started&&!unavailable){event.preventDefault();running?pause():launch();}});
window.addEventListener('blur',()=>pause('The window lost focus. Controls were cancelled.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('The tab was hidden. No simulation time passed while you were away.');});
window.addEventListener('pagehide',()=>pause());
canvas.addEventListener('pointerdown',event=>{
  if(!running || drag)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY};
});
canvas.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)dragTurn=[clamp((drag.y-event.clientY)/100,-1,1),clamp((drag.x-event.clientX)/100,-1,1),0];});
const releaseDrag=event=>{if(drag?.id===event.pointerId){drag=null;dragTurn=[0,0,0];}};
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,releaseDrag);
document.querySelectorAll('[data-action]').forEach(button=>{
  const action=button.dataset.action;
  const sync=()=>{const held=[...pointers.values()].includes(action)||buttonKeys.has(action);screen.set(action,held);button.classList.toggle('pressed',held);};
  button.addEventListener('pointerdown',event=>{if(!running)return;event.preventDefault();button.setPointerCapture(event.pointerId);pointers.set(event.pointerId,action);if(action==='fire')pendingFire=true;sync();});
  const release=event=>{pointers.delete(event.pointerId);sync();};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
  button.addEventListener('keydown',event=>{
    if(!['Space','Enter'].includes(event.code))return;
    event.preventDefault();if(!running || (event.repeat&&!buttonKeys.has(action)))return;buttonKeys.add(action);sync();
  });
  button.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();buttonKeys.delete(action);sync();}});
  button.addEventListener('blur',()=>{buttonKeys.delete(action);sync();});
  // Assistive activation may have no pointer/keyboard event sequence.
  button.addEventListener('click',event=>{if(running && action==='fire' && event.detail===0)pendingFire=true;});
});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();pause();unavailable=true;cancelAnimationFrame(frameHandle);$('status').textContent='UNAVAILABLE';
  $('error').hidden=false;$('error').textContent='Graphics context lost. Reload the page to restart the lab.';$('launch').disabled=true;$('pause').disabled=true;
});
try{renderer=new Renderer(canvas);select('space');frameHandle=requestAnimationFrame(frame);}
catch(error){unavailable=true;$('error').hidden=false;$('error').textContent=error.message;$('launch').disabled=true;$('status').textContent='UNAVAILABLE';}
