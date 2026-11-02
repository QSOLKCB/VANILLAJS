// SPDX-License-Identifier: Apache-2.0
// Shared demo policy: one cell per unit, stable contention, no swaps/cycles.
// Candidates are cardinal adjacent walkable cells supplied by the caller.
export function reserveTraffic(units,candidate){
  const ordered=[...units].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),key=c=>c.join(',');
  const occupants=new Map(ordered.map(u=>[key(u.cell),u])),proposals=new Map(),destinations=new Set();
  for(const u of ordered){const next=candidate(u);if(next&&!destinations.has(key(next))){destinations.add(key(next));proposals.set(u,next);}}
  const accepted=new Map(),visiting=new Set();
  function canMove(u){
    if(accepted.has(u))return accepted.get(u);if(visiting.has(u)||!proposals.has(u))return false;
    visiting.add(u);const occupant=occupants.get(key(proposals.get(u))),ok=!occupant||canMove(occupant);visiting.delete(u);accepted.set(u,ok);return ok;
  }
  for(const u of ordered)canMove(u);
  return new Map([...proposals].filter(([u])=>accepted.get(u)));
}
