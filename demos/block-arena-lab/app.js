// SPDX-License-Identifier: Apache-2.0
import {Actions,attachKeyboard,attachMouseLook,FlightGamepad,fpsBindings} from '../../modules/input/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {FPS_PACK_BYTES,canonicalFPS} from '../../modules/mod-fps/index.js';
import {FPSSession,verifyFPSReplay,FPS_REPLAY_BYTES} from './replay.js';
import {starterFPSPack} from './packs.js';
import {ArenaView} from './render.js';
import {ArenaAudio} from './audio.js';
const $=id=>document.getElementById(id),canvas=$('scene'),actions=new Actions(),touch=new Actions(),pad=new FlightGamepad(),audio=new ArenaAudio();
const clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6}),view=new ArenaView(canvas),captures=new Map();
let session=new FPSSession(starterFPSPack()),running=false,raf=0,last=null,selected=0,scoped=false,pendingCancel=true,hadPad=false,previousButtons=[],generation=0,lastUnlock=-Infinity,lastHud=-1,hitUntil=0,hurtUntil=0;
const keyboard=attachKeyboard(window,actions,{bindings:{...fpsBindings,Digit1:'weapon0',Digit2:'weapon1',Digit3:'weapon2',KeyQ:'scope'},enabled:()=>running});
const mouse=attachMouseLook(canvas,{enabled:()=>running,onUnlock:e=>{lastUnlock=e.timeStamp;pause('Mouse released.');},onError:()=>{$('match-note').textContent='Mouse capture unavailable: drag the arena to aim, F to fire.';}});
function clearInput(){keyboard.clear();touch.clear();mouse.release();pad.reset();hadPad=false;previousButtons=[];pendingCancel=true;const held=[...captures];captures.clear();for(const [id,b]of held)if(b.hasPointerCapture(id))b.releasePointerCapture(id);}
function hud(force=false){
  const w=session.world;if(!force&&w.tick-lastHud<6)return;lastHud=w.tick;
  const s=w.combat.snapshot(),p=s.actors.find(a=>a.id==='player'),enemy=s.actors.filter(a=>a.id!=='player').reduce((n,a)=>n+a.kills,0),weapon=w.pack.arsenal.weapons[w.weapon],timer=s.weapons.find(a=>a.actor==='player').timers.find(t=>t.id===weapon.id);
  $('status').textContent=running?'PLAYING':w.status==='playing'?(w.tick?'PAUSED':'READY'):w.status.toUpperCase();$('pack-name').textContent=w.pack.settings.title.toUpperCase();
  $('health').replaceChildren(document.createTextNode(Math.ceil(p.health)+' '),Object.assign(document.createElement('span'),{textContent:'+ '+Math.ceil(p.armour)}));$('health-fill').style.width=p.health/p.maxHealth*100+'%';
  $('score').textContent=String(p.kills).padStart(2,'0')+' : '+String(enemy).padStart(2,'0');$('weapon-name').textContent=weapon.id.toUpperCase()+' / '+timer.phase.toUpperCase();
  $('ammo').replaceChildren(document.createTextNode(String(timer.ammo).padStart(2,'0')+' '),Object.assign(document.createElement('span'),{textContent:'/ '+timer.reserve}));
  $('objective').textContent=w.mode==='survival'?'WAVE '+w.wave+' / '+w.pack.waves.rosters.length:Math.ceil((w.pack.settings.rules.durationTicks-w.tick)/60)+'s / FIRST TO '+w.pack.settings.rules.scoreLimit;
  $('pause').disabled=!running;$('overlay').hidden=running;$('scope-ring').hidden=!w.scope;$('match-note').textContent=!p.health?'Eliminated. '+(w.mode==='skirmish'?'Respawn incoming.':'Restart to try again.'):w.wait?'Wave clear. Reinforcements incoming.':'Find cover. Watch your ammunition.';
  $('overlay-label').textContent=w.mode==='skirmish'?'01 / OFFLINE BOT MATCH':`02 / ${w.pack.waves.rosters.length} ESCALATING WAVES`;
  $('overlay-title').textContent=w.status==='victory'?'Arena secured.':w.status==='defeat'?'Back to the foundry.':w.status==='draw'?'A close match.':w.tick?'Holding position.':'Build your advantage.';
  $('overlay-copy').textContent=w.status!=='playing'?`${p.kills} eliminations · ${p.deaths} deaths · ${p.assists} assists. Your full replay is ready to export.`:w.tick?'Release held controls, then resume when ready.':w.mode==='skirmish'?'Outmanoeuvre the bots, control the cover, and race to the score limit. Every weapon is available from the first second.':'Clear the waves with the health and ammunition you can find. There are no respawns. Make each shot count.';
  $('run').textContent=w.status!=='playing'?'PLAY AGAIN':w.tick?'RESUME MATCH':'ENTER THE ARENA';
  for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===w.mode));
  for(const b of document.querySelectorAll('[data-weapon]')){const index=Number(b.dataset.weapon),definition=w.pack.arsenal.weapons[index];b.setAttribute('aria-pressed',String(index===selected));b.querySelector('span').textContent=`0${index+1} / ${definition.id.toUpperCase()}`;b.querySelector('b').textContent={precision:'One clean shot.',automatic:'Keep the pressure on.',projectile:'Make some space.'}[definition.archetype];b.querySelector('small').textContent=`${definition.archetype} · ${definition.damage} damage · ${definition.magazine}-round magazine`;}
  $('scoreboard').replaceChildren(...s.actors.map(a=>{const row=document.createElement('tr');for(const text of [a.id,a.kills,a.deaths,a.assists])row.append(Object.assign(document.createElement('td'),{textContent:String(text)}));return row;}));
  $('work-counts').textContent=`${view.stats.staticBoxes} retained static boxes · ${view.stats.staticUploads} static uploads · ${w.work.paths} path searches / ${w.work.expanded} cells expanded`;
}
function draw(){view.draw(session.world);$('hit').style.opacity=session.world.tick<hitUntil?'1':'0';$('hurt').style.opacity=session.world.tick<hurtUntil?'1':'0';}
function pause(note){running=false;cancelAnimationFrame(raf);last=null;clock.setPaused(true);clearInput();audio.stop();hud(true);draw();if(typeof note==='string')$('match-note').textContent=note;}
function reset(mode=session.world.mode,difficulty=session.world.difficulty){const next=new FPSSession(session.pack,mode,difficulty,session.world.seed);pause();generation++;session=next;selected=0;scoped=false;lastHud=-1;hitUntil=hurtUntil=0;$('difficulty').value=difficulty;clock.reset();hud(true);draw();}
function run(){if(session.world.status!=='playing')reset();if(running)return;clearInput();running=true;clock.reset();clock.setPaused(false);last=null;audio.start(session.world.tick);hud(true);canvas.focus({preventScroll:true});raf=requestAnimationFrame(frame);}
function input(){
  const pads=navigator.getGamepads?.()??[],g=pad.sample(pads);if(hadPad&&!g.connected||g.pause){pause('Controller paused or disconnected.');return null;}hadPad=g.connected;
  const raw=Array.from(pads).find(p=>p&&p.connected!==false&&p.mapping==='standard'),button=i=>pad.armed&&!!raw&&(raw.buttons[i]?.value??Number(raw.buttons[i]?.pressed))>.5;
  const edge=i=>{const down=button(i),result=down&&!previousButtons[i];previousButtons[i]=down;return result;};
  for(let i=0;i<3;i++)if(actions.consume('weapon'+i))selected=i;
  if(edge(5)||touch.consume('nextWeapon'))selected=(selected+1)%3;if(actions.consume('scope'))scoped=!scoped;
  const m=mouse.consume(),held=k=>actions.value(k)||touch.value(k),pressed=k=>{const a=actions.consume(k),b=touch.consume(k);return a||b;};
  const fireEdge=pressed('fire'),jump=pressed('jump')||edge(0),reload=pressed('reload')||edge(2),sensitivity=Number($('sensitivity').value)*((scoped||button(6))&&session.pack.arsenal.weapons[selected].archetype==='precision'?.4:1),invert=$('invert').checked?-1:1;
  let bits=(held('fire')||fireEdge||m.primary||m.pressed||button(7)?1:0)|(reload?2:0)|(jump?4:0)|(held('crouch')?8:0)|(held('sprint')?16:0)|((scoped||button(6))?32:0)|(pendingCancel?64:0);pendingCancel=false;
  const mx=actions.axis('left','right')+touch.axis('left','right')+g.thrust[0],mz=actions.axis('forward','backward')+touch.axis('forward','backward')+g.thrust[2];
  const yaw=(m.yaw+(actions.axis('yawRight','yawLeft')*1.8+g.turn[1]*2.4)/60)*sensitivity,pitch=(m.pitch+(actions.axis('pitchDown','pitchUp')*1.5+g.turn[0]*2.4)/60)*sensitivity*invert;
  return [Math.round(Math.max(-1,Math.min(1,mx))*1000),Math.round(Math.max(-1,Math.min(1,mz))*1000),Math.round(Math.max(-Math.PI,Math.min(Math.PI,yaw))*1e6),Math.round(Math.max(-Math.PI,Math.min(Math.PI,pitch))*1e6),bits,selected];
}
function tick(){const value=input();if(!value||!running)return;const r=session.advance(value);view.feedback(r.events,session.world.tick);audio.events(r.events);for(const e of r.events)if(e.type==='damage'){if(e.source==='player')hitUntil=session.world.tick+7;if(e.target==='player')hurtUntil=session.world.tick+12;}if(session.world.status!=='playing')pause();else hud();}
function frame(now){if(!running)return;const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;try{clock.advance(dt,tick);draw();}catch(e){pause('Simulation stopped: '+e.message);}if(running)raf=requestAnimationFrame(frame);}
function save(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const data=(manifest,key)=>manifest.entries.find(e=>e.id===key).data;
function draft(){if($('pack-json').value.length>FPS_PACK_BYTES)throw Error('Draft exceeds 32 KiB');return JSON.parse($('pack-json').value);}
function fillDraft(manifest){$('pack-json').value=JSON.stringify(manifest,null,2);for(const [i,w]of data(manifest,'arsenal').weapons.entries())$('edit-weapon').options[i].textContent=w.id+' / '+w.archetype;weaponFields();drawMap();}
function weaponFields(){try{const w=data(draft(),'arsenal').weapons[Number($('edit-weapon').value)];for(const k of ['damage','interval','magazine','spread','recoil','radius'])$('edit-'+k).value=w[k];}catch(e){$('pack-note').textContent=e.message;}}
function drawMap(){
  try{const m=draft(),settings=data(m,'settings'),geometry=data(m,'geometry'),spawns=data(m,'spawns'),map=$('map'),ctx=map.getContext('2d'),scale=map.width/settings.size,half=settings.size/2;
    if(!Number.isFinite(scale)||settings.size<24||settings.size>64||geometry.blocks.length>32||geometry.ramps.length>4)return;
    const at=(x,z)=>[(x+half)*scale,(z+half)*scale];ctx.fillStyle='#101e29';ctx.fillRect(0,0,map.width,map.height);ctx.strokeStyle='#253846';for(let i=0;i<=settings.size;i++){ctx.beginPath();ctx.moveTo(i*scale,0);ctx.lineTo(i*scale,map.height);ctx.moveTo(0,i*scale);ctx.lineTo(map.width,i*scale);ctx.stroke();}
    for(const b of [...geometry.blocks,...geometry.ramps]){ctx.fillStyle=b.direction?'#64b7bc':'#c88f45';ctx.fillRect(...at(b.x,b.z),b.w*scale,b.d*scale);}
    const marker=(p,color,label)=>{const [x,y]=at(p[0],p[2]);ctx.fillStyle=color;ctx.fillRect(x-6,y-6,12,12);ctx.font='bold 12px system-ui';ctx.fillText(label,x+9,y+4);};marker(spawns.player,'#98efd1','P');spawns.bots.forEach((p,i)=>marker(p,'#ff7773',String(i+1)));spawns.pickups.forEach(p=>marker(p.position,p.kind==='health'?'#98efd1':'#ffce66','+'));
  }catch(e){$('pack-note').textContent='Draft preview: '+e.message;}
}
function place(x,z){try{const m=draft(),g=data(m,'geometry'),s=data(m,'spawns'),tool=$('map-tool').value;
  if(tool==='cover'){if(g.blocks.length>=32)throw Error('32 block budget');let n=1;while(g.blocks.some(b=>b.id==='cover-'+n))n++;g.blocks.push({id:'cover-'+n,x,y:0,z,w:2,h:2,d:2,material:'stone',color:'cover'});}
  else if(tool==='erase')g.blocks=g.blocks.filter(b=>!(x>=b.x&&x<b.x+b.w&&z>=b.z&&z<b.z+b.d));
  else if(tool==='player')s.player=[x,0,z];else if(tool==='bot')s.bots[0]=[x,0,z];else{if(s.pickups.length>=8)throw Error('8 pickup budget');let n=1;while(s.pickups.some(p=>p.id==='pickup-'+n))n++;s.pickups.push({id:'pickup-'+n,position:[x,0,z],kind:tool,amount:40});}
  fillDraft(m);$('pack-note').textContent='Draft changed. Validate & test to apply.';
}catch(e){$('pack-note').textContent='Edit rejected: '+e.message;}}
function applyPack(text){const next=new FPSSession(text,session.world.mode,session.world.difficulty,session.world.seed);pause();generation++;session=next;selected=0;scoped=false;lastHud=-1;hitUntil=hurtUntil=0;fillDraft(next.pack.manifest);hud(true);draw();$('pack-note').textContent='Accepted '+next.pack.settings.title+'. Enter the arena to test.';}
$('run').addEventListener('click',run);$('pause').addEventListener('click',()=>pause());$('restart').addEventListener('click',()=>reset());
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>reset(b.dataset.mode));
for(const b of document.querySelectorAll('[data-weapon]'))b.addEventListener('click',()=>{selected=Number(b.dataset.weapon);hud(true);});
$('difficulty').addEventListener('change',()=>reset(session.world.mode,$('difficulty').value));
$('sound').addEventListener('click',()=>{audio.enabled=!audio.enabled;$('sound').textContent=audio.enabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(audio.enabled));if(running&&audio.enabled)audio.start(session.world.tick);else audio.stop();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();draw();}catch{$('match-note').textContent='Fullscreen is unavailable in this browser.';}});
$('stage-pause').addEventListener('click',()=>pause());$('stage-restart').addEventListener('click',()=>reset());$('exit-fullscreen').addEventListener('click',()=>document.exitFullscreen());
for(const b of document.querySelectorAll('[data-action]')){
  b.addEventListener('pointerdown',e=>{if(!running)return;e.preventDefault();captures.set(e.pointerId,b);touch.set(b.dataset.action,true);b.setPointerCapture(e.pointerId);});
  b.addEventListener('pointerup',e=>{captures.delete(e.pointerId);touch.set(b.dataset.action,[...captures.values()].includes(b));});
  b.addEventListener('pointercancel',clearInput);b.addEventListener('lostpointercapture',e=>{if(captures.has(e.pointerId))clearInput();});
  b.addEventListener('click',e=>{if(running&&e.detail===0){touch.set(b.dataset.action,true);touch.set(b.dataset.action,false);}});
}
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat&&e.timeStamp-lastUnlock>200){e.preventDefault();running?pause():run();}});
window.addEventListener('blur',()=>pause());window.addEventListener('pagehide',()=>pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('focusin',e=>{if(running&&e.target.matches('input,select,textarea'))pause('Editing settings. Match paused.');});
window.addEventListener('resize',draw);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause('Graphics context lost. Reload the lab.');$('run').disabled=true;$('status').textContent='GRAPHICS LOST';});
$('load-starter').addEventListener('click',()=>{generation++;fillDraft(starterFPSPack(Number($('starter').value)));$('pack-note').textContent='Starter draft loaded; validate to apply.';});
$('edit-weapon').addEventListener('change',weaponFields);$('pack-json').addEventListener('change',()=>{weaponFields();drawMap();});
$('edit-save').addEventListener('click',()=>{try{const m=draft(),w=data(m,'arsenal').weapons[Number($('edit-weapon').value)];for(const k of ['damage','interval','magazine','spread','recoil','radius'])w[k]=Number($('edit-'+k).value);fillDraft(m);$('pack-note').textContent='Weapon draft updated.';}catch(e){$('pack-note').textContent=e.message;}});
$('map').addEventListener('pointerdown',e=>{const rect=$('map').getBoundingClientRect();try{const size=data(draft(),'settings').size;place(Math.floor((e.clientX-rect.left)/rect.width*size-size/2),Math.floor((e.clientY-rect.top)/rect.height*size-size/2));}catch(error){$('pack-note').textContent=error.message;}});
$('place').addEventListener('click',()=>place(Number($('map-x').value),Number($('map-z').value)));
$('apply').addEventListener('click',()=>{try{applyPack($('pack-json').value);}catch(e){$('pack-note').textContent='Rejected; active match preserved: '+e.message;}});
$('export-pack').addEventListener('click',()=>save(session.pack.manifest.id+'.fps.json',session.pack.bytes));
$('import-pack').addEventListener('change',async e=>{const file=e.target.files[0],g=++generation;if(!file)return;try{if(file.size>FPS_PACK_BYTES)throw Error('32 KiB pack limit');const text=await file.text();if(g===generation)applyPack(text);}catch(error){$('pack-note').textContent='Rejected; active match preserved: '+error.message;}finally{e.target.value='';}});
$('export-replay').addEventListener('click',()=>{pause();const text=session.exportReplay();try{const {verification}=verifyFPSReplay(text);save('block-arena.replay.json',canonicalFPS({...JSON.parse(text),verification}));$('replay-note').textContent=`Verified ${verification.ticks} complete ticks in this runtime. Replay exported.`;}catch(e){$('replay-note').textContent='Verification failed: '+e.message;}});
$('import-replay').addEventListener('change',async e=>{const file=e.target.files[0],g=++generation;if(!file)return;try{if(file.size>FPS_REPLAY_BYTES)throw Error('8 MiB replay limit');const text=await file.text();if(g!==generation)return;const {verification}=verifyFPSReplay(text);$('replay-note').textContent=`PASS / ${verification.ticks} complete ticks. Same source and runtime.`;}catch(error){$('replay-note').textContent='Rejected: '+error.message;}finally{e.target.value='';}});
fillDraft(session.pack.manifest);draw();hud(true);document.documentElement.dataset.labReady='block-arena';
// Read-only observability for actual browser checks; no combat mutation shortcut.
globalThis.blockArena=Object.freeze({snapshot:()=>session.world.snapshot(),pack:()=>session.pack.bytes,replay:()=>session.exportReplay(),verify:text=>verifyFPSReplay(text).verification,stats:()=>({...view.stats,audio:audio.player?.snapshot()??null}),running:()=>running});
