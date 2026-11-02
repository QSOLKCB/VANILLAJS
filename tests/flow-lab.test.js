import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlowLab,stepFlowLab,orderFlowLab,toggleFlowGate,toggleFlowExit,setFlowBudget} from '../demos/rts-lab/flow-worlds.js';
import {FixedClock} from '../modules/time/index.js';
const dt=1/120,advance=(s,n)=>{for(let i=0;i<n;i++)stepFlowLab(s,dt);};
const snapshot=s=>({units:s.units,elapsed:s.elapsed,phase:s.phase,expanded:s.job.expanded,status:s.job.status,generation:s.generation,samples:s.samples});
function safe(s){
  const active=s.units.filter(u=>!u.done);assert.equal(new Set(active.map(u=>u.cell.join(','))).size,active.length);
  for(const u of active)assert.ok(s.grid.walkable(u.cell));
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)assert.ok(Math.hypot(...active[i].position.map((v,k)=>v-active[j].position[k]))>.49,'active unit circles must remain separated');
  assert.ok(s.lastSlice<=s.buildBudget);if(s.field){assert.equal(s.field.grid,s.grid);assert.equal(s.publishedGeneration,s.generation);}
}
for(const kind of ['flow','evacuation'])test(`${kind} delivers the complete group without overlaps or per-unit A* searches`,()=>{
  const s=createFlowLab(kind);
  for(let i=0;i<5000&&s.arrived<s.units.length;i++){stepFlowLab(s,dt);safe(s);}
  assert.equal(s.arrived,s.units.length);assert.equal(s.generation,1);assert.equal(s.job.status,'ready');assert.ok(s.job.expanded<=384);assert.ok(s.samples>s.job.expanded);
  if(kind==='evacuation'){assert.ok(s.exitCounts['21,3']>0);assert.ok(s.exitCounts['21,12']>0);}
});
test('replacing a partial build cancels old work and preserves in-flight positions',()=>{
  const s=createFlowLab();setFlowBudget(s,1);advance(s,5);const first=s.job,units=structuredClone(s.units);assert.equal(orderFlowLab(s,[20,10]),true);
  assert.equal(first.status,'cancelled');assert.equal(first.step().processed,0);assert.equal(s.field,null);assert.deepEqual(s.units,units);
  advance(s,400);assert.equal(s.job.status,'ready');assert.deepEqual(s.field.goals,[[20,10]]);const positions=s.units.map(u=>[...u.position]);
  orderFlowLab(s,[21,8]);assert.deepEqual(s.units.map(u=>u.position),positions);assert.equal(s.field,null);
});
test('gate edits immediately invalidate fields and rebuild against the new grid',()=>{
  const s=createFlowLab();advance(s,40);const old=s.field;assert.ok(old);assert.equal(toggleFlowGate(s),true);assert.equal(s.field,null);assert.notEqual(old.grid,s.grid);
  for(let i=0;i<5000&&s.arrived<s.units.length;i++){stepFlowLab(s,dt);safe(s);assert.ok(s.units.filter(u=>!u.done).every(u=>u.cell.join(',')!=='8,4'));}
  assert.equal(s.arrived,24);assert.equal(s.publishedGeneration,2);
});
test('occupied gates and gate destinations reject closure without changing the field job',()=>{
  const s=createFlowLab();orderFlowLab(s,[8,4]);const job=s.job;assert.equal(toggleFlowGate(s),false);assert.equal(s.job,job);
  orderFlowLab(s,[21,8]);for(let i=0;i<2000&&!s.units.some(u=>u.cell.join(',')==='8,4');i++)stepFlowLab(s,dt);
  assert.ok(s.units.some(u=>u.cell.join(',')==='8,4'));assert.equal(toggleFlowGate(s),false);assert.equal(s.gateOpen,true);
});
test('closing the north exit redirects all units through the remaining exit',()=>{
  const s=createFlowLab('evacuation');advance(s,10);const old=s.job;toggleFlowExit(s);assert.equal(old.status,'cancelled');assert.deepEqual(s.goals,[[21,12]]);
  for(let i=0;i<6000&&s.arrived<s.units.length;i++){stepFlowLab(s,dt);safe(s);}
  assert.equal(s.arrived,36);assert.equal(s.exitCounts['21,12'],36);assert.equal(s.exitCounts['21,3'],undefined);
  toggleFlowExit(s);assert.equal(s.northExitOpen,true);assert.equal(s.field,null);
});
test('blocked destination orders preserve work and accepted goals; unreachable units stay safe',()=>{
  const s=createFlowLab();advance(s,5);const job=s.job,goals=structuredClone(s.goals);assert.equal(orderFlowLab(s,[8,7]),false);assert.equal(s.job,job);assert.deepEqual(s.goals,goals);
  const trapped=createFlowLab();trapped.grid=trapped.grid.withBlocked([[8,4],[8,11]]);orderFlowLab(trapped,[21,8]);advance(trapped,300);safe(trapped);
  assert.equal(trapped.arrived,0);assert.equal(trapped.waiting,24);assert.equal(trapped.field.sample(trapped.units[0].cell).status,'unreachable');
});
test('pause freezes partial builds and movement; zero or invalid ticks cannot advance work',()=>{
  const s=createFlowLab();setFlowBudget(s,1);advance(s,5);const before=structuredClone(snapshot(s)),clock=new FixedClock();clock.setPaused(true);
  clock.advance(9,dt=>stepFlowLab(s,dt));stepFlowLab(s,0);for(const n of [-1,Infinity,.1])assert.throws(()=>stepFlowLab(s,n));assert.deepEqual(snapshot(s),before);
  for(const n of [0,65,NaN,1.5])assert.throws(()=>setFlowBudget(s,n));assert.equal(s.buildBudget,1);
  const reset=createFlowLab();assert.equal(reset.job.expanded,0);assert.equal(reset.arrived,0);assert.equal(reset.elapsed,0);
});
test('build chunk choices produce the same completed field and all units arrive',()=>{
  for(const budget of [1,8,64]){const s=createFlowLab();setFlowBudget(s,budget);advance(s,3000);assert.equal(s.arrived,24);assert.equal(s.field.sample([2,2]).cost,31);}
});
test('30/60/144 Hz schedules preserve build slices, gate edits, traffic and exit counts',()=>{
  const runs=[30,60,144].map(hz=>{const s=createFlowLab('evacuation'),clock=new FixedClock();
    for(let i=0;i<hz*15;i++)clock.advance(1/hz,dt=>{if(clock.ticks===40)toggleFlowExit(s);stepFlowLab(s,dt);});
    return {...snapshot(s),exitCounts:s.exitCounts,arrived:s.arrived,buildSlices:s.buildSlices};});
  assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[1],runs[2]);
});
