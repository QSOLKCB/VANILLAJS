// SPDX-License-Identifier: Apache-2.0
// DEMOSCENE-001. Absolute integer sample time; presentation never integrates state.
export const DEMO_TIMELINE_PROFILE='qsol.vanillajs.demo-timeline.v1';
export const DEMO_RATE=48000,DEMO_SAMPLES=2880000,DEMO_FPS=50,DEMO_FRAMES=3000;
export function demoSample(n){if(!Number.isSafeInteger(n)||n<0||n>DEMO_SAMPLES)throw new RangeError('sample outside the 60 second production');return n;}
export function frameSample(frame){if(!Number.isSafeInteger(frame)||frame<0||frame>=DEMO_FRAMES)throw new RangeError('frame must be 0..2999');return frame*960;}
export function sampleFrame(sample){return Math.min(DEMO_FRAMES-1,Math.floor(demoSample(sample)/960));}
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function sampleTimeline(sample){
  demoSample(sample);const act=Math.min(4,Math.floor(sample/576000)),local=sample-act*576000;
  return {sample,frame:sampleFrame(sample),act,local,progress:local/576000,seconds:sample/DEMO_RATE,ended:sample===DEMO_SAMPLES};
}
/** Sorted, validated keys supplied by mod-demo. Linear interpolation is absolute. */
export function sampleKeys(keys,sample){
  demoSample(sample);let i=0;while(i+1<keys.length&&keys[i+1].sample<=sample)i++;
  const a=keys[i],b=keys[Math.min(i+1,keys.length-1)],t=b.sample===a.sample?0:Math.max(0,Math.min(1,(sample-a.sample)/(b.sample-a.sample)));
  const out={};for(const k of Object.keys(a)){if(k==='sample')continue;out[k]=Array.isArray(a[k])?a[k].map((v,j)=>v+(b[k][j]-v)*t):a[k]+(b[k]-a[k])*t;}return out;
}
/** Envelopes are derived from actual score events, not an unrelated animation beat. */
export function sampleCues(events,sample,channel=3){
  demoSample(sample);let strength=0,last=-1;
  for(const e of events){if(e.sample>sample)break;if(e.channel===channel&&sample<e.sample+e.duration){strength=Math.max(strength,(1-(sample-e.sample)/e.duration)*e.gain/12000);last=e.sample;}}
  return {strength,last};
}
