// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {FrameGate} from '../../modules/frame-gate/index.js';
import {createSound2D} from '../../modules/audio2d/index.js';
import {TernaryGridStore2D} from '../../modules/ternary-store2d/index.js';
import {createLab2D,stepLab2D,snapshotLab2D,rtsRoute2D,
  LAB2D_WIDTH,LAB2D_HEIGHT} from './world.js';
const $=id=>document.getElementById(id),canvas=$('lab-canvas'),ctx=canvas.getContext('2d');
const clock=new FixedClock({step:1/60,maxSteps:8}),gate=new FrameGate();
let state=createLab2D(),running=false,last=null,raf=0,store=new TernaryGridStore2D();
const keys=new Set(),S=256,tile=30;
function clearKeys(){keys.clear();}
function change(kind){
  pause();clock.reset();state=createLab2D(kind);gate.invalidate();
  for(const b of document.querySelectorAll('[data-mode]'))
    b.setAttribute('aria-pressed',String(b.dataset.mode===kind));
  status();draw();canvas.focus({preventScroll:true});
}
function pause(){running=false;clearKeys();clock.setPaused(true);last=null;status();}
function run(){if(state.status==='limit')return;clearKeys();
  running=true;clock.setPaused(false);last=null;status();canvas.focus({preventScroll:true});}
function input(){
  const held=(a,b)=>keys.has(a)||keys.has(b);
  return {x:Number(held('ArrowRight','KeyD'))-Number(held('ArrowLeft','KeyA')),
    y:Number(held('ArrowUp','KeyW'))-Number(held('ArrowDown','KeyS')),
    steer:Number(keys.has('KeyE'))-Number(keys.has('KeyQ')),
    throttle:Number(held('ArrowUp','KeyW'))-Number(held('ArrowDown','KeyS')),
    fire:keys.has('Space'),jump:keys.has('Space')};
}
function advance(){
  if(state.status==='limit')return;
  state=stepLab2D(state,input());
  if(state.status==='limit')pause();
  gate.invalidate();status();
}
function status(){
  $('status').textContent=running?'RUNNING':state.status==='limit'?'LIMIT':
    state.tick?'PAUSED':'READY';
  $('tick').textContent=String(state.tick).padStart(4,'0');
  $('route-count').textContent=state.kind==='rts'?String(rtsRoute2D().length):'—';
}
const toPixel=(x,y)=>[(x/S+.5)*tile,(LAB2D_HEIGHT-1-y/S+.5)*tile];
function draw(){
  if(!ctx){$('status').textContent='UNAVAILABLE';return;}
  gate.present({key:state.kind+':'+state.tick,width:780,height:510},()=>{
    ctx.fillStyle='#081526';ctx.fillRect(0,0,780,510);
    ctx.strokeStyle='#1b3041';ctx.lineWidth=1;
    for(let x=0;x<=780;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,510);ctx.stroke();}
    for(let y=0;y<=510;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(780,y);ctx.stroke();}
    if(state.kind==='rts'){
      ctx.fillStyle='#615462';
      for(let y=0;y<LAB2D_HEIGHT;y++)if(y!==7)ctx.fillRect(12*tile,y*tile,tile,tile);
      const route=rtsRoute2D();ctx.strokeStyle='#7cd0bd';ctx.lineWidth=3;
      ctx.beginPath();route.forEach(([x,y],i)=>{
        const px=(x+.5)*tile,py=(y+.5)*tile;if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py);});
      ctx.stroke();
      ctx.fillStyle='#e5b675';ctx.fillRect(24*tile,14*tile,30,30);
    }else if(state.kind==='shmup'){
      ctx.fillStyle='#e0b779';
      for(const s of state.shots){const [x,y]=toPixel(s.x,s.y);ctx.fillRect(x-3,y-12,6,14);}
      ctx.fillStyle='#c45e86';ctx.beginPath();ctx.arc(390+Math.sin(state.tick/31)*125,80,13,0,Math.PI*2);ctx.fill();
    }else if(state.kind==='platform'){
      ctx.fillStyle='#3e8a80';ctx.fillRect(0,480,780,30);
      for(let x=150;x<750;x+=210)ctx.fillRect(x,360-(x%3)*20,100,12);
    }else{
      ctx.strokeStyle='#8ec5a7';ctx.lineWidth=5;
      ctx.strokeRect(75,75,630,360);
      ctx.fillStyle='#d3a465';
      for(const p of state.trail){const [x,y]=toPixel(p.x,p.y);ctx.fillRect(x-2,y-2,4,4);}
    }
    const [x,y]=toPixel(state.body.x,state.body.y);
    ctx.save();ctx.translate(x,y);
    if(state.kind==='car')ctx.rotate(-state.body.heading*Math.PI/8);
    ctx.fillStyle='#91efd4';ctx.fillRect(-10,-10,20,20);
    ctx.fillStyle='#133142';ctx.fillRect(0,-3,10,6);ctx.restore();
    ctx.fillStyle='#a6c6c3';ctx.font='12px monospace';
    ctx.fillText(state.kind.toUpperCase()+' / INT COORDS / TICK '+state.tick,15,20);
  });
  $('store-stats').textContent='Cache builds: '+store.cacheStats().builds+
    ' / hits: '+store.cacheStats().hits+' / invalidations: '+store.cacheStats().invalidations;
}
function frame(now){
  if(!running)return;
  const seconds=last===null?0:Math.max(0,(now-last)/1000);last=now;
  clock.advance(seconds,advance);
  draw();if(running)raf=requestAnimationFrame(frame);
}
function saveFile(name,content,type='application/json'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  // Delay revocation until after the browser has processed the download gesture.
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function previewStore(){
  const snap=store.snapshot();
  $('store-peek').textContent='Entries: '+snap.entries.length+' | '+snap.byteLength+
    ' bytes\nRows: '+snap.rows.length+' × '+snap.columns+
    '\n'+snap.rows.slice(0,4).map(row=>row.join('')).join('\n');
  draw();
}
for(const b of document.querySelectorAll('[data-mode]'))
  b.addEventListener('click',()=>change(b.dataset.mode));
$('run').addEventListener('click',()=>{run();raf=requestAnimationFrame(frame);});
$('pause').addEventListener('click',pause);
$('reset').addEventListener('click',()=>change(state.kind));
$('step').addEventListener('click',()=>{pause();advance();draw();});
$('sound').addEventListener('click',async()=>{
  const events=[{id:1,channel:0,sample:0,duration:10000,frequency:220,wave:'triangle'},
    {id:2,channel:1,sample:12000,duration:7000,frequency:440,wave:'square'},
    {id:3,channel:2,sample:24000,duration:6000,frequency:160,wave:'noise',seed:17},
    {id:4,channel:3,sample:32000,duration:8000,frequency:660,wave:'saw'}];
  const audio=createSound2D({frames:48000,events}),file=new Blob([audio.wav()],
    {type:'audio/wav'}),url=URL.createObjectURL(file),player=new Audio(url);
  $('audio-note').textContent='Original sample-exact 48kHz PCM, live device preview only.';
  player.addEventListener('ended',()=>URL.revokeObjectURL(url),{once:true});
  try{await player.play();}catch{
    $('audio-note').textContent='Playback blocked or unavailable. Strict PCM still generated.';
    URL.revokeObjectURL(url);
  }
});
$('save-store').addEventListener('click',()=>{
  store.put('lab/state.json',snapshotLab2D(state));
  saveFile('vanillajs-ternary2d.json',JSON.stringify(store.snapshot())+'\n');
  previewStore();
});
$('restore-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  event.target.value='';
  try{
    if(file.size>225000)throw new RangeError('file too large');
    store=TernaryGridStore2D.fromSnapshot(JSON.parse(await file.text()));
    $('evidence-note').textContent='Ternary store restored after complete validation.';
  }catch(error){$('evidence-note').textContent='Restore rejected: '+error.message;}
  previewStore();
});
$('download-evidence').addEventListener('click',()=>{
  const report={schemaVersion:1,kind:'qsol.vanillajs.lab2d.browser-observation.v1',
    model:snapshotLab2D(state),ternary:store.snapshot()};
  saveFile('vanillajs-2d-evidence.json',JSON.stringify(report)+'\n');
  $('evidence-note').textContent='Downloaded current model + ternary state; no FPS or audio hardware claim.';
});
window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)&&
    document.activeElement===canvas)e.preventDefault();
  if(e.code==='Escape'){pause();return;}
  if(!e.repeat)keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',pause);
clock.setPaused(true);
try{store.put('notes/guide.txt','VANILLAJS 2D + sound + 27-column ternary grid');
  status();previewStore();document.documentElement.dataset.labReady='ready';}
catch(e){$('status').textContent='UNAVAILABLE';$('evidence-note').textContent=e.message;}
