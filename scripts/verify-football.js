// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('demos/football-manager/PROVENANCE.json',root),'utf8'));
assert.equal(manifest.repository,'QSOLKCB/Soccerweb');assert.equal(manifest.sourceRelease,'v3.1.1');assert.equal(manifest.commit,'e2b67c01b0edf7afa3577c60458e5366eea69bde');assert.equal(manifest.license,'Apache-2.0');
assert.equal(manifest.sources.length,11);assert.equal(new Set(manifest.sources.map(s=>s.path)).size,11);
const targets=['api/football/index.js','demos/football-manager/SOCCERWEB-LICENSE.txt','demos/football-manager/starter.json','modules/football/index.js'];
assert.deepEqual(manifest.targets.map(t=>t.path).sort(),targets);
for(const source of manifest.sources){assert.match(source.gitBlob,/^[a-f0-9]{40}$/);assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.ok(targets.includes(source.target));}
for(const target of manifest.targets){const bytes=await readFile(new URL(target.path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),target.sha256,target.path+' changed without updating its adaptation receipt');}
const license=await readFile(new URL('demos/football-manager/SOCCERWEB-LICENSE.txt',root));assert.equal(createHash('sha256').update(license).digest('hex'),manifest.sources.find(s=>s.path==='LICENSE').sha256);
console.log('Verified SOCCERWEB v3.1.1 pin, 11 source records and 4 adapted/retained targets.');
