// SPDX-License-Identifier: Apache-2.0
// Adapted from Spooky v0.1.0: fixed-step controller, independent pointers,
// explicit focus recovery, station upgrades and local preferences.
import {FixedClock} from '../../../modules/time/index.js';
import {createDisplayController} from '../../../api/display/index.js';
import {create,step,chooseUpgrade,stats,cancelInput} from './sim.js';
import {STATIONS,UPGRADES,DIFFICULTIES,stationForRound,upgradeInfo,WIDTH,HEIGHT} from './content.js';
import {createRenderer} from './render.js';
import {createAudio} from './audio.js';
const $=id=>document.getElementById(id),canvas=$('field'),renderer=createRenderer(canvas),clock=new FixedClock({step:1/60,maxFrame:.15,maxSteps:8});
const testing=new URLSearchParams(location.search).get('test')==='1',keys=new Set(),firePointers=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const prefs={fx:true,music:false,display:'fit'},best={};
try{const p=JSON.parse(localStorage.getItem('vanillajs-skyguard-v1')||'{}');for(const k of ['fx','music'])if(typeof p[k]==='boolean')prefs[k]=p[k];if(['fit','page'].includes(p.display))prefs.display=p.display;}catch{}
try{const b=JSON.parse(localStorage.getItem('vanillajs-skyguard-best')||'{}');for(const k of Object.keys(DIFFICULTIES))if(Number.isSafeInteger(b[k])&&b[k]>=0)best[k]=b[k];}catch{}
let state=create(),demo=create(),screen='menu',paused=false,aim={x:576,y:250},aimPointer=null,pendingReload=false,dirty=true,last=performance.now(),noticeUntil=0,padBlocked=true,padStart=false,padPresent=false;
for(let i=0;i<480;i++)step(demo);
const audio=createAudio(()=>notice('Audio unavailable this session. Your watch continues.'));
function save(){try{localStorage.setItem('vanillajs-skyguard-v1',JSON.stringify(prefs));}catch{}}
function notice(message){$('notice').textContent=message;noticeUntil=performance.now()+3500;dirty=true;}
function clearInput(){keys.clear();firePointers.clear();pendingReload=false;padBlocked=true;cancelInput(state);if(aimPointer!==null){const id=aimPointer;aimPointer=null;try{canvas.releasePointerCapture(id);}catch{}}}
function show(id){if(id){$('notice').textContent='';noticeUntil=0;}for(const p of ['briefing','upgrade-panel','pause-panel','result-panel'])$(p).hidden=p!==id;$('overlay').hidden=!id;dirty=true;}
function focus(){canvas.focus({preventScroll:true});}
function preferences(){for(const [id,k] of [['sound','fx'],['music','music']]){$(id).textContent=(k==='fx'?'FX':'MUSIC')+(prefs[k]?' ON':' OFF');$(id).setAttribute('aria-pressed',String(prefs[k]));}}
function hud(){
  const station=stationForRound(state.round),w=state.weapon,p=stats(state),active=screen==='game'&&!paused;
  $('round').textContent=String(state.round).padStart(2,'0');$('contacts').textContent=String(state.total-state.resolved).padStart(2,'0');$('integrity').textContent=Math.ceil(state.hp)+'%';
  $('wave-bar').style.width=100*(state.total-state.resolved)/state.total+'%';$('hull-bar').style.width=state.hp+'%';$('hull-bar').style.background=state.hp<30?'var(--amber)':'var(--accent)';
  $('role').textContent=station.role;$('station-number').textContent=station.tag;$('station-title').textContent=station.name.toUpperCase()+'.';$('station-description').textContent=station.description;$('weapon-name').textContent=station.weapon;$('tip').textContent=station.tip;
  document.querySelectorAll('[data-station]').forEach(el=>el.classList.toggle('current',el.dataset.station===state.station));
  $('ammo').textContent=String(w.ammo).padStart(2,'0');$('capacity').textContent=p.magazine;
  $('weapon-status').textContent=w.reload?'RELOADING '+(w.reload/60).toFixed(1)+'s':w.overheated?'COOLING':w.cooldown?'CYCLING':state.station==='rail'&&state.charge>=p.charge?'CHARGED / RELEASE':'WEAPON READY';
  $('system-status').textContent=state.station==='cannon'?Math.round(w.heat)+'% HEAT':state.station==='missile'?(state.lockTicks>=p.lock?'LOCKED':state.lockId?'ACQUIRING':'SEEK TARGET'):state.station==='rail'?Math.round(100*state.charge/p.charge)+'% CHARGE':'PROXIMITY FUSE';
  $('weapon-bar').style.width=(w.reload?100*(1-w.reload/p.reload):state.station==='rail'?100*state.charge/p.charge:state.station==='missile'?100*Math.min(1,state.lockTicks/p.lock):100-w.heat)+'%';
  $('weapon-bar').style.background=w.overheated?'var(--amber)':'var(--accent)';
  $('kills').textContent=state.kills;$('score').textContent=String(state.score).padStart(6,'0');$('combo').textContent=state.combo>=4?state.combo+' INTERCEPT CHAIN':'KEEP THE SKY CLEAR.';
  const installed=UPGRADES.filter(u=>u.id!=='repair'&&state.upgrades[state.station][u.id]);$('upgrades').textContent=installed.length?installed.map(u=>u.name+' '+state.upgrades[state.station][u.id]).join(' · '):'No refits installed. Clear this raid.';
  for(const id of ['reload','touch-reload','touch-fire'])$(id).disabled=!active;
  $('touch-fire').textContent=state.station==='rail'?(state.charge>=p.charge?'RELEASE TO FIRE':'HOLD TO CHARGE'):state.station==='missile'?'HOLD TO LAUNCH':'HOLD TO FIRE';
  $('pause').disabled=screen!=='game';$('pause').textContent=paused?'▶ RESUME':'Ⅱ PAUSE';
}
function launch(){
  const seed=Number($('seed').value);if($('seed').value===''||!Number.isInteger(seed)||seed<0||seed>4294967295){notice('Enter a whole-number seed from 0 to 4294967295.');$('seed').focus();return;}
  state=create({seed,difficulty:$('difficulty').value});aim={...state.aim};screen='game';paused=false;clearInput();clock.reset();clock.setPaused(false);show(null);$('channel').textContent='RESOLUTE / GENERAL QUARTERS';hud();focus();void audio.unlock();
}
function pause(value=true){
  if(screen!=='game'){audio.stop();return;}paused=value;clearInput();clock.setPaused(value);audio.stop();show(value?'pause-panel':null);hud();$('channel').textContent=value?'ALL STATIONS / WATCH PAUSED':'RESOLUTE / AIR DEFENCE';
  if(value)$('resume').focus({preventScroll:true});else{focus();void audio.unlock();}
}
function menu(){clearInput();audio.stop();clock.setPaused(true);screen='menu';paused=false;state=create();aim={...state.aim};show('briefing');hud();$('channel').textContent='RESOLUTE / AWAITING ORDERS';$('deploy').focus({preventScroll:true});}
function finish(){
  clearInput();clock.setPaused(true);audio.sync(state.tick,false,state.station);
  if(state.status==='upgrade'){
    screen='upgrade';show('upgrade-panel');$('upgrade-info').textContent='Raid '+state.round+' repelled · '+state.roundKills+' intercepts · +8 integrity. Refit '+stationForRound(state.round).short+'.';
    $('next-station').textContent='NEXT: '+stationForRound(state.round+1).short+' / REFITS STAY WITH THEIR BATTERY';
    $('upgrade-cards').replaceChildren(...state.offers.map((id,i)=>{const u=upgradeInfo(id,state.station),button=document.createElement('button');button.className='upgrade-card';button.dataset.upgrade=id;
      for(const [el,cls,text] of [[document.createElement('span'),'upgrade-icon',u.icon],[document.createElement('span'),'label','REFIT / 0'+(i+1)],[document.createElement('strong'),'',u.name],[document.createElement('p'),'',u.description],[document.createElement('span'),'rank',id==='repair'?'+25 INTEGRITY':'RANK '+(state.upgrades[state.station][id]+1)]]){el.className=cls;el.textContent=text;button.append(el);}
      button.addEventListener('click',()=>pick(id));return button;}));$('upgrade-cards').firstElementChild?.focus({preventScroll:true});
  }else{screen='lost';show('result-panel');$('result-summary').textContent='Raid '+state.round+' · '+state.kills+' intercepts · '+DIFFICULTIES[state.difficulty].name+' · seed '+state.seed;$('final-score').textContent=state.score.toLocaleString();best[state.difficulty]=Math.max(best[state.difficulty]||0,state.score);try{localStorage.setItem('vanillajs-skyguard-best',JSON.stringify(best));}catch{}$('best-score').textContent='Personal best: '+best[state.difficulty].toLocaleString();$('retry').focus({preventScroll:true});}
  hud();
}
function pick(id){if(screen!=='upgrade'||!chooseUpgrade(state,id))return;screen='game';paused=false;clearInput();clock.setPaused(false);show(null);hud();focus();void audio.unlock();}
const display=createDisplayController({root:$('app'),initial:prefs.display,save:value=>{prefs.display=value;save();},onTransition:()=>{clearInput();if(screen==='game')pause();else audio.stop();},onChange:d=>{$('app').dataset.display=d.mode;$('display').value=d.mode;$('display').disabled=d.pending;$('display-feedback').textContent=d.message;dirty=true;}});
$('display').addEventListener('change',()=>void display.setMode($('display').value));
function aimAt(event){const b=canvas.getBoundingClientRect(),scale=Math.min(b.width/WIDTH,b.height/HEIGHT);aim={x:Math.max(0,Math.min(WIDTH,(event.clientX-b.left-(b.width-WIDTH*scale)/2)/scale)),y:Math.max(0,Math.min(HEIGHT,(event.clientY-b.top-(b.height-HEIGHT*scale)/2)/scale))};dirty=true;}
canvas.addEventListener('pointerdown',e=>{if(screen!=='game'||paused||e.button!==0)return;e.preventDefault();focus();aimPointer=e.pointerId;canvas.setPointerCapture(e.pointerId);aimAt(e);if(e.pointerType==='mouse'||e.pointerType==='pen')firePointers.add(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(screen==='game'&&!paused&&(e.pointerType==='mouse'||aimPointer===e.pointerId))aimAt(e);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
$('touch-fire').addEventListener('pointerdown',e=>{if(screen!=='game'||paused||e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);firePointers.add(e.pointerId);void audio.unlock();});
function release(e,cancelled=false){const wasFire=firePointers.has(e.pointerId);firePointers.delete(e.pointerId);if(aimPointer===e.pointerId)aimPointer=null;if(cancelled&&wasFire)cancelInput(state);}
window.addEventListener('pointerup',e=>release(e));window.addEventListener('pointercancel',e=>release(e,true));
for(const element of [canvas,$('touch-fire')])element.addEventListener('lostpointercapture',e=>release(e,true));
for(const id of ['reload','touch-reload'])$(id).addEventListener('click',()=>{if(screen==='game'&&!paused){pendingReload=true;focus();}});
for(const id of ['deploy','retry'])$(id).addEventListener('click',launch);
for(const id of ['quit','result-menu'])$(id).addEventListener('click',menu);
$('pause').addEventListener('click',()=>pause(!paused));$('resume').addEventListener('click',()=>pause(false));
for(const [id,key] of [['sound','fx'],['music','music']])$(id).addEventListener('click',()=>{prefs[key]=!prefs[key];save();preferences();audio.stop();if(prefs[key])void audio.unlock();});
$('manual-open').addEventListener('click',()=>{if(screen==='game')pause();$('manual').showModal();});$('manual-close').addEventListener('click',()=>$('manual').close());
$('download-music').addEventListener('click',()=>{try{const station=$('soundtrack').value,bytes=audio.musicWav(station),url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'})),a=document.createElement('a');a.href=url;a.download='skyguard-bluewater-'+station+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{notice('Track export unavailable. Your saved music preference is unchanged.');}});
window.addEventListener('keydown',e=>{
  if($('manual').open||e.target.closest?.('input,select,textarea,a'))return;
  if(screen==='upgrade'&&/^Digit[123]$/.test(e.code)&&!e.repeat){e.preventDefault();pick(state.offers[Number(e.code.slice(-1))-1]);return;}
  if(screen!=='game')return;
  if(['Escape','KeyP'].includes(e.code)){e.preventDefault();if(!e.repeat)pause(!paused);return;}
  if(paused||e.repeat&&!keys.has(e.code))return;
  if(['Space','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyR'].includes(e.code)){e.preventDefault();if(e.code==='KeyR'){if(!e.repeat)pendingReload=true;}else keys.add(e.code);}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
const suspend=()=>{clearInput();audio.stop();if(screen==='game')pause(true);};window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',e=>{if(e.persisted)suspend();});window.addEventListener('gamepaddisconnected',suspend);window.addEventListener('resize',()=>dirty=true);reduced.addEventListener('change',()=>dirty=true);
function gamepad(){
  let pad;try{pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected&&p.mapping==='standard');}catch{}
  if(!pad){if(padPresent)suspend();padPresent=false;padStart=false;return {x:0,y:0,fire:false,reload:false};}padPresent=true;
  const axis=i=>Math.abs(pad.axes[i]||0)>.18?pad.axes[i]:0,button=i=>!!pad.buttons[i]?.pressed||(pad.buttons[i]?.value||0)>.5;
  const start=button(9),neutral=!axis(0)&&!axis(1)&&!pad.buttons.some(b=>b.pressed||b.value>.5);
  if(neutral)padBlocked=false;
  if(start&&!padStart&&!padBlocked&&screen==='game')pause(!paused);padStart=start;
  return padBlocked?{x:0,y:0,fire:false,reload:false}:{x:axis(0),y:axis(1),fire:button(0)||button(7),reload:button(2)};
}
function tick(pad=gamepad()){
  if(screen!=='game'||paused)return;
  const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+pad.x,dy=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+pad.y;
  aim={x:Math.max(0,Math.min(WIDTH,aim.x+dx*6)),y:Math.max(0,Math.min(HEIGHT,aim.y+dy*5))};
  step(state,{...aim,fire:firePointers.size>0||keys.has('Space')||pad.fire,reload:pendingReload||pad.reload});pendingReload=false;
  for(const event of state.events){audio.event(event,prefs.fx);if(event.type==='breach')notice('IMPACT / DAMAGE CONTROL TO THE FORWARD DECK');if(event.type==='hot')notice('BARRELS HOT / RELEASE FIRE TO COOL');if(event.type==='collateral')notice(event.count+' CONTACTS / ONE BEAM');}
  if(state.status!=='playing')finish();dirty=true;
}
function draw(){renderer.draw(screen==='menu'?demo:state,{reducedMotion:reduced.matches,aim:screen==='game'});hud();dirty=false;}
function frame(now){const delta=(now-last)/1000;last=now;const pad=gamepad();if(!testing&&screen==='game'&&!paused)clock.advance(delta,()=>tick(pad));audio.sync(state.tick,prefs.music&&screen==='game'&&!paused,state.station);if(noticeUntil&&now>noticeUntil){noticeUntil=0;$('notice').textContent='';dirty=true;}if(dirty)draw();requestAnimationFrame(frame);}
window.skyguard=Object.freeze({snapshot:()=>({state:structuredClone(state),screen,paused,aim:{...aim},audio:audio.snapshot(),display:display.snapshot()}),...(testing?{advance(count){if(!Number.isInteger(count)||count<0||count>10000)throw new RangeError('Invalid test tick count');for(let i=0;i<count;i++)tick();if(dirty)draw();}}:{})});
preferences();hud();clock.setPaused(true);draw();$('deploy').disabled=false;$('deploy').textContent='TAKE THE WATCH →';requestAnimationFrame(frame);
