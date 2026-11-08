// SPDX-License-Identifier: Apache-2.0
// Independent package membership, byte-count and content-digest verification.
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../dist');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
const listed=new Map(manifest.files.map(f=>[f.path,f]));
assert.equal(listed.size,manifest.files.length,'duplicate package paths');
async function walk(dir){
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    const path=resolve(dir,e.name);
    if(e.isDirectory())out.push(...await walk(path));else out.push(relative(root,path));
  }
  return out;
}
const actual=(await walk(root)).filter(p=>p!=='manifest.json').sort();
assert.deepEqual(actual,[...listed.keys()].sort(),'allowlisted package membership must be complete');
for(const [path,entry] of listed){
  assert.match(path,/^[a-zA-Z0-9._/-]+$/);
  assert.ok(!path.includes('..')&&!path.startsWith('/'),'safe package path');
  const raw=await readFile(resolve(root,path));
  assert.equal(raw.byteLength,entry.bytes,path+' size');
  assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sha256,path+' digest');
}
const worker=await readFile(resolve(root,'service-worker.js'),'utf8');
assert.ok(!worker.includes('__PACKAGE_SHA256__')&&!worker.includes('__ASSET_ENTRIES__'));
const cached=[...listed.keys()].filter(p=>p!=='service-worker.js');
assert.ok(worker.includes('const FILES=')&&worker.includes('const VERSION='));
for(const path of cached)assert.ok(worker.includes(JSON.stringify(path)),path+' in precache manifest');
const shell=listed.get('index.html'),reg=listed.get('offline/register.js');
assert.ok(shell&&reg);
console.log(JSON.stringify({kind:'qsol.vanillajs.offline-package.v1',verified:listed.size,
  bytes:[...listed.values()].reduce((a,f)=>a+f.bytes,0),
  workerSha256:listed.get('service-worker.js').sha256}));
