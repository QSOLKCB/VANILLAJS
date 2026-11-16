// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {starterHorizonProject,validateHorizonProject,parseHorizonProject,serializeHorizonProject,HORIZON_PROJECT_BYTES} from './project.js';
import {HorizonView} from './view.js';
const get=id=>document.getElementById(id),copy=value=>JSON.parse(JSON.stringify(value)),radians=value=>Number(value)*Math.PI/180,degrees=value=>value*180/Math.PI;
const angleText=value=>String(Number(degrees(value).toFixed(3)));
const angleField=(id,current)=>get(id).value===angleText(current)?current:radians(get(id).value);
const paintHex=value=>'#'+value.map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
let project=starterHorizonProject(),history=[serializeHorizonProject(project)],cursor=0,view=null,running=false,frame=0,last=null,tourTime=0,generation=0,drag=null,lost=false,disposed=false,knot=1;
const canvas=get('scene'),clock=new FixedClock({step:1/60,maxSteps:6,maxFrame:.1});
const status=(text,error=false)=>{get('status').textContent=text;get('status').classList.toggle('error',error);};
function failed(error){get('graphics-error').hidden=false;get('graphics-message').textContent='Preview unavailable: '+error.message+'. Accepted recipe remains available for editing and export.';}
function createView(){try{view=new HorizonView(canvas,project);lost=false;get('graphics-error').hidden=true;}catch(error){view=null;failed(error);}}
function draw(){if(view&&!lost){try{view.draw(tourTime);}catch(error){running=false;cancelAnimationFrame(frame);failed(error);}}hud();}
function hud(){
  get('mode').textContent=lost?'GRAPHICS LOST':running?'CAMERA TOUR':'STILL FRAME';get('pause').disabled=!running;get('tour').disabled=!view||lost;get('retry-graphics').disabled=lost;get('scene-name').textContent=project.name.toUpperCase();
  const s=view?.snapshot(),g=s?.graphics;
  get('stat-profile').textContent=project.scenery.profile.toUpperCase();get('stat-vertices').textContent=g?g.vertices.toLocaleString():'—';get('stat-draws').textContent=g?String(g.frameDraws):'—';get('stat-uploads').textContent=g?String(g.uploads):'—';get('stat-frames').textContent=s?String(s.frames):'0';get('stat-surface').textContent=s?.road?s.road.surfaceId+' / '+s.road.position[1].toFixed(1)+' m':'—';
  for(const button of document.querySelectorAll('[data-camera]'))button.setAttribute('aria-pressed',String(button.dataset.camera===(view?.mode??'hero')));
  get('camera-caption').textContent=({hero:'Hero view · drag to orbit',orbit:'Overlook · arrows orbit, + / − zoom',road:'Road surface study · tunnel approach',bonnet:'Bonnet inspection · stationary vehicle'})[view?.mode??'hero'];
}
function pause(message){running=false;cancelAnimationFrame(frame);clock.setPaused(true);last=null;if(drag){const id=drag.id;drag=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}draw();if(message)status(message);}
function animate(now){if(!running||disposed)return;const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;clock.advance(dt,step=>{tourTime+=step;});draw();if(running)frame=requestAnimationFrame(animate);}
function tour(){if(!view||lost||running)return;pause();running=true;clock.reset();clock.setPaused(false);last=null;view.resetCamera('hero');canvas.focus({preventScroll:true});status('Camera tour playing. Vehicle pose is a visual rig, not a driving simulation.');hud();frame=requestAnimationFrame(animate);}
function fillKnot(){const road=project.scenery.road;knot=Math.max(0,Math.min(road.length-1,knot));get('road-knot').value=String(knot);get('elevation').value=String(road[knot].y);get('bank').value=angleText(road[knot].bank);}
function refresh(){
  const v=project.vehicle,l=project.lighting;
  for(const [id,min,max] of [['bank',-.4,.4],['steer',-.62,.62],['body-pitch',-.15,.15],['body-roll',-.15,.15],['sun-height',.1,1.4]]){get(id).min=String(degrees(min));get(id).max=String(degrees(max));}
  get('name').value=project.name;get('seed').value=String(project.scenery.seed);get('environment').value=project.scenery.environment;get('quality').value=project.scenery.profile;
  get('road-knot').replaceChildren(...project.scenery.road.map((point,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=String(i+1).padStart(2,'0')+' / '+point.structure;return o;}));fillKnot();
  get('vehicle-class').value=v.classId;get('paint').value=paintHex(v.paint);get('roughness').value=String(v.roughness);get('metallic').value=String(v.metalness);get('steer').value=angleText(v.steer);get('wheel-spin').value=angleText(v.wheelSpin);get('compression').value=String(v.compression[0]);get('body-pitch').value=angleText(v.pitch);get('body-roll').value=angleText(v.roll);get('brake').checked=v.brake>0;
  get('sun-azimuth').value=angleText(l.azimuth);get('sun-height').value=angleText(l.elevation);get('fog').value=String(l.fogDensity);get('recipe-json').value=serializeHorizonProject(project);get('undo').disabled=cursor===0;get('redo').disabled=cursor===history.length-1;hud();
}
function accept(value,message,{remember=true}={}){
  const next=validateHorizonProject(value),raw=serializeHorizonProject(next);
  // Admission and GPU allocation complete before replacing the accepted data.
  if(view&&!lost)view.replace(next);
  generation++;pause();project=next;tourTime=0;if(!view&&!lost)createView();
  if(remember&&raw!==history[cursor]){history=history.slice(0,cursor+1);history.push(raw);if(history.length>24)history.shift();cursor=history.length-1;}
  refresh();draw();status(message);
}
function reject(error){status('Not applied; accepted study preserved: '+error.message,true);}
function fromFields(){
  const next=copy(project),v=next.vehicle,l=next.lighting;next.name=get('name').value;next.scenery.seed=Number(get('seed').value);next.scenery.environment=get('environment').value;next.scenery.profile=get('quality').value;next.scenery.road[knot].y=Number(get('elevation').value);next.scenery.road[knot].bank=angleField('bank',project.scenery.road[knot].bank);
  v.classId=get('vehicle-class').value;const paint=get('paint').value;if(paint!==paintHex(project.vehicle.paint))v.paint=[1,3,5].map(i=>parseInt(paint.slice(i,i+2),16)/255);v.roughness=Number(get('roughness').value);v.metalness=Number(get('metallic').value);v.steer=angleField('steer',project.vehicle.steer);v.wheelSpin=angleField('wheel-spin',project.vehicle.wheelSpin);if(get('compression').value!==String(project.vehicle.compression[0]))v.compression=Array(4).fill(Number(get('compression').value));v.pitch=angleField('body-pitch',project.vehicle.pitch);v.roll=angleField('body-roll',project.vehicle.roll);if(get('brake').checked!==(project.vehicle.brake>0))v.brake=get('brake').checked?1:0;
  l.azimuth=angleField('sun-azimuth',project.lighting.azimuth);l.elevation=angleField('sun-height',project.lighting.elevation);l.fogDensity=Number(get('fog').value);return next;
}
get('authoring').onsubmit=event=>{event.preventDefault();try{accept(fromFields(),'Accepted. Inspect the light, geometry and original vehicle.');}catch(error){reject(error);}};
get('road-knot').onchange=()=>{knot=Number(get('road-knot').value);fillKnot();};
get('quality').onchange=()=>{try{const next=copy(project);next.scenery.profile=get('quality').value;accept(next,'Detail profile changed; owned graphics resources rebuilt.');}catch(error){get('quality').value=project.scenery.profile;reject(error);}};
get('defaults').onclick=()=>{try{knot=1;accept(starterHorizonProject(),'Original Aster Coast study restored.');view?.resetCamera();draw();}catch(error){reject(error);}};
get('undo').onclick=()=>{if(cursor===0)return;try{const next=cursor-1;accept(parseHorizonProject(history[next]),'Previous accepted study restored.',{remember:false});cursor=next;refresh();}catch(error){reject(error);}};
get('redo').onclick=()=>{if(cursor>=history.length-1)return;try{const next=cursor+1;accept(parseHorizonProject(history[next]),'Next accepted study restored.',{remember:false});cursor=next;refresh();}catch(error){reject(error);}};
for(const button of document.querySelectorAll('[data-camera]'))button.onclick=()=>{pause();tourTime=0;view?.resetCamera(button.dataset.camera);draw();};
get('tour').onclick=tour;get('pause').onclick=()=>pause('Camera tour paused.');get('reset-view').onclick=()=>{pause();tourTime=0;view?.resetCamera();draw();status('Camera reset. Accepted scene settings are unchanged.');};
get('retry-graphics').onclick=()=>{generation++;pause();view?.dispose();view=null;createView();draw();if(view)status('Graphics rebuilt from the accepted study.');};
get('apply-json').onclick=()=>{try{accept(parseHorizonProject(get('recipe-json').value),'Validated study JSON accepted.');}catch(error){reject(error);}};
get('import').onchange=async()=>{const input=get('import'),file=input.files?.[0];input.value='';if(!file)return;const ticket=++generation;pause();try{if(file.size>HORIZON_PROJECT_BYTES)throw Error('Study exceeds the 32 KiB limit');const raw=await file.text();if(ticket!==generation)return;accept(parseHorizonProject(raw),'Validated study imported.');}catch(error){if(ticket===generation)reject(error);}};
get('export').onclick=()=>{try{const blob=new Blob([serializeHorizonProject(project)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='horizon-study.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Accepted study exported as data. Reopen it here or use the public modules in your own project.');}catch(error){reject(error);}};
for(const field of document.querySelectorAll('#authoring input,#authoring select,#recipe-json'))field.addEventListener('input',()=>{generation++;});
document.addEventListener('focusin',event=>{if(running&&event.target.matches('input,select,textarea'))pause('Camera tour paused for editing.');});
canvas.addEventListener('pointerdown',event=>{if(event.button!==0||!event.isPrimary||!view||lost)return;event.preventDefault();pause();if(!['hero','orbit'].includes(view.mode))view.resetCamera('orbit');drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});});
canvas.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;view.orbitBy((event.clientX-drag.x)*.008,(event.clientY-drag.y)*.005);drag.x=event.clientX;drag.y=event.clientY;draw();});
const release=event=>{if(drag?.id!==event.pointerId)return;drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);};
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,release);
canvas.addEventListener('keydown',event=>{if(!view||lost)return;if(event.code==='Escape'){event.preventDefault();pause('Camera tour paused.');return;}const move=({ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]})[event.code];if(move||['Equal','Minus','NumpadAdd','NumpadSubtract'].includes(event.code)){event.preventDefault();pause();if(!['hero','orbit'].includes(view.mode))view.resetCamera('orbit');if(move)view.orbitBy(...move);else view.zoomBy(['Equal','NumpadAdd'].includes(event.code)?.9:1.1);draw();}});
window.addEventListener('keydown',event=>{if(event.code==='Escape'&&running){event.preventDefault();pause('Camera tour paused.');}});
window.addEventListener('blur',()=>pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('resize',()=>draw());
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;pause();get('graphics-error').hidden=false;get('graphics-message').textContent='Graphics context lost. Your accepted study is retained; waiting for restoration.';});
canvas.addEventListener('webglcontextrestored',()=>{view?.dispose();view=null;lost=false;createView();draw();status('Graphics restored. The accepted study is retained; camera tour remains paused.');});
window.addEventListener('pagehide',()=>{generation++;pause();view?.dispose();view=null;disposed=true;});
window.addEventListener('pageshow',event=>{if(event.persisted){disposed=false;createView();refresh();draw();status('Accepted study restored after navigation. Camera tour remains paused.');}});
createView();refresh();draw();status('Ready. Edit the study, inspect the surfaces, or start the camera tour.');document.documentElement.dataset.labReady='horizon-lab';
globalThis.__horizonLab=Object.freeze({snapshot:()=>({project:serializeHorizonProject(project),history:{cursor,length:history.length},running,tourTime,lost,view:view?.snapshot()??null}),refresh});
