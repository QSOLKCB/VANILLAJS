// SPDX-License-Identifier: Apache-2.0
import {fpsRecord,fpsList,fpsNumber,fpsVector,fpsId,defineWeapon3D} from '../combat3d/index.js';
import {seededRandom,quatMultiply,rotate} from '../math/index.js';

export const WEAPON_FEEL_FORMAT='qsol.vanillajs.weapon-feel.v1';
export const WEAPON_FEEL_BYTES=16384;
const STEP=1/60,EPS=1e-10;
const flag=v=>{if(typeof v!=='boolean')throw new TypeError('boolean required');return v;};
const wrap=a=>((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
const copy=v=>JSON.parse(JSON.stringify(v));
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};

/** Strict inert sidecar: Combat3D weapon definitions stay unchanged. FOV is in
 * radians, times in seconds. weapon.recoil is cosmetic; weapon.spread is the
 * maximum seeded angular offset in each canonical yaw/pitch axis. */
export function validateWeaponFeel(source){
  if(typeof source==='string'){
    if(source.length>WEAPON_FEEL_BYTES||new TextEncoder().encode(source).length>WEAPON_FEEL_BYTES)throw new RangeError('weapon recipe exceeds 16 KiB');
    source=JSON.parse(source);
  }
  fpsRecord(source,['format','version','seed','profiles']);
  if(source.format!==WEAPON_FEEL_FORMAT||source.version!==1)throw new TypeError('unsupported weapon-feel format/version');
  fpsNumber(source.seed,0,4294967295,true);
  const profiles=fpsList(source.profiles,3).map(p=>{
    fpsRecord(p,['id','label','weapon','view','handling']);fpsId(p.id);
    if(typeof p.label!=='string'||p.label.length<1||p.label.length>48||/[\u0000-\u001f<>]/.test(p.label))throw new TypeError('plain weapon label required');
    const weapon=defineWeapon3D(p.weapon);if(weapon.id!==p.id)throw new TypeError('profile and weapon IDs must match');
    fpsRecord(p.view,['hipFov','adsFov','adsSeconds','sensitivity','adsSensitivity','recoilReturn','flashSeconds','effects']);
    for(const [key,min,max]of [['hipFov',.4,2],['adsFov',.2,2],['adsSeconds',.03,1],['sensitivity',.1,4],['adsSensitivity',.25,2],['recoilReturn',.03,2],['flashSeconds',0,.2]])fpsNumber(p.view[key],min,max);
    if(p.view.adsFov>p.view.hipFov)throw new RangeError('ADS FOV must not exceed hip FOV');flag(p.view.effects);
    fpsRecord(p.handling,['triggerBuffer','switchSeconds','spreadKick','spreadRecovery']);
    for(const [key,min,max]of [['triggerBuffer',0,.25],['switchSeconds',.05,1],['spreadKick',0,.1],['spreadRecovery',.01,2]])fpsNumber(p.handling[key],min,max);
    return {id:p.id,label:p.label,weapon:{...weapon},view:{...p.view},handling:{...p.handling}};
  });
  if(profiles.length===0||new Set(profiles.map(p=>p.id)).size!==profiles.length)throw new RangeError('one to three unique profiles required');
  const result={format:WEAPON_FEEL_FORMAT,version:1,seed:source.seed,profiles};
  if(new TextEncoder().encode(JSON.stringify(result)).length>WEAPON_FEEL_BYTES)throw new RangeError('weapon recipe exceeds 16 KiB');return freeze(result);
}
export function exportWeaponFeel(source){return JSON.stringify(validateWeaponFeel(source),null,2);}
function timer(value){
  fpsRecord(value,['ammo','reserve','magazineSize','cooldown','reloadRemaining','phase']);
  fpsNumber(value.ammo,0,100,true);fpsNumber(value.reserve,0,1000,true);fpsNumber(value.magazineSize,1,100,true);
  fpsNumber(value.cooldown,0,3);fpsNumber(value.reloadRemaining,0,5);
  if(value.ammo>value.magazineSize||!['ready','cooldown','reloading','empty'].includes(value.phase))throw new RangeError('invalid timer snapshot');
}

/** Owner drives the fixed 60 Hz command step and supplies the selected canonical
 * WeaponTimer snapshot. No duplicate timers, DOM, clocks or renderer ownership.
 * Feed each relative look sample once; rendering reads aim() without consuming
 * the tick's accumulated look diagnostics. A cancelled input never fires later. */
export class WeaponFeel{
  #recipe;#index=0;#yaw=0;#pitch=0;#pending=[0,0];#ads=false;#fraction=0;#buffer=-1;#switch=0;#bloom=0;#kick=0;#flash=0;#hit=0;#hurt=0;#random;#shots=0;#reloading=false;
  constructor(source){this.#recipe=validateWeaponFeel(source);this.#random=seededRandom(this.#recipe.seed);}
  recipe(){return copy(this.#recipe);}
  profile(){return this.#recipe.profiles[this.#index];}
  select(index){
    fpsNumber(index,0,this.#recipe.profiles.length-1,true);if(index===this.#index)return false;
    this.#index=index;this.#switch=Math.max(this.#switch,this.profile().handling.switchSeconds);this.#buffer=-1;this.#ads=false;this.#fraction=0;this.#bloom=0;this.#kick=0;this.#flash=0;this.#reloading=false;return true;
  }
  setADS(value){this.#ads=flag(value);}
  setAim(yaw,pitch){fpsNumber(yaw,-Math.PI*1024,Math.PI*1024);fpsNumber(pitch,-Math.PI/2+.01,Math.PI/2-.01);this.#yaw=wrap(yaw);this.#pitch=pitch;this.#pending=[0,0];}
  addLook(yaw,pitch){
    fpsNumber(yaw,-Math.PI,Math.PI);fpsNumber(pitch,-Math.PI,Math.PI);
    const scale=this.presentation().sensitivity,y=yaw*scale,p=pitch*scale,previous=this.#pitch;
    this.#yaw=wrap(this.#yaw+y);this.#pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,this.#pitch+p));
    // Bound pathological producer queues, without dropping ordinary input samples.
    this.#pending[0]=Math.max(-1024,Math.min(1024,this.#pending[0]+y));this.#pending[1]=Math.max(-1024,Math.min(1024,this.#pending[1]+this.#pitch-previous));
    return this.aim();
  }
  consumeLook(){const [yaw,pitch]=this.#pending;this.#pending=[0,0];return {yaw,pitch};}
  trigger(){this.#buffer=this.profile().handling.triggerBuffer;}
  cancel(){this.#buffer=-1;this.#pending=[0,0];this.#ads=false;this.#flash=0;this.#hit=0;this.#hurt=0;}
  aim(){const y=this.#yaw/2,p=this.#pitch/2,orientation=quatMultiply([0,Math.sin(y),0,Math.cos(y)],[Math.sin(p),0,0,Math.cos(p)]);return {yaw:this.#yaw,pitch:this.#pitch,orientation,direction:rotate(orientation,[0,0,-1])};}
  presentation(){
    const p=this.profile(),fov=p.view.hipFov+(p.view.adsFov-p.view.hipFov)*this.#fraction;
    const sensitivity=p.view.sensitivity*Math.tan(fov/2)/Math.tan(p.view.hipFov/2)*(1+(p.view.adsSensitivity-1)*this.#fraction);
    return {selected:this.#index,id:p.id,ads:this.#fraction,fov,sensitivity,recoil:p.view.effects?this.#kick:0,flash:p.view.effects?this.#flash:0,hit:this.#hit,hurt:this.#hurt,spread:(p.weapon.spread+this.#bloom)*(1-.7*this.#fraction),switchRemaining:this.#switch,bufferRemaining:this.#buffer,reloading:this.#reloading,shots:this.#shots};
  }
  /** Call once per Combat3D tick, then pass the command directly to combat.step.
   * Supply its real selected timer: spread RNG advances only for an eligible
   * requested shot. fire is a fresh pulse for precision/projectile profiles. */
  step(value){
    // Optional flags are admitted explicitly; never execute getters while
    // destructuring caller-provided records.
    if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError('command record required');
    const keys=Reflect.ownKeys(value);if(keys.some(k=>!['actor','origin','timer','held','reload'].includes(k))||!['actor','origin','timer'].every(k=>keys.includes(k)))throw new TypeError('unexpected or missing command field');
    fpsRecord(value,keys);const {actor,origin,timer:state,held=false,reload=false}=value;
    fpsId(actor);const position=fpsVector(origin);timer(state);flag(held);flag(reload);
    const p=this.profile(),aim=this.aim(),request=this.#buffer>=-EPS||(held&&p.weapon.archetype==='automatic');
    if(reload)this.#buffer=-1;
    // Match WeaponTimer exactly: cooldown tolerates <=1e-12; any positive
    // reloadRemaining enters its reload branch and cannot fire this tick.
    const fire=!reload&&request&&this.#switch<=EPS&&state.cooldown<=1e-12&&state.reloadRemaining===0&&state.ammo>0;
    let direction=aim.direction;
    if(fire){
      const spread=this.presentation().spread;
      const yaw=this.#yaw+(this.#random()*2-1)*spread,pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,this.#pitch+(this.#random()*2-1)*spread));
      const orientation=quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);direction=rotate(orientation,[0,0,-1]);this.#buffer=-1;
    }
    this.#buffer=this.#buffer>=0?this.#buffer-STEP:-1;this.#switch=Math.max(0,this.#switch-STEP);
    this.#fraction=Math.max(0,Math.min(1,this.#fraction+(this.#ads?1:-1)*STEP/p.view.adsSeconds));
    this.#bloom=Math.max(0,this.#bloom-STEP*p.handling.spreadRecovery);
    this.#kick*=Math.exp(-STEP/p.view.recoilReturn);this.#flash=Math.max(0,this.#flash-STEP);this.#hit=Math.max(0,this.#hit-STEP);this.#hurt=Math.max(0,this.#hurt-STEP);this.#reloading=state.reloadRemaining>0;
    return {actor,weapon:p.id,origin:position,direction,fire,reload};
  }
  /** Authoritative event summary supplied after combat; no damage inferred from
   * muzzle effects. Validate the whole record before changing presentation. */
  confirm(value={shot:false,hit:false,damage:0,reloading:false}){
    fpsRecord(value,['shot','hit','damage','reloading']);const {shot,hit,damage,reloading}=value;
    flag(shot);flag(hit);fpsNumber(damage,0,1000);flag(reloading);const p=this.profile();
    if(shot){this.#shots++;this.#kick=Math.min(.35,this.#kick+p.weapon.recoil);this.#flash=p.view.flashSeconds;this.#bloom=Math.min(.2,this.#bloom+p.handling.spreadKick);}
    if(hit)this.#hit=.16;if(damage>0)this.#hurt=.25;this.#reloading=reloading;
  }
}
