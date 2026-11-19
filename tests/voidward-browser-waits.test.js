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

test('legacy import runs in isolated Chromium storage and verifies the actual persisted state',async()=>{
  const source=await readFile(new URL('../scripts/browser-voidward.js',import.meta.url),'utf8');
  const start=source.indexOf("await check('legacy-save-migration'");
  const end=source.indexOf("await check('large-save-roundtrip'",start);
  assert.ok(start>=0&&end>start);
  const migration=source.slice(start,end);
  assert.match(migration,/const legacyContext=await browser\.newContext\(/);
  assert.match(migration,/page=await legacyContext\.newPage\(\)/);
  assert.match(migration,/localStorage\.getItem\('vanillajs\.voidward\.active\.v1'\)/);
  assert.match(migration,/assert\.deepEqual\(saved\.state,migrated\.state/);
  assert.match(migration,/assert\.deepEqual\(saved\.pack,migrated\.pack\.raw/);
  assert.match(migration,/page=originalPage/);
  assert.match(migration,/await legacyContext\.close\(\)/);
  assert.doesNotMatch(migration,/localStorage\.clear\(/,'other campaign slots must not be wiped');
  assert.doesNotMatch(migration,/\.catch\(\(\)=>\{\}\)/,'reload failures cannot be silenced');
});
