// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,delimiter} from 'node:path';
import {findPlaywright,playwrightSearchRoots} from '../scripts/rtx-playwright.mjs';

function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'qsol-playwright-test-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  return root;
}
function fakePackage(modules,{name='playwright',version='1.64.0'}={}){
  const dir=join(modules,'playwright');
  mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,'package.json'),JSON.stringify({name,version,main:'index.js'}));
  writeFileSync(join(dir,'index.js'),'module.exports={chromium:{launch:()=>42}};\n');
}
test('NODE_PATH takes precedence over the fallback tooling and is de-duplicated',t=>{
  const home=fixture(t),first=join(home,'first'),second=join(home,'second');
  const roots=playwrightSearchRoots({home,executable:join(home,'bin','node'),
    env:{NODE_PATH:[first,second,first,'relative-path'].join(delimiter)}});
  assert.deepEqual(roots.slice(0,2),[first,second]);
  assert.equal(roots.filter(x=>x===first).length,1);
  assert.ok(!roots.includes('relative-path'));
});
test('load an existing isolated Playwright Node package outside the checkout',t=>{
  const home=fixture(t),modules=join(home,'browser-tools','node_modules');
  fakePackage(modules);
  const tool=findPlaywright({roots:[modules],checkout:join(home,'repo')});
  assert.equal(tool.version,'1.64.0');
  assert.equal(tool.chromium.launch(),42);
  assert.equal(tool.location,join(modules,'playwright'));
});
test('resolve a Node installation prefix without requiring NODE_PATH',t=>{
  const home=fixture(t),prefix=join(home,'node'),modules=join(prefix,'lib','node_modules');
  fakePackage(modules);
  const roots=playwrightSearchRoots({env:{},home,executable:join(prefix,'bin','node')});
  assert.ok(roots.includes(modules));
  assert.equal(findPlaywright({roots,checkout:join(home,'repo')}).version,'1.64.0');
});
test('reject Playwright versions other than 1.64.0',t=>{
  const home=fixture(t),modules=join(home,'node_modules');
  fakePackage(modules,{version:'1.62.1'});
  assert.throws(()=>findPlaywright({roots:[modules],checkout:join(home,'repo')}),
    /Expected pinned Playwright 1\.64\.0/);
});
test('reject package substitution and unreviewed in-checkout modules',t=>{
  const home=fixture(t),outside=join(home,'outside'),checkout=join(home,'repo');
  fakePackage(outside,{name:'not-playwright'});
  assert.throws(()=>findPlaywright({roots:[outside],checkout}),/Unexpected package identity/);
  const nested=join(checkout,'node_modules');
  fakePackage(nested);
  assert.throws(()=>findPlaywright({roots:[nested],checkout}),/inside the VANILLAJS checkout/);
});
test('fail closed with actionable diagnosis when no module is installed',t=>{
  const home=fixture(t);
  assert.throws(()=>findPlaywright({roots:[join(home,'empty')],checkout:join(home,'repo')}),
    /Install it once outside the repository or point NODE_PATH/);
});
