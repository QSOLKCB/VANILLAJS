// SPDX-License-Identifier: Apache-2.0
// Browser source contract is complemented by actual CDP multi-touch tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DriveInput} from '../demos/horizon-lab/drive-input.js';

test('cancelling both held touch controls retires inputs and does not re-arm old presses',()=>{
  const input=new DriveInput({directional:true});
  input.press(3,'throttle',true);input.press(4,'left',true);
  assert.deepEqual(input.read(),{throttle:1,brake:0,steer:-1,reverse:0});
  input.cancel();
  assert.equal(input.snapshot().pointers,0);
  assert.deepEqual(input.read(),{throttle:0,brake:0,steer:0,reverse:0});
  input.release(3);input.release(4);
  assert.deepEqual(input.read(),{throttle:0,brake:0,steer:0,reverse:0});
  input.press(5,'throttle',false);
  assert.equal(input.read().throttle,0);
  input.press(6,'left',true);
  assert.equal(input.read().steer,-1,'a new valid press may still steer');
});

test('race player provides a global touch-cancel fallback without removing ordinary pointer release',async()=>{
  const player=await readFile(new URL('../demos/horizon-lab/race-player.js',import.meta.url),'utf8');
  const harness=await readFile(new URL('../scripts/browser-horizon-race.js',import.meta.url),'utf8');
  assert.match(player,/listen\(window,'touchcancel',cancelTouch\)/);
  assert.match(player,/listen\(window,'pointercancel',event=>\{if\(event.pointerType==='touch'\)cancelTouch\(\);\}\)/);
  assert.match(player,/const cancelTouch=\(\)=>\{if\(!pointers.size\)return;clear\(\);hud\(\);\}/);
  assert.match(player,/\['pointerup','pointercancel','lostpointercapture'\]/);
  assert.match(harness,/type:'touchCancel',touchPoints:\[\]/);
  assert.match(harness,/window.dispatchEvent\(new Event\('touchcancel'/);
  assert.match(harness,/timeout:5000/);
});
