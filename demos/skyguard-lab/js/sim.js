// SPDX-License-Identifier: Apache-2.0
// Spooky-derived progression. Naval flight and weapons are original arcade rules.
// Positions are logical display units (+X right, +Y down), not real ballistics.
import {seededRandom,clamp} from '../../../modules/math/index.js';
import {castMovingSegment,castSegment} from '../../../modules/collision/index.js';
import {STATIONS,WEAPONS,AIRCRAFT,DIFFICULTIES,UPGRADES,stationForRound,MUZZLE,WIDTH,HEIGHT} from './content.js';
export const TICK_RATE=60;
const HIT_EXTENTS={drone:[23,18],fighter:[30,29],bomber:[46,32],skimmer:[14,22]};
const ranks=()=>({power:0,cycle:0,magazine:0,systems:0});
export function waveSize(round,difficulty='cadet'){const d=DIFFICULTIES[difficulty];return d.count+(round-1)*d.growth+Math.floor((round-1)/4)*2;}
export function stats(s){const w=WEAPONS[s.station],u=s.upgrades[s.station];return {...w,damage:w.damage*(1+.25*u.power),interval:Math.max(3,Math.round(w.interval/(1+.14*u.cycle))),reload:Math.round(w.reload/(1+.14*u.cycle)),magazine:Math.round(w.magazine*(1+.25*u.magazine)),radius:w.radius*(s.station==='flak'?1+.18*u.systems:1),heat:w.heat/(1+.22*u.systems),cool:.7+.17*u.systems,spread:3/(1+.3*u.systems),lock:Math.max(7,22-3*u.systems),turn:.07+.012*u.systems,charge:Math.round(36/(1+.14*u.cycle)),pierce:3+u.systems};}
export function create({seed=47047,difficulty='cadet'}={}){
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new RangeError('Invalid seed');
  if(!Object.hasOwn(DIFFICULTIES,difficulty))throw new TypeError('Unknown difficulty');
  const s={seed,difficulty,tick:0,round:1,hp:100,kills:0,shots:0,hits:0,score:0,nextId:1,upgrades:Object.fromEntries(STATIONS.map(x=>[x.id,ranks()])),aim:{x:576,y:250}};
  beginRound(s);return s;
}
function beginRound(s){
  s.station=stationForRound(s.round).id;s.status='playing';s.total=waveSize(s.round,s.difficulty);s.spawned=0;s.resolved=0;s.roundKills=0;s.roundTick=0;s.nextSpawn=100;
  s.enemies=[];s.projectiles=[];s.effects=[];s.debris=[];s.offers=[];s.events=[];s.lockId=null;s.lockTicks=0;s.charge=0;s.trigger=false;s.combo=0;s.comboUntil=0;
  s.weapon={ammo:stats(s).magazine,reload:0,cooldown:0,heat:0,overheated:false};
}
export function cancelInput(s){s.trigger=false;s.charge=0;s.lockId=null;s.lockTicks=0;}
export function reload(s){const w=s.weapon;if(s.status!=='playing'||w.reload||w.ammo===stats(s).magazine)return false;w.reload=stats(s).reload;s.charge=0;s.events.push({type:'reload'});return true;}
function spawn(s){
  const random=seededRandom((s.seed^Math.imul(s.round,2654435761)^Math.imul(s.spawned+1,1597334677))>>>0),r=random();
  const kind=s.round>=3&&r<.18?'skimmer':s.round>=2&&r<.36?'bomber':r<.68?'fighter':'drone',spec=AIRCRAFT[kind],x=90+random()*970,y=kind==='skimmer'?340:80+random()*120;
  s.enemies.push({id:s.nextId++,kind,x,y,oldX:x,oldY:y,vx:0,vy:0,lane:x,phase:random()*Math.PI*2,age:0,hp:spec.hp*(1+(s.round-1)*.06),size:spec.size,flash:0});
  s.spawned++;s.nextSpawn=Math.max(35,DIFFICULTIES[s.difficulty].spacing-s.round*2)+Math.floor(random()*26);
}
export function targetAt(s,x=s.aim.x,y=s.aim.y,radius=112){let result=null,best=radius;for(const e of s.enemies){const d=Math.hypot(e.x-x,e.y-y);if(e.hp>0&&d<best){best=d;result=e;}}return result;}
export function leadPoint(e,speed=24){const d=Math.hypot(e.x-MUZZLE.x,e.y-MUZZLE.y)/speed;return {x:e.x+e.vx*d,y:e.y+e.vy*d};}
function colliders(s,moving=false){return s.enemies.filter(e=>e.hp>0).map(e=>{const x=moving?e.oldX:e.x,y=moving?e.oldY:e.y,rx=HIT_EXTENTS[e.kind][0]*(.65+e.y/900),ry=HIT_EXTENTS[e.kind][1]*(.65+e.y/900);return {id:String(e.id),box:{min:[x-rx,y-ry,-2],max:[x+rx,y+ry,2]},displacement:[e.x-e.oldX,e.y-e.oldY,0]};});}
function addEffect(s,type,x,y,radius,life=45){s.effects.push({type,x,y,radius,life,age:0,id:s.nextId++});if(s.effects.length>96)s.effects.shift();}
function damage(s,e,power){
  if(e.hp<=0)return;e.hp-=power;e.flash=6;if(e.hp>0)return;
  s.kills++;s.roundKills++;s.resolved++;s.combo=s.tick<s.comboUntil?s.combo+1:1;s.comboUntil=s.tick+150;s.score+=Math.round(AIRCRAFT[e.kind].points*(1+Math.min(4,Math.floor(s.combo/4))*.25));
  addEffect(s,'kill',e.x,e.y,e.size*1.5,55);s.events.push({type:'kill',x:e.x});
  const random=seededRandom((s.seed^e.id^s.tick)>>>0);
  for(let i=0;i<10;i++)s.debris.push({x:e.x,y:e.y,vx:(random()-.5)*5,vy:-random()*3,age:0,life:75+Math.floor(random()*45),size:2+random()*5,spin:random()*6});
  if(s.debris.length>160)s.debris.splice(0,s.debris.length-160);
}
function burst(s,x,y,power,radius){addEffect(s,'blast',x,y,radius,48);s.events.push({type:'impact',x});let hit=false;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-x,e.y-y);if(d<radius+e.size*.5){damage(s,e,power*(1-.5*Math.min(1,d/radius)));hit=true;}}if(hit)s.hits++;}
function fire(s){
  const w=s.weapon,p=stats(s);if(w.reload||w.cooldown||w.overheated||w.ammo<=0)return false;
  const target=s.enemies.find(e=>e.id===s.lockId&&e.hp>0);
  if(s.station==='missile'&&(!target||s.lockTicks<p.lock))return false;
  w.ammo--;w.cooldown=p.interval;w.heat=Math.min(100,w.heat+p.heat);s.shots++;s.events.push({type:s.station,x:s.aim.x});
  if(w.heat>=100){w.overheated=true;s.events.push({type:'hot'});}
  const random=seededRandom((s.seed^Math.imul(s.shots,1597334677))>>>0),a={x:s.aim.x+(random()-.5)*(s.station==='cannon'?p.spread:0),y:s.aim.y};
  const angle=Math.atan2(a.y-MUZZLE.y,a.x-MUZZLE.x);
  if(s.station==='rail'){
    const delta=[Math.cos(angle)*1500,Math.sin(angle)*1500,0],ignore=[],boxes=colliders(s);let count=0;
    for(let i=0;i<p.pierce;i++){const hit=castSegment([MUZZLE.x,MUZZLE.y,0],delta,boxes,{halfSize:3,ignoreIds:ignore});if(!hit)break;ignore.push(hit.id);damage(s,s.enemies.find(e=>String(e.id)===hit.id),p.damage*.8**i);count++;}
    if(count)s.hits++;if(count>=2){s.score+=(count-1)*125;s.events.push({type:'collateral',count});}
    s.effects.push({type:'beam',x:MUZZLE.x,y:MUZZLE.y,endX:MUZZLE.x+delta[0],endY:MUZZLE.y+delta[1],radius:5,age:0,life:20,id:s.nextId++});
  }else s.projectiles.push({id:s.nextId++,kind:s.station,x:s.station==='missile'?654:MUZZLE.x,y:MUZZLE.y,oldX:MUZZLE.x,oldY:MUZZLE.y,angle:s.station==='missile'?-Math.PI/2:angle,tx:a.x,ty:a.y,targetId:target?.id??null,age:0,life:s.station==='cannon'?65:s.station==='flak'?32:170,damage:p.damage,radius:p.radius,turn:p.turn});
  if(w.ammo===0)reload(s);return true;
}
function projectiles(s){
  const boxes=colliders(s,true),p=stats(s);
  for(const b of s.projectiles){b.oldX=b.x;b.oldY=b.y;b.age++;
    if(b.kind==='flak'){
      const t=Math.min(1,b.age/b.life);b.x=MUZZLE.x+(b.tx-MUZZLE.x)*t;b.y=MUZZLE.y+(b.ty-MUZZLE.y)*t-65*Math.sin(t*Math.PI);
      if(b.age>=b.life||(b.age>8&&s.enemies.some(e=>e.hp>0&&Math.hypot(e.x-b.x,e.y-b.y)<25))){burst(s,b.x,b.y,b.damage,b.radius);b.dead=true;}continue;
    }
    if(b.kind==='missile'){
      const e=s.enemies.find(e=>e.id===b.targetId&&e.hp>0);
      if(e){const aim=leadPoint(e,9),want=Math.atan2(aim.y-b.y,aim.x-b.x),diff=Math.atan2(Math.sin(want-b.angle),Math.cos(want-b.angle));b.angle+=clamp(diff,-b.turn,b.turn);}
    }
    const speed=b.kind==='cannon'?p.speed:9;b.x+=Math.cos(b.angle)*speed;b.y+=Math.sin(b.angle)*speed;
    const hit=castMovingSegment([b.oldX,b.oldY,0],[b.x-b.oldX,b.y-b.oldY,0],boxes.filter(c=>s.enemies.some(e=>String(e.id)===c.id&&e.hp>0)),{halfSize:b.kind==='missile'?7:2});
    if(hit){b.dead=true;if(b.kind==='missile')burst(s,hit.point[0],hit.point[1],b.damage,b.radius);else{damage(s,s.enemies.find(e=>String(e.id)===hit.id),b.damage);s.hits++;addEffect(s,'spark',hit.point[0],hit.point[1],9,12);}}
    if(b.age>=b.life)b.dead=true;
  }
  s.projectiles=s.projectiles.filter(b=>!b.dead);
}
function draft(s){const random=seededRandom((s.seed^Math.imul(s.round,7919))>>>0),pool=UPGRADES.filter(u=>u.id==='repair'||s.upgrades[s.station][u.id]<u.max).map(u=>u.id);s.offers=[];while(s.offers.length<3&&pool.length)s.offers.push(pool.splice(Math.floor(random()*pool.length),1)[0]);while(s.offers.length<3)s.offers.push('repair');}
export function chooseUpgrade(s,id){if(s.status!=='upgrade'||!s.offers.includes(id))return false;if(id==='repair')s.hp=Math.min(100,s.hp+25);else s.upgrades[s.station][id]++;s.round++;beginRound(s);return true;}
export function step(s,input={}){
  if(s.status!=='playing')return s;
  const x=input.x??s.aim.x,y=input.y??s.aim.y;
  if(!Number.isFinite(x)||!Number.isFinite(y)||('fire'in input&&typeof input.fire!=='boolean')||('reload'in input&&typeof input.reload!=='boolean'))throw new TypeError('Invalid input');
  s.aim={x:clamp(x,0,WIDTH),y:clamp(y,0,HEIGHT)};s.tick++;s.roundTick++;s.events=[];
  const w=s.weapon,p=stats(s),d=DIFFICULTIES[s.difficulty];
  if(w.cooldown>0)w.cooldown--;if(w.reload>0&&--w.reload===0){w.ammo=p.magazine;s.events.push({type:'ready'});}
  if(!input.fire||w.overheated||w.reload)w.heat=Math.max(0,w.heat-p.cool);if(w.overheated&&w.heat<25)w.overheated=false;
  if(input.reload)reload(s);
  for(const e of s.enemies){e.oldX=e.x;e.oldY=e.y;e.age++;e.flash=Math.max(0,e.flash-1);const spec=AIRCRAFT[e.kind],speed=spec.speed*d.speed*(1+Math.min(.65,(s.round-1)*.025));e.y+=speed;e.x+=(576-e.x)*.0012+Math.sin(e.age*.025+e.phase)*(e.kind==='drone'?.7:.25);e.vx=e.x-e.oldX;e.vy=e.y-e.oldY;}
  const target=targetAt(s);if(target&&target.id===s.lockId)s.lockTicks++;else{s.lockId=target?.id??null;s.lockTicks=target?1:0;}
  if(s.station==='rail'){
    if(input.fire&&!w.reload&&!w.cooldown&&w.ammo>0)s.charge=Math.min(p.charge,s.charge+1);
    if(!input.fire&&s.trigger){if(s.charge>=p.charge)fire(s);s.charge=0;}
  }else if(input.fire)fire(s);
  s.trigger=!!input.fire;projectiles(s);
  for(const e of s.enemies)if(e.hp>0&&e.y>=560){e.hp=0;s.resolved++;s.hp=Math.max(0,s.hp-AIRCRAFT[e.kind].damage*d.damage);addEffect(s,'breach',e.x,575,85,45);s.events.push({type:'breach'});}
  s.enemies=s.enemies.filter(e=>e.hp>0);s.effects=s.effects.filter(e=>++e.age<e.life);
  for(const b of s.debris){b.x+=b.vx;b.y+=b.vy;b.vy+=.075;b.age++;if(b.y>570&&b.age<b.life-12){b.life=b.age+12;addEffect(s,'splash',b.x,570,16,28);}}
  s.debris=s.debris.filter(b=>b.age<b.life);
  if(s.tick>=s.comboUntil)s.combo=0;
  if(s.hp<=0){s.status='lost';s.events.push({type:'lost'});cancelInput(s);return s;}
  const cap=d.cap+Math.min(4,Math.floor((s.round-1)/4));
  if(s.spawned<s.total&&s.enemies.length<cap&&--s.nextSpawn<=0)spawn(s);
  if(s.resolved===s.total&&s.spawned===s.total&&s.projectiles.length===0){s.status='upgrade';s.hp=Math.min(100,s.hp+8);s.score+=s.round*200;draft(s);s.events.push({type:'clear'});cancelInput(s);}
  return s;
}
