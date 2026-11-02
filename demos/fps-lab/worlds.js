// SPDX-License-Identifier: Apache-2.0
// Original demo geometry and goals. Reusable modules know no course or target rules.
import {aabb,raycast} from '../../modules/collision/index.js';
import {createCharacter,characterConfig,characterView,lookCharacter,stepCharacter,stepCharacterPlatforms} from '../../modules/character/index.js';
import {WeaponTimer} from '../../modules/weapons/index.js';
import {ProjectileSystem} from '../../modules/projectiles/index.js';
import {createInteractionResolver} from '../../modules/interactions/index.js';
import {rotate,scale,add,length,subtract} from '../../modules/math/index.js';
export const COURSES={
  course:{name:'Footwork',description:'Climb the four shallow steps, jump the amber hurdle, then pass through the narrow doorway. Reach all four markers.'},
  range:{name:'Live range',description:'Walk, aim and fire. Compare instant traces with travelling bolts. Empty a magazine, reload, and clear three target plates.'},
  lowpass:{name:'Low passage',description:'Hold C to duck through the first blue passage. Release C in the open bay to stand, then duck through the amber passage and reach the finish. A low roof keeps you crouched until there is room to stand.'},
  tracking:{name:'Tracking range',description:'The plates move sideways. Lead your travelling bolts, or switch to instant traces and aim directly at the plate. Quarter-speed helps you see the difference. Clear all three plates.'},
  lift:{name:'Clearance lift',description:'Ride the lift, hold C under the amber beam, then walk forward onto the upper deck. If headroom runs out, the lift stops while your controls stay active. Duck to continue, then stand once clear.'},
  shuttle:{name:'Shuttle run',description:'Stay aboard the shuttle across the gap. At the far dock, walk or jump forward onto the landing and reach the finish. Jumping carries the shuttle’s momentum. A fall returns you to the start.'}
};
const rules=[{id:'plate-hit',match:{source:'training',target:'plate'},
  requires:[{scope:'target',key:'alive',equals:true,code:'spent',message:'Plate already cleared. Try another target.'}],
  effects:[{type:'damage',amount:25}],reason:{code:'hit',message:'Direct hit. 25 integrity removed.'}}];
function solid(id,center,size,color=[.16,.23,.29]) {
  return {id,center,size,color,box:aabb(center.map((v,i)=>v-size[i]/2),center.map((v,i)=>v+size[i]/2))};
}
function routePosition(platform,time){
  const r=platform.route,t=((time%r.period)+r.period)%r.period;
  const amount=t<r.wait?0:t<r.wait+r.travel?(t-r.wait)/r.travel:t<r.wait+r.travel+r.dwell?1:
    Math.max(0,1-(t-r.wait-r.travel-r.dwell)/r.travel);
  return r.from.map((v,i)=>v+(r.to[i]-v)*amount);
}
function place(s,center){s.center=center;s.box=aabb(center.map((v,i)=>v-s.size[i]/2),center.map((v,i)=>v+s.size[i]/2));}
export function createFpsLab(kind='course') {
  if(!Object.hasOwn(COURSES,kind))throw new RangeError('unknown FPS course');
  const solids=[solid('floor',[0,-.5,-18],[24,1,60],[.12,.18,.23]),
    solid('left-wall',[-12.25,3,-18],[.5,6,60]),solid('right-wall',[12.25,3,-18],[.5,6,60]),
    solid('back-wall',[0,3,-48],[24,6,.5]),solid('front-wall',[0,3,12],[24,6,.5])];
  const checkpoints=kind==='course'?[{position:[0,1,-3.8],label:'STAIRS'},{position:[0,0,-15.5],label:'HURDLE'},
    {position:[0,0,-25],label:'DOORWAY'},{position:[0,0,-38],label:'FINISH'}]:kind==='lowpass'?
    [{position:[0,0,-3],label:'DUCK',crouched:true},{position:[0,0,-12],label:'STAND',crouched:false},
      {position:[0,0,-21],label:'DUCK AGAIN',crouched:true},{position:[0,0,-36],label:'FINISH',crouched:false}]:kind==='lift'?
    [{position:[0,.5,3],label:'BOARD',support:'lift',radius:.7},{position:[0,4.5,3],label:'DUCK & RISE',support:'lift',crouched:true,radius:.3},
      {position:[0,4.5,-2],label:'TRANSFER',support:'upper-deck'},{position:[0,4.5,-11],label:'FINISH',crouched:false}]:kind==='shuttle'?
    [{position:[0,2.5,7],label:'BOARD',support:'shuttle',radius:.7},{position:[0,2.5,-7],label:'RIDE',support:'shuttle'},
      {position:[0,2.5,-25],label:'DISEMBARK',support:'far-dock'},{position:[0,2.5,-35],label:'FINISH'}]:[];
  const platforms=[];
  if(kind==='course') {
    for(let i=0;i<4;i++)solids.push(solid(`stair-${i}`,[0,(i+1)*.125,3-i*1.5],[4,(i+1)*.25,1.5],[.26,.39,.47]));
    solids.push(solid('landing',[0,.5,-3.8],[4,1,3.1],[.23,.36,.43]),
      solid('hurdle',[0,.4,-12],[5,.8,.8],[.71,.41,.19]),
      solid('door-left',[-6.325,1.5,-23],[11.35,3,.6]),solid('door-right',[6.325,1.5,-23],[11.35,3,.6]),
      solid('lintel',[0,2.7,-23],[1.3,.6,.6],[.38,.53,.6]),
      solid('low-roof',[-7,1.75,-6],[4,.5,5],[.32,.34,.42]),solid('side-block',[7,1.4,-16],[3,2.8,3]));
  } else if(kind==='lowpass') {
    solids.push(solid('corridor-left',[-2.25,2,-16],[.5,4,42]),solid('corridor-right',[2.25,2,-16],[.5,4,42]),
      solid('blue-passage',[0,2.25,-2.5],[4,2,7],[.24,.43,.57]),
      solid('amber-passage',[0,2.15,-21.5],[4,2,7],[.64,.4,.22]));
  } else if(kind==='lift') {
    solids.push(solid('upper-deck',[0,2.25,-6],[8,4.5,14],[.25,.36,.43]),
      solid('clearance-beam',[0,6.4,3],[4,.8,4],[.68,.42,.22]),
      solid('lift-guide-left',[-2.4,3.2,3],[.3,6.4,4]),solid('lift-guide-right',[2.4,3.2,3],[.3,6.4,4]));
    platforms.push({...solid('lift',[0,.25,3],[4,.5,4],[.24,.61,.72]),
      route:{from:[0,.25,3],to:[0,4.25,3],wait:2,travel:4,dwell:2,period:16}});
  } else if(kind==='shuttle') {
    solids.push(solid('near-dock',[0,1.25,10],[8,2.5,2],[.25,.36,.43]),solid('far-dock',[0,1.25,-30],[8,2.5,16],[.25,.36,.43]));
    platforms.push({...solid('shuttle',[0,2.25,7],[4,.5,4],[.24,.61,.72]),
      route:{from:[0,2.25,7],to:[0,2.25,-20],wait:2,travel:8,dwell:3,period:24}});
  } else {
    solids.push(solid('cover-left',[-7,.6,-7],[3,1.2,2],[.3,.36,.4]),solid('cover-right',[7,.6,-12],[3,1.2,2],[.3,.36,.4]));
  }
  for(const p of platforms)p.previousCenter=[...p.center];
  const targets=(kind==='range'||kind==='tracking'?[0,-5,5]:kind==='course'?[7]:[]).map((x,i)=>({...solid(`plate-${i+1}`,[x,1.62,-18-i*8],[1.8,1.8,.4],[.46,.76,.91]),
    kind:'plate',health:100,alive:true,label:`Plate 0${i+1}`}));
  if(kind==='tracking')targets.forEach((target,i)=>{
    target.motion={originX:target.center[0],amplitude:i===0?4:2.5,frequency:.8+i*.2,direction:i===1?-1:1};
    target.previousCenter=[...target.center];
  });
  const spawn=kind==='lift'?[0,.5,3]:kind==='shuttle'?[0,2.5,7]:[0,0,7],character=createCharacter({position:spawn});
  return {kind,solids,targets,platforms,spawn,platformTime:0,platformDirection:1,platformBlocked:false,rescues:0,checkpoints,
    colliders:[...solids,...targets,...platforms],character,previous:characterView(character),config:characterConfig(),
    weapon:new WeaponTimer(),projectiles:new ProjectileSystem({capacity:32}),resolver:createInteractionResolver(rules),
    elapsed:0,shots:0,hits:0,cleared:0,jumps:0,steps:0,nextCheckpoint:0,complete:false,truncated:false,
    shotMode:kind==='tracking'?'bolt':'trace',history:[],tracers:[],flashes:[],lastMovement:null};
}
function receipt(session,hit,at) {
  const target=session.targets.find(t=>t.id===hit.id);
  const result=target?session.resolver.evaluate({source:{kind:'training'},target}):
    {status:'blocked',reasons:[{code:'wall',message:'Solid cover stopped the shot.'}],effects:[]};
  if(result.status==='applied') {
    session.hits++;
    for(const effect of result.effects)if(effect.type==='damage')target.health=Math.max(0,target.health-effect.amount);
    target.alive=target.health>0;
    if(!target.alive)session.cleared++;
  }
  session.history.unshift({at,label:target?.label??'World',status:result.status,message:result.reasons.map(r=>r.message).join(' ')});
  session.history.length=Math.min(session.history.length,6);session.flashes.push({at,position:hit.point,status:result.status});
}
export function focusPlate(session,id) {
  const target=session.targets.find(t=>t.id===id);if(!target)throw new RangeError('unknown plate');
  // Demo convenience: caller pauses/clears controls before repositioning.
  session.character=createCharacter({position:[target.center[0],0,7]});session.previous=characterView(session.character);
  session.projectiles.clear();session.tracers=[];session.flashes=[];
  for(const plate of session.targets)if(plate.motion)plate.previousCenter=[...plate.center];
}
export function stepFpsLab(session,input={},dt) {
  if(!Number.isFinite(dt) || dt<0 || dt>.05)throw new RangeError('FPS lab dt must be 0..0.05 seconds');
  if(dt===0 || session.complete)return [];
  lookCharacter(session.character,input.look);session.previous=characterView(session.character);
  const view=session.previous,direction=rotate(view.orientation,[0,0,-1]);
  const events=session.weapon.step(dt,{fire:input.fire,reload:input.reload});
  for(const event of events) {
    if(event.type!=='shot')continue;
    session.shots++;
    if(session.shotMode==='bolt')session.projectiles.spawn({position:view.position,velocity:scale(direction,65),lifetime:2,halfSize:.035,data:{kind:'training'}});
    else {
      const hit=raycast(view.position,direction,130,session.colliders);
      session.tracers.push({at:session.elapsed,from:[...view.position],to:hit?.point??add(view.position,scale(direction,130))});
      if(hit)receipt(session,hit,session.elapsed);
    }
  }
  // Moving training plates are shot-only colliders, never platforms or pushers.
  const bodyColliders=session.kind==='tracking'?session.solids:session.colliders;
  const command={move:input.move,jump:input.jump,sprint:input.sprint,crouch:input.crouch};
  let platformMotion=[];
  if(session.platforms.length){
    platformMotion=session.platforms.map(target=>({target,displacement:subtract(routePosition(target,session.platformTime+dt*session.platformDirection),target.center)}));
    const world=bodyColliders.map(c=>({...c,displacement:platformMotion.find(m=>m.target===c)?.displacement??[0,0,0]}));
    session.lastMovement=stepCharacterPlatforms(session.character,command,dt,session.config,world);
    session.platformBlocked=session.lastMovement.blocked;
    if(session.platformBlocked){
      // Interlock: reject the whole platform transaction, then let the player
      // duck/walk/jump against the stopped world. No partial carry is committed.
      platformMotion=[];
      session.lastMovement=stepCharacterPlatforms(session.character,command,dt,session.config,bodyColliders);
    }else session.platformTime+=dt*session.platformDirection;
  }else session.lastMovement=stepCharacter(session.character,command,dt,session.config,bodyColliders.map(c=>c.box));
  session.jumps+=Number(session.lastMovement.jumped);
  session.steps+=Number(session.lastMovement.stepped);session.truncated=session.lastMovement.truncated;
  const motion=[...platformMotion,...session.targets.filter(t=>t.motion).map(target=>{
    const m=target.motion,endX=m.originX+m.amplitude*Math.sin((session.elapsed+dt)*m.frequency)*m.direction;
    return {target,displacement:[endX-target.center[0],0,0]};
  })];
  const movingColliders=session.colliders.map(c=>({...c,displacement:motion.find(m=>m.target===c)?.displacement??[0,0,0]}));
  const impacts=motion.length?session.projectiles.stepMoving(dt,movingColliders):session.projectiles.step(dt,session.colliders);
  for(const event of impacts)if(event.type==='hit')receipt(session,event.hit,session.elapsed+event.time);
  for(const p of session.platforms)if(session.platformBlocked)p.previousCenter=[...p.center];
  for(const {target,displacement} of motion){
    target.previousCenter=[...target.center];target.center=add(target.center,displacement);
    target.box=aabb(target.center.map((v,i)=>v-target.size[i]/2),target.center.map((v,i)=>v+target.size[i]/2));
  }
  session.elapsed+=dt;
  if(session.platforms.length && session.character.position[1]<session.spawn[1]-.4){
    session.rescues++;session.platformTime=0;session.platformDirection=1;session.platformBlocked=false;session.nextCheckpoint=0;
    for(const p of session.platforms){place(p,[...p.route.from]);p.previousCenter=[...p.center];}
    session.character=createCharacter({position:session.spawn});session.previous=characterView(session.character);
    session.projectiles.clear();session.tracers=[];session.flashes=[];
  }
  session.tracers=session.tracers.filter(t=>session.elapsed-t.at<.09).slice(-16);
  session.flashes=session.flashes.filter(f=>session.elapsed-f.at<.22).slice(-32);
  const checkpoint=session.checkpoints[session.nextCheckpoint];
  if(checkpoint && length(subtract(session.character.position,checkpoint.position))<(checkpoint.radius??1.25) &&
    (checkpoint.crouched===undefined || checkpoint.crouched===session.character.crouched) &&
    (checkpoint.support===undefined || checkpoint.support===session.character.supportId))session.nextCheckpoint++;
  session.complete=session.checkpoints.length>0?session.nextCheckpoint===session.checkpoints.length:session.cleared===session.targets.length;
  return events;
}
