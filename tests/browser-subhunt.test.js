// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMobilePage} from '../scripts/browser-subhunt.js';

function fixture(failures=[]){
  const viewport={width:320,height:900},layout={width:320,height:1400,game:[0,0,320,500],controls:[0,500,320,400],footer:[0,1300,320,100]};
  const sizes=[],shots=[],clock=[];
  const page={
    viewportSize:()=>viewport,
    setViewportSize:async size=>sizes.push(size),
    evaluate:async fn=>fn.name==='layout'?layout:
      fn.toString().includes('scrollY')?123:
      fn.toString().includes('Date.now')?1000:
      fn.toString().includes('state.tick')?42:
      fn.toString().includes('subhunt.snapshot')?{screen:'playing',paused:false,state:{tick:42}}:undefined,
    clock:{
      pauseAt:async time=>clock.push(time),
      resume:async()=>clock.push('resume')
    },
    waitForFunction:async(fn,tick)=>{assert.equal(tick,42);assert.equal(clock.at(-1),'resume');},
    screenshot:async options=>{
      shots.push(options);
      if(failures.length)throw failures.shift();
      const png=Buffer.alloc(24);png.writeUInt32BE(320,16);png.writeUInt32BE(1400,20);return png;
    }
  };
  return {page,sizes,shots,viewport,clock};
}

test('mobile screenshot retries one timeout after resetting the viewport',async()=>{
  const timeout=Object.assign(new Error('screenshot stalled'),{name:'TimeoutError'});
  const {page,sizes,shots,viewport,clock}=fixture([timeout]);
  await captureMobilePage(page,320);
  assert.deepEqual(sizes,[{width:320,height:1400},viewport,{width:320,height:1400},viewport]);
  assert.deepEqual(shots,[{path:'browser-artifacts/subhunt-320.png'},{path:'browser-artifacts/subhunt-320.png'}]);
  assert.deepEqual(clock,[new Date(1100),'resume']);
});

test('mobile screenshot preserves the normal single-capture path',async()=>{
  const {page,sizes,shots,viewport}=fixture();
  await captureMobilePage(page,320);
  assert.deepEqual(sizes,[{width:320,height:1400},viewport]);
  assert.equal(shots.length,1);
});

test('mobile screenshot fails closed after repeated timeout or other errors',async()=>{
  for(const errors of [
    [Object.assign(new Error('first'),{name:'TimeoutError'}),Object.assign(new Error('second'),{name:'TimeoutError'})],
    [new Error('browser closed')]
  ]){
    const expected=errors.at(-1),{page,sizes,shots,viewport,clock}=fixture([...errors]);
    await assert.rejects(captureMobilePage(page,320),error=>error===expected);
    assert.equal(shots.length,errors.length);
    assert.deepEqual(sizes.at(-1),viewport);
    assert.equal(clock.at(-1),'resume');
  }
});

test('mobile screenshot rejects a changed retry layout and wrong PNG dimensions',async()=>{
  const timeout=Object.assign(new Error('screenshot stalled'),{name:'TimeoutError'});
  const {page,sizes,shots,viewport}=fixture([timeout]);
  const evaluate=page.evaluate;
  let layouts=0;
  page.evaluate=async fn=>fn.name==='layout'&&++layouts===3?{width:321}:evaluate(fn);
  await assert.rejects(captureMobilePage(page,320),/retried mobile document must retain its layout/);
  assert.equal(shots.length,1);
  assert.deepEqual(sizes.at(-1),viewport);

  const wrong=fixture();
  wrong.page.screenshot=async()=>Buffer.alloc(24);
  await assert.rejects(captureMobilePage(wrong.page,320),/captured PNG width/);
  assert.deepEqual(wrong.sizes.at(-1),wrong.viewport);
});
