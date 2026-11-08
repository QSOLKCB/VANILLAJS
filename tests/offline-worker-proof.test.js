// SPDX-License-Identifier: Apache-2.0
// Simulated, exact Service Worker install/activate/fetch behavior, no browser
// dependency, outbound network or real CacheStorage. Real Chromium tests remain.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';

const template=readFileSync(new URL('../scripts/service-worker.template.js',import.meta.url),'utf8');
const scope='https://example.test/VANILLAJS/';
const sha=s=>createHash('sha256').update(s).digest('hex');
const samples={'index.html':'<html>offline shell</html>',
  'modules/time/index.js':'export const answer=42;',
  'offline/register.js':'// verified registration'};
function fixture(){
  const files=Object.entries(samples).map(([path,content])=>
    ({path,bytes:Buffer.byteLength(content),sha256:sha(content)}));
  const listeners=new Map(),stores=new Map(),network=new Map(
    Object.entries(samples).map(([path,s])=>[new URL(path,scope).href,s]));
  let offline=false,corrupt=null,fetchCount=0;
  const cacheName='qsol-vanillajs:'+scope+':v-test-001';
  const cacheApi={
    async keys(){return [...stores.keys()];},
    async delete(k){return stores.delete(k);},
    async open(name){
      if(!stores.has(name))stores.set(name,new Map());
      const data=stores.get(name);
      return {
        async put(url,response){data.set(String(url),response.clone());},
        async match(url){return data.get(String(url))?.clone();},
        async delete(url){return data.delete(String(url));}
      };
    }
  };
  const source=template.replace('__PACKAGE_SHA256__','v-test-001')
    .replace('__ASSET_ENTRIES__',JSON.stringify(files));
  vm.runInNewContext(source,{
    self:{registration:{scope},clients:{claim(){throw Error('must not claim old clients');}},
      addEventListener(name,fn){listeners.set(name,fn);}},
    crypto:webcrypto,caches:cacheApi,URL,Response,Uint8Array,Map,Promise,
    fetch:async url=>{
      fetchCount++;
      if(offline)throw new Error('offline');
      const key=typeof url==='string'?url:url.url;
      const entry=network.get(key);
      if(entry===undefined)return new Response('missing',{status:404});
      const body=corrupt===key?'INJECTED WRONG BYTES':entry;
      return new Response(body,{status:200});
    }
  },{filename:'service-worker-under-test.js'});
  async function event(name,request){
    let p;
    const e=name==='fetch'?{request,respondWith(value){p=value}}:
      {waitUntil(value){p=value}};
    listeners.get(name)(e);
    return p===undefined?null:await p;
  }
  return {
    files,network,stores,cacheName,scope,
    install:()=>event('install'),activate:()=>event('activate'),
    fetch:(suffix,options={})=>event('fetch',new Request(new URL(suffix,scope),options)),
    setOffline(v){offline=v;},
    setCorrupt(suffix){corrupt=new URL(suffix,scope).href;},
    get fetchCount(){return fetchCount;}
  };
}
test('verified install makes the complete offline shell available without network',async()=>{
  const f=fixture();
  await f.install();
  assert.equal(f.stores.get(f.cacheName).size,f.files.length+1);
  f.setOffline(true);
  for(const [p,text]of Object.entries(samples)){
    assert.equal((await f.fetch(p)).status,200);
    assert.equal(await (await f.fetch(p)).text(),text);
  }
  assert.equal(await (await f.fetch('./')).text(),samples['index.html']);
  assert.equal(f.fetchCount,f.files.length,'no offline network requests for cached assets');
});
test('hash mismatch during install deletes only new cache, retains old release',async()=>{
  const f=fixture();
  const old='qsol-vanillajs:'+scope+':previous',other='qsol-arcade:'+scope+':previous';
  f.stores.set(old,new Map([['sentinel',new Response('untouched')]]));
  f.stores.set(other,new Map([['sentinel',new Response('unrelated')]]));
  f.setCorrupt('modules/time/index.js');
  await assert.rejects(f.install(),/digest mismatch/);
  assert.equal(f.stores.has(f.cacheName),false);
  assert.equal(f.stores.has(old),true);
  assert.equal(f.stores.has(other),true);
});
test('partial network failure never promotes a cache, including concurrent batches',async()=>{
  const f=fixture();
  f.network.delete(new URL('offline/register.js',scope).href);
  await assert.rejects(f.install(),/unverifiable/);
  assert.equal(f.stores.has(f.cacheName),false);
});
test('tampered post-install cache is rejected offline and repaired online',async()=>{
  const f=fixture();
  await f.install();
  const url=new URL('modules/time/index.js',scope).href;
  f.stores.get(f.cacheName).set(url,new Response('tampered after install'));
  f.setOffline(true);
  assert.equal((await f.fetch('modules/time/index.js')).status,503);
  assert.equal(f.stores.get(f.cacheName).has(url),false);
  f.setOffline(false);
  const recovered=await f.fetch('modules/time/index.js');
  assert.equal(await recovered.text(),samples['modules/time/index.js']);
  f.setOffline(true);
  assert.equal(await (await f.fetch('modules/time/index.js')).text(),
    samples['modules/time/index.js']);
});
test('activation prunes only cache versions under the same scoped prefix',async()=>{
  const f=fixture();await f.install();
  const old='qsol-vanillajs:'+scope+':old',other='qsol-vanillajs:https://other.test/:old';
  f.stores.set(old,new Map());
  f.stores.set(other,new Map());
  await f.activate();
  assert.equal(f.stores.has(old),false);
  assert.equal(f.stores.has(other),true);
  assert.equal(f.stores.has(f.cacheName),true);
});
test('query, cross-origin, mutation and range requests bypass interception',async()=>{
  const f=fixture();await f.install();
  assert.equal(await f.fetch('index.html?session=1'),null);
  assert.equal(await f.fetch('https://other.example/asset.js'),null);
  assert.equal(await f.fetch('index.html',{method:'POST',body:'abc'}),null);
  assert.equal(await f.fetch('index.html',{headers:{Range:'bytes=0-3'}}),null);
  assert.equal(await f.fetch('unknown.js'),null);
});