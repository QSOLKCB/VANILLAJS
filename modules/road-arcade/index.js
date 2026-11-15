// SPDX-License-Identifier: Apache-2.0
// Outruin-derived road-local arcade response, expressed in SI units.
import {clamp} from '../math/index.js';
const finite=(n,min,max,name)=>{if(!Number.isFinite(n)||n<min||n>max)throw new RangeError(name);return n;};
const defaults={topSpeed:82,turboSpeed:24,acceleration:15,braking:32,drag:1.8,steeringRate:4.8,lateralSpeed:8.2,grip:15,halfWidth:6,shoulderWidth:3.3};
/** Stateless vehicle response. Positive offset is right; travelled distance is positive forward (-Z in world space). */
export function createRoadVehicle(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!Object.hasOwn(defaults,k)))throw new TypeError('Unknown vehicle option');
  const settings={...defaults,...options};
  for(const [name,value] of Object.entries(settings))finite(value,.01,name==='topSpeed'?150:name==='grip'?60:name==='halfWidth'||name==='shoulderWidth'?50:100,name);
  Object.freeze(settings);
  return Object.freeze({settings,step(state,input={},curvature=0,dt=1/60){
    if(!state||!input)throw new TypeError('State and controls required');
    const limit=settings.halfWidth+settings.shoulderWidth;
    for(const [name,min,max] of [['offset',-limit,limit],['speed',0,250],['lateralSpeed',-150,150],['steering',-1,1],['slip',0,300]])finite(state[name],min,max,name);
    const steer=finite(input.steer??0,-1,1,'steer'),throttle=finite(input.throttle??0,0,1,'throttle'),brake=finite(input.brake??0,0,1,'brake'),boost=finite(input.boost??0,0,1,'boost');
    finite(curvature,-.05,.05,'curvature');finite(dt,1/1000,.1,'dt');
    const offroad=Math.abs(state.offset)>settings.halfWidth,ceiling=settings.topSpeed+(brake?0:boost*settings.turboSpeed);
    const force=brake?-brake*settings.braking:state.speed<ceiling?throttle*(settings.acceleration+boost*12):0;
    const resistance=settings.drag+state.speed*.025+(offroad?18:0)+(state.speed>ceiling?10:0);
    const speed=clamp(state.speed+(force-resistance)*dt,0,state.speed<=ceiling?ceiling:settings.topSpeed+settings.turboSpeed);
    const steering=state.steering+clamp(steer-state.steering,-settings.steeringRate*dt,settings.steeringRate*dt);
    if(speed===0)return {offset:state.offset,speed:0,lateralSpeed:0,steering,slip:0};
    const desired=steering*settings.lateralSpeed*clamp(speed/51,0,1.2),traction=offroad?.5:brake?1.2:1;
    let lateralSpeed=state.lateralSpeed+(desired-state.lateralSpeed)*(1-Math.exp(-settings.grip*traction*dt));
    const drift=curvature*speed*speed*.07,offset=clamp(state.offset+(lateralSpeed-drift)*dt,-limit,limit);
    if(Math.abs(offset)===limit&&Math.sign(lateralSpeed)===Math.sign(offset))lateralSpeed=0;
    return {offset,speed,lateralSpeed,steering,slip:Math.abs(desired-lateralSpeed)};
  }});
}
/** Owned periodic curvature samples (1/metre), joined by smoothstep over metres. */
export function createRoadCurve(bends,{segmentLength=280}={}){
  if(!Array.isArray(bends)||bends.length<2||bends.length>128)throw new RangeError('2–128 bends required');
  const owned=Array.from(bends,n=>finite(n,-.05,.05,'bend'));finite(segmentLength,1,10000,'segmentLength');
  return Object.freeze({segmentLength,length:owned.length*segmentLength,sample(distance){
    finite(distance,0,1e9,'distance');const p=(distance%(owned.length*segmentLength))/segmentLength,i=Math.floor(p),t=p-i;
    return owned[i]+(owned[(i+1)%owned.length]-owned[i])*t*t*(3-2*t);
  }});
}
