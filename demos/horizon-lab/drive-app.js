// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {createVehicle,vehiclePreset,serializeVehicle,VEHICLE_STEP} from '../../modules/vehicle3d/index.js';
import {starterDriveProject,validateDriveProject,parseDriveProject,serializeDriveProject,DRIVE_PROJECT_BYTES} from './drive-project.js';
import {createDriveWorld,createCourseScenery} from './drive-world.js';
import {DriveView} from './drive-view.js';
import {DriveInput} from './drive-input.js';
const get=id=>document.getElementById(id),copy=value=>JSON.parse(JSON.stringify(value)),canvas=get('scene');
const clock=new FixedClock({step:VEHICLE_STEP,maxFrame:.1,maxSteps:12}),input=new DriveInput({directional:true});
let project=starterDriveProject(),model,world,state,view=null,running=false,lost=false,disposed=false,frame=0,last=null,generation=0,pendingGear=null,ticks=0,barrierCount=0,history=[serializeDriveProject(project)],cursor=0;
const status=(message,error=false)=>{get('status').textContent=message;get('status').classList.toggle('error',error);};
function spawnPose(w,r){const p=w.spawn,offset=r.wheel.radius+r.suspension.restLength-r.mass*9.81/(4*r.suspension.spring);return {position:[p.position[0],p.position[1]+offset,p.position[2]],yaw:p.yaw,pitch:p.pitch,roll:p.roll};}
function initialState(m,w,r){let next=m.spawn(spawnPose(w,r));for(let i=0;i<120;i++)next=m.step(next,{brake:1},w.physics);return next;}
function prepare(next){const nextWorld=createDriveWorld(next.scenery,next.surfaces,next.course),nextModel=createVehicle(next.vehicle),nextState=initialState(nextModel,nextWorld,next.vehicle);return {world:nextWorld,model:nextModel,state:nextState};}
const initial=prepare(project);world=initial.world;model=initial.model;state=initial.state;
function failed(error){get('graphics-error').hidden=false;get('graphics-message').textContent='View unavailable: '+error.message+'. Accepted data remains editable and exportable.';}
function createView(){try{view=new DriveView(canvas,project,world);lost=false;get('graphics-error').hidden=true;}catch(error){view=null;failed(error);}}
function paint(){if(view&&!lost)try{view.draw(state);}catch(error){running=false;clock.setPaused(true);input.cancel();cancelAnimationFrame(frame);failed(error);}hud();}
const wheelNames=['FL','FR','RL','RR'];
for(const name of wheelNames){const row=document.createElement('tr');for(let i=0;i<5;i++){const cell=i===0?document.createElement('th'):document.createElement('td');if(i===0){cell.textContent=name;cell.scope='row';}row.append(cell);}get('wheel-rows').append(row);}
function hud(){
  get('mode').textContent=lost?'GRAPHICS LOST':running?'DRIVING':'PAUSED';get('drive').textContent=ticks?'Resume driving':'Start driving';get('drive').disabled=running||lost||!view||state.needsRecovery;get('pause').disabled=!running;get('retry-graphics').disabled=lost;
  get('study-name').textContent=project.name.toUpperCase();get('course-title').textContent=({pad:'The handling ground',ramp:'The launch & landing strip',coast:'Aster Coast — the high road'})[project.course];
  get('speed').textContent=String(Math.round(Math.hypot(...state.velocity)*3.6));get('gear-rpm').textContent=(state.gear<0?'R':state.gear===0?'N':state.gear)+' · '+Math.round(state.rpm)+' RPM';if(document.activeElement!==get('gear'))get('gear').value=String(state.gear);
  get('contact-caption').textContent=state.wheels.filter(w=>w.grounded).length+'/4 contacts · '+(state.needsRecovery?'return to start required':running?'live physics':'paused');
  get('stat-ticks').textContent=String(ticks);get('stat-steer').textContent=(state.steering*180/Math.PI).toFixed(1)+'°';get('stat-shift').textContent=state.shiftRemaining.toFixed(2)+' s';get('stat-position').textContent=state.position.map(x=>x.toFixed(2)).join(', ');get('stat-collisions').textContent=String(barrierCount);get('stat-uploads').textContent=String(view?.snapshot().graphics?.uploads??'—');
  for(let i=0;i<4;i++){const w=state.wheels[i],cells=get('wheel-rows').children[i].children;cells[1].textContent=w.grounded?'GROUND':'AIR';cells[1].title=w.surfaceId??'No support surface';cells[2].textContent=w.compression.toFixed(3);cells[3].textContent=w.load.toFixed(0);cells[4].textContent=w.slip.toFixed(2);}
  const values=input.read();for(const button of document.querySelectorAll('[data-drive]')){const c=button.dataset.drive,active=c==='left'?values.steer<0:c==='right'?values.steer>0:values[c]>0;button.classList.toggle('is-held',active);button.setAttribute('aria-pressed',String(active));button.disabled=!running;}
  for(const button of document.querySelectorAll('[data-camera]'))button.setAttribute('aria-pressed',String(button.dataset.camera===(view?.mode??'chase')));
}
function clear(){input.cancel();pendingGear=null;for(const button of document.querySelectorAll('[data-drive]'))for(const id of activePointers.keys())if(button.hasPointerCapture(id))button.releasePointerCapture(id);activePointers.clear();}
function pause(message){running=false;cancelAnimationFrame(frame);clock.setPaused(true);last=null;clear();paint();if(message)status(message);}
function advance(dt){const controls=input.readVehicle(state);if(pendingGear!==null){controls.gear=pendingGear;pendingGear=null;}state=model.step(state,controls,world.physics,dt);ticks++;if(state.contacts.length)barrierCount++;if(state.needsRecovery){pause('The bounded simulation stopped. Return to start to recover.');}}
function animate(now){if(!running||disposed)return;const elapsed=last===null?0:Math.max(0,(now-last)/1000);last=now;try{clock.advance(elapsed,advance);}catch(error){pause('Simulation paused; accepted data retained: '+error.message);status('Simulation paused: '+error.message,true);}paint();if(running)frame=requestAnimationFrame(animate);}
function start(){if(running||lost||!view||state.needsRecovery)return;clear();running=true;clock.setPaused(false);last=null;canvas.scrollIntoView({block:'center',behavior:'instant'});canvas.focus({preventScroll:true});status('Driving. S/Down brakes then reverses at low speed; W/Up returns forward; Space brakes independently. Escape pauses.');hud();frame=requestAnimationFrame(animate);}
function refresh(){
  const r=project.vehicle;get('name').value=project.name;get('course').value=project.course;get('quality').value=project.scenery.profile;
  for(const [id,value] of Object.entries({mass:r.mass,grip:r.tyres.grip,'engine-brake':r.engine.engineBrake,'final-drive':r.gearbox.finalDrive,steering:r.steering.maxAngle,'speed-reduction':r.steering.speedReduction,spring:r.suspension.spring,damper:r.suspension.damper,...project.surfaces}))get(id).value=String(value);
  get('torque-scale').value='1';get('drive-wheels').value=r.drive;get('ratios').value=r.gearbox.ratios.join(', ');get('automatic').checked=r.gearbox.automatic;
  get('gear').replaceChildren(...[-1,0,...r.gearbox.ratios.map((_,i)=>i+1)].map(n=>{const option=document.createElement('option');option.value=String(n);option.textContent=n===-1?'Reverse':n===0?'Neutral':String(n);return option;}));get('gear').value=String(state.gear);
  get('recipe-json').value=serializeDriveProject(project);get('undo').disabled=cursor===0;get('redo').disabled=cursor===history.length-1;hud();
}
function accept(value,message,{remember=true}={}){
  const next=validateDriveProject(value),raw=serializeDriveProject(next),candidate=prepare(next);
  pause();if(view&&!lost)view.replace(next,candidate.world);
  generation++;project=next;world=candidate.world;model=candidate.model;state=candidate.state;ticks=0;barrierCount=0;clock.reset();
  if(remember&&raw!==history[cursor]){history=history.slice(0,cursor+1);history.push(raw);if(history.length>24)history.shift();cursor=history.length-1;}
  if(!view&&!lost)createView();refresh();paint();status(message);
}
function reject(error){status('Not applied; accepted study preserved: '+error.message,true);}
function fromFields(){
  const next=copy(project),r=next.vehicle;next.name=get('name').value;const course=get('course').value;if(course!==next.course){next.course=course;next.scenery=createCourseScenery(course,next.scenery.profile);}
  r.mass=Number(get('mass').value);r.tyres.grip=Number(get('grip').value);r.engine.engineBrake=Number(get('engine-brake').value);r.gearbox.finalDrive=Number(get('final-drive').value);r.steering.maxAngle=Number(get('steering').value);r.steering.speedReduction=Number(get('speed-reduction').value);r.suspension.spring=Number(get('spring').value);r.suspension.damper=Number(get('damper').value);r.drive=get('drive-wheels').value;r.gearbox.automatic=get('automatic').checked;
  const torqueScale=Number(get('torque-scale').value);if(!Number.isFinite(torqueScale)||torqueScale<.2||torqueScale>3)throw RangeError('Torque scale must be 0.2..3');r.engine.torqueCurve=r.engine.torqueCurve.map(([rpm,nm])=>[rpm,nm*torqueScale]);
  const ratios=get('ratios').value.split(',');if(ratios.some(value=>value.trim()===''))throw TypeError('Enter comma-separated gear ratios');r.gearbox.ratios=ratios.map(Number);
  for(const id of ['asphalt','gravel','terrain'])next.surfaces[id]=Number(get(id).value);return next;
}
get('tuning').onsubmit=event=>{event.preventDefault();try{accept(fromFields(),'Tuning accepted. The car has returned to the start; drive to compare the result.');}catch(error){reject(error);}};
get('load-preset').onclick=()=>{try{const next=copy(project);next.vehicle=vehiclePreset(get('preset').value);accept(next,'Handling profile loaded. Inspect its parameters and drive to compare.');}catch(error){reject(error);}};
get('quality').onchange=()=>{try{const next=copy(project);next.scenery.profile=get('quality').value;accept(next,'Detail changed. Physics parameters are preserved; the trial has reset.');}catch(error){get('quality').value=project.scenery.profile;reject(error);}};
get('drive').onclick=start;get('pause').onclick=()=>pause('Driving paused.');
get('restart').onclick=()=>{generation++;pause();state=initialState(model,world,project.vehicle);ticks=0;barrierCount=0;clock.reset();refresh();paint();status('Trial restarted. Start driving when ready.');};
get('recover').onclick=()=>{generation++;pause();state=model.recover(state,spawnPose(world,project.vehicle));for(let i=0;i<120;i++)state=model.step(state,{brake:1},world.physics);paint();status('Vehicle recovered at the course start. Start driving when ready.');};
get('gear').onchange=()=>{if(!running){status('Start driving before requesting a gear.');get('gear').value=String(state.gear);return;}pendingGear=Number(get('gear').value);status('Gear requested. Direction changes require low speed; shift cooldown still applies.');};
for(const button of document.querySelectorAll('[data-camera]'))button.onclick=()=>{if(view){view.mode=button.dataset.camera;paint();}};
get('defaults').onclick=()=>{try{accept(starterDriveProject(),'Original handling study restored.');}catch(error){reject(error);}};
get('undo').onclick=()=>{if(cursor===0)return;try{const next=cursor-1;accept(parseDriveProject(history[next]),'Previous accepted study restored.',{remember:false});cursor=next;refresh();}catch(error){reject(error);}};
get('redo').onclick=()=>{if(cursor>=history.length-1)return;try{const next=cursor+1;accept(parseDriveProject(history[next]),'Next accepted study restored.',{remember:false});cursor=next;refresh();}catch(error){reject(error);}};
get('apply-json').onclick=()=>{try{accept(parseDriveProject(get('recipe-json').value),'Validated driving study accepted.');}catch(error){reject(error);}};
get('import').onchange=async()=>{const field=get('import'),file=field.files?.[0];field.value='';if(!file)return;const ticket=++generation;pause();try{if(file.size>DRIVE_PROJECT_BYTES)throw RangeError('Study exceeds 48 KiB');const text=await file.text();if(ticket!==generation)return;accept(parseDriveProject(text),'Validated driving study imported.');}catch(error){if(ticket===generation)reject(error);}};
function download(text,name){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
get('export').onclick=()=>{download(serializeDriveProject(project),'horizon-driving-study.json');status('Accepted driving study exported as inert data.');};
get('export-vehicle').onclick=()=>{download(serializeVehicle(project.vehicle),'horizon-vehicle.json');status('Vehicle recipe exported. Your game supplies its own world, controls and rendering.');};
for(const field of document.querySelectorAll('#tuning input,#tuning select,#recipe-json'))field.addEventListener('input',()=>{generation++;});
document.addEventListener('focusin',event=>{if(running&&event.target.matches('#tuning input,#tuning select,#recipe-json,#import'))pause('Driving paused for editing.');});
window.addEventListener('keydown',event=>{
  if(event.code==='Escape'){event.preventDefault();pause('Driving paused.');return;}
  if(event.target!==canvas)return;if(input.keyDown(event.code,event.repeat,running)){event.preventDefault();hud();}
});
window.addEventListener('keyup',event=>{input.keyUp(event.code);hud();});
const activePointers=new Map();
for(const button of document.querySelectorAll('[data-drive]')){
  button.addEventListener('pointerdown',event=>{if(!running||event.button!==0)return;event.preventDefault();input.press(event.pointerId,button.dataset.drive,true);activePointers.set(event.pointerId,button);button.setPointerCapture(event.pointerId);hud();});
  const release=event=>{input.release(event.pointerId);activePointers.delete(event.pointerId);if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);hud();};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
  button.addEventListener('keydown',event=>{if(!['Space','Enter'].includes(event.code)||event.repeat||!running)return;event.preventDefault();input.press('key:'+button.dataset.drive,button.dataset.drive,true);hud();});
  button.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();input.release('key:'+button.dataset.drive);hud();}});
  button.addEventListener('blur',()=>{input.release('key:'+button.dataset.drive);hud();});
}
window.addEventListener('blur',()=>pause('Driving paused after focus loss.'));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('resize',paint);
get('retry-graphics').onclick=()=>{pause();view?.dispose();view=null;createView();paint();if(view)status('Graphics rebuilt. The accepted trial remains paused.');};
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;pause();get('graphics-error').hidden=false;get('graphics-message').textContent='Graphics context lost. The accepted study and vehicle state are retained; waiting for restoration.';});
canvas.addEventListener('webglcontextrestored',()=>{view?.dispose();view=null;lost=false;createView();paint();status('Graphics restored. Driving remains paused.');});
window.addEventListener('pagehide',()=>{generation++;pause();view?.dispose();view=null;disposed=true;});
window.addEventListener('pageshow',event=>{if(event.persisted){disposed=false;createView();refresh();paint();status('Trial restored after navigation. Start driving to resume.');}});
createView();refresh();paint();status('Ready. Start driving on the flat handling ground, then change a parameter and compare.');document.documentElement.dataset.labReady='horizon-drive';
globalThis.__horizonDrive=Object.freeze({snapshot:()=>({project:serializeDriveProject(project),state:copy(state),running,lost,ticks,barrierCount,inputs:input.snapshot(),view:view?.snapshot()??null,history:{cursor,length:history.length}}),refresh});
