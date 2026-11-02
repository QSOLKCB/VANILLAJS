// SPDX-License-Identifier: Apache-2.0
import {length,mix,quatInterpolate,rotate,quatConjugate,subtract,clamp} from '../../modules/math/index.js';
import {lookFlight} from '../../modules/flight/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {Actions,attachKeyboard,attachMouseLook,FlightGamepad} from '../../modules/input/index.js';
import {Renderer,boxVertices,ringVertices} from '../../modules/render-webgl/index.js';
import {createSession,updateSession,DEMOS} from './worlds.js';
const $=id=>document.getElementById(id), canvas=$('flight');
const clock=new FixedClock(), actions=new Actions(), touch=new Actions(), gamepad=new FlightGamepad();
let session=createSession(), running=false, started=false, previousTime=null, renderer, meshes, lastHud=0, frameHandle;
let padConnected=false, unavailable=false;
const touchPointers=new Map();
const keyboard=attachKeyboard(window,actions,{enabled:()=>running});
let mouseExitAt=-Infinity;
const mouse=attachMouseLook(canvas,{enabled:()=>running&&!unavailable,
  onLock:()=>{
    lookFlight(session.body);session.previous.orientation=[...session.body.orientation];
    $('hint').textContent='Mouse look active · WASD thrust · Esc releases & pauses';
  },
  onUnlock:event=>{mouseExitAt=event.timeStamp;pause('Mouse released. Resume, then click the view to capture it again.');},
  onError:()=>{$('hint').textContent='Mouse capture unavailable · drag to look or use arrows';}
});
function clearInput(){keyboard.clear();mouse.release();touch.clear();gamepad.reset();touchPointers.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function announce(text){$('announcement').textContent=text;}
function buildMeshes(){
  renderer.clearMeshes();
  const world=session.world;
  meshes={solid:renderer.mesh([...world.solids,...world.decoration].flatMap(b=>boxVertices(b.center,b.size,b.color))),
    stars:renderer.mesh(world.stars.flatMap(p=>[...p,.55,.65,.72]),'points'),
    gates:world.gates.map(g=>({active:renderer.mesh(ringVertices(g.position,g.radius,[.65,.94,.82]),'lines'),
      inactive:renderer.mesh(ringVertices(g.position,g.radius,[.2,.36,.4]),'lines'),done:renderer.mesh(ringVertices(g.position,g.radius,[.91,.68,.36]),'lines')}))};
}
function syncSettings(){
  $('assist').checked=session.config.assisted;
  $('thrust').value=session.config.acceleration;$('turn').value=session.config.angularAcceleration;
  $('thrust-value').textContent=`${session.config.acceleration} m/s²`;
  $('turn-value').textContent=`${session.config.angularAcceleration.toFixed(1)} rad/s²`;
  $('mode-label').textContent=session.config.assisted?'ASSISTANCE ONLINE':'INERTIAL / FREE DRIFT';
}
function overlay(title,copy,button,kicker='FLIGHT LAB / EXPERIMENT 001'){
  $('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('launch').firstChild.textContent=button+' ';
  $('overlay-kicker').textContent=kicker;$('curtain').hidden=false;
}
function pause(reason='Simulation paused. Your position and momentum are preserved.'){
  if(!running)return;
  running=false;clock.setPaused(true);previousTime=null;clearInput();
  $('status').textContent='PAUSED';$('pause').textContent='Resume';
  updateHud();
  overlay('Take a breath.',reason,'Resume experiment');announce('Flight paused.');
}
function launch(){
  if(unavailable)return;
  if(session.complete)select(session.world.kind);
  clearInput();started=true;running=true;clock.setPaused(false);previousTime=null;
  $('curtain').hidden=true;$('status').textContent='RUNNING';$('pause').disabled=false;$('pause').textContent='Pause';
  canvas.focus({preventScroll:true});$('hint').textContent='Click view for mouse look · WASD thrust · arrows turn';announce(`${DEMOS[session.world.kind].name} started.`);
}
function select(kind){
  if(unavailable)return;
  running=false;started=false;clock.reset();clock.setPaused(true);previousTime=null;clearInput();
  session=createSession(kind);syncSettings();if(renderer)buildMeshes();
  $('status').textContent='READY';$('pause').textContent='Pause';$('pause').disabled=true;
  document.querySelectorAll('[data-demo]').forEach(b=>{const active=b.dataset.demo===kind;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  overlay(kind==='tunnel'?'Follow the signal.':'Let momentum lead.',DEMOS[kind].description,'Launch experiment','SIX AXES. ONE SHARED CORE.');
  updateHud();announce(`${DEMOS[kind].name} selected.`);
}
function updateHud(){
  const speed=length(session.body.velocity),spin=length(session.body.angularVelocity),time=session.elapsed;
  $('speed').innerHTML=`${speed.toFixed(1)} <em>m/s</em>`;$('speed-meter').style.width=`${Math.min(100,speed/60*100)}%`;
  $('spin').innerHTML=`${spin.toFixed(2)} <em>rad/s</em>`;
  $('elapsed').textContent=`${String(Math.floor(time/60)).padStart(2,'0')}:${(time%60).toFixed(1).padStart(4,'0')}`;
  $('contacts').textContent=String(session.collisions).padStart(2,'0');
  $('gate-count').textContent=`SIGNAL ${String(Math.min(6,session.nextGate+1)).padStart(2,'0')} / 06`;
}
function render(alpha){
  const position=mix(session.previous.position,session.body.position,alpha),orientation=quatInterpolate(session.previous.orientation,session.body.orientation,alpha);
  renderer.begin(position,orientation,{fog:session.world.kind==='tunnel'?.004:.001,resolution:$('eco').checked?.65:1});
  renderer.draw(meshes.stars);renderer.draw(meshes.solid);
  meshes.gates.forEach((g,i)=>renderer.draw(i===session.nextGate?g.active:i<session.nextGate?g.done:g.inactive));
  const gate=session.world.gates[session.nextGate];$('target').hidden=!gate || !running;
  if(gate){
    const local=rotate(quatConjugate(orientation),subtract(gate.position,position)),depth=-local[2],f=1/Math.tan(Math.PI/5.2),aspect=canvas.clientWidth/canvas.clientHeight;
    const x=depth>.1?local[0]*f/depth/aspect:Math.sign(local[0]||1)*2;
    const y=depth>.1?-local[1]*f/depth:0;
    $('target').style.left=`${clamp(50+x*50,8,92)}%`;$('target').style.top=`${clamp(50+y*50,14,82)}%`;
    $('target').firstElementChild.textContent=String(session.nextGate+1).padStart(2,'0');
    $('target-distance').textContent=`${Math.round(length(local))} m`;
    $('bearing').textContent=depth<0?'TARGET BEHIND / TURN AROUND':Math.abs(x)>1?(x<0?'TARGET LEFT':'TARGET RIGHT'):Math.abs(y)>1?(y<0?'TARGET ABOVE':'TARGET BELOW'):'TARGET AHEAD';
  }else $('bearing').textContent='ALL SIGNALS ACQUIRED';
}
function frame(now){
  const delta=previousTime===null?0:Math.max(0,(now-previousTime)/1000);previousTime=now;
  const pad=gamepad.sample(navigator.getGamepads?.()??[]);
  if(padConnected&&!pad.connected)pause('Controller disconnected. Reconnect or continue with the keyboard.');
  padConnected=pad.connected;
  if(pad.pause&&started){if(running)pause();else launch();}
  const key=actions.flight(),screen=touch.flight();
  const input={thrust:key.thrust.map((v,i)=>clamp(v+screen.thrust[i]+pad.thrust[i],-1,1)),
    turn:key.turn.map((v,i)=>clamp(v+screen.turn[i]+pad.turn[i],-1,1)),brake:key.brake||screen.brake||pad.brake};
  const result=clock.advance(delta,dt=>{
    const look=mouse.consume();
    if(look.pitch || look.yaw)lookFlight(session.body,look);
    const before=session.nextGate;updateSession(session,input,dt);
    if(session.nextGate>before)announce(`Signal ${session.nextGate} of 6 acquired.`);
    if(session.complete){
      running=false;clock.setPaused(true);clearInput();$('status').textContent='COMPLETE';$('pause').disabled=true;
      overlay('Signal complete.',`Six signals acquired in ${session.elapsed.toFixed(1)} simulation seconds, with ${session.collisions} contacts. Try a different flight model or tune your next run.`,'Fly again','EXPERIMENT COMPLETE');
    }
  },Number($('time-scale').value)*(actions.value('slow')?.25:1));
  render(running?result.alpha:1);
  if(now-lastHud>80){updateHud();lastHud=now;}
  frameHandle=requestAnimationFrame(frame);
}
$('launch').addEventListener('click',launch);
$('pause').addEventListener('click',()=>running?pause():launch());
$('reset').addEventListener('click',()=>select(session.world.kind));
document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.demo)));
$('assist').addEventListener('change',()=>{session.config.assisted=$('assist').checked;syncSettings();});
$('thrust').addEventListener('input',()=>{session.config.acceleration=Number($('thrust').value);syncSettings();});
$('turn').addEventListener('input',()=>{session.config.angularAcceleration=Number($('turn').value);syncSettings();});
$('time-scale').addEventListener('input',()=>{$('time-value').textContent=`${Number($('time-scale').value).toFixed(2)}×`;});
window.addEventListener('keydown',event=>{
  if(event.code==='Escape'&&!event.repeat&&event.timeStamp-mouseExitAt>200&&started){event.preventDefault();if(running)pause();else launch();}
});
window.addEventListener('blur',()=>pause('The window lost focus. Resume when you are ready.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('The tab was hidden. No simulation time passed while you were away.');});
document.querySelectorAll('[data-action]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{if(!running)return;event.preventDefault();button.setPointerCapture(event.pointerId);touchPointers.set(event.pointerId,button.dataset.action);touch.set(button.dataset.action,true);button.classList.add('pressed');});
  const release=event=>{touchPointers.delete(event.pointerId);const held=[...touchPointers.values()].includes(button.dataset.action);touch.set(button.dataset.action,held);if(!held)button.classList.remove('pressed');};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
});
window.addEventListener('pagehide',()=>pause());
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();pause('The graphics context was lost.');unavailable=true;cancelAnimationFrame(frameHandle);
  $('error').hidden=false;$('error').textContent='Graphics context lost. Reload the page to restart the lab.';$('launch').disabled=true;
});
try{renderer=new Renderer(canvas);select('tunnel');frameHandle=requestAnimationFrame(frame);}
catch(error){unavailable=true;$('error').hidden=false;$('error').textContent=error.message;$('launch').disabled=true;$('status').textContent='UNAVAILABLE';}
