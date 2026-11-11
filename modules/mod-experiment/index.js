// SPDX-License-Identifier: Apache-2.0
// Typed, data-only adapter. The existing registry remains the authority on packs.
import {DataModRegistry,validateModManifest} from '../mod-sdk/index.js';
import {stateVector,ternaryMatrix,affineTransform} from '../gf3/index.js';
import {eventMapping} from '../symbolic-events/index.js';
export const EXPERIMENT_KIND='qsol.ternary-experiment.v1';
function fields(x,names){
  // Input here has already been recursively copied by validateModManifest.
  if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).length!==names.length||names.some(k=>!Object.hasOwn(x,k)))
    throw new TypeError('exact experiment fields required: '+names.join(', '));
}
function compile(data){
  fields(data,['kind','dimension','initial','target','transforms','parity','mapping','spatial','palette','maxTicks']);
  if(data.kind!==EXPERIMENT_KIND||!Number.isInteger(data.dimension)||data.dimension<2||data.dimension>4)
    throw new RangeError('experiment dimension must be 2..4');
  const initial=stateVector(data.initial),target=stateVector(data.target),parity=ternaryMatrix(data.parity);
  if(initial.length!==data.dimension||target.length!==data.dimension||parity[0].length!==data.dimension)
    throw new RangeError('experiment dimensions differ');
  if(!Array.isArray(data.transforms)||data.transforms.length<1||data.transforms.length>8)
    throw new RangeError('1..8 transformations required');
  const operations=data.transforms.map(op=>{
    fields(op,['id','matrix','offset']);
    const out=affineTransform(op.id,op.matrix,op.offset);
    if(out.offset.length!==data.dimension)throw new RangeError('transform dimension differs');
    return out;
  });
  if(new Set(operations.map(op=>op.id)).size!==operations.length)throw new RangeError('duplicate transform ID');
  if(!['gentle','swift'].includes(data.spatial))throw new TypeError('unknown spatial preset');
  if(!Array.isArray(data.palette)||data.palette.length!==3||
    data.palette.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/.test(c)))throw new TypeError('three lowercase hex colors required');
  if(!Number.isInteger(data.maxTicks)||data.maxTicks<1||data.maxTicks>32)throw new RangeError('tick budget must be 1..32');
  return Object.freeze({source:data,initial,target,parity,operations:Object.freeze(operations),mapping:eventMapping(data.mapping)});
}
export function validateExperimentMod(input){
  const source=validateModManifest(input);
  if(source.entries.length<1)throw new RangeError('experiment pack has no entries');
  for(const entry of source.entries)compile(entry.data);
  return source;
}
export function registerExperimentMod(registry,input){
  if(!(registry instanceof DataModRegistry))throw new TypeError('DataModRegistry required');
  return registry.register(validateExperimentMod(input));
}
export function activeExperiments(registry){
  if(!(registry instanceof DataModRegistry))throw new TypeError('DataModRegistry required');
  return Object.freeze(registry.activeEntries().filter(r=>r.entry.data?.kind===EXPERIMENT_KIND)
    .map(r=>Object.freeze({modId:r.modId,version:r.version,entryId:r.entry.id,experiment:compile(r.entry.data)})));
}
