// SPDX-License-Identifier: Apache-2.0
// Original turn-based SENSE-001 demo. Rendering does not advance simulation.
// Three camera presentations consume one authoritative sight world per turn.
import {createMission,stepMission,inspectMission,missionMap} from './mission.js';

const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d');
if(!ctx)throw Error('Canvas2D unavailable: SENSE-001 requires a native browser canvas');
const map=missionMap();
const training='north wait east east north north east south east east east north north east crouch east east north north east east north north north north east north north east east east east east east south south east north'.split(' ');
let state=createMission(),previous=[],played=[],localMessage='',view='tactical';
const W=canvas.width,H=canvas.height,grid=35,left=(W-map.width*grid)/2,top=(H-map.height*grid)/2;
const TWO=Math.PI*2,half=Math.PI*95/360;
const px=x=>left+(x+.5)*grid,pz=z=>top+(z+.5)*grid;
const guardStyle='#f2ae8b';
function background(){
  ctx.fillStyle='#0a1821';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(150,219,204,.03)';
  for(let x=0;x<W;x+=14)for(let y=0;y<H;y+=14)ctx.fillRect(x,y,1,1);
}
function label(text,x,y,color='#b9d7cc',size=14){
  ctx.fillStyle=color;ctx.font='700 '+size+'px ui-monospace,monospace';ctx.fillText(text,x,y);
}
function drawMarker(p,title,color){
  const x=px(p.x),y=pz(p.z);
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(x-12,y-12,24,24);
  ctx.fillStyle=color;ctx.fillRect(x-4,y-4,8,8);
  label(title,x+18,y+5,color,12);
}
function circle(x,y,r,fill){
  ctx.beginPath();ctx.arc(x,y,r,0,TWO);ctx.fillStyle=fill;ctx.fill();
}
function tactical(sight){
  background();
  ctx.fillStyle='#102a33';ctx.fillRect(left,top,map.width*grid,map.height*grid);
  ctx.strokeStyle='#23444b';ctx.lineWidth=1;
  for(let x=0;x<=map.width;x++){
    ctx.beginPath();ctx.moveTo(left+x*grid,top);ctx.lineTo(left+x*grid,top+map.height*grid);ctx.stroke();
  }
  for(let z=0;z<=map.height;z++){
    ctx.beginPath();ctx.moveTo(left,top+z*grid);ctx.lineTo(left+map.width*grid,top+z*grid);ctx.stroke();
  }
  for(const guard of sight.threats){
    const gx=px(guard.x),gy=pz(guard.z),angle=Math.atan2(-guard.heading[2],guard.heading[0]);
    ctx.beginPath();ctx.moveTo(gx,gy);ctx.arc(gx,gy,7*grid,angle-half,angle+half);
    ctx.closePath();ctx.fillStyle=guard.spotsAgent?'rgba(255,105,90,.24)':'rgba(247,176,95,.105)';ctx.fill();
    ctx.strokeStyle=guard.spotsAgent?'#f18a85':'#8c8b62';ctx.stroke();
  }
  for(const cover of map.cover){
    const x=left+cover.x*grid,y=top+cover.z*grid,w=cover.w*grid,h=cover.h*grid;
    ctx.fillStyle=cover.height>=3?'#29454b':cover.height>=2?'#43504b':'#6f6751';
    ctx.fillRect(x+2,y+2,w-4,h-4);ctx.strokeStyle=cover.height>=3?'#6f9296':'#bd9e70';
    ctx.lineWidth=2;ctx.strokeRect(x+2,y+2,w-4,h-4);
    for(let j=x+9;j<x+w-4;j+=14){ctx.beginPath();ctx.moveTo(j,y+4);ctx.lineTo(Math.min(x+w-4,j+18),y+h-4);ctx.stroke();}
  }
  drawMarker(map.intel,state.intel?'MANIFEST TAKEN':'DATA RELAY','#eccc8e');
  drawMarker(map.exit,'EXTRACTION','#8ee9bc');
  for(const guard of sight.threats){
    const visible=sight.known.includes(guard.id),gx=px(guard.x),gy=pz(guard.z);
    circle(gx,gy,12,visible?guardStyle:'#9b7470');
    ctx.strokeStyle='#201d23';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#2a2530';ctx.beginPath();ctx.moveTo(gx,gy);
    ctx.lineTo(gx+guard.heading[0]*19,gy-guard.heading[2]*19);ctx.lineWidth=4;ctx.stroke();
    label(guard.id.slice(-1),gx-4,gy+5,'#251b1b',12);
  }
  const {agent}=state;
  const x=px(agent.x),y=pz(agent.z),a=Math.atan2(-agent.heading[2],agent.heading[0]);
  ctx.save();ctx.translate(x,y);ctx.rotate(a);
  ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-11,-10);ctx.lineTo(-8,0);ctx.lineTo(-11,10);ctx.closePath();
  ctx.fillStyle=agent.crouched?'#a1d6ef':'#a8f1c7';ctx.fill();ctx.restore();
  circle(x,y,23,'rgba(115,228,203,.10)');
  ctx.strokeStyle='#c2ffe5';ctx.beginPath();ctx.arc(x,y,22,0,TWO);ctx.stroke();
  label('SENSE RANGE / 14 m',left+10,top-16,'#8acdc2',13);
  label('DIAGNOSTIC CONES: 95 degrees, walls occlude separately',left+10,top+map.height*grid+28,'#85acaa',12);
}
function perspective(sight){
  background();
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#284554');grad.addColorStop(.51,'#152e3a');grad.addColorStop(.52,'#3c5147');grad.addColorStop(1,'#101f27');
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#3d665c';ctx.lineWidth=1;
  for(let i=1;i<14;i++){const y=H*.52+(H*.48)*(i/14)**2;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  const forward=state.agent.heading,right=[-forward[2],0,forward[0]],eye=state.agent.crouched?.65:1.6;
  const origin=[state.agent.x*2,eye,-state.agent.z*2],F=460;
  function project(p){
    const d=p.map((v,i)=>v-origin[i]);
    const depth=d[0]*forward[0]+d[2]*forward[2],side=d[0]*right[0]+d[2]*right[2];
    if(depth<=.3)return null;
    return {x:W/2+side/depth*F,y:H*.52-(p[1]-eye)/depth*F,depth};
  }
  const objects=map.cover.map(c=>{
    const mid=[(c.x+(c.w-1)/2)*2,c.height/2,-(c.z+(c.h-1)/2)*2];
    return {...c,at:project(mid)};
  }).filter(x=>x.at&&x.at.depth<70).sort((a,b)=>b.at.depth-a.at.depth);
  for(const c of objects){
    const bottom=project([(c.x+(c.w-1)/2)*2,0,-(c.z+(c.h-1)/2)*2]),
      topPoint=project([(c.x+(c.w-1)/2)*2,c.height,-(c.z+(c.h-1)/2)*2]);
    if(!bottom||!topPoint)continue;
    const width=Math.min(W*2,Math.max(c.w,c.h)*2*F/c.at.depth);
    ctx.fillStyle=c.height>=3?'#39595e':c.height>=2?'#636c5a':'#8f7e56';
    ctx.fillRect(c.at.x-width/2,topPoint.y,width,bottom.y-topPoint.y);
    ctx.strokeStyle='#c8ba8f';ctx.lineWidth=2;
    ctx.strokeRect(c.at.x-width/2,topPoint.y,width,bottom.y-topPoint.y);
  }
  for(const guard of sight.threats){
    if(!sight.known.includes(guard.id))continue;
    const point=project([guard.x*2,1.7,-guard.z*2]);
    if(!point||point.x<0||point.x>W)continue;
    const r=Math.max(7,Math.min(36,220/point.depth));
    circle(point.x,point.y,r,'#f3ab8d');
    ctx.strokeStyle='#fde1bc';ctx.lineWidth=2;ctx.stroke();
    label(guard.id.toUpperCase(),point.x-r,point.y-r-8,'#f9d5b5',11);
  }
  ctx.strokeStyle='#a6e6c8';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(W/2-16,H/2);ctx.lineTo(W/2+16,H/2);
  ctx.moveTo(W/2,H/2-16);ctx.lineTo(W/2,H/2+16);ctx.stroke();
  label('GROUND / FPS VIEW — VISUAL ONLY',22,40,'#dce9d1',16);
  label('Camera direction follows operative heading; gun and guard authority unchanged.',22,H-20,'#a4bcb4',12);
}
function sensor(sight){
  background();const cx=W/2,cy=H/2,r=270,range=30;
  ctx.strokeStyle='#3d736f';ctx.lineWidth=2;
  for(const fraction of [.25,.5,.75,1]){
    ctx.beginPath();ctx.arc(cx,cy,r*fraction,0,TWO);ctx.stroke();
    label(String(Math.round(range*fraction))+'m',cx+r*fraction+6,cy-5,'#719e9b',12);
  }
  ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);
  ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke();
  ctx.fillStyle='rgba(100,219,180,.06)';ctx.beginPath();ctx.arc(cx,cy,r,0,TWO);ctx.fill();
  const h=state.agent.heading,right=[-h[2],0,h[0]],position=[state.agent.x*2,-state.agent.z*2];
  const locate=(x,z)=>{
    const dx=x*2-position[0],dz=-z*2-position[1],ahead=dx*h[0]+dz*h[2],side=dx*right[0]+dz*right[2];
    return [cx+side*r/range,cy-ahead*r/range];
  };
  circle(cx,cy,12,'#9feccc');label('OPERATIVE / BORESIGHT UP',cx+22,cy+5,'#b1eaca',12);
  for(const threat of sight.threats){
    const at=locate(threat.x,threat.z);
    if(sight.known.includes(threat.id)){
      circle(...at,11,threat.spotsAgent?'#ff8478':'#dfb082');
      label(threat.id,at[0]+15,at[1]+4,'#eec8ae',12);
    }
  }
  label('AIR / SPACE SENSOR — SAME AUTHORITATIVE QUERY',22,40,'#c7efdf',16);
  label('Range rings are presentation; no aircraft or projectile simulation is created.',22,H-20,'#8dbcb2',12);
}
function render(){
  const sight=inspectMission(state);
  if(view==='tactical')tactical(sight);
  else if(view==='fps')perspective(sight);
  else sensor(sight);
  $('turn').textContent=String(state.turn).padStart(2,'0');
  $('phase').textContent=state.phase.toUpperCase();
  $('intel').textContent=state.intel?'ACQUIRED':'NOT ACQUIRED';
  $('stance').textContent=state.agent.crouched?'CROUCHED':'STANDING';
  $('position').textContent=String(state.agent.x).padStart(2,'0')+' / '+String(state.agent.z).padStart(2,'0');
  $('known').textContent=sight.known.length+' / 3';
  $('detected').textContent=sight.exposure?'YES':'NO';
  $('tactical-status').textContent=localMessage||state.message;
  $('line-of-sight').textContent=state.phase==='detected'?'EXPOSURE CONFIRMED':sight.exposure?'DETECTION RISK':'LINE OF SIGHT VERIFIED';
  $('threats').replaceChildren(...sight.threats.map(t=>{
    const row=document.createElement('div');row.className='threat'+(t.spotsAgent?' danger':'');
    const name=document.createElement('b');name.textContent=t.id.toUpperCase();
    const status=document.createElement('span');
    status.textContent=t.spotsAgent?'SPOTTED':t.reason.toUpperCase().replaceAll('-',' ');
    row.append(name,status);return row;
  }));
  $('undo').disabled=previous.length===0;
  $('training-step').disabled=state.phase!=='active'||played.length>=training.length||
    !played.every((a,i)=>a===training[i]);
  for(const button of document.querySelectorAll('[data-action]'))button.disabled=state.phase!=='active';
}
function move(action){
  const result=stepMission(state,{action});
  if(result.accepted){previous.push(state);played.push(action);state=result.state;localMessage='';}
  else localMessage=result.event==='blocked'?'Solid cover blocks that route. No turn consumed.':'Mission ended. Undo or reset.';
  render();
}
function reset(){
  state=createMission();previous=[];played=[];localMessage='';render();
}
for(const button of document.querySelectorAll('[data-action]'))
  button.addEventListener('click',()=>move(button.dataset.action));
$('view').addEventListener('change',()=>{view=$('view').value;render();});
$('undo').addEventListener('click',()=>{if(!previous.length)return;state=previous.pop();played.pop();localMessage='Previous accepted turn restored.';render();});
$('reset').addEventListener('click',reset);
$('training-step').addEventListener('click',()=>{
  if(played.every((a,i)=>a===training[i])&&state.phase==='active'&&played.length<training.length)
    move(training[played.length]);
});
const bindings={KeyW:'north',ArrowUp:'north',KeyA:'west',ArrowLeft:'west',KeyS:'south',ArrowDown:'south',
  KeyD:'east',ArrowRight:'east',Space:'wait',KeyC:'crouch'};
window.addEventListener('keydown',event=>{
  // Buttons retain keyboard focus after pointer interaction. WASD/arrows must
  // still work there, while Space/Enter must keep native button activation.
  if(event.target?.closest?.('input,textarea,select'))return;
  if(event.target?.closest?.('button')&&['Space','Enter'].includes(event.code))return;
  if(event.code==='KeyR'){event.preventDefault();if(!event.repeat)reset();return;}
  const mode={Digit1:'fps',Digit2:'tactical',Digit3:'sensor'}[event.code];
  if(mode){event.preventDefault();view=mode;$('view').value=view;render();return;}
  const action=bindings[event.code];
  if(!action)return;
  event.preventDefault();if(!event.repeat&&state.phase==='active')move(action);
});
render();
document.documentElement.dataset.labReady='sense-001';
globalThis.__sensingLab=Object.freeze({snapshot:()=>JSON.parse(JSON.stringify({
  turn:state.turn,phase:state.phase,intel:state.intel,agent:state.agent,guards:state.guards,
  perception:inspectMission(state),view,history:previous.length}))});
