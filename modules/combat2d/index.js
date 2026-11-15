// SPDX-License-Identifier: Apache-2.0
// ARCADE-FOUNDATION-001. Integer XY contacts, 256 subunits/game unit.
// Caller owns motion and logical tick cadence. See docs/ARCADE_FOUNDATION_001.md.
export const COMBAT2D_LIMITS = Object.freeze({actors:64, projectiles:128, events:512,
  solids:32, coordinate:1_000_000, velocity:4096, ticks:108_000});
const worlds = new WeakSet(), moves = new WeakSet();
const C = COMBAT2D_LIMITS.coordinate;
const freeze = value => {
  if(value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
export function combatInteger(value, name, min, max) {
  if(!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(name+' out of bounds');
  return value === 0 ? 0 : value;
}
export function combatRecord(value, fields) {
  if(!value || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw new TypeError('plain record required');
  const keys = Reflect.ownKeys(value), desc = Object.getOwnPropertyDescriptors(value);
  if(keys.length !== fields.length || keys.some(k => !fields.includes(k)) ||
    fields.some(k => !Object.hasOwn(desc,k) || !Object.hasOwn(desc[k],'value'))) throw new TypeError('unexpected, missing or accessor field');
  return value;
}
export function combatArray(value, max) {
  if(!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype || value.length>max ||
    Reflect.ownKeys(value).length!==value.length+1) throw new RangeError('bounded dense array required');
  const desc=Object.getOwnPropertyDescriptors(value);
  for(let i=0;i<value.length;i++) if(!Object.hasOwn(desc,i) || !Object.hasOwn(desc[i],'value')) throw new TypeError('data array required');
  return value;
}
const integer = combatInteger, record = combatRecord, list = combatArray;
function box(source, local=false) {
  record(source,['minX','minY','maxX','maxY']);
  const out={};
  for(const k of ['minX','minY','maxX','maxY']) out[k]=integer(source[k],k,local?-2048:-C,local?2048:C);
  if(out.minX>=out.maxX || out.minY>=out.maxY) throw new RangeError('positive box area required');
  return out;
}
export function defineAttack2D(source) {
  if(moves.has(source)) return source;
  record(source,['windup','active','recovery','reach','halfWidth','offset','damage','knockback','stun','invulnerability','interruptible']);
  const out={};
  for(const [key,min,max] of [['windup',0,180],['active',1,120],['recovery',1,240],['reach',1,2048],
    ['halfWidth',1,1024],['offset',-1024,1024],['damage',1,1000],['knockback',0,512],['stun',0,240],['invulnerability',0,240]])
    out[key]=integer(source[key],key,min,max);
  if(typeof source.interruptible!=='boolean') throw new TypeError('interruptible must be boolean');
  out.interruptible=source.interruptible;
  freeze(out); moves.add(out); return out;
}
function facing(x,y) {
  integer(x,'faceX',-1,1); integer(y,'faceY',-1,1);
  if(Math.abs(x)+Math.abs(y)!==1) throw new RangeError('cardinal facing required');
}
function actor(source) {
  record(source,['id','team','x','y','faceX','faceY','health','hurtbox']);
  facing(source.faceX,source.faceY);
  return {id:integer(source.id,'actor id',1,1_000_000),team:integer(source.team,'team',0,255),
    x:integer(source.x,'x',-C,C),y:integer(source.y,'y',-C,C),faceX:source.faceX,faceY:source.faceY,
    health:integer(source.health,'health',1,10000),maxHealth:source.health,hurtbox:box(source.hurtbox,true),
    stun:0,invulnerability:0,knockX:0,knockY:0,attack:null};
}
function own(world) { freeze(world); worlds.add(world); return world; }
function requireWorld(world) { if(!worlds.has(world)) throw new TypeError('owned combat world required'); }
export function createCombatWorld({actors=[],solids=[],limits={}}={}) {
  const caps={actors:64,projectiles:128,events:512,...limits};
  record(caps,['actors','projectiles','events']);
  for(const key of Object.keys(caps)) integer(caps[key],key,1,COMBAT2D_LIMITS[key]);
  const bodies=list(actors,caps.actors).map(actor).sort((a,b)=>a.id-b.id);
  if(new Set(bodies.map(a=>a.id)).size!==bodies.length) throw new RangeError('duplicate actor id');
  const geometry=list(solids,32).map((s)=>{record(s,['id','box']);return {id:integer(s.id,'solid id',1,1000000),box:box(s.box)};}).sort((a,b)=>a.id-b.id);
  if(new Set(geometry.map(s=>s.id)).size!==geometry.length) throw new RangeError('duplicate solid id');
  return own({tick:0,actors:bodies,solids:geometry,projectiles:[],nextAttack:1,nextProjectile:1,
    lastActor:bodies.at(-1)?.id??0,limits:caps});
}
export function addCombatActors(world, sources) {
  requireWorld(world);
  const additions=list(sources,world.limits.actors).map(actor).sort((a,b)=>a.id-b.id);
  if(world.actors.length+additions.length>world.limits.actors) throw new RangeError('actor capacity');
  if(additions.some((a,i)=>a.id<=world.lastActor || (i && additions[i-1].id===a.id))) throw new RangeError('actor ids must increase');
  return own({...world,actors:[...world.actors,...additions],lastActor:additions.at(-1)?.id??world.lastActor});
}
export function healCombatActor(world, id, amount) {
  requireWorld(world); integer(amount,'heal',0,10000);
  if(!world.actors.some(a=>a.id===id)) throw new RangeError('unknown actor');
  return own({...world,actors:world.actors.map(a=>a.id===id && a.health>0 ? {...a,health:Math.min(a.maxHealth,a.health+amount)} : a)});
}
export function combatSnapshot(world) { requireWorld(world); return JSON.parse(JSON.stringify(world)); }
export function hurtbox2D(a) { return {minX:a.x+a.hurtbox.minX,maxX:a.x+a.hurtbox.maxX,minY:a.y+a.hurtbox.minY,maxY:a.y+a.hurtbox.maxY}; }
export function hitbox2D(a) {
  if(!a.attack) return null;
  const {move,faceX:x,faceY:y}=a.attack, cx=a.x,cy=a.y+move.offset;
  return x ? {minX:cx+(x<0?-move.reach:0),maxX:cx+(x>0?move.reach:0),minY:cy-move.halfWidth,maxY:cy+move.halfWidth}
    : {minX:cx-move.halfWidth,maxX:cx+move.halfWidth,minY:cy+(y<0?-move.reach:0),maxY:cy+(y>0?move.reach:0)};
}
export const overlaps2D = (a,b) => a.minX<=b.maxX && a.maxX>=b.minX && a.minY<=b.maxY && a.maxY>=b.minY;
// All products are below 2^53 within admitted coordinate/velocity bounds.
const compareTime=(a,b)=>a.n*b.d-b.n*a.d;
const ZERO=Object.freeze({n:0,d:1}), ONE=Object.freeze({n:1,d:1});
function sweep(x,y,dx,dy,r,b) {
  let near=ZERO,far=ONE;
  for(const [p,v,min,max] of [[x,dx,b.minX-r,b.maxX+r],[y,dy,b.minY-r,b.maxY+r]]) {
    if(v===0) { if(p<min || p>max) return null; continue; }
    const d=Math.abs(v), entry={n:v>0?min-p:p-max,d},exit={n:v>0?max-p:p-min,d};
    if(compareTime(entry,near)>0) near=entry;
    if(compareTime(exit,far)<0) far=exit;
    if(compareTime(near,far)>0) return null;
  }
  return near;
}
/** Closed contact; returns an exact (not necessarily reduced) fraction or null. */
export function sweepContact2D({x,y,dx,dy,radius=0}, target) {
  integer(x,'x',-C,C); integer(y,'y',-C,C);
  integer(dx,'dx',-4096,4096); integer(dy,'dy',-4096,4096); integer(radius,'radius',0,512);
  return sweep(x,y,dx,dy,radius,box(target));
}
function commandList(sources, fields, actors) {
  const ids=new Set();
  return list(sources,64).map(s=>{
    record(s,fields); integer(s.id,'id',1,1000000);
    if(ids.has(s.id) || !actors.some(a=>a.id===s.id)) throw new RangeError('duplicate/unknown command actor');
    ids.add(s.id); return s;
  }).sort((a,b)=>a.id-b.id);
}
/** Atomic tick: all validation and capacity checks precede publication.
 * Poses are endpoint samples. Collected simultaneous melee contacts trade even
 * if an earlier contact interrupts their source; target invulnerability wins.
 */
export function stepCombat2D(world, commands={}, {reference=false}={}) {
  requireWorld(world); record(commands,Reflect.ownKeys(commands));
  if(Reflect.ownKeys(commands).some(k=>!['poses','attacks','shots'].includes(k)))throw new TypeError('unknown combat command field');
  if(world.tick>=COMBAT2D_LIMITS.ticks) throw new RangeError('combat tick limit');
  if(typeof reference!=='boolean') throw new TypeError('reference must be boolean');
  const poses=commandList(commands.poses??[],['id','x','y','faceX','faceY'],world.actors);
  for(const p of poses) { integer(p.x,'x',-C,C);integer(p.y,'y',-C,C);facing(p.faceX,p.faceY); }
  const attacks=commandList(commands.attacks??[],['id','move'],world.actors).map(c=>({...c,move:defineAttack2D(c.move)}));
  const shots=commandList(commands.shots??[],['id','vx','vy','lifetime','radius','damage','knockback','stun','invulnerability'],world.actors);
  for(const s of shots) {
    for(const k of ['vx','vy']) integer(s[k],k,-4096,4096);
    if(!s.vx && !s.vy) throw new RangeError('stationary projectile');
    for(const [k,min,max] of [['lifetime',1,600],['radius',0,512],['damage',1,1000],['knockback',0,512],['stun',0,240],['invulnerability',0,240]]) integer(s[k],k,min,max);
  }
  const actors=world.actors.map(a=>({...a,attack:a.attack?{...a.attack,victims:[...a.attack.victims]}:null}));
  const byId=new Map(actors.map(a=>[a.id,a])),events=[],projectiles=world.projectiles.map(p=>({...p}));
  const emit=e=>{if(events.length>=world.limits.events) throw new RangeError('event capacity');events.push({tick:world.tick+1,...e});};
  let nextAttack=world.nextAttack,nextProjectile=world.nextProjectile;
  for(const a of actors) {
    if(a.stun>0 && --a.stun===0) {a.knockX=0;a.knockY=0;emit({type:'recovered',actor:a.id});}
    a.knockX-=Math.sign(a.knockX)*Math.min(8,Math.abs(a.knockX));
    a.knockY-=Math.sign(a.knockY)*Math.min(8,Math.abs(a.knockY));
    if(a.invulnerability>0) --a.invulnerability;
  }
  for(const p of poses) { const a=byId.get(p.id); if(a.health>0) Object.assign(a,p); }
  for(const c of attacks) {
    const a=byId.get(c.id);
    if(a.health===0 || a.stun || a.attack) continue;
    a.attack={id:nextAttack++,move:c.move,age:0,faceX:a.faceX,faceY:a.faceY,victims:[]};
    emit({type:'attack-start',actor:a.id,attack:a.attack.id});
  }
  for(const s of shots) {
    const a=byId.get(s.id); if(a.health===0 || a.stun || a.attack) continue;
    if(projectiles.length>=world.limits.projectiles) throw new RangeError('projectile capacity');
    const cx=a.x,cy=a.y+Math.trunc((a.hurtbox.minY+a.hurtbox.maxY)/2);
    const {id,...params}=s;
    const p={...params,id:nextProjectile++,owner:id,team:a.team,x:cx,y:cy};
    projectiles.push(p);emit({type:'shot',actor:a.id,projectile:p.id});
  }
  const targets=actors.filter(a=>a.health>0).map(a=>({actor:a,box:hurtbox2D(a)})).sort((a,b)=>a.box.minX-b.box.minX || a.actor.id-b.actor.id);
  const work={full:0,candidates:0,narrow:0};
  const query=b=>{
    work.full+=targets.length;
    if(reference) {work.candidates+=targets.length;return targets;}
    const out=[];
    for(const t of targets) { if(t.box.minX>b.maxX) break; if(t.box.maxX>=b.minX) out.push(t); }
    work.candidates+=out.length;return out;
  };
  const contacts=[];
  for(const a of actors) {
    const attack=a.attack;
    if(a.health===0 || !attack || attack.age<attack.move.windup || attack.age>=attack.move.windup+attack.move.active) continue;
    const b=hitbox2D(a);
    for(const t of query(b)) {
      if(t.actor.team===a.team || attack.victims.includes(t.actor.id)) continue;
      work.narrow++;
      if(overlaps2D(b,t.box)) contacts.push({time:ZERO,kind:'melee',source:a.id,serial:attack.id,target:t.actor.id,
        move:attack.move,faceX:attack.faceX,faceY:attack.faceY});
    }
  }
  const remaining=[];
  for(const p of projectiles) {
    const b={minX:Math.min(p.x,p.x+p.vx)-p.radius,maxX:Math.max(p.x,p.x+p.vx)+p.radius,
      minY:Math.min(p.y,p.y+p.vy)-p.radius,maxY:Math.max(p.y,p.y+p.vy)+p.radius};
    let nearest=null;
    const consider=(target,geometry,wall)=>{
      work.narrow++; const time=sweep(p.x,p.y,p.vx,p.vy,p.radius,geometry); if(!time) return;
      const candidate={time,kind:wall?'wall':'projectile',source:p.owner,serial:p.id,target,move:p,
        faceX:Math.sign(p.vx),faceY:Math.sign(p.vy)};
      if(!nearest || compareTime(time,nearest.time)<0 || (compareTime(time,nearest.time)===0 &&
        (wall && nearest.kind!=='wall' || (wall===(nearest.kind==='wall') && target<nearest.target)))) nearest=candidate;
    };
    for(const s of world.solids) if(reference || overlaps2D(b,s.box)) consider(s.id,s.box,true);
    for(const t of query(b)) if(t.actor.team!==p.team) consider(t.actor.id,t.box,false);
    if(nearest) contacts.push(nearest);
    else if(p.lifetime===1 || Math.abs(p.x+p.vx)>C || Math.abs(p.y+p.vy)>C) emit({type:'projectile-complete',projectile:p.id,reason:'expired'});
    else remaining.push({...p,x:p.x+p.vx,y:p.y+p.vy,lifetime:p.lifetime-1});
  }
  contacts.sort((a,b)=>compareTime(a.time,b.time) || a.source-b.source || (a.kind<b.kind?-1:a.kind>b.kind?1:0) || a.serial-b.serial || a.target-b.target);
  for(const hit of contacts) {
    if(hit.kind==='wall') {emit({type:'projectile-complete',projectile:hit.serial,reason:'wall',solid:hit.target});continue;}
    const victim=byId.get(hit.target),source=byId.get(hit.source);
    if(hit.kind==='melee' && source.attack?.id===hit.serial) source.attack.victims.push(victim.id);
    const applied=victim.health>0 && victim.invulnerability===0;
    emit({type:'hit',kind:hit.kind,source:hit.source,target:hit.target,attack:hit.serial,
      time:{...hit.time},damage:applied?Math.min(victim.health,hit.move.damage):0,x:victim.x,y:victim.y});
    if(applied) {
      victim.health=Math.max(0,victim.health-hit.move.damage);victim.stun=hit.move.stun;
      victim.invulnerability=hit.move.invulnerability;
      victim.knockX=hit.faceX*hit.move.knockback;victim.knockY=hit.faceY*hit.move.knockback;
      if(victim.attack && (victim.attack.move.interruptible || !victim.health)) {
        emit({type:'attack-complete',actor:victim.id,attack:victim.attack.id,reason:'interrupted'}); victim.attack=null;
      }
      if(!victim.health) {victim.stun=0;victim.knockX=0;victim.knockY=0;emit({type:'knockout',actor:victim.id,source:hit.source});}
    }
    if(hit.kind==='projectile') emit({type:'projectile-complete',projectile:hit.serial,reason:'contact'});
  }
  for(const a of actors) if(a.attack) {
    const attack=a.attack, move=attack.move;attack.age++;
    if(attack.age===move.windup+move.active) emit({type:'recovery-start',actor:a.id,attack:attack.id});
    if(attack.age>=move.windup+move.active+move.recovery) {emit({type:'attack-complete',actor:a.id,attack:attack.id,reason:'finished'});a.attack=null;}
  }
  return {world:own({...world,tick:world.tick+1,actors,projectiles:remaining,nextAttack,nextProjectile}),events:freeze(events),work};
}
