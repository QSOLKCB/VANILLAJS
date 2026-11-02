// SPDX-License-Identifier: Apache-2.0
import {seededRandom, length, subtract} from '../../modules/math/index.js';
import {aabb} from '../../modules/collision/index.js';
import {createBody, flightConfig, snapshot, stepFlight} from '../../modules/flight/index.js';
export const DEMOS={
  tunnel:{name:'The conduit',subtitle:'Assisted tunnel flight',position:[0,0,8],config:{assisted:true,acceleration:32,maxSpeed:27},description:'Thread six signal gates. Release thrust to brake automatically.'},
  arena:{name:'Open orbit',subtitle:'Inertial spaceflight',position:[0,0,18],config:{assisted:false,acceleration:16,maxSpeed:32},description:'Find six navigation beacons. Thrust changes velocity; releasing it preserves your drift.'}
};
export function createWorld(kind='tunnel', seed=83) {
  if (!DEMOS[kind]) throw new RangeError('unknown flight demo');
  const world={kind,seed,solids:[],gates:[],decoration:[],stars:[],spawn:DEMOS[kind].position};
  const solid=(center,size,color)=>{
    const box=aabb(center.map((v,i)=>v-size[i]/2),center.map((v,i)=>v+size[i]/2));
    world.solids.push({...box,center,size,color});
  };
  if (kind==='tunnel') {
    solid([0,-8,-110],[22,1,270],[0.09,0.14,0.18]);
    solid([0,8,-110],[22,1,270],[0.07,0.11,0.15]);
    solid([-11,0,-110],[1,16,270],[0.10,0.15,0.2]);
    solid([11,0,-110],[1,16,270],[0.1,0.15,0.2]);
    solid([0,0,25],[22,16,1],[0.12,0.16,0.19]);
    solid([0,0,-245],[22,16,1],[0.12,0.16,0.19]);
    for (let i=0;i<6;i++) {
      const x=[0,-4,4,0,-4,2][i], y=[0,2,-2,2,0,-1][i], z=-22-i*37;
      world.gates.push({position:[x,y,z],radius:3.5});
      // Alternating low/high obstacles leave wide, readable routes through the conduit.
      if (i>0) solid([i%2 ? 6:-6,i%2 ? -5:5,z+12],[7,4,3],[0.24,0.28,0.3]);
    }
    for (let z=15;z>-245;z-=12) {
      for (const x of [-10.3,10.3]) world.decoration.push({center:[x,-6.9,z],size:[0.13,0.13,5],color:[0.16,0.87,0.73]});
      world.decoration.push({center:[0,-7.43,z],size:[21,0.03,0.08],color:[0.2,0.33,0.37]});
    }
  } else {
    const points=[[0,0,-30],[24,8,-65],[-15,16,-110],[-44,-6,-90],[-30,-12,-30],[0,0,18]];
    world.gates=points.map(position=>({position,radius:5}));
    const random=seededRandom(seed);
    for (let i=0;i<52;i++) {
      const center=[(random()-.5)*180,(random()-.5)*100,-random()*190+35], size=2+random()*6;
      if ([world.spawn,...points].some(p=>length(subtract(p,center))<15)) continue;
      solid(center,[size,size*.8,size*1.2],[.16+random()*.08,.20+random()*.05,.25+random()*.05]);
    }
    // A small docking structure provides scale and visible collision geometry.
    solid([0,-7,16],[30,2,20],[.14,.20,.24]);
    solid([-16,0,16],[2,16,20],[.18,.26,.30]);
    solid([16,0,16],[2,16,20],[.18,.26,.30]);
  }
  const random=seededRandom(seed+1);
  for (let i=0;i<650;i++) {
    const azimuth=random()*Math.PI*2, y=random()*2-1, r=Math.sqrt(1-y*y);
    world.stars.push([Math.cos(azimuth)*r*450,y*450,Math.sin(azimuth)*r*450]);
  }
  return world;
}
export function createSession(kind='tunnel') {
  const world=createWorld(kind), body=createBody({position:world.spawn});
  return {world,body,previous:snapshot(body),config:flightConfig(DEMOS[kind].config),nextGate:0,elapsed:0,collisions:0,contacting:false,complete:false,lastHit:0};
}
function segmentDistance(a,b,p) {
  const d=subtract(b,a), n=d.reduce((s,x)=>s+x*x,0);
  const t=n>0 ? Math.max(0,Math.min(1,subtract(p,a).reduce((s,x,i)=>s+x*d[i],0)/n)) : 0;
  return length(subtract(a.map((x,i)=>x+d[i]*t),p));
}
export function updateSession(session,input,dt) {
  if (session.complete) return;
  session.previous=snapshot(session.body);
  const hit=stepFlight(session.body,input,dt,session.config,session.world.solids);
  session.elapsed+=dt;
  if (hit.contacts.length && !session.contacting) {session.collisions++;session.lastHit=session.elapsed;}
  session.contacting=hit.contacts.length>0;
  const gate=session.world.gates[session.nextGate];
  if (gate && segmentDistance(session.previous.position,session.body.position,gate.position)<gate.radius-session.body.halfSize) {
    session.nextGate++;
    if (session.nextGate===session.world.gates.length) session.complete=true;
  }
}
