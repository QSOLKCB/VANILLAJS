// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {machineRemembers} from '../demos/demoscene-lab/preset.js';
import {DemoWorld} from '../demos/demoscene-lab/world.js';
import {validateDemo,DemoProjectSlot} from '../modules/mod-demo/index.js';
import {sampleTimeline,frameSample,sampleFrame,sampleKeys,sampleCues} from '../modules/demo-timeline/index.js';
import {effectInstances,DemoGeometry,textVoxels} from '../modules/demo-scene/index.js';
import {SampleAudioTransport} from '../api/demoscene/transport.js';
import {createForgeScene,updateEntity} from '../demos/editor/model.js';
import {createAssetLibrary,addMeshAsset,setPlacement,addPrefabAsset,instantiatePrefab} from '../demos/editor/asset-foundry.js';
import {addSelectedDemo,demoDraft,commitDemo,travelDemo,captureDemoKey,editDemoData} from '../demos/editor/demoscene-workflow.js';
const hash=b=>createHash('sha256').update(b).digest('hex'),project=machineRemembers(),raw=()=>JSON.parse(project.bytes),entry=(r,id)=>r.manifest.entries.find(e=>e.id===id).data;
test('exact 60 second timeline, 3000 frames and all act boundaries',()=>{
  for(let f=0;f<3000;f++){assert.equal(frameSample(f),f*960);assert.equal(sampleFrame(frameSample(f)),f);}
  for(let act=0;act<5;act++){assert.equal(sampleTimeline(act*576000).act,act);assert.equal(sampleTimeline((act+1)*576000-1).act,act);}
  assert.equal(sampleTimeline(2880000).ended,true);assert.equal(sampleTimeline(2880000).act,4);
  for(const n of [-1,NaN,Infinity,1.5,2880001])assert.throws(()=>sampleTimeline(n));assert.throws(()=>frameSample(3000));
});
test('absolute key interpolation, score cue ordering and cue channel',()=>{
  assert.deepEqual(sampleKeys([{sample:0,position:[0,0,0]},{sample:48000,position:[2,4,6]}],24000),{position:[1,2,3]});
  assert.ok(project.cues.every((e,i,a)=>i===0||e.sample>=a[i-1].sample));const e=project.cues.find(e=>e.channel===3);
  assert.equal(sampleCues(project.cues,e.sample,3).last,e.sample);assert.equal(sampleCues(project.cues,2880000,3).strength,0);
});
test('full-minute PCM is exact across irregular chunk partitions and WAV boundaries',()=>{
  const a=project.audio,wav=a.wav(),v=new DataView(wav.buffer);assert.equal(a.frames,2880000);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint16(34,true),16);assert.equal(v.getUint32(40,true),5760000);assert.equal(wav.length,5760044);
  const chunks=createHash('sha256');let offset=0,part=0,min=32767,max=-32768,nonzero=0;const sizes=[8191,48000,360001,127,960];
  while(offset<a.frames){const count=Math.min(sizes[part++%sizes.length],a.frames-offset),pcm=a.renderRange(offset,count),bytes=Buffer.alloc(count*2);pcm.forEach((x,i)=>{bytes.writeInt16LE(x,i*2);min=Math.min(min,x);max=Math.max(max,x);if(x)nonzero++;});chunks.update(bytes);offset+=count;}
  assert.equal(chunks.digest('hex'),hash(wav.subarray(44)));assert.ok(nonzero>1000000);assert.ok(min>-32768&&max<32767,'no saturated samples in the authored score');assert.equal(v.getInt16(wav.length-2,true),0);
  assert.equal(new Set(Array.from({length:8},(_,i)=>hash(a.renderPhrase(i)))).size,8,'eight distinct musical phrases');
  for(const at of [359999,360000,575999,576000,1152000,1728000,2304000,2879999]){const pcm=a.renderRange(at,1);assert.equal(pcm[0],v.getInt16(44+at*2,true));}
});
test('schema roundtrip, immutable snapshots, identity and atomic registry activation',()=>{
  const source=raw(),p=validateDemo(source);source.manifest.entries[0].data.seed=9;assert.equal(p.settings.seed,1983);assert.equal(validateDemo(p.bytes).bytes,p.bytes);assert.equal(Object.isFrozen(p.settings.palette[0]),true);
  const slot=new DemoProjectSlot(p);const before=slot.project,bad=raw();entry(bad,'settings').seed=-1;assert.throws(()=>slot.replace(bad));assert.equal(slot.project,before);assert.equal(slot.list()[0].active,true);
});
test('reject hostile/unknown/project budgets before activation',()=>{
  const variants=[r=>r.kind='qsol.vanillajs.demoscene.v2',r=>r.extra=1,r=>r.manifest.version='2.0.0',r=>entry(r,'settings').script='alert(1)',r=>entry(r,'settings').seed=NaN,r=>entry(r,'settings').sampleRate=44100,r=>entry(r,'settings').palette[0][0]=Infinity,r=>entry(r,'timeline').camera[1].sample=0,r=>entry(r,'timeline').camera[0].sample=1,r=>entry(r,'timeline').scenes[0].end--,r=>entry(r,'phrase-0').gates[0]=11251,r=>entry(r,'phrase-0').notes[0][0]=8001,r=>r.manifest.entries.push({...r.manifest.entries[0]}),r=>r.manifest.entries.push({id:'unknown',kind:'data',data:{}}),r=>entry(r,'settings').text.title='<script>',r=>entry(r,'settings').provenance.license='UNKNOWN'];
  for(const change of variants){const r=raw();change(r);assert.throws(()=>validateDemo(r));}
  const getter=raw();let called=false;Object.defineProperty(entry(getter,'settings'),'seed',{get(){called=true;return 1983;}});assert.throws(()=>validateDemo(getter));assert.equal(called,false);
  const proto=raw();Object.defineProperty(entry(proto,'settings'),'__proto__',{value:{polluted:true},enumerable:true});assert.throws(()=>validateDemo(proto));
  const array=raw();Object.defineProperty(entry(array,'settings').palette,'0',{get(){throw Error('must not execute');}});assert.throws(()=>validateDemo(array),/data-only/);
  const oversized=raw();entry(oversized,'settings').provenance.source='x'.repeat(40000);assert.throws(()=>validateDemo(oversized));
});
test('seeded worlds, out-of-order sampling and retained/fresh geometry parity',()=>{
  const world=new DemoWorld(project),sequence=[0,192000,864000,1440000,2016000,2640000,2880000,2016000];
  const hashes=[];for(const sample of sequence){const result=world.geometry(sample),fresh=new DemoWorld(project).geometry(sample,'standard',{forceFresh:true});assert.deepEqual(result.commands,fresh.commands);for(const key of ['triangles','lines','points'])assert.deepEqual(result.geometry.view(key),fresh.geometry.view(key));hashes.push(hash(JSON.stringify(result.commands)));assert.equal(world.geometry(sample),result);}
  assert.equal(hashes.at(-1),hashes[4]);assert.equal(new Set(hashes.slice(0,-1)).size,7);
  assert.notDeepEqual(new DemoWorld(machineRemembers(1984)).commands(864000),world.commands(864000));
  assert.deepEqual(world.geometry(2016000,'low').commands,world.geometry(2016000,'standard').commands);assert.ok(world.geometry(2016000,'low').geometry.counts.points<world.geometry(2016000,'standard').geometry.counts.points);
  assert.deepEqual(world.geometry(2880000).geometry.counts,{triangles:0,lines:0,points:0});
});
test('effects and glyph geometry are bounded, original and deterministic',()=>{
  for(const effect of ['rotate','lattice','radial','tunnel','extrude','dissolve']){const a=effectInstances(effect,400000,{copies:48});assert.equal(a.length,48);assert.deepEqual(a,effectInstances(effect,400000,{copies:48}));}
  assert.throws(()=>effectInstances('unknown',0));assert.throws(()=>effectInstances('rotate',0,{copies:49}));assert.ok(textVoxels('VANILLAJS').length>100);assert.throws(()=>textVoxels('<script>'));
  const g=new DemoGeometry();assert.throws(()=>{for(let i=0;i<2800;i++)g.box([0,0,0],[1,1,1],[1,1,1]);},/budget/);
});
test('Workbench primitive, imported mesh and prefab bridge preserve provenance and FX history',()=>{
  const scene=createForgeScene();let library=createAssetLibrary();const mesh=addMeshAsset(library,{name:'Original triangle',license:'CC-BY-4.0',sourceName:'mine.obj',sourceSha256:'a'.repeat(64),text:'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'});library=setPlacement(scene,mesh.library,'entity-3',mesh.id);
  const p=addSelectedDemo(project,scene,library,'entity-3',{effect:'radial',copies:8});assert.equal(p.meshes.length,1);assert.equal(p.meshes[0].provenance.license,'CC-BY-4.0');assert.equal(p.meshes[0].provenance.sha256,'a'.repeat(64));assert.equal(p.nodes[0].effect,'radial');
  const moved=updateEntity(scene,'entity-3',{position:[1,4,-2],rotationY:45,scale:[2,3,2]});const keyed=captureDemoKey(p,p.nodes[0].id,moved,'entity-3',48000);assert.deepEqual(keyed.nodes[0].keys[1].position,[1,4,-2]);
  const history=commitDemo(demoDraft(p),keyed);assert.equal(travelDemo(history,'undo').present.bytes,p.bytes);assert.equal(travelDemo(travelDemo(history,'undo'),'redo').present.bytes,keyed.bytes);assert.equal(validateDemo(keyed.bytes).bytes,keyed.bytes);
  const prefab=addPrefabAsset(scene,library,'entity-3','Original prefab','OWNER-LOCAL-ONLY'),instance=instantiatePrefab(scene,prefab.library,prefab.id),captured=addSelectedDemo(project,instance.scene,instance.library,instance.selected);assert.equal(captured.meshes[0].provenance.source,'mine.obj');
  const bad=JSON.parse(p.bytes);entry(bad,p.nodes[0].id).meshes=['mesh-missing'];assert.throws(()=>validateDemo(bad));assert.throws(()=>editDemoData(p,'settings',s=>s.seed=-1));
});
function contextMock(){const nodes=[],ctx={currentTime:0,destination:{},resume:async()=>{},close:async()=>{},createGain:()=>({connect(){},gain:{value:1}}),createBuffer:()=>({getChannelData:()=>new Float32Array(2880000)}),createBufferSource(){const node={connect(){},disconnect(){this.disconnected=true;},start(...args){this.args=args;},stop(){this.stopped=true;},onended:null};nodes.push(node);return node;}};return {ctx,nodes};}
test('audio pause/seek/restart/mute and pending resume cancellation own every node',async()=>{
  const {ctx,nodes}=contextMock(),transport=new SampleAudioTransport(project.audio,{contextFactory:()=>ctx});await transport.play();ctx.currentTime=1.5;assert.equal(transport.sample,72000);transport.pause();assert.ok(nodes[0].stopped&&nodes[0].disconnected);ctx.currentTime=9;assert.equal(transport.sample,72000);
  await transport.seek(576000);await transport.play();assert.equal(nodes.at(-1).args[1],12);await transport.seek(1152000);assert.equal(nodes.at(-1).args[1],24);transport.mute(true);assert.equal(transport.gain.gain.value,0);await transport.restart();assert.equal(nodes.at(-1).args[1],0);
  const before=transport.sample;assert.throws(()=>transport.seek(-1));assert.equal(transport.sample,before);await transport.dispose();assert.ok(nodes.every(n=>n.stopped));
  let resume;ctx.resume=()=>new Promise(r=>resume=r);const pending=new SampleAudioTransport(project.audio,{contextFactory:()=>ctx}),promise=pending.play();pending.pause();resume();await promise;assert.equal(pending.playing,false);assert.equal(pending.starts,0);
  const failed=contextMock();const make=failed.ctx.createBufferSource;failed.ctx.createBufferSource=()=>{const node=make.call(failed.ctx);node.start=()=>{throw Error('device start failed');};return node;};const retry=new SampleAudioTransport(project.audio,{contextFactory:()=>failed.ctx});await assert.rejects(retry.play(),/device start/);assert.equal(retry.playing,false);assert.equal(retry.source,null);failed.ctx.createBufferSource=make;await retry.play();assert.equal(retry.starts,1);await retry.dispose();
});
test('portable generator produces repeatable complete runtime, receipts and no overwrite',async()=>{
  const root=await mkdtemp(join(tmpdir(),'demoscene-test-'));try{
    for(const name of ['a','b']){const result=spawnSync(process.execPath,['scripts/demoscene-world.mjs','--preset','machine-remembers','--seed','1983','--out',join(root,name)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
    const a=join(root,'a','production'),b=join(root,'b','production');assert.equal(await readFile(join(a,'identity.json'),'utf8'),await readFile(join(b,'identity.json'),'utf8'));
    const report=JSON.parse(await readFile(join(a,'byte-report.json'),'utf8'));assert.ok(report.files.some(f=>f.path==='modules/render-webgl/index.js'));assert.ok(report.totalUncompressedBytes>65536);assert.equal(report.challenge64K.submittedSelfContainedExecutable,false);assert.equal(report.compactDescription.bytes,Buffer.byteLength(project.bytes));
    const receipt=JSON.parse(await readFile(join(a,'identity.json'),'utf8'));for(const f of receipt.files)assert.equal(hash(await readFile(join(a,f.path))),f.sha256);
    await mkdir(join(root,'existing'));const result=spawnSync(process.execPath,['scripts/demoscene-world.mjs','--preset','machine-remembers','--seed','1983','--out',join(root,'existing')],{encoding:'utf8'});assert.notEqual(result.status,0);assert.deepEqual(await readdir(join(root,'existing')),[]);assert.ok(!(await readdir(root)).some(n=>n.startsWith('.demoscene-stage-')));
  }finally{await rm(root,{recursive:true,force:true});}
});
