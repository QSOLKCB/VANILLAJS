// SPDX-License-Identifier: Apache-2.0
// Paired Node CPU measurements; no browser/GPU or universal speed claim.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile,readFile,mkdtemp,mkdir,cp,symlink,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {cpus,tmpdir} from 'node:os';
import {createScene,sceneWorld} from '../demos/editor/model.js';
import {validateAssetLibrary} from '../demos/editor/asset-foundry.js';
import * as candidate from '../demos/editor/viewport.js';

const baselineRef=process.argv[2]??'f91c14628e5700ed4eb69c28cd301a712f3ad967';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const candidateViewportSha256=sha256(await readFile(new URL('../demos/editor/viewport.js',import.meta.url))),
  benchmarkSha256=sha256(await readFile(new URL(import.meta.url)));
const baselineSha=execFileSync('git',['rev-parse','--verify',baselineRef+'^{commit}'],
  {cwd:root,encoding:'utf8'}).trim();
// Keep baseline artifacts outside demos/ so a concurrent package build can
// never ship benchmarking source. Only the viewport implementation differs.
const scratch=await mkdtemp(join(tmpdir(),'vanillajs-viewport-benchmark-')),
  baselineFile=join(scratch,'demos/editor/viewport.js');
try{
  await mkdir(join(scratch,'demos'),{recursive:true});
  await cp(join(root,'demos/editor'),join(scratch,'demos/editor'),{recursive:true});
  await symlink(join(root,'modules'),join(scratch,'modules'),'dir');
  await writeFile(join(scratch,'package.json'),'{"type":"module"}\n');
  await writeFile(baselineFile,execFileSync('git',['show',baselineSha+':demos/editor/viewport.js'],{cwd:root}));
  const baseline=await import(baselineFile);
  const template=sceneWorld(createScene())[3];
  const world=Array.from({length:128},(_,i)=>({...template,id:'entity-'+(i+1),
    position:[i%16,Math.floor(i/16),-i/16],rotationY:i*13}));
  const rgba=Buffer.alloc(64*64*4,255);
  for(let i=0;i<rgba.length;i+=4){rgba[i]=i%251;rgba[i+1]=(i*3)%251;}
  const library=validateAssetLibrary({schemaVersion:1,nextId:4,assets:[
    {id:'asset-1',kind:'mesh',name:'Triangle',license:'OWNER-LOCAL-ONLY',
      sourceName:'triangle.obj',sourceSha256:'a'.repeat(64),
      vertices:[-1,0,-1,0,0,1,0,-1,1,0,0,1,1,.5,1]},
    {id:'asset-2',kind:'texture',name:'Texture',license:'OWNER-LOCAL-ONLY',
      sourceName:'texture.png',sourceSha256:'b'.repeat(64),width:64,height:64,
      rgba:rgba.toString('base64')},
    {id:'asset-3',kind:'material',name:'Material',license:'OWNER-LOCAL-ONLY',
      color:[.3,.7,.9],textureId:'asset-2'}],
    placements:world.map(e=>({entityId:e.id,meshId:'asset-1',materialId:'asset-3'}))});
  const cases=[['four-boxes',sceneWorld(createScene()),null],
    ['one-textured-mesh',world.slice(0,1),{...library,placements:library.placements.slice(0,1)}],
    ['128-shared-textured-meshes',world,library]];
  const results=[];
  for(const [name,entities,assets] of cases){
    for(const operation of ['createSceneVertices','sceneResourceBudget']){
      const call=module=>operation==='createSceneVertices'?
        module[operation](entities,'entity-2',assets):module[operation](entities,assets);
      const expected=call(baseline),actual=call(candidate);
      // Compare the exact packed bytes, not an approximate rendered appearance.
      if(expected instanceof Float32Array)assert.deepEqual(
        new Uint8Array(actual.buffer),new Uint8Array(expected.buffer),name);
      else assert.deepEqual(actual,expected,name);
      const decodeCount=module=>{
        const original=globalThis.atob;let count=0;
        globalThis.atob=(...args)=>{count++;return original(...args);};
        try{call(module);return count;}finally{globalThis.atob=original;}
      };
      const decodes={baseline:decodeCount(baseline),candidate:decodeCount(candidate)};
      for(let i=0;i<4;i++){call(baseline);call(candidate);}
      const samples={baseline:[],candidate:[]},iterations=5;
      for(let pair=0;pair<9;pair++){
        for(const label of pair%2?['candidate','baseline']:['baseline','candidate']){
          const module=label==='baseline'?baseline:candidate,start=performance.now();
          for(let i=0;i<iterations;i++)call(module);
          samples[label].push((performance.now()-start)/iterations);
        }
      }
      const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
      const baselineMs=median(samples.baseline),candidateMs=median(samples.candidate);
      results.push({name,operation,parity:'PASS',textureBase64Decodes:decodes,
        baselineMedianMs:baselineMs,candidateMedianMs:candidateMs,
        candidateOverBaseline:candidateMs/baselineMs,samplesMs:samples});
    }
  }
  console.log(JSON.stringify({baselineSha,candidateViewportSha256,benchmarkSha256,
    node:process.version,platform:process.platform,
    architecture:process.arch,cpu:cpus()[0]?.model,
    method:'4 warmups, 9 alternating-order pairs, 5 calls/sample; medians in ms/call',
    scope:'Node CPU only; no GPU, frame-time, physical-device or cross-browser claim',results},null,2));
}finally{await rm(scratch,{recursive:true,force:true});}
