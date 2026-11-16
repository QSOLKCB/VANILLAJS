// SPDX-License-Identifier: Apache-2.0
// Deduplicate identical input blocks without changing any execution fingerprint.
import {identity} from './browser-dependencies.mjs';

export const COMPACT_KIND='qsol.browser.execution.compact.v1';
const groups=new Set(['home','render','play','worlds','research','donor','editor']);
const digest=/^[a-f0-9]{64}$/;
const MAX_WIRE=524288,MAX_EXPANDED=4*1024*1024;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const need=(condition,message)=>{if(!condition)throw Error('invalid compact receipt: '+message);};
const bytes=x=>Buffer.byteLength(JSON.stringify(x));

export function encodeReceipt(receipt){
  need(receipt?.kind==='qsol.browser.execution.v3','execution kind');
  const blocks={},results={};
  for(const [group,row] of Object.entries(receipt.results??{})){
    need(object(row.inputs),'missing inputs');
    const inputRefs={};
    for(const [key,value] of Object.entries(row.inputs)){
      const id=identity(value);blocks[id]=value;inputRefs[key]=id;
    }
    const {inputs,...rest}=row;
    results[group]={...rest,inputRefs};
  }
  const envelope={kind:COMPACT_KIND,receipt:{...receipt,results},blocks};
  // The producer exercises the same bounded checks as the artifact reader.
  decodeReceipt(envelope);
  return envelope;
}

export function decodeReceipt(envelope){
  // Existing v3 artifacts retain their original validation and size rules.
  if(envelope?.kind!==COMPACT_KIND)return envelope;
  need(object(envelope)&&Object.keys(envelope).sort().join(',')==='blocks,kind,receipt','envelope fields');
  need(bytes(envelope)<=MAX_WIRE,'encoded size');
  const {receipt,blocks}=envelope;
  need(object(receipt)&&receipt.kind==='qsol.browser.execution.v3','execution kind');
  need(object(blocks)&&Object.keys(blocks).length<=128,'block inventory');
  const sizes=new Map();
  for(const [id,value] of Object.entries(blocks)){
    need(digest.test(id)&&identity(value)===id,'block digest');
    sizes.set(id,bytes(value));
  }
  need(object(receipt.results),'results');
  const entries=Object.entries(receipt.results);
  need(entries.length>0&&entries.length<=groups.size,'result count');
  const results={},used=new Set();let expandedBytes=bytes(receipt);
  for(const [group,row] of entries){
    need(groups.has(group)&&object(row),'suite');
    need(Object.keys(row).sort().join(',')==='executed,fingerprint,inputRefs,status','result fields');
    need(row.status==='PASS'&&row.executed===true&&digest.test(row.fingerprint),'execution');
    need(object(row.inputRefs),'input references');
    const refs=Object.entries(row.inputRefs);
    need(refs.length>0&&refs.length<=20,'input count');
    const inputs={};
    for(const [key,id] of refs){
      need(/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)&&!['constructor','prototype'].includes(key),'input name');
      need(typeof id==='string'&&digest.test(id)&&Object.hasOwn(blocks,id),'missing block');
      expandedBytes+=sizes.get(id);need(expandedBytes<=MAX_EXPANDED,'expanded size');
      used.add(id);inputs[key]=blocks[id];
    }
    need(identity(inputs)===row.fingerprint,'execution fingerprint');
    results[group]={status:row.status,executed:row.executed,fingerprint:row.fingerprint,inputs};
  }
  need(used.size===Object.keys(blocks).length,'unused block');
  return {...receipt,results};
}
