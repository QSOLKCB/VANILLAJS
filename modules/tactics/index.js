// SPDX-License-Identifier: Apache-2.0
// TACTICS-001: bounded, turn-based squad orders and real cover intelligence.
// SENSE-001 owns LOS; NavigationGrid/findPath own route decisions.
// No timers, renderer, damage, cloud, imported assets or hidden hit chance.
import {createSightWorld,querySight} from '../sensing/index.js';
import {NavigationGrid,findPath} from '../navigation/index.js';

export const TACTICS_LIMITS=Object.freeze({
  width:32,height:24,cover:24,units:12,searchCells:768,
  coverSteps:5,cellMetres:4,sightRange:40
});
const data=new WeakMap(),states=new WeakMap(),ID=/^[a-z][a-z0-9-]{0,31}$/;
const HEADINGS=Object.freeze([[0,-1],[-1,0],[1,0],[0,1]]);
const freeze=x=>{
  if(x&&typeof x==='object'&&!Object.isFrozen(x)){
    for(const v of Object.values(x))freeze(v);
    Object.freeze(x);
  }
  return x;
};
function record(v,keys,label){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))
    throw TypeError(label+' must be an ordinary data record');
  const d=Object.getOwnPropertyDescriptors(v),found=Reflect.ownKeys(d);
  if(found.length!==keys.length||found.some(k=>
    typeof k!=='string'||!keys.includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value')))
    throw TypeError(label+' must have exact data-only fields');
  return d;
}
function array(v,min,max,label){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||
    v.length<min||v.length>max||Reflect.ownKeys(v).length!==v.length+1)
    throw TypeError(label+' must be a bounded dense plain array');
  const d=Object.getOwnPropertyDescriptors(v);
  return Array.from({length:v.length},(_,i)=>{
    if(!d[i]||!d[i].enumerable||!Object.hasOwn(d[i],'value'))
      throw TypeError(label+' has an accessor/hole');
    return d[i].value;
  });
}
const number=(v,lo,hi,label)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)
    throw RangeError(label+' outside bounds');
  return v;
};
const integer=(v,lo,hi,label)=>{
  number(v,lo,hi,label);
  if(!Number.isSafeInteger(v))throw RangeError(label+' requires integer');
  return v;
};
function ident(v,label,ids){
  if(typeof v!=='string'||!ID.test(v)||ids.has(v))
    throw TypeError(label+' needs unique lowercase slug');
  ids.add(v);return v;
}
function cell(value,width,height,label){
  const [x,z]=array(value,2,2,label);
  return freeze([integer(x,0,width-1,label+' x'),integer(z,0,height-1,label+' z')]);
}
function direction(value){
  const [x,z]=array(value,2,2,'heading');
  if(!HEADINGS.some(h=>h[0]===x&&h[1]===z))
    throw RangeError('heading must be a cardinal unit direction');
  return freeze([x,z]);
}
const key=([x,z])=>x+','+z;
const side=(a,b)=>a.team!==b.team;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const manhattan=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
function worldPoint(pos,meters,eye=1.7){
  return [(pos[0]+.5)*meters,eye,-(pos[1]+.5)*meters];
}
function worldInfo(world){
  const result=data.get(world);
  if(!result)throw TypeError('createTacticsWorld result required');
  return result;
}
function check(world,state){
  const w=worldInfo(world);
  if(states.get(state)!==world)throw TypeError('foreign or forged tactical state');
  return w;
}
const sightWorld=(w,target)=>createSightWorld({blockers:w.blockers,targets:[{
  id:target.id,position:worldPoint(target.cell,w.cellMetres)
}]});
function inspectSight(w,source,target,backend='indexed',fov=Math.PI*5/6){
  const result=querySight(sightWorld(w,target),{
    position:worldPoint(source.cell,w.cellMetres),
    direction:[source.heading[0],0,-source.heading[1]]
  },{range:TACTICS_LIMITS.sightRange,fov,backend});
  return result[0];
}
function viewOf(w,units,id,backend){
  const observer=units.find(u=>u.id===id);
  if(!observer)throw RangeError('unknown squad actor');
  const target=units.filter(u=>side(u,observer)).map(u=>({
    id:u.id,position:worldPoint(u.cell,w.cellMetres)
  }));
  const sight=createSightWorld({blockers:w.blockers,targets:target});
  return querySight(sight,{
    position:worldPoint(observer.cell,w.cellMetres),
    direction:[observer.heading[0],0,-observer.heading[1]]
  },{range:TACTICS_LIMITS.sightRange,fov:Math.PI*5/6,backend});
}
/** Immutable world includes both NAV grid and canonical SENSE blocker AABBs. */
export function createTacticsWorld(input){
  const d=record(input,['width','height','cellMetres','cover','units','objective','seed'],'tactical world');
  const width=integer(d.width.value,6,TACTICS_LIMITS.width,'width'),
    height=integer(d.height.value,6,TACTICS_LIMITS.height,'height'),
    cellMetres=integer(d.cellMetres.value,1,TACTICS_LIMITS.cellMetres,'cell metres'),
    seed=integer(d.seed.value,0,0xffffffff,'seed'),
    ids=new Set(),blocked=[],blocks=[];
  for(const c of array(d.cover.value,0,TACTICS_LIMITS.cover,'cover')){
    const r=record(c,['id','x','z','w','h','height'],'cover');
    const id=ident(r.id.value,'cover ID',ids),
      x=integer(r.x.value,0,width-1,'cover x'),
      z=integer(r.z.value,0,height-1,'cover z'),
      w=integer(r.w.value,1,width-x,'cover width'),
      h=integer(r.h.value,1,height-z,'cover depth'),
      wallHeight=number(r.height.value,.2,8,'cover height');
    const cells=[];
    for(let zz=z;zz<z+h;zz++)for(let xx=x;xx<x+w;xx++){
      blocked.push([xx,zz]);cells.push([xx,zz]);
    }
    blocks.push({id,x,z,w,h,height:wallHeight,cells});
  }
  const grid=new NavigationGrid({width,height,cellSize:cellMetres,blocked}),
    units=[],occupied=new Set();
  for(const u of array(d.units.value,2,TACTICS_LIMITS.units,'units')){
    const r=record(u,['id','team','cell','heading'],'unit');
    const id=ident(r.id.value,'unit ID',ids),team=r.team.value;
    if(!['alpha','bravo'].includes(team))throw RangeError('team must be alpha or bravo');
    const pos=cell(r.cell.value,width,height,'unit cell'),heading=direction(r.heading.value);
    if(!grid.walkable(pos)||occupied.has(key(pos)))throw RangeError('units must occupy distinct walkable cells');
    occupied.add(key(pos));
    units.push({id,team,cell:pos,heading,suppression:0});
  }
  if(!units.some(u=>u.team==='alpha')||!units.some(u=>u.team==='bravo'))
    throw RangeError('scenario requires opposing teams');
  const objective=cell(d.objective.value,width,height,'objective');
  if(!grid.walkable(objective))throw RangeError('objective must be walkable');
  // The cover probe is an engine-private target identity. Never let a
  // source-provided blocker or unit occupy its synthetic sight-world ID.
  let probeId='tactics-probe',suffix=0;
  while(ids.has(probeId))probeId='tactics-probe-'+(++suffix);
  const blockers=blocks.map(b=>({id:b.id,box:{
    min:[b.x*cellMetres,0,-(b.z+b.h)*cellMetres],
    max:[(b.x+b.w)*cellMetres,b.height,-b.z*cellMetres]
  }}));
  units.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const world=freeze({width,height,cellMetres,coverCount:blocks.length,
    unitCount:units.length,objective,seed});
  data.set(world,{grid,units:freeze(units),blockers:freeze(blockers),
    cover:freeze(blocks),objective,cellMetres,seed,width,height,probeId});
  return world;
}
export function createTacticsState(world){
  const w=worldInfo(world);
  const state=freeze({turn:0,
    units:w.units.map(u=>({...u,cell:[...u.cell],heading:[...u.heading]})),
    events:[]});
  states.set(state,world);
  return state;
}
/** A camera-independent SENSE-001 report; no hidden enemy targeting. */
export function inspectTactics(world,state,{backend='indexed'}={}){
  const w=check(world,state);
  if(!['indexed','serial'].includes(backend))throw TypeError('unsupported sight backend');
  const seen=state.units.map(u=>{
    const sight=viewOf(w,state.units,u.id,backend);
    return {id:u.id,team:u.team,cell:[...u.cell],heading:[...u.heading],
      suppression:u.suppression,visibleEnemies:sight.filter(s=>s.visible).map(s=>s.id),
      reports:sight.map(s=>({id:s.id,visible:s.visible,reason:s.reason,
        occluderId:s.occluderId,distance:s.distance}))};
  });
  return freeze({turn:state.turn,units:seen});
}
function route(w,units,u,goal){
  const occupied=units.filter(x=>x.id!==u.id).map(x=>[...x.cell]),
    dynamic=w.grid.withBlocked(occupied,true);
  return findPath(dynamic,u.cell,goal,{maxExpanded:TACTICS_LIMITS.searchCells});
}
function candidates(w,units,u,maxSteps){
  const occupied=new Set(units.filter(x=>x.id!==u.id).map(x=>key(x.cell))),
    result=[],queue=[{cell:[...u.cell],steps:0}],visited=new Set([key(u.cell)]),
    enemies=units.filter(v=>side(u,v));
  for(let i=0;i<queue.length;i++){
    const at=queue[i];
    if(at.steps>0){
      let blocked=0,visible=0,anchor=null;
      const probe={id:w.probeId,cell:at.cell};
      for(const enemy of enemies){
        const seen=inspectSight(w,enemy,probe,'indexed',Math.PI*2);
        if(seen.reason==='occluded'){blocked++;anchor=anchor===null||seen.occluderId<anchor?
          seen.occluderId:anchor;}
        else if(seen.visible)visible++;
      }
      // Cover must be established by an actual AABB intersection. An enemy
      // looking away or being out of range never counts as protective cover.
      if(blocked>0&&visible===0)result.push({
        cell:at.cell,steps:at.steps,occluderId:anchor,coveredFrom:blocked,
        objectiveSteps:manhattan(at.cell,w.objective)
      });
    }
    if(at.steps>=maxSteps)continue;
    const [x,z]=at.cell;
    for(const p of [[x,z-1],[x-1,z],[x+1,z],[x,z+1]]){
      if(!w.grid.contains(p)||!w.grid.walkable(p)||occupied.has(key(p))||
        visited.has(key(p)))continue;
      visited.add(key(p));queue.push({cell:p,steps:at.steps+1});
    }
  }
  result.sort((a,b)=>a.steps-b.steps||a.objectiveSteps-b.objectiveSteps||
    a.cell[1]-b.cell[1]||a.cell[0]-b.cell[0]||
    (a.occluderId<b.occluderId?-1:a.occluderId>b.occluderId?1:0));
  return result;
}
/** Cover candidates must be reachable and occluded by physical AABB cover. */
export function queryTacticalCover(world,state,unitId,{maxSteps=TACTICS_LIMITS.coverSteps}={}){
  const w=check(world,state);
  if(typeof unitId!=='string'||!ID.test(unitId))throw TypeError('unit ID required');
  const unit=state.units.find(u=>u.id===unitId);
  if(!unit)throw RangeError('unknown unit');
  integer(maxSteps,1,TACTICS_LIMITS.coverSteps,'cover search steps');
  return freeze(candidates(w,state.units,unit,maxSteps));
}
function order(input,world,state,team){
  const d=record(input,['unitId','action','to','targetId'],'order');
  const unitId=d.unitId.value,action=d.action.value;
  if(typeof unitId!=='string'||!ID.test(unitId)||!state.units.some(u=>u.id===unitId&&u.team===team))
    throw RangeError('orders require owned team actor');
  if(!['hold','move','suppress','retreat'].includes(action))throw RangeError('unknown tactical order');
  const to=d.to.value,targetId=d.targetId.value;
  if(action==='move'){
    if(targetId!==null)throw TypeError('move has no target actor');
    const w=worldInfo(world);
    return {unitId,action,to:cell(to,w.width,w.height,'destination'),targetId:null};
  }
  if(to!==null)throw TypeError('only move carries a destination');
  if(action==='suppress'){
    if(typeof targetId!=='string'||!ID.test(targetId)||
      !state.units.some(u=>u.id===targetId&&u.team!==team))
      throw TypeError('suppression requires opposing actor ID');
  }else if(targetId!==null)throw TypeError('this order has no target');
  return {unitId,action,to:null,targetId};
}
function apply(w,units,command,events){
  const unit=units.find(u=>u.id===command.unitId);
  if(command.action==='hold'){
    events.push({unitId:unit.id,action:'hold',event:'holding'});
    return true;
  }
  if(command.action==='suppress'){
    const observation=viewOf(w,units,unit.id,'indexed').find(s=>s.id===command.targetId);
    if(!observation?.visible)return false; // no suppression of an invisible target
    const target=units.find(u=>u.id===command.targetId);
    target.suppression=Math.min(2,target.suppression+2);
    events.push({unitId:unit.id,action:'suppress',targetId:target.id,event:'visible-target'});
    return true;
  }
  const destination=command.action==='retreat'?
    candidates(w,units,unit,TACTICS_LIMITS.coverSteps)[0]?.cell:command.to;
  if(!destination){
    events.push({unitId:unit.id,action:'retreat',event:'no-verified-cover'});
    return true;
  }
  const path=route(w,units,unit,destination);
  if(path.status!=='found'||!path.path.length)return false;
  if(path.path.length>1){
    const next=path.path[1],dx=next[0]-unit.cell[0],dz=next[1]-unit.cell[1];
    unit.cell=next;unit.heading=[dx,dz];
  }
  events.push({unitId:unit.id,action:command.action,
    event:path.path.length>1?'moved':'already-there',
    destination:[...destination],at:[...unit.cell]});
  return true;
}
/** Pure, read-only deterministic AI suggestion from the current board. */
export function planTacticalOrders(world,state,team='bravo'){
  const w=check(world,state);
  if(!['alpha','bravo'].includes(team))throw TypeError('unknown team');
  // The planning copy mirrors the actual stable unit-ID execution order.
  // Preflight each proposal against occupancy and bounded A*; suggestions
  // must never deadlock a turn just because an ally holds the objective.
  // This never edits an authoritative world/state or commits any command.
  const shadow=state.units.map(u=>({...u,cell:[...u.cell],heading:[...u.heading]})),
    orders=[];
  const hold=id=>({unitId:id,action:'hold',to:null,targetId:null});
  for(const unit of shadow.filter(u=>u.team===team)){
    const visible=viewOf(w,shadow,unit.id,'indexed').filter(s=>s.visible);
    let proposal=hold(unit.id);
    if(unit.suppression>0){
      proposal={unitId:unit.id,action:'retreat',to:null,targetId:null};
    }else if(visible.length){
      // Seed only breaks equal-distance contact ties; positions and SENSE
      // ordering remain stable and reproduce from the same world seed.
      const distance=visible[0].distance,
        tied=visible.filter(v=>Math.abs(v.distance-distance)<=1e-9),
        target=tied[(w.seed+state.turn)%tied.length];
      proposal={unitId:unit.id,action:'suppress',to:null,targetId:target.id};
    }else if(key(unit.cell)!==key(w.objective)&&
      (team==='alpha'||manhattan(unit.cell,w.objective)>3)){
      // An occupied objective is not a valid A* goal, and proposed moves
      // must be checked against preceding predicted squad moves as well.
      const occupied=shadow.some(other=>other.id!==unit.id&&
        key(other.cell)===key(w.objective));
      if(!occupied){
        const found=route(w,shadow,unit,w.objective);
        if(found.status==='found'&&found.path.length>1)
          proposal={unitId:unit.id,action:'move',to:[...w.objective],targetId:null};
      }
    }
    // Simulate on the private planning copy to avoid two units reserving the
    // same next cell; the actual turn will recompute authoritative AI after
    // all accepted allied commands.
    if(!apply(w,shadow,proposal,[]))proposal=hold(unit.id);
    orders.push(proposal);
  }
  return freeze(orders);
}
/** One accepted turn, bounded commands, sorted unit IDs and seeded initial world.
 * Invalid order schema throws, unreachable/suppressed invisible-target requests
 * reject atomically. AI cannot turn unobserved targets into imaginary hits.
 */
export function stepTactics(world,state,orders){
  const w=check(world,state);
  const supplied=array(orders,0,TACTICS_LIMITS.units,'orders');
  const checked=[],seen=new Set();
  for(const o of supplied){
    const item=order(o,world,state,'alpha');
    if(seen.has(item.unitId))throw TypeError('duplicate unit order');
    seen.add(item.unitId);checked.push(item);
  }
  // Phase, victory, mission clock and objectives belong to consumers. This
  // pure module never ends a game's campaign or imposes a turn cap.
  const units=state.units.map(u=>({...u,cell:[...u.cell],heading:[...u.heading]})),
    events=[];
  // Validated, sorted player commands. Omitted actors explicitly hold.
  const byId=new Map(checked.map(o=>[o.unitId,o]));
  for(const u of units.filter(x=>x.team==='alpha')){
    const o=byId.get(u.id)??{unitId:u.id,action:'hold',to:null,targetId:null};
    if(!apply(w,units,o,events))
      return Object.freeze({state,accepted:false,reason:
        o.action==='suppress'?'target-not-visible':'unreachable'});
  }
  // Recompute opposing decisions AFTER player orders, from true SENSE rays.
  const interim=freeze({turn:state.turn,
    units:units.map(u=>({...u,cell:[...u.cell],heading:[...u.heading]})),events:[]});
  states.set(interim,world);
  const opponent=planTacticalOrders(world,interim,'bravo');
  for(const o of opponent){
    if(!apply(w,units,o,events)){
      events.push({unitId:o.unitId,action:'hold',event:'ai-path-unavailable'});
    }
  }
  for(const u of units)u.suppression=Math.max(0,u.suppression-1);
  const result=freeze({turn:state.turn+1,units,events});
  states.set(result,world);
  return Object.freeze({state:result,accepted:true,reason:'turn-accepted'});
}
