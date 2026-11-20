// SPDX-License-Identifier: Apache-2.0
// Original TACTICS-001 playable scenario, not a game rule or engine default.
import {createTacticsWorld,createTacticsState} from '../../modules/tactics/index.js';

export const OPERATION=Object.freeze({
  width:26,height:18,cellMetres:2,seed:17,objective:Object.freeze([13,3]),
  cover:Object.freeze([
    Object.freeze({id:'west-bulkhead',x:8,z:2,w:1,h:10,height:3.8}),
    Object.freeze({id:'east-bulkhead',x:16,z:5,w:1,h:9,height:3.8}),
    Object.freeze({id:'relay-shield',x:11,z:6,w:4,h:1,height:3}),
    Object.freeze({id:'western-crates',x:4,z:8,w:2,h:2,height:2.4}),
    Object.freeze({id:'middle-bunker',x:11,z:11,w:3,h:2,height:3.6}),
    Object.freeze({id:'east-crates',x:20,z:10,w:2,h:2,height:2.4}),
    Object.freeze({id:'south-barrier',x:6,z:14,w:4,h:1,height:3}),
    Object.freeze({id:'north-storage',x:20,z:1,w:3,h:1,height:2.6}),
    Object.freeze({id:'relay-cabinet',x:13,z:1,w:2,h:1,height:2.2}),
    Object.freeze({id:'west-supply',x:3,z:4,w:2,h:1,height:2.1})
  ]),
  units:Object.freeze([
    Object.freeze({id:'alpha-lead',team:'alpha',cell:Object.freeze([2,13]),heading:Object.freeze([1,0])}),
    Object.freeze({id:'alpha-scout',team:'alpha',cell:Object.freeze([3,15]),heading:Object.freeze([1,0])}),
    Object.freeze({id:'alpha-support',team:'alpha',cell:Object.freeze([2,16]),heading:Object.freeze([1,0])}),
    Object.freeze({id:'bravo-east',team:'bravo',cell:Object.freeze([22,8]),heading:Object.freeze([-1,0])}),
    Object.freeze({id:'bravo-north',team:'bravo',cell:Object.freeze([20,4]),heading:Object.freeze([-1,0])}),
    Object.freeze({id:'bravo-south',team:'bravo',cell:Object.freeze([19,15]),heading:Object.freeze([-1,0])})
  ])
});
export function createOperation(seed=OPERATION.seed){
  const world=createTacticsWorld({...OPERATION,seed});
  return {world,state:createTacticsState(world)};
}

/** Quiet Relay's objective policy lives in this demo, NOT the squad engine.
 * A different game can reuse stepTactics without inheriting these win rules.
 */
export const RELAY_TURN_LIMIT=64;
export const RELAY_HOLD_TURNS=2;
export function createRelayStatus(){
  return Object.freeze({phase:'active',progress:0});
}
export function advanceRelayStatus(previous,tactical,objective=OPERATION.objective,turnLimit=RELAY_TURN_LIMIT){
  if(!previous||previous.phase!=='active')throw RangeError('relay status is terminal');
  if(!tactical||!Number.isSafeInteger(tactical.turn)||tactical.turn<1||
      !Array.isArray(tactical.units))throw TypeError('accepted tactical turn required');
  if(!Array.isArray(objective)||objective.length!==2||
      !objective.every(Number.isSafeInteger))throw TypeError('valid relay objective required');
  if(!Number.isSafeInteger(turnLimit)||turnLimit<1||turnLimit>100000)
    throw RangeError('relay turn cap must be bounded');
  const atTarget=u=>u.cell[0]===objective[0]&&u.cell[1]===objective[1],
    held=tactical.units.some(u=>u.team==='alpha'&&atTarget(u)&&u.suppression===0),
    contested=tactical.units.some(u=>u.team==='bravo'&&atTarget(u)),
    progress=held&&!contested?Math.min(RELAY_HOLD_TURNS,previous.progress+1):0,
    phase=progress===RELAY_HOLD_TURNS?'secured':
      tactical.turn>=turnLimit?'exhausted':'active';
  return Object.freeze({phase,progress});
}
