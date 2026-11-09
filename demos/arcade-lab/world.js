// SPDX-License-Identifier: Apache-2.0
// A new ricochet/paddle lab, not a port of ARCADE's cabinets.
// +X right, +Z up on the 2D table, +Y up in 3D collision queries.
import {castSegment} from '../../modules/collision/index.js';
import {StaticAABBIndex} from '../../modules/geometry/index.js';
export const ARCADE_TICK=1/120;
const box=(id,minX,maxX,minZ,maxZ)=>({id,box:{min:[minX,0,minZ],max:[maxX,2,maxZ]}});
const RAILS=[box('left',-5.35,-5,0,14),box('right',5,5.35,0,14),
  box('roof',-5.35,5.35,13.6,14)];
const BRICKS=Array.from({length:18},(_,i)=>{
  const x=i%6,z=Math.floor(i/6);
  return box('brick-'+i,-4.75+x*1.6,-3.33+x*1.6,9.3+z*1.12,9.92+z*1.12);
});
const BUMPS=[box('bumper-0',-3.65,-2.95,8.8,9.5),box('bumper-1',2.95,3.65,8.8,9.5),
  box('bumper-2',-.36,.36,11.7,12.4)];
const FIELDS=Object.freeze({brick:Object.freeze([...RAILS,...BRICKS]),
  bank:Object.freeze([...RAILS,...BUMPS])});
const INDEX=Object.freeze({brick:new StaticAABBIndex(FIELDS.brick),
  bank:new StaticAABBIndex(FIELDS.bank)});
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const nearest=(a,b)=>!a?b:!b?a:a.time<b.time?a:a.time>b.time?b:a.id<b.id?a:b;
export function createArcadeLab(kind='brick'){
  if(!(kind in FIELDS))throw new RangeError('unknown arcade fixture');
  return {kind,tick:0,paddle:0,ball:{x:0,z:2.8,vx:2.3,vz:7.2},
    waiting:true,lives:3,score:0,broken:[],bounces:0,last:'READY',
    work:{candidates:0,full:0,queries:0}};
}
export function stepArcadeLab(state,input={},optimized=true,instrument=true){
  if(!state||!(state.kind in FIELDS)||state.tick>=108000||!Number.isSafeInteger(state.tick))
    throw new RangeError('invalid arcade state');
  if(typeof optimized!=='boolean'||typeof instrument!=='boolean'||![-1,0,1].includes(input.move??0)||
     (input.launch!==undefined&&typeof input.launch!=='boolean'))
    throw new TypeError('invalid arcade controls');
  const paddle=clamp(state.paddle+(input.move??0)*7.2*ARCADE_TICK,-4.15,4.15);
  const work={candidates:0,full:0,queries:0};
  if(state.lives===0)return {...state,tick:state.tick+1,paddle,work};
  if(state.waiting&&!input.launch)return {...state,tick:state.tick+1,paddle,work};
  let ball={...state.ball},waiting=false,lives=state.lives,score=state.score;
  let broken=state.broken,bounces=state.bounces,last=state.last,remaining=ARCADE_TICK;
  const ignored=state.kind==='brick'?[...broken]:[];
  for(let hitCount=0;hitCount<4&&remaining>1e-9;hitCount++){
    const origin=[ball.x,1,ball.z],delta=[ball.vx*remaining,0,ball.vz*remaining];
    work.queries++;work.full+=FIELDS[state.kind].length;
    if(instrument)work.candidates+=optimized?INDEX[state.kind].candidates(origin,delta,{halfSize:.13,ignoreIds:ignored}).length:FIELDS[state.kind].length;
    const walls=optimized?INDEX[state.kind].castSegment(origin,delta,{halfSize:.13,ignoreIds:ignored}):
      castSegment(origin,delta,FIELDS[state.kind],{halfSize:.13,ignoreIds:ignored});
    // Paddle occupies its new tick position, matching both comparison modes.
    const paddleHit=ball.vz<0?castSegment(origin,delta,
      [box('paddle',paddle-1.02,paddle+1.02,.72,1.03)],{halfSize:.13}):null;
    const hit=nearest(walls,paddleHit);
    if(!hit){ball.x+=delta[0];ball.z+=delta[2];break;}
    ball.x=hit.point[0]+hit.normal[0]*1e-6;
    ball.z=hit.point[2]+hit.normal[2]*1e-6;
    const t=hit.time;remaining*=1-t;
    if(hit.normal[0]===0&&hit.normal[2]===0){remaining=0;last='OVERLAP';break;}
    if(hit.normal[0]!==0)ball.vx=-ball.vx;
    if(hit.normal[2]!==0)ball.vz=-ball.vz;
    if(hit.id==='paddle'){ball.vz=Math.abs(ball.vz);ball.vx=clamp(ball.vx+(ball.x-paddle)*1.35,-7.5,7.5);}
    if(hit.id.startsWith('brick-')&&!broken.includes(hit.id)){
      broken=[...broken,hit.id];ignored.push(hit.id);score+=10;last='BRICK '+hit.id.slice(6);
    }else if(hit.id.startsWith('bumper-')){score+=5;last='BANK HIT';}
    else if(hit.id==='paddle')last='PADDLE RETURN';
    bounces++;
    if(t<=1e-12)remaining=0; // No repeated zero-time contact loops.
  }
  if(ball.z<-.3){
    lives--;waiting=true;ball={x:0,z:2.8,vx:2.3,vz:7.2};last='BALL LOST';
  }
  if(state.kind==='brick'&&broken.length===BRICKS.length)last='ALL BRICKS CLEARED';
  return {kind:state.kind,tick:state.tick+1,paddle,ball,waiting,lives,score,
    broken,bounces,last,work};
}
export function arcadeReceipt(state){const {work,...physical}=state;return physical;}
export function arcadeFixture(kind){return FIELDS[kind].map(c=>({id:c.id,
  min:[...c.box.min],max:[...c.box.max]}));}
