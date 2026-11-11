// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {add3,subtract3,multiply3,stateVector,ternaryMatrix,matrixVector,matrixProduct,
  inverseMatrix,affineTransform,applyAffine,invertAffine,transition,transitionGraph,syndrome} from '../modules/gf3/index.js';
import {eventMapping,transitionEvent,referenceSound} from '../modules/symbolic-events/index.js';
import {validateExperimentMod,registerExperimentMod,activeExperiments} from '../modules/mod-experiment/index.js';
import {DataModRegistry} from '../modules/mod-sdk/index.js';
import {IntegerClock} from '../modules/integer-time/index.js';
import {KeplerOrbit,circularSpeedSI} from '../modules/orbital-physics/index.js';
import {transformGF3} from '../modules/gf3-lattice/index.js';
import {Experiment,starterPack} from '../demos/quantum-game-lab/experiment.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/qgame-math-001.json',import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=x=>hash(JSON.stringify(x));
const clone=structuredClone;
const vectors=n=>Array.from({length:3**n},(_,id)=>Array.from({length:n},(_,i)=>Math.floor(id/3**(n-i-1))%3));
const matrices=vectors(4).map(v=>[v.slice(0,2),v.slice(2)]),states=vectors(2);
const identity=[[1,0],[0,1]];
test('GF(3): exhaustive field tables, identities and canonical element rejection',()=>{
  const add=[[0,1,2],[1,2,0],[2,0,1]],mul=[[0,0,0],[0,1,2],[0,2,1]];
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
    assert.equal(add3(a,b),add[a][b]);assert.equal(multiply3(a,b),mul[a][b]);
    assert.equal(add3(subtract3(a,b),b),a);
    assert.equal(add3(a,b),add3(b,a));assert.equal(multiply3(a,b),multiply3(b,a));
    for(let c=0;c<3;c++){
      assert.equal(add3(add3(a,b),c),add3(a,add3(b,c)));
      assert.equal(multiply3(multiply3(a,b),c),multiply3(a,multiply3(b,c)));
      assert.equal(multiply3(a,add3(b,c)),add3(multiply3(a,b),multiply3(a,c)));
    }
  }
  for(const bad of [-1,3,1.5,NaN,Infinity,-0,'1',1n,null])
    for(const fn of [add3,subtract3,multiply3])assert.throws(()=>fn(bad,1));
});
test('independent exhaustive 2x2 reference: all matrices, inverses, products and affine states',()=>{
  const affine=[],products=[];let invertible=0;
  for(const [index,a] of matrices.entries()){
    assert.deepEqual(states.map(s=>matrixVector(a,s)),fixture.finite.matrixImages[index]);
    assert.deepEqual(states.map(s=>syndrome(a,s)),fixture.finite.matrixImages[index]);
    if(fixture.finite.inverses[index]===null)assert.throws(()=>inverseMatrix(a),/singular/);
    else{
      invertible++;assert.deepEqual(inverseMatrix(a),fixture.finite.inverses[index]);
      assert.deepEqual(matrixProduct(a,inverseMatrix(a)),identity);
      for(const offset of states){const op=affineTransform('map',a,offset),inv=invertAffine(op);
        for(const s of states){const out=applyAffine(op,s);affine.push(out);assert.deepEqual(applyAffine(inv,out),s);}
      }
    }
    for(const b of matrices)products.push(matrixProduct(a,b));
  }
  assert.equal(invertible,48);assert.equal(affine.length,3888);
  assert.equal(digest(affine),fixture.finite.affineSHA256);assert.equal(digest(products),fixture.finite.productsSHA256);
});
test('vector/matrix budgets, detached immutable values and accessor admission',()=>{
  const source=[0,1,2],state=stateVector(source);source[0]=2;
  assert.deepEqual(state,[0,1,2]);assert.ok(Object.isFrozen(state));
  for(const bad of [[],Array(3),Array(9).fill(0),[0,3],new Uint8Array(3)])assert.throws(()=>stateVector(bad));
  let invoked=0;const getter=[0,1];Object.defineProperty(getter,'0',{get(){invoked++;return 0;}});
  assert.throws(()=>stateVector(getter));assert.equal(invoked,0);
  const extra=[0,1];extra.x=2;assert.throws(()=>stateVector(extra));
  assert.throws(()=>ternaryMatrix([[1,0],[0]]));assert.throws(()=>matrixProduct([[1]],identity));
  assert.throws(()=>matrixVector(identity,[1]));assert.throws(()=>inverseMatrix([[1,0]]));
  assert.throws(()=>affineTransform('bad id',identity,[0,0]));
  assert.throws(()=>applyAffine({matrix:identity,offset:[0,0]},[0,0]));
  const big=Array.from({length:8},(_,i)=>Array.from({length:8},(_,j)=>Number(i===j)));
  assert.deepEqual(matrixVector(big,Array(8).fill(2)),Array(8).fill(2));
});
test('all 2..4-dimensional state graphs: total reversible edges and bounded histories',()=>{
  for(const n of [2,3,4]){
    const session=new Experiment(starterPack(n)),ops=session.compiled.operations,graph=transitionGraph(ops);
    assert.equal(graph.states.length,3**n);assert.equal(graph.edges.length,3**n*ops.length);
    for(const op of ops){
      assert.equal(new Set(graph.edges.filter(e=>e.operation===op.id).map(e=>e.to)).size,3**n);
      for(const state of graph.states)assert.deepEqual(applyAffine(invertAffine(op),applyAffine(op,state)),state);
    }
    assert.ok(Object.isFrozen(graph.edges[0]));
  }
  const session=new Experiment(starterPack());for(let i=0;i<32;i++)session.step('pulse-0');
  const before=session.snapshot();assert.throws(()=>session.step('pulse-0'),/budget/);assert.deepEqual(session.snapshot(),before);
  assert.throws(()=>transitionGraph([]));
});
test('generic shear and swap agree with existing single-cell GF3 lattice X lane',()=>{
  const cases=[
    [affineTransform('shear',[[1,1],[0,1]],[0,0]),{kind:'SUM',control:1,target:0,weight:1,displacement:[0,0]}],
    [affineTransform('swap',[[0,1],[1,0]],[0,0]),{kind:'SWAP',left:0,right:1}]
  ];
  for(const [op,gate] of cases)for(const state of states){
    const result=transformGF3({qudits:2,periods:[1,1],gates:[gate],state:{x:state,z:[0,0]}});
    assert.deepEqual(applyAffine(op,state),result.x);assert.deepEqual(result.z,[0,0]);
  }
});
test('typed Mod SDK adapter rejects entire invalid pack before registry mutation',()=>{
  const registry=new DataModRegistry();registerExperimentMod(registry,starterPack());registry.activate('ternary-constellation');
  assert.equal(activeExperiments(registry).length,1);
  const changes=[d=>d.dimension=9,d=>d.initial=[0,3],d=>d.extra=true,
    d=>d.transforms[0].matrix=[[0,0],[0,0]],d=>d.transforms[1].id=d.transforms[0].id,
    d=>d.transforms[0].script='alert(1)',d=>d.parity=[[1]],d=>d.maxTicks=33,
    d=>d.mapping.frequencies=[165,Infinity,330],d=>d.mapping.extra=0,
    d=>d.palette=['red','green','blue'],d=>d.spatial='quantum-gravity',d=>d.target=[0],
    d=>d.transforms=Array(9).fill(d.transforms[0])];
  for(const change of changes){const source=starterPack();source.id='invalid';change(source.entries[0].data);
    assert.throws(()=>registerExperimentMod(registry,source));assert.equal(registry.list().length,1);}
  const late=starterPack();late.id='invalid';late.entries.push({id:'late',kind:'data',data:{kind:'bad'}});
  assert.throws(()=>registerExperimentMod(registry,late));assert.equal(registry.list().length,1);
  const getter=starterPack();Object.defineProperty(getter.entries[0].data,'dimension',{get(){throw Error('must not execute');}});
  assert.throws(()=>validateExperimentMod(getter),/accessor/);
  const source=starterPack(),valid=validateExperimentMod(source);source.entries[0].data.initial[0]=2;
  assert.equal(valid.entries[0].data.initial[0],0);assert.ok(Object.isFrozen(valid.entries[0].data));
  const restored=new Experiment(JSON.parse(JSON.stringify(valid)));assert.deepEqual(restored.source,valid);
});
test('exact canonical events, reference PCM and export/reimport replay agree independently',()=>{
  const session=new Experiment(starterPack());
  for(const event of fixture.events)session.step(event.operation);
  assert.deepEqual(session.snapshot().events,fixture.events);
  const sound=referenceSound(session.snapshot().events),pcm=sound.renderAll();
  const bytes=Buffer.alloc(pcm.length*2);for(let i=0;i<pcm.length;i++)bytes.writeInt16LE(pcm[i],2*i);
  assert.equal(pcm.length,fixture.pcmFrames);assert.equal(hash(bytes),fixture.pcmSHA256);
  assert.deepEqual(sound.renderRange(10001,9123),pcm.slice(10001,19124));
  assert.equal(sound.wav().length,44+bytes.length);
  const receipt=JSON.parse(JSON.stringify(session.receipt())),again=new Experiment(receipt.source);
  for(const row of receipt.inputs)again.step(row.operation);
  assert.deepEqual(again.receipt(),session.receipt());
});
test('event admission is bounded and device/presentation independent',()=>{
  const session=new Experiment(starterPack()),mapping=session.compiled.mapping,op=session.compiled.operations[0];
  const t=transition(op,[0,0],1),event=transitionEvent(mapping,t);
  assert.equal(event.id,t.id);assert.ok(Object.isFrozen(event));
  assert.throws(()=>transitionEvent({...mapping},t));assert.throws(()=>transitionEvent(mapping,{...t,id:'forged'}));
  assert.throws(()=>transitionEvent(mapping,transition(op,[0,0],33)));
  assert.throws(()=>referenceSound([event,event]));assert.throws(()=>referenceSound([clone(event)]));
  assert.throws(()=>eventMapping({...starterPack().entries[0].data.mapping,gain:6001}));
  assert.throws(()=>eventMapping({...starterPack().entries[0].data.mapping,wave:'downloaded-code'}));
  const a=new Experiment(starterPack()),b=new Experiment(starterPack());
  for(const e of fixture.events){const s=a.step(e.operation);b.step(e.operation);
    referenceSound(s.events).renderRange((s.tick-1)*12000,12000);
    // Arbitrary presentation reads cannot consume transitions.
    JSON.stringify(s.bodies);a.snapshot();
  }
  assert.deepEqual(a.receipt(),b.receipt());
});
test('integer pause/resume discards suspended time and catch-up remains bounded',()=>{
  const session=new Experiment(starterPack()),clock=new IntegerClock({hz:4,maxFrameUs:250000,maxSteps:1});
  const update=()=>session.step('pulse-0');
  clock.advance(125000,update);clock.setPaused(true);clock.advance(1000000,update);
  clock.setPaused(false);clock.advance(125000,update);assert.equal(session.snapshot().tick,0);
  clock.advance(125000,update);assert.equal(session.snapshot().tick,1);
  const report=clock.advance(1000000,update);assert.equal(report.steps,1);assert.equal(report.clampedUs,750000);
});
test('numerical constellation agrees with independent 60-digit Decimal reference',()=>{
  for(const preset of ['gentle','swift']){
    const source=starterPack();source.entries[0].data.spatial=preset;const session=new Experiment(source);
    for(const [i,e] of fixture.events.entries()){
      const actual=session.step(e.operation).bodies,expected=fixture.spatial[preset][i];
      for(let body=0;body<2;body++)for(const key of ['position','velocity','energy']){
        const a=[actual[body][key]].flat(),b=[expected[body][key]].flat();
        a.forEach((x,j)=>assert.ok(Math.abs(x-b[j])<=fixture.tolerance.absolute+fixture.tolerance.relative*Math.abs(b[j]),`${preset} tick ${i+1} ${key}`));
      }
    }
  }
});
test('numerical failure is atomic; fixed potential energy has bounded error but switching does not conserve it',()=>{
  const source=starterPack();source.entries[0].data.transforms=[{id:'hold',matrix:identity,offset:[0,0]}];
  const s=new Experiment(source),initial=s.snapshot().bodies;
  for(let i=0;i<32;i++)s.step('hold');
  s.snapshot().bodies.forEach((b,i)=>assert.ok(Math.abs((b.energy-initial[i].energy)/initial[i].energy)<1e-7));
  const changed=new Experiment(starterPack()),e0=changed.snapshot().bodies[0].energy;
  assert.ok(Math.abs(changed.step('pulse-0').bodies[0].energy-e0)>.1,'switching potential is an energy counterexample');
  const before=changed.receipt();assert.throws(()=>changed.step('unknown'));assert.deepEqual(changed.receipt(),before);
  const orbit=new KeplerOrbit({mass:1e11,position:[4,0,0],velocity:[0,circularSpeedSI(1e11,4),0],minimumRadius:.5});
  const snapshot=orbit.snapshot();for(const dt of [NaN,Infinity,86401]){assert.throws(()=>orbit.step(dt));assert.deepEqual(orbit.snapshot(),snapshot);}
  assert.throws(()=>new KeplerOrbit({mass:1e11,position:[0,0,0],velocity:[0,0,0]}));
});
test('a numerical failure after the first particle is staged cannot partially commit a tick',()=>{
  const session=new Experiment(starterPack()),before=session.receipt(),original=KeplerOrbit.prototype.step;
  let calls=0;
  try{
    KeplerOrbit.prototype.step=function(dt){
      if(++calls===9)throw new RangeError('injected second-particle numerical failure');
      return original.call(this,dt);
    };
    assert.throws(()=>session.step('pulse-0'),/second-particle/);
    assert.equal(calls,9);assert.deepEqual(session.receipt(),before);
  }finally{KeplerOrbit.prototype.step=original;}
  assert.equal(session.step('pulse-0').tick,1);
});
