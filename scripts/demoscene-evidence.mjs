// SPDX-License-Identifier: Apache-2.0
// Repeatable full-minute CPU witness. Browser/GPU execution is recorded separately.
import {createHash} from 'node:crypto';
import {machineRemembers} from '../demos/demoscene-lab/preset.js';
import {DemoWorld} from '../demos/demoscene-lab/world.js';
import {portableDemo,demoHash} from './demoscene-package.mjs';
const project=machineRemembers(),world=new DemoWorld(project),rolling=createHash('sha256').update('DEMOSCENE-001/full-3000-command-frames/v1\0'),max={triangles:0,lines:0,points:0},cuts=[];
for(let frame=0;frame<3000;frame++){
  const sample=frame*960,result=world.geometry(sample);rolling.update(frame+':'+JSON.stringify(result.commands)+'\n');
  for(const kind of Object.keys(max))max[kind]=Math.max(max[kind],result.geometry.counts[kind]/6);
  if([200,900,1500,2100,2750].includes(frame))cuts.push({frame,sample,commandSha256:demoHash(JSON.stringify(result.commands))});
}
const pcm=project.audio.renderRange(0,2880000);let min=32767,peak=-32768,nonzero=0;for(const n of pcm){min=Math.min(min,n);peak=Math.max(peak,n);if(n)nonzero++;}
const {receipt,report}=await portableDemo(project);
console.log(JSON.stringify({kind:'qsol.vanillajs.demoscene-execution.v1',runtime:{node:process.version,platform:process.platform,arch:process.arch},source:receipt,fullTimeline:{frames:3000,firstSample:0,lastFrameSample:2879040,terminalSample:2880000,commandProfile:'same-source / same-JavaScript-runtime Float64 commands',commandStreamSha256:rolling.digest('hex'),maxVertices:max,cuts,terminalGeometry:world.geometry(2880000).geometry.counts},audio:{samples:pcm.length,min,max:peak,nonzero,lastSample:pcm.at(-1),phraseSha256:Array.from({length:8},(_,i)=>{const pcm=project.audio.renderPhrase(i),bytes=Buffer.alloc(pcm.length*2);pcm.forEach((n,j)=>bytes.writeInt16LE(n,j*2));return demoHash(bytes);})},byteBudget:report},null,2));
