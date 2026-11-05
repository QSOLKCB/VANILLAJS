// SPDX-License-Identifier: Apache-2.0
import {mix,quatInterpolate,rotate} from '../../modules/math/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {Actions,attachKeyboard,attachMouseLook,fpsBindings} from '../../modules/input/index.js';
import {characterView} from '../../modules/character/index.js';
import {raycast} from '../../modules/collision/index.js';
import {Renderer,boxVertices,ringVertices} from '../../modules/render-webgl/index.js';
import {createFpsLab,stepFpsLab,focusPlate,COURSES} from './worlds.js';
const $=id=>document.getElementById(id),canvas=$('fps-view');
const clock=new FixedClock(),actions=new Actions(),screen=new Actions(),pointers=new Map(),buttonKeys=new Set();
let session=createFpsLab(),renderer,sceneMesh,gridMesh,dynamicMesh,lineMesh,running=false,started=false,unavailable=false;
let previousTime=null,frameHandle,lastHud=0,shownReceipt=null,lastShotAt=-Infinity,mouseExitAt=-Infinity;
const keyboard=attachKeyboard(window,actions,{bindings:fpsBindings,enabled:()=>running});
const mouse=attachMouseLook(canvas,{enabled:()=>running&&!unavailable,
  onLock:()=>{$('hint').textContent='Mouse look active · WASD move · C crouch · Esc releases & pauses';},
  onUnlock:event=>{mouseExitAt=event.timeStamp;pause('Mouse released. Resume, then click the view to capture it again.');},
  onError:()=>{$('hint').textContent='Mouse capture unavailable · drag to look or use arrows';}
});
function clearInput(){keyboard.clear();mouse.release();screen.clear();pointers.clear();buttonKeys.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function overlay(title,copy,button){$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('launch').textContent=button;$('curtain').hidden=false;}
function pause(message='Position, shots and reload timers are frozen. Resume when you are ready.'){
  if(!running)return;
  running=false;clock.setPaused(true);previousTime=null;clearInput();
  $('status').textContent='PAUSED';$('pause').textContent='Resume';$('fire').disabled=true;$('reload').disabled=true;
  overlay('Take a breather.',message,'Resume experiment ↗');updateHud();
}
function launch(){
  if(unavailable)return;if(session.complete)select(session.kind);
  clearInput();running=true;started=true;clock.setPaused(false);previousTime=null;
  $('curtain').hidden=true;$('status').textContent='RUNNING';$('pause').disabled=false;$('pause').textContent='Pause';$('fire').disabled=false;$('reload').disabled=false;
  canvas.focus({preventScroll:true});$('hint').textContent='Click view for mouse look · WASD move · C crouch · Space jump';
}
function buildScene(){
  renderer.clearMeshes();sceneMesh=renderer.mesh(session.solids.flatMap(s=>boxVertices(s.center,s.size,s.color)));
  const lines=[];
  for(let z=10;z>-48;z-=2)lines.push(-11.9,.006,z,.2,.3,.4,11.9,.006,z,.2,.3,.4);
  for(let x=-10;x<=10;x+=2)lines.push(x,.006,11.9,.2,.3,.4,x,.006,-47.7,.2,.3,.4);
  gridMesh=renderer.mesh(lines,'lines');dynamicMesh=renderer.mesh([]);lineMesh=renderer.mesh([],'lines');
  $('target-buttons').replaceChildren();
  for(const target of session.targets){
    const button=document.createElement('button');button.textContent=target.label;button.dataset.plate=target.id;
    button.addEventListener('click',()=>{pause('Plate aligned. Resume to fire.');clearInput();focusPlate(session,target.id);updateHud();});
    $('target-buttons').append(button);
  }
}
function syncShotNote(){$('shot-note').textContent=session.shotMode==='trace'?'An instant trace stops at the first surface. Aim directly at the plate.':session.kind==='tracking'?'Bolts travel at 65 m/s. Aim ahead of a moving plate; try quarter-speed.':'Bolts travel at 65 m/s and collide along their full path.';}
function select(kind){
  if(unavailable)return;
  running=false;started=false;clock.reset();clock.setPaused(true);previousTime=null;clearInput();session=createFpsLab(kind);shownReceipt=null;lastShotAt=-Infinity;
  if(renderer)buildScene();
  $('hint').textContent='Launch, then click the view for mouse look.';
  $('status').textContent='READY';$('pause').disabled=true;$('pause').textContent='Pause';$('fire').disabled=true;$('reload').disabled=true;
  $('shot-mode').value=session.shotMode;$('automatic').checked=true;$('slow').checked=false;syncShotNote();
  $('course-progress').hidden=session.checkpoints.length===0;$('range-focus').hidden=!['range','tracking'].includes(kind);
  $('course-progress').replaceChildren(...session.checkpoints.map((checkpoint,i)=>{
    const stage=document.createElement('span');stage.dataset.stage=i;stage.textContent=`0${i+1} ${checkpoint.label}`;return stage;
  }));
  $('motion-readout').hidden=kind!=='tracking';
  $('platform-panel').hidden=!session.platforms.length;$('rider-readout').hidden=!session.platforms.length;
  $('run-note').textContent=kind==='lowpass'?'Hold C to crouch at 2.5 m/s. Release to stand when the roof clears. Follow all four stance markers.':kind==='tracking'?'Three plates move on separate tracks. Lead bolts; aim traces directly. Plate motion freezes while paused.':'Walk at 5 m/s. Sprint at 8 m/s. Hold C to crouch at 2.5 m/s. Shallow stairs climb automatically.';
  document.querySelectorAll('[data-course]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.course===kind)));
  $('outcome').textContent='Ready when you are.';$('impact-log').replaceChildren();const empty=document.createElement('li');empty.textContent='Hits, spent plates and cover all leave a receipt.';$('impact-log').append(empty);
  if(session.platforms.length)$('run-note').textContent=kind==='lift'?'The lift stops when headroom runs out. Hold C to continue, then walk onto the upper deck.':'Ride the shuttle to the far dock. Jumping keeps its momentum. Falling returns you to the start.';
  overlay({course:'Find your footing.',range:'Make every round count.',lowpass:'Watch your head.',tracking:'Aim where it will be.',lift:'Going up. Mind your head.',shuttle:'Keep your feet. Cross the gap.'}[kind],COURSES[kind].description,'Enter experiment ↗');updateHud();
}
function updateHud(){
  const body=session.character,weapon=session.weapon.snapshot();
  $('speed').innerHTML=`${Math.hypot(body.velocity[0],body.velocity[2]).toFixed(1)} <em>m/s</em>`;
  $('height').innerHTML=`${body.position[1].toFixed(2)} <em>m</em>`;$('elapsed').innerHTML=`${session.elapsed.toFixed(2)} <em>s</em>`;
  $('ammo').textContent=weapon.ammo;$('reserve').textContent=weapon.reserve;
  $('weapon-state').textContent=weapon.phase.toUpperCase();$('reload-time').textContent=weapon.phase==='reloading'?`${weapon.reloadRemaining.toFixed(1)} s`:'8-round magazine';
  $('reload-meter').style.width=`${weapon.phase==='reloading'?(1-weapon.reloadRemaining/1.2)*100:0}%`;
  $('stance').textContent=body.crouched?(session.lastMovement?.standBlocked?'CROUCHED · LOW CEILING':'CROUCHED'):body.grounded?'GROUNDED':body.velocity[1]>0?'RISING':'FALLING';
  $('body-height').textContent=`${(body.halfExtents[1]*2).toFixed(2)} m`;
  $('target-x').textContent=session.targets[0]?.center[0].toFixed(2)??'—';
  $('support-name').textContent=body.supportId??'AIR';$('rescues').textContent=session.rescues;
  $('platform-phase').textContent=session.platformTime.toFixed(2);
  $('platform-state').textContent=session.platformBlocked?'CLEARANCE STOP':session.platformDirection>0?'ROUTE FORWARD':'ROUTE REVERSED';
  $('platform-note').textContent=session.platformBlocked?'Platform stopped safely. Your controls still work: hold C to duck or move clear.':session.kind==='lift'?'Ride up, duck beneath the beam, then walk forward onto the upper deck.':'Stay aboard until the far dock, then walk or jump forward onto the landing.';
  for(const key of ['steps','jumps','shots','hits'])$(key).textContent=session[key];
  $('cleared').textContent=`${session.cleared} / ${session.targets.length}`;
  const goal=session.checkpoints[session.nextCheckpoint];
  $('goal').textContent=session.checkpoints.length?(goal?`${String(session.nextCheckpoint+1).padStart(2,'0')} / ${goal.label}`:'COURSE COMPLETE'):`${session.cleared} / ${session.targets.length} PLATES CLEARED`;
  document.querySelectorAll('[data-stage]').forEach(el=>{el.classList.toggle('done',Number(el.dataset.stage)<session.nextCheckpoint);el.classList.toggle('active',Number(el.dataset.stage)===session.nextCheckpoint);});
  const last=session.history[0];
  if(last && last!==shownReceipt){
    shownReceipt=last;$('outcome').textContent=last.status==='applied'?'A clean hit.':last.status==='blocked'?'The shot stopped here.':'No effect.';
    $('impact-log').replaceChildren(...session.history.map(entry=>{
      const row=document.createElement('li'),time=document.createElement('time'),copy=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');
      time.textContent=`${entry.at.toFixed(2)}s`;title.textContent=entry.label;detail.textContent=entry.message;copy.append(title,detail);row.append(time,copy);return row;
    }));
  }
}
function render(alpha){
  const view=characterView(session.character),position=mix(session.previous.position,view.position,alpha),orientation=quatInterpolate(session.previous.orientation,view.orientation,alpha);
  const vertices=[],lines=[];
  for(const platform of session.platforms){
    const center=mix(platform.previousCenter,platform.center,alpha);
    boxVertices(center,platform.size,session.platformBlocked?[.8,.48,.22]:platform.color,vertices);
    const r=platform.route;lines.push(r.from[0]+2.1,r.from[1]+.26,r.from[2],.3,.65,.75,r.to[0]+2.1,r.to[1]+.26,r.to[2],.3,.65,.75);
  }
  for(const target of session.targets){
    const center=target.previousCenter?mix(target.previousCenter,target.center,alpha):target.center;
    const color=target.alive?target.color:[.16,.24,.3];boxVertices(center,target.size,color,vertices);
    ringVertices([center[0],center[1],center[2]+.22],.55,target.alive?[.9,.7,.44]:[.25,.36,.44],24,lines);
    if(target.motion){const m=target.motion;lines.push(m.originX-m.amplitude,.25,center[2],.45,.36,.24,m.originX+m.amplitude,.25,center[2],.45,.36,.24);}
  }
  session.checkpoints.forEach((checkpoint,i)=>{
    const color=i<session.nextCheckpoint?[.4,.7,.5]:i===session.nextCheckpoint?[.57,.79,.95]:[.23,.35,.45];
    ringVertices(checkpoint.position.map((v,k)=>v+(k===1?1:0)),.7,color,32,lines);
  });
  for(const shot of session.projectiles.snapshots())boxVertices(shot.position,[.07,.07,.18],[1,.73,.39],vertices);
  for(const trace of session.tracers)lines.push(...trace.from,.94,.77,.5,...trace.to,.94,.77,.5);
  for(const flash of session.flashes)ringVertices(flash.position,.08+(session.elapsed-flash.at)*1.8,[1,.76,.47],16,lines);
  renderer.update(dynamicMesh,vertices);renderer.update(lineMesh,lines);
  renderer.begin(position,orientation,{fog:.012,resolution:$('eco').checked?.65:1});renderer.draw(sceneMesh);renderer.draw(gridMesh);renderer.draw(dynamicMesh);renderer.draw(lineMesh);
  const hit=raycast(position,rotate(orientation,[0,0,-1]),130,session.colliders),target=session.targets.find(t=>t.id===hit?.id);
  $('aim-label').textContent=target?`${target.label.toUpperCase()} / ${target.health} INTEGRITY`:session.checkpoints.length?'FOLLOW THE BLUE MARKERS':session.kind==='tracking'?'LEAD YOUR BOLTS':'STATIC TRAINING RANGE';
  $('hit-mark').hidden=!session.flashes.some(f=>f.status==='applied' && session.elapsed-f.at<.12);
  document.querySelector('.weapon').classList.toggle('firing',session.elapsed-lastShotAt<.08);
}
function frame(now){
  const delta=previousTime===null?0:Math.max(0,(now-previousTime)/1000);previousTime=now;
  const result=clock.advance(delta,dt=>{
    const look=mouse.consume(),jump=actions.consume('jump')|screen.consume('jump'),reload=actions.consume('reload')|screen.consume('reload');
    const fireEdge=actions.consume('fire')|screen.consume('fire')|look.pressed;
    const fire=fireEdge || ($('automatic').checked && (actions.value('fire')||screen.value('fire')||look.primary));
    const axis=(a,b)=>actions.axis(a,b)+screen.axis(a,b),previous=session.nextCheckpoint,priorRescues=session.rescues;
    const events=stepFpsLab(session,{move:[axis('left','right'),axis('forward','backward')],jump:!!jump,reload:!!reload,fire:!!fire,
      sprint:!!(actions.value('sprint')||screen.value('sprint')),
      crouch:!!(actions.value('crouch')||screen.value('crouch')),
      look:{yaw:look.yaw+axis('yawRight','yawLeft')*1.6*dt,pitch:look.pitch+axis('pitchDown','pitchUp')*1.6*dt}},dt);
    if(events.some(e=>e.type==='shot'))lastShotAt=session.elapsed;
    if(previous!==session.nextCheckpoint)$('announcement').textContent=`Checkpoint ${session.nextCheckpoint} of 4 reached.`;
    if(priorRescues!==session.rescues){clearInput();$('announcement').textContent='Returned to the start. Release and press movement controls again.';}
    if(session.truncated)pause('Collision movement reached its limit. Reset the experiment to recover.');
    if(session.complete){
      running=false;clock.setPaused(true);clearInput();$('status').textContent='COMPLETE';$('pause').disabled=true;$('fire').disabled=true;$('reload').disabled=true;
      overlay(session.checkpoints.length?'Course complete.':'Range cleared.',`${session.elapsed.toFixed(2)} simulation seconds. ${session.checkpoints.length?'All four markers reached.':`${session.hits} hits from ${session.shots} shots.`}`,'Run it again ↗');updateHud();
    }
  },$('slow').checked?.25:1);
  render(running?result.alpha:1);if(now-lastHud>70){updateHud();lastHud=now;}frameHandle=requestAnimationFrame(frame);
}
$('launch').addEventListener('click',launch);$('pause').addEventListener('click',()=>running?pause():launch());$('reset').addEventListener('click',()=>select(session.kind));
document.querySelectorAll('[data-course]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.course)));
$('shot-mode').addEventListener('change',()=>{pause('Shot type changed. Resume to compare its behaviour.');clearInput();session.shotMode=$('shot-mode').value;session.projectiles.clear();syncShotNote();});
$('automatic').addEventListener('change',()=>{clearInput();});
$('reverse-platform').addEventListener('click',()=>{pause('Platform route reversed. Resume when ready.');clearInput();session.platformDirection*=-1;updateHud();});
window.addEventListener('keydown',event=>{if(event.code==='Escape'&&!event.repeat&&event.timeStamp-mouseExitAt>200&&started&&!unavailable){event.preventDefault();running?pause():launch();}});
window.addEventListener('blur',()=>pause('The window lost focus. All controls were cancelled.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('The tab was hidden. No simulation time passed.');});window.addEventListener('pagehide',()=>pause());
document.querySelectorAll('[data-action]').forEach(button=>{
  const action=button.dataset.action;
  const sync=()=>{const held=[...pointers.values()].includes(action)||buttonKeys.has(action);screen.set(action,held);button.classList.toggle('pressed',held);};
  button.addEventListener('pointerdown',event=>{if(!running)return;event.preventDefault();button.setPointerCapture(event.pointerId);pointers.set(event.pointerId,action);sync();});
  const release=(event,cancel=false)=>{const held=pointers.delete(event.pointerId);sync();if(cancel&&held&&!screen.value(action))screen.consume(action);};
  button.addEventListener('pointerup',event=>release(event));
  for(const name of ['pointercancel','lostpointercapture'])button.addEventListener(name,event=>release(event,true));
  button.addEventListener('keydown',event=>{if(!['Space','Enter'].includes(event.code))return;event.preventDefault();if(!running || (event.repeat&&!buttonKeys.has(action)))return;buttonKeys.add(action);sync();});
  button.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();buttonKeys.delete(action);sync();}});
  button.addEventListener('blur',()=>{buttonKeys.delete(action);sync();});
  button.addEventListener('click',event=>{if(running && event.detail===0 && ['fire','jump','reload'].includes(action)){screen.set(action,true);screen.set(action,false);}});
});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();pause();unavailable=true;cancelAnimationFrame(frameHandle);$('status').textContent='UNAVAILABLE';
  $('error').hidden=false;$('error').textContent='Graphics context lost. Reload the page to restart the lab.';$('launch').disabled=true;$('pause').disabled=true;
});
try{renderer=new Renderer(canvas);select('course');frameHandle=requestAnimationFrame(frame);}
catch(error){unavailable=true;$('error').hidden=false;$('error').textContent=error.message;$('launch').disabled=true;$('status').textContent='UNAVAILABLE';}
