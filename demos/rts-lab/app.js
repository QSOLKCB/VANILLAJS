// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {createRtsLab,orderRtsLab,stopRtsLab,toggleRtsGate,stepRtsLab} from './worlds.js';
const $=id=>document.getElementById(id),canvas=$('rts-view'),ctx=canvas.getContext('2d'),clock=new FixedClock();
let session=createRtsLab(),running=false,started=false,failed=false,tool='move',cursor=[21,8],gesture=null,last=performance.now(),message='';
clock.setPaused(true);
function cancelGesture(){const id=gesture?.id;gesture=null;if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
function pause(){cancelGesture();running=false;clock.setPaused(true);last=performance.now();}
function launch(){cancelGesture();running=true;started=true;clock.setPaused(false);last=performance.now();}
function choose(kind){pause();session=createRtsLab(kind);started=false;clock.reset();cursor=[21,8];setTool(kind==='route'?'move':'select');
  for(const button of document.querySelectorAll('[data-recipe]'))button.setAttribute('aria-pressed',String(button.dataset.recipe===kind));
  $('recipe-title').textContent=kind==='route'?'One route. Many choices.':'Six units. One destination.';
  $('recipe-copy').textContent=kind==='route'?'Tap open ground to plan a route. Run it, then close the north gate to send your unit through the south passage.':'Select your squad, then order it east. Units take separate destinations and wait for one another through the gates.';
  roster();hud();
}
function setTool(value){cancelGesture();tool=value;$('tool-select').setAttribute('aria-pressed',String(tool==='select'));$('tool-move').setAttribute('aria-pressed',String(tool==='move'));}
function select(ids,add=false){session.selected=[...new Set(add?[...session.selected,...ids]:ids)];}
function order(cell){orderRtsLab(session,session.selected,cell);cursor=[...cell];hud();}
function roster(){
  $('roster').replaceChildren();for(const unit of session.units){const button=document.createElement('button');button.dataset.unit=unit.id;button.innerHTML='<span></span><small></small>';
    button.addEventListener('click',event=>{cancelGesture();select([unit.id],event.shiftKey);hud();});$('roster').append(button);}
}
function hud(){
  if(failed)return;
  $('status').textContent=running?'RUNNING':started?'PAUSED':'READY';$('launch').textContent=started?'Resume routes ↗':'Run routes ↗';$('launch').disabled=running;$('pause').disabled=!running;
  $('selected-count').textContent=`${session.selected.length} / ${session.units.length}`;$('arrived-count').textContent=`${session.arrived} / ${session.units.length}`;$('waiting-count').textContent=session.waiting;
  $('elapsed').textContent=session.elapsed.toFixed(2);$('order-result').textContent=session.report.status.toUpperCase();$('route-cost').textContent=`${session.report.cost} m`;$('search-count').textContent=session.report.expanded;$('order-count').textContent=session.orders;
  $('cursor-cell').textContent=`CURSOR ${cursor[0]}, ${cursor[1]}`;$('toggle-gate').textContent=session.gateOpen?'Close north gate':'Open north gate';$('toggle-gate').setAttribute('aria-pressed',String(!session.gateOpen));
  if(message!==session.message){message=session.message;$('message').textContent=message;}
  for(const unit of session.units){const button=$('roster').querySelector(`[data-unit="${unit.id}"]`);button.setAttribute('aria-pressed',String(session.selected.includes(unit.id)));button.dataset.cell=unit.cell.join(',');
    button.firstElementChild.textContent=unit.id;button.lastElementChild.textContent=`${unit.cell.join(', ')} · ${unit.waits?'WAIT':unit.path.length>1||unit.from.some((v,i)=>v!==unit.cell[i])?'ROUTE':unit.goal?'ARRIVE':'HOLD'}`;}
}
function point(event){const r=canvas.getBoundingClientRect();return [(event.clientX-r.left)/r.width*24,(event.clientY-r.top)/r.height*16];}
function inside(p){return p[0]>=0&&p[0]<24&&p[1]>=0&&p[1]<16;}
function selectAt(p,add){const unit=session.units.find(u=>Math.hypot(u.position[0]-p[0],u.position[1]-p[1])<.65);select(unit?[unit.id]:[],add);}
function draw(alpha){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(r.width*dpr)),height=Math.max(1,Math.round(r.height*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  ctx.setTransform(width/24,0,0,height/16,0,0);ctx.fillStyle='#102027';ctx.fillRect(0,0,24,16);ctx.lineWidth=.025;
  for(let z=0;z<16;z++)for(let x=0;x<24;x++){
    if(!session.grid.walkable([x,z])){ctx.fillStyle=(x+z)%2?'#293e45':'#263a41';ctx.fillRect(x+.04,z+.04,.92,.92);ctx.strokeStyle='#3e555b';ctx.beginPath();ctx.moveTo(x+.18,z+.82);ctx.lineTo(x+.82,z+.18);ctx.stroke();}
    else{ctx.strokeStyle='#21343b';ctx.strokeRect(x,z,1,1);}
  }
  ctx.font='.25px monospace';ctx.textAlign='left';ctx.fillStyle='#a1bab8';ctx.fillText('WEST ASSEMBLY',1.5,2);ctx.fillText('EAST LANDING',17,13.5);
  ctx.fillStyle='#799b94';ctx.font='.18px monospace';ctx.fillText('24 × 16 / 1 m CELLS',1.5,14.2);
  ctx.strokeStyle='#dfb77c';ctx.lineWidth=.05;ctx.strokeRect(8.09,4.09,.82,.82);ctx.fillStyle=session.gateOpen?'#8dc2aa':'#dfb77c';ctx.font='.22px monospace';ctx.fillText(session.gateOpen?'N OPEN':'N CLOSED',8.1,3.7);
  ctx.fillStyle='#93aeaa';ctx.fillText('S PASSAGE',7.5,12.4);
  for(const u of session.units){
    const selected=session.selected.includes(u.id),p=u.previous.map((v,i)=>v+(u.position[i]-v)*alpha);
    if(u.path.length>1){ctx.strokeStyle=selected?'#6eaf98':'#375e53';ctx.lineWidth=.055;ctx.setLineDash([.14,.13]);ctx.beginPath();ctx.moveTo(...p);for(const c of u.path)ctx.lineTo(c[0]+.5,c[1]+.5);ctx.stroke();ctx.setLineDash([]);}
    if(u.goal){ctx.strokeStyle=selected?'#b3e5ce':'#567f70';ctx.lineWidth=.035;ctx.strokeRect(u.goal[0]+.3,u.goal[1]+.3,.4,.4);}
    ctx.fillStyle='#0b181c';ctx.beginPath();ctx.arc(...p,.32,0,Math.PI*2);ctx.fill();ctx.fillStyle=u.waits?'#dfb77c':'#a2e2c8';ctx.beginPath();ctx.arc(...p,.23,0,Math.PI*2);ctx.fill();
    if(selected){ctx.strokeStyle='#bef4de';ctx.lineWidth=.04;ctx.beginPath();ctx.arc(...p,.39,0,Math.PI*2);ctx.stroke();}
    ctx.font='.22px monospace';ctx.textAlign='center';ctx.fillStyle='#deeeea';ctx.fillText(u.id,p[0],p[1]-.58);ctx.textAlign='left';
  }
  ctx.strokeStyle='#e4b575';ctx.lineWidth=.045;ctx.strokeRect(cursor[0]+.1,cursor[1]+.1,.8,.8);
  if(gesture&&gesture.mode==='select'){const a=gesture.start,b=gesture.end;ctx.fillStyle='#9cdbc520';ctx.strokeStyle='#a2e2c8';ctx.lineWidth=.04;ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
}
function bind(){
  for(const button of document.querySelectorAll('[data-recipe]'))button.addEventListener('click',()=>choose(button.dataset.recipe));
  $('tool-select').addEventListener('click',()=>setTool('select'));$('tool-move').addEventListener('click',()=>setTool('move'));
  $('launch').addEventListener('click',()=>{launch();hud();});$('pause').addEventListener('click',()=>{pause();hud();});$('reset').addEventListener('click',()=>choose(session.kind));
  $('select-all').addEventListener('click',()=>{cancelGesture();select(session.units.map(u=>u.id));hud();});$('example-order').addEventListener('click',()=>{cancelGesture();order([21,8]);});
  $('stop').addEventListener('click',()=>{cancelGesture();stopRtsLab(session);hud();});$('toggle-gate').addEventListener('click',()=>{cancelGesture();toggleRtsGate(session);hud();});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{if(failed||gesture||![0,2].includes(e.button)||!e.isPrimary)return;e.preventDefault();canvas.focus({preventScroll:true});const p=point(e);if(!inside(p))return;
    gesture={id:e.pointerId,start:p,end:p,mode:e.button===2?'move':tool,add:e.shiftKey};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(gesture?.id===e.pointerId)gesture.end=point(e);});
  canvas.addEventListener('pointerup',e=>{if(gesture?.id!==e.pointerId)return;const g=gesture,p=point(e);cancelGesture();if(!inside(p))return;
    cursor=p.map(Math.floor);if(g.mode==='move')order(cursor);else if(Math.hypot(...g.start.map((v,i)=>v-p[i]))<.35)selectAt(p,g.add);
    else select(session.units.filter(u=>u.position.every((v,i)=>v>=Math.min(g.start[i],p[i])&&v<=Math.max(g.start[i],p[i]))).map(u=>u.id),g.add);hud();});
  canvas.addEventListener('pointercancel',cancelGesture);canvas.addEventListener('lostpointercapture',cancelGesture);
  canvas.addEventListener('keydown',e=>{if(failed||e.repeat)return;const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(arrows[e.code]){e.preventDefault();cancelGesture();cursor=cursor.map((v,i)=>Math.max(0,Math.min(i?15:23,v+arrows[e.code][i])));}
    else if(e.code==='Space'||e.code==='Enter'){e.preventDefault();cancelGesture();if(e.code==='Space'||tool==='move')order(cursor);else selectAt(cursor.map(v=>v+.5),e.shiftKey);}
    else if(e.code==='KeyA'){e.preventDefault();cancelGesture();select(session.units.map(u=>u.id));}hud();});
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat){e.preventDefault();pause();hud();}});
  window.addEventListener('blur',()=>{pause();hud();});document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();hud();}});
  canvas.addEventListener('contextlost',e=>{e.preventDefault();pause();failed=true;canvas.tabIndex=-1;canvas.blur();$('error').hidden=false;$('error').textContent='The drawing context was lost. Reload to restore the map.';for(const b of document.querySelectorAll('button'))b.disabled=true;});
}
if(!ctx){$('error').hidden=false;$('error').textContent='Canvas 2D is unavailable. Try a browser with canvas support.';for(const b of document.querySelectorAll('button'))b.disabled=true;}
else{bind();choose('route');function frame(now){if(failed)return;const result=clock.advance(Math.max(0,(now-last)/1000),dt=>stepRtsLab(session,dt),$('slow').checked?.25:1);last=now;draw(running?result.alpha:1);hud();requestAnimationFrame(frame);}requestAnimationFrame(frame);}
