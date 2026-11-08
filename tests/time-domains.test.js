// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimeDomains,stepTimeDomains} from '../modules/time-domains/index.js';
const dt=1/120;
test('independent domains preserve exact real tick count with intentional slow separation',()=>{
  let state=createTimeDomains();for(let i=0;i<240;i++)state=stepTimeDomains(state,dt,{focus:true});
  assert.ok(Math.abs(state.real-2)<1e-12);
  assert.ok(state.world<state.player&&state.player<state.weapon&&state.weapon<state.real);
  assert.ok(Math.abs(state.scale-.22)<.001);
  const slowState=state;
  for(let i=0;i<120;i++)state=stepTimeDomains(state,dt);
  assert.ok(state.scale>.99&&state.world>slowState.world);
});
test('input tape replays reproducibly and neither caller options nor prior state mutate',()=>{
  const opts={worldSlow:.25};let a=createTimeDomains(opts),b=createTimeDomains(opts);
  for(let i=0;i<1500;i++){
    const input={focus:i%19<7,dive:i%103<4};
    a=stepTimeDomains(a,dt,input);b=stepTimeDomains(b,dt,input);
  }
  assert.deepEqual(a,b);assert.deepEqual(opts,{worldSlow:.25});
  assert.equal(Object.isFrozen(a),true);assert.equal(Object.isFrozen(a.settings),true);
});
test('time domain configuration and invalid ticks reject before advancing',()=>{
  for(const v of [0,-1,1,Infinity,NaN])assert.throws(()=>createTimeDomains({worldSlow:v}));
  const a=createTimeDomains();
  for(const delta of [0,-dt,Infinity,NaN,1])assert.throws(()=>stepTimeDomains(a,delta));
  assert.throws(()=>stepTimeDomains(a,dt,{focus:1}));
  assert.equal(a.real,0);
});
