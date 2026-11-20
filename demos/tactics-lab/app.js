// SPDX-License-Identifier: Apache-2.0
// TACTICS-001 Squadline. Rendering and camera mode never advance a turn.
// All threat observations and real cover checks come from native SENSE-001.
import {createOperation,OPERATION,createRelayStatus,advanceRelayStatus} from './scenario.js';
import {createTacticsState,inspectTactics,planTacticalOrders,queryTacticalCover,
  stepTactics,TACTICS_LIMITS} from '../../modules/tactics/index.js';

const $=id=>document.getElementById(id),ctx=$('field').getContext('2d');
if(!ctx)throw Error('Canvas2D unavailable');
const {world}=createOperation(),W=$('field').width,H=$('field').height,
  size=34,left=(W-world.width*size)/2,top=(H-world.height*size)/2;
let state=createTacticsState(world),relay=createRelayStatus(),history=[],journal=[],queue=new Map(),view='tactical',
  selected='alpha-lead',message='Queue one order per allied unit and execute the turn.';
const xpx=x=>left+(x+.5)*size,zpx=z=>top+(z+.5)*size;
const report=()=>inspectTactics(world,state);
function entry(target,label,detail,tone=''){
  const row=document.createElement('div');row.className='entry '+tone;
  const span=document.createElement('span');span.textContent=label;
  const bold=document.createElement('b');bold.textContent=detail;
  row.append(span,bold);target.append(row);
}
function empty(target,text){
  target.replaceChildren();
  const el=document.createElement('div');el.className='empty';el.textContent=text;target.append(el);
}
function canvasBase(){
  ctx.fillStyle='#091b25';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#0d2b36';ctx.fillRect(left,top,world.width*size,world.height*size);
  ctx.strokeStyle='#274550';ctx.lineWidth=1;
  for(let i=0;i<=world.width;i++){
    const x=left+i*size;ctx.beginPath();ctx.moveTo(x,top);
    ctx.lineTo(x,top+world.height*size);ctx.stroke();
  }
  for(let i=0;i<=world.height;i++){
    const z=top+i*size;ctx.beginPath();ctx.moveTo(left,z);
    ctx.lineTo(left+world.width*size,z);ctx.stroke();
  }
}
function draw(){
  const observation=report(),focus=observation.units.find(u=>u.id===selected),
    covered=queryTacticalCover(world,state,selected);
  canvasBase();
  const title=(str,x,y,color,size=11)=>{
    ctx.fillStyle=color;ctx.font='700 '+size+'px ui-monospace,monospace';
    ctx.fillText(str,x,y);
  };
  const ring=(x,z,r,color)=>{
    ctx.beginPath();ctx.arc(xpx(x),zpx(z),r,0,Math.PI*2);
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
  };
  if(view==='cover'){
    for(const c of covered.slice(0,32)){
      ctx.fillStyle=c===covered[0]?'rgba(149,239,176,.44)':'rgba(139,209,174,.20)';
      ctx.fillRect(left+c.cell[0]*size+3,top+c.cell[1]*size+3,size-6,size-6);
    }
  }
  for(const cover of OPERATION.cover){
    const x=left+cover.x*size,y=top+cover.z*size;
    ctx.fillStyle=cover.height>3?'#455d66':'#34515c';
    ctx.fillRect(x+1,y+1,cover.w*size-2,cover.h*size-2);
    ctx.strokeStyle='#90a89e';ctx.lineWidth=1;
    ctx.strokeRect(x+3,y+3,cover.w*size-6,cover.h*size-6);
    for(let j=0;j<cover.w*size-16;j+=17){
      ctx.fillStyle='rgba(190,209,203,.09)';ctx.fillRect(x+j+7,y+6,8,cover.h*size-12);
    }
  }
  const [ox,oz]=world.objective;
  ctx.fillStyle='rgba(251,194,105,.13)';
  ctx.fillRect(left+ox*size+2,top+oz*size+2,size-4,size-4);
  ring(ox,oz,15,'#f8d394');title('RELAY',xpx(ox)+16,zpx(oz)+4,'#f6d393',12);
  if(view==='intel'){
    for(const actor of observation.units.filter(u=>u.team==='alpha')){
      for(const sight of actor.reports){
        if(!sight.visible)continue;
        const target=observation.units.find(u=>u.id===sight.id);
        ctx.beginPath();ctx.moveTo(xpx(actor.cell[0]),zpx(actor.cell[1]));
        ctx.lineTo(xpx(target.cell[0]),zpx(target.cell[1]));
        ctx.strokeStyle='rgba(251,160,140,.8)';ctx.lineWidth=3;ctx.stroke();
      }
    }
  }
  // A selected move order is a pure UI marker. Pathing and acceptance belong
  // to the engine, never to these canvas pixels.
  for(const cmd of queue.values())if(cmd.action==='move'){
    ring(cmd.to[0],cmd.to[1],12,'#b5dbff');
    title('MOVE',xpx(cmd.to[0])+17,zpx(cmd.to[1])+6,'#b5dbff');
  }
  for(const unit of state.units){
    const [x,z]=unit.cell,allied=unit.team==='alpha',
      selectedUnit=unit.id===selected;
    if(selectedUnit)ring(x,z,16,'#f5d59f');
    ctx.fillStyle=allied?'#96e3c5':'#f3a78f';
    ctx.beginPath();ctx.arc(xpx(x),zpx(z),11,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#152832';ctx.beginPath();ctx.arc(xpx(x),zpx(z),4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=allied?'#a8eed5':'#f9b39e';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(xpx(x),zpx(z));
    ctx.lineTo(xpx(x)+unit.heading[0]*17,zpx(z)+unit.heading[1]*17);ctx.stroke();
    const name=unit.id.replace('alpha-','A/').replace('bravo-','B/');
    title(name,xpx(x)+14,zpx(z)-8,allied?'#adf1db':'#ffd0ac');
    if(unit.suppression)title('SUP '+unit.suppression,xpx(x)-11,zpx(z)+26,'#f6c786');
  }
  title('SENSE-001 / 3D LOS • NO VISUAL SHORTCUTS',20,35,'#92cfc5',13);
  title('SELECTED: '+selected.toUpperCase(),20,H-16,'#edcf95',12);
}
function redraw(){
  const observer=report(),focus=observer.units.find(u=>u.id===selected),
    covered=queryTacticalCover(world,state,selected);
  $('turn').textContent=String(state.turn).padStart(2,'0');
  $('phase').textContent=relay.phase.toUpperCase();
  $('relay').textContent='RELAY '+relay.progress+' / 2';
  $('status').textContent=message;
  $('execute').disabled=relay.phase!=='active';
  $('undo').disabled=!history.length;
  const queued=$('queued');queued.replaceChildren();
  if(queue.size)for(const cmd of [...queue.values()].sort((a,b)=>a.unitId.localeCompare(b.unitId))){
    entry(queued,cmd.unitId.replace('alpha-',''),cmd.action.toUpperCase()+
      (cmd.action==='move'?' '+cmd.to.join('/'):'')+
      (cmd.action==='suppress'?' '+cmd.targetId:''));
  }else empty(queued,'No queued orders. Omitted units HOLD.');
  const intel=$('intel');intel.replaceChildren();
  for(const sight of focus.reports)
    entry(intel,sight.id,sight.visible?'VISIBLE':sight.reason.toUpperCase(),
      sight.visible?'success':sight.reason==='occluded'?'warning':'');
  const coverPanel=$('cover');coverPanel.replaceChildren();
  if(!covered.length)empty(coverPanel,'No reachable ray-blocked cover within 5 steps.');
  for(const [index,c] of covered.slice(0,5).entries())
    entry(coverPanel,index===0?'BEST '+c.cell.join('/'):'CELL '+c.cell.join('/'),
      c.steps+' steps · '+c.occluderId,index===0?'success':'');
  const intents=$('opposing');intents.replaceChildren();
  for(const cmd of planTacticalOrders(world,state,'bravo'))
    entry(intents,cmd.unitId.replace('bravo-',''),cmd.action.toUpperCase());
  const events=$('events');events.replaceChildren();
  if(!state.events.length)empty(events,'No tactical orders executed yet.');
  for(const e of state.events.slice(-8))
    entry(events,e.unitId.replace('alpha-','A/').replace('bravo-','B/'),
      e.action.toUpperCase()+' '+e.event);
  draw();
}
function capture(){
  return {state,orders:[...queue.values()].map(o=>({...o,
    to:o.to?[...o.to]:null}))};
}
function execute(){
  if(relay.phase!=='active')return;
  const commands=[...queue.values()].map(o=>({...o,to:o.to?[...o.to]:null}));
  try{
    const result=stepTactics(world,state,commands);
    if(!result.accepted){
      message='Order rejected atomically: '+result.reason+' (no turn consumed).';
      redraw();return;
    }
    const nextRelay=advanceRelayStatus(relay,result.state);
    history.push({state,relay});journal.push(commands);
    state=result.state;relay=nextRelay;queue.clear();
    message=relay.phase==='secured'?'Quiet Relay secured. Operation complete.':
      relay.phase==='exhausted'?'Operational turn limit reached.':
      'Turn '+state.turn+' executed · '+state.events.length+' recorded decisions.';
    redraw();
  }catch(error){message='Order rejected: '+error.message;redraw();}
}
$('unit').replaceChildren(...OPERATION.units.filter(u=>u.team==='alpha').map(u=>{
  const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.id.replace('alpha-','').toUpperCase();return opt;
}));
$('target-unit').replaceChildren(...OPERATION.units.filter(u=>u.team==='bravo').map(u=>{
  const opt=document.createElement('option');opt.value=u.id;opt.textContent=u.id.replace('bravo-','').toUpperCase();return opt;
}));
$('unit').value=selected;
$('unit').addEventListener('change',()=>{selected=$('unit').value;redraw();});
$('view').addEventListener('change',()=>{view=$('view').value;redraw();});
$('action').addEventListener('change',redraw);
$('queue').addEventListener('click',()=>{
  const action=$('action').value,unitId=$('unit').value;
  const to=action==='move'?[Number($('target-x').value),Number($('target-z').value)]:null,
    targetId=action==='suppress'?$('target-unit').value:null;
  if(to&&(!to.every(Number.isSafeInteger)||to[0]<0||to[0]>=world.width||
      to[1]<0||to[1]>=world.height)){
    message='Select an in-bounds whole grid destination.';redraw();return;
  }
  queue.set(unitId,{unitId,action,to,targetId});
  message=unitId+' '+action+' queued; execute to advance time.';redraw();
});
$('suggest').addEventListener('click',()=>{
  queue=new Map(planTacticalOrders(world,state,'alpha').map(o=>[o.unitId,o]));
  message='Deterministic suggestions queued. You decide whether to execute.';redraw();
});
$('execute').addEventListener('click',execute);
$('undo').addEventListener('click',()=>{
  if(!history.length)return;
  const previous=history.pop();state=previous.state;relay=previous.relay;
  journal.pop();queue.clear();
  message='Last accepted turn undone. Authoritative world restored.';redraw();
});
$('replay').addEventListener('click',()=>{
  try{
    let source=createTacticsState(world),referenceRelay=createRelayStatus();
    for(const orders of journal){
      const result=stepTactics(world,source,orders);
      if(!result.accepted)throw Error('journal contains a rejected command');
      source=result.state;
      referenceRelay=advanceRelayStatus(referenceRelay,source);
    }
    if(JSON.stringify(source)!==JSON.stringify(state)||
      JSON.stringify(referenceRelay)!==JSON.stringify(relay))
      throw Error('deterministic state or relay policy mismatch');
    message='REPLAY PASS · '+journal.length+' accepted turns reproduced exactly.';redraw();
  }catch(error){message='REPLAY FAILED: '+error.message;redraw();}
});
$('reset').addEventListener('click',()=>{
  state=createTacticsState(world);relay=createRelayStatus();
  history=[];journal=[];queue.clear();
  selected='alpha-lead';$('unit').value=selected;
  message='Original deterministic squad scenario restored.';redraw();
});
$('field').addEventListener('click',event=>{
  const rect=$('field').getBoundingClientRect(),
    px=(event.clientX-rect.left)*W/rect.width,
    pz=(event.clientY-rect.top)*H/rect.height,
    x=Math.floor((px-left)/size),z=Math.floor((pz-top)/size);
  if(x<0||z<0||x>=world.width||z>=world.height)return;
  const actor=state.units.find(u=>u.cell[0]===x&&u.cell[1]===z);
  if(actor?.team==='alpha'){
    selected=actor.id;$('unit').value=selected;
    message='Selected '+selected+'; choose an order.';redraw();return;
  }
  if(actor?.team==='bravo'){
    $('target-unit').value=actor.id;$('action').value='suppress';
    message='Selected contact '+actor.id+'. SENSE-001 will verify visibility.';redraw();return;
  }
  $('target-x').value=String(x);$('target-z').value=String(z);
  $('action').value='move';message='Destination '+x+'/'+z+' selected; queue order.';redraw();
});
$('field').addEventListener('keydown',event=>{
  if(event.code==='Enter'||event.code==='Space'){
    event.preventDefault();$('execute').click();
  }
});
redraw();
document.documentElement.dataset.tacticsReady='ready';
Object.defineProperty(globalThis,'__tacticsLab',{value:Object.freeze({
  snapshot:()=>({turn:state.turn,phase:relay.phase,progress:relay.progress,
    units:state.units.map(u=>({...u,cell:[...u.cell],heading:[...u.heading]})),
    events:state.events.map(e=>({...e})),view,
    selected,queued:[...queue.values()].map(o=>({...o})),
    perception:inspectTactics(world,state),cover:queryTacticalCover(world,state,selected),
    journalLength:journal.length})
})});
