// SPDX-License-Identifier: Apache-2.0
// Browser-owned Signal Garden adapter; reusable by the lab and portable export.
import {createGameMaker} from '../../api/game-maker/index.js';
import {Actions,attachKeyboard} from '../../modules/input/index.js';
import {Tilemap} from '../../modules/tilemap/index.js';
import {GameRuntime,validateProject,projectIssues} from './game.js';

const tones={jump:{frequency:360,duration:4800,wave:'triangle'},collect:{frequency:880,duration:9600,wave:'triangle'},won:{frequency:660,duration:24000,wave:'triangle'},lost:{frequency:95,duration:14400,wave:'saw'}};
export function mountGameMakerPlayer({canvas,project,onState=()=>{},onStatus=()=>{}}){
  let accepted=validateProject(project),maker=null,map=null,game=null,disposed=false,running=false,frame=0,previous=null,camera=null,draws=0,context=null,sound=false,audioGeneration=0,graphicsLost=false;
  const actions=new Actions(),pointers=new Map(),touchKeys=new Set(),pendingJumps=new Set(),bindings={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump'};
  const keyboard=attachKeyboard(canvas.ownerDocument.defaultView,actions,{bindings,enabled:()=>running});
  const controls=[];
  function state(){return game?.snapshot()??null;}
  function snapshot(){return {project:JSON.parse(JSON.stringify(accepted)),state:state(),running,sound,draws,graphicsLost,graphics:maker?.snapshot()??null};}
  function report(){onState({state:state(),running,sound,draws,graphicsLost,graphics:maker?.snapshot()??null});}
  function clearInput(){keyboard.clear();actions.clear();pointers.clear();touchKeys.clear();pendingJumps.clear();maker?.setInput({});}
  function pause(message='Paused. Press Play when you are ready.'){
    running=false;previous=null;audioGeneration++;cancelAnimationFrame(frame);frame=0;clearInput();maker?.pause(true);maker?.stopSounds();if(!disposed){draw();report();onStatus(message);}
  }
  function makeSurface(){
    const next=createGameMaker({canvas,width:640,height:360,pixelsPerUnit:48,audioContext:context});
    try{next.loadSprite('courier',accepted.playerSprite);next.loadTilemap('garden',accepted.map);for(const [id,t]of Object.entries(tones))next.loadSound(id,{frames:t.duration,events:[{id:1,channel:0,sample:0,duration:t.duration,frequency:t.frequency,wave:t.wave,gain:4000,seed:28}]});}
    catch(error){next.dispose();throw error;}
    return next;
  }
  function draw(){
    if(!maker||disposed||graphicsLost)return;const s=state(),bounds=map.bounds();
    const target=s?{x:s.body.x,y:s.body.y}:{x:bounds.maxX/2,y:bounds.maxY/2};
    camera=map.camera(target,{width:3413,height:1920},camera??target);maker.begin('#102430');maker.setCamera({x:camera.x/256,y:camera.y/256,zoom:1});
    // Original quiet sky, authored parallax tiles, then the game-owned markers.
    for(let i=0;i<18;i++)maker.circle((i*7%29)-camera.x/256*.08,3+(i*11%9),.025,i%3?'#426970':'#8fd3ae');
    maker.tilemap('garden');
    for(const t of accepted.map.triggers){
      const p=map.tileToWorld(t.column,t.row),x=p.x/256,y=p.y/256;
      if(t.tag==='collect'&&!s?.collected.includes(t.id)){
        maker.circle(x,y,.22,'#f5be50');maker.rect(x-.05,y-.31,.1,.62,'#f0eed3');maker.rect(x-.31,y-.05,.62,.1,'#f0eed3');
      }else if(t.tag==='hazard'){
        maker.line(x-.43,y-.43,x,y+.3,'#ef806e',.14);maker.line(x,y+.3,x+.43,y-.43,'#ef806e',.14);maker.line(x+.43,y-.43,x-.43,y-.43,'#ef806e',.14);
      }else if(t.tag==='exit'){
        maker.rect(x-.36,y-.46,.72,.94,'#234a51');maker.line(x-.37,y-.46,x-.37,y+.5,'#8fd3ae',.09);maker.line(x+.37,y-.46,x+.37,y+.5,'#8fd3ae',.09);maker.line(x-.37,y+.5,x+.37,y+.5,'#8fd3ae',.09);
        if(s?.collected.length===accepted.map.triggers.filter(q=>q.tag==='collect').length)maker.circle(x,y,.18,'#8fd3ae');
      }
    }
    if(s){const b=s.body,index=b.vx?Math.floor(s.tick/9)%accepted.playerSprite.frames.length:0;maker.sprite('courier',index,b.x/256-.4,b.y/256-.44,{width:.8,height:1.05,flipX:b.vx<0});}
    maker.drawParticles();maker.text('SIGNAL GARDEN / '+(s?(running?'PLAYING':s.status==='playing'?'READY / PAUSED':s.status.toUpperCase()):'BUILD YOUR FIRST STAGE'),16,14,{screen:true,color:'#8fd3ae',size:12});draws++;
  }
  function sample(){
    const held=new Set([...pointers.values(),...touchKeys]),edge=actions.consume('jump')||pendingJumps.size>0;pendingJumps.clear();
    const input={left:!!actions.value('left')||held.has('left'),right:!!actions.value('right')||held.has('right'),jump:!!actions.value('jump')||held.has('jump')||edge};
    // Deliver every observed press even if down+up fitted between render frames.
    if(edge)maker.setInput({...input,jump:false});return input;
  }
  function animate(now){
    if(disposed||!running)return;const seconds=previous===null?0:(now-previous)/1000;previous=now;
    try{
      maker.setInput(sample());maker.advance(seconds,(_dt,input)=>{
        if(!running)return;
        const s=game.step({x:input.x,jump:input.pressed.jump});maker.tickParticles();
        for(const event of s.events){if(sound)try{maker.playSound(event);}catch{sound=false;maker.stopSounds();onStatus('Audio is unavailable; the game remains playable.');}if(event==='collect'||event==='won')maker.emit({x:s.body.x/256,y:s.body.y/256,seed:s.tick,count:12,color:'#f5be50'});}
        if(s.status!=='playing'){running=false;clearInput();onStatus(s.status==='won'?'Garden restored. You collected every signal.':'A thorn caught the courier. Restart and try a jump.');}
      });draw();report();if(running)frame=requestAnimationFrame(animate);
    }catch(error){pause('Play stopped: '+error.message);}
  }
  function play(){if(disposed)throw Error('Player disposed');const issues=projectIssues(accepted);if(issues.length)throw Error(issues.join(' '));if(!maker||graphicsLost)throw Error('Canvas is unavailable. Wait for restoration or reload the saved project.');if(!game||game.snapshot().status!=='playing'){game=new GameRuntime(accepted);maker.reset();camera=null;}clearInput();maker.pause(false);running=true;previous=null;canvas.focus({preventScroll:true});onStatus('Collect every signal, jump over thorns, then reach the portal.');report();cancelAnimationFrame(frame);frame=requestAnimationFrame(animate);}
  function restart(){if(disposed)return;pause('Restarted. Press Play for a fresh run.');game=projectIssues(accepted).length?null:new GameRuntime(accepted);maker?.reset();camera=null;draw();report();}
  function setProject(value){
    const next=validateProject(value),nextMap=new Tilemap(next.map),nextGame=projectIssues(next).length?null:new GameRuntime(next);
    pause('Project changed. Press Play to test this version.');const old=accepted;accepted=next;let nextMaker;
    try{nextMaker=makeSurface();}catch(error){accepted=old;draw();throw error;}
    maker?.dispose();maker=nextMaker;map=nextMap;game=nextGame;camera=null;draw();report();
  }
  async function enableSound(){
    if(disposed)return false;if(sound){sound=false;audioGeneration++;maker?.stopSounds();report();return false;}
    const generation=++audioGeneration;
    try{if(!context){const Audio=canvas.ownerDocument.defaultView.AudioContext??canvas.ownerDocument.defaultView.webkitAudioContext;if(!Audio)throw Error('No audio device');context=new Audio();maker?.setAudioContext(context);}await context.resume();if(disposed||generation!==audioGeneration)return false;sound=true;report();return true;}
    catch{if(disposed||generation!==audioGeneration)return false;sound=false;maker?.stopSounds();onStatus('Audio is unavailable; the game remains playable.');report();return false;}
  }
  function bindTouch(root){
    for(const button of root.querySelectorAll('[data-game-action]')){
      const action=button.dataset.gameAction;if(!['left','right','jump'].includes(action))continue;
      const down=e=>{if(!running||e.button!==0)return;e.preventDefault();pointers.set(e.pointerId,action);if(action==='jump')pendingJumps.add('pointer-'+e.pointerId);try{button.setPointerCapture?.(e.pointerId);}catch{}};
      const up=e=>{pointers.delete(e.pointerId);};
      const cancel=e=>{pendingJumps.delete('pointer-'+e.pointerId);pointers.delete(e.pointerId);};
      const lost=e=>{if(pointers.has(e.pointerId))cancel(e);};
      const keydown=e=>{if(running&&!e.repeat&&['Space','Enter'].includes(e.code)){e.preventDefault();touchKeys.add(action);if(action==='jump')pendingJumps.add('key-'+action);}};
      const keyup=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();touchKeys.delete(action);}};
      for(const [type,fn]of [['pointerdown',down],['pointerup',up],['pointercancel',cancel],['lostpointercapture',lost],['keydown',keydown],['keyup',keyup],['blur',()=>{touchKeys.delete(action);pendingJumps.delete('key-'+action);}]]){button.addEventListener(type,fn);controls.push([button,type,fn]);}
    }
  }
  const win=canvas.ownerDocument.defaultView,doc=canvas.ownerDocument;
  const blur=()=>{if(running||maker?.snapshot().voices)pause('Paused after leaving the game. Press Play to resume.');};
  const hidden=()=>{if(doc.hidden)blur();};
  const escape=e=>{if(e.code==='Escape'&&running){e.preventDefault();pause();}};
  const contextLost=()=>{graphicsLost=true;pause('Canvas rendering was lost. Accepted game data is retained; wait for restoration or reload.');};
  const contextRestored=()=>{if(disposed)return;try{const next=makeSurface();maker?.dispose();maker=next;graphicsLost=false;draw();report();onStatus('Canvas restored. Press Play to continue the accepted game.');}catch{onStatus('Canvas could not recover. Download the project and reload.');}};
  canvas.addEventListener('contextlost',contextLost);canvas.addEventListener('contextrestored',contextRestored);
  win.addEventListener('blur',blur);win.addEventListener('pagehide',blur);doc.addEventListener('visibilitychange',hidden);win.addEventListener('keydown',escape);
  function dispose(){if(disposed)return;pause();disposed=true;keyboard.dispose();for(const [node,type,fn]of controls)node.removeEventListener(type,fn);canvas.removeEventListener('contextlost',contextLost);canvas.removeEventListener('contextrestored',contextRestored);win.removeEventListener('blur',blur);win.removeEventListener('pagehide',blur);doc.removeEventListener('visibilitychange',hidden);win.removeEventListener('keydown',escape);maker?.dispose();maker=null;context?.close().catch(()=>{});context=null;}
  try{map=new Tilemap(accepted.map);game=projectIssues(accepted).length?null:new GameRuntime(accepted);maker=makeSurface();draw();report();}catch(error){dispose();throw error;}
  return Object.freeze({play,pause,restart,setProject,enableSound,bindTouch,dispose,snapshot,draw});
}
