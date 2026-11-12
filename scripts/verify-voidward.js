// SPDX-License-Identifier: Apache-2.0
// Verify source attribution without importing or executing any donor code.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const base='demos/4x-game-lab/voidward';
const manifest=JSON.parse(await readFile(resolve(root,base,'vendor/PROVENANCE.json'),'utf8'));
assert.equal(manifest.schema,'vanillajs-voidward-vendor-v1');
assert.equal(manifest.sourceRepository,'QSOLKCB/4XGAMES');
assert.equal(manifest.sourceCommit,'030859385ac8929e066702ef8af0518663480653');
assert.equal(manifest.pathBase,base);
const safe=p=>typeof p==='string'&&p.length>0&&!p.startsWith('/')&&!p.includes('\\')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [kind,records,prefix] of [['vendored',manifest.files,base],['native',manifest.nativeDependencies,'']]){
  assert.ok(Array.isArray(records)&&records.length>0,`${kind}: missing provenance`);
  const seen=new Set();
  for(const record of records){
    assert.ok(safe(record.local)&&safe(record.source),`${kind}: unsafe source path`);
    assert.ok(!seen.has(record.local),`${kind}: duplicate ${record.local}`);seen.add(record.local);
    assert.match(record.repository,/^QSOLKCB\/[A-Za-z0-9_-]+$/);
    assert.match(record.commit,/^[a-f0-9]{40}$/);assert.match(record.sha256,/^[a-f0-9]{64}$/);
    if(kind==='vendored'){
      assert.ok(record.local.startsWith('vendor/'),`vendored: outside vendor ${record.local}`);
      assert.notEqual(record.repository,'QSOLKCB/VANILLAJS','Use native VANILLAJS dependencies rather than a second vendored copy.');
    }else assert.equal(record.repository,'QSOLKCB/VANILLAJS');
    assert.equal(hash(await readFile(resolve(root,prefix,record.local))),record.sha256,`${kind}: source digest mismatch ${record.local}`);
  }
}
async function walk(dir){
  const files=[];for(const item of await readdir(dir,{withFileTypes:true})){
    const path=resolve(dir,item.name);if(item.isDirectory())files.push(...await walk(path));else files.push(relative(resolve(root,base),path).split(sep).join('/'));
  }return files;
}
const actual=(await walk(resolve(root,base,'vendor'))).filter(p=>p!=='vendor/PROVENANCE.json').sort();
assert.deepEqual(actual,manifest.files.map(f=>f.local).sort(),'Every vendored file must have a pinned source record.');
console.log(`Verified VOIDWARD source pin, ${manifest.files.length} donor files and ${manifest.nativeDependencies.length} native dependencies.`);
