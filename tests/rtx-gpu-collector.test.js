// SPDX-License-Identifier: Apache-2.0
// Deterministic independent fake rAF/WebGL contract for the optional GPU sampler.
// No Chromium/NVIDIA hardware is required for these pure instrumentation tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {captureInit} from '../scripts/rtx5060ti-browser.mjs';

function harness(){
  const queued=[],listeners={},state={focused:true,hidden:false,status:'RUNNING'};
  let now=0;
  class MockWebGL{
    bufferData(){}
    bufferSubData(){}
    drawArrays(){}
  }
  const window={
    requestAnimationFrame(callback){queued.push(callback);return queued.length;},
    addEventListener(name,callback){listeners['window:'+name]=callback;}
  };
  const document={
    get hidden(){return state.hidden;},
    hasFocus(){return state.focused;},
    querySelector(selector){assert.equal(selector,'#status');return {textContent:state.status};},
    addEventListener(name,callback){listeners['document:'+name]=callback;}
  };
  runInNewContext('('+captureInit.toString()+')()',{
    window,document,WebGLRenderingContext:MockWebGL,
    performance:{now:()=>now++},Number,Error
  });
  const gl=new MockWebGL();
  const step=(time,size=24)=>{
    window.requestAnimationFrame(()=>{
      gl.bufferData(1,new Uint8Array(size),2);
      gl.bufferSubData(1,0,new Uint8Array(12));
      gl.drawArrays(4,0,6);
    });
    const frame=queued.shift();frame(time);
  };
  return {window,document,state,listeners,step};
}
test('GPU upload totals stop on the exact requested callback, independent of poll delay',()=>{
  const h=harness();
  h.window.__qsolUploads.reset();h.window.__qsolFrame.reset(3);
  for(let i=1;i<=9;i++)h.step(i*16);
  const meter=h.window.__qsolFrame,uploads=h.window.__qsolUploads.snapshot();
  assert.equal(meter.callbackMs.length,3);
  assert.equal(meter.deltaMs.length,2);
  assert.equal(meter.active,false);
  assert.equal(uploads.bufferDataCalls,3);
  assert.equal(uploads.bufferSubDataCalls,3);
  assert.equal(uploads.uploadedBytes,3*(24+12));
  assert.equal(uploads.drawArraysCalls,3);
  assert.equal(uploads.drawnVertices,18);
  assert.deepEqual(Array.from(meter.invalidReasons),[]);
});
test('focus loss, document hiding and paused simulation reject a hardware timing sample',()=>{
  for(const condition of ['window-blur','document-hidden','simulation-paused']){
    const h=harness(),meter=h.window.__qsolFrame;
    meter.reset(2);h.step(16);
    if(condition==='window-blur'){h.state.focused=false;h.listeners['window:blur']();}
    if(condition==='document-hidden'){h.state.hidden=true;h.listeners['document:visibilitychange']();}
    if(condition==='simulation-paused')h.state.status='PAUSED';
    h.step(32);
    assert.equal(meter.active,false);
    assert.ok(meter.invalidReasons.length>0,condition+' must invalidate');
  }
});
test('initially paused or unfocused scenes cannot create a clean sample',()=>{
  for(const kind of ['paused','unfocused','hidden']){
    const h=harness();
    if(kind==='paused')h.state.status='PAUSED';
    if(kind==='unfocused')h.state.focused=false;
    if(kind==='hidden')h.state.hidden=true;
    h.window.__qsolFrame.reset(1);
    h.step(16);
    assert.ok(h.window.__qsolFrame.invalidReasons.length>0,kind);
  }
});
