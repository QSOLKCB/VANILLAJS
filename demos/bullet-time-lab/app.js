// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {FrameGate} from '../../modules/frame-gate/index.js';
import {createBulletLab,stepBulletLab,BULLET_TICK} from './world.js';
const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');
const clock=new FixedClock({step:BULLET_TICK,maxFrame:.1,maxSteps:12}),gate=new FrameGate();
let state=createBulletLab(),running=false,last=null,raf=0,optimized=true,viewRevision=0;
const keys=new Set(),held=new Set();
function clearInput(){keys.clear();held.clear();}
function status(){ $('status').textContent=running?'RUNNING':state.tick?'PAUSED':'READY';
  $('tick').textContent=state.tick.toLocaleString();
  $('domain').textContent=state.domains.scale.toFixed(2)+'×';
  $('focus').textContent=state.focus.toFixed(1);
  $('health').textContent=state.health;
  $('kills').textContent=state.stats.kills;
  $('shots').textContent=state.shots.length;
  $('candidates').textContent=state.work.staticCandidates;
  $('full').textContent=state.work.staticFull;
}
function input(){
  const active=(...names)=>names.some(name=>keys.has(name)||held.has(name));
  return {move:Number(active('ArrowRight','KeyD','right'))-Number(active('ArrowLeft','KeyA','left')),
    fire:active('Space','fire'),focus:active('KeyQ','focus'),dodge:active('ShiftLeft','ShiftRight','dodge')};
}
function tick(){
  state=stepBulletLab(state,input(),optimized);
  if(state.events.length)$('trace').textContent=state.events.join(' · ');
  gate.invalidate();status();
  if(state.health<=0)pause();
}
function pause(){running=false;cancelAnimationFrame(raf);clock.setPaused(true);clearInput();last=null;status();}
function run(){if(state.health<=0)return;pause();clock.setPaused(false);running=true;status();
  last=null;raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true});}
function reset(){pause();clock.reset();state=createBulletLab();gate.invalidate();status();
  $('trace').textContent='New reproducible run.';draw();}
const project=(x,z)=>[450+x*(49-z*.82),445-(z-2)*17.6];
function draw(){
  if(!ctx)return;
  gate.present({key:state.tick+':'+viewRevision,width:canvas.width,height:canvas.height},()=>{
    const w=canvas.width,h=canvas.height;
    ctx.fillStyle=state.domains.slow>.3?'#251d25':'#091726';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#294355';ctx.lineWidth=2;
    for(const x of [-5,-3,-1,1,3,5]){
      const a=project(x,2),b=project(x,22);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
    }
    for(let z=2;z<=22;z+=2){const a=project(-5,z),b=project(5,z);
      ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
    for(const [a,b] of [[-5,-1.25],[1.25,5]]){
      const [x,y]=project(a,10),[x2]=project(b,10);
      ctx.fillStyle='#586778';ctx.fillRect(x,y-12,x2-x,24);
      ctx.fillStyle='#8396a0';ctx.fillRect(x,y-12,x2-x,3);
    }
    const [px,py]=project(state.playerX,2),[ex,ey]=project(state.enemyX,19.5);
    ctx.fillStyle='#79f0cc';ctx.beginPath();ctx.moveTo(px,py-21);ctx.lineTo(px-14,py+11);
    ctx.lineTo(px+14,py+11);ctx.closePath();ctx.fill();
    if(state.respawn===0){ctx.fillStyle='#e67e91';ctx.fillRect(ex-9,ey-20,18,26);
      ctx.fillStyle='#f5d3b0';ctx.fillRect(ex-4,ey-13,8,4);}
    ctx.lineWidth=3;
    for(const s of state.shots){
      const [x,y]=project(s.x,s.z);
      ctx.strokeStyle=s.team==='player'?'#8efcdc':'#ffa78e';
      ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x,y+10);ctx.stroke();
    }
    ctx.fillStyle='#c9f3e7';ctx.font='13px ui-monospace,monospace';
    ctx.fillText('WORLD '+state.domains.world.toFixed(2)+'s',20,28);
    ctx.fillText('PLAYER '+state.domains.player.toFixed(2)+'s',20,48);
    ctx.fillText('WEAPON '+state.domains.weapon.toFixed(2)+'s',20,68);
    ctx.fillStyle='#eeae89';ctx.fillText('ENEMY // MOVING TARGET',650,30);
    if(state.domains.slow>.4){ctx.strokeStyle='rgba(238,174,137,.55)';ctx.lineWidth=6;ctx.strokeRect(3,3,w-6,h-6);}
  });
}
function frame(now){if(!running)return;const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
  clock.advance(dt,tick);draw();if(running)raf=requestAnimationFrame(frame);}
$('run').addEventListener('click',run);$('pause').addEventListener('click',pause);
$('reset').addEventListener('click',reset);$('step').addEventListener('click',()=>{
  pause();tick();draw();});
$('optimized').addEventListener('change',e=>{
  optimized=e.target.checked;viewRevision++;gate.invalidate();draw();});
for(const button of document.querySelectorAll('[data-held]')){
  const key=button.dataset.held;
  button.addEventListener('pointerdown',e=>{e.preventDefault();held.add(key);button.setPointerCapture(e.pointerId);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>held.delete(key));
}
window.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','Space'].includes(e.code)){if(document.activeElement===canvas)e.preventDefault();}
  if(e.code==='Escape'){pause();return;}
  if(!e.repeat)keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',pause);
clock.setPaused(true);status();draw();document.documentElement.dataset.labReady='bullet-time';
