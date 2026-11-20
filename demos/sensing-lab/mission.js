// SPDX-License-Identifier: Apache-2.0
// SENSE-001 tactical consumer: original, finite, turn-based infiltration mission.
// All visibility comes from modules/sensing; no fake camera-derived target locks.
import {createSightWorld,querySight} from '../../modules/sensing/index.js';

export const MAP_WIDTH=24,MAP_HEIGHT=16,TILE_METRES=2,TURN_LIMIT=80;
export const ENTRANCE=Object.freeze({x:2,z:13}),INTEL=Object.freeze({x:11,z:7}),EXIT=Object.freeze({x:21,z:2});
export const COVER=Object.freeze([
  Object.freeze({id:'west-wall',x:6,z:4,w:2,h:7,height:3}),
  Object.freeze({id:'east-wall',x:15,z:2,w:2,h:8,height:3}),
  Object.freeze({id:'warehouse',x:9,z:10,w:5,h:2,height:3}),
  Object.freeze({id:'junction',x:10,z:4,w:2,h:1,height:3}),
  Object.freeze({id:'west-crates',x:4,z:3,w:2,h:2,height:1}),
  Object.freeze({id:'east-crates',x:18,z:10,w:2,h:2,height:1}),
  Object.freeze({id:'supply-stack',x:3,z:7,w:2,h:2,height:2})
]);
const PATROLS=Object.freeze([
  Object.freeze({id:'sentry-1',label:'SENTRY 01',route:Object.freeze([
    [10,6],[11,6],[12,6],[12,7],[11,7],[10,7]].map(x=>Object.freeze(x)))}),
  Object.freeze({id:'sentry-2',label:'SENTRY 02',route:Object.freeze([
    [19,4],[20,4],[21,4],[21,5],[20,5],[19,5]].map(x=>Object.freeze(x)))}),
  Object.freeze({id:'sentry-3',label:'SENTRY 03',route:Object.freeze([
    [4,9],[5,9],[5,10],[4,10]].map(x=>Object.freeze(x)))})
]);
const allowed=new WeakSet();
const freeze=v=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;};
const owned=v=>{const s=freeze(v);allowed.add(s);return s;};
function assertState(state){if(!allowed.has(state))throw TypeError('createMission or stepMission state required');return state;}
const worldPoint=(p,y=1.6)=>[p.x*TILE_METRES,y,-p.z*TILE_METRES];
const coverBlockers=COVER.map(b=>({id:b.id,box:{
  min:[(b.x-.5)*TILE_METRES,0,-(b.z+b.h-.5)*TILE_METRES],
  max:[(b.x+b.w-.5)*TILE_METRES,b.height,-(b.z-.5)*TILE_METRES]
}}));
function blocked(x,z){
  return x<0||z<0||x>=MAP_WIDTH||z>=MAP_HEIGHT||
    COVER.some(b=>x>=b.x&&x<b.x+b.w&&z>=b.z&&z<b.z+b.h);
}
export function createMission(){
  return owned({turn:0,phase:'active',intel:false,
    agent:{x:ENTRANCE.x,z:ENTRANCE.z,crouched:false,heading:[0,0,-1]},
    guards:PATROLS.map(g=>({id:g.id,routeIndex:0,facing:[1,0,0]})),
    message:'Reach the data relay, take its manifest, then escape unseen.'});
}
const guardPosition=g=>{
  const route=PATROLS.find(x=>x.id===g.id);
  const [x,z]=route.route[g.routeIndex];return {x,z};
};
function field(state){
  const agentHeight=state.agent.crouched?.65:1.6;
  const player=worldPoint(state.agent,agentHeight);
  const guards=state.guards.map(g=>({...guardPosition(g),id:g.id,heading:g.facing}));
  const world=createSightWorld({blockers:coverBlockers,targets:guards.map(g=>({id:g.id,position:worldPoint(g,1.7)}))});
  const seen=querySight(world,{position:player,direction:state.agent.heading},{range:30,fov:2*Math.PI});
  const threats=guards.map(g=>{
    const sight=createSightWorld({blockers:coverBlockers,targets:[{id:'agent',position:player}]});
    const result=querySight(sight,{position:worldPoint(g,1.7),direction:g.heading},
      {range:14,fov:Math.PI*95/180})[0];
    return {id:g.id,x:g.x,z:g.z,heading:g.heading,spotsAgent:result.visible,
      reason:result.reason,occluderId:result.occluderId,distance:result.distance};
  });
  return {seen,threats};
}
/** Pure inspection. Camera mode is deliberately absent from this API. */
export function inspectMission(state){
  assertState(state);
  const result=field(state);
  return freeze({seen:result.seen,threats:result.threats,exposure:result.threats.some(g=>g.spotsAgent),
    known:result.seen.filter(x=>x.visible).map(x=>x.id)});
}
const STEP=Object.freeze({north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]});
/** One command equals at most one accepted turn. Blocked moves are rejected
 * without consuming a turn. Guard patrol and cone checks are authoritative.
 */
export function stepMission(current,command){
  const s=assertState(current);
  if(!command||typeof command!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(command)))
    throw TypeError('command must be a plain record');
  const d=Object.getOwnPropertyDescriptors(command);
  if(Reflect.ownKeys(d).length!==1||!d.action||!Object.hasOwn(d.action,'value'))
    throw TypeError('command must have one data-only action');
  const action=d.action.value;
  if(!['north','south','east','west','wait','crouch'].includes(action))throw RangeError('unknown command');
  if(s.phase!=='active')return Object.freeze({state:s,accepted:false,event:'mission-ended'});
  const agent={...s.agent,heading:[...s.agent.heading]};
  if(STEP[action]){
    const [dx,dz]=STEP[action],x=agent.x+dx,z=agent.z+dz;
    if(blocked(x,z))return Object.freeze({state:s,accepted:false,event:'blocked'});
    agent.x=x;agent.z=z;agent.heading=[dx,0,-dz];
  }else if(action==='crouch')agent.crouched=!agent.crouched;
  const guards=s.guards.map(g=>{
    const route=PATROLS.find(p=>p.id===g.id).route,
      now=route[g.routeIndex],nextIndex=(g.routeIndex+1)%route.length,next=route[nextIndex];
    const dx=next[0]-now[0],dz=next[1]-now[1],mag=Math.hypot(dx,dz);
    return {id:g.id,routeIndex:nextIndex,facing:[dx/mag,0,-dz/mag]};
  });
  const intel=s.intel||agent.x===INTEL.x&&agent.z===INTEL.z;
  const candidate={turn:s.turn+1,phase:'active',intel,agent,guards,message:''};
  const exposure=field(candidate).threats.find(g=>g.spotsAgent);
  const escaped=agent.x===EXIT.x&&agent.z===EXIT.z&&intel;
  candidate.phase=exposure?'detected':escaped?'escaped':
    candidate.turn>=TURN_LIMIT?'exhausted':'active';
  candidate.message=exposure?'Spotted by '+exposure.id+'. Patrol intercept!':
    escaped?'Manifest secured. Evacuation confirmed.':
    candidate.phase==='exhausted'?'The security shift has ended.':
    intel&&!s.intel?'Data manifest acquired. Reach the extraction marker.':
    action==='crouch'?(agent.crouched?'Crouched: low crates now block certain sightlines.':'Standing: greater visibility over cover.'):
    'Patrols advanced one turn. Watch their facing and cover.';
  return Object.freeze({state:owned(candidate),accepted:true,event:candidate.phase});
}
export function missionMap(){
  return freeze({width:MAP_WIDTH,height:MAP_HEIGHT,tileMetres:TILE_METRES,
    start:{...ENTRANCE},intel:{...INTEL},exit:{...EXIT},
    cover:COVER.map(x=>({...x})),guardRoutes:PATROLS.map(g=>({id:g.id,label:g.label,route:g.route.map(r=>[...r])}))});
}
