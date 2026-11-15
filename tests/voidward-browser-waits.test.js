// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('VOIDWARD browser waits guard the public debug hook during async reload',async()=>{
  const source=await readFile(new URL('../scripts/browser-voidward.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/(?<![\w.])__voidward\b/,
    'bare __voidward accesses throw ReferenceError until the game module initializes');
  // Browser hook may be temporarily absent after page.reload(), while a file
  // import replaces the current document, or while startup is pending.
  const predicate=()=>globalThis.__voidward?.state?.version===2;
  const original=globalThis.__voidward;
  try{
    delete globalThis.__voidward;
    assert.equal(predicate(),false);
    globalThis.__voidward={state:{version:2}};
    assert.equal(predicate(),true);
  }finally{
    if(original===undefined)delete globalThis.__voidward;
    else globalThis.__voidward=original;
  }
});

test('legacy save reload waits for the expected campaign and turn with a boot allowance',async()=>{
  const source=await readFile(new URL('../scripts/browser-voidward.js',import.meta.url),'utf8');
  assert.match(source,/const SAVE_RESTORE_TIMEOUT_MS=30_000;/);
  assert.match(source,/globalThis\.__voidward\?\.pack\.meta\.id===id&&globalThis\.__voidward\.state\.version===2&&globalThis\.__voidward\.state\.turn===turn/);
  assert.match(source,/await page\.reload\(\);await page\.waitForFunction\(\(\{id,turn\}\)=>[\s\S]*?\{timeout:SAVE_RESTORE_TIMEOUT_MS\}\)/);
});
