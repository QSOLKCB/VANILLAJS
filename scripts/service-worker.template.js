/* SPDX-License-Identifier: Apache-2.0 */
/* Build-generated worker. Asset members and complete-content SHA-256 values
 * are injected by scripts/build.js; edit that generator, not dist output. */
'use strict';
const VERSION='__PACKAGE_SHA256__';
const PREFIX='qsol-vanillajs:'+self.registration.scope+':';
const CACHE=PREFIX+VERSION;
const FILES=__ASSET_ENTRIES__;
const KNOWN=new Map(FILES.map(f=>[new URL(f.path,self.registration.scope).href,f]));
const ROOT=new URL('./',self.registration.scope).href;
const INDEX=new URL('index.html',self.registration.scope).href;
function shaHex(buffer){return crypto.subtle.digest('SHA-256',buffer).then(bytes=>
  [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join(''));}
async function verify(response,entry){
  if(!response.ok||response.status!==200||response.type==='opaque')
    throw new Error('unverifiable offline asset: '+entry.path);
  const raw=await response.clone().arrayBuffer();
  if(raw.byteLength!==entry.bytes||(await shaHex(raw))!==entry.sha256)
    throw new Error('offline asset digest mismatch: '+entry.path);
  return response;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{
    // Bounded parallel fetches; partial cache never becomes an active worker.
    for(let i=0;i<FILES.length;i+=6){
      // Await *every* in-flight write even if one request fails, so that
      // partial-install cleanup cannot race with still-running cache puts.
      const results=await Promise.allSettled(FILES.slice(i,i+6).map(async entry=>{
        const url=new URL(entry.path,self.registration.scope).href;
        const response=await verify(await fetch(url,{cache:'reload'}),entry);
        await cache.put(url,response);
      }));
      const rejected=results.find(result=>result.status==='rejected');
      if(rejected)throw rejected.reason;
    }
    const index=await cache.match(INDEX);
    if(!index)throw new Error('offline shell absent');
    await cache.put(ROOT,index);
  }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
  // Do not skipWaiting/claim. Let existing clients finish on their old version.
})()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||req.headers.has('Range'))return;
  const url=req.url,entry=KNOWN.get(url)||(url===ROOT?KNOWN.get(INDEX):undefined);
  if(!entry)return; // Never cache third-party, user data, query URLs or API calls.
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),hit=await cache.match(url);
    if(hit){
      // CacheStorage is not an integrity oracle: detect post-install byte
      // damage too. No persistent "verified key" shortcut across mutations.
      try{return await verify(hit,entry);}
      catch{await cache.delete(url);}
    }
    try{
      const response=await verify(await fetch(req),entry);
      await cache.put(url,response.clone());
      return response;
    }catch{
      return new Response('Verified offline asset unavailable',{status:503,
        headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
