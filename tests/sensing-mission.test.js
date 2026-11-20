// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMission,stepMission,inspectMission,missionMap,TURN_LIMIT} from '../demos/sensing-lab/mission.js';

const advance=(actions)=>{let state=createMission();const events=[];for(const action of actions){
  const next=stepMission(state,{action});state=next.state;events.push(next.event);
}return {state,events};};

test('world is original, bounded, and begins with independent visible guard diagnostics',()=>{
  const state=createMission(),map=missionMap(),sight=inspectMission(state);
  assert.equal(map.width,24);assert.equal(map.height,16);assert.equal(map.guardRoutes.length,3);
  assert.equal(state.turn,0);assert.equal(state.phase,'active');
  assert.equal(sight.threats.length,3);assert.equal(sight.seen.length,3);
  assert.ok(Object.isFrozen(state)&&Object.isFrozen(state.agent)&&Object.isFrozen(sight));
  assert.deepEqual(inspectMission(state),sight);
});
test('each accepted command advances exactly one turn; blocked moves remain atomic',()=>{
  const first=createMission(),next=stepMission(first,{action:'north'});
  assert.equal(next.accepted,true);assert.equal(next.state.turn,1);
  assert.equal(next.state.agent.z,12);assert.equal(first.turn,0);
  assert.notDeepEqual(next.state.guards,first.guards);
  const wall=advance(['north','wait','east','east','north','north','east','south','east','east','east','north','north']).state;
  assert.equal(wall.agent.x,8);assert.equal(wall.agent.z,9);
  // A concrete wall prevents an attempted west movement at x=7,z=9.
  const blocked=stepMission(wall,{action:'west'});
  assert.equal(blocked.accepted,false);assert.equal(blocked.event,'blocked');
  assert.equal(blocked.state,wall);assert.deepEqual(inspectMission(wall),inspectMission(blocked.state));
});
test('crouch changes physical eye height and guard sight, but does not teleport a player',()=>{
  const s=createMission(),next=stepMission(s,{action:'crouch'});
  assert.equal(next.state.agent.crouched,true);assert.equal(next.state.agent.x,s.agent.x);
  assert.equal(next.state.agent.z,s.agent.z);
  const standing=inspectMission(s),low=inspectMission(next.state);
  assert.equal(standing.threats.length,low.threats.length);
  assert.equal(next.state.turn,1);
});
test('an original tactical route reaches intel and extraction without any camera intervention',()=>{
  // Explicit player commands, with normal patrol movement each turn.
  // This route crosses behind cover and must be independently replayable.
  const actions='north wait east east north north east south east east east north north east crouch east east north north east east north north north north east north north east east east east east east south south east north'.split(' ');
  assert.equal(actions.length,38);
  let s=createMission();
  for(const action of actions){
    const before=s,next=stepMission(s,{action});
    assert.equal(next.accepted,true,'blocked movement '+action+' at '+before.turn);
    assert.notEqual(next.state.phase,'detected','spotted at turn '+next.state.turn+' action '+action);
    s=next.state;
  }
  assert.equal(s.turn,38);assert.equal(s.intel,true);assert.equal(s.phase,'escaped');
  assert.deepEqual([s.agent.x,s.agent.z],[21,2]);
  assert.equal(stepMission(s,{action:'wait'}).accepted,false);
  assert.deepEqual(advance(actions).state,s);
});
test('guard turn-facing can detect a waiting agent; terminal state rejects further moves',()=>{
  const s=advance(['wait','wait']).state;
  assert.equal(s.phase,'detected');
  assert.ok(inspectMission(s).exposure);
  assert.equal(stepMission(s,{action:'wait'}).event,'mission-ended');
});
test('invalid commands reject before mutation; no executable objects admitted',()=>{
  const s=createMission(),copy=structuredClone(s);
  assert.throws(()=>stepMission(s,{action:'teleport'}));
  assert.throws(()=>stepMission(s,{action:'north',extra:true}));
  let accessed=0;const malicious={};Object.defineProperty(malicious,'action',{get(){accessed++;return 'north';},enumerable:true});
  assert.throws(()=>stepMission(s,malicious));assert.equal(accessed,0);
  assert.throws(()=>inspectMission({...s}));
  assert.deepEqual(s,copy);assert.equal(TURN_LIMIT,80);
});
