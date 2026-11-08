// SPDX-License-Identifier: Apache-2.0
// Original deterministic lab, adapted from the independent-clock idea in
// QSOLKCB/Bullet-Time (Apache-2.0). World X/Z in metres, +Y up.
import {createTimeDomains,stepTimeDomains} from '../../modules/time-domains/index.js';
import {castSegment,castMovingSegment} from '../../modules/collision/index.js';
import {StaticAABBIndex} from '../../modules/geometry/index.js';

export const BULLET_TICK=1/120;
const COVER=Object.freeze([
  {id:'cover-left',box:{min:[-5,0,10],max:[-1.25,2.5,10.6]}},
  {id:'cover-right',box:{min:[1.25,0,10],max:[5,2.5,10.6]}}
]);
const COVER_INDEX=new StaticAABBIndex(COVER); // Immutable geometry; one index for every replay.
const person=(id,x,z)=>({id,box:{min:[x-.55,0,z-.28],max:[x+.55,2,z+.28]}});
const prefer=(a,b)=>!a?b:!b?a:a.time<b.time?a:a.time>b.time?b:a.id<b.id?a:b;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function createBulletLab(){
  return {tick:0,domains:createTimeDomains(),playerX:0,enemyX:0,health:4,
    targetHealth:3,respawn:0,focus:70,dive:0,fireCooldown:0,
    enemyFire:1.4,shots:[],nextId:1,
    stats:{fired:0,hits:0,kills:0,dodged:0},
    events:[],work:{staticCandidates:0,staticFull:0,staticQueries:0}};
}
export function stepBulletLab(state,input={},optimized=true){
  if(!state||!Number.isSafeInteger(state.tick)||state.tick<0||state.tick>=108000)
    throw new RangeError('invalid or exhausted lab state');
  if(typeof optimized!=='boolean'||![-1,0,1].includes(input.move??0)||
     ['fire','focus','dodge'].some(k=>input[k]!==undefined&&typeof input[k]!=='boolean'))
    throw new TypeError('invalid lab input');
  const focusHeld=Boolean(input.focus)&&state.focus>=8;
  const diveStart=Boolean(input.dodge)&&state.dive===0&&(input.move??0)!==0;
  const dive=diveStart?0.36:Math.max(0,state.dive-BULLET_TICK);
  const domains=stepTimeDomains(state.domains,BULLET_TICK,{focus:focusHeld,dive:dive>0});
  const worldDt=domains.world-state.domains.world;
  const playerDt=domains.player-state.domains.player;
  const weaponDt=domains.weapon-state.domains.weapon;
  const playerX=clamp(state.playerX+(input.move??0)*(dive>0?9:5.8)*playerDt,-4.3,4.3);
  const enemyX=Math.sin(domains.world*1.35)*2.65;
  const respawn=Math.max(0,state.respawn-worldDt);
  let targetHealth=state.targetHealth;
  if(state.respawn>0&&respawn===0)targetHealth=3;
  let focus=clamp(state.focus+(focusHeld?-11:2.8)*BULLET_TICK,0,100);
  let fireCooldown=Math.max(0,state.fireCooldown-weaponDt),enemyFire=state.enemyFire-worldDt;
  let shots=state.shots,nextId=state.nextId,health=state.health;
  const events=[],stats={...state.stats};
  const work={staticCandidates:0,staticFull:0,staticQueries:0};
  if(input.fire&&fireCooldown===0&&shots.length<96){
    shots=[...shots,{id:nextId++,team:'player',x:playerX,z:2,vz:31}];
    stats.fired++;fireCooldown=.16;
  }
  if(enemyFire<=0){
    enemyFire+=1.25;
    if(respawn===0&&shots.length<96)shots=[...shots,{id:nextId++,team:'enemy',x:enemyX,z:19.5,vz:-11}];
  }
  const next=[];
  for(const shot of shots){
    const origin=[shot.x,1,shot.z],delta=[0,0,shot.vz*worldDt];
    work.staticQueries++;work.staticFull+=COVER.length;
    work.staticCandidates+=optimized?COVER_INDEX.candidates(origin,delta,{halfSize:.065}).length:COVER.length;
    const wall=optimized?COVER_INDEX.castSegment(origin,delta,{halfSize:.065}):
      castSegment(origin,delta,COVER,{halfSize:.065});
    const actor=shot.team==='player'?
      (respawn>0?null:castMovingSegment(origin,delta,[{
        ...person('target',state.enemyX,19.5),displacement:[enemyX-state.enemyX,0,0]
      }],{halfSize:.065})):
      castMovingSegment(origin,delta,[{
        ...person('player',state.playerX,2),displacement:[playerX-state.playerX,0,0]
      }],{halfSize:.065});
    const hit=prefer(wall,actor);
    if(hit){
      if(hit.id==='target'){
        stats.hits++;targetHealth--;
        events.push('TARGET HIT');
        if(targetHealth===0){stats.kills++;events.push('TARGET DOWN');}
      }else if(hit.id==='player'&&health>0){
        health--;events.push('PLAYER HIT');
      }else events.push('COVER IMPACT');
    }else{
      const z=shot.z+delta[2];
      if(z>0&&z<22)next.push({...shot,z});
      else if(shot.team==='enemy')stats.dodged++;
    }
  }
  return {tick:state.tick+1,domains,playerX,enemyX,health,targetHealth,
    respawn:targetHealth===0&&respawn===0?1.2:respawn,focus,dive,fireCooldown,
    enemyFire,shots:next,nextId,stats,events,work};
}
export function bulletReceipt(state){
  const {work,...physical}=state;
  return physical;
}
