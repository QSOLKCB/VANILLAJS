// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession,raceWorldSafety} from '../demos/horizon-lab/race-model.js';
import {locateOnRoad} from '../demos/horizon-lab/race-course.js';
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
test('looping custom road cannot trigger start recovery far along its route',()=>{
  const custom=structuredClone(project);
  // Validated course that returns across the infinite plane of its first
  // tangent, more than 300 m along the authored road.
  const knots=[[0,0],[0,-80],[80,-80],[80,0],[80,80],[80,160]];
  custom.scenery.road=knots.map(([x,z],i)=>({id:'loop-'+i,x,y:4,z,width:16,bank:0,structure:'ground',surface:'asphalt'}));
  const session=createRaceSession(custom),x=92,z=80;
  const hit=session.world.physics.sampleSurface(x,z,2000),y=(hit?.height??0)+2;
  const player={...session.player,position:[x,y,z]};
  const nearest=locateOnRoad(session.road,player.position,session.rows);
  assert.ok(nearest.distance>200,'the vehicle is near a late course segment');
  assert.equal(raceWorldSafety({player,world:session.world,road:session.road,rows:session.rows,progress:{offRoad:true}}),null,
    'a valid late-course position must not cause an unjust checkpoint recovery');
  const startExit={...player,position:[0,y,20]};
  assert.equal(raceWorldSafety({player:startExit,world:session.world,road:session.road,rows:session.rows,progress:{offRoad:true}}),'BEHIND_START',
    'a genuine reverse escape from this same course must still be caught');
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
