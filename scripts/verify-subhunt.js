// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../demos/subhunt-lab/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('PROVENANCE.json',base),'utf8'));
assert.equal(manifest.repository,'QSOLKCB/SubHunt');assert.equal(manifest.license,'Apache-2.0');
assert.deepEqual(manifest.releases,{'v0.1.0':'4c5caa5db105cd1fbd08dd50bb05c1e8302bfee1','v0.2.0':'1603d51e8dd40bed06dd229dea0263a0988718d2'});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const targets=new Set();
for(const file of manifest.files){
  assert.match(file.source,/^[a-zA-Z0-9._/-]+$/);assert.ok(!file.source.split('/').includes('..'));
  assert.equal(file.target,'demos/subhunt-lab/'+file.source);assert.ok(!targets.has(file.source));targets.add(file.source);
  assert.match(file.gitBlob,/^[a-f0-9]{40}$/);assert.match(file.sha256,/^[a-f0-9]{64}$/);
  assert.ok(['unchanged','adapted'].includes(file.status));
  const bytes=await readFile(new URL(file.source,base));assert.equal(hash(bytes),file.adaptedSHA256,file.target+' changed without adaptation receipt');
  if(file.status==='unchanged')assert.equal(hash(bytes),file.sha256);
}
async function walk(url,prefix=''){
  const out=[];for(const entry of await readdir(url,{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())out.push(...await walk(new URL(entry.name+'/',url),path+'/'));else out.push(path);}return out;
}
assert.deepEqual((await walk(base)).filter(p=>p!=='PROVENANCE.json').sort(),[...targets].sort());
for(const path of manifest.nativeDependencies){assert.match(path,/^(modules|api)\/[a-z0-9-]+\/index\.js$/);await readFile(new URL('../'+path,import.meta.url));}
const html=await readFile(new URL('index.html',base),'utf8');
assert.match(html,/<script type="module" src="\.\/js\/app.js"><\/script>/);assert.ok(!html.includes('vendor/'));
console.log(`Verified SubHunt release pins and ${targets.size} adapted/retained files.`);
