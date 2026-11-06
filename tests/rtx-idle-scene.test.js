// SPDX-License-Identifier: Apache-2.0
// The RTX benchmark exercises a no-input tracking scene for 90 warm-up + 240 sample frames.
// Verify the application physics cannot legitimately pause or complete in that recipe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFpsLab,stepFpsLab} from '../demos/fps-lab/worlds.js';

test('tracking scene remains RUNNING under deterministic idle fixed ticks',()=>{
  const session=createFpsLab('tracking');
  const dt=1/60;
  const idle={move:[0,0],jump:false,reload:false,fire:false,sprint:false,crouch:false,look:{yaw:0,pitch:0}};
  for(let i=0;i<420;i++){
    stepFpsLab(session,idle,dt);
    assert.equal(session.truncated,false,'collision truncated at tick '+i);
    assert.equal(session.complete,false,'no-input tracking range completed at tick '+i);
    assert.equal(session.shots,0);
    assert.equal(session.cleared,0);
  }
});
