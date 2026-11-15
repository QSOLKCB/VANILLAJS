// SPDX-License-Identifier: Apache-2.0
import {DataModRegistry,validateModManifest,MAX_PACK_BYTES} from '../mod-sdk/index.js';
import {fpsRecord as record,fpsList as list,fpsNumber as num,fpsVector as vector,fpsId as id,defineWeapon3D} from '../combat3d/index.js';
export const FPS_PACK_KIND='qsol.vanillajs.fps-arena.v1';
export const FPS_PACK_BYTES=MAX_PACK_BYTES;
export const canonicalFPS=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const accepted=new WeakSet();
const unique=rows=>{if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new RangeError('duplicate id');};
function grid(n,min,max){num(n,min,max);if(!Number.isInteger(n*4))throw new RangeError('geometry must use 0.25m grid');}
const rgb=c=>{list(c,3);if(c.length!==3)throw new TypeError('RGB required');c.forEach(v=>num(v,0,1));};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
/** Generated collision and rendering boxes share exactly the same geometry.
 * Ramps are explicitly shallow 0.25m stair ramps using character.stepHeight.
 * They are not continuous slopes or a second character/physics implementation.
 */
export function compileFPSArena(pack){
  pack=validateFPSPack(pack);return pack.solids;
}
function compile(settings,geometry){
  const s=settings.size,solids=[];
  const add=(id,center,size,color,material='stone')=>solids.push({id,center,size,color,material,box:{min:center.map((v,i)=>v-size[i]/2),max:center.map((v,i)=>v+size[i]/2)}});
  add('floor',[0,-.5,0],[s,1,s],settings.palette.floor);
  // Bound even the highest admitted 8m platform plus a standing jump.
  add('west',[-s/2-.5,6,0],[1,12,s+2],settings.palette.wall);add('east',[s/2+.5,6,0],[1,12,s+2],settings.palette.wall);
  add('north',[0,6,-s/2-.5],[s,12,1],settings.palette.wall);add('south',[0,6,s/2+.5],[s,12,1],settings.palette.wall);
  for(const [index,b] of geometry.blocks.entries())add('block-'+index,[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2],[b.w,b.h,b.d],settings.palette[b.color],b.material);
  for(const [index,r] of geometry.ramps.entries()){const n=r.h*4;
    for(let i=0;i<n;i++){const height=(i+1)/4,depth=r.d/n,z=r.direction===1?r.z+i*depth:r.z+r.d-(i+1)*depth;
      add('ramp-'+index+'-'+i,[r.x+r.w/2,r.y+height/2,z+depth/2],[r.w,height,depth],settings.palette[r.color]);}
  }
  return freeze(solids);
}
export function validateFPSPack(source){
  if(accepted.has(source))return source;
  if(typeof source==='string'){if(source.length>MAX_PACK_BYTES||new TextEncoder().encode(source).length>MAX_PACK_BYTES)throw new RangeError('FPS pack exceeds 32 KiB');source=JSON.parse(source);}
  const manifest=validateModManifest(source),keys=['settings','geometry','spawns','arsenal','bots','waves'];
  if(manifest.requires.length||manifest.entries.length!==keys.length||manifest.entries.some(e=>!keys.includes(e.id)))throw new TypeError('six standalone FPS entries required');
  const {settings,geometry,spawns,arsenal,bots,waves}=Object.fromEntries(manifest.entries.map(e=>[e.id,e.data]));
  record(settings,['kind','title','size','palette','rules','difficulty']);
  if(settings.kind!==FPS_PACK_KIND||typeof settings.title!=='string'||settings.title.length<1||settings.title.length>48)throw new TypeError('FPS kind/title');
  num(settings.size,24,64,true);if(settings.size%2)throw new RangeError('even arena size');
  record(settings.palette,['floor','wall','accent','cover','enemy']);Object.values(settings.palette).forEach(rgb);
  const rules=settings.rules;record(rules,['durationTicks','scoreLimit','respawnTicks','waveGap','friendlyFire','selfDamage','playerHealth','playerArmour']);
  for(const [k,min,max] of [['durationTicks',600,36000],['scoreLimit',1,50],['respawnTicks',60,600],['waveGap',60,300],['playerHealth',50,300],['playerArmour',0,100]])num(rules[k],min,max,true);
  for(const k of ['friendlyFire','selfDamage'])if(typeof rules[k]!=='boolean')throw new TypeError('boolean rule required');
  record(settings.difficulty,['easy','normal','hard']);for(const d of Object.values(settings.difficulty)){record(d,['reaction','error']);num(d.reaction,6,120,true);num(d.error,.005,.3);}
  record(geometry,['blocks','ramps']);const half=settings.size/2;
  function primitive(b,fields){record(b,fields);id(b.id);for(const k of ['x','z'])grid(b[k],-half,half);grid(b.y,0,6);grid(b.w,.5,16);grid(b.d,.5,16);grid(b.h,.25,6);
    if(b.x+b.w>half||b.z+b.d>half||b.y+b.h>8)throw new RangeError('geometry outside bounds');if(!Object.hasOwn(settings.palette,b.color))throw new TypeError('palette key');}
  list(geometry.blocks,32).forEach(b=>{primitive(b,['id','x','y','z','w','h','d','material','color']);if(!['stone','wood'].includes(b.material))throw new TypeError('material');});unique(geometry.blocks);
  list(geometry.ramps,4).forEach(r=>{primitive(r,['id','x','y','z','w','h','d','direction','color']);num(r.h,.25,4);if(r.d<r.h*2||![1,-1].includes(r.direction))throw new RangeError('ramp must have a shallow rise and cardinal direction');});unique(geometry.ramps);
  const solids=compile(settings,geometry);
  function position(p,height=1.8){vector(p);if(p[0]<-half+.5||p[0]>half-.5||p[2]<-half+.5||p[2]>half-.5||p[1]<0||p[1]>6)throw new RangeError('spawn/pickup outside arena');
    const min=[p[0]-.36,p[1]+.00001,p[2]-.36],max=[p[0]+.36,p[1]+height,p[2]+.36];
    if(solids.some(s=>min.every((v,i)=>v<s.box.max[i]&&max[i]>s.box.min[i])))throw new RangeError('spawn/pickup intersects geometry');
    if(!solids.some(s=>Math.abs(s.box.max[1]-p[1])<.00001&&p[0]-.35>=s.box.min[0]&&p[0]+.35<=s.box.max[0]&&p[2]-.35>=s.box.min[2]&&p[2]+.35<=s.box.max[2]))throw new RangeError('spawn/pickup must have support');
  }
  record(spawns,['player','bots','pickups']);position(spawns.player);
  if(!list(spawns.bots,8).length)throw new RangeError('bot spawns required');spawns.bots.forEach(p=>position(p));
  const all=[spawns.player,...spawns.bots];for(let i=0;i<all.length;i++)for(let j=0;j<i;j++)if(Math.hypot(...all[i].map((v,k)=>v-all[j][k]))<1.5)throw new RangeError('spawns too close');
  list(spawns.pickups,8).forEach(p=>{record(p,['id','position','kind','amount']);id(p.id);position(p.position,.5);if(!['ammo','health'].includes(p.kind))throw new TypeError('pickup kind');num(p.amount,1,100,true);});unique(spawns.pickups);
  record(arsenal,['weapons']);if(list(arsenal.weapons,3).length!==3)throw new RangeError('three weapons required');arsenal.weapons.forEach(defineWeapon3D);unique(arsenal.weapons);
  if(new Set(arsenal.weapons.map(w=>w.archetype)).size!==3)throw new RangeError('one of each weapon archetype required');
  record(bots,['types']);if(!list(bots.types,3).length)throw new RangeError('bot types required');
  bots.types.forEach(b=>{record(b,['id','health','armour','speed','range','cadence','weapon','color']);id(b.id);num(b.health,20,300);num(b.armour,0,100);num(b.speed,1,6);num(b.range,3,60);num(b.cadence,6,180,true);rgb(b.color);if(!arsenal.weapons.some(w=>w.id===b.weapon))throw new TypeError('unknown bot weapon');});unique(bots.types);
  record(waves,['rosters']);if(!list(waves.rosters,5).length)throw new RangeError('waves required');waves.rosters.forEach(roster=>{if(!list(roster,8).length||roster.length>spawns.bots.length)throw new RangeError('wave exceeds spawn budget');roster.forEach(key=>{if(!bots.types.some(b=>b.id===key))throw new TypeError('unknown wave bot');});});
  const result=Object.freeze({manifest,bytes:canonicalFPS(manifest),settings,geometry,spawns,arsenal,bots,waves,solids});accepted.add(result);return result;
}
export class FPSPackSlot {
  #registry=null;#pack=null;
  constructor(source){if(source!==undefined)this.replace(source);}
  get pack(){return this.#pack;}
  list(){return this.#registry?.list()??[];}
  replace(source){const pack=validateFPSPack(source),registry=new DataModRegistry();registry.register(pack.manifest);registry.activate(pack.manifest.id);this.#registry=registry;this.#pack=pack;return pack;}
}
