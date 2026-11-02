// SPDX-License-Identifier: Apache-2.0
// Original demo geometry and goals. Reusable modules know no course or target rules.
import {aabb,raycast} from '../../modules/collision/index.js';
import {createCharacter,characterConfig,characterView,lookCharacter,stepCharacter} from '../../modules/character/index.js';
import {WeaponTimer} from '../../modules/weapons/index.js';
import {ProjectileSystem} from '../../modules/projectiles/index.js';
import {createInteractionResolver} from '../../modules/interactions/index.js';
import {rotate,scale,add,length,subtract} from '../../modules/math/index.js';
export const COURSES={
  course:{name:'Footwork',description:'Climb the four shallow steps, jump the amber hurdle, then pass through the narrow doorway. Reach all four markers.'},
  range:{name:'Live range',description:'Walk, aim and fire. Compare instant traces with travelling bolts. Empty a magazine, reload, and clear three target plates.'},
  lowpass:{name:'Low passage',description:'Hold C to duck through the first blue passage. Release C in the open bay to stand, then duck through the amber passage and reach the finish. A low roof keeps you crouched until there is room to stand.'},
  tracking:{name:'Tracking range',description:'The plates move sideways. Lead your travelling bolts, or switch to instant traces and aim directly at the plate. Quarter-speed helps you see the difference. Clear all three plates.'}
};
const rules=[{id:'plate-hit',match:{source:'training',target:'plate'},
  requires:[{scope:'target',key:'alive',equals:true,code:'spent',message:'Plate already cleared. Try another target.'}],
  effects:[{type:'damage',amount:25}],reason:{code:'hit',message:'Direct hit. 25 integrity removed.'}}];
function solid(id,center,size,color=[.16,.23,.29]) {
  return {id,center,size,color,box:aabb(center.map((v,i)=>v-size[i]/2),center.map((v,i)=>v+size[i]/2))};
}
export function createFpsLab(kind='course') {
  if(!Object.hasOwn(COURSES,kind))throw new RangeError('unknown FPS course');
  const solids=[solid('floor',[0,-.5,-18],[24,1,60],[.12,.18,.23]),
    solid('left-wall',[-12.25,3,-18],[.5,6,60]),solid('right-wall',[12.25,3,-18],[.5,6,60]),
    solid('back-wall',[0,3,-48],[24,6,.5]),solid('front-wall',[0,3,12],[24,6,.5])];
  const checkpoints=kind==='course'?[{position:[0,1,-3.8],label:'STAIRS'},{position:[0,0,-15.5],label:'HURDLE'},
    {position:[0,0,-25],label:'DOORWAY'},{position:[0,0,-38],label:'FINISH'}]:kind==='lowpass'?
    [{position:[0,0,-3],label:'DUCK',crouched:true},{position:[0,0,-12],label:'STAND',crouched:false},
      {position:[0,0,-21],label:'DUCK AGAIN',crouched:true},{position:[0,0,-36],label:'FINISH',crouched:false}]:[];
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
  } else {
    solids.push(solid('cover-left',[-7,.6,-7],[3,1.2,2],[.3,.36,.4]),solid('cover-right',[7,.6,-12],[3,1.2,2],[.3,.36,.4]));
  }
  const targets=(kind==='range'||kind==='tracking'?[0,-5,5]:kind==='lowpass'?[]:[7]).map((x,i)=>({...solid(`plate-${i+1}`,[x,1.62,-18-i*8],[1.8,1.8,.4],[.46,.76,.91]),
    kind:'plate',health:100,alive:true,label:`Plate 0${i+1}`}));
  if(kind==='tracking')targets.forEach((target,i)=>{
    target.motion={originX:target.center[0],amplitude:i===0?4:2.5,frequency:.8+i*.2,direction:i===1?-1:1};
    target.previousCenter=[...target.center];
  });
  const character=createCharacter({position:[0,0,7]});
  return {kind,solids,targets,checkpoints,colliders:[...solids,...targets],character,previous:characterView(character),config:characterConfig(),
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
  session.lastMovement=stepCharacter(session.character,{move:input.move,jump:input.jump,sprint:input.sprint,crouch:input.crouch},dt,session.config,bodyColliders.map(c=>c.box));
  session.jumps+=Number(session.lastMovement.jumped);
  session.steps+=Number(session.lastMovement.stepped);session.truncated=session.lastMovement.truncated;
  const motion=session.targets.filter(t=>t.motion).map(target=>{
    const m=target.motion,endX=m.originX+m.amplitude*Math.sin((session.elapsed+dt)*m.frequency)*m.direction;
    return {target,displacement:[endX-target.center[0],0,0]};
  });
  const movingColliders=session.colliders.map(c=>({...c,displacement:motion.find(m=>m.target===c)?.displacement??[0,0,0]}));
  const impacts=motion.length?session.projectiles.stepMoving(dt,movingColliders):session.projectiles.step(dt,session.colliders);
  for(const event of impacts)if(event.type==='hit')receipt(session,event.hit,session.elapsed+event.time);
  for(const {target,displacement} of motion){
    target.previousCenter=[...target.center];target.center=add(target.center,displacement);
    target.box=aabb(target.center.map((v,i)=>v-target.size[i]/2),target.center.map((v,i)=>v+target.size[i]/2));
  }
  session.elapsed+=dt;
  session.tracers=session.tracers.filter(t=>session.elapsed-t.at<.09).slice(-16);
  session.flashes=session.flashes.filter(f=>session.elapsed-f.at<.22).slice(-32);
  const checkpoint=session.checkpoints[session.nextCheckpoint];
  if(checkpoint && length(subtract(session.character.position,checkpoint.position))<1.25 &&
    (checkpoint.crouched===undefined || checkpoint.crouched===session.character.crouched))session.nextCheckpoint++;
  session.complete=session.checkpoints.length>0?session.nextCheckpoint===session.checkpoints.length:session.cleared===session.targets.length;
  return events;
}
