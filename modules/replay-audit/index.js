// SPDX-License-Identifier: Apache-2.0
// REPLAY-AUDIT-001: source-bound, complete tick tapes; never trust recorded PASS.
import {Combat3D} from '../combat3d/index.js';
import {createVehicle,VEHICLE_STEP} from '../vehicle3d/index.js';
import {createTrajectoryWorld,launchTrajectory,stepTrajectory} from '../trajectory/index.js';
import {IntegerEngine} from '../integer-engine/index.js';
import {sealIntegerReplay} from '../integer-replay/index.js';

export const REPLAY_PLAN_FORMAT='qsol.vanillajs.replay-audit.plan.v1';
export const REPLAY_RECEIPT_FORMAT='qsol.vanillajs.replay-audit.receipt.v1';
export const REPLAY_LIMITS=Object.freeze({frames:128,sourceBytes:131072,receiptBytes:262144,events:4096,nodes:24000});
const BUILD=/^[0-9a-f]{40}$/,SHA=/^[0-9a-f]{64}$/,kinds=['fps','air','racing','integer'],sealed=new WeakSet(),utf8=new TextEncoder();
const json=JSON.stringify,bytes=v=>utf8.encode(json(v)).length;
function inert(v,depth=0,b={n:0}){
 if(++b.n>REPLAY_LIMITS.nodes||depth>20)throw RangeError('replay structural budget exceeded');
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='number'){if(!Number.isFinite(v))throw TypeError('nonfinite replay number');return v===0?0:v;}
 if(typeof v==='string'){if(v.length>256||/[\u0000-\u001f\u007f]/.test(v))throw TypeError('replay text invalid');return v;}
 if(!v||typeof v!=='object')throw TypeError('replay requires inert data');
 if(Array.isArray(v)){
  if(Object.getPrototypeOf(v)!==Array.prototype||v.length>4096||Reflect.ownKeys(v).length!==v.length+1)
   throw TypeError('dense bounded data arrays only');
  const ds=Object.getOwnPropertyDescriptors(v);
  return Array.from({length:v.length},(_,i)=>{const d=ds[String(i)];
   if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw TypeError('replay accessor/hole');
   return inert(d.value,depth+1,b);});
 }
 if(![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError('plain records only');
 const ds=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(ds);
 if(keys.length>48||keys.some(k=>typeof k!=='string'||!ds[k].enumerable||
   !Object.hasOwn(ds[k],'value')||['__proto__','constructor','prototype'].includes(k)))
   throw TypeError('unknown or executable record key');
 const out={};for(const k of keys.sort())out[k]=inert(ds[k].value,depth+1,b);return out;
}
function exact(v,keys,label){
 if(!v||typeof v!=='object'||Array.isArray(v)||
  Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))
  throw TypeError(label+' requires exact data fields');
 return v;
}
const count=(v,max,label,min=0)=>{if(!Array.isArray(v)||v.length<min||v.length>max)throw RangeError(label+' budget');return v;};
const num=(x,a,b,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<a||x>b)throw RangeError(name+' finite bounds');return x;};
const vec=(v,bound,label)=>{count(v,3,label,3);if(v.length!==3)throw TypeError('XYZ required');return v.map(x=>num(x,-bound,bound,label));};
const buildPin=s=>{if(typeof s!=='string'||!BUILD.test(s))throw TypeError('40-hex Git source SHA required');return s;};
function preflight(plan){
 const {kind,model,frames,build}=plan;
 count(frames,REPLAY_LIMITS.frames,'frames',1);
 if(kind==='fps'){
  exact(model,['actors','weapons','solids','friendlyFire','selfDamage'],'FPS source');
  const g=new Combat3D({actors:model.actors,weapons:model.weapons,solids:model.solids,
   friendlyFire:model.friendlyFire,selfDamage:model.selfDamage});
  const ids=new Set(g.snapshot().actors.map(x=>x.id)),weapons=new Set(model.weapons.map(w=>w.id));
  for(const frame of frames){count(frame,16,'FPS frame');const seen=new Set();
   for(const c of frame){
    exact(c,['actor','weapon','origin','direction','fire','reload'],'FPS command');
    if(!ids.has(c.actor)||!weapons.has(c.weapon)||seen.has(c.actor))throw TypeError('unknown/duplicate FPS command');
    seen.add(c.actor);vec(c.origin,256,'muzzle');vec(c.direction,1,'direction');
    if(Math.hypot(...c.direction)<.000001||typeof c.fire!=='boolean'||typeof c.reload!=='boolean')
     throw TypeError('invalid FPS aim or trigger');
   }
  }
 }else if(kind==='air'){
  exact(model,['world','launch'],'air model');
  const w=createTrajectoryWorld(model.world),shot=launchTrajectory(w,model.launch);
  if(!shot.accepted)throw RangeError('physical lock rejected: '+shot.reason);
  for(const f of frames)count(f,0,'air frame');
 }else if(kind==='racing'){
  exact(model,['vehicle','spawn','surface'],'racing model');
  const car=createVehicle(model.vehicle);car.spawn(model.spawn);
  exact(model.surface,['height','friction'],'flat surface');
  num(model.surface.height,-100,100,'height');num(model.surface.friction,0,2,'friction');
  for(const frame of frames){
   exact(frame,['throttle','brake','steer','gear'],'racing commands');
   num(frame.throttle,0,1,'throttle');num(frame.brake,0,1,'brake');num(frame.steer,-1,1,'steer');
   if(frame.gear!==null&&(!Number.isSafeInteger(frame.gear)||frame.gear< -1||
    frame.gear>car.recipe.gearbox.ratios.length))throw RangeError('invalid gear request');
  }
 }else {
  exact(model,['initial'],'integer source');
  sealIntegerReplay(model.initial,frames,{build});
 }
}
export function createReplayPlan(input){
 const plan=inert(input);
 exact(plan,['format','build','kind','model','frames'],'replay plan');
 if(plan.format!==REPLAY_PLAN_FORMAT||!kinds.includes(plan.kind))throw TypeError('replay model/version unsupported');
 buildPin(plan.build);
 if(bytes(plan)>REPLAY_LIMITS.sourceBytes)throw RangeError('plan exceeds source byte budget');
 preflight(plan);return deepFreeze(plan);
}
function deepFreeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))deepFreeze(x);Object.freeze(v);}return v;}
async function digest(value){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)throw Error('offline standard Web Crypto SHA-256 required');
 const buffer=await subtle.digest('SHA-256',utf8.encode(json(value)));
 return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function runner(plan){
 const m=plan.model;
 if(plan.kind==='fps'){
  const g=new Combat3D({actors:m.actors,weapons:m.weapons,solids:m.solids,
    friendlyFire:m.friendlyFire,selfDamage:m.selfDamage});
  return {tickRate:60,step:c=>({events:g.step(c),state:g.snapshot()}),final:()=>g.snapshot()};
 }
 if(plan.kind==='air'){
  const w=createTrajectoryWorld(m.world),launched=launchTrajectory(w,m.launch);
  if(!launched.accepted)throw RangeError('replayed launch rejected');
  let s=launched.state;
  return {tickRate:120,step:()=>{
    if(s.status!=='flying')throw RangeError('unconsumed ticks after terminal air event');
    s=stepTrajectory(w,s,1);return {events:s.event?[s.event]:[],state:s};
   },final:()=>s};
 }
 if(plan.kind==='racing'){
  const car=createVehicle(m.vehicle),ground=m.surface;
  const world={sampleSurface:(_x,_z,maxY)=>maxY>=ground.height?
    {height:ground.height,normal:[0,1,0],friction:ground.friction,surfaceId:'audit-flat'}:null,barriers:[]};
  let s=car.spawn(m.spawn);
  return {tickRate:120,step:c=>{
    if(s.needsRecovery)throw RangeError('unconsumed ticks after vehicle recovery');
    const input={throttle:c.throttle,brake:c.brake,steer:c.steer};
    if(c.gear!==null)input.gear=c.gear;
    s=car.step(s,input,world,VEHICLE_STEP);
    return {events:s.contacts.map(id=>({type:'barrier',id})),state:s};
   },final:()=>s};
 }
 const g=IntegerEngine.fromSnapshot(m.initial);
 return {tickRate:null,step:c=>{
  const event=g.step(c);return {events:event.contacts.map(e=>({type:'contact',...e})),state:g.snapshot()};
 },final:()=>g.snapshot()};
}
async function execute(plan){
 const engine=runner(plan),trace=[];let events=0;
 for(let i=0;i<plan.frames.length;i++){
  const result=engine.step(plan.frames[i]);
  events+=result.events.length;
  if(events>REPLAY_LIMITS.events)throw RangeError('event budget exceeded');
  trace.push({tick:i+1,events:inert(result.events),stateSha256:await digest(inert(result.state))});
 }
 return {trace,final:inert(engine.final()),tickRate:engine.tickRate};
}
/** Every receipt is generated by executing the entire validated command tape. */
export async function sealReplayReceipt(source){
 const plan=createReplayPlan(source),run=await execute(plan);
 const receipt=inert({format:REPLAY_RECEIPT_FORMAT,build:plan.build,kind:plan.kind,
  model:plan.model,frames:plan.frames,ticks:plan.frames.length,
  mode:plan.kind==='integer'?'integer-exact':'float-same-runtime',tickRate:run.tickRate,
  truncated:false,sourceSha256:await digest({build:plan.build,kind:plan.kind,
    model:plan.model,frames:plan.frames}),
  traceSha256:await digest(run.trace),finalSha256:await digest(run.final),trace:run.trace});
 if(bytes(receipt)>REPLAY_LIMITS.receiptBytes)throw RangeError('receipt exceeds 256 KiB');
 deepFreeze(receipt);sealed.add(receipt);return receipt;
}
/** The importing party must supply its independently known expected checkout SHA. */
export async function verifyReplayReceipt(input,{expectedBuild}={}){
 buildPin(expectedBuild);
 const r=inert(input);
 exact(r,['format','build','kind','model','frames','ticks','mode','tickRate','truncated',
  'sourceSha256','traceSha256','finalSha256','trace'],'receipt');
 if(r.format!==REPLAY_RECEIPT_FORMAT||r.build!==expectedBuild||r.truncated!==false)
  throw RangeError('receipt format/build/completeness mismatch');
 if(!Number.isSafeInteger(r.ticks)||r.ticks!==r.frames.length||
  ![r.sourceSha256,r.traceSha256,r.finalSha256].every(x=>typeof x==='string'&&SHA.test(x)))
  throw TypeError('invalid receipt count/digest');
 if(bytes(r)>REPLAY_LIMITS.receiptBytes)throw RangeError('receipt byte budget');
 const independent=await sealReplayReceipt({format:REPLAY_PLAN_FORMAT,build:r.build,
  kind:r.kind,model:r.model,frames:r.frames});
 const match=json(r)===json(independent);
 return Object.freeze({match,complete:match,consumed:independent.ticks,ticks:independent.ticks,
  kind:independent.kind,mode:independent.mode,finalSha256:independent.finalSha256});
}
export function exportReplayReceipt(receipt){
 if(!sealed.has(receipt))throw TypeError('only locally executed or independently verified receipts are exportable');
 const text=json(receipt);
 if(utf8.encode(text).length>REPLAY_LIMITS.receiptBytes)throw RangeError('export byte budget');
 return text;
}
export async function importReplayReceipt(text,{expectedBuild}={}){
 if(typeof text!=='string'||utf8.encode(text).length>REPLAY_LIMITS.receiptBytes)
  throw RangeError('bounded receipt text required');
 const r=inert(JSON.parse(text)),check=await verifyReplayReceipt(r,{expectedBuild});
 if(!check.match)throw Error('replay event/final-state evidence mismatch');
 // Full local re-execution has authenticated every command, event and state
 // hash. Admit only this owned, frozen result to the export capability set.
 // Forged/unverified records never acquire this capability.
 deepFreeze(r);sealed.add(r);
 return r;
}
/** Deterministic *virtual* presentation clock: authoritative ticks are
 * interleaved with real read-only display samples, not just counted afterward.
 * Integer models use 60 logical display ticks/second by convention, with no
 * assertion of a physical integer-engine tick frequency.
 * A trusted host-only present callback receives frozen metadata, never engine
 * state, and cannot be supplied inside inert source/receipt data.
 */
export async function sampleReplayPresentation(source,renderHz,{present}={}){
 const plan=createReplayPlan(source);
 if(![30,60,144].includes(renderHz))throw RangeError('presentation rate must be 30, 60 or 144 Hz');
 if(present!==undefined&&typeof present!=='function')throw TypeError('present must be a trusted host function');
 const engine=runner(plan),physicsHz=engine.tickRate??60,trace=[],samples=[];
 let accumulator=0,accepted=0,eventCount=0,frame=0;
 const maxFrames=REPLAY_LIMITS.frames*3;
 while(accepted<plan.frames.length){
  if(++frame>maxFrames)throw RangeError('presentation frame budget exceeded');
  accumulator+=physicsHz;
  let advanced=0;
  while(accumulator>=renderHz&&accepted<plan.frames.length){
   const result=engine.step(plan.frames[accepted]);
   eventCount+=result.events.length;
   if(eventCount>REPLAY_LIMITS.events)throw RangeError('cadenced event budget exceeded');
   trace.push({tick:accepted+1,events:inert(result.events),
    stateSha256:await digest(inert(result.state))});
   accepted++;advanced++;accumulator-=renderHz;
  }
  const stateSha256=await digest(inert(engine.final()));
  if(accepted>0&&stateSha256!==trace[accepted-1].stateSha256)
   throw Error('presentation sampled non-authoritative state');
  const sample=deepFreeze({renderHz,frame,acceptedTicks:accepted,advancedTicks:advanced,
   stateSha256,eventCount});
  samples.push(sample);
  if(present)await present(sample);
 }
 return deepFreeze({kind:plan.kind,renderHz,physicsHz,
  rateIsDisplayConvention:engine.tickRate===null,consumedTicks:accepted,
  displaySamples:samples.length,nonAdvancingFrames:samples.filter(s=>s.advancedTicks===0).length,
  lastPresentedTick:samples.at(-1).acceptedTicks,
  sampleSha256:await digest(samples),traceSha256:await digest(trace),
  finalSha256:await digest(inert(engine.final())),samples});
}
/** Independent authoritative baseline vs 30/60/144 Hz tick/sample schedules.
 * Read-only presentation can fail this gate, but cannot author physics input.
 */
export async function auditReplayPresentation(source,rates=[30,60,144],options={}){
 const plan=createReplayPlan(source);
 if(!Array.isArray(rates)||rates.length!==3||rates.join(',')!=='30,60,144')
  throw TypeError('rates must be [30,60,144]');
 const baseline=await sealReplayReceipt(plan),checks=[];
 for(const rate of rates){
  const sample=await sampleReplayPresentation(plan,rate,options);
  const same=sample.consumedTicks===baseline.ticks&&
   sample.traceSha256===baseline.traceSha256&&
   sample.finalSha256===baseline.finalSha256&&
   sample.lastPresentedTick===baseline.ticks;
  if(!same)throw Error('cadenced presentation altered physics or event trace');
  checks.push({renderHz:rate,displaySamples:sample.displaySamples,
   nonAdvancingFrames:sample.nonAdvancingFrames,lastPresentedTick:sample.lastPresentedTick,
   sampleSha256:sample.sampleSha256,
   consumedTicks:sample.consumedTicks,sameAuthoritativeTrace:true});
 }
 return deepFreeze({kind:baseline.kind,ticks:baseline.ticks,mode:baseline.mode,
  traceSha256:baseline.traceSha256,finalSha256:baseline.finalSha256,checks});
}
