// SPDX-License-Identifier: Apache-2.0
// Optional game-owned course assist. Only ordinary vehicle3d input snapshots.
import {locateOnRoad} from './race-course.js';
import {raceDriverInput} from './race-model.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
export const ASSIST_TARGET_SPEED=18;
/** For digital input, limit requested steering by a bounded lateral
 * acceleration and use route advice to avoid surprising high-speed skids.
 * No position setting, lateral teleport, fake input ticks, or solver changes. */
export function raceAssistInput(road,state,recipe,intent,rows=road.stations()){
  if(!intent||typeof intent!=='object'||!state||!recipe)
    throw TypeError('Accepted state and driving intent required');
  if(!(intent.throttle>0)||intent.brake>0||state.gear<=0||Object.hasOwn(intent,'gear'))
    return {...intent};
  const guide=raceDriverInput(road,state,recipe,{speed:ASSIST_TARGET_SPEED,lateral:-2,rows}),
        speed=Math.hypot(...state.velocity),
        available=recipe.steering.maxAngle/(1+speed*recipe.steering.speedReduction),
        limitAngle=Math.atan2(recipe.wheel.wheelbase*9,Math.max(9,speed*speed)),
        limit=clamp(limitAngle/available,0,1),
        manual=Math.abs(intent.steer??0)>.01;
  let manualWeight=0;
  if(manual){
    const location=locateOnRoad(road,state.position,rows);
    const yaw=road.sample(location.distance).yaw;
    const lateralSpeed=state.velocity[0]*Math.cos(yaw)-state.velocity[2]*Math.sin(yaw);
    // Include the body width and one second of outward travel when blending
    // a held steering key. Inward corrections retain full manual authority.
    const side=Math.sign(intent.steer);
    const margin=location.width/2-recipe.chassis.width/2-
      side*(location.lateral+lateralSpeed);
    manualWeight=.65*clamp((margin-1)/3,0,1);
  }
  const steer=(guide.steer+manualWeight*((intent.steer??0)-guide.steer))*limit;
  return {...intent,throttle:Math.min(intent.throttle,guide.throttle),
    brake:Math.max(intent.brake??0,guide.brake),steer:clamp(steer,-1,1)};
}
