// SPDX-License-Identifier: Apache-2.0
import {OptionalRenderer} from '../../modules/render-optional/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {cameraMatrix} from '../editor/viewport.js';
import {graphicsControls} from '../gpu-lab/controls.js';
import {galaxy,sphere,station,ship,ring,trail,projectiles} from './geometry.js';
import {createWorld,stepWorld,aim,COURSE,TARGET,CONFIG} from './world.js';
const $=id=>document.getElementById(id);
async function mount(){
  const canvas=$('view'),renderer=new OptionalRenderer(canvas),clock=new FixedClock({step:1/60,maxFrame:.12,maxSteps:8});
  let world=createWorld(),paused=false,last=null,lastDraw=-Infinity,lastHud=-Infinity,dirty=true,total=0,samples=0;
  let drawnWidth=0,drawnHeight=0;
  const keys=new Set(),held=new Map();
  const meshes={stars:renderer.createMesh(galaxy(384),'points'),planet:renderer.createMesh(sphere([-22,-3,-34],10)),station:renderer.createMesh(station()),actor:renderer.createMesh(ship(world)),shots:renderer.createMesh([]),guides:renderer.createMesh([],'lines'),trail:renderer.createMesh([],'lines'),target:renderer.createMesh(ship({position:TARGET,yaw:-Math.PI/2}))};
  const titles={flight:'FLIGHT COURSE',docking:'DOCKING APPROACH',broadside:'BROADSIDE RANGE',orbit:'NEWTONIAN ORBIT'};
  const objectives={flight:'Fly through the three beacons.',docking:'Bring Kestrel home.',broadside:'Land five hits on the range drone.',orbit:'Watch the path close around the planet.'};
  const guidance={flight:'The cyan gate is next. W/S changes thrust; A/D turns; R/F adjusts height. Hold X to brake.',docking:'Approach the open station aperture. Below 1.25 m/s and within 2.5 m, hold E to dock.',broadside:'The amber drone is to starboard. Space fires both sides; turn the ship to line up your broadside.',orbit:'A fixed central mass drives this orbit. The cyan line records the last 128 trail samples; thrust controls are inactive.'};
  function clearInput(){keys.clear();held.clear();for(const b of document.querySelectorAll('[data-control]'))b.setAttribute('aria-pressed','false');}
  function focus(){canvas.focus({preventScroll:true});}
  function pause(value){paused=value;clearInput();clock.setPaused(value);last=null;dirty=true;$('pause').textContent=value?'Resume':'Pause';$('state-label').textContent=value?'PAUSED':'LIVE';if(!value)focus();}
  function guides(){
    const vertices=[];
    if(world.mode==='flight')COURSE.forEach((p,i)=>vertices.push(...ring(p,2.7,i===world.checkpoint?[.25,.9,.85]:i<world.checkpoint?[.25,.45,.48]:[.25,.4,.5])));
    if(world.mode==='docking')for(const z of [0,3,6])vertices.push(...ring([0,0,z],2.5,z===0?[1,.72,.3]:[.22,.6,.7]));
    if(world.mode==='broadside')vertices.push(...ring(TARGET,2.8,[1,.65,.24]));
    if(world.mode==='orbit')vertices.push(...ring([0,0,0],25,[.15,.32,.4],'xz',96));
    renderer.updateMesh(meshes.guides,new Float32Array(vertices));
  }
  function reset(){
    world=createWorld($('mechanic').value);clearInput();clock.reset();last=null;dirty=true;total=0;samples=0;
    renderer.updateMesh(meshes.planet,sphere(world.mode==='orbit'?[0,0,0]:[-22,-3,-34],world.mode==='orbit'?6:10));
    renderer.updateMesh(meshes.trail,[]);guides();
    $('scene-name').textContent=titles[world.mode];$('objective').textContent=objectives[world.mode];$('guidance').textContent=guidance[world.mode];
    $('model-note').textContent=world.mode==='orbit'?'One fixed central mass; a numerical Kepler orbit, not a full gravity simulator. Planet radius: 6 m.':world.mode==='docking'?'Docking checks distance and approach speed. The station aperture is a visual guide; no hull-collision solver is simulated.':'Inertia persists without thrust. The brake is a flight assist; planet and station geometry are scenery.';
    for(const b of document.querySelectorAll('[data-control]')){const field=b.dataset.control.split(':')[0];b.disabled=world.mode==='orbit'||(field==='fire'&&world.mode!=='broadside')||(field==='dock'&&world.mode!=='docking');}
    hud();
  }
  function input(){
    const value=code=>Number(keys.has(code)),result={thrust:value('KeyW')-value('KeyS'),turn:value('KeyD')-value('KeyA'),rise:value('KeyR')-value('KeyF'),brake:keys.has('KeyX'),dock:keys.has('KeyE'),fire:keys.has('Space')};
    for(const [field,amount] of held.values()){if(['thrust','turn','rise'].includes(field))result[field]+=amount;else result[field]=true;}
    for(const field of ['thrust','turn','rise'])result[field]=Math.max(-1,Math.min(1,result[field]));
    return result;
  }
  function hud(){
    const speed=Math.hypot(...world.velocity),target=world.mode==='flight'?COURSE[Math.min(world.checkpoint,COURSE.length-1)]:world.mode==='broadside'?TARGET:[0,0,0];
    const distance=Math.hypot(...target.map((v,i)=>v-world.position[i]));
    $('speed').replaceChildren(document.createTextNode(speed.toFixed(2)+' '),Object.assign(document.createElement('span'),{textContent:'m/s'}));
    $('range').replaceChildren(document.createTextNode(distance.toFixed(1)+' '),Object.assign(document.createElement('span'),{textContent:'m'}));
    $('range-label').textContent=world.mode==='flight'?'NEXT GATE':world.mode==='docking'?'DOCK RANGE':world.mode==='orbit'?'ORBIT RADIUS':'TARGET RANGE';
    $('tick').textContent=world.tick;$('hits').textContent=world.hits;$('altitude').textContent=(world.mode==='orbit'?Math.hypot(...world.position)-6:world.position[1]).toFixed(1)+' m';
    $('intercept').textContent=world.mode==='broadside'?(aim(world)?.time.toFixed(2)??'—')+' s':'—';
    $('progress').textContent=world.mode==='flight'?(world.completed?'COURSE COMPLETE':'GATE '+(world.checkpoint+1)+' / '+COURSE.length):world.mode==='docking'?(world.docked?'DOCKED':speed<CONFIG.dockSpeed?'APPROACH SPEED SAFE':'REDUCE SPEED'):world.mode==='broadside'?world.hits+' / 5 HITS':world.trail.length+' / 128 TRAIL SAMPLES';
    $('mission-state').textContent=world.completed?'EXERCISE COMPLETE':'OBJECTIVE';
    $('metrics').textContent=renderer.mode+' · 60 Hz model · '+(samples?total/samples:0).toFixed(2)+' ms CPU submission';
  }
  graphicsControls(renderer,$('graphics'),()=>{dirty=true;hud();});
  $('pause').onclick=()=>pause(!paused);$('reset').onclick=()=>{reset();focus();};$('mechanic').onchange=()=>{reset();focus();};
  $('camera').onchange=()=>{dirty=true;$('view-label').textContent=$('camera').value==='follow'?'FOLLOW VIEW / +Y UP':'TACTICAL VIEW / +Y UP';focus();};
  window.addEventListener('keydown',e=>{
    if(e.code==='Escape'){pause(true);return;}
    if(e.target.closest('input,select,textarea,button,[contenteditable=true]'))return;
    if(['KeyW','KeyS','KeyA','KeyD','KeyR','KeyF','KeyX','KeyE','Space'].includes(e.code)){e.preventDefault();if(!paused&&!e.repeat)keys.add(e.code);}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  for(const button of document.querySelectorAll('[data-control]')){
    button.setAttribute('aria-pressed','false');
    button.addEventListener('pointerdown',e=>{if(paused||button.disabled||e.button!==0)return;e.preventDefault();focus();button.setPointerCapture(e.pointerId);const [field,v]=button.dataset.control.split(':');held.set(e.pointerId,[field,Number(v)]);button.setAttribute('aria-pressed','true');});
    const release=e=>{held.delete(e.pointerId);button.setAttribute('aria-pressed','false');};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
    button.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!paused&&!e.repeat&&!button.disabled){const [field,v]=button.dataset.control.split(':');held.set(button,[field,Number(v)]);button.setAttribute('aria-pressed','true');}}});
    button.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();held.delete(button);button.setAttribute('aria-pressed','false');}});
    button.addEventListener('blur',()=>{held.delete(button);button.setAttribute('aria-pressed','false');});
  }
  window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
  function resize(){canvas.width=Math.min(960,Math.max(240,Math.round(canvas.clientWidth)));canvas.height=Math.round(canvas.width*canvas.clientHeight/canvas.clientWidth);dirty=true;}
  window.addEventListener('resize',resize);resize();reset();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)pause(true);
  function frame(now){
    const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
    if(canvas.width!==drawnWidth||canvas.height!==drawnHeight)dirty=true;
    if(!paused)clock.advance(dt,()=>{
      const before=[...world.position,world.yaw,world.checkpoint,world.shots.length];stepWorld(world,input());
      if(world.position.some((v,i)=>v!==before[i])||world.yaw!==before[3]||world.checkpoint!==before[4]||world.shots.length||before[5])dirty=true;
      if(world.checkpoint!==before[4])guides();
    });
    if(dirty&&now-lastDraw>=1000/(renderer.gpu?60:30)){
      const start=performance.now();renderer.updateMesh(meshes.actor,ship(world));renderer.updateMesh(meshes.shots,projectiles(world));
      if(world.mode==='orbit')renderer.updateMesh(meshes.trail,trail(world.trail));
      const follow=$('camera').value==='follow',camera=follow?{yaw:-world.yaw*180/Math.PI+15,pitch:28,distance:18,target:world.position}:world.mode==='orbit'?{yaw:25,pitch:50,distance:65,target:[0,0,0]}:{yaw:28,pitch:43,distance:49,target:[0,0,-9]};
      renderer.beginFrame({vp:cameraMatrix(camera,canvas.width,canvas.height)});
      renderer.draw(meshes.stars);renderer.draw(meshes.planet);if(world.mode!=='orbit')renderer.draw(meshes.station);
      renderer.draw(meshes.guides);renderer.draw(meshes.trail);renderer.draw(meshes.actor);renderer.draw(meshes.shots);if(world.mode==='broadside')renderer.draw(meshes.target);renderer.endFrame();
      total+=performance.now()-start;samples++;dirty=false;lastDraw=now;drawnWidth=canvas.width;drawnHeight=canvas.height;
    }
    if(now-lastHud>=120){hud();lastHud=now;}
    requestAnimationFrame(frame);
  }
  window.lab={kind:'orbital-proving-ground',renderer,get world(){return world;},pause,reset};document.documentElement.dataset.labReady='ready';requestAnimationFrame(frame);
}
mount().catch(error=>{$('error').hidden=false;$('error').textContent='This demo needs Canvas 2D. '+error.message;document.documentElement.dataset.labReady='failed';for(const b of document.querySelectorAll('button'))b.disabled=true;});
