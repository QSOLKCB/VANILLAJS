// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),base='demos/pursuit-lab/';
const manifest=JSON.parse(await readFile(new URL(base+'PROVENANCE.json',root),'utf8'));
assert.equal(manifest.repository,'QSOLKCB/Outruin');assert.equal(manifest.commit,'c9a0839fa1f8329f3eee4c7fd8637ae78cbad8c7');assert.equal(manifest.license,'Apache-2.0');
const hash=b=>createHash('sha256').update(b).digest('hex'),targets=new Set();
for(const source of manifest.sources){assert.match(source.path,/^(js\/[a-z]+\.js|LICENSE|NOTICE)$/);assert.match(source.gitBlob,/^[a-f0-9]{40}$/);assert.match(source.sha256,/^[a-f0-9]{64}$/);}
for(const file of manifest.targets){assert.ok(!targets.has(file.path));targets.add(file.path);assert.ok(file.path.startsWith(base)||['modules/road-arcade/index.js','api/display/index.js','api/audio/effects.js'].includes(file.path));assert.ok(!file.path.split('/').includes('..'));assert.ok(['original','adapted','retained'].includes(file.status));for(const source of file.sources)assert.ok(manifest.sources.some(s=>s.path===source));assert.equal(hash(await readFile(new URL(file.path,root))),file.sha256,file.path+' changed without adaptation receipt');}
async function walk(dir){const out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const path=dir+e.name;if(e.isDirectory())out.push(...await walk(path+'/'));else out.push(path);}return out;}
assert.deepEqual((await walk(base)).filter(p=>!p.endsWith('/PROVENANCE.json')).sort(),[...targets].filter(p=>p.startsWith(base)).sort());
for(const [file,source] of [['LICENSE','LICENSE'],['OUTRUIN-NOTICE.txt','NOTICE']])assert.equal(hash(await readFile(new URL(base+file,root))),manifest.sources.find(s=>s.path===source).sha256);
console.log(`Verified Outruin pin, ${manifest.sources.length} source records and ${targets.size} pursuit adaptations/original files.`);
