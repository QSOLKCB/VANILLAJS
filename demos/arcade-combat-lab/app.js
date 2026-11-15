// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {Actions,attachKeyboard,FlightGamepad} from '../../modules/input/index.js';
import {ARCADE_PACK_BYTES} from '../../modules/mod-arcade/index.js';
import {ArcadeSession,readArcadeReplay,readArcadeSnapshot,MAX_SNAPSHOT_BYTES,SNAPSHOT_KIND} from './replay.js';
import {arcadeSnapshot} from './world.js';
import {starterPack} from './packs.js';
import {FoundryView} from './render.js';
import {FoundryAudio} from './audio.js';
const $=id=>document.getElementById(id),canvas=$('scene');
const actions=new Actions(),pad=new FlightGamepad(),clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6}),audio=new FoundryAudio();
let session=new ArcadeSession(starterPack()),running=false,last=null,raf=0,hadPad=false,importGeneration=0,view;
const pointers=new Map();let pending=0;
const bindings={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',Space:'jump',KeyJ:'primary',KeyZ:'primary',KeyK:'secondary',KeyX:'secondary'};
const keyboard=attachKeyboard(window,actions,{bindings,enabled:()=>running});
const modes={run:{label:'01 / RUN & GUN',title:'Break the perimeter.',copy:'Fight through three sectors. Climb the gantries, collect repair cells and reach the extraction gate.',help:'A / D move · W / S aim · Space jump · J shoot · K melee'},
  arena:{label:'02 / ARENA BRAWLER',title:'Own the zero ring.',copy:'Three encounters. Read the red windup, step clear and counter. Light strikes are quick; heavy attacks commit to a longer recovery.',help:'WASD / arrows move · J light attack · K heavy attack'}};
function clearInput() {
  keyboard.clear();pending=0;
  const captures=[...pointers];pointers.clear();
  for(const [id,{button}] of captures)if(button.hasPointerCapture(id))button.releasePointerCapture(id);
  for(const button of document.querySelectorAll('[data-input]'))button.classList.remove('held');
  pad.reset();hadPad=false;
}
function draw(){view?.draw(session.state,!running);}
function status() {
  const s=session.state,p=s.combat.actors[0],mode=modes[s.mode];
  $('health-text').textContent=p.health+' / '+p.maxHealth;$('health-bar').style.width=(p.health/p.maxHealth*100)+'%';
  $('score').textContent=String(s.score).padStart(6,'0');$('encounter').textContent=String(s.cleared).padStart(2,'0')+' / '+String(s.pack[s.mode].encounters.length).padStart(2,'0');
  $('status').textContent=running?'PLAYING':s.status==='playing'?(s.tick?'PAUSED':'READY'):s.status.toUpperCase().replace('-',' ');
  $('combat-state').textContent=!p.health?'KNOCKOUT':p.stun?'HIT STUN':p.attack?(p.attack.age<p.attack.move.windup?'WINDUP':p.attack.age<p.attack.move.windup+p.attack.move.active?'STRIKE':'RECOVERY'):'READY';
  $('tick').textContent=s.tick;$('pack-name').textContent=s.pack.settings.title.toUpperCase();
  $('mission').textContent=s.status==='complete'?'ALL ENCOUNTERS CLEARED':s.status==='game-over'?'INTEGRITY LOST':s.wait?'ENCOUNTER CLEAR / REINFORCEMENTS INBOUND':
    s.cleared===s.pack[s.mode].encounters.length?'REACH THE EXTRACTION GATE':'ENCOUNTER '+(s.encounter+1)+' / '+(s.mode==='run'?'ADVANCE THROUGH THE SECTOR':'READ THE TELL. COUNTER.');
  $('overlay').hidden=running;$('pause').disabled=!running;
  $('overlay-label').textContent=mode.label;
  $('overlay-title').textContent=s.status==='complete'?'Sector secured.':s.status==='game-over'?'Back to the forge.':s.status==='limit'?'Run archived.':s.tick?'Holding position.':mode.title;
  $('overlay-copy').textContent=s.status==='complete'?'Every encounter cleared. Your run is ready to download.':s.status==='game-over'?'Read the windup, create space, and strike during recovery. Restart for another run.':s.status==='limit'?'The ten-minute recording limit is reached. Download your replay or start a fresh run.':s.tick?'Simulation paused. Release held controls, then resume when ready.':mode.copy;
  $('run').innerHTML=(s.status!=='playing'?'PLAY AGAIN':s.tick?'RESUME RUN':'ENTER THE FOUNDRY')+' <span>→</span>';
  $('overlay-help').textContent=mode.help;
  for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===s.mode));
  $('difficulty').value=s.difficulty;$('touch-jump').hidden=s.mode==='arena';$('touch-primary').textContent=s.mode==='run'?'SHOOT':'LIGHT';$('touch-secondary').textContent=s.mode==='run'?'MELEE':'HEAVY';
  $('guide-title').textContent=s.mode==='run'?'Keep moving. Keep the upper hand.':'Commit to the strike. Respect recovery.';
  $('guide-controls').textContent=s.mode==='run'?'A / D or ← / →':'WASD or arrow keys';
  $('guide-copy').textContent=s.mode==='run'?'Move through the sector. W / S aim vertically; combine with movement to shoot diagonally. Space jumps, J fires, K strikes.':'Move freely across the arena. J performs a quick light strike; K winds up a heavy blow. Face your opponent before committing.';
  $('guide-tactic-copy').textContent=s.mode==='run'?'Sentries commit to a direction before firing. Jump to reach elevated targets. Repair cells restore integrity; clear every encounter before extraction.':'Red rings signal an incoming attack. Move out of reach and punish the recovery. Heavy attacks resist interruption; they still take damage.';
}
function pause() {running=false;cancelAnimationFrame(raf);clock.setPaused(true);last=null;clearInput();audio.stop();status();draw();}
function run() {
  if(session.state.status!=='playing')reset();
  if(running)return;
  clearInput();clock.reset();clock.setPaused(false);running=true;last=null;
  audio.start(session.pack.settings.music,session.state.tick);status();canvas.focus({preventScroll:true});raf=requestAnimationFrame(frame);
}
function reset(mode=session.state.mode,difficulty=session.state.difficulty) {
  const next=new ArcadeSession(session.pack,mode,difficulty,session.state.seed);
  pause();session=next;view?.clear();clock.reset();status();draw();
}
function input() {
  const gamepad=pad.sample(navigator.getGamepads?.()??[]);
  if(hadPad&&!gamepad.connected||gamepad.pause){pause();return null;}hadPad=gamepad.connected;
  const flags={left:1,right:2,up:4,down:8,jump:16,primary:32,secondary:64};let word=pending;pending=0;
  for(const [key,bit] of Object.entries(flags)) {const edge=actions.consume(key);if(actions.value(key)||(edge&&bit>=16))word|=bit;}
  for(const {bit}of pointers.values())word|=bit;
  if(gamepad.thrust[0]<-.2)word|=1;if(gamepad.thrust[0]>.2)word|=2;
  if(gamepad.thrust[2]<-.2)word|=4;if(gamepad.thrust[2]>.2)word|=8;
  if(gamepad.brake)word|=16;if(gamepad.thrust[1]>.2)word|=32;if(gamepad.thrust[1]<-.2)word|=64;
  return word;
}
function advance() {
  const word=input();if(word===null||!running)return;
  try {
    const result=session.advance(word);view.feedback(result.events,session.state.tick);audio.events(result.events);
    if(session.state.status!=='playing')pause();else status();
  }catch(e){pause();$('pack-note').textContent='Tick rejected without committing state: '+e.message;}
}
function frame(now) {
  if(!running)return;
  const seconds=last===null?0:Math.max(0,(now-last)/1000);last=now;
  clock.advance(seconds,advance);draw();if(running)raf=requestAnimationFrame(frame);
}
function save(name,text) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fillDraft(source) {
  const m=typeof source==='string'?JSON.parse(source):source;$('pack-json').value=JSON.stringify(m,null,2);
  const c=m.entries.find(e=>e.id==='combat').data,p=c.actors.find(a=>a.id==='player');
  $('edit-health').value=p.health;$('edit-speed').value=p.speed;$('edit-damage').value=c.moves.find(m=>m.id===p.light).attack.damage;
}
function applyPack(text) {
  // Construct and validate before touching the active run, registry or replay.
  const next=new ArcadeSession(text,session.state.mode,session.state.difficulty,session.state.seed);
  pause();session=next;view.clear();fillDraft(next.pack.bytes);status();draw();$('pack-note').textContent='Accepted '+next.pack.manifest.id+' @ '+next.pack.manifest.version+'. Fresh run ready.';
}
$('run').addEventListener('click',run);$('pause').addEventListener('click',pause);$('restart').addEventListener('click',()=>reset());
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>reset(b.dataset.mode));
$('difficulty').addEventListener('change',e=>reset(session.state.mode,e.target.value));
$('sound').addEventListener('click',()=>{audio.enabled=!audio.enabled;$('sound').textContent=audio.enabled?'Sound on ♪':'Sound off ♪';$('sound').setAttribute('aria-pressed',String(audio.enabled));if(running&&audio.enabled)audio.start(session.pack.settings.music,session.state.tick);else audio.stop();});
for(const button of document.querySelectorAll('[data-input]')) {
  const bit=Number(button.dataset.input);
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(!running)return;pointers.set(e.pointerId,{bit,button});if(bit>=16)pending|=bit;button.classList.add('held');button.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
  button.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(![...pointers.values()].some(p=>p.button===button))button.classList.remove('held');});
  button.addEventListener('pointercancel',clearInput);
  button.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))clearInput();});
}
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat){e.preventDefault();if(running)pause();else run();}});
window.addEventListener('blur',pause);window.addEventListener('pagehide',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
$('load-starter').addEventListener('click',()=>{fillDraft(starterPack($('starter').value));$('pack-note').textContent='Starter draft loaded. Validate & apply to play it.';});
for(const [id,field]of [['edit-health','health'],['edit-speed','speed'],['edit-damage','damage']])$(id).addEventListener('change',()=>{
  try {const m=JSON.parse($('pack-json').value),c=m.entries.find(e=>e.id==='combat').data,p=c.actors.find(a=>a.id==='player');
    if(field==='damage')c.moves.find(m=>m.id===p.light).attack.damage=Number($(id).value);else p[field]=Number($(id).value);
    $('pack-json').value=JSON.stringify(m,null,2);$('pack-note').textContent='Draft changed. Validate & apply to start a new run.';
  }catch(e){$('pack-note').textContent='Draft edit rejected: '+e.message;}
});
$('apply-pack').addEventListener('click',()=>{try{applyPack($('pack-json').value);}catch(e){$('pack-note').textContent='Rejected: '+e.message;}});
$('export-pack').addEventListener('click',()=>save(session.pack.manifest.id+'.arcade.json',session.pack.bytes));
$('import-pack').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;const generation=++importGeneration;pause();$('pack-note').textContent='Validating import…';
  try {if(file.size>ARCADE_PACK_BYTES)throw new RangeError('pack exceeds 32 KiB');const text=await file.text();if(generation!==importGeneration)return;applyPack(text);}
  catch(error){$('pack-note').textContent='Rejected: '+error.message;}
});
$('export-replay').addEventListener('click',()=>save('foundry-replay.json',session.exportReplay()));
$('export-snapshot').addEventListener('click',()=>save('foundry-snapshot.json',session.exportSnapshot()));
$('import-replay').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;const generation=++importGeneration;pause();$('replay-message').textContent='Validating receipt…';
  try {if(file.size>MAX_SNAPSHOT_BYTES)throw new RangeError('receipt exceeds 512 KiB');const text=await file.text();if(generation!==importGeneration)return;
    const kind=JSON.parse(text).kind,candidate=kind===SNAPSHOT_KIND?readArcadeSnapshot(text):readArcadeReplay(text);
    session=candidate;view.clear();fillDraft(session.pack.bytes);status();draw();$('replay-message').textContent='Restored and verified '+session.state.tick+' ticks. Download a fresh receipt at any time.';
  }catch(error){$('replay-message').textContent='Rejected: '+error.message;}
});
try {
  view=new FoundryView(canvas,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  clock.setPaused(true);fillDraft(session.pack.bytes);status();draw();
  // Read-only inspection boundary for creators and browser checks; no state setter.
  window.arcadeFoundry=Object.freeze({snapshot:()=>arcadeSnapshot(session.state),pack:()=>session.pack.bytes,
    renderStats:()=>({builds:view.cache.builds,hits:view.cache.hits}),audioStats:()=>audio.player?.snapshot()??null});
  document.documentElement.dataset.labReady='arcade-combat';
}catch(e){$('overlay-title').textContent='Unable to start';$('overlay-copy').textContent=e.message;$('run').disabled=true;}
