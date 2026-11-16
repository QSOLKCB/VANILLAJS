// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {hash,gitBlob} from '../scripts/browser-dependencies.mjs';
import {packageEditorRuntime,packageLabRuntime} from '../scripts/pursuit-package.mjs';
import {packageProvenance,packageSourceBound,provenanceHTMLRecords} from '../scripts/browser-package-provenance.mjs';
import {sourceBoundToTree} from '../scripts/browser-receipt-authority.mjs';
const labs=['pursuit-lab','skyguard-lab','arcade-combat-lab','block-arena-lab','demoscene-lab','sprite-foundry','weapon-feel-lab','narrative-foundry','game-maker-lab','horizon-lab'];
const row=(path,bytes)=>({path,sha256:hash(bytes),gitBlob:gitBlob(bytes)});
async function inventory(root,path=''){
  const out=[];
  for(const e of await readdir(join(root,path),{withFileTypes:true})){
    const p=path?path+'/'+e.name:e.name;
    if(e.isDirectory())out.push(...await inventory(root,p));else out.push(p);
  }
  return out.sort();
}
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'browser-provenance-test-'));
  const put=async(path,content)=>{await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),content);};
  await put('api/webgl/index.js','export const gl = 1;\n');
  await put('modules/core/index.js','export const value = 1;\n');
  await put('demos/editor/index.html','<link href="./style.css"><script type="module" src="./start.js"></script>\n');
  await put('demos/editor/start.js','import "../../modules/core/index.js";\n');
  await put('demos/editor/style.css','body { color: white; }\n');
  await put('demos/gpu-lab/controls.js','export const controls = true;\n');
  await put('demos/4x-game-lab/voidward/js/start.js','export const game = true;\n');
  await put('demos/4x-game-lab/voidward/mods/frontier/rules.txt','data only\n');
  for(const lab of labs){
    const start=['pursuit-lab','skyguard-lab'].includes(lab)?'js/start.js':'start.js';
    await put('demos/'+lab+'/index.html','<script type="module" src="./'+start+'"></script>\n');
    await put('demos/'+lab+'/'+start,'import "'+(start.startsWith('js/')?'../../../':'../../')+'modules/core/index.js";\n');
  }
  for(const path of ['scripts/build.js','scripts/pursuit-package.mjs','scripts/browser-dependencies.mjs','scripts/browser-package-provenance.mjs','scripts/game-maker-runtime.mjs'])
    await put(path,await readFile(new URL('../'+path,import.meta.url)));
  const sourceRows=await Promise.all((await inventory(root)).map(async path=>row(path,await readFile(join(root,path)))));
  await mkdir(join(root,'dist'));
  for(const path of ['api','modules','demos'])await cp(join(root,path),join(root,'dist',path),{recursive:true});
  await packageEditorRuntime(join(root,'dist'));
  for(const lab of labs)await packageLabRuntime(join(root,'dist'),lab);
  const paths=await inventory(join(root,'dist'));
  const runtime=await Promise.all(paths.map(async path=>row(path,await readFile(join(root,'dist',path)))));
  const files=await Promise.all(paths.map(async path=>{const b=await readFile(join(root,'dist',path));return {path,bytes:b.length,sha256:hash(b)};}));
  const {metadata,sources}=await packageProvenance({root,files});
  const inputs={runtime,shared:sources,tests:[],requirements:[],packageProvenance:metadata};
  const tree={truncated:false,tree:sourceRows.map(f=>({path:f.path,type:'blob',mode:'100644',sha:f.gitBlob}))};
  const htmlSources=new Map(await Promise.all(metadata.packages.map(async p=>[p.html.path,await readFile(join(root,p.html.path))])));
  return {root,files,inputs,tree,htmlSources,receipt:{results:{editor:{inputs}}}};
}

test('known runtime copies and eleven exact entry rewrites bind to original Git source',async()=>{
  const f=await fixture();
  try{
    assert.equal(sourceBoundToTree(f.receipt,f.tree,f.htmlSources),true);
    assert.equal(provenanceHTMLRecords(f.receipt).length,11);
    assert.equal(sourceBoundToTree(f.receipt,f.tree),false,'HTML bytes are required, not a claimed source hash');
    const entries=new Map(f.tree.tree.map(e=>[e.path,e.sha]));
    const mutate=[
      i=>{i.runtime.find(r=>r.path.includes('/runtime-')).sourcePath='modules/core/index.js';},
      i=>{i.runtime.find(r=>r.path.includes('/runtime-')).gitBlob='a'.repeat(40);},
      i=>{i.runtime.find(r=>r.path.includes('/runtime-')).sha256=hash('forged executable');},
      i=>{i.runtime.find(r=>r.path.includes('/runtime-')).path='demos/unknown/runtime-'+ 'a'.repeat(64)+'/modules/core/index.js';},
      i=>{i.runtime.find(r=>r.path==='demos/editor/index.html').sha256=hash('forged HTML');},
      i=>{i.packageProvenance.packages[0].version='a'.repeat(64);},
      i=>{i.packageProvenance.generators.pop();},
      i=>{i.packageProvenance.packages[0].html.sourcePath='README.md';},
      i=>{i.shared=i.shared.filter(r=>r.path!=='scripts/build.js');},
      i=>{i.runtime.push({...i.runtime[0]});},
      i=>{i.runtime=i.runtime.filter(r=>!r.path.endsWith('/runtime-'+i.packageProvenance.packages[0].version+'/demos/editor/style.css'));}
    ];
    for(const modify of mutate){const i=structuredClone(f.inputs);modify(i);assert.equal(packageSourceBound(i,entries,f.htmlSources),false);}
    const html=new Map(f.htmlSources);html.set('demos/editor/index.html',Buffer.from('forged source'));
    assert.equal(sourceBoundToTree(f.receipt,f.tree,html),false);
    assert.equal(sourceBoundToTree(f.receipt,{...f.tree,truncated:true},f.htmlSources),false);
    const missing={...f.tree,tree:f.tree.tree.filter(r=>r.path!=='scripts/pursuit-package.mjs')};
    assert.equal(sourceBoundToTree(f.receipt,missing,f.htmlSources),false);
  }finally{await rm(f.root,{recursive:true,force:true});}
});

test('local provenance replay rejects forged HTML, copied code and unknown generated members',async()=>{
  const f=await fixture();
  try{
    for(const path of ['demos/editor/index.html',f.files.find(r=>r.path.includes('/runtime-')&&r.path.endsWith('.js')).path]){
      const original=await readFile(join(f.root,'dist',path));
      const forged=Buffer.concat([original,Buffer.from('\n/* forged */')]);
      await writeFile(join(f.root,'dist',path),forged);
      const manifest=f.files.map(r=>r.path===path?{path,bytes:forged.length,sha256:hash(forged)}:r);
      await assert.rejects(packageProvenance({root:f.root,files:manifest}),/generated package bytes mismatch/);
      await writeFile(join(f.root,'dist',path),original);
    }
    await assert.rejects(packageProvenance({root:f.root,files:[...f.files,{path:'demos/editor/runtime-unknown/evil.js',bytes:0,sha256:hash('')}]}),/inventory mismatch/);
    const missing=f.files.filter(r=>!r.path.includes('/runtime-')||!r.path.endsWith('/modules/core/index.js'));
    await assert.rejects(packageProvenance({root:f.root,files:missing}),/inventory mismatch/);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
