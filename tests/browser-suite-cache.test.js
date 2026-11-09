// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SUITES,partitionPackage,digestClosures,witness,reuse}
  from '../scripts/browser-suite-cache.mjs';

const sha=x=>x.repeat(64);
const scoped={
  home:'demos/flight-lab/app.js',
  render:'demos/clockwork-vault/index.html',
  play:'demos/fps-lab/app.js',
  worlds:'demos/rts-lab/index.html',
  research:'demos/omi-lab/index.html',
  donor:'demos/arcade-lab/world.js',
  editor:'demos/editor/app.js'
};
function inventory(){
  return [{path:'modules/math/index.js',sha256:sha('a')},
    {path:'api/webgl/index.js',sha256:sha('b')},
    {path:'offline/register.js',sha256:sha('c')},
    {path:'index.html',sha256:sha('d')},
    {path:'service-worker.js',sha256:sha('e')},
    ...SUITES.map((g,i)=>({path:scoped[g],sha256:sha('1234567'[i])}))];
}
const scripts=()=>Object.fromEntries(SUITES.map(g=>[g,[]]));
const env=()=>({platform:'linux',arch:'x64',node:'v22.0.0',
  imageVersion:'ubuntu-image-test',playwright:'1.64.0-only-shell'});
const compute=files=>digestClosures(files,[],scripts(),env());

test('all seven groups are explicit; no runtime fixture is silently unowned',()=>{
  assert.deepEqual(SUITES,Object.keys(scoped));
  const p=partitionPackage(inventory());
  for(const group of SUITES){
    assert.equal(p.own[group].some(x=>x.path===scoped[group]),true);
    assert.equal(p.global.some(x=>x.path===scoped[group]),false);
  }
});
test('editor-only code invalidates editor witness but not unrelated suites',()=>{
  const original=inventory(),next=structuredClone(original);
  next.find(x=>x.path===scoped.editor).sha256=sha('f');
  const before=compute(original),after=compute(next);
  for(const group of SUITES)
    assert.equal(after[group]===before[group],group!=='editor',
      group+' must have the correct cache dependency boundary');
});
test('shared renderer/physics module change invalidates all suite witnesses',()=>{
  const original=inventory(),next=structuredClone(original);
  next.find(x=>x.path==='modules/math/index.js').sha256=sha('f');
  const before=compute(original),after=compute(next);
  for(const group of SUITES)assert.notEqual(after[group],before[group],group);
});
test('worker or index changes invalidate browser groups with service-worker exposure',()=>{
  for(const path of ['index.html','service-worker.js']){
    const files=inventory(),altered=structuredClone(files);
    altered.find(x=>x.path===path).sha256=sha('f');
    const a=compute(files),b=compute(altered);
    for(const g of ['home','donor','editor'])assert.notEqual(a[g],b[g],path+' '+g);
    for(const g of ['render','play','worlds','research'])assert.equal(a[g],b[g],path+' '+g);
  }
});
test('unknown/new demo or unclassified runtime file fails closed to all suites',()=>{
  const before=compute(inventory()),additional=inventory();
  additional.push({path:'demos/alien-tech/new-widget.js',sha256:sha('f')});
  const after=compute(additional);
  for(const group of SUITES)assert.notEqual(before[group],after[group],group);
});
test('incomplete, duplicate, malicious or ambiguous inventory is refused',()=>{
  assert.throws(()=>partitionPackage([{path:'demos/editor/app.js',sha256:sha('a')}]),/missing scoped/);
  const files=inventory();
  assert.throws(()=>partitionPackage([...files,files[0]]),/duplicate/);
  const traversal=[...files,{path:'demos/../editor.js',sha256:sha('a')}];
  assert.throws(()=>partitionPackage(traversal),/unsafe/);
  const invalid=[...files,{path:'bad space.js',sha256:sha('a')}];
  assert.throws(()=>partitionPackage(invalid),/invalid/);
});
test('a PASS witness is reused only with actual cache hit and exact source fingerprint',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'qsol-browser-suite-'));
  try{
    const digest=sha('e'),path=join(dir,'editor.json');
    await writeFile(path,JSON.stringify(witness('editor',digest,'123'))+'\n');
    assert.equal(await reuse(path,'editor',digest,'true'),true);
    assert.equal(await reuse(path,'editor',digest,'false'),false);
    assert.equal(await reuse(path,'editor',sha('a'),'true'),false);
    await writeFile(path,'{}');
    assert.equal(await reuse(path,'editor',digest,'true'),false);
    await writeFile(path,JSON.stringify({...witness('editor',digest),
      provenance:'untrusted-pr'})+'\n');
    assert.equal(await reuse(path,'editor',digest,'true'),false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('browser dispatch and cache inventory share exactly the suite set',async()=>{
  const {readFile}=await import('node:fs/promises');
  const content=await readFile(new URL('../scripts/browser-check.js',import.meta.url),'utf8');
  assert.match(content,/import \{SUITES\} from '\.\/browser-suite-cache\.mjs'/);
  for(const group of SUITES)assert.ok(content.includes("runSuite('"+group+"'")||
    content.includes("needs('"+group+"')"),'suite missing execution: '+group);
});
test('GitHub Actions publishes source-bound witnesses on main only',async()=>{
  const {readFile}=await import('node:fs/promises');
  const yaml=await readFile(new URL('../.github/workflows/flight-lab.yml',import.meta.url),'utf8');
  const saves=[...yaml.matchAll(/uses: actions\/cache\/save@/g)];
  const restores=[...yaml.matchAll(/uses: actions\/cache\/restore@/g)];
  assert.equal(saves.length,7);
  assert.equal(restores.length,7);
  assert.equal([...yaml.matchAll(/github\.event_name != 'pull_request'/g)].length>=7,true);
  assert.ok(yaml.includes("run: node scripts/browser-suite-cache.mjs execute"));
  assert.ok(yaml.includes("BROWSER_FORCE_FULL:"));
  assert.ok(yaml.includes("full_browser:"),"manual forced full audit must remain available");
  assert.ok(yaml.includes("node --test tests/*.test.js"),'unit tests are not skipped');
  assert.ok(yaml.includes("node scripts/verify-offline.js"),'package integrity is never skipped');
});
