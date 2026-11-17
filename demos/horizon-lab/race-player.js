// SPDX-License-Identifier: Apache-2.0
// Explicitly owned browser player. No authoring/export dependencies or hidden simulation setters.
import {FixedClock} from '../../modules/time/index.js';
import {VEHICLE_STEP} from '../../modules/vehicle3d/index.js';
import {serializeRaceProject} from './race-project.js';
import {createRaceSession,raceDriverInput,raceWorldSafety} from './race-model.js';
import {RaceView} from './race-view.js';
import {DriveInput} from './drive-input.js';
import {raceAssistInput} from './race-assist.js';
import {RaceAudio} from './race-audio.js';
const timeText=t=>{const hundredths=Math.floor(t*100);return String(Math.floor(hundredths/6000)).padStart(2,'0')+':'+String(Math.floor(hundredths/100)%60).padStart(2,'0')+'.'+String(hundredths%100).padStart(2,'0');};
export function mountRacePlayer(value,{root=document,onChange=()=>{}}={}){
  const get=id=>root.querySelector('#'+id),canvas=get('race-canvas'),clock=new FixedClock({step:VEHICLE_STEP,maxFrame:.1,maxSteps:12}),input=new DriveInput({directional:true}),audio=new RaceAudio(value.audio),listeners=[],pointers=new Map();
  if(!canvas)throw Error('Race player shell is missing');
  let session=createRaceSession(value),project=session.project,view=null,running=false,lost=false,disposed=false,frame=0,last=null,ticks=0,audioTicket=0,safetyRecovered=false,courseAssist=true,physicalInput={throttle:0,brake:0,steer:0};
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
  const status=(text,error=false)=>{get('race-status').textContent=text;get('race-status').classList.toggle('error',error);};
  function graphicsFailure(error){get('race-graphics-error').hidden=false;get('race-graphics-message').textContent='View unavailable: '+error.message+'. Your accepted data remains editable and exportable.';}
  function createView(){try{view=new RaceView(canvas,project,session.world,session.checkpoints);lost=false;get('race-graphics-error').hidden=true;}catch(error){view=null;graphicsFailure(error);}}
  function hud(){
    const p=session.progress,r=session.rivalProgress,s=session.player;
    get('race-player').dataset.motion=s.gear<0?'reverse':s.brake>.1?'braking':'forward';get('race-player').style.setProperty('--rpm-level',String(Math.min(1,s.rpm/project.vehicle.engine.redlineRPM)));
    get('race-player').dataset.camera=view?.mode??project.camera.mode;get('race-wheel').style.transform='rotate('+(-s.steering*400)+'deg)';get('race-title').textContent=project.name;get('race-speed').textContent=String(Math.round(Math.hypot(...s.velocity)*3.6));get('race-gear').textContent=(s.gear<0?'R':s.gear===0?'N':s.gear)+' · '+Math.round(s.rpm)+' RPM';get('race-time').textContent=timeText(p.finishTime??session.time+p.penaltySeconds);get('race-checkpoint').textContent=p.checkpointIndex+' / '+session.checkpoints.length;get('race-progress').value=p.fraction;
    get('race-place').textContent=(p.finished?session.result==='loss'?2:1:p.distance>=r.distance?1:2)+' / 2';
    get('race-banner').textContent=lost?'GRAPHICS PAUSED':session.phase==='finished'?(session.result==='win'?'THE COAST IS YOURS.':session.result==='draw'?'A PERFECT DEAD HEAT.':'A GOOD RUN. GO AGAIN.') :!running?(safetyRecovered?'CAR RECOVERED · +'+project.race.recoveryPenaltySeconds+'s':ticks?'YOUR LINE IS WAITING.':'THE COAST IS CALLING.') :session.phase==='countdown'?String(Math.max(1,Math.ceil(session.countdown))):s.needsRecovery?'RECOVER TO CONTINUE':p.offRoad?'OFF ROUTE · RECOVER IF STUCK':p.finished?'FINISH · WAITING FOR PENALTY TIME':'';
    get('race-start').textContent=safetyRecovered?'Resume after recovery ↗':ticks?'Resume race ↗':'Start race ↗';get('race-start').disabled=running||lost||!view||session.phase==='finished'||s.needsRecovery;get('race-pause').disabled=!running;get('race-recover').disabled=safetyRecovered||!['running','countdown'].includes(session.phase);get('race-recover').textContent='Recover +'+project.race.recoveryPenaltySeconds+'s';get('race-retry').disabled=lost;
    get('race-assist').textContent=courseAssist?'Course assist: ON':'Course assist: OFF';get('race-assist').setAttribute('aria-pressed',String(courseAssist));
    get('race-sound').textContent=audio.enabled?'Sound on':'Enable sound';get('race-sound').setAttribute('aria-pressed',String(audio.enabled));
    const controls=input.read();for(const b of root.querySelectorAll('[data-drive]')){const c=b.dataset.drive,active=c==='left'?controls.steer<0:c==='right'?controls.steer>0:controls[c]>0;b.disabled=!running;b.classList.toggle('is-held',active);b.setAttribute('aria-pressed',String(active));}
    for(const b of root.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',String(b.dataset.camera===(view?.mode??project.camera.mode)));
    onChange({ticks,phase:session.phase,progress:p,player:s,graphics:view?.snapshot().graphics??null,audio:audio.snapshot(),rivalProgress:r,running});
  }
  function clear(){input.cancel();physicalInput={throttle:0,brake:0,steer:0};for(const [id,button] of pointers)if(button.hasPointerCapture(id))button.releasePointerCapture(id);pointers.clear();}
  function paint(){if(view&&!lost)try{view.draw(session);}catch(error){running=false;clock.setPaused(true);clear();audio.stop();view?.dispose();view=null;graphicsFailure(error);}hud();}
  function pause(message){running=false;audioTicket++;cancelAnimationFrame(frame);clock.setPaused(true);last=null;clear();audio.stop();paint();if(message)status(message);}
  function advance(dt){physicalInput=session.phase==='countdown'?{throttle:0,brake:1,steer:0}:input.readVehicle(session.player);if(courseAssist&&session.phase==='running')physicalInput=raceAssistInput(session.road,session.player,project.vehicle,physicalInput,session.rows);session.step(physicalInput,dt);ticks++;const safety=session.phase==='running'&&session.progress.offRoad?raceWorldSafety(session):null;
    if(session.player.needsRecovery||safety){
      // Fail closed and reset to the accepted checkpoint once, before rendering
      // an overturned vehicle. Pause cancels held inputs; a fresh press resumes.
      if(session.recover()){safetyRecovered=true;pause('Unsafe driving state ('+(safety??'rollover')+'). Recovered at the last checkpoint (+'+project.race.recoveryPenaltySeconds+'s). Release controls and resume.');}
      else pause('Vehicle requires recovery. Restart to continue.');
      return;
    }if(session.phase==='finished')pause((session.result==='win'?'You reached the finish ahead of the rival.':'Race complete.')+' Time '+timeText(session.progress.finishTime)+'. Restart to try a different line.');}
  function animate(now){if(!running||disposed)return;const elapsed=last===null?0:Math.max(0,(now-last)/1000);last=now;try{clock.advance(elapsed,advance);if(running)audio.update(session.player,physicalInput,project.vehicle.mass);}catch(error){pause('Race paused: '+error.message);status('Race paused: '+error.message,true);}paint();if(running)frame=requestAnimationFrame(animate);}
  async function resumeAudio(){if(!audio.enabled)return;const ticket=audioTicket;await audio.start();if(ticket!==audioTicket)return;if(!running)audio.stop();hud();}
  function start(){if(running||lost||!view||session.phase==='finished'||session.player.needsRecovery)return;clear();safetyRecovered=false;running=true;session.start();clock.setPaused(false);last=null;canvas.focus({preventScroll:true});status('Race running. Pass the amber gates in order. Brake before bends; Escape pauses.');resumeAudio();hud();frame=requestAnimationFrame(animate);}
  function restart(){pause();safetyRecovered=false;session.reset();ticks=0;clock.reset();paint();status('Race restarted. Your accepted course and tuning are preserved. Start when ready.');}
  function replace(value){const candidate=createRaceSession(value);pause();if(view&&!lost)view.replace(candidate.project,candidate.world,candidate.checkpoints);audio.setProfile(candidate.project.audio);session=candidate;project=candidate.project;safetyRecovered=false;ticks=0;clock.reset();if(!view&&!lost)createView();paint();status('Accepted race updated. Start to test the new course and tuning.');}
  listen(get('race-start'),'click',start);listen(get('race-pause'),'click',()=>pause('Race paused. Start again when ready.'));listen(get('race-restart'),'click',restart);listen(get('race-recover'),'click',()=>{if(safetyRecovered)return;pause();if(session.recover())status('Returned to the last completed gate. Recovery penalty added; resume when ready.');paint();});
  listen(get('race-assist'),'click',()=>{courseAssist=!courseAssist;hud();status(courseAssist?'Course assist ON: bounded route guidance and corner braking.':'Course assist OFF: direct vehicle controls; steer and brake before bends.');});
  listen(get('race-sound'),'click',async()=>{if(audio.enabled){audioTicket++;audio.disable();status('Sound disabled.');}else{const ticket=++audioTicket;await audio.start();if(ticket!==audioTicket)return;if(!running)audio.stop();status(audio.enabled?'Original engine, exhaust and tyre synthesis enabled. Start or resume the race to hear it.':'Audio unavailable. Racing still works; try enabling sound again.',!audio.enabled);}hud();});
  for(const b of root.querySelectorAll('[data-camera]'))listen(b,'click',()=>{if(view){view.mode=b.dataset.camera;paint();}});
  for(const button of root.querySelectorAll('[data-drive]')){
    listen(button,'pointerdown',event=>{if(!running||event.button!==0)return;event.preventDefault();input.press(event.pointerId,button.dataset.drive,true);pointers.set(event.pointerId,button);button.setPointerCapture(event.pointerId);hud();});
    const release=event=>{input.release(event.pointerId);pointers.delete(event.pointerId);if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);hud();};for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,release);
    listen(button,'keydown',event=>{if(!['Space','Enter'].includes(event.code)||event.repeat||!running)return;event.preventDefault();input.press('key:'+button.dataset.drive,button.dataset.drive,true);hud();});listen(button,'keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();input.release('key:'+button.dataset.drive);hud();}});listen(button,'blur',()=>{input.release('key:'+button.dataset.drive);hud();});
  }
  listen(window,'keydown',event=>{if(event.code==='Escape'){event.preventDefault();pause('Race paused.');return;}if(event.target!==canvas)return;if(input.keyDown(event.code,event.repeat,running)){event.preventDefault();hud();}});listen(window,'keyup',event=>{input.keyUp(event.code);hud();});
  listen(canvas,'blur',event=>{clear();if(running&&!event.relatedTarget?.closest('#race-player'))pause('Race paused after driving focus loss. Release held controls, then resume.');else hud();});
  listen(window,'blur',()=>pause('Race paused after focus loss. Release held controls, then resume.'));listen(document,'visibilitychange',()=>{if(document.hidden)pause();});listen(window,'resize',paint);
  listen(get('race-retry'),'click',()=>{pause();view?.dispose();view=null;createView();paint();if(view)status('Graphics rebuilt. Resume when ready.');});
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();lost=true;pause();get('race-graphics-error').hidden=false;get('race-graphics-message').textContent='Graphics context lost. Accepted course and race state are retained; waiting for restoration.';});listen(canvas,'webglcontextrestored',()=>{view?.dispose();view=null;lost=false;createView();paint();status('Graphics restored. Race remains paused.');});
  listen(window,'pagehide',()=>{pause();view?.dispose();view=null;disposed=true;});listen(window,'pageshow',event=>{if(event.persisted){disposed=false;createView();paint();status('Race restored after navigation. Resume when ready.');}});
  createView();paint();status('Ready. Choose your camera and start the original Sunward Run.');
  return Object.freeze({replace,pause,restart,refresh:hud,snapshot:()=>({project:serializeRaceProject(project),...session.snapshot(),drivingAdvice:raceDriverInput(session.road,session.player,project.vehicle,{speed:13,lateral:-2,rows:session.rows}),running,lost,ticks,inputs:input.snapshot(),physicalInput:{...physicalInput},courseAssist,view:view?.snapshot()??null,audio:audio.snapshot()}),dispose(){pause();disposed=true;for(const remove of listeners)remove();view?.dispose();audio.dispose();}});
}
