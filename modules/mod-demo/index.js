// SPDX-License-Identifier: Apache-2.0
import {validateModManifest,DataModRegistry,MAX_PACK_BYTES} from '../mod-sdk/index.js';
import {createSoundtrack} from '../soundtrack/index.js';
import {textVoxels} from '../demo-scene/index.js';
import {DEMO_RATE,DEMO_SAMPLES,demoSample} from '../demo-timeline/index.js';
export const DEMO_KIND='qsol.vanillajs.demoscene.v1';
export const DEMO_EFFECTS=Object.freeze(['rotate','lattice','radial','tunnel','extrude','dissolve']);
export const canonicalDemo=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const brands=new WeakSet();
const record=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw new TypeError('plain record required');const d=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(v);if(own.length!==keys.length||own.some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(d[k]??{},'value')))throw new TypeError('unexpected, missing or accessor field');};
const num=(v,min,max,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isSafeInteger(v)))throw new RangeError('number outside profile bounds');};
const list=(a,max)=>{if(!Array.isArray(a)||a.length>max)throw new RangeError('array budget exceeded');return a;};
const vec=(v,min=-1000,max=1000)=>{if(list(v,3).length!==3)throw new TypeError('XYZ required');v.forEach(x=>num(x,min,max));};
const id=v=>{if(typeof v!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(v))throw new TypeError('invalid ID');};
const label=(v,max=96)=>{if(typeof v!=='string'||!v.length||v.length>max||/[^A-Z0-9 .,!?/:\-]/.test(v))throw new TypeError('supported original uppercase text required');};
const licenses=['Apache-2.0','MIT','CC0-1.0','CC-BY-4.0','OWNER-LOCAL-ONLY'];
const unique=rows=>{if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new TypeError('duplicate ID');};
function provenance(p){record(p,['author','license','source','sha256']);if(!licenses.includes(p.license)||typeof p.author!=='string'||p.author.length<1||p.author.length>80||typeof p.source!=='string'||p.source.length<1||p.source.length>160||typeof p.sha256!=='string'||!(/^[a-f0-9]{64}$/.test(p.sha256)||p.sha256==='original-procedural'))throw new TypeError('invalid provenance');}
function keys(rows,fields){if(!list(rows,8).length)throw new RangeError('keyframes required');let previous=-1;for(const k of rows){record(k,['sample',...fields]);demoSample(k.sample);if(k.sample<=previous)throw new RangeError('keyframes must be strictly ordered');previous=k.sample;for(const field of fields){if(field==='fov')num(k[field],.2,2.5);else vec(k[field],field==='scale'?.01:-1000,field==='scale'?40:1000);}}if(rows[0].sample!==0)throw new RangeError('first keyframe must be sample zero');}
/** Four integer lanes, 32 eighth-note cells per 7.5s phrase (128 BPM).
 * Frequency is integer Hz. A zero is a rest. Envelopes/noise use audio2d unchanged.
 */
export function compileDemoScore(phrases,seed){
  const scores=phrases.map((p,pi)=>{const events=[];for(let channel=0;channel<4;channel++)for(let i=0;i<32;i++){
    const frequency=p.notes[channel][i];if(!frequency)continue;
    const sample=i*11250,duration=Math.min(p.gates[channel],360000-sample);
    events.push({id:channel*32+i+1,sample,duration,channel,frequency,gain:p.gains[channel],seed:(seed+pi*131+channel*37+i)>>>0,wave:p.waves[channel]});
  }return {frames:360000,events};});
  const audio=createSoundtrack({phrases:scores,tickRate:50});
  const cues=scores.flatMap((p,i)=>p.events.map(e=>({...e,sample:e.sample+i*360000}))).sort((a,b)=>a.sample-b.sample||a.channel-b.channel||a.id-b.id);
  return {audio,cues};
}
export function validateDemo(source){
  if(brands.has(source))return source;
  if(typeof source==='string'){if(source.length>MAX_PACK_BYTES||new TextEncoder().encode(source).length>MAX_PACK_BYTES)throw new RangeError('demo exceeds 32 KiB');source=JSON.parse(source);}
  record(source,['kind','manifest']);if(source.kind!==DEMO_KIND)throw new TypeError('unsupported demoscene version');
  const manifest=validateModManifest(source.manifest);
  if(manifest.version!=='1.0.0'||manifest.requires.length)throw new TypeError('standalone v1 demo required');
  const byId=new Map(manifest.entries.map(e=>[e.id,e.data]));
  if(manifest.entries.some(e=>!['settings','timeline',...Array.from({length:8},(_,i)=>'phrase-'+i)].includes(e.id)&&!/^node-|^mesh-/.test(e.id)))throw new TypeError('unknown demo entry');
  const settings=byId.get('settings'),timeline=byId.get('timeline');
  record(settings,['title','seed','engine','sampleRate','samples','audioIdentity','palette','text','provenance']);
  label(settings.title);num(settings.seed,0,4294967295,true);
  if(settings.engine!=='vanillajs-demoscene-1'||settings.sampleRate!==DEMO_RATE||settings.samples!==DEMO_SAMPLES||settings.audioIdentity!=='audio2d-pcm16le-48000-mono-v1')throw new TypeError('incompatible engine/audio profile');
  if(list(settings.palette,4).length!==4)throw new TypeError('four palette colors required');settings.palette.forEach(c=>vec(c,0,1));
  record(settings.text,['title','subtitle','scroller']);for(const t of Object.values(settings.text))label(t);provenance(settings.provenance);if(settings.text.title.length>24||settings.text.subtitle.length>32||textVoxels(settings.text.title).length+textVoxels(settings.text.subtitle).length>1000)throw new RangeError('3D title geometry budget');
  record(timeline,['scenes','camera','cueChannel']);num(timeline.cueChannel,0,3,true);
  if(list(timeline.scenes,5).length!==5)throw new TypeError('five acts required');
  timeline.scenes.forEach((s,i)=>{record(s,['id','name','start','end','effect']);id(s.id);label(s.name);if(s.start!==i*576000||s.end!==(i+1)*576000||!DEMO_EFFECTS.includes(s.effect))throw new TypeError('invalid act/effect');});unique(timeline.scenes);
  keys(timeline.camera,['position','target','fov']);
  const phrases=Array.from({length:8},(_,i)=>{const p=byId.get('phrase-'+i);record(p,['notes','gains','gates','waves']);
    if(list(p.notes,4).length!==4||list(p.gains,4).length!==4||list(p.gates,4).length!==4||list(p.waves,4).length!==4)throw new TypeError('four voice lanes required');
    p.notes.forEach(a=>{if(list(a,32).length!==32)throw new TypeError('32 score cells required');a.forEach(n=>{if(n!==0)num(n,30,8000,true);});});p.gains.forEach(n=>num(n,0,7000,true));p.gates.forEach(n=>num(n,1,11250,true));p.waves.forEach(w=>{if(!['square','triangle','saw','noise'].includes(w))throw new TypeError('wave');});return p;});
  const meshes=manifest.entries.filter(e=>e.id.startsWith('mesh-')).map(e=>{const m=e.data;record(m,['vertices','provenance']);provenance(m.provenance);if(!list(m.vertices,360).length||m.vertices.length%9)throw new RangeError('mesh chunk must contain <=120 triangle vertices');m.vertices.forEach(v=>num(v,-100,100));return {id:e.id,...m};});
  if(meshes.reduce((n,m)=>n+m.vertices.length/3,0)>1536)throw new RangeError('total mesh vertex budget');
  const nodes=manifest.entries.filter(e=>e.id.startsWith('node-')).map(e=>{const n=e.data;record(n,['name','meshes','effect','copies','color','keys','provenance']);label(n.name);provenance(n.provenance);if(!DEMO_EFFECTS.includes(n.effect))throw new TypeError('effect');num(n.copies,1,48,true);vec(n.color,0,1);keys(n.keys,['position','rotation','scale']);list(n.meshes,13).forEach(ref=>{if(!meshes.some(m=>m.id===ref))throw new TypeError('unresolved mesh');});if(new Set(n.meshes).size!==n.meshes.length)throw new TypeError('duplicate mesh reference');return {id:e.id,...n};});
  if(nodes.length>16||nodes.reduce((n,x)=>n+x.copies*Math.max(36,x.meshes.reduce((s,id)=>s+meshes.find(m=>m.id===id).vertices.length/3,0)),0)>24000)throw new RangeError('composition work budget');
  const bytes=canonicalDemo({kind:DEMO_KIND,manifest});if(new TextEncoder().encode(bytes).length>MAX_PACK_BYTES)throw new RangeError('demo exceeds 32 KiB');
  const {audio,cues}=compileDemoScore(phrases,settings.seed);
  const result=Object.freeze({manifest,bytes,settings,timeline,phrases,meshes:Object.freeze(meshes.map(Object.freeze)),nodes:Object.freeze(nodes.map(Object.freeze)),audio,cues:Object.freeze(cues.map(Object.freeze))});brands.add(result);return result;
}
/** Candidate is fully validated before any active registry state changes. */
export class DemoProjectSlot {
  #project;#registry;
  constructor(source){if(source!==undefined)this.replace(source);}
  get project(){return this.#project;}
  replace(source){const candidate=validateDemo(source),registry=new DataModRegistry();registry.register(candidate.manifest);registry.activate(candidate.manifest.id);this.#project=candidate;this.#registry=registry;return candidate;}
  list(){return this.#registry?.list()??[];}
}
