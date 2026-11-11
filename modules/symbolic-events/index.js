// SPDX-License-Identifier: Apache-2.0
// A declared composition rule. Algebra has no inherent pitch or timbre.
import {stateVector} from '../gf3/index.js';
import {createSound2D,AUDIO2D_RATE} from '../audio2d/index.js';
export const EVENT_KIND='qsol.symbolic-event.v1';
export const MAPPING_KIND='qsol.ternary-score.v1';
export const MAX_EVENT_TICKS=32;
export const TICKS_PER_SECOND=4;
const mappings=new WeakSet(),events=new WeakSet();
function record(x,fields){
  if(!x||typeof x!=='object'||Array.isArray(x)||
    ![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw new TypeError('plain record required');
  const d=Object.getOwnPropertyDescriptors(x),keys=Reflect.ownKeys(x);
  if(keys.length!==fields.length||keys.some(k=>!fields.includes(k))||
    fields.some(k=>!Object.hasOwn(d,k)||!Object.hasOwn(d[k],'value')))
    throw new TypeError('unexpected/missing/accessor field');
  return Object.fromEntries(fields.map(k=>[k,d[k].value]));
}
export function eventMapping(source){
  const m=record(source,['kind','frequencies','wave','gain']);
  if(m.kind!==MAPPING_KIND||!['square','triangle','saw'].includes(m.wave))
    throw new TypeError('unsupported composition rule');
  const f=m.frequencies;
  if(!Array.isArray(f)||Object.getPrototypeOf(f)!==Array.prototype||f.length!==3||
    Reflect.ownKeys(f).length!==4)throw new TypeError('three integer pitches required');
  const d=Object.getOwnPropertyDescriptors(f);
  const frequencies=[0,1,2].map(i=>{
    if(!Object.hasOwn(d,i)||!Object.hasOwn(d[i],'value'))throw new TypeError('pitch must be own data');
    const x=d[i].value;
    if(!Number.isSafeInteger(x)||x<30||x>2000)throw new RangeError('pitch must be 30..2000 Hz');
    return x;
  });
  if(!Number.isSafeInteger(m.gain)||m.gain<0||m.gain>6000)throw new RangeError('gain must be 0..6000');
  const result=Object.freeze({...m,frequencies:Object.freeze(frequencies)});
  mappings.add(result);return result;
}
/** One note per transition, in integer tick order; no presentation input. */
export function transitionEvent(mapping,input){
  if(!mappings.has(mapping))throw new TypeError('compiled event mapping required');
  const t=record(input,['kind','tick','operation','before','after','id']);
  const before=stateVector(t.before),after=stateVector(t.after);
  if(t.kind!=='qsol.gf3.transition.v1'||before.length!==after.length||
    !Number.isSafeInteger(t.tick)||t.tick<1||t.tick>MAX_EVENT_TICKS||
    typeof t.operation!=='string'||! /^[a-z][a-z0-9-]{0,31}$/.test(t.operation)||
    t.id!==`${t.tick}:${t.operation}:${before.join('')}>${after.join('')}`)
    throw new TypeError('invalid transition identity');
  const note=after.reduce((sum,v)=>sum+v,0)%3;
  const e=Object.freeze({kind:EVENT_KIND,id:t.id,tick:t.tick,order:0,
    before,after,operation:t.operation,note,frequency: mapping.frequencies[note],
    durationTicks:1,wave:mapping.wave,gain:mapping.gain,visual:note});
  events.add(e);return e;
}
/** Reference PCM only: 48 kHz mono, 4 ticks/s, up to 8 s. */
export function referenceSound(log){
  if(!Array.isArray(log)||log.length<1||log.length>MAX_EVENT_TICKS||
    Reflect.ownKeys(log).length!==log.length+1)throw new RangeError('1..32 canonical events required');
  const score=[];
  for(let i=0;i<log.length;i++){
    const d=Object.getOwnPropertyDescriptor(log,String(i));
    if(!d||!Object.hasOwn(d,'value')||!events.has(d.value)||d.value.tick!==i+1)
      throw new TypeError('consecutive generated events required; replay imported configuration first');
    const e=d.value;
    score.push({id:i+1,sample:i*AUDIO2D_RATE/TICKS_PER_SECOND,
      duration:AUDIO2D_RATE/TICKS_PER_SECOND,channel:0,
      frequency:e.frequency,wave:e.wave,gain:e.gain,seed:0});
  }
  return createSound2D({frames:log.length*AUDIO2D_RATE/TICKS_PER_SECOND,events:score});
}
