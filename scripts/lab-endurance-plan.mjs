// SPDX-License-Identifier: Apache-2.0
// Strict, reproducible CI plan; browser execution lives in lab-endurance.mjs.
export const ENDURANCE_GROUPS=Object.freeze({
  racing:Object.freeze(['horizon','racing']),
  combat:Object.freeze(['block-arena','weapon-feel']),
  creator:Object.freeze(['sprite-foundry','game-maker']),
  visual:Object.freeze(['narrative-foundry','demoscene'])
});
export const DEFAULT_ITERATIONS=1000;
export const DEFAULT_SEED=7337;
export function endurancePlan(args,defaults={iterations:DEFAULT_ITERATIONS,seed:DEFAULT_SEED}){
  if(!Array.isArray(args))throw TypeError('CLI arguments must be an array');
  const fields=new Map();
  for(const arg of args){
    if(typeof arg!=='string'||!/^--(group|iterations|seed)=[a-zA-Z0-9_-]+$/.test(arg))
      throw Error('Usage: --group=racing|combat|creator|visual [--iterations=1..1000] [--seed=uint32]');
    const i=arg.indexOf('='),name=arg.slice(2,i),value=arg.slice(i+1);
    if(fields.has(name))throw Error('Duplicate option: '+name);
    fields.set(name,value);
  }
  const group=fields.get('group');
  if(!Object.hasOwn(ENDURANCE_GROUPS,group??''))throw Error('Unknown endurance group');
  function numeric(name,fallback,min,max){
    const value=fields.get(name)??String(fallback);
    if(!/^(0|[1-9][0-9]*)$/.test(value))throw Error('Invalid '+name);
    const n=Number(value);
    if(!Number.isSafeInteger(n)||n<min||n>max)throw RangeError(name+' out of bounds');
    return n;
  }
  return Object.freeze({group,labs:ENDURANCE_GROUPS[group],
    iterations:numeric('iterations',defaults.iterations,1,1000),
    seed:numeric('seed',defaults.seed,0,4294967295)});
}
export function iterationSeed(seed,index){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(index)||index<0||index>=1000)
    throw RangeError('Invalid run seed or iteration');
  let x=(seed^(Math.imul(index+1,0x9e3779b1)))>>>0;
  x^=x<<13;x^=x>>>17;x^=x<<5;
  return x>>>0;
}
