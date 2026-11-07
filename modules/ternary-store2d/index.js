// SPDX-License-Identifier: Apache-2.0
// 2D ternary ARRAY storage. Six trits represent exactly one UTF-8 byte.
// This is a reversible experimental indexing layout, NOT compression,
// persistence, an encrypted database or quantum/physical information storage.
const MAX_DOCS=64,MAX_BYTES=16384,NAME=/^(?!\/)(?!.*\/\/)(?!.*(?:^|\/)\.\.?\/)[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:txt|json)$/;
// ignoreBOM=true means U+FEFF at the *start* of .txt is kept as data.
// The JSON parser still rejects a BOM prefix outside the JSON value.
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const TRITS_PER_BYTE=6, TRIT_SPACE=729;
// Small, immutable-by-encapsulation LUTs: 1,536 forward bytes + 1,458 inverse
// bytes. Built once, reused for every encode/decode and store snapshot.
const BYTE_TO_TRITS=new Uint8Array(256*TRITS_PER_BYTE);
const TRITS_TO_BYTE=new Int16Array(TRIT_SPACE).fill(-1);
for(let value=0;value<256;value++){
  let rest=value;
  for(let k=0;k<TRITS_PER_BYTE;k++){
    BYTE_TO_TRITS[value*TRITS_PER_BYTE+k]=rest%3;
    rest=Math.floor(rest/3);
  }
  TRITS_TO_BYTE[value]=value;
}
export function tritsForByte(value){
  finite(value,'byte',0,255);
  return Array.from(BYTE_TO_TRITS.subarray(value*TRITS_PER_BYTE,
    (value+1)*TRITS_PER_BYTE));
}
export function byteFromTrits(value){
  if(!Array.isArray(value)||value.length!==TRITS_PER_BYTE||
     !value.every(n=>Number.isInteger(n)&&n>=0&&n<=2))
    throw new TypeError('expected exactly six trits in [0,2]');
  let code=0,weight=1;
  for(const trit of value){code+=trit*weight;weight*=3;}
  const byte=TRITS_TO_BYTE[code];
  if(byte<0)throw new RangeError('six-trit value exceeds byte range');
  return byte;
}
const finite=(n,name,lo,hi)=>{
  if(!Number.isSafeInteger(n)||n<lo||n>hi)throw new RangeError('invalid '+name);
  return n;
};
const plain=o=>o!==null&&typeof o==='object'&&
  (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
function canonical(value,depth=0){
  if(depth>16)throw new RangeError('JSON exceeds nesting budget');
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value))throw new TypeError('JSON numbers must be safe integers');
    return value===0?0:value;
  }
  if(Array.isArray(value)){
    if(value.length>128)throw new RangeError('JSON arrays limited to 128 elements');
    return Array.from({length:value.length},(_,i)=>{
      if(!Object.hasOwn(value,i))throw new TypeError('sparse JSON arrays refused');
      return canonical(value[i],depth+1);
    });
  }
  if(!plain(value))throw new TypeError('not a canonical JSON object');
  const keys=Object.keys(value).sort();
  if(keys.length>128)throw new RangeError('JSON objects limited to 128 keys');
  const out=Object.create(null);
  for(const key of keys){
    if(key==='__proto__'||key==='constructor'||key==='prototype')
      throw new TypeError('unsafe JSON key');
    out[key]=canonical(value[key],depth+1);
  }
  return out;
}
function filename(name){
  if(typeof name!=='string'||name.length>128||!NAME.test(name)||name.includes('..'))
    throw new TypeError('expected safe relative .txt or .json name');
  return name;
}
function bytesFor(name,value){
  const txt=name.endsWith('.txt');
  if(txt&&typeof value!=='string')throw new TypeError('.txt requires text');
  const data=txt?value:JSON.stringify(canonical(typeof value==='string'?JSON.parse(value):value));
  return encoder.encode(data);
}
function decode(name,bytes){
  const str=decoder.decode(bytes);
  if(name.endsWith('.txt'))return str;
  const parsed=JSON.parse(str),validated=canonical(parsed);
  if(JSON.stringify(validated)!==str)throw new TypeError('noncanonical JSON document');
  // API consumers receive ordinary parsed JSON objects. Validation uses
  // null-prototype scratch objects only and rejects poison keys first.
  return parsed;
}
function trits(bytes,width){
  const rows=Math.ceil(bytes.length*TRITS_PER_BYTE/width);
  const grid=Array.from({length:rows},()=>Array(width).fill(0));
  let offset=0;
  for(const value of bytes)for(let i=0;i<TRITS_PER_BYTE;i++,offset++)
    grid[Math.floor(offset/width)][offset%width]=
      BYTE_TO_TRITS[value*TRITS_PER_BYTE+i];
  return grid;
}
function fromTrits(rows,width,byteLength){
  const total=byteLength*TRITS_PER_BYTE,bytes=new Uint8Array(byteLength);
  let at=0;
  for(let i=0;i<byteLength;i++){
    let code=0,weight=1;
    for(let j=0;j<TRITS_PER_BYTE;j++,at++){
      code+=rows[Math.floor(at/width)][at%width]*weight;
      weight*=3;
    }
    const byte=TRITS_TO_BYTE[code];
    if(byte<0)throw new RangeError('invalid six-trit UTF-8 byte');
    bytes[i]=byte;
  }
  for(;at<rows.length*width;at++)
    if(rows[Math.floor(at/width)][at%width]!==0)
      throw new RangeError('nonzero trailing trit');
  if(total>rows.length*width)throw new RangeError('missing trit cells');
  return bytes;
}
export class TernaryGridStore2D {
  #docs=new Map();#maxBytes;#columns;#cached=null;
  #builds=0;#hits=0;#invalidations=0;#unchangedWrites=0;
  #invalidate(){this.#cached=null;this.#invalidations++;}
  cacheStats(){return Object.freeze({builds:this.#builds,hits:this.#hits,
    invalidations:this.#invalidations,unchangedWrites:this.#unchangedWrites,
    cached:this.#cached!==null});}
  constructor({columns=27,maxBytes=MAX_BYTES}={}){
    if(![9,27,81].includes(columns))throw new RangeError('columns must be 9,27,81');
    this.#maxBytes=finite(maxBytes,'maxBytes',1,MAX_BYTES);
    this.#columns=columns;
  }
  get columns(){return this.#columns;}
  get size(){return this.#docs.size;}
  names(){return [...this.#docs.keys()].sort();}
  put(name,value){
    filename(name);
    const bytes=bytesFor(name,value);
    const remaining=[...this.#docs.entries()].reduce((s,[key,doc])=>
      key===name?s:s+doc.length,0);
    if((!this.#docs.has(name)&&this.size===MAX_DOCS)||
       remaining+bytes.length>this.#maxBytes)
      throw new RangeError('bounded ternary data storage exhausted');
    // Identical bytes are an invariant reuse hit: preserve the current cache.
    const current=this.#docs.get(name);
    if(current&&current.length===bytes.length&&current.every((b,i)=>b===bytes[i])){
      this.#unchangedWrites++;return bytes.length;
    }
    // Publish only after all validation succeeds; failed writes do not
    // invalidate successful earlier cache entries or result snapshots.
    this.#docs.set(name,bytes);
    this.#invalidate();
    return bytes.length;
  }
  get(name){
    filename(name);
    const bytes=this.#docs.get(name);
    return bytes?decode(name,bytes):null;
  }
  delete(name){
    filename(name);const deleted=this.#docs.delete(name);
    if(deleted)this.#invalidate();
    return deleted;
  }
  clear(){if(this.#docs.size){this.#docs.clear();this.#invalidate();}}
  snapshot(){
    if(!this.#cached){
      const entries=[],buffer=[];
      for(const name of this.names()){
        const bytes=this.#docs.get(name),offset=buffer.length;
        buffer.push(...bytes);
        entries.push({name,offset,length:bytes.length});
      }
      this.#cached={schemaVersion:1,columns:this.#columns,
        maxBytes:this.#maxBytes,byteLength:buffer.length,
        entries,rows:trits(buffer,this.#columns)};
      this.#builds++;
    }else this.#hits++;
    // Always return a detached ordinary object: consumers cannot alter
    // either a future snapshot or the internal LUT/cache by mutation.
    const snap=this.#cached;
    return {schemaVersion:snap.schemaVersion,columns:snap.columns,
      maxBytes:snap.maxBytes,byteLength:snap.byteLength,
      entries:snap.entries.map(entry=>({...entry})),
      rows:snap.rows.map(row=>[...row])};
  }
  static fromSnapshot(data){
    if(!plain(data)||Object.keys(data).sort().join(',')!==
      'byteLength,columns,entries,maxBytes,rows,schemaVersion')
      throw new TypeError('invalid ternary store envelope');
    if(data.schemaVersion!==1)throw new RangeError('unknown ternary schema');
    const store=new TernaryGridStore2D({columns:data.columns,maxBytes:data.maxBytes});
    const length=finite(data.byteLength,'byteLength',0,data.maxBytes);
    if(!Array.isArray(data.entries)||data.entries.length>MAX_DOCS||
       !Array.isArray(data.rows)||data.rows.length!==Math.ceil(length*6/data.columns))
      throw new TypeError('invalid ternary grid dimensions');
    for(const row of data.rows){
      if(!Array.isArray(row)||row.length!==data.columns||
          !row.every(t=>Number.isInteger(t)&&t>=0&&t<=2))
        throw new TypeError('ternary grid cells must be 0,1,2');
    }
    const bytes=fromTrits(data.rows,data.columns,length);
    let start=0,previous='';
    for(const entry of data.entries){
      if(!plain(entry)||Object.keys(entry).sort().join(',')!=='length,name,offset')
        throw new TypeError('malformed ternary index');
      const name=filename(entry.name),offset=finite(entry.offset,'offset',0,length),
        count=finite(entry.length,'length',0,length);
      if(name<=previous||offset!==start||offset+count>length)
        throw new RangeError('noncanonical/overlapping ternary index');
      // The exact bytes have already passed strict UTF-8, canonical JSON,
      // bounds and payload index validation. Do not pass a decoded top-level
      // JSON string through put(): that API parses incoming strings as text,
      // and a second parse can change its type or reject a valid snapshot.
      const payload=bytes.slice(offset,offset+count);
      decode(name,payload);
      store.#docs.set(name,payload);
      start+=count;previous=name;
    }
    if(start!==length)throw new RangeError('unreferenced ternary payload');
    if(JSON.stringify(store.snapshot())!==JSON.stringify(data))
      throw new TypeError('ternary snapshot not canonical');
    return store;
  }
}
