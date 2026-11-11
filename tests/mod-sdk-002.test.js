// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {CIRCUIT_KIND,compileCircuitQ16,crossCircuitGateQ16,
  newCircuitProgress,advanceCircuitQ16} from '../modules/exact-circuit/index.js';
import {DataModRegistry,MOD_PACK_KIND} from '../modules/mod-sdk/index.js';
import {COURSE_ENTRY_KIND,validateCourseMod,registerCourseMod,
  activeCompiledCourses} from '../modules/mod-course/index.js';
import {SCALE} from '../modules/integer-math/index.js';

const clone=value=>structuredClone(value);
const source=(axis='x',direction=1,planes=[10,20,30,0],laps=2)=>({
  id:'test-circuit',version:2,laps,spawn:['0','8','0'],
  gates:planes.map((v,i)=>({
    id:'g'+i,x:axis==='x'?String(v):'0',y:'8',
    z:axis==='z'?String(v):'0',width:'20',height:'14',axis,direction
  })),obstacles:[]
});
const raw=(x,y,z)=>[x*SCALE,y*SCALE,z*SCALE];
const cross=(c,from,to)=>crossCircuitGateQ16(c.gates[0],from,to);
const pack=(course,id='my-mod')=>({kind:MOD_PACK_KIND,id,version:'1.0.0',
  requires:[],entries:[{id:'track',kind:'data',
    data:{kind:COURSE_ENTRY_KIND,course}}]});

test('genuine bounded exact cardinal circuit and immutable raw bounds',()=>{
  const c=compileCircuitQ16(source());
  assert.equal(c.kind,CIRCUIT_KIND);
  assert.equal(c.gates.length,4);
  assert.deepEqual(c.gates[0],{
    id:'g0',axis:'x',direction:1,planeRaw:10*SCALE,
    sideRaw:0,bottomRaw:1*SCALE,topRaw:15*SCALE,halfWidthRaw:10*SCALE
  });
  assert.deepEqual(c.spawnRaw,raw(0,8,0));
  assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.gates)&&Object.isFrozen(c.gates[0]));
  assert.ok(Object.isFrozen(c.obstacles));
  const p=newCircuitProgress(c);
  assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.events));
  assert.deepEqual([p.nextGate,p.completedLaps,p.clearedGates,p.finished],[0,0,0,false]);
});

test('both cardinal axes and crossing signs accept only correct directional segments',()=>{
  for(const axis of ['x','z'])for(const dir of [-1,1]){
    const c=compileCircuitQ16(source(axis,dir));
    const from=axis==='x'?raw(10-dir,8,0):raw(0,8,10-dir);
    const to=axis==='x'?raw(10+dir,8,0):raw(0,8,10+dir);
    assert.ok(cross(c,from,to),axis+dir+' expected crossing');
    assert.equal(cross(c,to,from),null,'reversed traversal');
    const on=axis==='x'?raw(10,8,0):raw(0,8,10);
    assert.equal(cross(c,on,to),null,'starting on plane is not entry');
    assert.ok(cross(c,from,on),'ending exactly on plane is entry');
  }
});
test('closed Q16 aperture, sub-unit offset and wrong-height behavior',()=>{
  const c=compileCircuitQ16(source());
  assert.ok(cross(c,raw(9,1,10),raw(11,1,10)),'closed bottom/lateral edge');
  assert.ok(cross(c,raw(9,15,-10),raw(11,15,-10)),'closed top/lateral edge');
  assert.equal(cross(c,raw(9,8,10+1/SCALE),raw(11,8,10+1/SCALE)),null);
  assert.equal(cross(c,raw(9,15+1/SCALE,0),raw(11,15+1/SCALE,0)),null);
});
test('multiple gates are chronological and stop at first missed gate',()=>{
  const ordered=compileCircuitQ16(source());
  const p=advanceCircuitQ16(ordered,newCircuitProgress(ordered),raw(0,8,0),raw(35,8,0));
  assert.equal(p.nextGate,3);
  assert.equal(p.crossed,3);
  assert.deepEqual(p.events.map(e=>e.type),['gate','gate','gate']);
  const reversed=compileCircuitQ16(source('x',1,[10,5,30,0]));
  assert.equal(advanceCircuitQ16(reversed,newCircuitProgress(reversed),
    raw(0,8,0),raw(35,8,0)).nextGate,1);
  const coincident=compileCircuitQ16(source('x',1,[10,10,30,0]));
  assert.equal(advanceCircuitQ16(coincident,newCircuitProgress(coincident),
    raw(0,8,0),raw(35,8,0)).nextGate,1);
});
test('lap boundary retains strict fraction order, terminal finish stops extra credit',()=>{
  const c=compileCircuitQ16(source('x',1,[10,20,30,0]));
  let p=newCircuitProgress(c);
  // Three gates in first step, next is last gate at x=0.
  p=advanceCircuitQ16(c,p,raw(0,8,0),raw(35,8,0));
  assert.equal(p.nextGate,3);
  p=advanceCircuitQ16(c,p,raw(-5,8,0),raw(15,8,0));
  assert.equal(p.completedLaps,1);
  assert.equal(p.nextGate,1);
  assert.deepEqual(p.events.map(e=>e.type),['gate','lap','gate']);
  assert.deepEqual(p.events.map(e=>e.order??null),[4,null,5]);
  // Complete second lap only after passing next gates in order.
  p=advanceCircuitQ16(c,p,raw(15,8,0),raw(35,8,0));
  assert.equal(p.nextGate,3);
  p=advanceCircuitQ16(c,p,raw(-5,8,0),raw(15,8,0));
  assert.equal(p.completedLaps,2);
  assert.equal(p.clearedGates,8);
  assert.equal(p.finished,true);
  assert.deepEqual(p.events.map(e=>e.type),['gate','finish']);
  assert.equal(p.nextGate,c.gates.length);
  assert.equal(advanceCircuitQ16(c,p,raw(-5,8,0),raw(15,8,0)),p);
});
test('simultaneous lap boundary cannot credit next lap first gate',()=>{
  const c=compileCircuitQ16(source('x',1,[0,20,30,0]));
  let p=newCircuitProgress(c);
  p=advanceCircuitQ16(c,p,raw(-5,8,0),raw(35,8,0));
  assert.equal(p.nextGate,3);
  p=advanceCircuitQ16(c,p,raw(-5,8,0),raw(15,8,0));
  assert.equal(p.completedLaps,1);
  assert.equal(p.nextGate,0);
  assert.deepEqual(p.events.map(e=>e.type),['gate','lap']);
});
test('contact tick denies checkpoints with no partial transition',()=>{
  const c=compileCircuitQ16(source());
  const original=newCircuitProgress(c);
  const skipped=advanceCircuitQ16(c,original,raw(0,8,0),raw(35,8,0),{contact:true});
  assert.equal(skipped.nextGate,0);
  assert.equal(skipped.crossed,0);
  assert.equal(skipped.clearedGates,0);
  assert.deepEqual(skipped.events,[]);
  assert.deepEqual(original.events,[]);
  assert.throws(()=>advanceCircuitQ16(c,original,raw(0,8,0),raw(35,8,0),{contact:'yes'}),TypeError);
});
test('cross-course state and forged gate identity cannot be reused',()=>{
  const c=compileCircuitQ16(source()),other=compileCircuitQ16(source());
  const p=newCircuitProgress(c);
  assert.throws(()=>advanceCircuitQ16(other,p,raw(0,8,0),raw(35,8,0)),TypeError);
  assert.throws(()=>advanceCircuitQ16({...c},p,raw(0,8,0),raw(35,8,0)),TypeError);
  assert.throws(()=>advanceCircuitQ16(c,{...p},raw(0,8,0),raw(35,8,0)),TypeError);
  assert.throws(()=>crossCircuitGateQ16({...c.gates[0]},raw(0,8,0),raw(35,8,0)),TypeError);
  assert.throws(()=>cross(c,[NaN,0,0],raw(11,8,0)),RangeError);
});
test('invalid manifest shapes, exact strings and physical bounds fail closed',()=>{
  const scenarios=[
    s=>s.laps=0,s=>s.laps=10,s=>s.version=1,s=>s.gates[0].axis='y',
    s=>s.gates[0].direction=0,s=>s.gates[0].width='0.5',
    s=>s.gates[0].height='4.00001',
    s=>s.gates[0].x='0.1',s=>s.gates[1].id=s.gates[0].id,
    s=>s.gates[0].y='1',s=>s.spawn[0]='10000',
    s=>delete s.gates[1],s=>s.script='evil',
    s=>Object.defineProperty(s.gates[0],'x',{get(){throw Error('DO NOT CALL');}})
  ];
  for(const change of scenarios){
    const s=source();change(s);
    assert.throws(()=>compileCircuitQ16(s),/TypeError|RangeError/);
  }
  const bounds=source();
  bounds.obstacles=[{id:'wall',min:['0','0','0'],max:['1','2','3'],color:'#ff9944'}];
  assert.equal(compileCircuitQ16(bounds).obstacles[0].max[1],2*SCALE);
  bounds.obstacles[0].min=['0','-1','0'];
  assert.throws(()=>compileCircuitQ16(bounds),RangeError);
});
test('independent Python Fraction oracle verifies 1024 X/Z signed sweeps',()=>{
  const scenarios=[];
  for(const axis of ['x','z'])for(const direction of [-1,1]){
    const gate=compileCircuitQ16(source(axis,direction)).gates[0];
    for(let i=0;i<256;i++){
      const from=axis==='x'?raw(10+(i%9-5)*direction,8,0):
        raw(0,8,10+(i%9-5)*direction);
      const to=axis==='x'?raw(10+(i%13-4)*direction,8,0):
        raw(0,8,10+(i%13-4)*direction);
      from[1]=[1,15,16,0,8][i%5]*SCALE;
      to[1]=from[1];
      const sideways=[-11,-10,-3,0,10,11][i%6]*SCALE;
      from[axis==='x'?2:0]=sideways;to[axis==='x'?2:0]=sideways;
      scenarios.push({gate,from,to});
    }
  }
  const results=scenarios.map(x=>Boolean(crossCircuitGateQ16(x.gate,x.from,x.to)));
  const p=spawnSync('python3',['scripts/mod_sdk_002_oracle.py'],
    {input:JSON.stringify({scenarios}),encoding:'utf8',maxBuffer:3e6});
  assert.equal(p.status,0,p.stderr);
  const expected=JSON.parse(p.stdout);
  assert.equal(expected.kind,'qsol.mod-sdk-002.fraction-oracle.v1');
  assert.equal(expected.matches.length,1024);
  assert.deepEqual(results,expected.matches);
  assert.ok(results.some(Boolean)&&results.some(x=>!x));
});
test('typed pack validation is detached and never activates invalid course',async()=>{
  const example=JSON.parse(await readFile(new URL('../examples/mod-sdk-002/cardinal-loop.json',import.meta.url),'utf8'));
  const valid=validateCourseMod(example);
  assert.equal(valid.entries[0].data.kind,COURSE_ENTRY_KIND);
  assert.ok(Object.isFrozen(valid.entries[0].data.course));
  const registry=new DataModRegistry();
  registerCourseMod(registry,example);registry.activate('alien-circuit-demo');
  const active=activeCompiledCourses(registry);
  assert.equal(active.length,1);
  assert.equal(active[0].compiled.laps,2);
  assert.equal(active[0].modId,'alien-circuit-demo');
  const tampered=clone(example);tampered.entries[0].data.course.gates[0].x='NaN';
  assert.throws(()=>registerCourseMod(registry,tampered),TypeError);
  assert.equal(registry.list().length,1);
  assert.equal(registry.get('alien-circuit-demo').entries[0].data.course.gates[0].x,'10');
});
test('v1 and v2 coexist as typed inert mod data, no runtime execution',()=>{
  const legacy={id:'sprint',version:1,gates:[
    {id:'01',x:'0',y:'3',z:'-20',width:'12',height:'8'},
    {id:'02',x:'0',y:'3',z:'-40',width:'12',height:'8'}
  ]};
  const registry=new DataModRegistry();
  const one=pack(legacy,'old-course');
  const two=pack(source(),'new-course');
  registerCourseMod(registry,one);registerCourseMod(registry,two);
  registry.activate('new-course');registry.activate('old-course');
  const active=activeCompiledCourses(registry);
  assert.deepEqual(active.map(x=>x.modId),['new-course','old-course']);
  assert.deepEqual(active.map(x=>x.compiled.kind),
    [CIRCUIT_KIND,'qsol.vanillajs.alien-course.v1']);
  assert.equal(active[1].compiled.gates.length,2);
  const bad=pack(source(),'invalid');
  bad.entries[0].data.kind='untrusted-executable-plugin';
  assert.throws(()=>registerCourseMod(registry,bad),TypeError);
  assert.equal(registry.list().length,2);
});
