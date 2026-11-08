// SPDX-License-Identifier: Apache-2.0
// Three independent simulation-time domains; caller owns the fixed real tick.
// Adapted as a pure contract from QSOLKCB/Bullet-Time/src/game.js (Apache-2.0).
// No wall clock, DOM, renderer or global mutation.
const finite=(n,name)=>{if(typeof n!=='number'||!Number.isFinite(n))throw new RangeError(name+' must be finite');return n;};
export const DEFAULT_TIME_DOMAINS=Object.freeze({worldSlow:0.22,playerSlow:0.5,weaponSlow:0.8,ramp:11});
export function createTimeDomains(options={}){
  const settings={...DEFAULT_TIME_DOMAINS,...options};
  for(const [key,value] of Object.entries(settings))finite(value,key);
  if(settings.worldSlow<=0||settings.worldSlow>=1||
     settings.playerSlow<=0||settings.playerSlow>1||
     settings.weaponSlow<=0||settings.weaponSlow>1||settings.ramp<=0)
    throw new RangeError('invalid time-domain parameters');
  return Object.freeze({settings:Object.freeze(settings),scale:1,slow:0,real:0,world:0,player:0,weapon:0});
}
/** A fixed real-time tick updates all domains once. Controls are sampled in
 * real time; consumer decides which state responds to each domain. This is
 * deterministic for an identical ordered input/tick tape on one JS engine,
 * not a cross-browser bit-exact floating-point guarantee. */
export function stepTimeDomains(state,dt,{focus=false,dive=false}={}){
  if(!state||!state.settings||typeof focus!=='boolean'||typeof dive!=='boolean')
    throw new TypeError('invalid time domain state or control');
  finite(dt,'dt');if(dt<=0||dt>1/30)throw new RangeError('real tick must be in (0, 1/30]');
  const p=state.settings,target=focus||dive?p.worldSlow:1;
  let scale=state.scale+(target-state.scale)*Math.min(1,dt*p.ramp);
  if(Math.abs(scale-target)<1e-3)scale=target;
  const slow=(1-scale)/(1-p.worldSlow);
  const playerScale=1+(p.playerSlow-1)*slow,weaponScale=1+(p.weaponSlow-1)*slow;
  return Object.freeze({settings:p,scale,slow,real:state.real+dt,
    world:state.world+dt*scale,player:state.player+dt*playerScale,
    weapon:state.weapon+dt*weaponScale});
}
