// SPDX-License-Identifier: Apache-2.0
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {jsDependencies,resolveLocal} from './browser-dependencies.mjs';
export const demoHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=resolve(import.meta.dirname,'..');
export async function demoRuntime(){
  const files=new Map(),pending=['demos/demoscene-lab/start.js'];
  while(pending.length){const path=pending.pop();if(files.has(path))continue;if(!/^(?:modules|api|demos\/demoscene-lab)\/[a-zA-Z0-9_./-]+\.js$/.test(path)||path.split('/').includes('..'))throw Error('nonlocal runtime dependency');
    const bytes=await readFile(resolve(root,path)),deps=jsDependencies(bytes.toString());if(deps.issues.length)throw Error('unresolved runtime in '+path+': '+deps.issues.join(', '));files.set(path,bytes);for(const spec of deps.imports)pending.push(resolveLocal(path,spec));
  }return files;
}
export function byteReport(files,projectBytes){
  // A defined length-prefixed UTF-8 path + byte container, including every
  // delivered runtime/data/style/licence byte; no magical runtime exclusion.
  const rows=[...files].sort(([a],[b])=>a.localeCompare(b)).map(([path,bytes])=>({path,bytes:bytes.length,sha256:demoHash(bytes)}));
  const parts=[];for(const row of rows){const name=Buffer.from(row.path),data=files.get(row.path),head=Buffer.alloc(8);head.writeUInt32LE(name.length,0);head.writeUInt32LE(data.length,4);parts.push(head,name,data);}
  const container=Buffer.concat(parts),gzip=gzipSync(container,{level:9}),brotli=brotliCompressSync(container,{params:{[constants.BROTLI_PARAM_QUALITY]:11}});
  return {kind:'qsol.vanillajs.demoscene-byte-report.v1',profile:'Full Demo',files:rows,totalUncompressedBytes:rows.reduce((n,r)=>n+r.bytes,0),containerBytes:container.length,gzip9Bytes:gzip.length,brotli11Bytes:brotli.length,compression:'Sorted paths, u32LE path-byte length + u32LE data-byte length + UTF-8 path + raw bytes per file. gzip level 9; Brotli quality 11. Measured sizes are not executable competition entries.',challenge64K:{limit:65536,submittedSelfContainedExecutable:false,claim:'not claimed; compressed container needs an unpacker and HTTP serving'},challenge4K:{limit:4096,status:'future research'},compactDescription:{bytes:Buffer.byteLength(projectBytes),profile:'inert project only; runtime excluded here and counted above'}};
}
export async function portableDemo(project){
  const files=await demoRuntime(),htmlPath='demos/demoscene-lab/index.html';
  let html=await readFile(resolve(root,htmlPath),'utf8');html=html.replace('<script type="module" src="../../offline/register.js"></script>','');
  html=html.replace('<script type="module" src="./start.js"></script>','<script type="application/json" id="generated-project">'+project.bytes.replaceAll('<','\\u003c')+'</script><script type="module" src="./start.js"></script>');
  files.set(htmlPath,Buffer.from(html));files.set('demos/demoscene-lab/style.css',await readFile(resolve(root,'demos/demoscene-lab/style.css')));
  files.set('index.html',Buffer.from('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./demos/demoscene-lab/index.html"><title>Demoscene production</title><a href="./demos/demoscene-lab/index.html">Open the production</a></html>'));
  for(const path of ['LICENSE','NOTICE'])files.set(path,await readFile(resolve(root,path)));
  files.set('project.demoscene.json',Buffer.from(project.bytes));
  const score=JSON.stringify(Array.from({length:8},(_,i)=>project.audio.score(i)));files.set('score.json',Buffer.from(score));
  const wav=project.audio.wav(),rows=[...files].map(([path,bytes])=>({path,sha256:demoHash(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));
  const receipt={kind:'qsol.vanillajs.demoscene-build-receipt.v1',seed:project.settings.seed,sourceIdentity:demoHash(JSON.stringify(rows)),files:rows,projectSha256:demoHash(project.bytes),scoreSha256:demoHash(score),pcm16leSha256:demoHash(wav.subarray(44)),wavSha256:demoHash(wav),samples:2880000,sampleRate:48000,frames:3000,assets:'Original procedural source; project provenance is authoritative. WAV generated on request, not bundled.'};
  files.set('identity.json',Buffer.from(JSON.stringify(receipt,null,2)+'\n'));
  const report=byteReport(files,project.bytes);return {files,receipt,report};
}
export async function writePortable(dir,files){for(const [path,bytes]of files){const to=resolve(dir,path);await mkdir(dirname(to),{recursive:true});await writeFile(to,bytes,{flag:'wx'});}}
