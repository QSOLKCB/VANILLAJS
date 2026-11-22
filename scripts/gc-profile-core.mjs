// SPDX-License-Identifier: Apache-2.0
// GC-PROFILE-001: observation processing only. No timing, browser or engine side effects.
export const VISUAL_BOX_COUNTS=Object.freeze([64,128,256,512]);
export const GC_TRACE_EVENT_NAMES=Object.freeze([
  'MinorGC','MajorGC','BlinkGC','V8.GCScavenger','V8.GCMarkCompact',
  'V8.GCMarkSweepCompact','V8.GCCompactor','V8.GCIncrementalMarking'
]);
const selected=new Set(GC_TRACE_EVENT_NAMES);
const finite=(n,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0)
  throw new RangeError(label+' must be nonnegative finite');return n;};

export function quantiles(values){
  if(!Array.isArray(values)||!values.length||values.length>100000)throw new RangeError('bounded nonempty observations required');
  values.forEach(n=>finite(n,'observation'));
  const sorted=[...values].sort((a,b)=>a-b);
  const at=p=>sorted[Math.ceil(p*sorted.length)-1];
  return {samples:values.length,min:sorted[0],p50:at(.5),p95:at(.95),
    p99:at(.99),max:sorted.at(-1),mean:values.reduce((a,b)=>a+b,0)/values.length};
}

/** Values are V8 statistical sampling *observations*, not total allocated bytes. */
export function allocationSummary(profile){
  if(!profile||!Array.isArray(profile.samples)||!profile.head)
    throw new TypeError('CDP allocation sampling profile required');
  const sites=new Map(),nodes=new Map(),pending=[profile.head],seen=new Set();
  while(pending.length){
    const node=pending.pop();
    if(!node||!Number.isSafeInteger(node.id)||seen.has(node.id))
      throw new TypeError('invalid or duplicate allocation profile node');
    seen.add(node.id);
    const call=node.callFrame??{};
    nodes.set(node.id,{functionName:call.functionName??'',url:call.url??''});
    if(!Array.isArray(node.children))throw new TypeError('allocation profile child list required');
    pending.push(...node.children);
    if(seen.size>100000)throw new RangeError('allocation profile exceeds node budget');
  }
  let bytes=0;
  for(const item of profile.samples){
    if(!Number.isSafeInteger(item.nodeId)||!nodes.has(item.nodeId))
      throw new TypeError('sample refers to unknown node');
    const size=finite(item.size,'sample size');bytes+=size;
    const site=nodes.get(item.nodeId),key=item.nodeId;
    const previous=sites.get(key)??{nodeId:key,...site,sampledBytes:0,samples:0};
    previous.sampledBytes+=size;previous.samples++;sites.set(key,previous);
  }
  return {samples:profile.samples.length,sampledBytes:bytes, // Not full allocated bytes.
    topSites:[...sites.values()].sort((a,b)=>b.sampledBytes-a.sampledBytes||a.nodeId-b.nodeId).slice(0,15)};
}

/** Accept only complete top-level Chrome tracing duration events; missing events != no GC. */
export function gcTraceSummary(trace){
  if(!trace||!Array.isArray(trace.traceEvents))throw new TypeError('traceEvents array required');
  if(trace.traceEvents.length>500000)throw new RangeError('trace too large');
  const events=[];
  for(const e of trace.traceEvents){
    if(!selected.has(e?.name)||e.ph!=='X')continue;
    const micros=finite(e.dur,'GC event duration');
    const start=finite(e.ts,'GC timestamp');
    events.push({name:e.name,tsUs:start,durationMs:micros/1000,tid:e.tid??null});
    if(events.length>20000)throw new RangeError('GC trace event budget exceeded');
  }
  return {recognizedEventNames:[...GC_TRACE_EVENT_NAMES],observedEvents:events,
    observedCount:events.length,
    observedDurationMs:events.reduce((total,e)=>total+e.durationMs,0),
    durationMs:events.length?quantiles(events.map(e=>e.durationMs)):null,
    meaning:'Only selected complete CDP duration events. Nested/overlapping events may double-count; an empty list does not prove that no GC occurred.'};
}
export function namedMetrics(rows){
  if(!Array.isArray(rows))throw new TypeError('CDP metrics array required');
  const names=['JSHeapUsedSize','JSHeapTotalSize','Nodes','JSEventListeners','TaskDuration','ScriptDuration'];
  const out={};
  for(const row of rows)if(names.includes(row?.name)){
    out[row.name]=finite(row.value,'CDP metric');
  }
  return out;
}
export function assertVisualCase(count){
  if(!VISUAL_BOX_COUNTS.includes(count))throw new RangeError('visual workload must be 64, 128, 256 or 512 boxes');
  return count;
}
