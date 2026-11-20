// SPDX-License-Identifier: Apache-2.0
// COCKPIT-002: original deterministic arcade missile range, owned by the game lab.
// Pure fixed-tick geometry, NOT an aviation weapon-system or guidance model.
export const MISSILE_STEP=1/120;
export const MISSILE_MAX_ACTIVE=4;
const MAX_TICKS=1_000_000_000, MAX_DISTANCE=2000;
const owned=new WeakSet();
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const scale=(v,n)=>v.map(x=>x*n);
const norm=v=>Math.hypot(...v);
const unit=v=>{const n=norm(v);if(n<=1e-12)throw RangeError('zero direction');return scale(v,1/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function record(v,keys,name){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(name+' plain record required');
  const d=Object.getOwnPropertyDescriptors(v);
  if(Reflect.ownKeys(d).some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(d[k],'value')))throw TypeError(name+' invalid fields');
}
function finite(n,a,b,name){if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b)throw RangeError(name+' out of bounds');return n;}
function vector(v,lo,hi,name){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==3||Reflect.ownKeys(v).length!==4)throw TypeError(name+' must be a dense triple');
  return Object.freeze(Array.from({length:3},(_,i)=>{
    const d=Object.getOwnPropertyDescriptor(v,i);
    if(!d||!Object.hasOwn(d,'value'))throw TypeError(name+' contains accessor/hole');
    return finite(d.value,lo,hi,name);
  }));
}
function rotate(q,v){
  const t=scale(cross(q.slice(0,3),v),2);
  return add(v,add(scale(t,q[3]),cross(q.slice(0,3),t)));
}
function pose(v){
  record(v,['position','velocity','orientation','angularVelocity','mass','inertia','halfSize',
    'tick','steering','gear','rpm','shiftRemaining','wheelSpin','brake','wheels','contacts','truncated','needsRecovery'],'vehicle pose');
  const position=vector(v.position,-10000,10000,'position'),velocity=vector(v.velocity,-500,500,'velocity');
  if(!Array.isArray(v.orientation)||Object.getPrototypeOf(v.orientation)!==Array.prototype||v.orientation.length!==4||
    Reflect.ownKeys(v.orientation).length!==5)throw TypeError('unit quaternion required');
  const orientation=Object.freeze(Array.from({length:4},(_,i)=>{
    const d=Object.getOwnPropertyDescriptor(v.orientation,i);
    if(!d||!Object.hasOwn(d,'value'))throw TypeError('quaternion accessor/hole');
    return finite(d.value,-1,1,'quaternion');
  }));
  if(Math.abs(norm(orientation)-1)>1e-6)throw RangeError('non-unit orientation');
  return {position,velocity,orientation};
}
function target(v){
  record(v,['center','radius'],'target');
  return {center:vector(v.center,-10000,10000,'target center'),radius:finite(v.radius,.1,1000,'target radius')};
}
function rack(v){if(!owned.has(v))throw TypeError('createMissileRack result required');return v;}
function own(data){const value=Object.freeze(data);owned.add(value);return value;}
function missile(data){return Object.freeze({id:data.id,position:Object.freeze([...data.position]),
  direction:Object.freeze([...data.direction]),speed:data.speed,age:data.age});}
/** Bounded 8-round reserve, 4 active maximum, two alternating pylons. */
export function createMissileRack(options={}){
  record(options,['ammo','mounts'],'missile rack');
  const ammo=finite(options.ammo??4,0,8,'ammo');
  if(!Number.isSafeInteger(ammo))throw RangeError('ammo must be an integer');
  const mounts=options.mounts??[[-2.4,-.7,-1.6],[2.4,-.7,-1.6]];
  if(!Array.isArray(mounts)||Object.getPrototypeOf(mounts)!==Array.prototype||mounts.length!==2||
    Reflect.ownKeys(mounts).length!==3)throw TypeError('exactly two missile pylons required');
  const accepted=Object.freeze(Array.from({length:2},(_,i)=>{
    const d=Object.getOwnPropertyDescriptor(mounts,i);
    if(!d||!Object.hasOwn(d,'value'))throw TypeError('pylon accessor/hole');
    return vector(d.value,-12,12,'mount');
  }));
  return own({ammo,mounts:accepted,tick:0,cooldown:0,nextId:1,launched:0,hits:0,expired:0,active:Object.freeze([])});
}
/** Target-lock uses body boresight, never camera or mouse head-look. */
export function missileLock(vehicle,goal){
  const p=pose(vehicle),t=target(goal),to=sub(t.center,p.position),distance=norm(to);
  if(distance>MAX_DISTANCE)return Object.freeze({locked:false,reason:'out-of-range',distance});
  if(distance<=t.radius+2)return Object.freeze({locked:false,reason:'target-overlap',distance});
  const boresight=rotate(p.orientation,[0,0,-1]);
  if(dot(unit(to),boresight)<Math.cos(Math.PI/6))return Object.freeze({locked:false,reason:'off-boresight',distance});
  return Object.freeze({locked:true,reason:'locked',distance});
}
/** Returns a new rack and an explicit status; failed launch never consumes ammo. */
export function launchMissile(current,vehicle,goal){
  const s=rack(current),p=pose(vehicle),lock=missileLock(vehicle,goal);
  if(s.ammo===0)return Object.freeze({rack:s,status:'empty'});
  if(s.cooldown>0)return Object.freeze({rack:s,status:'cooldown'});
  if(s.active.length>=MISSILE_MAX_ACTIVE)return Object.freeze({rack:s,status:'capacity'});
  if(!lock.locked)return Object.freeze({rack:s,status:lock.reason});
  if(s.nextId>MAX_TICKS||s.tick>=MAX_TICKS)throw RangeError('missile counter exhausted');
  const forward=rotate(p.orientation,[0,0,-1]);
  const mount=s.mounts[s.launched%2];
  const item=missile({id:s.nextId,position:add(p.position,rotate(p.orientation,mount)),
    direction:forward,speed:clamp(120+dot(p.velocity,forward),100,250),age:0});
  const next=own({...s,ammo:s.ammo-1,nextId:s.nextId+1,launched:s.launched+1,
    cooldown:Math.round(.8/MISSILE_STEP),active:Object.freeze([...s.active,item])});
  return Object.freeze({rack:next,status:'launched',id:item.id});
}
function steer(current,desired,maxRadians){
  const cos=clamp(dot(current,desired),-1,1),angle=Math.acos(cos);
  if(angle<=maxRadians)return desired;
  const tangent=sub(desired,scale(current,cos));
  const orthogonal=norm(tangent)>1e-10?unit(tangent):unit(Math.abs(current[0])<.8?
    cross(current,[1,0,0]):cross(current,[0,1,0]));
  return unit(add(scale(current,Math.cos(maxRadians)),scale(orthogonal,Math.sin(maxRadians))));
}
// Analytic swept segment/sphere check prevents tunnelling at 120 Hz.
function segmentSphere(a,b,center,radius){
  const d=sub(b,a),m=sub(a,center),len=dot(d,d),c=dot(m,m)-radius*radius;
  if(c<=0)return 0;
  if(len<=1e-14)return null;
  const halfB=dot(m,d),disc=halfB*halfB-len*c;
  if(disc<0)return null;
  const fraction=(-halfB-Math.sqrt(disc))/len;
  return fraction>=0&&fraction<=1?fraction:null;
}
/** Advance all missiles one fixed 120 Hz tick; independent of draw cadence. */
export function stepMissiles(current,goal,dt=MISSILE_STEP){
  const s=rack(current),t=target(goal);
  if(dt!==MISSILE_STEP)throw RangeError('missiles require 1/120 second fixed ticks');
  if(s.tick>=MAX_TICKS)throw RangeError('missile simulation exhausted');
  const events=[],active=[];
  for(const item of s.active){
    const delta=sub(t.center,item.position);
    if(norm(delta)<=t.radius){events.push(Object.freeze({id:item.id,type:'hit',point:item.position}));continue;}
    const desired=unit(delta);
    const direction=steer(item.direction,desired,2.5*dt);
    const speed=Math.min(260,item.speed+65*dt);
    const end=add(item.position,scale(direction,speed*dt));
    const fraction=segmentSphere(item.position,end,t.center,t.radius);
    if(fraction!==null){events.push(Object.freeze({id:item.id,type:'hit',point:Object.freeze(add(item.position,scale(sub(end,item.position),fraction)))}));continue;}
    if(item.age+1>=8/MISSILE_STEP){events.push(Object.freeze({id:item.id,type:'expired'}));continue;}
    active.push(missile({id:item.id,position:end,direction,speed,age:item.age+1}));
  }
  const hits=events.filter(e=>e.type==='hit').length,expired=events.length-hits;
  return Object.freeze({rack:own({...s,tick:s.tick+1,cooldown:Math.max(0,s.cooldown-1),
    hits:s.hits+hits,expired:s.expired+expired,active:Object.freeze(active)}),events:Object.freeze(events)});
}
/** A safe immutable, caller-readable summary with no mutable source references. */
export function missileSummary(current){
  const s=rack(current);
  return Object.freeze({ammo:s.ammo,cooldownTicks:s.cooldown,active:s.active.length,
    launched:s.launched,hits:s.hits,expired:s.expired,tick:s.tick});
}
