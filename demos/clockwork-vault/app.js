// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {Actions,attachKeyboard,attachMouseLook,fpsBindings} from '../../modules/input/index.js';
import {characterView} from '../../modules/character/index.js';
import {mix,quatInterpolate} from '../../modules/math/index.js';
import {Renderer,boxVertices,ringVertices} from '../../modules/render-webgl/index.js';
import {STAGES} from '../ancient-machine/machine.js';
import {PUZZLES,MAX_COMMANDS,PuzzleSearch} from './puzzles.js';
import {createVault,stepVault,progress,consoleAccess,openConsole,closeConsole,operateLock,engageSeal,
  mechanismGeometry,consolePosition,exportVault,importVault,palette} from './world.js';
const $=id=>document.getElementById(id),canvas=$('vault-view'),hex=n=>'0x'+n.toString(16).toUpperCase().padStart(4,'0');
const clock=new FixedClock(),actions=new Actions(),screen=new Actions(),pointers=new Map(),buttonKeys=new Set();
let session=createVault(),mode='intro',renderer,staticMesh,floorMesh,dynamicMesh,lineMesh,last=null,frameHandle;
let revision=0,hintSearch=null,lastModal='',shownConsole=null,gesture=null,completed=null;
const active=()=>mode==='playing'||mode==='console';clock.setPaused(true);
const keyboard=attachKeyboard(window,actions,{bindings:{...fpsBindings,KeyE:'interact'},enabled:()=>mode==='playing'});
const mouse=attachMouseLook(canvas,{enabled:()=>mode==='playing',onLock:()=>{$('control-note').textContent='Mouse captured · WASD move · E inspect · Escape pauses';},
  onUnlock:()=>pause('Mouse released. Resume deliberately, then click to capture again.'),
  onError:()=>{$('control-note').textContent='Drag the view to look, or use arrow keys.';}});
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function clearInput(){keyboard.clear();mouse.release();screen.clear();pointers.clear();buttonKeys.clear();gesture=null;completed=null;document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function showCurtain(title,copy,button){$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('launch').textContent=button;$('curtain').hidden=false;}
function pause(copy='Your position, the mechanisms and the pending calculation are held.'){
  revision++;if(mode==='unavailable'||mode==='complete'||mode==='intro'){clearInput();return;}
  mode='paused';clock.setPaused(true);last=null;clearInput();$('console-panel').hidden=true;
  showCurtain('The vault can wait.',copy,'Resume expedition ↗');updateHud();$('launch').focus({preventScroll:true});
}
function launch(){
  if(mode==='unavailable')return;
  if(mode==='complete'){restart();}
  if(session.limit){message('The four-hour simulation limit was reached. Restart the expedition or restore an earlier replay.',true);return;}
  revision++;mode=session.console===null?'playing':'console';clearInput();clock.setPaused(false);last=null;$('curtain').hidden=true;
  $('console-panel').hidden=mode!=='console';updateHud();
  if(mode==='console')$('close-console').focus({preventScroll:true});else canvas.focus({preventScroll:true});
}
function restart(){
  revision++;mode='intro';clock.reset();clock.setPaused(true);last=null;clearInput();session=createVault();hintSearch=null;lastModal='';shownConsole=null;
  $('console-panel').hidden=true;if(renderer)buildScene();
  showCurtain('Wake the sleeping vault.','Find each brass console. Turn the crank, pull the XOR levers and match its engraved word. Release all six seals, rebuild the causeway and ride the lift to the keeper’s door.','Enter the vault ↗');
  message('A fresh expedition. The first word is waiting.');updateHud();
}
function inspect(){
  if(mode!=='playing')return;
  if(!openConsole(session)){message('Walk closer to the active brass console.');return;}
  revision++;mode='console';clearInput();hintSearch=null;shownConsole=null;lastModal='';$('console-panel').hidden=false;
  updateHud();$('close-console').focus({preventScroll:true});
}
function leaveConsole(){
  if(mode!=='console')return;revision++;closeConsole(session);mode='playing';clearInput();hintSearch=null;
  $('console-panel').hidden=true;updateHud();canvas.focus({preventScroll:true});
}
function operate(command){
  if(mode!=='console')return;revision++;hintSearch=null;
  const accepted=operateLock(session,command);
  $('hint-copy').textContent=accepted?'Read the lanes. Match the engraved target, then engage.':'Finish or undo the pending turn. A full tape must be undone or reset.';
  lastModal='';updateHud();
}
function engage(){
  if(mode!=='console')return;revision++;hintSearch=null;const i=session.console,result=engageSeal(session);
  if(result.status!=='applied'){$('hint-copy').textContent=result.reasons.map(r=>r.message).join(' ');return;}
  mode='playing';clearInput();$('console-panel').hidden=true;message(`${PUZZLES[i].name} released. ${PUZZLES[i].mechanism}.`);
  updateHud();canvas.focus({preventScroll:true});
}

// Original procedural geometry. The model owns collision; engraving is decoration.
function buildScene(){
  renderer.clearMeshes();const vertices=session.solids.flatMap(part=>boxVertices(part.center,part.size,part.color)),lines=[];
  for(let z=7;z>=-62;z-=2){
    if(z< -34&&z> -38||z< -43&&z> -47)continue;
    const y=z<=-47?2.008:.008;
    lines.push(-7.9,y,z,.30,.32,.25,7.9,y,z,.30,.32,.25);
    for(let x=-7;x<8;x+=2)vertices.push(...boxVertices([x,y+.002,z-.8],[1.85,.006,1.45],[(z%4===1?.23:.20),.22,.18]));
  }
  for(const [from,to,y] of [[8,-34,.01],[-38,-43,.01],[-47,-63,2.01]])for(const x of [-7,-5,-3,3,5,7])lines.push(x,y,from,.3,.3,.22,x,y,to,.3,.3,.22);
  for(let i=0;i<6;i++){
    const c=consolePosition(i),y=c[1]-1.3;
    vertices.push(...boxVertices([c[0],y+1.8,c[2]-.2],[1.45,.95,.22],palette.brass));
    for(const side of [-1,1]){
      vertices.push(...boxVertices([side*6.9,y+2.6,c[2]-2.6],[.16,1.7,.18],palette.light));
      vertices.push(...boxVertices([side*6.9,y+1.2,c[2]-2.6],[.5,.3,.5],palette.dark));
    }
    lines.push(...ringVertices([0,y+3.9,c[2]-6.2],1.05,palette.brass,32));
  }
  vertices.push(...boxVertices([0,3.7,-61.7],[2.2,3.4,.6],palette.light));
  staticMesh=renderer.mesh(vertices);floorMesh=renderer.mesh(lines,'lines');dynamicMesh=renderer.mesh([]);lineMesh=renderer.mesh([],'lines');
}
function render(alpha){
  if(!renderer)return;
  const current=characterView(session.character),position=mix(session.previous.position,current.position,alpha),orientation=quatInterpolate(session.previous.orientation,current.orientation,alpha);
  const vertices=[],lines=[],parts=mechanismGeometry(session);
  for(const part of parts){
    vertices.push(...boxVertices(part.center,part.size,part.color));
    if(part.id.startsWith('door-')){
      const [x,y,z]=part.center,w=part.size[0]*.36,h=1.4;
      vertices.push(...boxVertices([x,y,z+.27],[part.size[0]*.68,2.8,.035],[.25,.27,.18]));
      lines.push(x-w,y-h,z+.3,...palette.light,x+w,y+h,z+.3,...palette.light,
        x-w,y+h,z+.3,...palette.light,x+w,y-h,z+.3,...palette.light);
      lines.push(...ringVertices([x,y,z+.31],.4,palette.light,24));
    }else{
      const [x,y,z]=part.center;
      for(const dx of [-2.2,2.2])vertices.push(...boxVertices([x+dx,y+.27,z],[.09,.035,part.size[2]-.08],palette.light));
    }
  }
  const n=progress(session);
  for(let i=0;i<6;i++){
    const c=consolePosition(i),state=session.locks[i].snapshot(),color=i<n?[.62,.77,.43]:i===n?palette.light:[.32,.35,.25];
    lines.push(...ringVertices([c[0],c[1]+.5,c[2]-.06],.35,color,32));
    for(let bit=0;bit<16;bit++)vertices.push(...boxVertices([c[0]-.48+(bit%4)*.32,c[1]+.81-Math.floor(bit/4)*.20,c[2]-.07],[.14,.11,.04],state.word&(1<<(15-bit))?color:[.15,.19,.13]));
    if(i===n){lines.push(c[0],c[1]+1.2,c[2],...palette.light,c[0],c[1]+2.1,c[2],...palette.light);}
  }
  renderer.update(dynamicMesh,vertices);renderer.update(lineMesh,lines);
  renderer.begin(position,orientation,{fog:.009});renderer.draw(staticMesh);renderer.draw(floorMesh);renderer.draw(dynamicMesh);renderer.draw(lineMesh);
}

const svgNS='http://www.w3.org/2000/svg';
function svg(tag,attributes,parent,text){const node=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attributes))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;parent.append(node);return node;}
function gear(radius,teeth){const points=[];for(let i=0;i<teeth*4;i++){const a=i*Math.PI/(teeth*2),r=radius-(i%4<2?0:4);points.push(`${Math.cos(a)*r},${Math.sin(a)*r}`);}return 'M'+points.join('L')+'Z';}
const drums=[65,190,450,575].map((x,i)=>{
  const g=svg('g',{transform:`translate(${x} 90)`},$('lock-drums'));svg('circle',{r:56,class:'lock-ring'},g);
  const rotor=svg('g',{},g);svg('path',{d:gear(52,24),fill:'url(#vault-brass)'},rotor);
  for(let n=0;n<16;n++)svg('text',{y:-40,transform:`rotate(${n*22.5})`,class:'lock-digit'},rotor,n.toString(16).toUpperCase());
  svg('circle',{r:30,class:'lock-inset'},g);svg('text',{y:-67,class:'lock-name'},g,['FS','GS','RS','US'][i]);
  return {rotor,value:svg('text',{y:11,class:'lock-value'},g,'0')};
});
$('lock-gear').setAttribute('d',gear(49,24));
const lanes=[['capture','X · CAPTURE'],['a','A · ROTATE LEFT 1'],['b','B · ROTATE LEFT 3'],['c','C · ROTATE RIGHT 2'],['mix','M · XOR LANES'],['output','Y · XOR OMICRON']].map(([key,name])=>{
  const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.dataset.lane=key;row.append(dt,dd);$('working-lanes').append(row);return {key,dd};
});
const journey=PUZZLES.map((p,i)=>{
  const li=document.createElement('li'),number=document.createElement('b'),copy=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');
  number.textContent=String(i+1).padStart(2,'0');name.textContent=p.name;copy.append(name,detail);li.append(number,copy);$('journey').append(li);return {li,detail};
});
function renderConsole(){
  const i=session.console;if(i===null)return;const p=PUZZLES[i],s=session.locks[i].snapshot();
  if(shownConsole!==i){
    shownConsole=i;$('console-kicker').textContent=`SEAL ${String(i+1).padStart(2,'0')} / 06`;$('console-title').textContent=p.name;
    $('puzzle-note').textContent=p.note;$('target-word').textContent=hex(p.target);$('levers').replaceChildren();
    p.masks.forEach((mask,index)=>{const button=document.createElement('button');button.dataset.lever=index+1;button.textContent=`${String.fromCharCode(65+index)} · XOR ${hex(mask).slice(2)}`;button.addEventListener('click',()=>operate(index+1));$('levers').append(button);});
    $('hint-copy').textContent='Match the engraved target, then engage the seal.';
  }
  const signature=JSON.stringify(s);if(signature===lastModal)return;lastModal=signature;
  const pending=s.detents!==0||s.subTick!==0||s.motor,full=s.commands.length===MAX_COMMANDS,matched=s.word===p.target&&!pending;
  $('lock-word').textContent=hex(s.word);$('lock-word').parentElement.parentElement.classList.toggle('matched',matched);
  drums.forEach((drum,index)=>{drum.value.textContent=s.nibbles[index].toString(16).toUpperCase();drum.rotor.setAttribute('transform',`rotate(${-22.5*s.nibbles[index]})`);});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('lock-cam').setAttribute('transform',`rotate(${45*(s.phase+(reduced?0:s.subTick/15))})`);
  $('lock-stage').textContent=STAGES[s.phase];$('lock-phase').textContent=`${s.phase} / 8 DETENTS · ${s.subTick} / 15`;
  for(const {key,dd}of lanes)dd.textContent=s.registers[key]===null?'— — — —':hex(s.registers[key]);
  document.querySelectorAll('[data-lever]').forEach(button=>{button.disabled=pending||full;});
  $('turn').disabled=s.motor||full;$('crank').disabled=s.motor||full;$('undo').disabled=!pending&&!s.commands.length;
  $('hint').disabled=pending;$('engage').disabled=!matched;
  $('seal-state').textContent=matched?'The word agrees. Release the mechanism.':pending?'The cam is preparing a word.':'The seal is waiting.';
  $('move-count').textContent=`${s.commands.length} / ${MAX_COMMANDS}`;
  $('command-tape').replaceChildren();
  for(const command of s.commands.slice(-12)){const li=document.createElement('li');li.textContent=command===0?'Δ':String.fromCharCode(64+command);$('command-tape').append(li);}
  if(!s.commands.length){const li=document.createElement('li');li.className='empty';li.textContent='No completed commands.';$('command-tape').append(li);}
}
function updateHud(){
  const n=progress(session),access=consoleAccess(session),player=session.character;
  $('status').textContent=({intro:'READY',playing:'EXPLORING',console:'AT CONSOLE',paused:'PAUSED',complete:'COMPLETE',unavailable:'UNAVAILABLE'})[mode];
  $('seal-count').textContent=`${String(n).padStart(2,'0')} / 06 SEALS`;
  $('bay-name').textContent=n===6?'THE KEEPER’S DOOR':PUZZLES[n].name.toUpperCase();
  $('distance').textContent=n===6?'EXIT AHEAD':`${access.distance.toFixed(1)} m`;
  $('aim-note').textContent=n===6?'All seals released. Walk through the final doorway.':access.available?'E / INSPECT THE BRASS CONSOLE':`Approach seal ${String(n+1).padStart(2,'0')} · ${PUZZLES[n].name}`;
  $('interact').disabled=mode!=='playing'||!access.available;$('pause').disabled=mode==='intro'||mode==='unavailable'||mode==='complete';
  $('pause').textContent=mode==='paused'?'Resume':'Pause';
  $('position-z').textContent=player.position[2].toFixed(2);$('height').textContent=player.position[1].toFixed(2);$('support').textContent=player.supportId??'AIR';$('rescues').textContent=session.rescues;
  const seconds=Math.floor(session.ticks/120);$('elapsed').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  journey.forEach(({li,detail},i)=>{li.classList.toggle('done',i<n);li.classList.toggle('active',i===n);detail.textContent=i<n?'RELEASED':i===n?'ACTIVE · '+PUZZLES[i].mechanism.toUpperCase():'SEALED';});
  $('lift-info').hidden=n<5;
  if(n>=5){const lift=mechanismGeometry(session).find(part=>part.id==='lift'),height=lift.center[1]+.25,phase=(session.mechanismTick-session.sealedAt[4])%960;$('lift-height').textContent=height.toFixed(2);$('lift-state').textContent=height===0?'LOWER LANDING':height===2?'UPPER LANDING':phase<480?'RISING':'DESCENDING';}
  $('objective').textContent=session.blocked?'A mechanism is waiting for clearance. Move clear to let it continue.':n===6?'The final gate is rising. Walk to the light at the far end.':n===5?'Board the lift while it is down. Ride to the upper landing, then walk forward to the last console.':n===4?'Cross the raised causeway and approach the fifth console.':`Walk forward to ${PUZZLES[n].name}. Inspect its word, use the levers and crank, then engage the matching seal.`;
  if(mode==='console')renderConsole();
}

$('launch').addEventListener('click',launch);$('pause').addEventListener('click',()=>mode==='paused'?launch():pause());
$('interact').addEventListener('click',inspect);$('close-console').addEventListener('click',leaveConsole);$('restart').addEventListener('click',restart);
$('turn').addEventListener('click',()=>operate('turn'));$('crank').addEventListener('click',()=>operate('detent'));
$('undo').addEventListener('click',()=>operate('undo'));$('reset-lock').addEventListener('click',()=>operate('reset'));$('engage').addEventListener('click',engage);
$('hint').addEventListener('click',()=>{
  if(mode!=='console')return;const s=session.locks[session.console].snapshot();if(s.detents||s.subTick||s.motor)return;
  revision++;hintSearch=new PuzzleSearch(session.console,s.word);$('hint-copy').textContent='Checking a bounded shortest route…';
});
$('save').addEventListener('click',()=>{
  if(mode==='unavailable')return;revision++;pause();const blob=new Blob([JSON.stringify(exportVault(session),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='clockwork-vault-v1.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  message('Expedition replay saved locally. Resume whenever you are ready.');
});
$('restore').addEventListener('click',()=>{revision++;pause();$('replay-file').click();});
$('replay-file').addEventListener('change',async()=>{
  const file=$('replay-file').files[0];$('replay-file').value='';if(!file||mode==='unavailable')return;
  pause();const ticket=++revision;
  try{
    if(file.size>65536)throw new RangeError('Replay files must be at most 64 KiB.');
    const next=importVault(JSON.parse(await file.text()));if(ticket!==revision)return;
    session=next;mode='paused';clock.reset();clock.setPaused(true);last=null;clearInput();hintSearch=null;lastModal='';shownConsole=null;
    $('console-panel').hidden=true;showCurtain('The keeper remembers.','Your position, seals and exact cam state have been restored. The expedition is paused.','Resume expedition ↗');
    if(session.complete){mode='complete';showCurtain('The vault is open.','This replay records a completed expedition. All six seals are released.','Start a new expedition ↗');}
    updateHud();message('Replay restored. The expedition is paused.');
  }catch(error){if(ticket===revision)message(`Replay rejected: ${error.message} The expedition was not changed.`,true);}
});

// Discrete controls accept completed clicks/taps and fresh keyboard presses.
document.addEventListener('pointerdown',e=>{const target=e.target.closest('button:not([data-hold])');gesture=target&&e.button===0?{target,id:e.pointerId,x:e.clientX,y:e.clientY}:null;completed=null;},true);
document.addEventListener('pointermove',e=>{if(gesture&&gesture.id===e.pointerId&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>10)gesture=null;},true);
document.addEventListener('pointerup',e=>{completed=gesture&&gesture.id===e.pointerId&&gesture.target===e.target.closest('button')?gesture.target:null;gesture=null;},true);
document.addEventListener('pointercancel',()=>{gesture=null;completed=null;},true);
document.addEventListener('click',e=>{const button=e.target.closest('button:not([data-hold])');if(button&&e.detail>0&&completed!==button){e.preventDefault();e.stopImmediatePropagation();}completed=null;},true);
document.addEventListener('keydown',event=>{
  if(event.code==='Escape'){event.preventDefault();if(!event.repeat)pause();return;}
  if(mode==='console'&&event.code==='Tab'){
    const buttons=[...$('console-panel').querySelectorAll('button:not(:disabled)')],first=buttons[0],lastButton=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();lastButton.focus();}
    else if(!event.shiftKey&&document.activeElement===lastButton){event.preventDefault();first.focus();}return;
  }
  if(event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  const button=event.target.closest('button:not([data-hold])');
  if(button&&['Space','Enter'].includes(event.code)){event.preventDefault();if(!event.repeat&&!button.disabled)button.click();return;}
  if(mode==='console'){
    const shortcut={KeyT:'turn',KeyU:'undo',KeyR:'reset',Digit1:1,Digit2:2,Digit3:3}[event.code];
    if(shortcut!==undefined){event.preventDefault();if(!event.repeat&&(typeof shortcut!=='number'||shortcut<=PUZZLES[session.console].masks.length))operate(shortcut);}
    if(event.code==='KeyE'){event.preventDefault();if(!event.repeat)leaveConsole();}
  }
},true);
document.addEventListener('keyup',e=>{if(e.target.closest('button:not([data-hold])')&&['Space','Enter'].includes(e.code))e.preventDefault();},true);
document.querySelectorAll('[data-hold]').forEach(button=>{
  const action=button.dataset.hold;
  const sync=()=>{const down=[...pointers.values()].includes(action)||buttonKeys.has(action);screen.set(action,down);button.classList.toggle('pressed',down);};
  button.addEventListener('pointerdown',event=>{if(mode!=='playing')return;event.preventDefault();button.setPointerCapture(event.pointerId);pointers.set(event.pointerId,action);sync();});
  const release=(event,cancel)=>{const held=pointers.delete(event.pointerId);sync();if(cancel&&held&&!screen.value(action))screen.consume(action);};
  button.addEventListener('pointerup',e=>release(e,false));for(const name of ['pointercancel','lostpointercapture'])button.addEventListener(name,e=>release(e,true));
  button.addEventListener('keydown',e=>{if(!['Space','Enter'].includes(e.code))return;e.preventDefault();if(mode!=='playing'||e.repeat&&!buttonKeys.has(action))return;buttonKeys.add(action);sync();});
  button.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();buttonKeys.delete(action);sync();}});
  button.addEventListener('blur',()=>{buttonKeys.delete(action);sync();});
});
window.addEventListener('blur',()=>pause('The window lost focus. Inputs were cancelled; no simulation time passes.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('The tab was hidden. Resume deliberately.');});window.addEventListener('pagehide',()=>pause());
function graphicsFailure(text){mode='unavailable';clock.setPaused(true);clearInput();cancelAnimationFrame(frameHandle);$('console-panel').hidden=true;$('error').hidden=false;$('error').textContent=text;$('launch').disabled=true;updateHud();}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();graphicsFailure('Graphics context lost. Reload the page to restart. Save files already downloaded remain available.');});
function frame(now){
  const seconds=last===null?0:Math.max(0,(now-last)/1000);last=now;
  const result=clock.advance(seconds,dt=>{
    const beforeRescues=session.rescues,beforeConsole=session.console;
    if(mode==='playing'&&actions.consume('interact'))inspect();
    const look=mouse.consume(),axis=(negative,positive)=>actions.axis(negative,positive)+screen.axis(negative,positive);
    stepVault(session,{move:[axis('left','right'),axis('forward','backward')],jump:!!(actions.consume('jump')|screen.consume('jump')),
      crouch:!!(actions.value('crouch')||screen.value('crouch')),sprint:!!(actions.value('sprint')||screen.value('sprint')),
      look:{yaw:look.yaw+axis('yawRight','yawLeft')*1.5*dt,pitch:look.pitch+axis('pitchDown','pitchUp')*1.5*dt}},dt);
    if(beforeRescues!==session.rescues){clearInput();message('The keeper returned you to the last visited console. Released seals are preserved.');}
    if(beforeConsole!==null&&session.console===null&&mode==='console'){mode='playing';clearInput();hintSearch=null;$('console-panel').hidden=true;}
    if(hintSearch&&mode==='console'){
      const hint=hintSearch.step(512);
      if(hint.status!=='building'){
        $('hint-copy').textContent=hint.status==='unreachable'?'No route exists from this word. Reset the seal.':!hint.commands.length?'The word already matches. Engage the seal.':
          `Try ${hint.commands[0]===0?'a Δ full turn':'lever '+String.fromCharCode(64+hint.commands[0])}. Shortest route: ${hint.commands.length} command${hint.commands.length===1?'':'s'} remaining.`;
        hintSearch=null;
      }
    }
    if(session.complete){mode='complete';clock.setPaused(true);clearInput();$('console-panel').hidden=true;
      showCurtain('The vault is open.',`Six seals released in ${Math.floor(session.ticks/120)} simulation seconds. The keeper’s mechanisms remember every completed command.`,'Start a new expedition ↗');
      message('Expedition complete. All six verified locks released; the causeway and lift brought you through.');
    }else if(session.truncated||session.limit)pause(session.limit?'The four-hour simulation limit was reached. Save your record or restart.':'Collision movement reached its safety limit. Restore a replay or restart.');
  });
  render(active()?result.alpha:1);updateHud();frameHandle=requestAnimationFrame(frame);
}
try{renderer=new Renderer(canvas);buildScene();updateHud();frameHandle=requestAnimationFrame(frame);}
catch(error){graphicsFailure(error.message);}
