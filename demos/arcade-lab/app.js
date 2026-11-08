// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {FrameGate} from '../../modules/frame-gate/index.js';
import {createArcadeLab,stepArcadeLab,arcadeFixture,ARCADE_TICK} from './world.js';
const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');
const clock=new FixedClock({step:ARCADE_TICK,maxFrame:.1,maxSteps:12}),gate=new FrameGate();
let state=createArcadeLab(),running=false,last=null,raf=0,optimized=true,revision=0;
const keys=new Set(),held=new Set();let launchRequested=false;
function clearInput(){keys.clear();held.clear();launchRequested=false;}
function status(){$('status').textContent=running?'RUNNING':state.lives===0?'GAME OVER':state.tick?'PAUSED':'READY';
  $('tick').textContent=state.tick.toLocaleString();$('mode').textContent=state.kind.toUpperCase();
  $('score').textContent=state.score;$('lives').textContent=state.lives;
  $('bounces').textContent=state.bounces;$('bricks').textContent=state.broken.length;
  $('candidates').textContent=state.work.candidates;$('full').textContent=state.work.full;
  $('last').textContent=state.last;
}
function input(){const on=(...a)=>a.some(k=>keys.has(k)||held.has(k));
  return {move:Number(on('ArrowRight','KeyD','right'))-Number(on('ArrowLeft','KeyA','left')),
    launch:launchRequested||on('Space')};}
function tick(){const action=input();state=stepArcadeLab(state,action,optimized);
  launchRequested=false;gate.invalidate();status();if(state.lives===0)pause();}
function pause(){running=false;cancelAnimationFrame(raf);clock.setPaused(true);last=null;clearInput();status();}
function run(){if(state.lives===0)return;pause();clock.setPaused(false);running=true;status();
  last=null;raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true});}
function reset(kind=state.kind){pause();clock.reset();state=createArcadeLab(kind);revision++;gate.invalidate();status();draw();}
const loc=(x,z)=>[450+x*62,461-z*27];
function draw(){
  if(!ctx)return;
  gate.present({key:state.kind+':'+state.tick+':'+revision,width:canvas.width,height:canvas.height},()=>{
    ctx.fillStyle='#081b27';ctx.fillRect(0,0,900,500);
    ctx.strokeStyle='#254d57';ctx.lineWidth=1;
    for(let x=-5;x<=5;x++){const p=loc(x,0),q=loc(x,14);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
    for(let z=0;z<=14;z++){const p=loc(-5,z),q=loc(5,z);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
    const broken=new Set(state.broken);
    for(const c of arcadeFixture(state.kind)){
      if(broken.has(c.id))continue;
      const [x,y]=loc(c.min[0],c.max[2]),[x2,y2]=loc(c.max[0],c.min[2]);
      ctx.fillStyle=c.id.startsWith('brick')?'#e6a96e':c.id.startsWith('bumper')?'#b57de0':'#507687';
      ctx.fillRect(x,y,x2-x,y2-y);
    }
    const [px,py]=loc(state.paddle,.84);
    ctx.fillStyle='#79f0cc';ctx.fillRect(px-63,py-6,126,12);
    const [bx,by]=loc(state.ball.x,state.ball.z);
    ctx.fillStyle='#fff1bb';ctx.beginPath();ctx.arc(bx,by,8,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,225,130,.6)';ctx.beginPath();
    ctx.moveTo(bx,by);ctx.lineTo(bx-state.ball.vx*5,by+state.ball.vz*5);ctx.stroke();
    ctx.fillStyle='#a8d9dc';ctx.font='13px ui-monospace,monospace';
    ctx.fillText(state.waiting?'PRESS SPACE TO LAUNCH':'SWEPT AABB / PHYSICAL TICKS',22,28);
    ctx.fillText(optimized?'OPT / INDEX CANDIDATES':'REFERENCE / FULL SCAN',22,48);
  });
}
function frame(now){if(!running)return;const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
  clock.advance(dt,tick);draw();if(running)raf=requestAnimationFrame(frame);}
$('run').addEventListener('click',run);$('pause').addEventListener('click',pause);
$('reset').addEventListener('click',()=>reset());
$('step').addEventListener('click',()=>{pause();tick();draw();});
$('launch').addEventListener('click',()=>{launchRequested=true;canvas.focus({preventScroll:true});});
$('optimized').addEventListener('change',e=>{optimized=e.target.checked;revision++;gate.invalidate();draw();});
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>{
  for(const option of document.querySelectorAll('[data-mode]'))
    option.setAttribute('aria-pressed',String(option===b));
  reset(b.dataset.mode);
});
for(const button of document.querySelectorAll('[data-held]')){
  const key=button.dataset.held;
  button.addEventListener('pointerdown',e=>{e.preventDefault();held.add(key);button.setPointerCapture(e.pointerId);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>held.delete(key));
}
window.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','Space'].includes(e.code)&&document.activeElement===canvas)e.preventDefault();
  if(e.code==='Escape'){pause();return;}if(!e.repeat)keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',pause);
clock.setPaused(true);status();draw();document.documentElement.dataset.labReady='arcade';
