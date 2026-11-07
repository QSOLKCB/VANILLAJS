// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameGate} from '../modules/frame-gate/index.js';
import {FixedClock} from '../modules/time/index.js';

const ctx=(key='state:0',width=384,height=256,contextEpoch=0)=>
  ({key,width,height,contextEpoch});

test('unchanged frames draw once then skip, explicit invalidation redraws once',()=>{
  const gate=new FrameGate();let draws=0;
  const draw=()=>{draws++;};
  assert.equal(gate.present(ctx(),draw),true);
  for(let i=0;i<1000;i++)assert.equal(gate.present(ctx(),draw),false);
  assert.equal(draws,1);
  gate.invalidate();
  assert.equal(gate.present(ctx(),draw),true);
  assert.equal(gate.present(ctx(),draw),false);
  assert.deepEqual(gate.stats(),{drawn:2,skipped:1001,invalidations:1,dirty:false});
});

test('size, context generation and complete primitive state keys invalidate',()=>{
  const gate=new FrameGate();let count=0,draw=()=>{count++;};
  const sequence=[
    ctx('scene',100,100),ctx('scene',100,100),
    ctx('scene',100,101),ctx('scene',100,101),
    ctx('scene',100,101,1),ctx('scene',100,101,1),
    ctx('camera',100,101,1),ctx('camera',100,101,1),
    ctx(5,100,101,1),ctx('5',100,101,1),
    ctx(0,100,101,1),ctx(-0,100,101,1),
    ctx(0n,100,101,1)
  ];
  const expected=[true,false,true,false,true,false,true,false,
    true,true,true,true,true];
  assert.deepEqual(sequence.map(x=>gate.present(x,draw)),expected);
  assert.equal(count,expected.filter(Boolean).length);
});

test('render failures cannot commit a frame, and recovery always redraws',()=>{
  const gate=new FrameGate(),state=ctx();let calls=0;
  assert.throws(()=>gate.present(state,()=>{calls++;throw Error('lost context');}),/lost context/);
  assert.equal(gate.dirty,true);
  assert.equal(gate.present(state,()=>{calls++;}),true);
  assert.equal(gate.present(state,()=>{calls++;}),false);
  assert.equal(calls,2);
  const thenable={then(){}};
  assert.throws(()=>gate.present(ctx('changed'),()=>thenable),/async/);
  assert.equal(gate.dirty,true);
  assert.equal(gate.present(ctx('changed'),()=>{calls++;}),true);
});

test('reentrancy rejected; invalidation during draw is carried to the next frame',()=>{
  const gate=new FrameGate(),state=ctx();
  let count=0;
  gate.present(state,()=>{
    assert.throws(()=>gate.present(state,()=>{}),/reentrant/);
    gate.invalidate();count++;
  });
  assert.equal(gate.dirty,true);
  assert.equal(gate.present(state,()=>{count++;}),true);
  assert.equal(gate.dirty,false);
  assert.equal(gate.present(state,()=>{count++;}),false);
  assert.equal(count,2);
});

test('bad inputs fail before callbacks or invalidating the previous image',()=>{
  const gate=new FrameGate();let draws=0;
  const draw=()=>{draws++;};
  gate.present(ctx('stable'),draw);
  const bad=[ctx({mutable:1}),ctx(NaN),ctx(Infinity),
    ctx('x',0,256),ctx('x',384,-1),ctx('x',1.2,10),
    ctx('x',10,10,-1),ctx('x',10,10,1.5)];
  for(const input of bad){
    const before=gate.stats();
    assert.throws(()=>gate.present(input,draw));
    assert.deepEqual(gate.stats(),before);
  }
  assert.throws(()=>gate.present(ctx(),null),TypeError);
  assert.equal(gate.present(ctx('stable'),draw),false);
  assert.equal(draws,1);
});

test('60/120/144 Hz presentation schedules skip tickless and paused frames',()=>{
  // The gate does not interpret wall-clock time, unlike FixedClock.
  // Explicit update epochs are authoritative; no interpolated image is assumed.
  for(const hz of [60,120,144]){
    const clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6});
    const gate=new FrameGate(),drawLog=[];let ticks=0,frames=0;
    // The first image is presented before rAF pacing begins. It is not a
    // redundant refresh, even when the first 120/144 Hz frame has no tick.
    assert.equal(gate.present(ctx(ticks),()=>drawLog.push(ticks)),true);
    for(let frame=0;frame<hz;frame++){
      const {steps}=clock.advance(1/hz,()=>ticks++);
      if(steps)gate.invalidate();
      const wasDrawn=gate.present(ctx(ticks),()=>drawLog.push(ticks));
      frames+=Number(wasDrawn);
    }
    assert.equal(ticks,60,'every refresh schedule advances sixty simulation ticks');
    assert.equal(drawLog.length,frames+1);
    assert.equal(frames,60,'no repeat image should be redrawn at higher refresh');
    const recorded=gate.stats();
    for(let i=0;i<hz;i++)gate.present(ctx(ticks),()=>{throw Error('paused redraw');});
    assert.equal(gate.stats().drawn,recorded.drawn);
    assert.equal(gate.stats().skipped,recorded.skipped+hz);
  }
});

test('sequence parity with forced-fresh rendering for all state changes',()=>{
  // Render a synthetic pure 8x8 framebuffer; the reference always computes
  // it. The gate computes only changed keys, but retains the same pixels.
  const gate=new FrameGate(),state={x:0,y:0,menu:false,paused:false,revision:0};
  let screen=null,renderCalls=0;
  const render=()=>{
    renderCalls++;
    const buf=new Uint8Array(64);
    buf.fill(state.menu?8:state.paused?3:2);
    buf[state.y*8+state.x]=255;
    return buf;
  };
  for(let frame=0;frame<500;frame++){
    if(frame%13===0){state.x=(state.x+1)%8;state.revision++;}
    if(frame%29===0){state.y=(state.y+1)%8;state.revision++;}
    if(frame%37===0){state.menu=!state.menu;state.revision++;}
    if(frame%41===0){state.paused=!state.paused;state.revision++;}
    const expected=render();
    const key='revision:'+state.revision;
    gate.present(ctx(key,8,8),()=>{screen=render();});
    assert.deepEqual(screen,expected,'frame '+frame+' stale image');
  }
  assert.ok(gate.stats().skipped>300);
  assert.ok(renderCalls<850,'the gate must avoid most duplicate drawing work');
});
