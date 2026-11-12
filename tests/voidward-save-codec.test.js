// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLargeSaveFixture} from './voidward-save-fixtures.js';
import {createEngine} from '../demos/4x-game-lab/voidward/js/core.js';
import {encodeSaveEnvelope,decodeSaveEnvelope,decodeStateText,saveByteLength,MAX_SAVE_BYTES,MAX_STATE_BYTES} from '../demos/4x-game-lab/voidward/js/save-codec.js';

test('a validated save larger than the old 2MB envelope limit exports and imports without state loss',async()=>{
  const {pack,state,text}=await createLargeSaveFixture(),engine=createEngine(pack);
  assert.ok(saveByteLength(text)>2000000);assert.ok(saveByteLength(text)<MAX_SAVE_BYTES);assert.ok(text.startsWith('{"kind":'));
  const restored=decodeSaveEnvelope(text);assert.equal(restored.kind,'voidward.save.v1');assert.equal(restored.extension,null);
  assert.deepEqual(engine.migrateState(restored.state),state);
  assert.deepEqual(engine.deserialize(JSON.stringify(state)),state,'engine state admission uses the same expanded contract');
});

test('legacy pretty printed envelopes remain importable and re-export compactly',async()=>{
  const {text}=await createLargeSaveFixture(),envelope=decodeSaveEnvelope(text),pretty=JSON.stringify(envelope,null,2);
  assert.ok(pretty.length>text.length);assert.equal(encodeSaveEnvelope(decodeSaveEnvelope(pretty)),text);
});

test('size checks reject before parsing and export refuses an unreadable envelope',()=>{
  assert.throws(()=>decodeSaveEnvelope(' '.repeat(MAX_SAVE_BYTES+1)),/49 MiB UTF-8 limit/);
  assert.throws(()=>decodeStateText(' '.repeat(MAX_STATE_BYTES+1)),/48 MiB UTF-8 limit/);
  assert.throws(()=>encodeSaveEnvelope({kind:'voidward.save.v1',extension:null,state:{},padding:' '.repeat(MAX_SAVE_BYTES)}),/49 MiB UTF-8 limit/);
  assert.equal(saveByteLength('Aé🌌'),7,'sizes are UTF-8 bytes, not JavaScript character counts');
});

test('codec admission preserves the native envelope boundary before full schema validation',()=>{
  for(const bad of [{kind:'wrong',extension:null,state:{}},{kind:'voidward.save.v1',extension:{},state:{}},{kind:'voidward.save.v1',extension:null,state:[]}])assert.throws(()=>decodeSaveEnvelope(JSON.stringify(bad)),/Choose a VOIDWARD save/);
});
