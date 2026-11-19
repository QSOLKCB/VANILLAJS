// SPDX-License-Identifier: Apache-2.0
import {DEMO_RATE as RATE} from '../../modules/demo-timeline/index.js';
export {RATE};
export const FRAMES = RATE * 90;
const increment = Array.from({length:128}, (_, key) =>
  Math.round(65536 * 440 * 2 ** ((key - 69) / 12) / RATE));
export function validateScore(score, limit=FRAMES) {
  if (!score || Object.keys(score).sort().join() !== 'format,frames,notes,source' ||
      score.format !== 'dreamline.score.v1' || typeof score.source!=='string' || !/^(?:[a-f0-9]{64}|original-test-fixture)$/.test(score.source) ||
      !Number.isSafeInteger(score.frames) || score.frames < 1 || score.frames > limit ||
      !Array.isArray(score.notes) || score.notes.length > 32000) throw TypeError('Invalid score');
  let previous=-1, work=0;
  for (const row of score.notes) {
    if (!Array.isArray(row) || row.length!==4 || !row.every(Number.isSafeInteger)) throw TypeError('Invalid note');
    const [a,b,ch,key]=row;
    if (a<previous || a<0 || b<=a || b>score.frames || ch<0 || ch>3 || key<0 || key>127)
      throw RangeError('Note outside score');
    previous=a;
    work+=b-a;
  }
  if (work>score.frames*12) throw RangeError('Polyphony budget exceeded');
  return score;
}
// Independently composed line-check music. The recovered composition is loaded separately.
export function fixture() {
  const notes=[];
  for (let i=0;i<352;i++) {
    const a=i*12000, key=[43,50,53,57,55,50,46,48][Math.floor(i/4)%8];
    notes.push([a,a+9000,2,key+12+(i%4)*3],[a,a+4200,3,i%4===0?36:42]);
    if(i%4===0) notes.push([a,a+46000,1,key-12]);
  }
  return {format:'dreamline.score.v1',source:'original-test-fixture',frames:FRAMES,notes};
}
export function synthesize(value,limit=FRAMES) {
  const score=validateScore(value,limit), mix=new Int32Array(score.frames*2);
  for(const [a,b,ch,key] of score.notes) {
    const step=increment[key], length=b-a, pan=[190,128,67,148][ch];
    let phase=0, noise=key+1;
    for(let i=0;i<length;i++) {
      phase=(phase+(ch===3 && key===36 ? 52+Math.max(0,220-(i>>4)) : step))&65535;
      noise=(Math.imul(noise,1664525)+1013904223)>>>0;
      const tri=16384-Math.abs(32768-phase);
      let signal=ch===0 ? tri+(phase<16384?3000:-1000) : ch===1 ? tri : ch===2 ? (phase<18000?9000:-3500) : key===36 ? tri : (noise>>>17)-16384;
      const attack=Math.min(256,i*(ch===3?9:1)), release=Math.min(256,Math.floor((length-1-i)*256/Math.min(length,2400)));
      const envelope=ch>=2 ? Math.floor(256*(length-i)/length) : 256;
      signal=Math.trunc(signal*attack*release*envelope/(256**3*2));
      const j=2*(a+i);
      mix[j]+=signal*pan>>8;mix[j+1]+=signal*(256-pan)>>8;
    }
  }
  return Int16Array.from(mix,n=>Math.max(-32768,Math.min(32767,n)));
}
export function cueAt(notes,sample) {
  let lo=0,hi=notes.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(notes[mid][0]<=sample)lo=mid+1;else hi=mid;}
  return lo ? Math.max(0,1-(sample-notes[lo-1][0])/7500) : 0;
}
