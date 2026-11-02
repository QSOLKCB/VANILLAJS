import test from 'node:test';
import assert from 'node:assert/strict';
import {NavigationGrid,FlowFieldSearch,findPath} from '../modules/navigation/index.js';
import {seededRandom} from '../modules/math/index.js';
const grid=(options={})=>new NavigationGrid({width:10,height:8,...options});
function build(g,goals,chunk=8){const job=new FlowFieldSearch(g,goals);while(job.status==='building'){const r=job.step(chunk);assert.ok(r.processed<=chunk);}return job;}
test('incremental field respects each expansion budget and publishes only a complete result',()=>{
  const g=grid(),job=new FlowFieldSearch(g,[[9,7]]);assert.equal(job.result,null);assert.equal(job.status,'building');
  const a=job.step(3);assert.equal(a.processed,3);assert.equal(a.expanded,3);assert.equal(job.result,null);
  while(job.status==='building')job.step(3);assert.equal(job.expanded,80);assert.equal(job.pending,0);
  assert.deepEqual(job.step(3),{status:'ready',processed:0,expanded:80,pending:0});assert.equal(job.result.grid,g);
});
test('field samples distinguish obstacles, unreachable space, goals and metric directions',()=>{
  const g=grid({cellSize:2,blocked:Array.from({length:8},(_,z)=>[5,z])}),field=build(g,[[8,4]]).result;
  assert.deepEqual(field.sample([8,4]),{status:'goal',cost:0,next:null,direction:[0,0],goal:[8,4]});
  const q=field.sample([6,4]);assert.equal(q.cost,4);assert.deepEqual(q.next,[7,4]);assert.deepEqual(q.direction,[1,0]);
  assert.equal(field.sample([5,4]).status,'blocked');assert.equal(field.sample([-1,4]).status,'blocked');assert.equal(field.sample([2,4]).status,'unreachable');
  assert.throws(()=>field.sample([NaN,0]));
});
test('multi-source ties use row-major goals regardless of goal order, duplicates or chunk sizes',()=>{
  const g=grid(),goals=[[9,4],[1,4]],fields=[1,7,65536].map(chunk=>build(g,[...goals.toReversed(),goals[0]],chunk).result);
  for(let z=0;z<8;z++)for(let x=0;x<10;x++){assert.deepEqual(fields[0].sample([x,z]),fields[1].sample([x,z]));assert.deepEqual(fields[1].sample([x,z]),fields[2].sample([x,z]));}
  assert.deepEqual(fields[0].sample([5,4]).goal,[1,4]);assert.deepEqual(fields[0].goals,[[1,4],[9,4]]);
  const reverse=build(g,goals,3).result;assert.deepEqual(reverse.sample([5,4]),fields[0].sample([5,4]));
});
test('all samples match independent A* distances on 40 seeded multi-goal maps',()=>{
  const rng=seededRandom(701),w=11,h=9,goals=[[0,0],[10,8]];
  for(let n=0;n<40;n++){
    const blocked=[];for(let z=0;z<h;z++)for(let x=0;x<w;x++)if(rng()<.27&&!goals.some(c=>c[0]===x&&c[1]===z))blocked.push([x,z]);
    const g=new NavigationGrid({width:w,height:h,blocked}),field=build(g,goals,13).result;
    for(let z=0;z<h;z++)for(let x=0;x<w;x++){
      const c=[x,z],q=field.sample(c);if(!g.walkable(c)){assert.equal(q.status,'blocked');continue;}
      const routes=goals.map(goal=>({goal,...findPath(g,c,goal)})).filter(r=>r.status==='found').sort((a,b)=>a.cost-b.cost||a.goal[1]-b.goal[1]||a.goal[0]-b.goal[0]);
      if(!routes.length){assert.equal(q.status,'unreachable');continue;}
      assert.equal(q.cost,routes[0].cost);assert.deepEqual(q.goal,routes[0].goal);
      if(q.next){assert.equal(Math.abs(q.direction[0])+Math.abs(q.direction[1]),1);const next=field.sample(q.next);assert.equal(next.cost,q.cost-1);assert.deepEqual(next.goal,q.goal);}
    }
  }
});
test('following the field reaches a nearest goal without loops or cutting corners',()=>{
  const g=grid({blocked:[[4,0],[4,1],[4,2],[4,3],[4,4],[4,5]]}),f=build(g,[[8,2],[8,6]]).result;
  let c=[1,1],q=f.sample(c),steps=0;const cost=q.cost,seen=new Set();
  while(q.next){assert.ok(!seen.has(c.join(',')));seen.add(c.join(','));c=q.next;assert.ok(g.walkable(c));q=f.sample(c);steps++;}
  assert.equal(q.status,'goal');assert.equal(steps,cost);
});
test('field goal inputs and sample arrays cannot mutate the job or published field',()=>{
  const g=grid(),goals=[[8,7]],job=new FlowFieldSearch(g,goals);goals[0][0]=0;
  while(job.status==='building')job.step();const f=job.result,q=f.sample([1,1]);q.next[0]=999;q.direction[0]=999;q.goal[0]=999;
  assert.deepEqual(f.goals,[[8,7]]);assert.ok(f.sample([1,1]).next[0]<10);assert.throws(()=>{f.goals[0][0]=0;});assert.throws(()=>{job.status='ready';});
  job.cancel();assert.equal(job.status,'ready');assert.equal(job.result,f);
});
test('a cancelled partial build cannot publish or resume; invalid budgets do no work',()=>{
  const job=new FlowFieldSearch(grid(),[[9,7]]);job.step(5);
  for(const n of [0,-1,1.2,Infinity,65537])assert.throws(()=>job.step(n));assert.equal(job.expanded,5);assert.equal(job.result,null);
  job.cancel();assert.equal(job.status,'cancelled');assert.equal(job.pending,0);assert.equal(job.result,null);assert.equal(job.step(10).processed,0);assert.equal(job.expanded,5);
});
test('blocked goals reject the whole request while malformed goals throw before any work',()=>{
  const g=grid({blocked:[[2,2]]});for(const goals of [[[0,0],[2,2]],[[10,0]]]){
    const job=new FlowFieldSearch(g,goals);assert.equal(job.status,'blocked');assert.equal(job.result,null);assert.equal(job.step().processed,0);assert.equal(job.expanded,0);
  }
  for(const goals of [[],Array(257).fill([0,0]),null,[[0,0],[NaN,1]],[[1.2,3]]])assert.throws(()=>new FlowFieldSearch(g,goals));assert.throws(()=>new FlowFieldSearch({},[[0,0]]));
});
test('terrain edits leave old fields unchanged and require a new grid-specific build',()=>{
  const g=grid(),old=build(g,[[9,4]]).result,edited=g.withBlocked(Array.from({length:8},(_,z)=>[5,z]));
  const fresh=build(edited,[[9,4]]).result;assert.equal(old.sample([0,4]).status,'reachable');assert.equal(fresh.sample([0,4]).status,'unreachable');assert.notEqual(old.grid,edited);assert.equal(fresh.grid,edited);
});
test('maximum-size grid settles every reachable cell at most once',()=>{
  const g=new NavigationGrid({width:256,height:256}),job=build(g,[[255,255]],257);assert.equal(job.expanded,65536);assert.equal(job.result.sample([0,0]).cost,510);
});
