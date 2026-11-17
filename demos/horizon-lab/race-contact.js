// SPDX-License-Identifier: Apache-2.0
// Game-owned finite horizontal oriented-chassis contact. No fake world movement.
import {rotate} from '../../modules/math/index.js';
const EPS=1e-8,RESTITUTION=.12;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function frame(s){
  const v=rotate(s.orientation,[0,0,-1]),n=Math.hypot(v[0],v[2]);
  if(n<=EPS)return null;
  const forward=[v[0]/n,v[2]/n];return {forward,right:[-forward[1],forward[0]]};
}
const extent=(axis,f,recipe)=>recipe.chassis.width*.5*Math.abs(dot(axis,f.right))+
  recipe.chassis.length*.5*Math.abs(dot(axis,f.forward));
/** Approximate symmetric, deterministic physical chassis contact after both
 * cars complete a native vehicle3d tick from the same accepted snapshot.
 * Height separation and actual projected oriented rectangles govern contact. */
export function resolveRaceContact(player,rival,recipe){
  if(!player||!rival||!recipe||!Array.isArray(player.position)||!Array.isArray(rival.position)||
      !Array.isArray(player.velocity)||!Array.isArray(rival.velocity)||
      ![...player.position,...rival.position,...player.velocity,...rival.velocity].every(Number.isFinite))
    throw TypeError('Finite vehicle states required for race contact');
  if(Math.abs(player.position[1]-rival.position[1])>recipe.chassis.height+.25)
    return {player,rival,hit:false};
  const a=frame(player),b=frame(rival);
  if(!a||!b)return {player,rival,hit:false};
  const delta=[rival.position[0]-player.position[0],rival.position[2]-player.position[2]];
  let penetration=Infinity,normal=null;
  for(const axis of [a.right,a.forward,b.right,b.forward]){
    const depth=extent(axis,a,recipe)+extent(axis,b,recipe)-Math.abs(dot(delta,axis));
    if(depth<=0)return {player,rival,hit:false};
    if(depth<penetration){
      penetration=depth;
      normal=dot(delta,axis)>=0?[-axis[0],-axis[1]]:axis.slice();
    }
  }
  const p=structuredClone(player),r=structuredClone(rival),distance=(penetration+.001)*.5;
  for(const [state,sign] of [[p,1],[r,-1]]){
    for(const [component,j] of [[0,0],[2,1]]){
      const offset=sign*normal[j]*distance;
      state.position[component]+=offset;
      for(const wheel of state.wheels){
        wheel.position[component]+=offset;wheel.contactPoint[component]+=offset;
      }
    }
  }
  const relative=[p.velocity[0]-r.velocity[0],p.velocity[2]-r.velocity[2]],
        closing=dot(relative,normal);
  if(closing<0){
    const impulse=-(1+RESTITUTION)*closing*.5;
    for(const [state,sign] of [[p,1],[r,-1]]){
      state.velocity[0]+=sign*normal[0]*impulse;
      state.velocity[2]+=sign*normal[1]*impulse;
    }
  }
  if(p.contacts.length<64)p.contacts.push('rival-vehicle');
  if(r.contacts.length<64)r.contacts.push('player-vehicle');
  return {player:p,rival:r,hit:true,penetration,normal};
}
