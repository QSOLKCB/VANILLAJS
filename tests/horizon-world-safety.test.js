// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession,raceWorldSafety} from '../demos/horizon-lab/race-model.js';
import {directionalDriveControls} from '../demos/horizon-lab/drive-input.js';
const project=starterRaceProject();
test('world safety preserves the accepted raised road and native vehicle state',()=>{
  const session=createRaceSession(project),before=structuredClone(session.player);
  assert.equal(raceWorldSafety(session),null);
  const at=session.road.sample(180,-2);
  const sample={...session,player:{...session.player,position:[...at.position]},progress:{offRoad:false}};
  assert.equal(raceWorldSafety(sample),null,'a real raised bridge is not an under-map error');
  assert.deepEqual(session.player,before);
});
test('reverse exit is detected despite no native rollover flag, and recovery does not award gates',()=>{
  const session=createRaceSession(project);session.start();
  for(let i=0;i<360;i++)session.step({});
  let reason=null,at=-1;
  for(let i=0;i<1100;i++){
    session.step(directionalDriveControls(session.player,{reverse:1}));
    reason=raceWorldSafety(session);
    if(reason){at=i;break;}
  }
  assert.equal(reason,'BEHIND_START');
  assert.ok(at>0&&at<700,'must detect rear boundary before an under-map excursion');
  assert.equal(session.player.needsRecovery,false,'original physics did not flag this');
  assert.equal(session.progress.checkpointIndex,0);
  assert.equal(session.recover(),true);
  assert.equal(session.progress.recoveries,1);
  assert.equal(session.progress.penaltySeconds,project.race.recoveryPenaltySeconds);
  assert.equal(session.player.gear,1);
  assert.equal(raceWorldSafety(session),null);
});
test('world safety detects genuine penetration beneath the rendered terrain triangle',()=>{
  const race=createRaceSession(project),x=0,z=0;let ceiling=2000,terrain;
  for(let i=0;i<6;i++){
    const hit=race.world.physics.sampleSurface(x,z,ceiling);if(!hit)break;
    if(hit.surfaceId.startsWith('terrain:')){terrain=hit;break;}
    ceiling=hit.height-.02;
  }
  assert.ok(terrain,'expected actual terrain under starting road');
  const state={...race.player,position:[x,terrain.height-2,z]};
  const testCase={player:state,world:race.world,rows:race.rows,progress:{offRoad:false}};
  assert.equal(raceWorldSafety(testCase),'UNDER_TERRAIN');
  assert.equal(raceWorldSafety({...testCase,player:{...state,position:[x,terrain.height+.8,z]}}),null);
});
test('invalid safety inputs reject without mutating accepted vehicle physics',()=>{
  const race=createRaceSession(project),before=structuredClone(race.player);
  assert.throws(()=>raceWorldSafety(race,'untrusted'));
  assert.throws(()=>raceWorldSafety({player:{position:[0,NaN,0]},world:race.world,rows:race.rows}));
  assert.deepEqual(race.player,before);
});
