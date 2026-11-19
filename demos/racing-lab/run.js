// SPDX-License-Identifier: Apache-2.0
import {createRace,stepRace,STEP} from './world.js';
export function runReceipt(world,inputs){
  const {mode,player,track,tick}=world;
  const touring=mode==='retro'||mode==='tour';
  const version=touring&&(world.difficulty!=='classic'||track!==null)?2:1;
  return {schemaVersion:version,kind:'qsol.vanillajs.racing.run.v'+version,
    mode,step:STEP,...(version===2?{difficulty:world.difficulty,track,firstTick:tick-inputs.length}:{}),inputs,
    observation:{tick,elapsed:world.elapsed,result:world.result,position:{x:player.x,y:player.y,z:player.z},
      health:player.health,contacts:world.contacts,score:world.score}};
}
// Consume a data-only parsed run receipt. Legacy authored tours require the original track.
export function replayTourRun(record,legacyTrack=null){
  const version=record?.schemaVersion;
  if(![1,2].includes(version)||record.kind!=='qsol.vanillajs.racing.run.v'+version||
    !['retro','tour'].includes(record.mode)||record.step!==STEP||!Array.isArray(record.inputs)||
    record.inputs.length>36000||record.observation?.tick!==record.inputs.length)
    throw TypeError('Complete supported touring run required');
  if(version===2&&(record.firstTick!==0||typeof record.difficulty!=='string'||!Object.hasOwn(record,'track')))
    throw TypeError('Complete version 2 configuration required');
  const world=createRace(record.mode,version===1?legacyTrack:record.track,version===1?'classic':record.difficulty);
  for(const input of record.inputs){
    if(!input||typeof input!=='object'||!Number.isFinite(input.throttle)||Math.abs(input.throttle)>1||
      !Number.isFinite(input.steer)||Math.abs(input.steer)>1||typeof input.boost!=='boolean'||world.finished)
      throw TypeError('Invalid recorded touring input');
    stepRace(world,input);
  }
  return world;
}
