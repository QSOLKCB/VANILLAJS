// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../../modules/time/index.js';
import {createDisplayController} from '../../../api/display/index.js';
import {createGame,step,nextCase,snapshot,runRecord} from './sim.js';
import {CASES} from './cases.js';
import {Renderer} from './render.js';
import {Controls} from './input.js';
import {Audio} from './audio.js';
import '../../../offline/register.js';
const $=id=>document.getElementById(id),root=$('app'),renderer=new Renderer($('game')),audio=new Audio(),clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6});
const preference='vanillajs-pursuit-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(preference)||'{}')??{};}catch{}
let sound=saved.sound===true,windowed=saved.display==='page'?'page':'fit',s=createGame(),previous=null,screen='menu',paused=false,last=0,reportedFailure=false;
const playing=()=>screen==='playing'&&!paused&&['catch','contact'].includes(s.mode);
function save(){try{localStorage.setItem(preference,JSON.stringify({sound,display:windowed}));}catch{}}
const controls=new Controls(root,{active:playing,pause:toggle=>{if(toggle&&paused)resume();else pause();}});
function pause(){if(!playing())return;paused=true;controls.clear();clock.setPaused(true);audio.stop();menu();}
function resume(){if(screen!=='playing'||!paused)return;paused=false;controls.clear();clock.setPaused(false);last=performance.now();void audio.enable(sound);menu();}
function launch(){s=createGame();previous=null;screen='playing';paused=false;controls.clear();clock.reset();clock.setPaused(false);last=performance.now();void audio.enable(sound);menu();}
function menu(){
  const initial=screen==='menu',terminal=['cleared','won','lost'].includes(s.mode),visible=initial||paused||terminal;
  $('overlay').hidden=!visible;$('launch').hidden=!initial;$('resume').hidden=!paused;$('next').hidden=s.mode!=='cleared';$('restart').hidden=initial||(!paused&&!terminal);$('brief').hidden=!initial;
  $('menu-eyebrow').textContent=initial?'VANILLAJS / PURSUIT LAB':paused?'UNIT 07 / RADIO HOLD':`CASE ${String(s.caseIndex+1).padStart(2,'0')} / ${CASES[s.caseIndex].name}`;
  $('menu-title').innerHTML=initial?'END OF<br>THE ROAD.':paused?'ON STANDBY.':s.mode==='cleared'?'CASE CLOSED.':s.mode==='won'?'SHIFT COMPLETE.':'TARGET LOST.';
  $('menu-copy').textContent=initial?'Five targets. Three turbos. One highway patrol unit. Catch the runner, line up your bumper, and make the stop.':paused?'Take a breather. Resume when you are ready. Release held controls before driving again.':`${s.reason} Score ${s.score.toLocaleString()}. ${s.mode==='cleared'?'Your unit gets 30 armour and three fresh turbo charges for the next case.':''}`;
  $('pause').disabled=screen!=='playing'||terminal;$('pause').textContent=paused?'RESUME':'PAUSE';
}
function hud(){const c=CASES[s.caseIndex];$('case').textContent=`0${s.caseIndex+1} / 05`;$('phase').textContent=screen==='menu'?'STANDBY':s.mode==='catch'?'CLOSE GAP':s.mode==='contact'?`CONTACT ${s.target.hits}/${c.hits}`:s.mode.toUpperCase();$('time').textContent=String(Math.max(0,Math.ceil(s.time/60))).padStart(2,'0');$('armour').textContent=s.armour+'%';$('score').textContent=String(s.score).padStart(6,'0');}
function fit(){const box=$('stage').getBoundingClientRect(),w=Math.max(0,Math.min(box.width-2,(box.height-2)*16/9));$('frame').style.width=w+'px';$('frame').style.height=w*9/16+'px';}
new ResizeObserver(fit).observe($('stage'));
const display=createDisplayController({root,initial:windowed,onTransition:()=>{controls.clear();pause();},save:mode=>{windowed=mode;save();},onChange:view=>{root.dataset.display=view.mode;$('display').value=view.mode;$('display').disabled=view.pending;if(view.message)$('status').textContent=view.message;fit();}});
$('display').addEventListener('change',()=>{void display.setMode($('display').value);});
$('launch').onclick=launch;$('restart').onclick=launch;$('resume').onclick=resume;$('pause').onclick=()=>paused?resume():pause();
$('next').onclick=()=>{if(nextCase(s)){previous=null;controls.clear();clock.reset();clock.setPaused(false);last=performance.now();void audio.enable(sound);menu();}};
function soundLabel(){$('sound').textContent=sound?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(sound));}
$('sound').onclick=()=>{sound=!sound;save();soundLabel();reportedFailure=false;void audio.enable(sound);};
window.addEventListener('keydown',e=>{
  if(e.target.closest?.('input,select,textarea')||e.repeat)return;
  if(e.code==='KeyP'||e.code==='Escape'){if(screen==='playing'){e.preventDefault();if(paused&&e.code==='KeyP')resume();else pause();}}
  if(e.code==='KeyF'){e.preventDefault();void display.setMode(display.snapshot().fullscreen?windowed:'fullscreen');}
});
window.addEventListener('blur',()=>{controls.clear();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){controls.clear();pause();}});
window.addEventListener('pagehide',()=>{controls.clear();pause();audio.stop();});
function download(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('replay-export').onclick=()=>download(JSON.stringify(runRecord(s),null,2),'application/json','pursuit-replay.json');
$('track-export').onclick=()=>{try{download(audio.track.wav(),'audio/wav','pursuit-night-shift.wav');$('status').textContent='Night Shift · complete 32-second PCM soundtrack exported';}catch{$('status').textContent='Track export unavailable. Your game and sound preference are preserved.';}};
function update(mask){previous={caseIndex:s.caseIndex,mode:s.mode,distance:s.distance,car:{...s.car}};step(s,mask);audio.tick(s);if(!['catch','contact'].includes(s.mode)){controls.clear();clock.setPaused(true);audio.stop();menu();}}
function frame(now){const elapsed=last?Math.max(0,(now-last)/1000):0;last=now;const pad=controls.poll();let alpha=1;
  if(playing())alpha=clock.advance(elapsed,()=>update(controls.consume(pad))).alpha;
  audio.frame(s,playing());renderer.draw(s,alpha,previous);hud();
  if(audio.failed&&!reportedFailure){reportedFailure=true;$('status').textContent='Audio unavailable this session. Toggle SOUND to retry; driving is unaffected.';}
  requestAnimationFrame(frame);
}
window.pursuit=Object.freeze({snapshot:()=>({state:snapshot(s),paused,screen,display:display.snapshot(),audio:audio.snapshot(),mask:controls.mask()}),record:()=>runRecord(s),
  ...(new URLSearchParams(location.search).has('test')?{advance(masks){if(!Array.isArray(masks)||masks.length>54000)throw new RangeError('Bounded inputs required');for(const mask of masks){if(!playing())break;update(mask);}hud();}}:{})});
soundLabel();menu();hud();fit();requestAnimationFrame(frame);
