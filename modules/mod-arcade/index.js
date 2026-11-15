// SPDX-License-Identifier: Apache-2.0
import {DataModRegistry,validateModManifest,MAX_PACK_BYTES} from '../mod-sdk/index.js';
import {combatInteger as int,combatRecord as record,combatArray as list,defineAttack2D,createCombatWorld} from '../combat2d/index.js';

export const ARCADE_PACK_KIND='qsol.vanillajs.arcade-action.v1';
export const ARCADE_PACK_BYTES=MAX_PACK_BYTES;
const accepted=new WeakSet();
const slug=value=>{if(typeof value!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(value))throw new TypeError('arcade identifier required');return value;};
export const canonicalArcadeJSON=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function point(p,width,height) {record(p,['x','y']);int(p.x,'x',0,width);int(p.y,'y',0,height);}
function unique(rows) {if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new RangeError('duplicate identifier');}
function stage(s,definitions,mode) {
  record(s,['kind','width','height','ground','spawn','exit','solids','platforms','encounters','pickups']);
  if(s.kind!==ARCADE_PACK_KIND)throw new TypeError('unsupported arcade stage version');
  int(s.width,'stage width',9600,60000);int(s.height,'height',5400,12000);int(s.ground,'ground',0,1000);
  point(s.spawn,s.width,s.height-600);point(s.exit,s.width,s.height-600);
  int(s.spawn.x,'spawn x',180,s.width-180);
  int(s.exit.x,'exit x',180,s.width-180);
  if(s.spawn.y<s.ground || s.exit.y<s.ground)throw new RangeError('spawn/exit below ground');
  list(s.solids,32).forEach(v=>{record(v,['id','box']);int(v.id,'solid id',1,1000000);record(v.box,['minX','minY','maxX','maxY']);
    for(const k of ['minX','maxX'])int(v.box[k],k,0,s.width);
    for(const k of ['minY','maxY'])int(v.box[k],k,s.ground,s.height);
    if(v.box.minX>=v.box.maxX||v.box.minY>=v.box.maxY)throw new RangeError('invalid solid');});unique(s.solids);
  list(s.platforms,16).forEach(p=>{record(p,['x1','x2','y']);int(p.x1,'platform x1',0,s.width);int(p.x2,'platform x2',p.x1+1,s.width);int(p.y,'platform y',s.ground,s.height-600);});
  if(mode==='arena' && s.platforms.length)throw new RangeError('arena has no platform height axis');
  let previous=-1,total=0;
  list(s.encounters,6).forEach(e=>{
    record(e,['trigger','spawns']);int(e.trigger,'encounter trigger',0,s.width);
    if(e.trigger<previous)throw new RangeError('encounters must be ordered');previous=e.trigger;
    if(!list(e.spawns,6).length)throw new RangeError('empty encounter');
    e.spawns.forEach(p=>{record(p,['actor','x','y']);if(!definitions.has(p.actor)||p.actor==='player')throw new RangeError('unknown enemy');
      point({x:p.x,y:p.y},s.width,s.height-600);int(p.x,'enemy x',180,s.width-180);if(p.y<s.ground)throw new RangeError('enemy below ground');});
    total+=e.spawns.length;
  });
  if(!s.encounters.length || total>36)throw new RangeError('encounter population limit');
  list(s.pickups,16).forEach(p=>point(p,s.width,s.height-600));
  // Point collision is the motion2d contract; forbid initial point/solid overlaps.
  for(const p of [s.spawn,...s.encounters.flatMap(e=>e.spawns)])if(s.solids.some(v=>p.x>v.box.minX&&p.x<v.box.maxX&&p.y>=v.box.minY&&p.y<v.box.maxY))throw new RangeError('spawn inside obstacle');
}
/** Native Mod SDK manifest, four typed entries. JSON text is bounded before parse. */
export function validateArcadePack(source) {
  if(accepted.has(source))return source;
  if(typeof source==='string') {
    if(source.length>MAX_PACK_BYTES || new TextEncoder().encode(source).length>MAX_PACK_BYTES)throw new RangeError('arcade pack exceeds 32 KiB');
    source=JSON.parse(source);
  }
  const manifest=validateModManifest(source);
  if(manifest.requires.length || manifest.entries.length!==4 || manifest.entries.some(e=>!['settings','combat','run','arena'].includes(e.id)))throw new TypeError('four standalone arcade entries required');
  const data=Object.fromEntries(manifest.entries.map(e=>[e.id,e.data])),{settings,combat,run,arena}=data;
  record(settings,['kind','title','palette','music','rules']);
  if(settings.kind!==ARCADE_PACK_KIND || typeof settings.title!=='string'||settings.title.length<1||settings.title.length>60)throw new TypeError('arcade kind/title');
  record(settings.palette,['sky','ink','accent','enemy','steel']);
  if(Object.values(settings.palette).some(v=>typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v)))throw new TypeError('six-digit palette colour required');
  if(!['forge','pulse'].includes(settings.music))throw new TypeError('unknown music');
  record(settings.rules,['killScore','pickupScore','heal','easy','normal','hard']);
  for(const k of ['killScore','pickupScore'])int(settings.rules[k],k,0,10000);
  int(settings.rules.heal,'heal',1,1000);
  for(const k of ['easy','normal','hard']) {const d=settings.rules[k];record(d,['healthPercent','damagePercent']);int(d.healthPercent,'healthPercent',25,300);int(d.damagePercent,'damagePercent',25,300);}
  record(combat,['kind','moves','actors']);if(combat.kind!==ARCADE_PACK_KIND)throw new TypeError('combat kind');
  list(combat.moves,8).forEach(m=>{record(m,['id','attack']);slug(m.id);defineAttack2D(m.attack);});unique(combat.moves);
  const moveIds=new Set(combat.moves.map(m=>m.id));
  const maxDamagePercent=Math.max(...['easy','normal','hard'].map(k=>settings.rules[k].damagePercent));
  if(combat.moves.some(m=>Math.trunc(m.attack.damage*maxDamagePercent/100)>1000))throw new RangeError('scaled attack damage exceeds combat bound');
  list(combat.actors,5).forEach(a=>{
    record(a,['id','health','speed','behaviour','light','heavy','hurtbox','projectile']);slug(a.id);
    int(a.health,'health',1,3000);int(a.speed,'speed',1,128);
    if(!['player','pursue','sentry','brute'].includes(a.behaviour)||!moveIds.has(a.light)||!moveIds.has(a.heavy))throw new TypeError('actor behaviour/move');
    if((a.id==='player')!==(a.behaviour==='player'))throw new TypeError('player identity');
    createCombatWorld({actors:[{id:1,team:0,x:0,y:0,faceX:1,faceY:0,health:a.health,hurtbox:a.hurtbox}]});
    const p=a.projectile;record(p,['speed','damage','lifetime','radius','cooldown','knockback','stun','invulnerability']);
    for(const [k,min,max] of [['speed',1,4096],['damage',1,300],['lifetime',1,600],['radius',0,128],['cooldown',2,240],['knockback',0,512],['stun',0,240],['invulnerability',0,240]])int(p[k],k,min,max);
  });unique(combat.actors);
  const definitions=new Set(combat.actors.map(a=>a.id));if(!definitions.has('player'))throw new RangeError('player definition required');
  stage(run,definitions,'run');stage(arena,definitions,'arena');
  const bytes=canonicalArcadeJSON(manifest);
  const pack=Object.freeze({manifest,bytes,settings,combat,run,arena});accepted.add(pack);return pack;
}
/** Domain validation precedes registry publication. Failed replacement preserves
 * the previous registry and accepted bytes. No hooks or executable extensions. */
export class ArcadePackSlot {
  #registry=null; #pack=null;
  constructor(source) {if(source!==undefined)this.replace(source);}
  get pack(){return this.#pack;}
  list(){return this.#registry?.list()??[];}
  replace(source) {
    const pack=validateArcadePack(source),registry=new DataModRegistry();
    registry.register(pack.manifest);registry.activate(pack.manifest.id);
    this.#registry=registry;this.#pack=pack;return pack;
  }
}
