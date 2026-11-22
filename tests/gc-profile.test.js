// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {VISUAL_BOX_COUNTS,assertVisualCase,quantiles,allocationSummary,gcTraceSummary,namedMetrics} from '../scripts/gc-profile-core.mjs';

test('rank percentiles never invent timing data or confuse sample count',()=>{
  assert.deepEqual(quantiles([4,1,5,2,3]),{samples:5,min:1,p50:3,p95:5,p99:5,max:5,mean:3});
  assert.equal(quantiles([0]).p99,0);
  for(const bad of [[],[NaN],[Infinity],[-1],Array(100001).fill(0),'1,2'])
    assert.throws(()=>quantiles(bad),RangeError);
});
test('allocation records are statistical samples, not implied total allocations',()=>{
  const p={head:{id:1,callFrame:{functionName:'root',url:''},children:[
    {id:2,callFrame:{functionName:'boxes',url:'geometry.js'},children:[]},
    {id:3,callFrame:{functionName:'frame',url:'game.js'},children:[]}
  ]},samples:[{nodeId:3,size:33},{nodeId:2,size:64},{nodeId:2,size:12}]};
  const summary=allocationSummary(p);
  assert.equal(summary.samples,3);assert.equal(summary.sampledBytes,109);
  assert.deepEqual(summary.topSites.map(x=>[x.functionName,x.sampledBytes]),[['boxes',76],['frame',33]]);
  assert.deepEqual(allocationSummary({head:{id:1,children:[]},samples:[]}).topSites,[]);
  assert.throws(()=>allocationSummary({head:{id:1,children:[]},samples:[{nodeId:7,size:10}]}),/unknown node/);
  assert.throws(()=>allocationSummary({head:{id:1,children:[{id:1,children:[]}]},samples:[]}),/duplicate/);
  assert.throws(()=>allocationSummary({head:{id:1,children:[]},samples:[{nodeId:1,size:-1}]}),RangeError);
});
test('GC trace counts outer events without double-counting nested V8 phases',()=>{
  const s=gcTraceSummary({traceEvents:[
    {name:'MinorGC',ph:'X',ts:1200,dur:3500,tid:6},
    {name:'V8.GCScavenger',ph:'X',ts:1250,dur:1000,tid:6},
    {name:'MajorGC',ph:'X',ts:1300,dur:4000,tid:6},
    {name:'V8.GCCompactor',ph:'X',ts:1340,dur:2200,tid:6},
    {name:'MajorGC',ph:'B',ts:1400,dur:10000},
    {name:'Layout',ph:'X',ts:1700,dur:10000}
  ]});
  assert.equal(s.rawSelectedCount,4);
  assert.equal(s.observedCount,2);
  assert.equal(s.observedDurationMs,7.5);
  assert.deepEqual(s.observedEvents.map(e=>e.name),['MinorGC','MajorGC']);
  assert.equal(s.durationMs.p95,4);
  const fallback=gcTraceSummary({traceEvents:[
    {name:'V8.GCScavenger',ph:'X',ts:1,dur:800},
    {name:'V8.GCCompactor',ph:'X',ts:2,dur:600}
  ]});
  assert.equal(fallback.observedCount,2);
  assert.equal(fallback.observedDurationMs,1.4);
  const none=gcTraceSummary({traceEvents:[]});
  assert.equal(none.durationMs,null);
  assert.match(none.meaning,/does not prove/);
  assert.throws(()=>gcTraceSummary({traceEvents:[{name:'MinorGC',ph:'X',ts:1,dur:-1}]}),RangeError);
  assert.throws(()=>gcTraceSummary({traceEvents:{}}),TypeError);
});

test('CDP heap occupancy is separate from sampled allocated bytes',()=>{
  assert.deepEqual(namedMetrics([{name:'JSHeapUsedSize',value:4000},{name:'TaskDuration',value:2},{name:'Unknown',value:9}]),{JSHeapUsedSize:4000,TaskDuration:2});
  assert.throws(()=>namedMetrics([{name:'JSHeapUsedSize',value:NaN}]),RangeError);
  assert.throws(()=>namedMetrics(null),TypeError);
});
test('stress cases use explicit fixed visual budgets, not combat limits',()=>{
  assert.deepEqual([...VISUAL_BOX_COUNTS],[64,128,256,512]);
  for(const n of VISUAL_BOX_COUNTS)assert.equal(assertVisualCase(n),n);
  for(const n of [0,65,513,4096,-1,NaN,'512'])assert.throws(()=>assertVisualCase(n),RangeError);
});
