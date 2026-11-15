// SPDX-License-Identifier: Apache-2.0
// Typed data packs; no executable imports, callbacks, URLs or HTML in content.
import {DataModRegistry, validateModManifest} from '../mod-sdk/index.js';
export const FOOTBALL_BUNDLE = 'qsol.football-content.v1';
export const PLAYER_FIELDS = Object.freeze(['id','name','role','pace','passing','finishing','defending','keeping','stamina','condition','morale','sharpness']);
const roles=['GK','DF','MF','FW'];
export function copyFootballData(input, {maxBytes=262144,maxNodes=30000}={}) {
  if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>1048576||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>100000)throw new RangeError('Invalid football copy budget');
  let nodes=0;
  function copy(x,depth=0) {
    if(++nodes>maxNodes||depth>16)throw new RangeError('football data exceeds structural budget');
    if(x===null||typeof x==='boolean')return x;
    if(typeof x==='number'&&Number.isFinite(x))return x;
    if(typeof x==='string'&&x.length<=8192)return x;
    if(!x||typeof x!=='object'||!([Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(x))))throw new TypeError('plain football data required');
    const out=Array.isArray(x)?[]:{};
    for(const key of Reflect.ownKeys(x)) {
      if(Array.isArray(x)&&key==='length')continue;
      const d=Object.getOwnPropertyDescriptor(x,key);
      if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))throw new TypeError('plain enumerable data fields required');
      out[key]=copy(d.value,depth+1);
    }
    return out;
  }
  const result=copy(input);
  if(new TextEncoder().encode(JSON.stringify(result)).byteLength>maxBytes)throw new RangeError('football data exceeds byte budget');
  return result;
}
function fields(x,keys){if(!x||Array.isArray(x)||typeof x!=='object'||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))throw new TypeError('Expected fields: '+keys.join(', '));}
function integer(n,lo,hi,label){if(!Number.isInteger(n)||n<lo||n>hi)throw new RangeError(`${label}: expected ${lo}..${hi}`);}
function text(s,max,label){if(typeof s!=='string'||!s.trim()||s.length>max||/[\u0000-\u001f]/.test(s))throw new TypeError(label+' must be short plain text');}
function id(s){if(typeof s!=='string'||! /^[a-z][a-z0-9-]{0,47}$/.test(s))throw new TypeError('Invalid football ID');}
function array(x,lo,hi,label){if(!Array.isArray(x)||x.length<lo||x.length>hi||Object.keys(x).length!==x.length)throw new RangeError(label+': invalid array size');}
function unique(xs,label){if(new Set(xs).size!==xs.length)throw new TypeError('Duplicate '+label);}
function player(p){fields(p,PLAYER_FIELDS);id(p.id);text(p.name,40,'Player name');if(!roles.includes(p.role))throw new TypeError('Unknown player role');for(const k of PLAYER_FIELDS.slice(3))integer(p[k],1,100,k);return p;}
export function validatePlayer(p){return player(copyFootballData(p));}
function formation(f){fields(f,['id','name','slots']);id(f.id);text(f.name,40,'Formation name');array(f.slots,11,11,'Formation slots');f.slots.forEach((slot,i)=>{array(slot,3,3,'Slot');integer(slot[0],10,90,'Slot x');integer(slot[1],2,48,'Slot depth');if(!roles.includes(slot[2])||(i===0)!==(slot[2]==='GK'))throw new TypeError('Slot zero must be the only goalkeeper');});return f;}
function club(c){fields(c,['id','name','short','region','style','color','dark','accent','attack','press','pass','players']);id(c.id);for(const k of ['name','region','style'])text(c[k],80,k);text(c.short,4,'Club short name');for(const k of ['color','dark','accent'])if(!/^#[a-fA-F0-9]{6}$/.test(c[k]))throw new TypeError('Six-digit kit colors required');for(const k of ['attack','press','pass'])integer(c[k],1,100,k);array(c.players,16,22,'Squad');c.players.forEach(player);unique(c.players.map(p=>p.id),'player ID');if(c.players.filter(p=>p.role==='GK').length<2)throw new TypeError('Two goalkeepers required per club');if(c.players.filter(p=>p.role!=='GK').length<10)throw new TypeError('Ten outfield players required per club');return c;}
function rules(r){fields(r,['seconds','fatigue','homeAdvantage','startingBudget','gate','prize','wage','trainingCost','transferCost']);integer(r.seconds,20,180,'Match seconds');integer(r.fatigue,0,30,'Match fatigue');integer(r.homeAdvantage,0,10,'Home advantage');for(const k of ['startingBudget','gate','prize','wage','trainingCost','transferCost'])integer(r[k],0,10000000,k);return r;}
function entry(d){fields(d,['kind','value']);if(d.kind==='qsol.football-club.v1')club(d.value);else if(d.kind==='qsol.football-formation.v1')formation(d.value);else if(d.kind==='qsol.football-rules.v1')rules(d.value);else throw new TypeError('Unknown football entry kind');}
export function validateFootballMod(input){const pack=validateModManifest(input);if(!pack.entries.length)throw new TypeError('Empty football pack');pack.entries.forEach(e=>entry(e.data));return pack;}
export function registerFootballMod(registry,input){if(!(registry instanceof DataModRegistry))throw new TypeError('DataModRegistry required');return registry.register(validateFootballMod(input));}
export function activeFootballContent(registry){
  if(!(registry instanceof DataModRegistry))throw new TypeError('DataModRegistry required');
  const content={clubs:[],formations:[],rules:null};
  for(const {entry:e} of registry.activeEntries()) {
    entry(e.data);const {kind,value}=e.data;
    if(kind==='qsol.football-club.v1')content.clubs.push(value);
    else if(kind==='qsol.football-formation.v1')content.formations.push(value);
    else {if(content.rules)throw new TypeError('Exactly one rules entry required');content.rules=value;}
  }
  array(content.clubs,2,16,'Clubs');if(content.clubs.length%2)throw new TypeError('Even club count required');array(content.formations,1,8,'Formations');
  unique(content.clubs.map(c=>c.id),'club ID');unique(content.formations.map(f=>f.id),'formation ID');
  unique(content.clubs.flatMap(c=>c.players.map(p=>p.id)),'global player ID');
  if(!content.rules)throw new TypeError('Missing rules entry');
  return copyFootballData(content);
}
export function loadFootballBundle(input){
  const bundle=copyFootballData(input);fields(bundle,['kind','packs']);if(bundle.kind!==FOOTBALL_BUNDLE)throw new TypeError('Unsupported football bundle');array(bundle.packs,1,24,'Packs');
  const registry=new DataModRegistry();for(const pack of bundle.packs)registerFootballMod(registry,pack);
  for(const pack of bundle.packs)registry.activate(pack.id);
  return {bundle,content:activeFootballContent(registry)};
}
function tactics(t){fields(t,['formation','mentality','press','tempo','width']);id(t.formation);for(const key of ['mentality','press','tempo','width'])integer(t[key],0,100,key);return t;}
export function validateTactics(input){return tactics(copyFootballData(input));}
export function validateMatchSetup(input){
  const s=copyFootballData(input);fields(s,['seed','rules','formations','teams','weather']);integer(s.seed,1,4294967295,'Seed');rules(s.rules);
  if(!['clear','rain'].includes(s.weather))throw new TypeError('Unknown weather');array(s.formations,1,8,'Formations');s.formations.forEach(formation);unique(s.formations.map(f=>f.id),'formation ID');array(s.teams,2,2,'Teams');
  for(const t of s.teams){fields(t,['club','players','tactics','cohesion']);club(t.club);array(t.players,11,11,'Starting eleven');t.players.forEach(player);unique(t.players.map(p=>p.id),'starting player');if(t.players.some(p=>{const member=t.club.players.find(q=>q.id===p.id);return !member||PLAYER_FIELDS.some(k=>member[k]!==p[k]);}))throw new TypeError('Starters must match squad records');if(t.players[0].role!=='GK'||t.players.slice(1).some(p=>p.role==='GK'))throw new TypeError('Select a goalkeeper first and ten outfield players');tactics(t.tactics);if(!s.formations.some(f=>f.id===t.tactics.formation))throw new TypeError('Unknown formation');integer(t.cohesion,1,100,'Cohesion');}
  unique(s.teams.flatMap(t=>t.club.players.map(p=>p.id)),'squad player ID');
  if(s.teams[0].club.id===s.teams[1].club.id)throw new TypeError('Two different clubs required');unique(s.teams.flatMap(t=>t.players.map(p=>p.id)),'match player ID');return s;
}
