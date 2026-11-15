// SPDX-License-Identifier: Apache-2.0
// Experimental Float64 combat, metres, +Y up / -Z forward. No motion or game rules.
import {aabb,raycast} from '../collision/index.js';
import {ProjectileSystem} from '../projectiles/index.js';
import {WeaponTimer} from '../weapons/index.js';
export const COMBAT3D_LIMITS=Object.freeze({actors:16,solids:256,projectiles:64,events:4096,ticks:36000});
export function fpsRecord(v,keys){
  if(!v||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw new TypeError('plain record required');
  const d=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(v);
  if(own.length!==keys.length||own.some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(d,k)||!Object.hasOwn(d[k],'value')))throw new TypeError('unexpected, missing or accessor field');return v;
}
export function fpsList(v,max){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max||Reflect.ownKeys(v).length!==v.length+1)throw new TypeError('bounded dense array required');
  const d=Object.getOwnPropertyDescriptors(v);for(let i=0;i<v.length;i++)if(!Object.hasOwn(d,i)||!Object.hasOwn(d[i],'value'))throw new TypeError('data elements required');return v;
}
export function fpsNumber(v,min,max,integer=false){if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isSafeInteger(v)))throw new RangeError('number out of bounds');return v===0?0:v;}
export function fpsVector(v,min=-256,max=256){fpsList(v,3);if(v.length!==3)throw new TypeError('XYZ required');return v.map(x=>fpsNumber(x,min,max));}
export function fpsId(v){if(typeof v!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(v))throw new TypeError('identifier required');return v;}
const bool=v=>{if(typeof v!=='boolean')throw new TypeError('boolean required');return v;};
const compare=(a,b)=>a<b?-1:a>b?1:0;
const copy=v=>structuredClone(v);
const weapons=new WeakSet();
export function defineWeapon3D(v){
  if(weapons.has(v))return v;
  fpsRecord(v,['id','archetype','damage','headMultiplier','range','falloff','spread','recoil','interval','reload','magazine','reserve','speed','radius','penetration']);fpsId(v.id);
  if(!['precision','automatic','projectile'].includes(v.archetype))throw new TypeError('weapon archetype');
  for(const [k,min,max,int] of [['damage',1,200],['headMultiplier',1,4],['range',2,128],['falloff',0,1],['spread',0,.2],['recoil',0,.15],['interval',.05,3],['reload',.1,5],['magazine',1,100,true],['reserve',0,1000,true],['speed',4,100],['radius',0,8],['penetration',0,3,true]])fpsNumber(v[k],min,max,int);
  if(v.archetype!=='projectile'&&v.radius!==0)throw new RangeError('hitscan cannot explode');
  if(v.archetype==='projectile'&&v.penetration!==0)throw new RangeError('projectile penetration unsupported');
  const result=Object.freeze({...v});weapons.add(result);return result;
}
function actor(v){
  fpsRecord(v,['id','team','position','health','armour']);fpsId(v.id);fpsNumber(v.team,0,15,true);
  return {...v,position:fpsVector(v.position),health:fpsNumber(v.health,1,1000),armour:fpsNumber(v.armour,0,1000),maxHealth:v.health,maxArmour:v.armour,height:1.8,deadAt:null,kills:0,deaths:0,assists:0,contributions:{}};
}
/** Head: top 0.4m; body: remaining height. Upright boxes match character stance. */
export function actorRegions3D(v){
  const p=fpsVector(v.position),h=fpsNumber(v.height??1.8,1,2),id=fpsId(v.id);
  return [{id:'a-'+id+'-head',actor:id,part:'head',box:aabb([p[0]-.24,p[1]+h-.4,p[2]-.24],[p[0]+.24,p[1]+h,p[2]+.24])},
    {id:'a-'+id+'-body',actor:id,part:'body',box:aabb([p[0]-.35,p[1],p[2]-.35],[p[0]+.35,p[1]+h-.4,p[2]+.35])}];
}
function geometry(values){
  const rows=fpsList(values,COMBAT3D_LIMITS.solids).map(s=>{fpsRecord(s,['id','box','material']);fpsId(s.id);fpsRecord(s.box,['min','max']);
    const box=aabb(fpsVector(s.box.min),fpsVector(s.box.max));if(box.min.some((v,i)=>v>=box.max[i])||!['stone','wood'].includes(s.material))throw new RangeError('solid geometry/material');return {id:'s-'+s.id,box,material:s.material};});
  if(new Set(rows.map(s=>s.id)).size!==rows.length)throw new RangeError('duplicate solids');return rows.sort((a,b)=>compare(a.id,b.id));
}
/** Tick-start poses are fixed during shot queries; movement belongs to character.
 * Commands are admitted in full before any timers, projectiles or actors change.
 * Hitscan ties: wall, then actor ID, then head. Projectile ties use projectile ID.
 * Friendly actors stop shots even when friendlyFire is false. Wood consumes one
 * penetration unit per solid; each actor consumes one. Stone always stops shots.
 */
export class Combat3D {
  #actors;#weapons;#timers=new Map();#selected=new Map();#held=new Map();#solids;#shots=new ProjectileSystem({capacity:64});#rules;#tick=0;#serial=0;#events=[];
  constructor({actors=[],weapons:definitions=[],solids=[],friendlyFire=false,selfDamage=true}={}){
    const rows=fpsList(actors,16).map(actor).sort((a,b)=>compare(a.id,b.id));
    if(!rows.length||new Set(rows.map(a=>a.id)).size!==rows.length)throw new RangeError('unique actors required');
    const defs=fpsList(definitions,3).map(defineWeapon3D);
    if(!defs.length||new Set(defs.map(w=>w.id)).size!==defs.length)throw new RangeError('unique weapons required');
    this.#actors=new Map(rows.map(a=>[a.id,a]));this.#weapons=new Map(defs.map(w=>[w.id,w]));this.#solids=geometry(solids);
    this.#rules={friendlyFire:bool(friendlyFire),selfDamage:bool(selfDamage)};
    for(const a of rows)this.#equip(a.id);
  }
  #equip(id){this.#timers.set(id,new Map([...this.#weapons].map(([key,w])=>[key,new WeaponTimer({magazineSize:w.magazine,reserve:w.reserve,interval:w.interval,reloadTime:w.reload})])));this.#selected.set(id,this.#weapons.keys().next().value);this.#held.set(id,false);}
  addActor(source){const a=actor(source);if(this.#actors.has(a.id)||this.#actors.size>=16)throw new RangeError('duplicate actor or actor capacity');this.#actors.set(a.id,a);this.#actors=new Map([...this.#actors].sort(([a],[b])=>compare(a,b)));this.#equip(a.id);}
  snapshot(){return {tick:this.#tick,serial:this.#serial,actors:copy([...this.#actors.values()]),projectiles:this.#shots.snapshots(),weapons:[...this.#actors.keys()].map(id=>({actor:id,selected:this.#selected.get(id),held:this.#held.get(id),timers:[...this.#timers.get(id)].map(([id,t])=>({id,...t.snapshot()}))}))};}
  actor(id){const a=this.#actors.get(id);if(!a)throw new RangeError('unknown actor');return copy(a);}
  cancelTriggers(){for(const id of this.#held.keys())this.#held.set(id,false);}
  setPoses(poses){
    const rows=fpsList(poses,16).map(p=>{fpsRecord(p,['id','position','height']);if(!this.#actors.has(p.id))throw new RangeError('unknown actor');return {id:p.id,position:fpsVector(p.position),height:fpsNumber(p.height,1,2)};});
    if(new Set(rows.map(p=>p.id)).size!==rows.length)throw new RangeError('duplicate pose');for(const p of rows)Object.assign(this.#actors.get(p.id),p);
  }
  respawn(id,position,stats=null){const p=fpsVector(position),a=this.#actors.get(id);if(!a||a.health>0)throw new RangeError('only dead actors respawn');
    if(stats){fpsRecord(stats,['health','armour']);fpsNumber(stats.health,1,1000);fpsNumber(stats.armour,0,1000);}
    Object.assign(a,{position:p,height:1.8,health:stats?.health??a.maxHealth,armour:stats?.armour??a.maxArmour,maxHealth:stats?.health??a.maxHealth,maxArmour:stats?.armour??a.maxArmour,deadAt:null,contributions:{}});this.#equip(id);return {type:'respawn',actor:id,tick:this.#tick};}
  pickup(id,kind,amount){fpsNumber(amount,1,1000,true);const a=this.#actors.get(id);if(!a||!['health','ammo'].includes(kind))throw new RangeError('pickup');if(a.health===0)return 0;
    if(kind==='health'){const n=Math.min(amount,a.maxHealth-a.health);a.health+=n;return n;}
    let n=0;for(const t of this.#timers.get(id).values())n+=t.addReserve(amount,1000);return n;
  }
  #emit(e){this.#events.push({tick:this.#tick,...e});}
  #damage(source,target,w,amount,part,shot,point,kind){
    const a=this.#actors.get(target),owner=this.#actors.get(source);
    if(!a||a.health<=0||amount<=0||(source===target?!this.#rules.selfDamage:!this.#rules.friendlyFire&&a.team===owner.team))return;
    const shield=Math.min(a.armour,amount*.6),damage=Math.min(a.health,amount-shield);a.armour-=shield;a.health-=damage;
    a.contributions[source]={tick:this.#tick};this.#emit({type:'damage',source,target,weapon:w.id,shot,part,amount:damage,armour:shield,point,kind});
    if(a.health===0){a.deadAt=this.#tick;a.deaths++;this.#emit({type:'death',source,target,weapon:w.id,shot});
      if(source!==target&&owner.team!==a.team){owner.kills++;this.#emit({type:'elimination',source,target,weapon:w.id,shot});}
      for(const other of Object.keys(a.contributions).sort())if(other!==source&&other!==target&&this.#actors.get(other).team!==a.team&&this.#tick-a.contributions[other].tick<=600){this.#actors.get(other).assists++;this.#emit({type:'assist',source:other,target});}
    }
  }
  #regions(){return [...this.#actors.values()].filter(a=>a.health>0).flatMap(actorRegions3D);}
  #hitscan(command,w,shot,regions){
    const candidates=[...this.#solids,...regions.filter(r=>r.actor!==command.actor)].flatMap(c=>{const h=raycast(command.origin,command.direction,w.range,[c]);return h?[{...h,...c}]:[];});
    candidates.sort((a,b)=>a.distance-b.distance||Number(!!a.actor)-Number(!!b.actor)||compare(a.actor??a.id,b.actor??b.id)||(a.part==='head'?-1:1));
    let budget=w.penetration;const hitActors=new Set();let end=command.origin.map((v,i)=>v+command.direction[i]*w.range);
    for(const h of candidates){if(h.actor&&hitActors.has(h.actor))continue;end=h.point;
      this.#emit({type:'impact',source:command.actor,shot,point:h.point,part:h.part??'wall'});
      if(!h.actor){if(h.material==='stone'||budget===0)break;budget--;continue;}
      hitActors.add(h.actor);const factor=1-(1-w.falloff)*(h.distance/w.range);
      this.#damage(command.actor,h.actor,w,w.damage*factor*(h.part==='head'?w.headMultiplier:1),h.part,shot,h.point,'hitscan');
      if(budget===0)break;budget--;
    }
    this.#emit({type:'trace',source:command.actor,shot,from:command.origin,to:end});
  }
  #explode(event,w){
    // Offset out of the impacted face so the face itself does not occlude every ray.
    const point=event.hit.point.map((v,i)=>v+event.hit.normal[i]*.002),source=event.data.source;
    this.#emit({type:'explosion',source,point,radius:w.radius,shot:event.data.shot});
    for(const a of this.#actors.values()){
      if(a.health<=0)continue;const center=a.position.map((v,i)=>v+(i===1?a.height/2:0)),delta=center.map((v,i)=>v-point[i]),distance=Math.hypot(...delta);
      if(distance>=w.radius)continue;
      if(distance>0&&raycast(point,delta,distance,this.#solids))continue;
      this.#damage(source,a.id,w,w.damage*(1-distance/w.radius),'splash',event.data.shot,point,'explosion');
    }
  }
  step(commands=[]){
    if(this.#tick>=COMBAT3D_LIMITS.ticks)throw new RangeError('combat tick limit');
    const rows=fpsList(commands,16).map(c=>{fpsRecord(c,['actor','weapon','origin','direction','fire','reload']);if(!this.#actors.has(c.actor)||!this.#weapons.has(c.weapon))throw new RangeError('unknown actor/weapon');
      const origin=fpsVector(c.origin),direction=fpsVector(c.direction,-1,1),n=Math.hypot(...direction);if(n<.000001)throw new RangeError('nonzero aim required');
      return {...c,origin,direction:direction.map(v=>v/n),fire:bool(c.fire),reload:bool(c.reload)};}).sort((a,b)=>compare(a.actor,b.actor));
    if(new Set(rows.map(c=>c.actor)).size!==rows.length)throw new RangeError('duplicate commands');
    this.#events=[];const byId=new Map(rows.map(c=>[c.actor,c])),regions=this.#regions(),shots=[];
    for(const a of this.#actors.values()){
      const c=byId.get(a.id),selected=c?.weapon??this.#selected.get(a.id),w=this.#weapons.get(selected),held=this.#held.get(a.id);
      this.#selected.set(a.id,selected);this.#held.set(a.id,!!c?.fire);
      for(const [key,t] of this.#timers.get(a.id)){
        const active=key===selected&&a.health>0;
        const events=t.step(1/60,{fire:active&&!!c?.fire&&(w.archetype==='automatic'||!held),reload:active&&!!c?.reload});
        for(const e of events)if(e.type==='shot')shots.push({command:c,weapon:w,shot:++this.#serial});else this.#emit({type:e.type,actor:a.id,weapon:key});
      }
    }
    // Capture all eligible shots before applying damage: simultaneous trades work.
    for(const {command:c,weapon:w,shot} of shots){this.#emit({type:'shot',source:c.actor,weapon:w.id,shot,origin:c.origin,direction:c.direction});
      if(w.archetype!=='projectile')this.#hitscan(c,w,shot,regions);
      else{const result=this.#shots.spawn({position:c.origin,velocity:c.direction.map(v=>v*w.speed),lifetime:w.range/w.speed,halfSize:.06,ignoreIds:actorRegions3D(this.#actors.get(c.actor)).map(r=>r.id),data:{source:c.actor,weapon:w.id,shot}});
        if(!result.accepted)this.#emit({type:'projectile-rejected',source:c.actor,shot,reason:'capacity'});
      }
    }
    const colliders=[...this.#solids,...regions];
    for(const e of this.#shots.step(1/60,colliders))if(e.type==='hit'){
      const w=this.#weapons.get(e.data.weapon),target=regions.find(r=>r.id===e.hit.id);
      this.#emit({type:'impact',source:e.data.source,shot:e.data.shot,point:e.hit.point,part:target?.part??'wall'});
      if(w.radius>0)this.#explode(e,w);else if(target)this.#damage(e.data.source,target.actor,w,w.damage*(target.part==='head'?w.headMultiplier:1),target.part,e.data.shot,e.hit.point,'projectile');
    }
    // Worst case: 64 explosions * 16 actors plus bounded death/assist/shot events.
    if(this.#events.length>COMBAT3D_LIMITS.events)throw new Error('internal event bound violated');
    this.#tick++;return copy(this.#events);
  }
}
