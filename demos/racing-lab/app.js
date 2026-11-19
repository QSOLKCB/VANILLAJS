// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {Renderer} from '../../modules/render-webgl/index.js';
import {quatMultiply} from '../../modules/math/index.js';
import {createRace,stepRace,retroCurve,tourPalette,TOUR_STAGES,SPRINT_LENGTH,STEP} from './world.js';
import {sceneGeometry,dynamicGeometry} from './geometry.js';
import {trackCenter,trackHalfWidth,environmentTheme,TRACK_TOTAL_LENGTH,chooseTourFork} from './track.js';
import {setupTrackFoundry} from './track-editor.js';
const $=id=>document.getElementById(id);
const retro=$('retro-view'),three=$('three-view');
const ctx=retro.getContext('2d'),keys=new Set(),clock=new FixedClock({step:STEP,maxSteps:8});
const names={retro:['Retro Tour / Horizon Drift','Three highway stages. Dodge AI traffic, bank through the curves and ration the nitro.'],
  tour:['Scenic Tour / Sunset Junction','Four original highway stages with three fork choices. Avoid solid traffic and choose the left or right route at each junction.'],
  circuit:['Circuit Race / Vector Ring','Three laps through eight ordered gates. Trade racing lines with four AI opponents.'],
  sprint:['Coastal Sprint / Sapphire Run','Race a 3.6 km winding 3D road through original seaside, canyon and highland scenery. Survive traffic and road shoulders.'],
  derby:['Demolition / Impact Arena','Disable four rival cars by ramming them before your vehicle runs out of structural health.'],
  ball:['Car Football / Boost Arena','First to five goals. Jump, drift, boost and slam the ball between the cyan goalposts.'],
  stunt:['Skyline Stunt / Suspended Circuit','Two laps on a narrow elevated course. Launch over broken bridges, survive drops and protect the suspension.']};
const rasterMode=mode=>mode==='retro'||mode==='tour';
let world=createRace(),renderer=null,groundMesh=null,movingMesh=null,raf=0,last=null,running=false,paused=false;
let authoredTrack=null;
const supportsTrack=mode=>mode==='tour'||mode==='sprint'||mode==='circuit';
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
function safeFocus(){(rasterMode(world.mode)?retro:three).focus({preventScroll:true});}
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
    world.mode==='tour'?p.lap+' / '+TOUR_STAGES:
    world.mode==='sprint'?p.lap+' / 4':
    world.mode==='stunt'?p.lap+' / 2':
    world.mode==='circuit'?p.lap+' / 3':(world.elapsed|0)+'s';
  $('health').textContent=Math.round(p.health)+'%';
  $('boost').textContent=Math.round(p.boost)+'%';
  $('score').textContent=world.mode==='ball'?world.score.join(' : '):
    world.mode==='derby'?p.knockouts+' KOs':
    rasterMode(world.mode)?Math.floor(world.distance)+' m':
    world.mode==='sprint'?Math.floor(world.distance)+' / '+(world.track?TRACK_TOTAL_LENGTH:SPRINT_LENGTH)+' m':
    world.mode==='stunt'?Math.floor(-p.z)+' m':
    world.mode==='circuit'?'GATE '+(p.checkpoint+1):world.contacts;
  $('status').textContent=world.finished?'FINISHED':running?'RACING':paused||world.tick?'PAUSED':'READY';
  if(world.event)$('live-event').textContent=world.event;
}
function showOverlay(title,copy,button){
  $('overlay-title').textContent=title;$('overlay-copy').textContent=copy;
  $('launch').textContent=button;$('curtain').hidden=false;
}
function pause(reason){
  if(reason)paused=true;
  running=false;clock.setPaused(true);last=null;clearInput();
  cancelAnimationFrame(raf);raf=0;
  if(reason)showOverlay('RACE PAUSED',reason,'RESUME RACE ↗');
  $('pause').textContent='RESUME';updateHud();
}
function select(mode){
  pause();paused=false;world=createRace(mode,authoredTrack&&supportsTrack(mode)?authoredTrack:null);
  replay=[];clock.reset();clock.setPaused(true);
  $('error').hidden=true;
  for(const b of document.querySelectorAll('[data-mode]'))
    b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  retro.hidden=!rasterMode(mode);three.hidden=rasterMode(mode);
  $('mode-title').textContent=names[mode][0];$('mode-note').textContent=names[mode][1];
  $('hint').textContent=mode==='stunt'?'Keep your speed across gaps: W accelerate, A/D steer, Space jump, Shift boost.':
    mode==='ball'?'WASD drive, Shift boost, Space jump, X drift, F flip. Hit the ball towards the far goal.':
    mode==='tour'?'W accelerate, A/D steer, Shift boost. Move LEFT or RIGHT before each stage end to choose the next route.':
    mode==='sprint'?'W accelerate, A/D steer, Shift boost. Follow the coastal road, pass rivals and avoid the verge.':
    mode==='retro'?'W accelerate, A/D steer, Shift boost. Brake or change lanes to avoid solid rivals.':
    'WASD or arrows to drive, Shift to boost, X to drift, Space to jump, F to flip.';
  showOverlay(names[mode][0].toUpperCase(),names[mode][1],'START ENGINE ↗');
  if(!rasterMode(mode)){
    try{
      renderer??=new Renderer(three);
      renderer.clearMeshes();
      groundMesh=renderer.mesh(sceneGeometry(mode,world.track));
      movingMesh=renderer.mesh(dynamicGeometry(world));
    }catch(error){renderer=null;fail(error);}
  }
  $('pause').textContent='START';
  $('live-event').textContent='READY TO RACE';updateHud();render();
}
function launch(){
  if(world.finished){select(world.mode);}
  if(!rasterMode(world.mode)&&!renderer)return;
  clearInput();running=true;paused=false;last=null;clock.setPaused(false);
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
// Original sprite-style rear-quarter art. Three silhouettes share the same
// physical hitbox; the added details are bounded Canvas 2D operations only.
function drawCar(c,x,y,scale,color,model=0,health=100){
  c.save();c.translate(x,y);c.scale(scale,scale);
  c.fillStyle='#03091588';c.beginPath();c.ellipse(0,20,23,7,0,0,Math.PI*2);c.fill();
  c.fillStyle='#0a121d';
  for(const side of [-1,1]){
    c.fillRect(side<0?-21:14,-12,7,13);
    c.fillRect(side<0?-22:15,8,7,12);
  }
  // Distinct coupe, grand-tourer and rally hatch profiles.
  const rear=model===2?21:19,shoulder=model===1?20:18,roof=model===2?13:11;
  polygon(c,'#0a1520',[[-16,-24],[16,-24],[shoulder+2,14],[15,rear+3],
    [-15,rear+3],[-shoulder-2,14]]);
  polygon(c,color,[[-14,-22],[14,-22],[shoulder,10],[15,rear],
    [-15,rear],[-shoulder,10]]);
  polygon(c,'#ffffff22',[[-13,-21],[-9,-20],[-12,11],[-16,12]]);
  polygon(c,'#06121d66',[[13,-21],[15,10],[12,17],[9,14]]);
  // Windscreen, roof, rear glazing and A/C pillars are legible at close range.
  polygon(c,'#102b3e',[[-roof,-12],[roof,-12],[roof+1,-4],[-roof-1,-4]]);
  polygon(c,'#527a8b',[[-roof+2,-11],[roof-2,-11],[roof-1,-8],[-roof+1,-8]]);
  polygon(c,model===1?'#244556':'#173448',
    [[-roof-1,-3],[roof+1,-3],[roof+3,9],[-roof-3,9]]);
  polygon(c,'#9fc7d466',[[-roof+1,-2],[-roof+4,-2],[-roof+3,7],[-roof+1,7]]);
  c.fillStyle='#0b1d2c';c.fillRect(-17,11,34,3);
  c.fillStyle='#ff4b68';c.fillRect(-15,13,8,4);c.fillRect(7,13,8,4);
  c.fillStyle='#ffd7ae';c.fillRect(-13,14,4,1);c.fillRect(9,14,4,1);
  c.fillStyle='#112330';c.fillRect(-11,18,22,3);
  c.fillStyle='#cbd8d4';c.fillRect(-5,18,10,2);
  c.fillStyle='#172632';c.fillRect(-20,1,4,6);c.fillRect(16,1,4,6);
  if(model===0){
    // Coupe: aerodynamic spoiler and twin exhausts.
    polygon(c,'#111c2b',[[-20,13],[20,13],[18,16],[-18,16]]);
    c.fillStyle='#aeb9b8';c.fillRect(-13,21,5,2);c.fillRect(8,21,5,2);
  }else if(model===1){
    // Grand tourer: contrasting bonnet stripe and broad chrome trim.
    c.fillStyle='#e0dabb88';c.fillRect(-2,-21,4,17);
    c.fillStyle='#d2dfda';c.fillRect(-17,17,34,2);
  }else{
    // Rally hatch: tall rear roof and contrasting center panel.
    polygon(c,'#d1e8d044',[[-4,-19],[4,-19],[6,8],[-6,8]]);
    c.fillStyle='#ffe8a8';c.fillRect(-18,8,4,3);c.fillRect(14,8,4,3);
  }
  if(health<50){
    c.strokeStyle='#f9ecdcaa';c.lineWidth=1;
    c.beginPath();c.moveTo(-9,-3);c.lineTo(-2,3);c.lineTo(-6,7);c.stroke();
  }
  c.restore();
}
function retroRender(){
  if(!ctx)return;
  const rect=retro.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2)*($('eco').checked?.7:1);
  const width=Math.max(1,Math.floor(rect.width*dpr)),height=Math.max(1,Math.floor(rect.height*dpr));
  if(retro.width!==width||retro.height!==height){retro.width=width;retro.height=height;}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=width/dpr,h=height/dpr,horizon=h*.43;
  const palette=world.track&&world.mode==='tour'?environmentTheme(world.track.environment):
    tourPalette(world.mode==='tour'?world.route:[]);
  const sky=ctx.createLinearGradient(0,0,0,horizon);
  sky.addColorStop(0,palette.sky);sky.addColorStop(.66,'#d65e8f');sky.addColorStop(1,palette.sunset);
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=palette.sunset;ctx.beginPath();ctx.arc(w*.78,h*.25,Math.max(20,w*.04),0,Math.PI*2);ctx.fill();
  for(let j=0;j<2;j++){
    const points=[[0,horizon]];
    for(let i=0;i<=16;i++)points.push([w*i/16,horizon-(j?34:67)-Math.sin(i*1.7+j)*23]);
    points.push([w,horizon]);
    polygon(ctx,j?'#46506a':(palette.mountain??'#536a77'),points);
  }
  const road=(t)=>{
    const d=26/(t+.075),track=world.mode==='tour'?world.track:null;
    const nowCenter=track?trackCenter(track,world.distance,world.route):0;
    const curve=track?
      (trackCenter(track,world.distance+d,world.route)-nowCenter)*.22:
      retroCurve(world.distance+d)-retroCurve(world.distance);
    const half=5+Math.pow(t,1.22)*w*.42;
    const span=track?trackHalfWidth(track,world.distance+d)/12:1;
    return {y:horizon+Math.pow(t,1.52)*(h-horizon),
      mid:w*.5+curve*t*t*24-(world.player.x-nowCenter)*t*t*(w*.035),
      half:half*Math.max(.8,Math.min(1.25,span))};
  };
  for(let i=0;i<90;i++){
    const a=road(i/90),b=road((i+1)/90),stripe=(Math.floor((world.distance+i*9)/35)%2)===0;
    ctx.fillStyle=stripe?'#1e5b55':palette.verge;ctx.fillRect(0,a.y,w,b.y-a.y+2);
    polygon(ctx,stripe?'#e4d19f':'#e8e2cb',[[a.mid-a.half*1.16,a.y],[a.mid+a.half*1.16,a.y],
      [b.mid+b.half*1.16,b.y],[b.mid-b.half*1.16,b.y]]);
    polygon(ctx,stripe?'#343945':(palette.road??'#303945'),[[a.mid-a.half,a.y],[a.mid+a.half,a.y],
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
    drawCar(ctx,p.mid+b.x*p.half*.15,p.y,scale,
      ['#ffc569','#f76e8e','#80c5fa','#d9b5ff','#f0a778'][b.id%5],b.id%3);
  }
  drawCar(ctx,w/2,h*.88,2.25,'#50ecda',0,world.player.health);
  ctx.fillStyle='#fef9dd';ctx.font='bold 12px monospace';
  if(world.mode==='tour'){
    const next=(world.player.lap+1)*1200-world.distance;
    ctx.fillText('SCENIC TOUR // '+(world.track?.name??palette.name).toUpperCase(),20,h-24);
    if(world.player.lap<TOUR_STAGES-1&&next<310){
      ctx.fillStyle='#06151cdd';ctx.fillRect(12,24,Math.min(360,w-24),66);
      ctx.fillStyle='#fff3cf';ctx.fillText('FORK AHEAD · '+Math.ceil(Math.max(0,next))+' m',23,48);
      const choice=chooseTourFork(world.track,world.route,world.player.x);
      ctx.fillText('LEFT ◀ '+(choice==='left'?'SELECTED':'')+
        '    RIGHT ▶ '+(choice==='right'?'SELECTED':''),23,72);
    }
  }else ctx.fillText('HORIZON // STAGE '+(world.player.lap+1),20,h-24);
}
function threeRender(){
  if(!renderer||!groundMesh||!movingMesh)return;
  renderer.update(movingMesh,dynamicGeometry(world));
  const p=world.player,s=Math.sin(p.yaw),c=Math.cos(p.yaw);
  const camera=[p.x-s*13,p.y+8,p.z+c*13];
  const qYaw=[0,-Math.sin(p.yaw/2),0,Math.cos(p.yaw/2)];
  const qPitch=[Math.sin(-.27),0,0,Math.cos(-.27)];
  renderer.begin(camera,quatMultiply(qYaw,qPitch),{fog:world.mode==='stunt'?.0016:world.mode==='sprint'?.0019:.003,
    resolution:$('eco').checked?.66:1});
  renderer.draw(groundMesh);renderer.draw(movingMesh);
}
function render(){try{if(rasterMode(world.mode))retroRender();else threeRender();}catch(error){pause();fail(error);}}
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
const editingTarget=target=>!!target?.closest?.('input,select,textarea,[contenteditable]');
$('track-foundry').addEventListener('focusin',event=>{
  if(editingTarget(event.target)){
    if(running)pause('Track Foundry editing. Driving inputs released.');
    else clearInput();
  }
});
window.addEventListener('keydown',e=>{
  if(editingTarget(e.target)){
    if(running)pause('Track Foundry editing. Driving inputs released.');
    else clearInput();
    return; // Never capture arrows, spaces or throttle keys from editor fields.
  }
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
setupTrackFoundry({
  apply:(mode,track)=>{authoredTrack=track;select(mode);},
  clear:()=>{authoredTrack=null;select(world.mode);}
});
clock.setPaused(true);select('retro');
document.documentElement.dataset.racingReady='ready';
