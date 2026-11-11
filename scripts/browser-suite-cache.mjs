// SPDX-License-Identifier: Apache-2.0
// Browser witness reuse: immutable, source-bound main-branch PASS receipts only.
// Every run still executes ALL Node tests, source checks, packaging and SHA-256
// package verification; an unknown/shared dependency invalidates ALL suites.
// PRs can read reviewed main receipts but NEVER publish trusted cache entries.
import {createHash} from 'node:crypto';
import {readFile,lstat,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,join,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

export const SUITES=Object.freeze(['home','render','play','worlds','research','donor','editor']);
export const PROFILE='browser-suite-source-v2-three-executions';
const ROOT=resolve(import.meta.dirname,'..');
const DIGEST=bytes=>createHash('sha256').update(bytes).digest('hex');
const OWN=Object.freeze({
  home:['demos/flight-lab/'],
  render:['demos/integer-foundry/','demos/clockwork-vault/'],
  play:['demos/interaction-lab/','demos/fps-lab/'],
  worlds:['demos/rts-lab/','demos/2d-lab/'],
  research:['demos/omi-lab/','demos/ancient-machine/'],
  donor:['demos/bullet-time-lab/','demos/arcade-lab/','demos/shared-lab/','demos/gpu-lab/','demos/space-lab/'],
  editor:['demos/editor/']
});
const BROWSER_SCRIPTS=Object.freeze({
  home:[],
  render:['browser-integer.js','browser-opt-render.js','browser-webgl-api.js',
    'browser-frame-gate.js','browser-vault.js'],
  play:['browser-interactions.js','browser-mouse.js','browser-fps.js',
    'browser-fps-motion.js','browser-platforms.js'],
  worlds:['browser-rts.js','browser-flow.js','browser-2d.js'],
  research:['browser-omi.js','browser-machine.js'],
  donor:['browser-donor-labs.js','browser-optional-labs.js'],
  editor:['browser-editor.js']
});
const toSha=(label,bytes)=>({path:label,sha256:DIGEST(bytes)});
const sortByPath=(a,b)=>a.path.localeCompare(b.path);
async function artifact(path){return readFile(join(ROOT,path));}
const allOwn=Object.values(OWN).flat();
function owners(path){return SUITES.filter(group=>
  OWN[group].some(prefix=>path.startsWith(prefix)));}
export function partitionPackage(files){
  if(!Array.isArray(files)||files.some(f=>typeof f?.path!=='string'||
      !/^[a-zA-Z0-9._/-]+$/.test(f.path)||typeof f.sha256!=='string'||
      !/^[a-f0-9]{64}$/.test(f.sha256)))throw new TypeError('invalid package inventory');
  if(files.some(f=>f.path.split('/').includes('..')||f.path.startsWith('/')))
    throw new TypeError('unsafe package path');
  if(new Set(files.map(f=>f.path)).size!==files.length)
    throw new TypeError('duplicate package inventory paths');
  const global=[],own=Object.fromEntries(SUITES.map(g=>[g,[]]));
  for(const f of files){
    const groups=owners(f.path);
    if(groups.length>1)throw new Error('ambiguous suite ownership: '+f.path);
    if(groups.length===1)own[groups[0]].push(f);
    else if(f.path.startsWith('demos/')){
      // New scenes and unclassified shared demo assets are assumed
      // potentially relevant to EVERY suite until explicitly classified.
      global.push(f);
    }else if(f.path==='service-worker.js'){
      // Install/caching behavior affects shell + donor + editor navigation,
      // but isolated no-worker contexts in other groups are independent.
      for(const g of ['home','donor','editor'])own[g].push(f);
    }else if(f.path==='index.html'){
      for(const g of ['home','donor','editor'])own[g].push(f);
    }else global.push(f);
  }
  for(const g of SUITES){
    if(!own[g].some(f=>f.path.startsWith('demos/')))
      throw new Error('missing scoped runtime members: '+g);
  }
  return {global,own};
}
export function digestClosures(files,sharedCode,suiteCode,environment){
  const {global,own}=partitionPackage(files);
  const results={};
  for(const group of SUITES){
    // The donor verifier opens the editor/player, and editor controls import
    // GPU-lab code. Include both complete directory closures, independently
    // of generated service-worker hashes. Keep exclusive ownership for validation.
    const consumers=(group==='donor'||group==='editor')?['donor','editor']:[group];
    const runtime=[...new Map([...global,...consumers.flatMap(g=>own[g])].map(f=>[f.path,f])).values()].map(f=>({path:f.path,sha256:f.sha256}));
    runtime.sort(sortByPath);
    const identity={protocol:PROFILE,group,env:environment,runtime,
      sharedCode:[...sharedCode].sort(sortByPath),
      suiteCode:[...suiteCode[group]].sort(sortByPath)};
    results[group]=DIGEST(Buffer.from(JSON.stringify(identity)));
  }
  return results;
}
export async function sourceProfile({manifest,environment}={}){
  const packageManifest=manifest??JSON.parse(await artifact('dist/manifest.json'));
  if(!packageManifest||!Array.isArray(packageManifest.files))
    throw new TypeError('dist manifest missing or malformed');
  // Reject incomplete inventories before interpreting any cache identity.
  partitionPackage(packageManifest.files);
  const external=[
    '.github/workflows/flight-lab.yml','scripts/browser-check.js',
    'scripts/browser-suite-cache.mjs','scripts/flight-browser-preflight.mjs',
    'scripts/build.js','scripts/service-worker.template.js','package.json'
  ];
  const code=[];
  for(const file of external)code.push(toSha(file,await artifact(file)));
  const allScripts=new Set(Object.values(BROWSER_SCRIPTS).flat());
  // A newly added unclassified browser-* witness must invalidate all groups.
  const {readdir}=await import('node:fs/promises');
  const unknown=(await readdir(join(ROOT,'scripts'))).filter(p=>/^browser-.*\.js$/.test(p)&&
    p!=='browser-check.js'&&!allScripts.has(p));
  for(const name of unknown)code.push(toSha('scripts/'+name,await artifact('scripts/'+name)));
  code.sort((a,b)=>a.path.localeCompare(b.path));
  const env=environment??{platform:process.platform,arch:process.arch,node:process.version,
    imageVersion:process.env.ImageVersion??'local-untrusted',
    playwright:'1.64.0-only-shell'};
  const scripts={};
  for(const group of SUITES){
    scripts[group]=[];
    for(const file of BROWSER_SCRIPTS[group])
      scripts[group].push(toSha('scripts/'+file,await artifact('scripts/'+file)));
  }
  return digestClosures(packageManifest.files,code,scripts,env);
}
export const REQUIRED_PASSES=3;
const KIND='qsol.vanillajs.browser.suite.witness.v2';
export function validWitness(data,suite,fingerprint){
  return Boolean(data&&data.kind===KIND&&SUITES.includes(suite)&&
    /^[0-9a-f]{64}$/.test(fingerprint)&&data.suite===suite&&data.fingerprint===fingerprint&&
    data.status==='PASS'&&data.provenance==='protected-main-only'&&
    Array.isArray(data.runs)&&data.runs.length>=1&&data.runs.length<=REQUIRED_PASSES&&
    data.runs.every(r=>typeof r==='string'&&/^[1-9][0-9]{0,19}$/.test(r))&&
    new Set(data.runs).size===data.runs.length);
}
export function witness(suite,fingerprint,run,previous=null){
  if(!SUITES.includes(suite)||!/^[0-9a-f]{64}$/.test(fingerprint)||
    typeof run!=='string'||! /^[1-9][0-9]{0,19}$/.test(run))throw new TypeError('invalid source or execution identity');
  const runs=validWitness(previous,suite,fingerprint)?[...previous.runs]:[];
  if(!runs.includes(run)&&runs.length<REQUIRED_PASSES)runs.push(run);
  return {kind:KIND,suite,fingerprint,status:'PASS',provenance:'protected-main-only',runs};
}
export async function readWitness(cachePath,suite,fingerprint,cacheHit){
  if(cacheHit!=='true')return null;
  try{
    const st=await lstat(cachePath);
    if(!st.isFile()||st.size>4096||st.size<80)return null;
    // Parse one owned byte snapshot; never reopen the path after validation.
    const data=JSON.parse(await readFile(cachePath,'utf8'));
    return validWitness(data,suite,fingerprint)?data:null;
  }catch{return null;}
}
export async function reuse(cachePath,suite,fingerprint,cacheHit){
  return (await readWitness(cachePath,suite,fingerprint,cacheHit))?.runs.length===REQUIRED_PASSES;
}
async function plan(){
  const fingerprints=await sourceProfile();
  for(const group of SUITES)console.log(group+'='+fingerprints[group]);
}
async function execute(){
  const fingerprints=await sourceProfile(),temp=process.env.RUNNER_TEMP;
  if(!temp)throw new Error('RUNNER_TEMP required for isolated witness paths');
  const cacheRoot=join(temp,'flight-suite-evidence');
  await mkdir(cacheRoot,{recursive:true});
  const forceFull=process.env.BROWSER_FORCE_FULL==='true';
  if(forceFull)console.log('MANUAL FULL AUDIT: all source-bound browser receipts will be ignored');
  const stale=[],reused=[],previous={};
  for(const group of SUITES){
    const hit=process.env['BROWSER_CACHE_HIT_'+group.toUpperCase()]??'false';
    const path=join(cacheRoot,group+'.json');
    previous[group]=await readWitness(path,group,fingerprints[group],hit);
    if(!forceFull&&previous[group]?.runs.length===REQUIRED_PASSES)reused.push(group);
    else stale.push(group);
  }
  console.log('REUSED reviewed-main browser suites: '+(reused.join(', ')||'none'));
  console.log('VERIFY current-source browser suites: '+(stale.join(', ')||'none'));
  if(stale.length){
    const result=spawnSync(process.execPath,
      ['scripts/browser-check.js','--suites='+stale.join(',')],
      {cwd:ROOT,env:process.env,stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error('browser suite verification failed; no current-source witnesses published');
    for(const group of stale){
      // Atomic replacement. The complete run must have succeeded before any
      // PASS witnesses are written. GitHub saves ONLY on main after job success.
      const target=join(cacheRoot,group+'.json');
      // Local and PR executions never contribute trusted maturity.
      const trusted=process.env.GITHUB_REF==='refs/heads/main'&&
        ['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME);
      if(trusted){
        await writeFile(target+'.tmp',JSON.stringify(witness(group,fingerprints[group],
          process.env.GITHUB_RUN_ID,previous[group]))+'\n',{mode:0o600});
        await rename(target+'.tmp',target);
        if(process.env.GITHUB_ENV)await writeFile(process.env.GITHUB_ENV,
          'BROWSER_EXECUTED_'+group.toUpperCase()+'=true\n',{flag:'a'});
      }
    }
  }
  const summary=['## Source-bound incremental browser verification','','| Suite | Result | Source fingerprint |','|---|---|---|'];
  for(const group of SUITES){
    summary.push('| '+group+' | '+(reused.includes(group)?'Reused three protected-main executions':'Executed on current source')+
      ' | '+fingerprints[group].slice(0,16)+'… |');
  }
  summary.push('','All source/unit/package/archival checks execute on every run. Shared or unknown runtime changes invalidate all relevant browser suites.',
    'A cache miss or invalid witness always triggers a real Chromium test. Only main may publish reuse receipts.','');
  if(process.env.GITHUB_STEP_SUMMARY)
    await writeFile(process.env.GITHUB_STEP_SUMMARY,summary.join('\n'),{flag:'a'});
  console.log(summary.join('\n'));
}
async function main(){
  const action=process.argv[2];
  if(action==='plan'&&process.argv.length===3)await plan();
  else if(action==='execute'&&process.argv.length===3)await execute();
  else throw new Error('usage: node scripts/browser-suite-cache.mjs plan|execute');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{console.error('INCREMENTAL BROWSER GATE FAILED:',e.stack);process.exitCode=1;});
}
