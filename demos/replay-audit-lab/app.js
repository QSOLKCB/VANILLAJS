// SPDX-License-Identifier: Apache-2.0
// The browser/camera only renders evidence produced by authoritative modules.
import {replayExamples,BASE_BUILD} from './scenarios.js';
import {sealReplayReceipt,verifyReplayReceipt,exportReplayReceipt,importReplayReceipt,
 auditReplayPresentation,sampleReplayPresentation} from '../../modules/replay-audit/index.js';
const $=id=>document.getElementById(id),ctx=$('field').getContext('2d');
const examples=replayExamples();
let receipt=null,verification=null,parity=null,displayAudit=null,
 renderedSamples=Object.create(null),message='Select a model and record the full tick tape.';
function drawCadenceSample(sample){
 const rate=String(sample.renderHz),rows=renderedSamples[rate]??(renderedSamples[rate]=[]);
 // This is an actual Canvas2D redraw per sampled virtual display frame; the
 // private simulation has already accepted its fixed ticks before this draw.
 ctx.clearRect(0,0,1000,300);
 ctx.fillStyle='#102f3b';ctx.fillRect(0,0,1000,300);
 ctx.fillStyle='#91eed6';ctx.font='17px system-ui';
 ctx.fillText('VIRTUAL PRESENTATION '+rate+' Hz · FRAME '+sample.frame,24,34);
 ctx.fillText('AUTHORITATIVE TICKS '+sample.acceptedTicks,24,65);
 ctx.fillStyle=sample.advancedTicks===0?'#f2bd71':'#79dabc';
 ctx.fillRect(25,90,Math.max(1,940*sample.acceptedTicks/Math.max(1,receipt?.ticks??1)),100);
 ctx.fillStyle='#91c2c9';
 ctx.fillText('SHA-256 '+sample.stateSha256.slice(0,24),24,240);
 rows.push({tick:sample.acceptedTicks,advance:sample.advancedTicks});
}
function observedPresentation(){
 return Object.fromEntries(Object.entries(renderedSamples).map(([rate,rows])=>[rate,{
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
$('model').addEventListener('change',()=>{receipt=null;verification=null;parity=null;
 displayAudit=null;renderedSamples=Object.create(null);
 message='Model changed; record new evidence.';paint();});
$('render-rate').addEventListener('change',async()=>{
 if(!receipt){message='Record a model before sampling presentation cadence.';paint();return;}
 const rate=Number($('render-rate').value);
 renderedSamples=Object.create(null);displayAudit=null;
 message='SAMPLING '+rate+' Hz virtual presentation';paint();
 try{
  const sample=await sampleReplayPresentation(chosen(),rate,{present:drawCadenceSample});
  const observed=observedPresentation()[String(rate)];
  if(observed?.frames!==sample.displaySamples||observed.lastTick!==receipt.ticks)
   throw Error('actual Canvas draws and accepted tick count diverged');
  displayAudit={renderHz:rate,displaySamples:observed.frames,nonAdvancingFrames:observed.nonAdvancingFrames,
   sampleSha256:sample.sampleSha256};
  message='CADENCE EXERCISED: '+rate+' Hz / '+observed.frames+' actual Canvas draws / '+sample.consumedTicks+' fixed ticks.';
 }catch(e){message='PRESENTATION REJECTED: '+e.message;}
 paint();
});
$('record').addEventListener('click',async()=>{
 try{receipt=await sealReplayReceipt(chosen());verification=null;parity=null;displayAudit=null;
  renderedSamples=Object.create(null);
  message='RECORDED: '+receipt.ticks+' authoritative '+receipt.kind+' ticks.';}
 catch(e){message='RECORD REJECTED: '+e.message;}paint();
});
$('verify').addEventListener('click',async()=>{
 try{if(!receipt)throw Error('record first');
  verification=await verifyReplayReceipt(receipt,{expectedBuild:BASE_BUILD});
  message=verification.match?'VERIFIED: all command/event/final-state evidence reproduced.':'MISMATCH: replay evidence differs.';}
 catch(e){message='VERIFY REJECTED: '+e.message;}paint();
});
$('compare').addEventListener('click',async()=>{
 try{
  renderedSamples=Object.create(null);displayAudit=null;
  parity=await auditReplayPresentation(chosen(),[30,60,144],{present:drawCadenceSample});
  if(parity.checks.some(x=>{
   const observed=observedPresentation()[String(x.renderHz)];
   return !observed||observed.frames!==x.displaySamples||
    observed.nonAdvancingFrames!==x.nonAdvancingFrames||
    observed.lastTick!==x.consumedTicks;
  }))throw Error('Canvas redraw count differs from audited cadence');
  displayAudit={renderHz:'all',displaySamples:parity.checks.reduce((n,x)=>n+x.displaySamples,0)};
  message='PARITY PASS: distinct 30/60/144 Hz display schedules rendered every sample without modifying physics.';
 }
 catch(e){message='PARITY REJECTED: '+e.message;}paint();
});
$('tamper').addEventListener('click',async()=>{
 try{if(!receipt)throw Error('record first');const bogus=structuredClone(receipt);
  bogus.trace[0].stateSha256='0'.repeat(64);
  const check=await verifyReplayReceipt(bogus,{expectedBuild:BASE_BUILD});
  message=check.match?'FAIL: tampered receipt passed':'EXPECTED REJECTION: forged evidence cannot replay.';}
 catch(e){message='NEGATIVE CONTROL ERROR: '+e.message;}paint();
});
$('export').addEventListener('click',()=>{
 try{if(!receipt)throw Error('record first');
  const url=URL.createObjectURL(new Blob([exportReplayReceipt(receipt)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='replay-'+receipt.kind+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);message='Exported locally executed receipt.';}
 catch(e){message='EXPORT REJECTED: '+e.message;}paint();
});
$('import').addEventListener('change',async event=>{
 try{const file=event.target.files?.[0];if(!file)return;
  if(file.size>262144)throw RangeError('receipt exceeds byte cap');
  const checked=await importReplayReceipt(await file.text(),{expectedBuild:BASE_BUILD});
  receipt=checked;verification={match:true};parity=null;displayAudit=null;renderedSamples=Object.create(null);$('model').value=checked.kind;
  message='IMPORTED & VERIFIED: every event and final state reproduced.';}
 catch(e){message='IMPORT REJECTED without replacing evidence: '+e.message;}
 event.target.value='';paint();
});
globalThis.__replayAudit=Object.freeze({snapshot:()=>({kind:receipt?.kind??null,
 ticks:receipt?.ticks??0,verified:verification?.match??null,
 parity:parity?.checks??null,presentation:{draws:observedPresentation(),audit:displayAudit},events:receipt?.trace.flatMap(x=>x.events).length??0,message})});
paint();document.documentElement.dataset.replayAuditReady='ready';
