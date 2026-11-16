// SPDX-License-Identifier: Apache-2.0
import {Actions,attachKeyboard,attachMouseLook,fpsBindings} from '../../modules/input/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {validateWeaponFeel,exportWeaponFeel,WEAPON_FEEL_BYTES} from '../../modules/weapon-feel/index.js';
import {createSound2D} from '../../modules/audio2d/index.js';
import {createEffectPlayer} from '../../api/audio/effects.js';
import {starterFeel} from './profiles.js';
import {FeelRange} from './world.js';
import {FeelView} from './render.js';
const $=id=>document.getElementById(id),canvas=$('scene'),actions=new Actions(),touch=new Actions(),captures=new Map();
const clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6}),view=new FeelView(canvas);
let world=new FeelRange(starterFeel()),running=false,last=null,raf=0,mouseHeld=false,ads=false,importGeneration=0,context=null,player=null,sound=false,soundGeneration=0,unavailable=false;
const keyboard=attachKeyboard(window,actions,{bindings:{...fpsBindings,KeyQ:'ads',Digit1:'weapon0',Digit2:'weapon1',Digit3:'weapon2'},enabled:()=>running});
const mouse=attachMouseLook(canvas,{enabled:()=>running,onLock:()=>{canvas.dataset.capture='active';$('notice').textContent='Mouse capture active. Escape pauses and releases the mouse.';},onUnlock:()=>pause('Mouse released. Press Start to resume.'),onError:()=>{$('notice').textContent='Mouse capture unavailable. Drag the range to aim; use F or FIRE to shoot.';}});
const consume=k=>{const keyboardEdge=actions.consume(k),touchEdge=touch.consume(k);return keyboardEdge||touchEdge;};
function readMouse(){if(!running)return;const m=mouse.consume();world.feel.addLook(m.yaw,m.pitch);mouseHeld=m.primary;if(m.pressed)world.feel.trigger();}
// The existing input adapter accumulates samples. Drain after each input event,
// before any simulation tick, so high render rates and zero-tick frames retain aim.
document.addEventListener('mousemove',readMouse);document.addEventListener('mousedown',readMouse);document.addEventListener('mouseup',readMouse);canvas.addEventListener('pointermove',readMouse);
function clear(){keyboard.clear();touch.clear();mouse.release();delete canvas.dataset.capture;mouseHeld=false;ads=false;world.cancel();const pending=[...captures];captures.clear();for(const [id,b]of pending)if(b.hasPointerCapture(id))b.releasePointerCapture(id);}
function stopAudio(){soundGeneration++;player?.stopAll();}
function pause(note){running=false;cancelAnimationFrame(raf);clock.setPaused(true);last=null;clear();stopAudio();draw();hud();if(typeof note==='string')$('notice').textContent=note;}
function run(){if(running||unavailable)return;if(world.combat.actor('player').health<=0)reset();clear();running=true;clock.reset();clock.setPaused(false);last=null;canvas.focus({preventScroll:true});hud();raf=requestAnimationFrame(frame);}
function reset(source=world.recipe){importGeneration++;pause();world=new FeelRange(source);world.targetsMoving=$('moving').checked;world.returnFire=$('counterfire').checked;clock.reset();fill();draw();hud();}
const fmt=v=>v?v.map(n=>n.toFixed(3)).join(', '):'—';
function hud(){
  const s=world.snapshot(),p=s.presentation,t=s.timer,alive=world.combat.actor('player').health>0;
  $('status').textContent=unavailable?'GRAPHICS LOST':running?'PLAYING':s.tick?'PAUSED':'READY';$('overlay').hidden=running;$('run').textContent=!alive?'RESET & START':s.tick?'RESUME RANGE':'START RANGE';$('pause').disabled=!running;
  $('overlay-title').textContent=!alive?'The range struck back.':s.tick?'Holding the signal.':'Find your rhythm.';
  $('active-profile').textContent=world.feel.profile().id.toUpperCase();$('weapon-phase').textContent=p.switchRemaining>0?'SWITCHING':t.phase.toUpperCase();$('hit-count').textContent=s.hits+' / '+s.shots;$('damage-total').textContent=s.damage.toFixed(0)+' damage confirmed';$('ammo').textContent=t.ammo+' / '+t.reserve;$('integrity').textContent=Math.ceil(world.combat.actor('player').health)+' integrity';
  $('ads').setAttribute('aria-pressed',String(ads));for(const b of document.querySelectorAll('[data-profile]'))b.setAttribute('aria-pressed',String(Number(b.dataset.profile)===p.selected));
  $('diag-origin').textContent=fmt(s.lastShot?.origin??world.origin());$('diag-aim').textContent=fmt(s.aim.direction);$('diag-shot').textContent=fmt(s.lastShot?.direction);$('diag-impact').textContent=fmt(s.lastImpact);$('diag-cooldown').textContent=t.cooldown.toFixed(3)+' s / '+p.switchRemaining.toFixed(3)+' s';$('diag-view').textContent=(p.fov*180/Math.PI).toFixed(1)+'° / '+(p.ads*100).toFixed(0)+'% / '+p.spread.toFixed(4)+' rad';$('diag-outcome').textContent=s.shots?s.hits+' hits · '+s.damage.toFixed(1)+' damage':'No shot yet';
  $('hit').style.opacity=p.hit>0?'1':'0';$('hurt').style.opacity=p.hurt>0?'.65':'0';$('reticle').style.setProperty('--spread',Math.max(8,2*Math.tan(Math.SQRT2*p.spread)*canvas.clientHeight/(2*Math.tan(p.fov/2)))+'px');
}
function draw(){if(!unavailable)view.draw(world);}
const sounds=new Map();
function playSound(name,index){if(!sound||!player)return;const key=name+index;if(!sounds.has(key)){const frequency=name==='hit'?850:[260,160,80][index];sounds.set(key,createSound2D({frames:6000,events:[{id:1,sample:0,duration:5000,channel:0,frequency,wave:name==='hit'?'triangle':'saw',gain:2800,seed:260001}]}));}try{player.play(sounds.get(key),{gain:.6});}catch{sound=false;player?.stopAll();$('sound').textContent='Sound unavailable';$('sound').setAttribute('aria-pressed','false');}}
function tick(){
  const held=k=>actions.value(k)||touch.value(k),edge=consume;
  const events=world.step({move:[actions.axis('left','right')+touch.axis('left','right'),actions.axis('forward','backward')+touch.axis('forward','backward')],jump:edge('jump'),sprint:!!held('sprint'),reload:edge('reload'),held:!!held('fire')||mouseHeld});
  for(const e of events)if(e.source==='player'&&(e.type==='shot'||e.type==='damage'))playSound(e.type==='shot'?'shot':'hit',world.feel.presentation().selected);
  if(world.combat.actor('player').health<=0)pause('Return fire depleted your integrity. Reset the range to try again.');
}
function frame(now){
  if(!running)return;const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
  try{readMouse();if(consume('fire'))world.feel.trigger();for(let i=0;i<world.recipe.profiles.length;i++)if(actions.consume('weapon'+i))select(i);if(actions.consume('ads'))toggleADS();
    world.feel.addLook(actions.axis('yawRight','yawLeft')*Math.min(dt,.1)*1.8,actions.axis('pitchDown','pitchUp')*Math.min(dt,.1)*1.8);
    clock.advance(dt,tick);draw();hud();
  }catch(error){pause('Range stopped: '+error.message);}
  if(running)raf=requestAnimationFrame(frame);
}
function select(index){if(world.feel.select(index))ads=false;if(running)canvas.focus({preventScroll:true});draw();hud();}
function toggleADS(){ads=!ads;world.feel.setADS(ads);if(running)canvas.focus({preventScroll:true});hud();}
const fields=[['recoil','Cosmetic recoil (rad)',0,.15,.005,'weapon'],['spread','Base spread (rad)',0,.2,.001,'weapon'],['adsSeconds','ADS time (s)',.03,1,.01,'view'],['recoilReturn','Recoil recovery (s)',.03,2,.01,'view'],['hipFov','Hip FOV (rad)',.4,2,.01,'view'],['adsFov','ADS FOV (rad)',.2,2,.01,'view'],['triggerBuffer','Trigger buffer (s)',0,.25,.01,'handling'],['switchSeconds','Switch lock (s)',.05,1,.01,'handling'],['spreadKick','Spread growth / shot',0,.1,.001,'handling'],['spreadRecovery','Spread recovery / s',.01,2,.01,'handling'],['sensitivity','Base sensitivity',.1,4,.1,'view'],['adsSensitivity','ADS multiplier',.25,2,.05,'view']];
function fill(){
  $('profiles').replaceChildren();for(const [index,p]of world.recipe.profiles.entries()){
    const article=document.createElement('article');article.className='profile';const type=document.createElement('p');type.className='type';type.textContent='0'+(index+1)+' / '+p.weapon.archetype.toUpperCase();const h=document.createElement('h3');h.textContent=p.label;const button=document.createElement('button');button.dataset.profile=index;button.textContent='Test '+p.id;button.addEventListener('click',()=>select(index));article.append(type,h,button);
    const grid=document.createElement('div');grid.className='fields';for(const [key,title,min,max,step,group]of fields){const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');Object.assign(input,{id:'profile-'+index+'-'+key,type:'number',min:String(min),max:String(max),step:String(step),value:String(p[group][key])});input.dataset.key=key;input.dataset.group=group;label.append(input);grid.append(label);}article.append(grid);
    const label=document.createElement('label'),effects=document.createElement('input');effects.type='checkbox';effects.id='effects-'+index;effects.checked=p.view.effects;label.append(effects,' Presentation effects');article.append(label);$('profiles').append(article);
  }
  $('seed').value=world.recipe.seed;$('recipe-json').value=exportWeaponFeel(world.recipe);
}
function accept(source){const recipe=validateWeaponFeel(source),candidate=new FeelRange(recipe);importGeneration++;pause();world=candidate;world.targetsMoving=$('moving').checked;world.returnFire=$('counterfire').checked;clock.reset();fill();draw();hud();$('recipe-status').textContent='Accepted recipe. Start the range to compare the new response.';}
function reject(error){$('recipe-status').textContent='Rejected; accepted recipe and range preserved: '+error.message;}
function download(){const blob=new Blob([exportWeaponFeel(world.recipe)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='signal-house.weapon-feel.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('run').addEventListener('click',run);$('pause').addEventListener('click',()=>pause());$('reset').addEventListener('click',()=>reset());$('ads').addEventListener('click',toggleADS);
$('moving').addEventListener('change',()=>{world.targetsMoving=$('moving').checked;});$('counterfire').addEventListener('change',()=>{world.returnFire=$('counterfire').checked;});
$('sound').addEventListener('click',async()=>{sound=!sound;const generation=++soundGeneration;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));try{if(sound){if(!context){context=new AudioContext();player=createEffectPlayer(context,{maxVoices:8,maxBuffers:8});}await context.resume();if(generation!==soundGeneration)return;}else player?.stopAll();$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));}catch{if(generation!==soundGeneration)return;sound=false;$('sound').textContent='Sound unavailable';$('sound').setAttribute('aria-pressed','false');$('notice').textContent='Audio unavailable. The range remains playable.';}});
$('apply').addEventListener('click',()=>{try{const draft=world.feel.recipe();draft.seed=Number($('seed').value);for(const [i,p]of draft.profiles.entries()){for(const [key,,,,,group]of fields)p[group][key]=Number($('profile-'+i+'-'+key).value);p.view.effects=$('effects-'+i).checked;}accept(draft);}catch(error){reject(error);}});
$('defaults').addEventListener('click',()=>accept(starterFeel()));$('apply-json').addEventListener('click',()=>{try{accept($('recipe-json').value);}catch(error){reject(error);}});$('export').addEventListener('click',download);
$('import').addEventListener('change',async event=>{const file=event.target.files[0],generation=++importGeneration;if(!file)return;try{if(file.size>WEAPON_FEEL_BYTES)throw Error('16 KiB recipe limit');const text=await file.text();if(generation===importGeneration)accept(text);}catch(error){reject(error);}finally{event.target.value='';}});
for(const b of document.querySelectorAll('[data-action]')){b.addEventListener('pointerdown',e=>{if(!running)return;e.preventDefault();captures.set(e.pointerId,b);touch.set(b.dataset.action,true);b.setPointerCapture(e.pointerId);});b.addEventListener('pointerup',e=>{captures.delete(e.pointerId);touch.set(b.dataset.action,[...captures.values()].includes(b));});b.addEventListener('pointercancel',()=>{clear();hud();});b.addEventListener('lostpointercapture',e=>{if(captures.has(e.pointerId)){clear();hud();}});b.addEventListener('click',e=>{if(running&&e.detail===0){touch.set(b.dataset.action,true);touch.set(b.dataset.action,false);}});}
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat&&running){e.preventDefault();pause();}});window.addEventListener('blur',()=>pause());window.addEventListener('pagehide',()=>{pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('focusin',e=>{if(running&&e.target.matches('input,textarea'))pause('Editing settings. Range paused.');});window.addEventListener('resize',()=>{draw();hud();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();unavailable=true;pause('Graphics context lost. Reload the lab to recover.');$('run').disabled=true;$('startup-reload').hidden=false;$('startup-reload').disabled=false;});$('startup-reload').addEventListener('click',()=>location.reload());
fill();draw();hud();document.documentElement.dataset.labReady='weapon-feel';
globalThis.weaponFeelLab=Object.freeze({snapshot:()=>world.snapshot(),recipe:()=>exportWeaponFeel(world.recipe),running:()=>running,stats:()=>({...view.stats})});
