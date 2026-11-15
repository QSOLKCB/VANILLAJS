// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),base='demos/skyguard-lab/';
const manifest=JSON.parse(await readFile(new URL(base+'PROVENANCE.json',root),'utf8'));
assert.equal(manifest.repository,'QSOLKCB/Spooky');assert.equal(manifest.release,'v0.1.0');assert.equal(manifest.commit,'0c13684a03e301e59ba5dd04c67167874ab04766');assert.equal(manifest.sourceTree,'56597baf5affbbab9c09d44bb2fbdf2e471afe1d');assert.equal(manifest.license,'Apache-2.0');
const hash=b=>createHash('sha256').update(b).digest('hex'),targets=new Set();
for(const file of manifest.sources){assert.match(file.path,/^(js\/[a-z]+\.js|LICENSE|NOTICE|index.html|style.css)$/);assert.match(file.gitBlob,/^[a-f0-9]{40}$/);assert.match(file.sha256,/^[a-f0-9]{64}$/);}
for(const file of manifest.targets){assert.ok(file.path.startsWith(base)&&!file.path.split('/').includes('..'));assert.ok(!targets.has(file.path));targets.add(file.path);assert.ok(['adapted','original','retained'].includes(file.status));for(const source of file.sources)assert.ok(manifest.sources.some(s=>s.path===source));assert.equal(hash(await readFile(new URL(file.path,root))),file.sha256,file.path+' changed without an adaptation receipt');}
async function walk(dir){const out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const path=dir+e.name;if(e.isDirectory())out.push(...await walk(path+'/'));else out.push(path);}return out;}
assert.deepEqual((await walk(base)).filter(p=>!p.endsWith('/PROVENANCE.json')).sort(),[...targets].sort());
for(const [file,source] of [['LICENSE','LICENSE'],['SPOOKY-NOTICE.txt','NOTICE']])assert.equal(hash(await readFile(new URL(base+file,root))),manifest.sources.find(s=>s.path===source).sha256);
for(const path of manifest.nativeDependencies){assert.match(path,/^(modules|api)\/[a-z0-9-]+\/index\.js$/);await readFile(new URL(path,root));}
for(const path of ['js/sim.js','js/content.js'])assert.ok(!/Math\.random|Date\.|performance\.|window\.|document\./.test(await readFile(new URL(base+path,root),'utf8')),'ambient dependency in '+path);
console.log('Verified Spooky v0.1.0 pin, '+manifest.sources.length+' source records and '+targets.size+' Skyguard adaptations/original files.');
