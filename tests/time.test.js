import test from 'node:test';
import assert from 'node:assert/strict';
import {FixedClock} from '../modules/time/index.js';
import {createBody,flightConfig,stepFlight} from '../modules/flight/index.js';
test('30, 60, 144 Hz presentation produces the same physics ticks and state',()=>{
  const runs=[30,60,144].map(hz=>{
    const clock=new FixedClock(),body=createBody(),config=flightConfig();
    for(let i=0;i<hz*5;i++)clock.advance(1/hz,dt=>stepFlight(body,{thrust:[0,0,-1],turn:[0,.2,0]},dt,config));
    assert.equal(clock.ticks,600);return body;
  });
  assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[1],runs[2]);
});
test('quarter-speed runs exactly a quarter of the simulation ticks',()=>{
  const c=new FixedClock();for(let i=0;i<120;i++)c.advance(1/60,()=>{},.25);assert.equal(c.ticks,60);
});
test('pause discards accumulator, does not step and does not catch up',()=>{
  const c=new FixedClock();let n=0;c.advance(.004,()=>n++);c.setPaused(true);
  c.advance(100,()=>n++);assert.equal(n,0);c.setPaused(false);c.advance(1/120,()=>n++);assert.equal(n,1);
});
test('zero scale freezes and hitch budget bounds work with reported dropped time',()=>{
  const c=new FixedClock({maxSteps:4});let n=0;
  c.advance(10,()=>n++,0);assert.equal(n,0);
  const result=c.advance(10,()=>n++);assert.equal(n,4);assert.ok(result.dropped>9.9);assert.ok(result.alpha<1);
});
test('pausing inside an update stops the current catch-up batch',()=>{
  const c=new FixedClock();let n=0;c.advance(.2,()=>{n++;c.setPaused(true);});assert.equal(n,1);
});
test('opt-in frame snap repays drift at 30/59/60/61/75/120/144 Hz',()=>{
  for(const hz of [30,59,60,61,75,120,144]){
    const clock=new FixedClock({step:1/120,snapTolerance:.0005});
    for(let i=0;i<hz*60;i++)clock.advance(1/hz,()=>{});
    assert.ok(Math.abs(clock.ticks-7200)<=1,'steady '+hz+' Hz drifted: '+clock.ticks);
    assert.ok(Math.abs(clock.drift)<.0005,'drift must be bounded');
  }
  const rounded=new FixedClock({step:1/60,snapTolerance:.0005});
  for(let i=0;i<3600;i++)rounded.advance((i%3===0?16.6:16.7)/1000,()=>{});
  assert.equal(rounded.ticks,3600,'rounded 60 Hz must produce one tick per frame');
});
test('snapping is optional and pause, reset and scaled time repay/clear drift',()=>{
  const unchanged=new FixedClock(),explicit=new FixedClock({snapTolerance:0});
  for(const dt of [.002,.012,.008,.17,.001]){
    assert.deepEqual(unchanged.advance(dt,()=>{}),explicit.advance(dt,()=>{}));
  }
  assert.equal(unchanged.ticks,explicit.ticks);
  const clock=new FixedClock({step:1/120,snapTolerance:.0005});
  clock.advance(1/61,()=>{});
  assert.notEqual(clock.drift,0);
  clock.setPaused(true);assert.equal(clock.drift,0);
  clock.setPaused(false);clock.advance(1/61,()=>{});assert.notEqual(clock.drift,0);
  clock.advance(1/61,()=>{},.25);assert.equal(clock.drift,0);
  clock.advance(1/61,()=>{});clock.reset();assert.equal(clock.drift,0);
  assert.equal(clock.ticks,0);
});
test('invalid times and limits are rejected',()=>{
  assert.throws(()=>new FixedClock({step:0}));assert.throws(()=>new FixedClock({snapTolerance:-1}));
  assert.throws(()=>new FixedClock({snapTolerance:1}));assert.throws(()=>new FixedClock().advance(-1,()=>{}));
  assert.throws(()=>new FixedClock().advance(.1,()=>{},NaN));
});
