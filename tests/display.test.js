// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisplayController} from '../api/display/index.js';
function fixture(){const doc=new EventTarget();doc.fullscreenElement=null;const root={ownerDocument:doc};root.requestFullscreen=async()=>{doc.fullscreenElement=root;doc.dispatchEvent(new Event('fullscreenchange'));};doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));};return {doc,root};}
test('display follows actual fullscreen, Escape, persistent window choice and transitions',async()=>{
  const {root,doc}=fixture(),saved=[],views=[];let cancels=0;const c=createDisplayController({root,initial:'page',save:x=>saved.push(x),onChange:x=>views.push(x),onTransition:()=>cancels++});
  assert.equal(await c.setMode('fullscreen'),true);assert.equal(c.snapshot().mode,'fullscreen');assert.deepEqual(saved,[]);
  await doc.exitFullscreen();assert.equal(c.snapshot().mode,'page');assert.ok(cancels>=3);
  await c.setMode('fit');assert.equal(saved.at(-1),'fit');assert.equal(views.at(-1).pending,false);c.dispose();await assert.rejects(c.setMode('fullscreen'));
});
test('display denial and absent APIs recover to Fit even with broken storage',async()=>{
  for(const denied of [true,false]){const {root}=fixture();if(denied)root.requestFullscreen=()=>Promise.reject(new Error('denied'));else delete root.requestFullscreen;
    const c=createDisplayController({root,initial:'page',save(){throw new Error('blocked');}});assert.equal(await c.setMode('fullscreen'),false);assert.equal(c.snapshot().mode,'fit');assert.match(c.snapshot().message,/unavailable/);assert.equal(c.snapshot().pending,false);c.dispose();}
});
test('display coalesces pending requests and cleans up a late fullscreen entry after disposal',async()=>{
  const {root,doc}=fixture();let resolve,notices=0;root.requestFullscreen=()=>new Promise(r=>resolve=()=>{doc.fullscreenElement=root;r();});
  const c=createDisplayController({root,onChange:()=>notices++}),pending=c.setMode('fullscreen');assert.equal(await c.setMode('page'),false);c.dispose();const before=notices;resolve();assert.equal(await pending,false);assert.equal(doc.fullscreenElement,null);assert.equal(notices,before);
});
test('display cannot mistake another element for its fullscreen root',async()=>{
  const {root,doc}=fixture();doc.fullscreenElement={};const c=createDisplayController({root});await c.setMode('page');assert.notEqual(doc.fullscreenElement,null);assert.equal(c.snapshot().mode,'page');c.dispose();
});
