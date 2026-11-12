// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {Renderer} from '../../modules/render-webgl/index.js';
import {quatMultiply} from '../../modules/math/index.js';
import {createRace,stepRace,retroCurve,STEP} from './world.js';
import {sceneGeometry,dynamicGeometry} from './geometry.js';
const $=id=>document.getElementById(id);
const retro=$('retro-view'),three=$('three-view');
const ctx=retro.getContext('2d'),keys=new Set(),clock=new FixedClock({step:STEP,maxSteps:8});
const names={retro:['Retro Tour / Horizon Drift','Three highway stages. Dodge AI traffic, bank through the curves and ration the nitro.'],
  circuit:['Circuit Race / Vector Ring','Three laps through eight ordered gates. Trade racing lines with four AI opponents.'],
  derby:['Demolition / Impact Arena','Disable four rival cars by ramming them before your vehicle runs out of structural health.'],
  ball:['Car Football / Boost Arena','First to five goals. Jump, drift, boost and slam the ball between the cyan goalposts.'],
  stunt:['Skyline Stunt / Suspended Circuit','Two laps on a narrow elevated course. Launch over broken bridges, survive drops and protect the suspension.']};
let world=createRace(),renderer=null,groundMesh=null,movingMesh=null,raf=0,last=null,running=false;
let replay=[],audioContext=null,lastHud=0;
function clearInput(){keys.clear();document.querySelectorAll('[data-drive]').forEach(b=>b.classList.remove('pressed'));}
function controls(){
  const has=(...values)=>values.some(v=>keys.has(v));
  return {throttle:Number(has('KeyW','ArrowUp'))-Number(has('KeyS','ArrowDown')),
    steer:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),
    boost:has('ShiftLeft','ShiftRight'),handbrake:has('KeyX'),
    jump:has('Space'),flip:has('KeyF')};
}
function fail(error){$('error').textContent=String(error?.message??error);$('error').hidden=false;}
function safeFocus(){(world.mode==='retro'?retro:three).focus({preventScroll:true});}
function audio(event){
  if(!$('sound').checked||!event||!window.AudioContext)return;
  try{
    audioContext??=new AudioContext();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
    const start=audioContext.currentTime,goal=/GOAL|WIN|LAP/.test(event);
    oscillator.type='triangle';oscillator.frequency.setValueAtTime(goal?660:105,start);
    oscillator.frequency.exponentialRampToValueAtTime(goal?980:42,start+.13);
    gain.gain.setValueAtTime(.045,start);
    gain.gain.exponentialRampToValueAtTime(.0001,start+.17);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);oscillator.stop(start+.18);
  }catch{/* Sound is strictly optional; gameplay never depends on a device. */}
}
function updateHud(){
  const p=world.player;
  $('speed').innerHTML=Math.round(Math.abs(p.speed)*3.6)+' <small>km/h</small>';
  $('lap').textContent=world.mode==='retro'?p.lap+' / 3':
    world.mode==='stunt'?p.lap+' / 2':
    world.mode==='circuit'?p.lap+' / 3':(world.elapsed|0)+'s';
  $('health').textContent=Math.round(p.health)+'%';
  $('boost').textContent=Math.round(p.boost)+'%';
  $('score').textContent=world.mode==='ball'?world.score.join(' : '):
    world.mode==='derby'?p.knockouts+' KOs':
    world.mode==='retro'?Math.floor(world.distance)+' m':
    world.mode==='stunt'?Math.floor(-p.z)+' m':
    world.mode==='circuit'?'GATE '+(p.checkpoint+1):world.contacts;
  $('status').textContent=world.finished?'FINISHED':running?'RACING':world.tick?'PAUSED':'READY';
  if(world.event)$('live-event').textContent=world.event;
}
function showOverlay(title,copy,button){
  $('overlay-title').textContent=title;$('overlay-copy').textContent=copy;
  $('launch').textContent=button;$('curtain').hidden=false;
}
function pause(reason){
  running=false;clock.setPaused(true);last=null;clearInput();
  cancelAnimationFrame(raf);raf=0;
  if(reason)showOverlay('RACE PAUSED',reason,'RESUME RACE ↗');
  $('pause').textContent='RESUME';updateHud();
}
function select(mode){
  pause();world=createRace(mode);replay=[];clock.reset();clock.setPaused(true);
  $('error').hidden=true;
  for(const b of document.querySelectorAll('[data-mode]'))
    b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  retro.hidden=mode!=='retro';three.hidden=mode==='retro';
  $('mode-title').textContent=names[mode][0];$('mode-note').textContent=names[mode][1];
  $('hint').textContent=mode==='stunt'?'Keep your speed across gaps: W accelerate, A/D steer, Space jump, Shift boost.':
    mode==='ball'?'WASD drive, Shift boost, Space jump, X drift, F flip. Hit the ball towards the far goal.':
    mode==='retro'?'W accelerate, A/D steer, Shift boost. Pass traffic without contact.':
    'WASD or arrows to drive, Shift to boost, X to drift, Space to jump, F to flip.';
  showOverlay(names[mode][0].toUpperCase(),names[mode][1],'START ENGINE ↗');
  if(mode!=='retro'){
    try{
      renderer??=new Renderer(three);
      renderer.clearMeshes();
      groundMesh=renderer.mesh(sceneGeometry(mode));
      movingMesh=renderer.mesh(dynamicGeometry(world));
    }catch(error){renderer=null;fail(error);}
  }
  $('pause').textContent='START';
  $('live-event').textContent='READY TO RACE';updateHud();render();
}
function launch(){
  if(world.finished){select(world.mode);}
  if(world.mode!=='retro'&&!renderer)return;
  clearInput();running=true;last=null;clock.setPaused(false);
  $('curtain').hidden=true;$('pause').textContent='PAUSE';
  safeFocus();if(!raf)raf=requestAnimationFrame(frame);updateHud();
}
function download(){
  const receipt={schemaVersion:1,kind:'qsol.vanillajs.racing.run.v1',
    mode:world.mode,step:STEP,inputs:replay,
    observation:{tick:world.tick,elapsed:world.elapsed,result:world.result,
      position:{x:world.player.x,y:world.player.y,z:world.player.z},
      health:world.player.health,contacts:world.contacts,score:world.score}};
  const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)+'\n'],
    {type:'application/json'}));
  const a=document.createElement('a');a.download='racing-'+world.mode+'-run.json';a.href=url;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function polygon(c,color,points){
  c.fillStyle=color;c.beginPath();c.moveTo(points[0][0],points[0][1]);
  for(const point of points.slice(1))c.lineTo(point[0],point[1]);
  c.closePath();c.fill();
}
function drawCar(c,x,y,scale,color){
  c.save();c.translate(x,y);c.scale(scale,scale);
  c.fillStyle='#0d1b23';c.fillRect(-17,-12,9,19);c.fillRect(8,-12,9,19);
  polygon(c,color,[[-14,-22],[14,-22],[19,13],[14,20],[-14,20],[-19,13]]);
  polygon(c,'#152b3c',[[-10,-10],[10,-10],[12,6],[-12,6]]);
  c.fillStyle='#ffdf8d';c.fillRect(-13,-21,7,3);c.fillRect(6,-21,7,3);
  c.restore();
}
function retroRender(){
  if(!ctx)return;
  const rect=retro.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2)*($('eco').checked?.7:1);
  const width=Math.max(1,Math.floor(rect.width*dpr)),height=Math.max(1,Math.floor(rect.height*dpr));
  if(retro.width!==width||retro.height!==height){retro.width=width;retro.height=height;}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=width/dpr,h=height/dpr,horizon=h*.43;
  const sky=ctx.createLinearGradient(0,0,0,horizon);
  sky.addColorStop(0,'#17264a');sky.addColorStop(.66,'#d65e8f');sky.addColorStop(1,'#ffd18c');
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#ffe3b0';ctx.beginPath();ctx.arc(w*.78,h*.25,Math.max(20,w*.04),0,Math.PI*2);ctx.fill();
  for(let j=0;j<2;j++){
    const points=[[0,horizon]];
    for(let i=0;i<=16;i++)points.push([w*i/16,horizon-(j?34:67)-Math.sin(i*1.7+j)*23]);
    points.push([w,horizon]);
    polygon(ctx,j?'#46506a':'#6f5571',points);
  }
  const road=(t)=>{
    const d=26/(t+.075),curve=retroCurve(world.distance+d)-retroCurve(world.distance);
    return {y:horizon+Math.pow(t,1.52)*(h-horizon),
      mid:w*.5+curve*t*t*24-world.player.x*t*t*(w*.035),
      half:5+Math.pow(t,1.22)*w*.42};
  };
  for(let i=0;i<90;i++){
    const a=road(i/90),b=road((i+1)/90),stripe=(Math.floor((world.distance+i*9)/35)%2)===0;
    ctx.fillStyle=stripe?'#1e5b55':'#225854';ctx.fillRect(0,a.y,w,b.y-a.y+2);
    polygon(ctx,stripe?'#e4d19f':'#e8e2cb',[[a.mid-a.half*1.16,a.y],[a.mid+a.half*1.16,a.y],
      [b.mid+b.half*1.16,b.y],[b.mid-b.half*1.16,b.y]]);
    polygon(ctx,stripe?'#343945':'#303945',[[a.mid-a.half,a.y],[a.mid+a.half,a.y],
      [b.mid+b.half,b.y],[b.mid-b.half,b.y]]);
    if(stripe){
      for(const line of [-.36,.36])polygon(ctx,'#dce8d0',
        [[a.mid+a.half*line-1,a.y],[a.mid+a.half*line+1,a.y],
          [b.mid+b.half*line+3,b.y],[b.mid+b.half*line-3,b.y]]);
    }
  }
  const opponents=[...world.bots].sort((a,b)=>b.s-a.s);
  for(const b of opponents){
    const gap=b.s-world.distance;if(gap<0||gap>350)continue;
    const t=Math.max(0,Math.min(1,1-gap/350)),p=road(t),scale=.2+1.65*t;
    drawCar(ctx,p.mid+b.x*p.half*.15,p.y,scale,['#ffc569','#f76e8e','#80c5fa'][b.color]);
  }
  drawCar(ctx,w/2,h*.88,2.25,'#50ecda');
  ctx.fillStyle='#fef9dd';ctx.font='bold 12px monospace';
  ctx.fillText('HORIZON // STAGE '+(world.player.lap+1),20,h-24);
}
function threeRender(){
  if(!renderer||!groundMesh||!movingMesh)return;
  renderer.update(movingMesh,dynamicGeometry(world));
  const p=world.player,s=Math.sin(p.yaw),c=Math.cos(p.yaw);
  const camera=[p.x-s*13,p.y+8,p.z+c*13];
  const qYaw=[0,-Math.sin(p.yaw/2),0,Math.cos(p.yaw/2)];
  const qPitch=[Math.sin(-.27),0,0,Math.cos(-.27)];
  renderer.begin(camera,quatMultiply(qYaw,qPitch),{fog:world.mode==='stunt'?.0016:.003,
    resolution:$('eco').checked?.66:1});
  renderer.draw(groundMesh);renderer.draw(movingMesh);
}
function render(){try{if(world.mode==='retro')retroRender();else threeRender();}catch(error){pause();fail(error);}}
function frame(now){
  raf=0;if(!running)return;
  const elapsed=last===null?0:Math.max(0,(now-last)/1000);last=now;
  const input=controls();
  clock.advance(elapsed,()=>{
    const value={...input};replay.push(value);
    if(replay.length>36000)replay.shift();
    stepRace(world,value);
    if(world.event){$('live-event').textContent=world.event;audio(world.event);}
    if(world.finished){
      pause();showOverlay(world.result,world.mode==='ball'?'Final score: '+world.score.join(' : '):
        'Simulated time '+world.elapsed.toFixed(1)+'s · Contacts '+world.contacts,
      'RACE AGAIN ↻');
    }
  });
  render();
  if(now-lastHud>80){updateHud();lastHud=now;}
  if(running)raf=requestAnimationFrame(frame);
}
for(const button of document.querySelectorAll('[data-mode]'))
  button.addEventListener('click',()=>select(button.dataset.mode));
$('launch').addEventListener('click',launch);
$('pause').addEventListener('click',()=>running?pause('Your car, rivals and the clock are frozen.'):launch());
$('reset').addEventListener('click',()=>select(world.mode));
$('export').addEventListener('click',download);
$('eco').addEventListener('change',render);
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(running)pause('Escape pressed. Press Resume to drive again.');return;}
  if(!running)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  // Ignoring OS key-repeat prevents a held accelerator from restarting after
  // pause/focus cancellation until the user actually releases and presses it.
  if(!e.repeat)keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{if(running)pause('Window focus lost. Inputs released.');});
window.addEventListener('pagehide',()=>{if(running)pause('Page hidden. Inputs released.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause('Tab hidden. Inputs released.');});
for(const b of document.querySelectorAll('[data-drive]')){
  const release=e=>{keys.delete(b.dataset.drive);b.classList.remove('pressed');
    if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId);};
  b.addEventListener('pointerdown',e=>{if(!running)return;b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.drive);b.classList.add('pressed');e.preventDefault();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])
    b.addEventListener(event,release);
}
three.addEventListener('webglcontextlost',e=>{e.preventDefault();pause('WebGL context lost.');fail('GPU context lost. Select a mode to recreate it once restored.');});
three.addEventListener('webglcontextrestored',()=>{renderer=null;select(world.mode);});
clock.setPaused(true);select('retro');
document.documentElement.dataset.racingReady='ready';
