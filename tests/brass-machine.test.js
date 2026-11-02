import test from 'node:test';
import assert from 'node:assert/strict';
import {BrassMachine, MAX_DETENTS, MOTOR_RATES, STAGES} from '../demos/ancient-machine/machine.js';
import {delta16} from '../experiments/arch-omi/index.js';
import {FixedClock} from '../modules/time/index.js';
import {referenceDelta, referenceXor} from '../scripts/omi-oracle.js';

test('Brass cam exposes the seven preparation stages and latches only on eight',()=>{
  const m = new BrassMachine(), initial = m.snapshot();
  assert.equal(initial.word,0x1234);assert.deepEqual(initial.nibbles,[1,2,3,4]);
  assert.ok(Object.values(initial.registers).every(v=>v===null));
  const expected = {capture:0x1234,a:0x2468,b:0x91a0,c:0x048d,mix:0xb145,output:0xeb79};
  for (let phase=1;phase<=7;phase++) {
    assert.equal(m.move(),true);const s=m.snapshot();
    assert.equal(s.word,0x1234);assert.equal(s.phase,phase);assert.equal(s.turns,0);
    for (const [key,start] of [['capture',1],['a',2],['b',3],['c',4],['mix',5],['output',7]]) {
      assert.equal(s.registers[key],phase<start?null:key==='mix'&&phase===5?0xb5c8:expected[key]);
    }
  }
  m.move();assert.equal(m.snapshot().word,0xeb79);assert.equal(m.snapshot().phase,0);assert.equal(m.snapshot().turns,1);
  assert.ok(Object.values(m.snapshot().registers).every(v=>v===null));
});

test('Every staged revolution agrees with both the kernel and independent arithmetic oracle; reverse restores all 65,536 words',()=>{
  for(let seed=0;seed<=0xffff;seed++){
    const m=new BrassMachine({seed});
    for(let phase=1;phase<=7;phase++){m.move();assert.equal(m.snapshot().word,seed);}
    const expected=referenceDelta(seed);assert.equal(m.snapshot().registers.output,expected);
    m.move();assert.equal(m.snapshot().word,expected);assert.equal(expected,delta16(seed));
    m.move(-8);assert.deepEqual(m.exportReplay(),new BrassMachine({seed}).exportReplay());
  }
});

test('Partial reverse across the latch restores working lanes and full turns preserve cam phase',()=>{
  const m=new BrassMachine();m.move(7);const pending=m.snapshot();m.move();m.move(-1);assert.deepEqual(m.snapshot(),pending);
  m.move(8);assert.equal(m.snapshot().phase,7);assert.equal(m.snapshot().word,0xeb79);
  assert.equal(m.snapshot().registers.output,referenceDelta(0xeb79));m.move(-8);assert.deepEqual(m.snapshot(),pending);
  m.move(-7);assert.deepEqual(m.snapshot(),new BrassMachine().snapshot());
});

test('Integer motor ticks reach detents at each rate with no early latch',()=>{
  for(const rate of MOTOR_RATES){
    const m=new BrassMachine({ticksPerDetent:rate});
    for(let n=1;n<rate*8;n++){assert.equal(m.tick(),true);assert.equal(m.snapshot().word,0x1234);assert.equal(m.snapshot().detents,Math.floor(n/rate));assert.equal(m.snapshot().subTick,n%rate);}
    m.tick();assert.equal(m.snapshot().word,0xeb79);assert.equal(m.snapshot().subTick,0);
  }
});

test('Manual movement and speed changes align the motor, invalid changes are atomic',()=>{
  const m=new BrassMachine({detents:3,subTick:12});m.move();assert.equal(m.snapshot().subTick,0);
  m.tick();m.setRate(15);assert.equal(m.snapshot().subTick,0);assert.equal(m.snapshot().detents,4);
  const before=m.exportReplay();
  for(const amount of [0,9,-9,1.5,NaN,Infinity,'1',null]){assert.throws(()=>m.move(amount));assert.deepEqual(m.exportReplay(),before);}
  for(const rate of [0,1,29,30.1,'30',null,NaN]){assert.throws(()=>m.setRate(rate));assert.deepEqual(m.exportReplay(),before);}
});

test('Bounded counters stop without wrapping or partially applying rejected moves',()=>{
  const first=new BrassMachine({subTick:10}), start=first.exportReplay();assert.equal(first.move(-1),false);assert.deepEqual(first.exportReplay(),start);
  const last=new BrassMachine({detents:MAX_DETENTS-1,subTick:29});assert.equal(last.move(8),false);assert.equal(last.snapshot().subTick,29);
  last.tick();assert.equal(last.snapshot().detents,MAX_DETENTS);assert.equal(last.snapshot().turns,65535);assert.equal(last.snapshot().subTick,0);
  const end=last.exportReplay();assert.equal(last.tick(),false);assert.equal(last.move(),false);assert.deepEqual(last.exportReplay(),end);
  assert.equal(last.move(-1),true);assert.equal(last.snapshot().phase,7);assert.equal(last.snapshot().turns,65534);
});

test('Seek is consistent for every cam phase, short cycles and the upper counter boundary',()=>{
  for(const seed of [0,0xffff,0x1234,0x1477,0x0063,0x0005]){
    let expected=seed;
    for(let turns=0;turns<24;turns++){
      for(let phase=0;phase<8;phase++)assert.equal(new BrassMachine({seed,detents:turns*8+phase}).snapshot().word,expected);
      expected=referenceDelta(expected);
    }
    let final=seed;for(let n=0;n<65535%8;n++)final=referenceDelta(final);
    assert.equal(new BrassMachine({seed,detents:MAX_DETENTS}).snapshot().word,final);
  }
});

test('Strict constructor boundaries reject coercion, nonfinite values and impossible full-counter fractions',()=>{
  for(const seed of [-1,65536,1.1,'1234',null,NaN,Infinity])assert.throws(()=>new BrassMachine({seed}));
  for(const detents of [-1,MAX_DETENTS+1,.5,'8',null,NaN])assert.throws(()=>new BrassMachine({detents}));
  for(const subTick of [-1,30,.5,'0',null,Infinity])assert.throws(()=>new BrassMachine({subTick}));
  assert.throws(()=>new BrassMachine({detents:MAX_DETENTS,subTick:1}));
});

test('Snapshots, replay objects and bounded receipts do not expose owned state',()=>{
  const m=new BrassMachine({detents:30*8+5}), before=m.exportReplay(), s=m.snapshot();
  s.word=0;s.nibbles[0]=0;s.registers.mix=0;const replay=m.exportReplay();replay.seed=0;
  const receipts=m.receipts();assert.equal(receipts.length,8);assert.equal(receipts[0].turn,23);assert.equal(receipts[7].turn,30);
  for(const row of receipts)assert.equal(row.output,referenceDelta(row.input));
  receipts[0].input=123;assert.deepEqual(m.exportReplay(),before);assert.notEqual(m.receipts()[0].input,123);
  assert.equal(m.receipts(1).length,1);for(const limit of [0,9,.5,'1',NaN])assert.throws(()=>m.receipts(limit));
  assert.ok(Object.isFrozen(MOTOR_RATES));assert.ok(Object.isFrozen(STAGES));
});

test('Receipt tape rewinds with the mechanism and fixed words still count revolutions',()=>{
  const m=new BrassMachine({seed:0x1477});m.move(8);m.move(8);
  assert.deepEqual(m.receipts(),[{turn:1,input:0x1477,output:0x1477},{turn:2,input:0x1477,output:0x1477}]);
  m.move(-1);assert.equal(m.receipts().length,1);m.move(-8);assert.deepEqual(m.receipts(),[]);
});

test('JSON replay restores every cam phase and fractional tick with identical future output',()=>{
  for(const seed of [0x1234,0x1477,0x0063,0x0005])for(const rate of MOTOR_RATES)for(let phase=0;phase<8;phase++){
    const m=new BrassMachine({seed,detents:123*8+phase,ticksPerDetent:rate,subTick:rate-1});
    const restored=BrassMachine.fromReplay(JSON.parse(JSON.stringify(m.exportReplay())));
    assert.deepEqual(restored.snapshot(),m.snapshot());
    for(let n=0;n<rate*9;n++){m.tick();restored.tick();}
    assert.deepEqual(restored.snapshot(),m.snapshot());assert.deepEqual(restored.receipts(),m.receipts());
  }
});

test('Replay schema, unknown fields, inconsistent words and malformed values are rejected',()=>{
  const m=new BrassMachine({detents:17,subTick:4}), valid=m.exportReplay();
  const invalid=[null,[],{},Object.create(valid),{...valid,extra:1},{...valid,schemaVersion:2},
    {...valid,machine:'other'},{...valid,word:referenceXor(valid.word,1)},{...valid,word:'0x1234'},
    {...valid,seed:65536},{...valid,detents:MAX_DETENTS+1},{...valid,subTick:30},{...valid,ticksPerDetent:0}];
  for(const key of Object.keys(valid)){const missing={...valid};delete missing[key];invalid.push(missing);}
  for(const data of invalid){assert.throws(()=>BrassMachine.fromReplay(data));assert.deepEqual(m.exportReplay(),valid);}
});

test('30, 60 and 144 Hz presentation schedules give identical integer machine positions',()=>{
  const results=[];
  for(const hz of [30,60,144]){
    const m=new BrassMachine(), clock=new FixedClock();
    for(let frame=0;frame<hz*5;frame++)clock.advance(1/hz,()=>m.tick());
    results.push(m.exportReplay());assert.equal(clock.ticks,600);
  }
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);assert.equal(results[0].detents,20);
});

test('Pause preserves subdetent position, resume has no time debt and long stalls are bounded',()=>{
  const m=new BrassMachine(), clock=new FixedClock();clock.advance(1/120,()=>m.tick());
  clock.setPaused(true);const before=m.exportReplay();clock.advance(500,()=>m.tick());assert.deepEqual(m.exportReplay(),before);
  clock.setPaused(false);clock.advance(1/120,()=>m.tick());assert.equal(m.snapshot().subTick,2);
  const result=clock.advance(100,()=>m.tick());assert.ok(result.steps<=32);assert.ok(result.dropped>99);assert.equal(m.snapshot().detents,1);
});
