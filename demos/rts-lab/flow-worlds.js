// SPDX-License-Identifier: Apache-2.0
import {FlowFieldSearch} from '../../modules/navigation/index.js';
import {createRtsLab} from './worlds.js';
import {reserveTraffic} from './traffic.js';
export const FLOW_RECIPES={flow:'Flow convoy',evacuation:'Two-exit evacuation'};
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export function createFlowLab(kind='flow'){
  if(!Object.hasOwn(FLOW_RECIPES,kind))throw new RangeError('unknown flow recipe');
  const s=createRtsLab('route');s.kind=kind;
  if(kind==='evacuation')s.grid=s.grid.withBlocked([[15,4]],false);
  const rows=kind==='flow'?[3,4,5,6]:[2,3,4,10,11,12];
  s.units=rows.flatMap(z=>Array.from({length:6},(_,i)=>[i+1,z])).map((cell,i)=>({id:`U${String(i+1).padStart(2,'0')}`,cell:[...cell],from:[...cell],position:cell.map(v=>v+.5),previous:cell.map(v=>v+.5),path:[],goal:null,waits:0,done:false,exit:null}));
  Object.assign(s,{selected:[],goals:kind==='flow'?[[21,8]]:[[21,3],[21,12]],northExitOpen:true,field:null,job:null,
    generation:0,publishedGeneration:0,buildBudget:8,buildSlices:0,lastSlice:0,samples:0,exitCounts:{},cellSeconds:.12});
  rebuild(s);return s;
}
function rebuild(s){
  s.job?.cancel();s.generation++;s.field=null;s.job=new FlowFieldSearch(s.grid,s.goals);s.buildSlices=0;s.lastSlice=0;
  s.report={status:s.job.status,expanded:0,cost:0};s.message='Run routes to build the shared field. Units wait for a complete map.';
}
export function setFlowBudget(s,value){
  if(!Number.isInteger(value)||value<1||value>64)throw new RangeError('demo field budget must be 1..64');s.buildBudget=value;
}
export function orderFlowLab(s,anchor){
  if(s.kind!=='flow'){s.message='This evacuation uses the two marked exits. Close the north exit to redirect the group.';return false;}
  if(!s.grid.walkable(anchor)){s.message='That destination is blocked. The current field is preserved.';return false;}
  s.goals=[[...anchor]];s.orders++;rebuild(s);return true;
}
export function toggleFlowGate(s){
  if(s.gateOpen&&s.goals.some(c=>same(c,[8,4]))){s.message='The gate is the destination. Move the depot before closing it.';return false;}
  const gate=[8,4];if(s.gateOpen&&s.units.some(u=>!u.done&&(same(u.cell,gate)||same(u.from,gate)))){s.message='Gate occupied. Let the unit clear it first.';return false;}
  s.gateOpen=!s.gateOpen;s.grid=s.grid.withBlocked([gate],!s.gateOpen);rebuild(s);return true;
}
export function toggleFlowExit(s){
  if(s.kind!=='evacuation')return false;
  s.northExitOpen=!s.northExitOpen;s.goals=s.northExitOpen?[[21,3],[21,12]]:[[21,12]];rebuild(s);return true;
}
function advanceFlow(s){
  const active=s.units.filter(u=>!u.done);
  for(const u of active)u.from=[...u.cell];
  if(!s.field||s.field.grid!==s.grid||s.publishedGeneration!==s.generation){for(const u of active)u.waits=0;return;}
  const queries=new Map(active.map(u=>{s.samples++;return [u,s.field.sample(u.cell)];}));
  for(const [u,q] of queries)if(q.status==='goal'){
    u.done=true;u.exit=[...q.goal];u.waits=0;const key=q.goal.join(',');s.exitCounts[key]=(s.exitCounts[key]??0)+1;
  }
  const remaining=active.filter(u=>!u.done),accepted=reserveTraffic(remaining,u=>queries.get(u).next);
  for(const u of remaining){
    if(accepted.has(u)){u.cell=[...accepted.get(u)];u.waits=0;s.moves++;}
    else u.waits++;
  }
}
export function stepFlowLab(s,dt){
  if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('RTS dt must be 0..0.05 seconds');if(dt===0)return;
  for(const u of s.units)u.previous=[...u.position];s.elapsed+=dt;
  s.lastSlice=0;
  if(s.job.status==='building'){
    const progress=s.job.step(s.buildBudget);s.lastSlice=progress.processed;s.buildSlices++;s.report={status:progress.status,expanded:progress.expanded,cost:0};
    if(progress.status==='ready'){
      s.field=s.job.result;s.publishedGeneration=s.generation;s.message='Shared field ready. Units follow the arrows and wait for clear cells.';
    }
  }
  s.phase+=dt/s.cellSeconds;if(s.phase>=1){s.phase-=1;advanceFlow(s);}
  for(const u of s.units)u.position=u.from.map((v,i)=>v+.5+(u.cell[i]-v)*s.phase);
  s.arrived=s.units.filter(u=>u.done).length;s.waiting=s.units.filter(u=>!u.done&&u.waits>0).length;
  if(s.arrived===s.units.length)s.message='All units delivered. Reset to run the experiment again.';
}
