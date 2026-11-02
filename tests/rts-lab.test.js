import test from 'node:test';
import assert from 'node:assert/strict';
import {createRtsLab,orderRtsLab,stopRtsLab,toggleRtsGate,stepRtsLab} from '../demos/rts-lab/worlds.js';
import {FixedClock} from '../modules/time/index.js';
const dt=1/120,advance=(s,n)=>{for(let i=0;i<n;i++)stepRtsLab(s,dt);};
function trafficInvariant(s){
  assert.equal(new Set(s.units.map(u=>u.cell.join(','))).size,s.units.length);
  for(const u of s.units)assert.ok(s.grid.walkable(u.cell));
  for(let i=0;i<s.units.length;i++)for(let j=i+1;j<s.units.length;j++)assert.ok(Math.hypot(...s.units[i].position.map((v,k)=>v-s.units[j].position[k]))>.49,'unit circles must remain separate');
}
for(const kind of ['route','squad'])test(`${kind} completes all routes through both walls without cell or visual overlap`,()=>{
  const s=createRtsLab(kind);assert.equal(orderRtsLab(s,s.selected,[21,8]),true);
  for(let i=0;i<8000&&s.arrived<s.units.length;i++){stepRtsLab(s,dt);trafficInvariant(s);}
  assert.equal(s.arrived,s.units.length);for(const u of s.units)assert.deepEqual(u.cell,u.goal);
});
test('gate closure replans around the southern opening without crossing closed terrain',()=>{
  const s=createRtsLab();orderRtsLab(s,s.selected,[12,4]);assert.ok(s.units[0].path.some(c=>c[0]===8&&c[1]===4));
  toggleRtsGate(s);assert.equal(s.gateOpen,false);assert.ok(s.units[0].path.some(c=>c[0]===8&&c[1]===11));
  for(let i=0;i<3000;i++){stepRtsLab(s,dt);trafficInvariant(s);}assert.equal(s.arrived,1);
});
test('gate cannot close across either end of an active unit segment',()=>{
  const s=createRtsLab();orderRtsLab(s,s.selected,[12,4]);
  for(let i=0;i<1000&&!s.units.some(u=>u.cell[0]===8&&u.cell[1]===4);i++)stepRtsLab(s,dt);
  assert.equal(toggleRtsGate(s),false);assert.equal(s.gateOpen,true);
  advance(s,22);assert.equal(toggleRtsGate(s),false);advance(s,22);assert.equal(toggleRtsGate(s),true);
});
test('rejected group destinations preserve every accepted route atomically',()=>{
  const s=createRtsLab('squad');orderRtsLab(s,s.selected,[21,8]);advance(s,15);const before=structuredClone(s.units);
  assert.equal(orderRtsLab(s,s.selected,[8,7]),false);assert.equal(s.report.status,'blocked');assert.deepEqual(s.units,before);
  assert.equal(orderRtsLab(s,[],[3,3]),false);assert.throws(()=>orderRtsLab(s,['missing'],[3,3]));assert.deepEqual(s.units,before);
});
test('new orders during a segment preserve the in-flight pose, then travel to the replacement goal',()=>{
  const s=createRtsLab();orderRtsLab(s,s.selected,[12,4]);advance(s,30);const position=[...s.units[0].position];
  assert.equal(orderRtsLab(s,s.selected,[2,12]),true);assert.deepEqual(s.units[0].position,position);
  for(let i=0;i<3000;i++){stepRtsLab(s,dt);trafficInvariant(s);}assert.deepEqual(s.units[0].cell,[2,12]);assert.equal(s.arrived,1);
});
test('stop finishes at most the current segment and clears further orders',()=>{
  const s=createRtsLab();orderRtsLab(s,s.selected,[12,4]);advance(s,30);const cell=[...s.units[0].cell];stopRtsLab(s);advance(s,200);
  assert.deepEqual(s.units[0].cell,cell);assert.deepEqual(s.units[0].position,cell.map(v=>v+.5));assert.equal(s.units[0].goal,null);
});
test('head-on swaps wait and replan instead of crossing through units',()=>{
  const s=createRtsLab('squad');s.units=s.units.slice(0,2);const [a,b]=s.units;a.goal=[...b.cell];b.goal=[...a.cell];a.path=[[...a.cell],[...b.cell]];b.path=[[...b.cell],[...a.cell]];
  advance(s,30);assert.equal(s.waiting,2);assert.deepEqual(a.cell,[2,5]);assert.deepEqual(b.cell,[3,5]);
  for(let i=0;i<500;i++){stepRtsLab(s,dt);trafficInvariant(s);}
});
test('vacancy chains advance together; competing destinations resolve by stable id',()=>{
  const s=createRtsLab('squad');s.units=s.units.slice(0,2);const [a,b]=s.units;a.goal=[3,5];a.path=[[2,5],[3,5]];b.goal=[4,5];b.path=[[3,5],[4,5]];advance(s,22);
  assert.deepEqual(a.cell,[3,5]);assert.deepEqual(b.cell,[4,5]);trafficInvariant(s);
  const t=createRtsLab('squad');t.units=[t.units[0],t.units[2]].reverse();const [v,u]=t.units;
  u.path=[[2,5],[3,5]];u.goal=[3,5];v.cell=[3,6];v.from=[3,6];v.path=[[3,6],[3,5]];v.goal=[3,5];advance(t,22);
  assert.deepEqual(u.cell,[3,5]);assert.deepEqual(v.cell,[3,6]);
});
test('pause, zero and invalid steps leave routes and unit state unchanged; reset is clean',()=>{
  const s=createRtsLab('squad');orderRtsLab(s,s.selected,[21,8]);advance(s,50);const before=structuredClone(s.units),time=s.elapsed,clock=new FixedClock();clock.setPaused(true);
  clock.advance(10,step=>stepRtsLab(s,step));stepRtsLab(s,0);for(const value of [-1,NaN,1])assert.throws(()=>stepRtsLab(s,value));assert.deepEqual(s.units,before);assert.equal(s.elapsed,time);
  const reset=createRtsLab('squad');assert.equal(reset.orders,0);assert.equal(reset.elapsed,0);assert.equal(reset.gateOpen,true);assert.ok(reset.units.every(u=>u.goal===null));
});
test('30/60/144 Hz presentation schedules yield identical orders, traffic and timing',()=>{
  const results=[30,60,144].map(hz=>{const s=createRtsLab('squad'),clock=new FixedClock();orderRtsLab(s,s.selected,[21,8]);
    for(let i=0;i<hz*12;i++)clock.advance(1/hz,step=>{if(clock.ticks===200)toggleRtsGate(s);stepRtsLab(s,step);});return {units:s.units,elapsed:s.elapsed,moves:s.moves,phase:s.phase};});
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
