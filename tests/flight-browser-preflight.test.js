// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadPinnedTooling} from '../scripts/flight-browser-preflight.mjs';

function fixture(t,{pwVersion='1.64.0',coreVersion='1.64.0'}={}){
  const base=mkdtempSync(join(tmpdir(),'qsol-flight-cache-'));
  t.after(()=>rmSync(base,{recursive:true,force:true}));
  const root=join(base,'flight-browser'),modules=join(root,'node_modules');
  for(const [name,version] of [['playwright',pwVersion],['playwright-core',coreVersion]]){
    const dir=join(modules,name);
    mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'package.json'),JSON.stringify({name,version,main:'index.js'}));
    if(name==='playwright')writeFileSync(join(dir,'index.js'),
      'module.exports={chromium:{launch:async()=>({version:async()=>\"156\",close:async()=>{}})}};\n');
  }
  return {base,root,modules,browsersPath:join(root,'browsers')};
}
test('exact pinned package and core in an isolated cache are reusable',t=>{
  const {base,browsersPath}=fixture(t);
  const p=loadPinnedTooling({runnerTemp:base,browsersPath});
  assert.equal(p.version,'1.64.0');
  assert.equal(typeof p.chromium.launch,'function');
});
test('outdated Playwright package invalidates cache',t=>{
  const {base,browsersPath}=fixture(t,{pwVersion:'1.62.1'});
  assert.throws(()=>loadPinnedTooling({runnerTemp:base,browsersPath}),/Playwright version mismatch/);
});
test('mismatched playwright-core invalidates cache',t=>{
  const {base,browsersPath}=fixture(t,{coreVersion:'1.62.1'});
  assert.throws(()=>loadPinnedTooling({runnerTemp:base,browsersPath}),/Playwright core must match/);
});
test('browser binaries must use the dedicated path and environment',t=>{
  const {base,browsersPath}=fixture(t);
  assert.throws(()=>loadPinnedTooling({runnerTemp:base,browsersPath:join(base,'unrelated')}),
    /Expected dedicated isolated browser path/);
  assert.throws(()=>loadPinnedTooling({runnerTemp:'relative',browsersPath}),
    /must both be absolute/);
});
test('symlinked modules escaping the cache are rejected',t=>{
  const {base,browsersPath,modules}=fixture(t);
  const outside=mkdtempSync(join(tmpdir(),'qsol-external-module-'));
  t.after(()=>rmSync(outside,{recursive:true,force:true}));
  const original=join(modules,'playwright');
  renameSync(original,join(outside,'playwright'));
  symlinkSync(join(outside,'playwright'),original,'dir');
  assert.throws(()=>loadPinnedTooling({runnerTemp:base,browsersPath}),/escapes the isolated tooling directory/);
});
