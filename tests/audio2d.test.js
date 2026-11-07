import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound2D,AUDIO2D_RATE} from '../modules/audio2d/index.js';
const score=[
  {id:1,channel:0,sample:0,duration:1200,frequency:440,wave:'triangle',gain:5000},
  {id:2,channel:1,sample:400,duration:700,frequency:330,wave:'square',gain:3000},
  {id:3,channel:2,sample:900,duration:600,frequency:150,wave:'noise',seed:17,gain:2500},
  {id:4,channel:3,sample:1200,duration:700,frequency:600,wave:'saw',gain:4000}
];
test('48kHz fixed integer PCM and partition invariant rendering',()=>{
  const r=createSound2D({frames:2000,events:score});
  assert.equal(r.sampleRate,AUDIO2D_RATE);assert.equal(r.eventCount,4);
  const all=r.renderAll(),parts=[r.renderRange(0,1),r.renderRange(1,127),
    r.renderRange(128,128),r.renderRange(256,1744)];
  assert.deepEqual(all,Int16Array.from(parts.flatMap(x=>Array.from(x))));
  assert.deepEqual(r.renderAll(),all);assert.notEqual(all.reduce((s,v)=>s+Math.abs(v),0),0);
  assert.equal(all[0],0);assert.equal(all.at(-1),0);
});
test('WAV always exports explicit signed PCM16 little-endian bytes',()=>{
  const r=createSound2D({frames:2000,events:score}),wav=r.wav();
  const decoder=new TextDecoder(),str=(n,size)=>decoder.decode(wav.subarray(n,n+size)),v=new DataView(wav.buffer);
  assert.equal(str(0,4),'RIFF');assert.equal(str(8,4),'WAVE');
  assert.equal(str(36,4),'data');assert.equal(v.getUint16(22,true),1);
  assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint32(40,true),4000);
  const pcm=r.renderAll();
  for(let i=0;i<pcm.length;i++)assert.equal(v.getInt16(44+i*2,true),pcm[i]);
  const clone=r.wav();wav[100]=255;assert.notDeepEqual(clone,wav);
  assert.deepEqual(r.wav(),clone);
});
test('event ordering, owned summaries, waveform and seed identity',()=>{
  const r=createSound2D({frames:2000,events:score.toReversed()});
  assert.deepEqual(r.renderAll(),createSound2D({frames:2000,events:score}).renderAll());
  const summary=r.eventSummary();summary[0].frequency=777;
  assert.equal(r.eventSummary()[0].frequency,440);
  const shifted=score.map(x=>x.id===3?{...x,seed:18}:x);
  assert.notDeepEqual(createSound2D({frames:2000,events:score}).renderAll(),
    createSound2D({frames:2000,events:shifted}).renderAll());
});
test('fixed channel concurrency, invalid positions, overflow and NaN refuse',()=>{
  const base={id:1,channel:0,sample:0,duration:100,
    frequency:440,wave:'square'};
  for(const event of [
    {...base,id:2,sample:10},{...base,id:1,sample:0,channel:4},
    {...base,id:1,sample:0,duration:1000},{...base,id:1,frequency:0},
    {...base,id:1,frequency:NaN},{...base,id:1,wave:'fm'},
    {...base,id:1,gain:Infinity},{...base,id:1,seed:-1}
  ])assert.throws(()=>createSound2D({frames:200,events:[base,event]}));
  const r=createSound2D({frames:200,events:[base]});
  for(const [start,count] of [[-1,1],[0,201],[201,0],[200,1],[1,-1]])
    assert.throws(()=>r.renderRange(start,count));
  assert.throws(()=>createSound2D({frames:48000*9}));
  assert.throws(()=>createSound2D({frames:100,events:[{...base,id:2,sample:0}]}));
});
test('silent no-event song and independent renderer state',()=>{
  const a=createSound2D({frames:128});
  assert.deepEqual(a.renderRange(0,128),new Int16Array(128));
  const wav=a.wav();assert.equal(wav.length,300);
  const b=createSound2D({frames:128});assert.deepEqual(a.wav(),b.wav());
});
