// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrajectoryWorld,queryTrajectoryLock,launchTrajectory,stepTrajectory,
 TRAJECTORY_TICK} from '../modules/trajectory/index.js';
const actor=(id,z,velocity=[0,0,0])=>({id,position:[0,0,z],velocity,halfExtents:[1,1,1]});
const world=(walls=[])=>createTrajectoryWorld({actors:[actor('pilot',0),actor('bogey',-60)],walls});
const request=()=>({ownerId:'pilot',targetId:'bogey',position:[0,0,-2],
  direction:[0,0,-1],speed:120,turnRate:5,ttlTicks:240,halfSize:.15});
const advance=(w,s,n)=>{for(let i=0;i<n;i+=64)s=stepTrajectory(w,s,Math.min(64,n-i));return s;};
test('visible physical boresight acquires lock; occlusion rejects with no shot',()=>{
 const w=world(),req=request();assert.equal(queryTrajectoryLock(w,req).locked,true);
 const blocked=world([{id:'wall',box:{min:[-3,-3,-30],max:[3,3,-28]}}]);
 const denied=launchTrajectory(blocked,req);
 assert.equal(denied.accepted,false);assert.equal(denied.reason,'occluded');
 assert.equal(denied.state,null);assert.equal(queryTrajectoryLock(blocked,req).occluderId,'wall');
 assert.equal(launchTrajectory(w,{...req,direction:[0,0,1]}).reason,'out-of-cone');
});
test('moving target uses swept actor contact and reports classification without damage',()=>{
 const w=createTrajectoryWorld({actors:[actor('pilot',0),actor('bogey',-60,[8,0,0])],walls:[]});
 const s=launchTrajectory(w,request()).state,final=advance(w,s,240);
 assert.equal(final.status,'hit');assert.equal(final.event.kind,'actor');
 assert.equal(final.event.id,'bogey');assert.ok(final.event.fraction>=0&&final.event.fraction<=1);
 assert.equal(stepTrajectory(w,final),final);
});
test('wall wins collision when it lies ahead of actor; same-time classification safe',()=>{
 const w=world([{id:'wall',box:{min:[.16,-3,-25],max:[3,3,-24]}}]);
 // The centre ray misses by .16 m; swept missile halfSize .15 m nearly touches.
 // Increase the shot radius to .2 m: contact must be physical before the actor.
 const r={...request(),halfSize:.2};
 const launched=launchTrajectory(w,r);
 assert.equal(launched.accepted,true);
 const final=advance(w,launched.state,240);
 assert.equal(final.status,'hit');assert.equal(final.event.kind,'wall');
 assert.equal(final.event.id,'wall');
});
test('split-step equality, replay and source immutability',()=>{
 const w=world(),req=request(),before=structuredClone(req);
 const a=launchTrajectory(w,req).state,b=launchTrajectory(w,req).state;
 assert.deepEqual(advance(w,a,200),advance(w,advance(w,b,50),150));
 assert.deepEqual(req,before);
 assert.equal(TRAJECTORY_TICK,1/120);
 assert.throws(()=>stepTrajectory(w,{...a}),/foreign/);
});
test('negative controls reject bad IDs, accessor records, count and malformed data',()=>{
 const w=world(),r=request();
 assert.throws(()=>launchTrajectory(w,{...r,targetId:'absent'}),/target/);
 assert.throws(()=>launchTrajectory(w,{...r,ttlTicks:1.1}),/integer/);
 assert.throws(()=>launchTrajectory(w,{...r,position:[Infinity,0,0]}),/bounds/);
 assert.throws(()=>launchTrajectory(w,{...r,get speed(){throw Error('must not evaluate');}}),/exact/);
 const s=launchTrajectory(w,r).state;
 assert.throws(()=>stepTrajectory(w,s,257),/bounded/);
 assert.throws(()=>createTrajectoryWorld({actors:[actor('x',0),actor('x',-5)],walls:[]}),/unique/);
});
