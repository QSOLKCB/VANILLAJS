// SPDX-License-Identifier: Apache-2.0
// Independently authored creative receiver. Source coordinates have no intrinsic pitch.
import {generateE8Roots} from '../../experiments/e8-geometry/index.js';
import {createSound2D,AUDIO2D_RATE} from '../../modules/audio2d/index.js';

export const RECIPE_KIND='qsol.soundtrack-recipe.v1';
export const MAX_RECIPE_BYTES=4096;
const ROOTS=generateE8Roots();
const WAVES=['triangle','square','saw'];
function record(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||
    ![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError(label+' must be a plain record');
  const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(value);
  if(actual.length!==keys.length||actual.some(key=>!keys.includes(key))||
    keys.some(key=>!Object.hasOwn(descriptors,key)||!Object.hasOwn(descriptors[key],'value')))
    throw new TypeError(label+' has unexpected or missing fields');
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}
function integer(value,min,max,label){
  if(!Number.isSafeInteger(value)||value<min||value>max||Object.is(value,-0))
    throw new RangeError(`${label} must be a whole number from ${min} to ${max}`);
  return value;
}
function pitches(value){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length!==5||
    Reflect.ownKeys(value).length!==6)throw new TypeError('Supply exactly five integer pitches');
  return Object.freeze(Array.from({length:5},(_,i)=>{
    const field=Object.getOwnPropertyDescriptor(value,String(i));
    if(!field||!Object.hasOwn(field,'value'))throw new TypeError('Pitches must contain plain values');
    return integer(field.value,30,2000,'Pitch');
  }));
}
/** Versioned, owned authoring data; no executable content or ambient randomness. */
export function validateRecipe(input){
  const recipe=record(input,['kind','source','mapping'],'Recipe');
  if(recipe.kind!==RECIPE_KIND)throw new TypeError('Unsupported soundtrack recipe version');
  // Inspect the discriminant without invoking accessors.
  const kind=Object.getOwnPropertyDescriptor(recipe.source??{},'kind')?.value;
  let source;
  if(kind==='e8-coordinate'){
    source=record(recipe.source,['kind','start','stride','axis'],'E8 source');
    integer(source.start,0,239,'Root start');integer(source.stride,1,239,'Root stride');integer(source.axis,0,7,'Coordinate');
  }else if(kind==='three-state'){
    source=record(recipe.source,['kind','start','stride'],'Three-state source');
    integer(source.start,0,2,'Initial state');integer(source.stride,1,2,'State step');
  }else throw new TypeError('Choose an E8 coordinate or three-state source');
  const mapping=record(recipe.mapping,['tempo','steps','frequencies','wave','gain'],'Musical mapping');
  integer(mapping.tempo,60,240,'Tempo');integer(mapping.steps,4,16,'Steps');
  integer(mapping.gain,0,6000,'Gain');
  if(!WAVES.includes(mapping.wave))throw new TypeError('Choose triangle, square or saw');
  mapping.frequencies=pitches(mapping.frequencies);
  return Object.freeze({kind:RECIPE_KIND,source:Object.freeze(source),mapping:Object.freeze(mapping)});
}
export function parseRecipe(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_RECIPE_BYTES)
    throw new RangeError('Recipe must be at most 4 KiB');
  return validateRecipe(JSON.parse(text));
}
export function serializeRecipe(recipe){return JSON.stringify(validateRecipe(recipe),null,2)+'\n';}

/** Eighth notes use absolute sample boundaries, so non-dividing tempi never drift. */
export function compileSoundtrack(input){
  const recipe=validateRecipe(input),{source,mapping}=recipe;
  const boundary=i=>Math.floor(i*AUDIO2D_RATE*30/mapping.tempo);
  const sources=[],events=[];
  for(let i=0;i<mapping.steps;i++){
    let observation;
    if(source.kind==='e8-coordinate'){
      const rootIndex=(source.start+i*source.stride)%240,coordinate=ROOTS[rootIndex][source.axis];
      observation={step:i,rootIndex,coordinate,degree:2*coordinate+2};
    }else{
      const state=(source.start+i*source.stride)%3;
      observation={step:i,state,degree:state};
    }
    sources.push(Object.freeze(observation));
    events.push(Object.freeze({id:i+1,sample:boundary(i),duration:Math.floor((boundary(i+1)-boundary(i))*4/5),
      channel:0,frequency:mapping.frequencies[observation.degree],wave:mapping.wave,gain:mapping.gain,seed:0}));
  }
  const frames=boundary(mapping.steps),sound=createSound2D({frames,events});
  return Object.freeze({recipe,sources:Object.freeze(sources),events:Object.freeze(events),frames,sound});
}

export const PRESETS=Object.freeze({
  chart:validateRecipe({kind:RECIPE_KIND,source:{kind:'e8-coordinate',start:112,stride:17,axis:1},
    mapping:{tempo:120,steps:16,frequencies:[220,262,294,330,392],wave:'triangle',gain:5000}}),
  race:validateRecipe({kind:RECIPE_KIND,source:{kind:'three-state',start:0,stride:1},
    mapping:{tempo:180,steps:16,frequencies:[220,330,440,550,660],wave:'square',gain:2400}}),
  outpost:validateRecipe({kind:RECIPE_KIND,source:{kind:'e8-coordinate',start:130,stride:29,axis:5},
    mapping:{tempo:80,steps:8,frequencies:[147,175,196,220,262],wave:'triangle',gain:4000}})
});
