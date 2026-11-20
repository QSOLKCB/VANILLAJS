// SPDX-License-Identifier: Apache-2.0
// COCKPIT-001: original, self-contained consumer of existing VANILLAJS physics.
// No physics owned by renderer/camera; all weapon alignment tests use pure world rays.
import {mix,rotate,quatInterpolate,seededRandom,add} from '../../modules/math/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {Actions,attachKeyboard,attachMouseLook,flightBindings} from '../../modules/input/index.js';
import {createBody,flightConfig,stepFlight} from '../../modules/flight/index.js';
import {createAirframeConfig,stepAirframe,sampleAirframe} from '../../modules/airframe/index.js';
import {createVehicle,vehiclePreset,VEHICLE_STEP} from '../../modules/vehicle3d/index.js';
import {createCockpitRig,sampleCockpitCamera,cockpitTelemetry,
  inspectCockpitSight,projectCockpitPoint,testCockpitTarget} from '../../modules/cockpit-rig/index.js';
import {Renderer,boxVertices,ringVertices} from '../../modules/render-webgl/index.js';
import {createMissileRack,missileLock,launchMissile,stepMissiles,missileSummary} from './missiles.js';

const $=id=>document.getElementById(id),canvas=$('scene'),viewport=canvas.parentElement;
const actions=new Actions(),clock=new FixedClock({step:1/120,maxFrame:.1,maxSteps:12});
const keyboard=attachKeyboard(window,actions,{bindings:{...flightBindings,KeyF:'fire',KeyM:'missile'},enabled:()=>running});
let renderer=null,scenery=null,craftMesh=null,session=null,running=false,unavailable=false,paintNeeded=true;
let lastFrame=null,lastHud=-Infinity,frameId=null,mouseYaw=0,mousePitch=0,missileRequested=false;
const mouse=attachMouseLook(canvas,{
  enabled:()=>running&&!unavailable,
  onUnlock:()=>pause('Mouse capture released; physics paused.'),
  onError:()=>notice('Mouse lock unavailable; keyboard flight controls remain active.')
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const displayDeg=n=>((n*180/Math.PI+360)%360).toFixed(0).padStart(3,'0')+'°';
function notice(message){$('notice').textContent=message;}
function resetInputs(){keyboard.clear();actions.clear();mouse.release();mouseYaw=0;mousePitch=0;missileRequested=false;}
function rigOptions(kind){
  const air=kind==='air',car=kind==='car';
  return {
    seat:air?[0,.68,.65]:car?[0,.58,.65]:[0,.8,.4],
    nose:air?[0,.25,-3.3]:car?[0,.3,-2]:[0,.2,-3],
    chase:air?[0,3.4,13]:car?[0,2.5,9]:[0,3,12],
    external:air?[11,5,17]:car?[8,3,11]:[11,5,15],
    guns:air?[[-3.2,-.35,-1.5],[3.2,-.35,-1.5]]:car?[[0,.1,-1.8]]:[[-2.2,0,-1.5],[2.2,0,-1.5]],
    convergence:Number($('convergence').value),fov:1.05
  };
}
function createSession(kind){
  if(!['air','space','car'].includes(kind))throw RangeError('unknown cockpit demo');
  const setup={kind,rig:createCockpitRig(rigOptions(kind)),ticks:0,shots:0,hits:0,throttle:Number($('throttle').value)/100};
  if(kind==='air'){
    setup.body=createBody({position:[0,160,40],velocity:[0,0,-55],mass:2600,
      inertia:[14000,18000,10000],halfSize:2.3});
    setup.airframe=createAirframeConfig();
    setup.target=[0,160,-185];setup.targetRadius=4;
  }else if(kind==='space'){
    setup.body=createBody({position:[0,120,40],velocity:[0,0,-12],mass:1500,
      inertia:[8000,8000,5000],halfSize:1.5});
    setup.flight=flightConfig({assisted:false,acceleration:14,angularAcceleration:2});
    setup.target=[0,120,-190];setup.targetRadius=5;
  }else{
    setup.vehicle=createVehicle(vehiclePreset('arcade'));
    setup.body=setup.vehicle.spawn({position:[0,.8,40]});
    setup.world={sampleSurface(x,z,maxY){return maxY>=0?{height:0,normal:[0,1,0],friction:1,surfaceId:'test-asphalt'}:null;},barriers:[]};
    setup.target=[0,1,-65];setup.targetRadius=2.4;
  }
  // Game-owned missile rack. Road vehicles intentionally cannot launch.
  setup.missiles=kind==='car'?null:createMissileRack({
    mounts:kind==='air'?[[-3.2,-.65,-1.8],[3.2,-.65,-1.8]]:
      [[-2.2,-.4,-1.8],[2.2,-.4,-1.8]]
  });
  setup.previous={position:[...setup.body.position],orientation:[...setup.body.orientation]};
  return setup;
}
function boxesFor(kind){
  const parts=[];
  function box(center,size,color){parts.push({center,size,color});}
  if(kind==='space'){
    const r=seededRandom(1983),colours=[[.20,.37,.50],[.31,.30,.48],[.35,.35,.40]];
    for(let i=0;i<85;i++){const x=(r()-.5)*450,y=120+(r()-.5)*230,z=(r()-.5)*650-140;
      if(Math.hypot(x,y-120,z-40)<35)continue;
      box([x,y,z],[2+r()*7,2+r()*7,2+r()*7],colours[i%3]);}
    box([0,119,-240],[18,2,12],[.13,.47,.5]);box([0,124,-240],[4,10,4],[.3,.65,.66]);
  }else if(kind==='air'){
    // Original low-poly landscape and 1940s-inspired proving-ground arrangement.
    for(let ix=-3;ix<=3;ix++)for(let iz=-4;iz<=2;iz++)
      box([ix*95, -1, iz*100-120],[95,2,100],[(ix+iz+20)%2?.22:.29,.33+(ix%3)*.04,.19]);
    box([0,.05,-100],[24,.12,400],[.29,.29,.31]);
    for(const x of [-60,60])for(const z of [-160,-300])box([x,9,z],[25,18,19],[.43,.35,.26]);
    for(let i=0;i<8;i++)box([-350+i*95,24,-560-i*38],[85,48,75],[.27,.35,.28]);
  }else{
    box([0,-1,-90],[180,2,450],[.16,.31,.24]);
    box([0,.04,-90],[18,.08,360],[.24,.24,.29]);
    for(const x of [-19,19])for(let i=0;i<12;i++){
      box([x,2,35-i*28],[.6,4,.6],[.57,.61,.55]);
      box([x,4.3,35-i*28],[2,.35,1.1],[.74,.64,.36]);
    }
    for(const x of [-64,64])for(const z of [-125,-245])
      box([x,10,z],[20,20,25],[.23,.37,.39]);
  }
  return parts;
}
function craftParts(kind){
  if(kind==='air')return [
    {center:[0,0,0],size:[1.5,1.4,9],color:[.65,.67,.52]},
    {center:[0,-.1,-.4],size:[13,.22,2.2],color:[.51,.58,.43]},
    {center:[0,.5,2.8],size:[4,.2,1.5],color:[.52,.59,.43]},
    {center:[0,1.05,.3],size:[.9,.55,2],color:[.28,.42,.48]},
    {center:[0,0,-4.7],size:[.16,3.5,.16],color:[.9,.75,.46]}
  ];
  if(kind==='car')return [
    {center:[0,0,0],size:[1.95,1.0,4.4],color:[.80,.38,.22]},
    {center:[0,.65,.15],size:[1.52,.6,2.1],color:[.25,.49,.58]},
    {center:[-.85,-.35,-1.15],size:[.35,.7,.65],color:[.06,.08,.1]},
    {center:[.85,-.35,-1.15],size:[.35,.7,.65],color:[.06,.08,.1]},
    {center:[-.85,-.35,1.15],size:[.35,.7,.65],color:[.06,.08,.1]},
    {center:[.85,-.35,1.15],size:[.35,.7,.65],color:[.06,.08,.1]}
  ];
  return [
    {center:[0,0,0],size:[1.5,1.1,8],color:[.37,.68,.76]},
    {center:[0,0,-.2],size:[8,.35,2],color:[.24,.54,.66]},
    {center:[0,.9,.8],size:[1,.65,2.2],color:[.25,.40,.55]},
    {center:[0,1,2.5],size:[3,.25,1],color:[.25,.53,.60]}
  ];
}
function buildScene(){
  if(!renderer)return;
  renderer.clearMeshes();
  const world=boxesFor(session.kind),solid=[];
  for(const b of world)boxVertices(b.center,b.size,b.color,solid);
  scenery=renderer.mesh(solid);
  const ring=ringVertices(session.target,session.targetRadius,[1,.57,.38],48);
  const outer=ringVertices(session.target,session.targetRadius*1.4,[.35,.72,.7],48);
  scenery.ring=renderer.mesh(ring.concat(outer),'lines');
  craftMesh=renderer.mesh([]);
  scenery.missileTrails=renderer.mesh([],'lines');
}
function reset(){
  pause('Physics reset. Choose Launch to start again.');
  session=createSession($('craft').value);clock.reset();lastFrame=null;
  $('convergence-value').textContent=session.rig.convergence+' m';
  $('throttle-value').textContent=Math.round(session.throttle*100)+'%';
  $('mode-name').textContent={air:'PROP FIGHTER',space:'SPACE INTERCEPTOR',car:'ROAD TEST COUPE'}[session.kind];
  $('last-shot').textContent='NO SHOTS';$('status').textContent='READY';$('start').disabled=false;
  $('missile').disabled=true;
  buildScene();paintNeeded=true;notice('Original proving ground reset. Model and sight convergence are independent of rendering.');
}
function pause(reason='Physics paused.'){
  if(!running)return;
  running=false;clock.setPaused(true);resetInputs();lastFrame=null;paintNeeded=true;
  $('status').textContent='PAUSED';$('pause').disabled=true;$('start').disabled=false;
  $('missile').disabled=true;notice(reason);
}
function start(){
  if(unavailable)return;
  resetInputs();running=true;clock.setPaused(false);lastFrame=null;
  $('status').textContent='RUNNING';$('start').disabled=true;$('pause').disabled=false;
  $('missile').disabled=session.kind==='car';
  canvas.focus({preventScroll:true});notice('Simulation running at fixed 120 Hz. Aim with the orange reflector sight; F tests true gun rays.');
}
function reloadRig(){
  if(!session)return;
  session.rig=createCockpitRig(rigOptions(session.kind));
  $('convergence-value').textContent=session.rig.convergence+' m';paintNeeded=true;
}
function shot(){
  if(!running||!session)return;
  const results=testCockpitTarget(session.body,session.rig,session.target,session.targetRadius);
  const hits=results.filter(x=>x.hit).length;
  session.shots++;session.hits+=hits;
  $('last-shot').textContent='SHOT '+session.shots+' / '+hits+' OF '+results.length+' RAYS HIT';
  notice(hits?('Physical intersection confirmed: '+hits+' gun rays hit the test target.'):'Missed. Adjust heading, convergence or flight path; the camera does not change the rays.');
  paintNeeded=true;
}
function fireMissile(){
  if(!running||!session?.missiles)return;
  const result=launchMissile(session.missiles,session.body,
    {center:session.target,radius:session.targetRadius});
  session.missiles=result.rack;
  if(result.status==='launched'){
    $('last-shot').textContent='MISSILE '+result.id+' AWAY';
    notice('TOO CLOSE FOR GUNS — SWITCHING TO MISSILES!');
  }else{
    notice('MISSILE '+result.status.toUpperCase().replaceAll('-',' ')+
      '. No ammunition consumed.');
  }
  paintNeeded=true;
}
function update(dt){
  const b=session.body,cmd=actions.flight();
  session.previous={position:[...b.position],orientation:[...b.orientation]};
  const head=mouse.consume();mouseYaw=clamp(mouseYaw+head.yaw,-1.4,1.4);
  mousePitch=clamp(mousePitch+head.pitch,-1.1,1.1);
  if(actions.consume('fire'))shot();
  const launchRequested=missileRequested||actions.consume('missile');
  missileRequested=false;
  if(launchRequested)fireMissile();
  const delta=-cmd.thrust[2]; // W = +1, S = -1
  if(session.kind!=='car'){
    session.throttle=clamp(session.throttle+delta*dt*.35,0,1);
    if(session.kind==='space')stepFlight(b,{thrust:[cmd.thrust[0],cmd.thrust[1],-session.throttle],
      turn:cmd.turn,brake:cmd.brake},dt,session.flight);
    else stepAirframe(b,{throttle:session.throttle,pitch:cmd.turn[0],yaw:cmd.turn[1],roll:cmd.turn[2]},dt,session.airframe);
  }else{
    const throttle=Math.max(0,delta),brake=Math.max(0,-delta);
    session.body=session.vehicle.step(b,{throttle,brake,steer:cmd.thrust[0]},session.world,dt);
    session.throttle=throttle;
    if(session.body.needsRecovery){pause('Vehicle needs recovery after leaving the bounded dynamics envelope. Reset the test.');}
  }
  // Missile state is advanced only on accepted physics ticks; never in paint().
  if(session.missiles){
    const advance=stepMissiles(session.missiles,
      {center:session.target,radius:session.targetRadius},dt);
    session.missiles=advance.rack;
    for(const impact of advance.events){
      if(impact.type==='hit'){
        $('last-shot').textContent='MISSILE '+impact.id+' IMPACT';
        notice('TARGET HIT — THIS IS DEFINITELY HOW THE MOVIE WENT.');
      }else{
        $('last-shot').textContent='MISSILE '+impact.id+' EXPIRED';
      }
    }
  }
  session.ticks++;
  if(session.kind==='air'&&session.body.position[1]<4)pause('The aircraft has approached terrain. Landing collision is intentionally not simulated; reset the test.');
  if(session.kind==='space'&&Math.hypot(...session.body.position)>1700)pause('Inertial test range exceeded. Reset to start again.');
}
function craftGeometry(pose){
  const data=[];
  for(const part of craftParts(session.kind)){
    const local=boxVertices(part.center,part.size,part.color);
    for(let i=0;i<local.length;i+=6){
      const world=add(pose.position,rotate(pose.orientation,local.slice(i,i+3)));
      data.push(...world,local[i+3],local[i+4],local[i+5]);
    }
  }
  return data;
}
const deg=rad=>(rad*180/Math.PI).toFixed(1)+'°';
function marker(id,projection){
  const el=$(id);
  if(!projection?.visible||projection.x< -100||projection.y< -100||
      projection.x>canvas.clientWidth+100||projection.y>canvas.clientHeight+100){el.style.display='none';return;}
  el.style.display='block';el.style.left=projection.x+'px';el.style.top=projection.y+'px';
}
function paint(alpha=1){
  if(!renderer||!session||unavailable)return;
  const b=session.body,p={position:mix(session.previous.position,b.position,alpha),
    orientation:quatInterpolate(session.previous.orientation,b.orientation,alpha),
    velocity:[...b.velocity],angularVelocity:[...b.angularVelocity]};
  const mode=$('view').value;
  const cam=sampleCockpitCamera(p,session.rig,mode,{yaw:mouseYaw,pitch:mousePitch});
  try{
    renderer.begin(cam.position,cam.orientation,{fog:session.kind==='space'?.001:.003,resolution:1,fov:cam.fov});
    renderer.draw(scenery);
    renderer.draw(scenery.ring);
    if(mode==='chase'||mode==='external'){renderer.update(craftMesh,craftGeometry(p));renderer.draw(craftMesh);}
    // Tracers are presentation-only; physics snapshots own the trajectories.
    const lines=[];
    for(const missile of session.missiles?.active??[]){
      const tail=missile.position.map((x,i)=>x-missile.direction[i]*5);
      lines.push(...tail,1,.55,.16,...missile.position,1,.94,.48);
    }
    renderer.update(scenery.missileTrails,lines);
    if(lines.length)renderer.draw(scenery.missileTrails);
  }catch(error){unavailable=true;pause('Graphics unavailable: '+error.message);notice(error.message);return;}
  viewport.classList.toggle('cockpit',mode==='cockpit');
  const viewportSize={width:canvas.clientWidth,height:canvas.clientHeight};
  const compare=inspectCockpitSight(p,session.rig,cam,{range:Number($('distance').value),...viewportSize});
  marker('sight',compare.reticle);
  marker('left-hit',compare.impacts[0]?.screen);
  marker('right-hit',compare.impacts[1]?.screen);
  $('right-hit').textContent=compare.impacts.length===1?'':'R';
  marker('world-target',projectCockpitPoint(cam,session.target,viewportSize));
  const maxError=Math.max(...compare.impacts.map(v=>v.errorMetres));
  $('sight-error').textContent='BORESIGHT '+compare.range+' m | MAX ERROR '+maxError.toFixed(3)+' m';
  const telemetry=cockpitTelemetry(b);
  $('speed').textContent=telemetry.speed.toFixed(1)+' m/s';
  $('altitude').textContent=telemetry.altitude.toFixed(1)+' m';
  $('vertical').textContent=telemetry.verticalSpeed.toFixed(1)+' m/s';
  $('heading').textContent=displayDeg(telemetry.heading);
  $('bank').textContent=deg(telemetry.bank);
  if(session.kind==='air'){
    const air=sampleAirframe(b,session.airframe);
    $('aero').textContent=deg(air.angleOfAttack)+' / '+air.loadFactor.toFixed(2)+'g'+(air.stalled?' STALL':'');
  }else if(session.kind==='car')$('aero').textContent='RPM '+Math.round(b.rpm)+' / G '+b.gear;
  else $('aero').textContent='INERTIAL / 6DOF';
  if(session.missiles){
    const summary=missileSummary(session.missiles);
    const lock=missileLock(b,{center:session.target,radius:session.targetRadius});
    $('missile-ammo').textContent=summary.ammo+' / 4';
    $('missile-hits').textContent=String(summary.hits);
    $('missile-status').textContent=summary.cooldownTicks>0?'COOLDOWN '+summary.cooldownTicks+' TICKS':
      lock.locked?'MISSILE LOCK '+Math.round(lock.distance)+' m':lock.reason.toUpperCase().replaceAll('-',' ');
    $('missile').disabled=!running||summary.ammo===0;
  }else{
    $('missile-ammo').textContent='N/A';
    $('missile-hits').textContent='0';
    $('missile-status').textContent='MISSILES OFFLINE / ROAD';
    $('missile').disabled=true;
  }
  $('throttle').value=Math.round(session.throttle*100);
  $('throttle-value').textContent=Math.round(session.throttle*100)+'%';
}
function animate(time){
  const elapsed=lastFrame===null?0:Math.max(0,(time-lastFrame)/1000);lastFrame=time;
  if(running){
    try{const result=clock.advance(elapsed,update);paint(result.alpha);}
    catch(error){pause('Simulation guard rejected this state: '+error.message);}
  }else if(paintNeeded){paint(1);paintNeeded=false;}
  if(time-lastHud>1000){lastHud=time;document.documentElement.dataset.labReady=unavailable?'failed':'cockpit-physics';}
  frameId=requestAnimationFrame(animate);
}
$('start').onclick=start;$('pause').onclick=()=>pause();$('reset').onclick=reset;
$('fire').onclick=shot;
$('missile').onclick=()=>{if(running&&session?.missiles)missileRequested=true;};
$('craft').onchange=()=>{reset();};
$('view').onchange=()=>{mouseYaw=0;mousePitch=0;paintNeeded=true;};
$('convergence').oninput=reloadRig;
$('distance').oninput=()=>{$('distance-value').textContent=$('distance').value+' m';paintNeeded=true;};
$('throttle').oninput=()=>{if(session)session.throttle=Number($('throttle').value)/100;
  $('throttle-value').textContent=$('throttle').value+'%';paintNeeded=true;};
window.addEventListener('blur',()=>pause('Window focus lost; all controls released.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Hidden tab: physics paused and inputs cancelled.');});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();unavailable=true;pause('WebGL context lost. Reload to restore.');});
window.addEventListener('pagehide',()=>{pause('Page hidden.');cancelAnimationFrame(frameId);renderer?.dispose();});
try{renderer=new Renderer(canvas);clock.setPaused(true);session=createSession('air');buildScene();paintNeeded=true;
  notice('Original Spitfire-inspired demo ready. Select Launch to begin.');frameId=requestAnimationFrame(animate);}
catch(error){unavailable=true;notice('Graphics unavailable: '+error.message);$('start').disabled=true;document.documentElement.dataset.labReady='failed';}
