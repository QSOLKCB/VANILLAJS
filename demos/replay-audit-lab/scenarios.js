// SPDX-License-Identifier: Apache-2.0
// Original deterministic fixtures; actual event authority belongs to the engines.
import {vehiclePreset} from '../../modules/vehicle3d/index.js';
import {IntegerEngine} from '../../modules/integer-engine/index.js';
import {REPLAY_PLAN_FORMAT} from '../../modules/replay-audit/index.js';
export const BASE_BUILD='e9121ea7297b0aeca1da131b695e7c3371a98745';
const plan=(kind,model,frames)=>({format:REPLAY_PLAN_FORMAT,build:BASE_BUILD,kind,model,frames});
export function replayExamples(){
 const weapon={id:'needle',archetype:'precision',damage:25,headMultiplier:2,
  range:60,falloff:1,spread:0,recoil:0,interval:.1,reload:.2,magazine:3,
  reserve:9,speed:30,radius:0,penetration:0};
 const actors=[{id:'pilot',position:[0,0,5],team:0,health:100,armour:0},
  {id:'target',position:[0,0,0],team:1,health:100,armour:0}];
 const shot=fire=>({actor:'pilot',weapon:'needle',origin:[0,1,5],
  direction:[0,0,-1],fire,reload:false});
 const fps=plan('fps',{actors,weapons:[weapon],solids:[],
  friendlyFire:false,selfDamage:true},[[shot(true)],[],[shot(false)],[],[shot(true)]]);
 const air=plan('air',{world:{actors:[
   {id:'pilot',position:[0,0,0],velocity:[0,0,0],halfExtents:[1,1,1]},
   {id:'target',position:[0,0,-20],velocity:[0,0,0],halfExtents:[1,1,1]}
  ],walls:[]},launch:{ownerId:'pilot',targetId:'target',position:[0,0,-2],
   direction:[0,0,-1],speed:120,turnRate:3,ttlTicks:240,halfSize:.1}},
   Array.from({length:17},()=>[]));
 const racing=plan('racing',{vehicle:vehiclePreset(),spawn:{},
  surface:{height:0,friction:1}},Array.from({length:60},(_,i)=>({
    throttle:1,brake:0,steer:i<30?0:.05,gear:null
  })));
 const initial=new IntegerEngine({seed:17,bodies:[
  {id:1,position:[0,0,0],velocity:[0,0,0],halfSize:[1,1,1]},
  {id:2,position:[200,0,0],velocity:[0,0,0],halfSize:[1,1,1]}]}).snapshot();
 const integer=plan('integer',{initial},Array.from({length:40},(_,tick)=>
  tick%4===0?[{id:1,velocity:[tick%3,0,0]}]:[]));
 return {fps,air,racing,integer};
}
