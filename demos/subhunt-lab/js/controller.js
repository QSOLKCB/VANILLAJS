// SPDX-License-Identifier: Apache-2.0
// SubHunt labels, calibration workflow and default action names remain demo-owned.
import {GAMEPAD_DIRECTIONS,defaultGamepadProfile,validateGamepadProfile,createGamepadMapper,captureGamepadBinding,gamepadReleased} from '../../../modules/gamepad/index.js';
const ACTIONS=['fire','sonar','pause','menu','restart'],DIRECTIONS=GAMEPAD_DIRECTIONS;
const STEPS=[...ACTIONS.map((key,i)=>({key,type:'button',label:['A / FIRE','B / SONAR','START / PAUSE','SELECT / MENU','X / RESTART'][i]})),...DIRECTIONS.map(key=>({key,type:'direction',label:'D-PAD '+key.toUpperCase()}))];
const freshDefault=()=>JSON.parse(JSON.stringify(defaultGamepadProfile({fire:0,sonar:1,pause:9,menu:8,restart:2})));
const valid=p=>{try{const v=validateGamepadProfile(p);return Object.keys(v.buttons).length===ACTIONS.length&&ACTIONS.every(k=>Object.hasOwn(v.buttons,k));}catch{return false;}};
const defaultMapper=createGamepadMapper(freshDefault());
let selected=null,mapper=null;
function read(pad,profile){
  if(!profile)return defaultMapper.read(pad);
  if(profile!==selected){mapper=createGamepadMapper(profile);selected=profile;}
  return mapper.read(pad);
}
export const SubHuntController=Object.freeze({ACTIONS,DIRECTIONS,STEPS,freshDefault,valid,read,capture:captureGamepadBinding,released:gamepadReleased});
