// SPDX-License-Identifier: Apache-2.0
// Actions caches are NOT an authority. Read immutable, digest-verified artifacts
// directly from successful main workflow runs; PR cache shadowing is irrelevant.
import {spawnSync} from 'node:child_process';
import {hash,identity} from './browser-dependencies.mjs';
export const RECEIPT_KIND='qsol.browser.execution.v3';
export const ARTIFACT_PREFIX='ci-invariant-main-';
export function producerAllowed({repository,ref,event}){
  return repository==='QSOLKCB/VANILLAJS'&&ref==='refs/heads/main'&&['push','workflow_dispatch'].includes(event);
}
export function validateExecution(receipt,run,repository,workflow){
  return Boolean(receipt&&receipt.kind===RECEIPT_KIND&&producerAllowed(receipt)&&
    receipt.repository===repository&&receipt.workflow===workflow&&
    String(receipt.run)===String(run.id)&&String(receipt.attempt)===String(run.run_attempt)&&
    receipt.sha===run.head_sha&&receipt.event===run.event&&run.head_branch==='main'&&
    run.repository?.full_name===repository&&run.path===workflow&&
    run.status==='completed'&&run.conclusion==='success'&&
    /^[a-f0-9]{40}$/.test(receipt.sha)&&receipt.results&&typeof receipt.results==='object'&&
    Object.values(receipt.results).every(r=>r?.status==='PASS'&&r.executed===true&&
      /^[a-f0-9]{64}$/.test(r.fingerprint)&&r.inputs&&identity(r.inputs)===r.fingerprint));
}
export function decide({profile,executions=[],forceFull=false,authority}){
  if(forceFull)return {reuse:false,reason:'manual full-browser override',runs:[]};
  if(profile.issues.length)return {reuse:false,reason:'unsupported dependency analysis: '+profile.issues.join('; '),runs:[]};
  if(!authority?.ok)return {reuse:false,reason:'unverified authority: '+(authority?.reason??'no authority'),runs:[]};
  const runs=[...new Set(executions.filter(e=>e.fingerprint===profile.fingerprint).map(e=>String(e.run)))];
  return {reuse:runs.length>=3,reason:runs.length>=3?'three distinct authenticated main executions match every input':`qualification ${runs.length}/3: exact source/environment executions missing`,runs:runs.slice(0,3)};
}
export function changedInputs(before,after){
  const changes=[];for(const name of new Set([...Object.keys(before??{}),...Object.keys(after??{})]))
    if(identity(before?.[name]??null)!==identity(after?.[name]??null))changes.push(name);
  for(const name of ['runtime','requirements','shared','tests']){
    const a=new Map((before?.[name]??[]).map(f=>[f.path,f.sha256])),b=new Map((after?.[name]??[]).map(f=>[f.path,f.sha256]));
    for(const p of new Set([...a.keys(),...b.keys()]))if(a.get(p)!==b.get(p))changes.push(name+': '+p);
  }
  return changes;
}
export async function githubJSON(path,token){
  if(!/^repos\/QSOLKCB\/VANILLAJS\/[a-zA-Z0-9_./?=&%-]+$/.test(path))throw Error('unapproved GitHub endpoint');
  const r=await fetch('https://api.github.com/'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('GitHub '+r.status+' '+path);return r.json();
}
export function protectionAccepted(branch,rules,classic){
  if(branch?.protected!==true)return false;
  // Read-only policy: a protected branch must actually require PR approval.
  // GitHub administrators/bypass actors remain administrative trust principals.
  return (Array.isArray(rules)&&rules.some(r=>r.type==='pull_request'&&r.parameters?.required_approving_review_count>=1))||
    (classic?.required_pull_request_reviews?.required_approving_review_count>=1);
}
export async function auditAuthority(api){
  try{
    const branch=await api('repos/QSOLKCB/VANILLAJS/branches/main');
    if(branch.protected!==true)return {ok:false,reason:'main is not protected; no reusable receipt authority'};
    let rules=null,classic=null;try{rules=await api('repos/QSOLKCB/VANILLAJS/rules/branches/main');}catch{}
    try{classic=await api('repos/QSOLKCB/VANILLAJS/branches/main/protection');}catch{}
    if(!protectionAccepted(branch,rules,classic))return {ok:false,reason:'required PR approval controls cannot be established'};
    return {ok:true,reason:'GitHub main protection and required PR approval observed',policyDigest:identity({rules,classic})};
  }catch(e){return {ok:false,reason:e.message};}
}
const unzip=`import io,json,sys,zipfile
raw=sys.stdin.buffer.read(1048577)
if len(raw)>1048576: raise ValueError('archive too large')
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 names=z.namelist()
 if names!=['execution.json']: raise ValueError('unexpected archive members')
 info=z.getinfo('execution.json')
 if info.file_size>524288 or info.flag_bits&1: raise ValueError('invalid receipt size/encryption')
 data=z.read(info)
 if len(data)>524288: raise ValueError('oversized receipt')
 json.loads(data)
 sys.stdout.buffer.write(data)
`;
export function unpackArtifact(bytes,digest){
  if(bytes.length>1048576||!/^sha256:[0-9a-f]{64}$/.test(digest)||'sha256:'+hash(bytes)!==digest)throw Error('artifact digest/size mismatch');
  const p=spawnSync('python3',['-c',unzip],{input:bytes,maxBuffer:1048576});
  if(p.status!==0)throw Error('invalid artifact archive');return JSON.parse(p.stdout.toString('utf8'));
}
async function downloadArtifact(id,token){
  if(!Number.isSafeInteger(id)||id<=0)throw Error('invalid artifact id');
  const r=await fetch(`https://api.github.com/repos/QSOLKCB/VANILLAJS/actions/artifacts/${id}/zip`,{headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(r.status!==302)throw Error('artifact download unavailable');
  const url=new URL(r.headers.get('location'));if(url.protocol!=='https:')throw Error('invalid archive redirect');
  // Never send the GitHub token to the storage host.
  const blob=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!blob.ok||Number(blob.headers.get('content-length'))>1048576)throw Error('artifact too large/unavailable');
  const reader=blob.body.getReader(),chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw Error('oversized archive');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks);
}
export function sourceBoundToTree(receipt,tree){
  if(tree?.truncated||!Array.isArray(tree?.tree))return false;
  const entries=new Map(tree.tree.filter(e=>e.type==='blob'&&e.mode==='100644').map(e=>[e.path,e.sha]));
  const rows=Object.values(receipt.results);
  return rows.length>0&&rows.every(r=>['shared','tests','runtime','requirements'].every(kind=>
    Array.isArray(r.inputs[kind])&&r.inputs[kind].every(f=>
      ['service-worker.js','.nojekyll'].includes(f.path)&&kind==='runtime'||
      /^[a-f0-9]{40}$/.test(f.gitBlob??'')&&entries.get(f.path)===f.gitBlob)));
}
export async function loadMainExecutions({token,policy,api=path=>githubJSON(path,token),download=id=>downloadArtifact(id,token)}={}){
  const authority=await auditAuthority(api),executions=[],diagnostics=[];
  if(!authority.ok)return {authority,executions,diagnostics};
  try{
    const runs=await api('repos/QSOLKCB/VANILLAJS/actions/workflows/flight-lab.yml/runs?branch=main&status=success&per_page=30');
    for(const run of runs.workflow_runs??[]){
      if(!['push','workflow_dispatch'].includes(run.event)||run.head_branch!=='main'||run.repository?.full_name!==policy.repository||run.path!==policy.workflow||run.status!=='completed'||run.conclusion!=='success')continue;
      const list=await api(`repos/QSOLKCB/VANILLAJS/actions/runs/${run.id}/artifacts?per_page=100`);
      const expected=ARTIFACT_PREFIX+run.id+'-'+run.run_attempt;
      const candidates=(list.artifacts??[]).filter(a=>a.name===expected&&!a.expired);
      if(candidates.length!==1){diagnostics.push(run.id+': missing/ambiguous immutable execution artifact');continue;}
      const a=candidates[0];
      try{
        if(a.workflow_run?.id!==run.id||a.workflow_run?.head_sha!==run.head_sha||a.workflow_run?.head_branch!=='main')throw Error('artifact run binding mismatch');
        const receipt=unpackArtifact(await download(a.id),a.digest);
        if(!validateExecution(receipt,run,policy.repository,policy.workflow)||receipt.authorityDigest!==authority.policyDigest)throw Error('invalid receipt or changed protection controls');
        const commit=await api(`repos/QSOLKCB/VANILLAJS/git/commits/${run.head_sha}`);
        const tree=await api(`repos/QSOLKCB/VANILLAJS/git/trees/${commit.tree.sha}?recursive=1`);
        if(!sourceBoundToTree(receipt,tree))throw Error('GitHub source tree does not bind receipt inputs');
        executions.push(receipt);
      }catch(e){diagnostics.push(run.id+': '+e.message);}
    }
  }catch(e){diagnostics.push('authority lookup incomplete: '+e.message);return {authority:{ok:false,reason:e.message},executions:[],diagnostics};}
  return {authority,executions,diagnostics};
}
