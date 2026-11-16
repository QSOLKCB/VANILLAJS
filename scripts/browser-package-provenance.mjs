// SPDX-License-Identifier: Apache-2.0
// Generated package rows are never assigned a caller-selected source path.
// Rebuild the ten known immutable runtime namespaces from source, then bind
// their byte-identical copies and narrowly rewritten entry pages to Git blobs.
import {mkdtemp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {hash,gitBlob} from './browser-dependencies.mjs';
import {packageEditorRuntime,packageLabRuntime} from './pursuit-package.mjs';
export const PROVENANCE_SCHEMA='qsol.browser.package-provenance.v1';
const LABS=['editor','pursuit-lab','skyguard-lab','arcade-combat-lab','block-arena-lab','demoscene-lab','sprite-foundry','weapon-feel-lab','narrative-foundry','game-maker-lab'];
const STARTUPS={'editor':'start.js','pursuit-lab':'js/start.js','skyguard-lab':'js/start.js','arcade-combat-lab':'start.js','block-arena-lab':'start.js','demoscene-lab':'start.js','sprite-foundry':'start.js','weapon-feel-lab':'start.js','narrative-foundry':'start.js','game-maker-lab':'start.js'};
const GENERATORS=['scripts/build.js','scripts/pursuit-package.mjs','scripts/browser-dependencies.mjs','scripts/browser-package-provenance.mjs','scripts/game-maker-runtime.mjs'];
const record=(path,bytes)=>({path,sha256:hash(bytes),gitBlob:gitBlob(bytes)});
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const safe=path=>typeof path==='string'&&/^[a-zA-Z0-9._/-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(p=>!p||p==='.'||p==='..');
const row=f=>sameKeys(f,['path','sha256','gitBlob'])&&safe(f.path)&&/^[0-9a-f]{64}$/.test(f.sha256)&&/^[0-9a-f]{40}$/.test(f.gitBlob);
const generated=path=>path.split('/').some(p=>p.startsWith('runtime-'));
function allowedCopy(lab,path){
  if(lab!=='editor')return new RegExp('^(?:api|modules|demos/'+lab+')/[a-zA-Z0-9_./-]+\\.js$').test(path)&&safe(path);
  return /^(?:api|modules|demos\/editor|demos\/demoscene-lab|demos\/4x-game-lab\/voidward\/js)\/.+\.js$/.test(path)||
    /^demos\/4x-game-lab\/voidward\/mods\/frontier\/.+\.txt$/.test(path)||
    ['demos/gpu-lab/controls.js','demos/editor/style.css'].includes(path);
}
function rewrite(html,lab,version){
  const base='demos/'+lab;
  if(lab==='editor'){
    for(const name of ['start.js','style.css']){
      const marker='"./'+name+'"';if(html.split(marker).length!==2)throw Error('unexpected editor entry');
      html=html.replace(marker,'"./runtime-'+version+'/'+base+'/'+name+'"');
    }
  }else{
    const marker='src="./'+STARTUPS[lab]+'"';if(html.split(marker).length!==2)throw Error('unexpected lab entry');
    html=html.replace(marker,'src="./runtime-'+version+'/'+base+'/'+STARTUPS[lab]+'"');
  }
  return html;
}
function validMetadata(metadata){
  return sameKeys(metadata,['schema','packages','generators'])&&metadata.schema===PROVENANCE_SCHEMA&&
    Array.isArray(metadata.packages)&&metadata.packages.length===LABS.length&&metadata.packages.every((p,i)=>
      sameKeys(p,['lab','version','html'])&&p.lab===LABS[i]&&/^[a-f0-9]{64}$/.test(p.version)&&row(p.html)&&p.html.path==='demos/'+p.lab+'/index.html')&&
    Array.isArray(metadata.generators)&&metadata.generators.length===GENERATORS.length&&metadata.generators.every((f,i)=>row(f)&&f.path===GENERATORS[i]);
}
export function provenanceHTMLRecords(receipt){
  const records=new Map();
  for(const result of Object.values(receipt.results??{})){
    const metadata=result.inputs?.packageProvenance;if(metadata===undefined)continue;
    if(!validMetadata(metadata))throw Error('invalid package provenance metadata');
    for(const p of metadata.packages){
      const previous=records.get(p.html.path);
      if(previous&&JSON.stringify(previous)!==JSON.stringify(p.html))throw Error('conflicting HTML source provenance');
      records.set(p.html.path,p.html);
    }
  }
  return [...records.values()];
}

export async function packageProvenance({root,files}){
  const temporary=await mkdtemp(join(tmpdir(),'browser-package-provenance-'));
  try{
    async function copySource(path){
      await mkdir(join(temporary,path),{recursive:true});
      for(const entry of await readdir(join(root,path),{withFileTypes:true})){
        const child=path+'/'+entry.name;
        if(entry.isSymbolicLink()||entry.name.startsWith('runtime-'))throw Error('unsafe source package member: '+child);
        if(entry.isDirectory())await copySource(child);
        else await writeFile(join(temporary,child),await readFile(join(root,child)));
      }
    }
    for(const path of ['api','modules','demos'])await copySource(path);
    const expected=new Set(),packages=[];
    for(const lab of LABS){
      const htmlPath='demos/'+lab+'/index.html',original=await readFile(join(root,htmlPath));
      const result=lab==='editor'?await packageEditorRuntime(temporary):await packageLabRuntime(temporary,lab);
      packages.push({lab,version:result.version,html:record(htmlPath,original)});
      expected.add(htmlPath);
      for(const f of result.files)expected.add('demos/'+lab+'/runtime-'+result.version+'/'+f.path);
    }
    const actual=files.filter(f=>generated(f.path)||LABS.some(lab=>f.path==='demos/'+lab+'/index.html')).map(f=>f.path).sort();
    if(JSON.stringify(actual)!==JSON.stringify([...expected].sort()))throw Error('generated package inventory mismatch');
    for(const path of expected){
      const actualBytes=await readFile(join(root,'dist',path)),expectedBytes=await readFile(join(temporary,path));
      if(!actualBytes.equals(expectedBytes))throw Error('generated package bytes mismatch: '+path);
      const f=files.find(f=>f.path===path);
      if(!f||hash(actualBytes)!==f.sha256||actualBytes.length!==f.bytes)throw Error('generated package digest mismatch: '+path);
    }
    const generators=await Promise.all(GENERATORS.map(async path=>record(path,await readFile(join(root,path)))));
    return {metadata:{schema:PROVENANCE_SCHEMA,packages,generators},sources:[...packages.map(p=>p.html),...generators]};
  }finally{await rm(temporary,{recursive:true,force:true});}
}

// This check runs again when consuming authenticated main receipts. HTML source
// bytes come from digest-checked Git blobs, never the receipt's claimed text.
export function packageSourceBound(inputs,entries,htmlSources=new Map()){
  try{
    const metadata=inputs.packageProvenance;
    if(!validMetadata(metadata)||!Array.isArray(inputs.runtime)||!Array.isArray(inputs.shared))return false;
    const bound=f=>row(f)&&entries.get(f.path)===f.gitBlob;
    const originals=[...metadata.packages.map(p=>p.html),...metadata.generators];
    if(!originals.every(f=>bound(f)&&inputs.shared.some(s=>s.path===f.path&&s.sha256===f.sha256&&s.gitBlob===f.gitBlob)))return false;
    const runtime=new Map();
    for(const f of inputs.runtime){
      if(!safe(f.path)||runtime.has(f.path))return false;
      runtime.set(f.path,f);
    }
    const recognized=new Set();
    for(const pkg of metadata.packages){
      const prefix='demos/'+pkg.lab+'/runtime-'+pkg.version+'/',copies=[];
      for(const f of inputs.runtime)if(f.path.startsWith(prefix)){
        const sourcePath=f.path.slice(prefix.length),source=runtime.get(sourcePath);
        if(!row(f)||generated(sourcePath)||!allowedCopy(pkg.lab,sourcePath)||!bound(source)||f.gitBlob!==source.gitBlob||f.sha256!==source.sha256)return false;
        copies.push({path:sourcePath,sha256:f.sha256});recognized.add(f.path);
      }
      copies.sort((a,b)=>a.path.localeCompare(b.path));
      if(!copies.some(f=>f.path==='demos/'+pkg.lab+'/'+STARTUPS[pkg.lab])||hash(JSON.stringify(copies))!==pkg.version)return false;
      // Editor packaging has an explicit extension allowlist, so authenticate
      // its complete inventory as well as each member's contents.
      if(pkg.lab==='editor'){
        const all=inputs.runtime.filter(f=>!generated(f.path)&&allowedCopy('editor',f.path)).map(f=>f.path).sort();
        if(JSON.stringify(all)!==JSON.stringify(copies.map(f=>f.path).sort()))return false;
      }
      const bytes=htmlSources.get(pkg.html.path);
      if(bytes===undefined||gitBlob(bytes)!==pkg.html.gitBlob||hash(bytes)!==pkg.html.sha256)return false;
      const output=record(pkg.html.path,rewrite(Buffer.from(bytes).toString('utf8'),pkg.lab,pkg.version));
      const actual=runtime.get(pkg.html.path);
      if(!row(actual)||actual.sha256!==output.sha256||actual.gitBlob!==output.gitBlob)return false;
      recognized.add(pkg.html.path);
    }
    return inputs.runtime.every(f=>recognized.has(f.path)||
      (!generated(f.path)&&(['service-worker.js','.nojekyll'].includes(f.path)||bound(f))));
  }catch{return false;}
}
