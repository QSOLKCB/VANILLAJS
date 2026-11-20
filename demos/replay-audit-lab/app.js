// SPDX-License-Identifier: Apache-2.0
// The browser/camera only renders evidence produced by authoritative modules.
import {replayExamples,BASE_BUILD} from './scenarios.js';
import {sealReplayReceipt,verifyReplayReceipt,exportReplayReceipt,importReplayReceipt,
 auditReplayPresentation,sampleReplayPresentation,REPLAY_PLAN_FORMAT} from '../../modules/replay-audit/index.js';
const $=id=>document.getElementById(id),ctx=$('field').getContext('2d');
const examples=replayExamples();
let receipt=null,verification=null,parity=null,displayAudit=null,
 renderedSamples=Object.create(null),message='Select a model and record the full tick tape.';
let generation=0,presentationJobs=0;
const current=ticket=>ticket===generation;
function invalidatePresentation(){
 generation++;parity=null;displayAudit=null;renderedSamples=Object.create(null);
}
function startPresentation(){
 invalidatePresentation();presentationJobs++;
 return {ticket:generation,rows:renderedSamples};
}
function drawCadenceSample(sample,observations,totalTicks){
 const rate=String(sample.renderHz),rows=observations[rate]??(observations[rate]=[]);
 // This is an actual Canvas2D redraw per sampled virtual display frame; the
 // private simulation has already accepted its fixed ticks before this draw.
 ctx.clearRect(0,0,1000,300);
 ctx.fillStyle='#102f3b';ctx.fillRect(0,0,1000,300);
 ctx.fillStyle='#91eed6';ctx.font='17px system-ui';
 ctx.fillText('VIRTUAL PRESENTATION '+rate+' Hz · FRAME '+sample.frame,24,34);
 ctx.fillText('AUTHORITATIVE TICKS '+sample.acceptedTicks,24,65);
 ctx.fillStyle=sample.advancedTicks===0?'#f2bd71':'#79dabc';
 ctx.fillRect(25,90,Math.max(1,940*sample.acceptedTicks/Math.max(1,totalTicks)),100);
 ctx.fillStyle='#91c2c9';
 ctx.fillText('SHA-256 '+sample.stateSha256.slice(0,24),24,240);
 rows.push({tick:sample.acceptedTicks,advance:sample.advancedTicks});
}
function observedPresentation(observations=renderedSamples){
 return Object.fromEntries(Object.entries(observations).map(([rate,rows])=>[rate,{
  frames:rows.length,lastTick:rows.at(-1)?.tick??0,
  nonAdvancingFrames:rows.filter(x=>x.advance===0).length
 }]));
}
function paint(){
 ctx.clearRect(0,0,1000,300);ctx.fillStyle='#0e2633';ctx.fillRect(0,0,1000,300);
 ctx.fillStyle='#bce8e6';ctx.font='16px system-ui';ctx.fillText('SOURCE-PINNED SIMULATION · EVENTS',22,28);
 const trace=receipt?.trace??[],n=trace.length;
 ctx.strokeStyle='#37626a';ctx.beginPath();ctx.moveTo(25,260);ctx.lineTo(975,260);ctx.stroke();
 for(let i=0;i<n;i++){
  const x=30+(i+.5)*940/n,events=trace[i].events.length,h=events?80:12;
  ctx.fillStyle=events?'#84e6a4':'#5791a8';ctx.fillRect(x-1.8,260-h,Math.max(1,Math.min(8,850/n)),h);
 }
 ctx.fillStyle='#9ce6e6';ctx.fillText('Display '+$('render-rate').value+' Hz · '+
   (receipt?.ticks??0)+' real ticks · '+(receipt?.tickRate??'integer')+' engine tick rate',22,287);
 if(displayAudit)ctx.fillText('DRAWN: '+Object.entries(observedPresentation())
  .map(([rate,result])=>rate+' Hz='+result.frames+' frames').join(' / '),22,40);
 $('status').textContent=message;
 $('receipt').textContent=receipt?JSON.stringify({build:receipt.build,kind:receipt.kind,ticks:receipt.ticks,
  mode:receipt.mode,events:receipt.trace.flatMap(x=>x.events).length,
  traceSha256:receipt.traceSha256,finalSha256:receipt.finalSha256,
  verified:verification?.match??null,parity:parity?.checks??null},null,2):'No receipt recorded.';
}
const chosen=()=>examples[$('model').value];
// A verified imported receipt is the active evidence, not the starter fixture
// associated with its model name. Record always starts a fresh selected fixture.
const activePlan=()=>receipt?{
 format:REPLAY_PLAN_FORMAT,build:receipt.build,kind:receipt.kind,
 model:receipt.model,frames:receipt.frames
}:chosen();
// Every asynchronous action captures a generation before its first await.
// Evidence changes invalidate the token; late callbacks are presentation-only
// no-ops and stale completions cannot update the accepted receipt or status.
const presentFor=(ticket,rows,ticks)=>sample=>{
 if(current(ticket))drawCadenceSample(sample,rows,ticks);
};
$('model').addEventListener('change',()=>{
 invalidatePresentation();receipt=null;verification=null;
 message='Model changed; record new evidence.';paint();
});
$('render-rate').addEventListener('change',async()=>{
 if(!receipt){
  invalidatePresentation();message='Record a model before sampling presentation cadence.';paint();return;
 }
 const {ticket,rows}=startPresentation(),plan=activePlan(),ticks=receipt.ticks;
 const rate=Number($('render-rate').value);
 message='SAMPLING '+rate+' Hz virtual presentation';paint();
 try{
  const sample=await sampleReplayPresentation(plan,rate,{present:presentFor(ticket,rows,ticks)});
  if(!current(ticket))return;
  const observed=observedPresentation(rows)[String(rate)];
  if(observed?.frames!==sample.displaySamples||observed.lastTick!==ticks)
   throw Error('actual Canvas draws and accepted tick count diverged');
  displayAudit={renderHz:rate,displaySamples:observed.frames,
   nonAdvancingFrames:observed.nonAdvancingFrames,sampleSha256:sample.sampleSha256};
  message='CADENCE EXERCISED: '+rate+' Hz / '+observed.frames+' actual Canvas draws / '+sample.consumedTicks+' fixed ticks.';
 }catch(e){if(current(ticket))message='PRESENTATION REJECTED: '+e.message;}
 finally{presentationJobs--;if(current(ticket))paint();}
});
$('record').addEventListener('click',async()=>{
 const plan=chosen();
 invalidatePresentation();const ticket=generation;
 receipt=null;verification=null;message='RECORDING authoritative tick tape.';paint();
 try{
  const recorded=await sealReplayReceipt(plan);
  if(!current(ticket))return;
  receipt=recorded;message='RECORDED: '+recorded.ticks+' authoritative '+recorded.kind+' ticks.';
 }catch(e){if(current(ticket))message='RECORD REJECTED: '+e.message;}
 finally{if(current(ticket))paint();}
});
$('verify').addEventListener('click',async()=>{
 invalidatePresentation();const ticket=generation,accepted=receipt;
 verification=null;message='VERIFYING authoritative receipt.';paint();
 try{
  if(!accepted)throw Error('record first');
  const result=await verifyReplayReceipt(accepted,{expectedBuild:BASE_BUILD});
  if(!current(ticket))return;
  verification=result;
  message=result.match?'VERIFIED: all command/event/final-state evidence reproduced.':'MISMATCH: replay evidence differs.';
 }catch(e){if(current(ticket))message='VERIFY REJECTED: '+e.message;}
 finally{if(current(ticket))paint();}
});
$('compare').addEventListener('click',async()=>{
 const {ticket,rows}=startPresentation(),plan=activePlan();
 const ticks=receipt?.ticks??plan.frames.length;
 message='COMPARING three presentation schedules.';paint();
 try{
  const result=await auditReplayPresentation(plan,[30,60,144],{present:presentFor(ticket,rows,ticks)});
  if(!current(ticket))return; // model, record or import won the generation lease
  if(result.checks.some(x=>{
   const observed=observedPresentation(rows)[String(x.renderHz)];
   return !observed||observed.frames!==x.displaySamples||
    observed.nonAdvancingFrames!==x.nonAdvancingFrames||
    observed.lastTick!==x.consumedTicks;
  }))throw Error('Canvas redraw count differs from audited cadence');
  parity=result;displayAudit={renderHz:'all',
   displaySamples:result.checks.reduce((n,x)=>n+x.displaySamples,0)};
  message='PARITY PASS: distinct 30/60/144 Hz display schedules rendered every sample without modifying physics.';
 }catch(e){if(current(ticket))message='PARITY REJECTED: '+e.message;}
 finally{presentationJobs--;if(current(ticket))paint();}
});
$('tamper').addEventListener('click',async()=>{
 invalidatePresentation();const ticket=generation,accepted=receipt;
 message='CHECKING deliberate receipt corruption.';paint();
 try{
  if(!accepted)throw Error('record first');
  const bogus=structuredClone(accepted);bogus.trace[0].stateSha256='0'.repeat(64);
  const check=await verifyReplayReceipt(bogus,{expectedBuild:BASE_BUILD});
  if(!current(ticket))return;
  message=check.match?'FAIL: tampered receipt passed':'EXPECTED REJECTION: forged evidence cannot replay.';
 }catch(e){if(current(ticket))message='NEGATIVE CONTROL ERROR: '+e.message;}
 finally{if(current(ticket))paint();}
});
$('export').addEventListener('click',()=>{
 // Export is synchronous, but its visible status must also supersede an old
 // asynchronous comparison that is still working on another turn.
 invalidatePresentation();
 try{
  if(!receipt)throw Error('record first');
  const url=URL.createObjectURL(new Blob([exportReplayReceipt(receipt)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='replay-'+receipt.kind+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);message='Exported locally executed receipt.';
 }catch(e){message='EXPORT REJECTED: '+e.message;}
 paint();
});
$('import').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';
 if(!file)return;
 invalidatePresentation();const ticket=generation;
 message='VALIDATING imported receipt independently.';paint();
 try{
  if(file.size>262144)throw RangeError('receipt exceeds byte cap');
  const checked=await importReplayReceipt(await file.text(),{expectedBuild:BASE_BUILD});
  if(!current(ticket))return;
  receipt=checked;verification={match:true};$('model').value=checked.kind;
  message='IMPORTED & VERIFIED: every event and final state reproduced.';
 }catch(e){if(current(ticket))message='IMPORT REJECTED without replacing evidence: '+e.message;}
 finally{if(current(ticket))paint();}
});
globalThis.__replayAudit=Object.freeze({snapshot:()=>({kind:receipt?.kind??null,
 ticks:receipt?.ticks??0,verified:verification?.match??null,
 parity:parity?.checks??null,presentation:{draws:observedPresentation(),
 audit:displayAudit,pendingJobs:presentationJobs,generation},
 events:receipt?.trace.flatMap(x=>x.events).length??0,message})});
paint();document.documentElement.dataset.replayAuditReady='ready';
