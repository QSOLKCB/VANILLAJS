// SPDX-License-Identifier: Apache-2.0
// Game-owned orders and traffic policy; the navigation module only plans routes.
import {NavigationGrid,findPath,formationSlots} from '../../modules/navigation/index.js';
export const RTS_RECIPES={route:'Route planner',squad:'Squad orders'};
const key=c=>c.join(','),same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
export function createRtsLab(kind='route'){
  if(!Object.hasOwn(RTS_RECIPES,kind))throw new RangeError('unknown RTS recipe');
  const blocked=[];
  for(let z=0;z<16;z++)for(let x=0;x<24;x++)if(x===0||x===23||z===0||z===15||
    (x===8&&z!==4&&z!==11)||(x===15&&z!==11)||(x>=18&&x<=20&&z>=4&&z<=6))blocked.push([x,z]);
  const starts=kind==='route'?[[3,4]]:[[2,5],[3,5],[2,6],[3,6],[2,7],[3,7]];
  const units=starts.map((cell,i)=>({id:`U${i+1}`,cell:[...cell],from:[...cell],position:cell.map(v=>v+.5),previous:cell.map(v=>v+.5),path:[[...cell]],goal:null,waits:0}));
  return {kind,grid:new NavigationGrid({width:24,height:16,blocked}),units,selected:units.map(u=>u.id),phase:0,elapsed:0,
    gateOpen:true,orders:0,arrived:0,waiting:0,moves:0,report:{status:'ready',expanded:0,cost:0},message:'Choose a destination on the map.',cellSeconds:.18};
}
function selectedUnits(s,ids){
  if(!Array.isArray(ids)||ids.some(id=>!s.units.some(u=>u.id===id)))throw new TypeError('unknown unit id');
  return s.units.filter(u=>ids.includes(u.id)).sort(byId);
}
function navigationWorld(s,units){
  // Reserve both ends of unselected in-flight segments for order planning.
  return s.grid.withBlocked(s.units.filter(u=>!units.includes(u)).flatMap(u=>[u.cell,u.from]));
}
export function orderRtsLab(s,ids,anchor){
  const units=selectedUnits(s,ids);if(!units.length){s.message='Select a unit first.';return false;}
  const grid=navigationWorld(s,units),slots=formationSlots(grid,anchor,units.length);let expanded=slots.expanded,cost=0;
  const reject=status=>{s.report={status,expanded,cost:0};s.message=status==='blocked'?'That cell is blocked. Choose open ground.':status==='budget'?'Search limit reached. Choose a nearer destination.':'No complete route. Existing orders are preserved.';return false;};
  if(slots.status!=='found')return reject(slots.status);
  const available=slots.slots,plans=[];
  for(const unit of units){
    available.sort((a,b)=>distance(unit.cell,a)-distance(unit.cell,b)||a[1]-b[1]||a[0]-b[0]);
    const goal=available.shift();if(expanded>=4096)return reject('budget');
    const route=findPath(grid,unit.cell,goal,{maxExpanded:4096-expanded});expanded+=route.expanded;
    if(route.status!=='found')return reject(route.status);
    cost+=route.cost;plans.push({unit,goal,path:route.path});
  }
  for(const {unit,goal,path} of plans)Object.assign(unit,{goal,path,waits:0});
  s.orders++;s.report={status:'found',expanded,cost};s.message=`Order ${s.orders}: ${units.length} ${units.length===1?'unit':'units'} routed. Run routes to advance.`;return true;
}
export function stopRtsLab(s,ids=s.selected){for(const u of selectedUnits(s,ids))Object.assign(u,{goal:null,path:[[...u.cell]],waits:0});s.message='Selected units will stop at the end of their current cell move.';}
export function toggleRtsGate(s){
  const gate=[8,4];if(s.gateOpen&&s.units.some(u=>same(u.cell,gate)||same(u.from,gate))){s.message='Gate occupied. Let the unit clear it first.';return false;}
  s.gateOpen=!s.gateOpen;s.grid=s.grid.withBlocked([gate],!s.gateOpen);
  for(const u of s.units){
    if(!u.goal)continue;const r=findPath(s.grid,u.cell,u.goal);u.path=r.status==='found'?r.path:[[...u.cell]];u.waits=0;
  }
  s.message=s.gateOpen?'North gate open. Routes recalculated.':'North gate closed. Routes use the south passage.';return true;
}
function advanceCells(s){
  const units=[...s.units].sort(byId),occupants=new Map(units.map(u=>[key(u.cell),u])),proposals=new Map(),destinations=new Set();
  for(const u of units){
    u.from=[...u.cell];
    if(u.goal&&u.waits>=6){
      const occupied=units.filter(v=>v!==u).map(v=>v.cell),r=findPath(s.grid.withBlocked(occupied),u.cell,u.goal);
      if(r.status==='found')u.path=r.path;u.waits=0;
    }
    const next=u.path[1];if(!next||!s.grid.walkable(next)||distance(next,u.cell)!==1)continue;
    if(!destinations.has(key(next))){destinations.add(key(next));proposals.set(u,next);}
  }
  // A chain can move into a vacancy; a cycle (including head-on swaps) waits.
  const accepted=new Map(),visiting=new Set();
  function canMove(u){
    if(accepted.has(u))return accepted.get(u);if(visiting.has(u)||!proposals.has(u))return false;
    visiting.add(u);const occupant=occupants.get(key(proposals.get(u))),ok=!occupant||canMove(occupant);visiting.delete(u);accepted.set(u,ok);return ok;
  }
  for(const u of units)canMove(u);
  for(const u of units){
    if(accepted.get(u)){u.cell=[...proposals.get(u)];u.path.shift();u.waits=0;s.moves++;}
    else if(u.goal&&!same(u.cell,u.goal))u.waits++;
  }
}
export function stepRtsLab(s,dt){
  if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('RTS dt must be 0..0.05 seconds');if(dt===0)return;
  for(const u of s.units)u.previous=[...u.position];
  s.elapsed+=dt;s.phase+=dt/s.cellSeconds;
  if(s.phase>=1){s.phase-=1;advanceCells(s);}
  for(const u of s.units)u.position=u.from.map((v,i)=>v+.5+(u.cell[i]-v)*s.phase);
  s.arrived=s.units.filter(u=>u.goal&&same(u.cell,u.goal)&&same(u.from,u.cell)).length;
  s.waiting=s.units.filter(u=>u.waits>0).length;
}
