// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTacticsWorld,createTacticsState,inspectTactics,queryTacticalCover,
  planTacticalOrders,stepTactics,TACTICS_LIMITS} from '../modules/tactics/index.js';
import {createOperation,OPERATION} from '../demos/tactics-lab/scenario.js';
import {createSightWorld,querySight} from '../modules/sensing/index.js';
import {NavigationGrid,findPath} from '../modules/navigation/index.js';
const issue=(unitId,action='hold',to=null,targetId=null)=>({unitId,action,to,targetId});
const field=(seed=17)=>({width:8,height:8,cellMetres:2,seed,objective:[6,6],
  cover:[{id:'shield',x:3,z:2,w:1,h:1,height:3}],
  units:[
    {id:'alpha-a',team:'alpha',cell:[1,2],heading:[1,0]},
    {id:'bravo-a',team:'bravo',cell:[6,2],heading:[-1,0]}
  ]});
const openField=(seed=17)=>({width:8,height:8,cellMetres:2,seed,objective:[2,2],
  cover:[],units:[
    {id:'alpha-a',team:'alpha',cell:[2,3],heading:[0,-1]},
    {id:'bravo-a',team:'bravo',cell:[7,7],heading:[-1,0]}
  ]});
test('data-only bounded scenario and independent SENSE-001 parity',()=>{
  const {world,state}=createOperation(),map=OPERATION;
  assert.equal(world.width,26);assert.equal(world.height,18);
  assert.equal(world.unitCount,6);assert.equal(world.coverCount,10);
  assert.equal(state.turn,0);assert.equal(state.phase,'active');assert.ok(Object.isFrozen(state));
  const a=inspectTactics(world,state,{backend:'indexed'}),
    b=inspectTactics(world,state,{backend:'serial'});
  assert.deepEqual(a,b);
  assert.equal(a.units.length,6);
  assert.ok(a.units.every(u=>Object.isFrozen(u)&&u.reports.every(r=>
    ['visible','occluded','out-of-range','out-of-cone'].includes(r.reason))));
  assert.equal(JSON.stringify(inspectTactics(world,state)),JSON.stringify(a));
  assert.throws(()=>inspectTactics(world,{...state}),/foreign or forged/);
  assert.throws(()=>createTacticsState({...world}),/createTacticsWorld/);
  assert.deepEqual(map.objective,[13,3]);
});
test('physical cover requires real SENSE occlusion (not turning away)',()=>{
  const input=field(),world=createTacticsWorld(input),state=createTacticsState(world),
    report=inspectTactics(world,state),
    alpha=report.units.find(u=>u.id==='alpha-a');
  const seen=alpha.reports.find(r=>r.id==='bravo-a');
  assert.equal(seen.reason,'occluded');assert.equal(seen.occluderId,'shield');
  const covers=queryTacticalCover(world,state,'alpha-a',{maxSteps:4});
  assert.ok(covers.length>0);
  assert.ok(covers.every(c=>c.occluderId==='shield'&&c.steps<=4));
  assert.ok(covers.some(c=>c.cell[0]===2&&c.cell[1]===2));
  for(const c of covers){
    const proof=createSightWorld({blockers:[{id:'shield',box:{
      min:[6,0,-6],max:[8,3,-4]
    }}],targets:[{id:'cover-probe',position:[(c.cell[0]+.5)*2,1.7,-(c.cell[1]+.5)*2]}]});
    const result=querySight(proof,{position:[13,1.7,-5],direction:[-1,0,0]},
      {range:40,fov:2*Math.PI})[0];
    assert.equal(result.reason,'occluded');
    assert.equal(result.occluderId,'shield');
  }
  assert.ok(Object.isFrozen(covers)&&Object.isFrozen(covers[0]));
  // A turned-away guard is out-of-cone, never physical cover.
  const uncovered=createTacticsWorld({...input,cover:[]}),
    sight=inspectTactics(uncovered,createTacticsState(uncovered));
  assert.equal(sight.units[0].reports[0].visible,true);
  assert.equal(queryTacticalCover(uncovered,createTacticsState(uncovered),'alpha-a').length,0);
});
test('invisible suppression rejects an entire queued multi-unit turn atomically',()=>{
  const world=createTacticsWorld(field()),state=createTacticsState(world),source=JSON.stringify(state);
  const result=stepTactics(world,state,[issue('alpha-a','suppress',null,'bravo-a')]);
  assert.equal(result.accepted,false);
  assert.equal(result.reason,'target-not-visible');
  assert.equal(result.state,state);assert.equal(JSON.stringify(state),source);
  assert.equal(inspectTactics(world,state).turn,0);
  assert.equal(planTacticalOrders(world,state,'alpha')[0].action,'move');
});
test('visible contacts can be suppressed; no damage or kill state is invented',()=>{
  const input=field();input.cover=[];
  const world=createTacticsWorld(input),state=createTacticsState(world);
  assert.equal(inspectTactics(world,state).units[0].reports[0].visible,true);
  const action=stepTactics(world,state,[issue('alpha-a','suppress',null,'bravo-a')]);
  assert.equal(action.accepted,true);assert.equal(action.state.turn,1);
  assert.ok(action.state.events.some(e=>e.unitId==='alpha-a'&&e.action==='suppress'&&
    e.event==='visible-target'));
  assert.ok(action.state.events.some(e=>e.unitId==='bravo-a'&&e.action==='retreat'));
  const target=action.state.units.find(u=>u.id==='bravo-a');
  assert.equal(target.suppression,1);
  assert.equal(Object.hasOwn(target,'hp'),false);assert.equal(Object.hasOwn(target,'damage'),false);
  assert.equal(state.units.find(u=>u.id==='bravo-a').suppression,0);
});
test('route, blockers, occupancy and ordered action budgets cannot mutate rejected turns',()=>{
  const world=createTacticsWorld(field()),state=createTacticsState(world);
  const unreachable=stepTactics(world,state,[issue('alpha-a','move',[3,2])]);
  assert.equal(unreachable.accepted,false);
  assert.equal(unreachable.reason,'unreachable');assert.equal(unreachable.state,state);
  assert.throws(()=>stepTactics(world,state,[issue('alpha-a','warp')]));
  assert.throws(()=>stepTactics(world,state,[issue('alpha-a'),issue('alpha-a')]),/duplicate/);
  assert.throws(()=>stepTactics(world,state,[issue('bravo-a')]));
  assert.throws(()=>stepTactics(world,state,[issue('alpha-a','suppress',null,'alpha-a')]));
  assert.throws(()=>stepTactics(world,state,[issue('alpha-a','move',[8,0])]));
  assert.throws(()=>stepTactics(world,state,[{...issue('alpha-a'),extra:1}]));
  let executed=0;const bad={...issue('alpha-a')};
  Object.defineProperty(bad,'action',{get(){executed++;return 'hold';},enumerable:true});
  assert.throws(()=>stepTactics(world,state,[bad]));assert.equal(executed,0);
  assert.equal(state.turn,0);
});
test('bounded A* movement is exactly one cardinal tile; turn order deterministic',()=>{
  const world=createTacticsWorld(openField()),initial=createTacticsState(world);
  const accepted=stepTactics(world,initial,[issue('alpha-a','move',[2,2])]);
  assert.equal(accepted.accepted,true);assert.equal(accepted.state.turn,1);
  assert.deepEqual(accepted.state.units.find(u=>u.id==='alpha-a').cell,[2,2]);
  assert.equal(accepted.state.progress,1);
  const next=stepTactics(world,accepted.state,[issue('alpha-a','hold')]);
  assert.equal(next.accepted,true);
  assert.equal(next.state.phase,'secured');
  assert.equal(next.state.progress,2);
  assert.equal(stepTactics(world,next.state,[]).accepted,false);
  const nav=new NavigationGrid({width:8,height:8,cellSize:2});
  assert.deepEqual(findPath(nav,[2,3],[2,2],{maxExpanded:768}).path,[[2,3],[2,2]]);
});
test('deterministic seed is applied only to equal-range visible AI tie-breaks',()=>{
  const variant=seed=>({width:8,height:8,cellMetres:2,seed,objective:[6,6],cover:[],
    units:[
      {id:'alpha-a',team:'alpha',cell:[2,2],heading:[1,0]},
      {id:'bravo-a',team:'bravo',cell:[3,1],heading:[-1,0]},
      {id:'bravo-b',team:'bravo',cell:[3,3],heading:[-1,0]}
    ]});
  const one=createTacticsWorld(variant(0)),two=createTacticsWorld(variant(1));
  const a=planTacticalOrders(one,createTacticsState(one),'alpha');
  const b=planTacticalOrders(two,createTacticsState(two),'alpha');
  assert.equal(a[0].action,'suppress');
  assert.notEqual(a[0].targetId,b[0].targetId);
  assert.deepEqual(a,planTacticalOrders(one,createTacticsState(one),'alpha'));
});
test('two independently created worlds replay 32 turns byte-identically',()=>{
  const first=createOperation(17),second=createOperation(17);
  let a=first.state,b=second.state;const log=[];
  for(let i=0;i<32;i++){
    const proposed=planTacticalOrders(first.world,a,'alpha'),
      alphaA=stepTactics(first.world,a,proposed),
      alphaB=stepTactics(second.world,b,proposed);
    assert.equal(alphaA.accepted,alphaB.accepted);
    assert.equal(alphaA.reason,alphaB.reason);
    assert.deepEqual(alphaA.state,alphaB.state);
    if(!alphaA.accepted)break;
    log.push(proposed);a=alphaA.state;b=alphaB.state;
    assert.deepEqual(inspectTactics(first.world,a),inspectTactics(second.world,b));
    if(a.phase!=='active')break;
  }
  let replay=createTacticsState(first.world);
  for(const orders of log)replay=stepTactics(first.world,replay,orders).state;
  assert.deepEqual(replay,a);
  assert.ok(Object.isFrozen(replay));
});
test('malicious/sparse input, coordinate budgets and blockers reject before state',()=>{
  const s=field(),malicious={...s},u={...s.units[0]};
  let calls=0;Object.defineProperty(u,'cell',{enumerable:true,get(){calls++;return [1,2];}});
  malicious.units=[u,s.units[1]];
  assert.throws(()=>createTacticsWorld(malicious));assert.equal(calls,0);
  assert.throws(()=>createTacticsWorld({...s,cover:[,s.cover[0]]}));
  assert.throws(()=>createTacticsWorld({...s,units:[s.units[0],s.units[0]]}));
  assert.throws(()=>createTacticsWorld({...s,objective:[3,2]}));
  assert.throws(()=>createTacticsWorld({...s,seed:Infinity}));
  assert.throws(()=>createTacticsWorld({...s,width:100}));
  assert.throws(()=>createTacticsWorld({...s,cellMetres:20}));
  assert.throws(()=>createTacticsWorld({...s,extra:1}));
  const world=createTacticsWorld(s),state=createTacticsState(world);
  assert.throws(()=>queryTacticalCover(world,state,'alpha-a',{maxSteps:6}));
  assert.throws(()=>queryTacticalCover(world,state,'missing'));
  assert.throws(()=>inspectTactics(world,state,{backend:'imaginary'}));
  assert.equal(TACTICS_LIMITS.coverSteps,5);
});
