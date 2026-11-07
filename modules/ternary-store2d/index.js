// SPDX-License-Identifier: Apache-2.0
// 2D ternary ARRAY storage. Six trits represent exactly one UTF-8 byte.
// This is a reversible experimental indexing layout, NOT compression,
// persistence, an encrypted database or quantum/physical information storage.
const MAX_DOCS=64,MAX_BYTES=16384,NAME=/^(?!\/)(?!.*\/\/)(?!.*(?:^|\/)\.\.?\/)[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:txt|json)$/;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
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
  const parsed=canonical(JSON.parse(str));
  if(JSON.stringify(parsed)!==str)throw new TypeError('noncanonical JSON document');
  return parsed;
}
function trits(bytes,width){
  const rows=Math.ceil(bytes.length*6/width),grid=Array.from({length:rows},()=>Array(width).fill(0));
  let offset=0;
  for(const value of bytes) {
    let n=value;
    for(let i=0;i<6;i++){
      grid[Math.floor(offset/width)][offset%width]=n%3;
      n=Math.floor(n/3);offset++;
    }
  }
  return grid;
}
function fromTrits(rows,width,byteLength){
  const total=byteLength*6;
  const bytes=new Uint8Array(byteLength);
  let at=0;
  for(let i=0;i<byteLength;i++){
    let factor=1,value=0;
    for(let j=0;j<6;j++){
      const t=rows[Math.floor(at/width)][at%width];
      value+=t*factor;factor*=3;at++;
    }
    if(value>255)throw new RangeError('invalid six-trit UTF-8 byte');
    bytes[i]=value;
  }
  for(;at<rows.length*width;at++)if(rows[Math.floor(at/width)][at%width]!==0)
    throw new RangeError('nonzero trailing trit');
  if(total>rows.length*width)throw new RangeError('missing trit cells');
  return bytes;
}
export class TernaryGridStore2D {
  #docs=new Map();#maxBytes;#columns;
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
    // Publish a fresh byte buffer only after all validation succeeds.
    this.#docs.set(name,bytes);
    return bytes.length;
  }
  get(name){
    filename(name);
    const bytes=this.#docs.get(name);
    return bytes?decode(name,bytes):null;
  }
  delete(name){filename(name);return this.#docs.delete(name);}
  clear(){this.#docs.clear();}
  snapshot(){
    const entries=[],buffer=[];
    for(const name of this.names()){
      const bytes=this.#docs.get(name),offset=buffer.length;
      buffer.push(...bytes);
      entries.push({name,offset,length:bytes.length});
    }
    return {schemaVersion:1,columns:this.#columns,maxBytes:this.#maxBytes,
      byteLength:buffer.length,entries,rows:trits(buffer,this.#columns)};
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
      const payload=bytes.slice(offset,offset+count),value=decode(name,payload);
      store.put(name,value);start+=count;previous=name;
    }
    if(start!==length)throw new RangeError('unreferenced ternary payload');
    if(JSON.stringify(store.snapshot())!==JSON.stringify(data))
      throw new TypeError('ternary snapshot not canonical');
    return store;
  }
}
