// SPDX-License-Identifier: Apache-2.0
// Original Chase H.Q.-inspired pursuit rules; no commercial game data.
import {createRoadVehicle,createRoadCurve} from '../../../modules/road-arcade/index.js';
import {seededRandom,clamp} from '../../../modules/math/index.js';
import {CASES} from './cases.js';
export const INPUT=Object.freeze({left:1,right:2,throttle:4,brake:8,turbo:16});
export const VERSION='pursuit.v1',MAX_TICKS=54000;
export const VEHICLE=createRoadVehicle(),ROADS=Object.freeze(CASES.map(c=>createRoadCurve(c.bends)));
const emit=(s,type,extra={})=>s.events.push({type,tick:s.tick,...extra});
export const roadCurve=s=>ROADS[s.caseIndex].sample(s.distance);
const caseSeed=(seed,index)=>(seed^Math.imul(index+1,0x9e3779b9))>>>0;
function loadCase(s){
  const c=CASES[s.caseIndex];Object.assign(s,{mode:'catch',distance:0,car:{offset:0,speed:0,lateralSpeed:0,steering:0,slip:0},
    target:{distance:c.gap,offset:0,speed:c.speed,hits:0,contact:false,flash:0,recovering:false},traffic:[],spawnIn:180,nextId:1,
    time:70*60,boosts:3,turbo:0,lastMask:0,hitTick:-100,invulnerable:0,combo:0,reason:'',notice:'Close the gap. Save a turbo for contact.',noticeUntil:s.tick+240});
  s.rng=seededRandom(caseSeed(s.seed,s.caseIndex));
}
export function createGame({seed=1988}={}){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Seed must be uint32');
  const s={seed,tick:0,caseIndex:0,score:0,armour:100,events:[],journal:[],commands:[],totalHits:0};loadCase(s);return s;
}
export function nextCase(s,{record=true}={}){
  if(s.mode!=='cleared'||s.caseIndex>=CASES.length-1)return false;
  if(record)s.commands.push({tick:s.tick,type:'next'});s.caseIndex++;s.armour=Math.min(100,s.armour+30);loadCase(s);s.events=[];return true;
}
export function step(s,mask=0,{record=true}={}){
  if(!Number.isInteger(mask)||mask<0||mask>31)throw new RangeError('Invalid input mask');
  if(!['catch','contact'].includes(s.mode))return;
  if(s.tick>=MAX_TICKS){s.mode='lost';s.reason='Shift limit reached.';return;}
  const edge=mask&~s.lastMask;s.lastMask=mask;if(record)s.journal.push(mask);s.tick++;s.events=[];s.time--;
  if(s.invulnerable)s.invulnerable--;if(s.target.flash)s.target.flash--;
  if((edge&INPUT.turbo)&&s.boosts>0&&!s.turbo){s.boosts--;s.turbo=180;emit(s,'turbo');}
  if(s.turbo)s.turbo--;
  const oldDistance=s.distance,oldTarget=s.target.distance,c=CASES[s.caseIndex];
  s.car=VEHICLE.step(s.car,{steer:Number(Boolean(mask&INPUT.right))-Number(Boolean(mask&INPUT.left)),throttle:Number(Boolean(mask&INPUT.throttle)),brake:Number(Boolean(mask&INPUT.brake)),boost:s.turbo>0?1:0},roadCurve(s));
  s.distance+=s.car.speed/60;
  const t=s.target;t.distance+=t.speed/60;t.offset=Math.sin(s.tick*.012+s.caseIndex)*3.6+Math.sin(s.tick*.004)*.8;
  const gap=t.distance-s.distance;
  if(s.mode==='catch'&&gap<150){s.mode='contact';s.time=60*60;s.notice='TARGET IN SIGHT · Make controlled contact';s.noticeUntil=s.tick+200;emit(s,'sighted');}
  // Longitudinal sweep catches high-speed contacts between fixed ticks. Passing
  // alongside is allowed; the target accelerates back into view when overtaken.
  const crossed=(oldTarget-oldDistance)*(t.distance-s.distance)<=0;
  const overlap=(Math.abs(gap)<5||crossed)&&Math.abs(s.car.offset-t.offset)<1.5;
  if(s.mode==='contact'&&overlap&&!t.contact&&s.car.speed>25){
    t.hits++;t.flash=24;s.totalHits++;s.score+=500;s.hitTick=s.tick;s.car.speed*=.86;t.distance=s.distance+22;t.contact=true;
    emit(s,'impact',{pan:clamp((t.offset-s.car.offset)/6,-1,1)});s.notice='CONTACT '+t.hits+' / '+c.hits;s.noticeUntil=s.tick+90;
    if(t.hits>=c.hits){s.score+=Math.ceil(s.time/60)*100+2000;s.mode=s.caseIndex===CASES.length-1?'won':'cleared';s.reason=s.mode==='won'?'All five targets stopped. Shift complete.':'Target immobilised. Case closed.';emit(s,'clear');return;}
  }
  if(!overlap&&Math.abs(t.distance-s.distance)>9)t.contact=false;
  if(gap< -12)t.recovering=true;
  if(gap>35)t.recovering=false;
  t.speed=t.recovering?Math.min(115,Math.max(c.speed,s.car.speed+18)):c.speed;
  if(--s.spawnIn<=0&&s.traffic.length<24){
    const lane=Math.floor(s.rng()*3)-1;s.traffic.push({id:s.nextId++,distance:s.distance+450+s.rng()*220,offset:lane*3.4,speed:32+s.rng()*18,color:['#d7bb8c','#87a8b5','#c58779','#a8b78f'][Math.floor(s.rng()*4)],truck:s.rng()<.2,hit:false});s.spawnIn=c.traffic;
  }
  for(const e of s.traffic){
    const before=e.distance-oldDistance;e.distance+=e.speed/60;const delta=e.distance-s.distance;
    if(!e.hit&&!s.invulnerable&&(Math.abs(delta)<4||before*delta<=0)&&Math.abs(e.offset-s.car.offset)<1.55){e.hit=true;s.armour=Math.max(0,s.armour-14);s.car.speed*=.64;s.invulnerable=55;s.hitTick=s.tick;s.combo=0;emit(s,'crash');}
    if(!e.passed&&delta< -8){e.passed=true;if(!e.hit){s.combo=Math.min(4,s.combo+1);s.score+=s.combo*100;emit(s,'pass');}}
  }
  s.traffic=s.traffic.filter(e=>e.distance>s.distance-50);
  if(Math.abs(s.car.offset)>6&&s.tick%60===0&&s.car.speed>25)s.armour=Math.max(0,s.armour-1);
  if(s.time<=0||s.armour<=0||s.tick>=MAX_TICKS){s.mode='lost';s.reason=s.armour<=0?'Unit disabled. Traffic is not the target.':'Target escaped. Your time is up.';emit(s,'fail');}
}
export function snapshot(s){return {seed:s.seed,tick:s.tick,caseIndex:s.caseIndex,mode:s.mode,distance:s.distance,car:{...s.car},target:{...s.target},traffic:s.traffic.map(e=>({...e})),time:s.time,boosts:s.boosts,turbo:s.turbo,score:s.score,armour:s.armour,totalHits:s.totalHits,lastMask:s.lastMask,spawnIn:s.spawnIn,nextId:s.nextId,invulnerable:s.invulnerable,hitTick:s.hitTick,combo:s.combo,reason:s.reason};}
export function runRecord(s){return {kind:VERSION,seed:s.seed,inputs:[...s.journal],commands:s.commands.map(c=>({...c}))};}
export function replay(record){
  if(!record||record.kind!==VERSION||!Number.isInteger(record.seed)||record.seed<0||record.seed>0xffffffff||!Array.isArray(record.inputs)||record.inputs.length>MAX_TICKS||!Array.isArray(record.commands)||record.commands.length>4)throw new TypeError('Unsupported pursuit replay');
  for(const mask of record.inputs)if(!Number.isInteger(mask)||mask<0||mask>31)throw new TypeError('Invalid replay input');
  const s=createGame({seed:record.seed});let at=0,previous=-1;
  for(const c of record.commands){if(!c||!Number.isInteger(c.tick)||c.tick<previous||c.tick<0||c.tick>record.inputs.length||c.type!=='next')throw new TypeError('Invalid replay command');previous=c.tick;}
  for(let i=0;i<=record.inputs.length;i++){
    while(at<record.commands.length&&record.commands[at].tick===i){if(!nextCase(s,{record:false}))throw new TypeError('Rejected replay command');at++;}
    if(i===record.inputs.length)break;if(!['catch','contact'].includes(s.mode))throw new TypeError('Input after terminal state');step(s,record.inputs[i],{record:false});
  }
  return s;
}
