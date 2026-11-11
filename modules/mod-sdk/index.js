// SPDX-License-Identifier: Apache-2.0
// MOD-SDK-001: an offline, data-only extension registry.
// Manifests are never executable and confer no browser permissions.
export const MOD_PACK_KIND='qsol.vanillajs.mod-pack.v1';
export const MAX_PACK_BYTES=32768;
export const MAX_PACKS=32;
export const MAX_ENTRIES=32;
export const MAX_REQUIRES=8;

const NAME=/^[a-z][a-z0-9-]{0,47}$/;
const VERSION=/^(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})$/;
const HEADER=['kind','id','version','requires','entries'];
const REQUIREMENT=['id','version'];
const ENTRY=['id','kind','data'];

function record(value,fields){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     ![Object.prototype,null].includes(Object.getPrototypeOf(value)))
    throw new TypeError('plain data record required');
  const desc=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
  if(own.length!==fields.length||
     own.some(k=>typeof k!=='string'||!fields.includes(k))||
     fields.some(k=>!Object.hasOwn(desc,k)||!Object.hasOwn(desc[k],'value')))
    throw new TypeError('missing, accessor or unexpected property');
  return Object.fromEntries(fields.map(k=>[k,desc[k].value]));
}
function array(value,max){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
     value.length>max||Reflect.ownKeys(value).length!==value.length+1)
    throw new TypeError('bounded dense array required');
  const desc=Object.getOwnPropertyDescriptors(value);
  return Array.from({length:value.length},(_,i)=>{
    if(!Object.hasOwn(desc,i)||!Object.hasOwn(desc[i],'value'))
      throw new TypeError('data-only array elements required');
    return desc[i].value;
  });
}
function name(value){
  if(typeof value!=='string'||!NAME.test(value))
    throw new TypeError('canonical ID required');
  return value;
}
function version(value){
  if(typeof value!=='string'||!VERSION.test(value))
    throw new TypeError('canonical exact version required');
  return value;
}
// This is a bounded JSON-like value snapshot, not a script evaluator. Disallow
// getters, cycles, functions, symbols, exotic prototypes and prototype keys.
function cloneData(value,state,depth=0){
  if(++state.nodes>512||depth>8)throw new RangeError('data node/depth budget');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='string'){
    if(value.length>8192)throw new RangeError('data string budget');
    return value;
  }
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new TypeError('finite JSON number required');
    return value===0?0:value;
  }
  if(typeof value!=='object')throw new TypeError('JSON-only data required');
  if(state.seen.has(value))throw new TypeError('cyclic/shared data graph prohibited');
  state.seen.add(value);
  if(Array.isArray(value))
    return Object.freeze(array(value,512).map(x=>cloneData(x,state,depth+1)));
  if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))
    throw new TypeError('plain payload object required');
  const desc=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
  if(keys.length>128)throw new RangeError('data object member budget');
  const out=Object.create(null);
  for(const key of keys){
    if(typeof key!=='string'||key.length>128||
       ['__proto__','prototype','constructor'].includes(key)||
       !Object.hasOwn(desc[key],'value'))
      throw new TypeError('unsafe or accessor payload key');
    out[key]=cloneData(desc[key].value,state,depth+1);
  }
  return Object.freeze(out);
}
/** Strict, detached, deeply frozen manifest; does not interpret payloads. */
export function validateModManifest(input){
  const m=record(input,HEADER);
  if(m.kind!==MOD_PACK_KIND)throw new TypeError('unsupported mod pack kind');
  const id=name(m.id),revision=version(m.version);
  const dependencies=array(m.requires,MAX_REQUIRES),entries=array(m.entries,MAX_ENTRIES);
  const requires=[],seenRequirements=new Set();
  for(const req of dependencies){
    const fields=record(req,REQUIREMENT),dep=name(fields.id);
    if(dep===id||seenRequirements.has(dep))throw new RangeError('self/duplicate dependency');
    seenRequirements.add(dep);
    requires.push(Object.freeze({id:dep,version:version(fields.version)}));
  }
  const normalized=[],ids=new Set();
  for(const entry of entries){
    const fields=record(entry,ENTRY),entryId=name(fields.id);
    if(ids.has(entryId)||fields.kind!=='data')throw new TypeError('duplicate or unsupported entry');
    ids.add(entryId);
    const payload=cloneData(fields.data,{nodes:0,seen:new WeakSet()});
    normalized.push(Object.freeze({id:entryId,kind:'data',data:payload}));
  }
  const result=Object.freeze({kind:MOD_PACK_KIND,id,version:revision,
    requires:Object.freeze(requires),entries:Object.freeze(normalized)});
  if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_PACK_BYTES)
    throw new RangeError('mod pack exceeds 32 KiB');
  return result;
}

/** No hooks or dynamic imports: lifecycle is registry state only. */
export class DataModRegistry {
  #mods=new Map();
  #active=new Set();
  register(source){
    const manifest=validateModManifest(source);
    if(this.#mods.has(manifest.id))throw new RangeError('duplicate mod ID');
    if(this.#mods.size>=MAX_PACKS)throw new RangeError('registry capacity exceeded');
    const candidate=new Map(this.#mods).set(manifest.id,manifest);
    const seen=new Set(),visiting=new Set();
    const visit=id=>{
      if(visiting.has(id))throw new RangeError('mod dependency cycle');
      if(seen.has(id))return;
      const mod=candidate.get(id);
      if(!mod)return;
      visiting.add(id);
      for(const req of mod.requires)visit(req.id);
      visiting.delete(id);seen.add(id);
    };
    for(const id of candidate.keys())visit(id);
    this.#mods.set(manifest.id,manifest);
    return manifest;
  }
  activate(id){
    name(id);
    const ordered=[],seen=new Set(),visiting=new Set();
    const visit=current=>{
      if(visiting.has(current))throw new RangeError('mod dependency cycle');
      if(seen.has(current))return;
      const mod=this.#mods.get(current);
      if(!mod)throw new RangeError('missing required mod '+current);
      visiting.add(current);
      for(const req of mod.requires){
        const dep=this.#mods.get(req.id);
        if(!dep||dep.version!==req.version)
          throw new RangeError('missing or incompatible dependency '+req.id);
        visit(req.id);
      }
      visiting.delete(current);seen.add(current);ordered.push(current);
    };
    visit(id); // Validate the whole closure BEFORE changing any active state.
    for(const current of ordered)this.#active.add(current);
    return Object.freeze(ordered);
  }
  deactivate(id){
    name(id);
    if(!this.#mods.has(id))throw new RangeError('unknown mod');
    for(const active of this.#active){
      if(active!==id&&this.#dependsOn(active,id))
        throw new RangeError('active dependent prevents deactivation');
    }
    this.#active.delete(id);
  }
  unregister(id){
    name(id);
    if(!this.#mods.has(id))throw new RangeError('unknown mod');
    if(this.#active.has(id))throw new RangeError('deactivate before removal');
    for(const [other,mod] of this.#mods){
      if(other!==id&&mod.requires.some(req=>req.id===id))
        throw new RangeError('registered dependent prevents removal');
    }
    this.#mods.delete(id);
  }
  #dependsOn(root,target){
    const seen=new Set(),stack=[root];
    while(stack.length){
      const id=stack.pop();
      if(seen.has(id))continue;seen.add(id);
      const mod=this.#mods.get(id);
      for(const req of mod?.requires??[]){
        if(req.id===target)return true;
        stack.push(req.id);
      }
    }
    return false;
  }
  get(id){
    name(id);
    return this.#mods.get(id)??null;
  }
  list(){
    return Object.freeze([...this.#mods].sort(([a],[b])=>a.localeCompare(b))
      .map(([id,manifest])=>Object.freeze({
        id,version:manifest.version,active:this.#active.has(id)
      })));
  }
  activeEntries(){
    const result=[];
    for(const id of [...this.#active].sort()){
      const mod=this.#mods.get(id);
      for(const entry of mod.entries)
        result.push(Object.freeze({modId:id,version:mod.version,entry}));
    }
    return Object.freeze(result);
  }
}
