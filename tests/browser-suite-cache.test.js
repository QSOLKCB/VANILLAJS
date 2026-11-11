// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {hash,gitBlob,identity,jsDependencies,assetDependencies,closures,resolveLocal,validateInventory} from '../scripts/browser-dependencies.mjs';
import {sourceProfile,SUITES,executionReceipt,executionPlan} from '../scripts/browser-suite-cache.mjs';
import {decide,producerAllowed,validateExecution,sourceBoundToTree,unpackArtifact,auditAuthority,loadMainExecutions,RECEIPT_KIND,ARTIFACT_PREFIX} from '../scripts/browser-receipt-authority.mjs';
const environment={node:'22',playwright:'1.64.0',chromium:'156',platform:'linux',arch:'x64',imageVersion:'image1'};
function fixture(){
  const files={'modules/math/index.js':'export const x=1;','modules/navigation/index.js':'export const route=1;','index.html':'<script type="module" src="./demos/home/app.js"></script>','service-worker.js':'// generated','offline/register.js':'// registration'};
  const suites={};for(const group of SUITES){suites[group]={roots:['demos/'+group+'/'],consumes:['donor','editor'].includes(group)?['donor','editor']:[group],serviceWorker:group!=='worlds'};files['demos/'+group+'/app.js']=`import {x} from '../../modules/${group==='worlds'?'navigation':'math'}/index.js';`;}
  const policy={suites,contracts:{'modules/math/':['oracle.py','contract.md','fixture.json']},opaqueRuntime:{'offline/register.js':{sha256:hash(files['offline/register.js']),roots:[]}},workerTemplateSHA256:hash('template')};
  const extra={'oracle.py':'oracle 1','contract.md':'contract 1','fixture.json':'domain 1','scripts/service-worker.template.js':'template',shared:[],tests:Object.fromEntries(SUITES.map(g=>[g,[]]))};
  return {files,policy,extra};
}
function compute(f,env=environment){return closures({files:Object.entries(f.files).map(([path,s])=>({path,sha256:hash(s)})),sources:f.files,policy:f.policy,extra:f.extra,environment:env});}
const changed=(a,b)=>SUITES.filter(g=>a[g].fingerprint!==b[g].fingerprint);
const trusted={ok:true,reason:'fixture authority, not live GitHub'};
const qualify=p=>[1,2,3].map(run=>({run,fingerprint:p.fingerprint}));
test('A/K: three distinct qualified executions reuse; retries and reuse never add evidence',()=>{
  const p=compute(fixture()).worlds;assert.equal(decide({profile:p,authority:trusted,executions:qualify(p)}).reuse,true);
  for(const runs of [[],[1],[1,2],[1,1,1]])assert.equal(decide({profile:p,authority:trusted,executions:runs.map(run=>({run,fingerprint:p.fingerprint}))}).reuse,false);
});
test('B/C: documentation ignored; standalone unreachable math invalidates worker scopes only',()=>{
  const f=fixture(),a=compute(f);f.extra['unrelated.md']='edited';assert.deepEqual(changed(a,compute(f)),[]);
  f.files['modules/unreachable/index.js']='export const exact=1n;';assert.deepEqual(changed(a,compute(f)),SUITES.filter(g=>g!=='worlds'));
});
test('D: reachable runtime invalidates every consumer',()=>{
  const f=fixture(),a=compute(f);f.files['modules/navigation/index.js']='export const route=2;';assert.deepEqual(changed(a,compute(f)),SUITES);
  const b=compute(f);f.files['modules/math/index.js']='export const x=2;';assert.deepEqual(changed(b,compute(f)),SUITES.filter(g=>g!=='worlds'));
});
test('E: oracle code, mathematical contract and domain identity are bound, not expected value alone',()=>{
  for(const file of ['oracle.py','contract.md','fixture.json']){const f=fixture(),a=compute(f);f.extra[file]+='changed';assert.deepEqual(changed(a,compute(f)),SUITES.filter(g=>g!=='worlds'));}
});
test('F: unknown imports, missing source, new unclassified packages and unsupported syntax fail closed',()=>{
  for(const code of ["import(name);","import('./missing.js');","import x from 'external';","import('./math.js',{});","new Worker(url);","eval(code);","document.createElement(tag);","new URL('./data.json',import.meta.url);","import('\\x2e/hidden.js');"]){
    const f=fixture();f.files['demos/worlds/app.js']=code;const p=compute(f).worlds;
    assert.ok(p.issues.length,code);assert.equal(decide({profile:p,authority:trusted,executions:qualify(p)}).reuse,false);
  }
  const f=fixture();f.files['new-shared.js']='export const x=1;';for(const p of Object.values(compute(f)))assert.ok(p.issues.some(x=>x.includes('unclassified')));
  assert.throws(()=>resolveLocal('modules/a.js','../../escape.js'));
  assert.throws(()=>validateInventory([{path:'../x',sha256:'a'.repeat(64)}]));
});
test('G/H: scoped harness and all execution environment inputs invalidate identities',()=>{
  const f=fixture(),a=compute(f);f.extra.tests.worlds=[{path:'test.js',sha256:hash('new requirement')}];assert.deepEqual(changed(a,compute(f)),['worlds']);
  for(const key of Object.keys(environment))assert.deepEqual(changed(a,compute(f,{...environment,[key]:'changed'})),SUITES);
  f.extra.shared=[{path:'verifier.js',sha256:hash('changed verifier')}];assert.deepEqual(changed(a,compute(f)),SUITES);
});
test('M: cross-suite imports and generated service-worker/index dependencies are explicit',()=>{
  for(const path of ['demos/editor/app.js','demos/donor/app.js','service-worker.js','index.html']){
    const f=fixture(),a=compute(f);f.files[path]+='\n//changed';assert.deepEqual(changed(a,compute(f)),SUITES.filter(g=>g!=='worlds'));
  }
  const f=fixture();f.policy.suites.donor.serviceWorker=false;f.policy.suites.editor.serviceWorker=false;
  const a=compute(f);f.files['demos/editor/app.js']+='\n//change';const groups=changed(a,compute(f));assert.ok(groups.includes('donor')&&groups.includes('editor'));
});
test('literal static/re-export/dynamic imports, comments, strings, cycles and resource syntax',()=>{
  assert.deepEqual(jsDependencies(`// import('bad')\nconst text="import('bad')";import x from './a.js';export {x} from './b.js';await import('./c.js');`).imports,['./a.js','./b.js','./c.js']);
  assert.ok(jsDependencies('const x=`${import(name)}`').issues.length);
  assert.deepEqual(assetDependencies('x.html','<script type="module" src="./a.js"></script><link rel="stylesheet" href="a.css">').imports,['./a.js','./a.css']);
  assert.ok(assetDependencies('x.html','<script>import(x)</script>').issues.length);
  const f=fixture();f.files['modules/navigation/index.js']="import './cycle.js';";f.files['modules/navigation/cycle.js']="export * from './index.js';";assert.deepEqual(compute(f).worlds.issues,[]);
});
function authenticatedFixture(){
  const row={path:'scripts/browser-suite-cache.mjs',sha256:hash('verified'),gitBlob:gitBlob('verified')};
  const inputs={shared:[row],tests:[],runtime:[],requirements:[]};
  const run={id:1,run_attempt:1,head_sha:'a'.repeat(40),event:'push',head_branch:'main',repository:{full_name:'QSOLKCB/VANILLAJS'},path:'.github/workflows/flight-lab.yml',status:'completed',conclusion:'success'};
  const receipt={kind:RECEIPT_KIND,repository:run.repository.full_name,ref:'refs/heads/main',event:run.event,run:'1',attempt:'1',sha:run.head_sha,workflow:run.path,results:{worlds:{status:'PASS',executed:true,inputs,fingerprint:identity(inputs)}}};
  return {run,receipt,tree:{truncated:false,tree:[{path:row.path,type:'blob',mode:'100644',sha:row.gitBlob}]}};
}
test('I/J: forged metadata, PR producer, source tree substitution, failed/reused run cannot authenticate',()=>{
  const {run,receipt,tree}=authenticatedFixture();assert.equal(validateExecution(receipt,run,receipt.repository,receipt.workflow),true);assert.equal(sourceBoundToTree(receipt,tree),true);
  for(const patch of [{ref:'refs/pull/66/merge'},{event:'pull_request'},{repository:'fork/repo'},{sha:'b'.repeat(40)},{run:'2'},{attempt:'2'}])assert.equal(validateExecution({...receipt,...patch},run,receipt.repository,receipt.workflow),false);
  assert.equal(validateExecution(receipt,{...run,conclusion:'failure'},receipt.repository,receipt.workflow),false);
  const bad=structuredClone(receipt);bad.results.worlds.inputs.shared[0].sha256=hash('forged');assert.equal(validateExecution(bad,run,receipt.repository,receipt.workflow),false);
  assert.equal(sourceBoundToTree(receipt,{...tree,truncated:true}),false);assert.equal(sourceBoundToTree(receipt,{tree:[]}),false);
  assert.equal(producerAllowed({repository:receipt.repository,ref:'refs/pull/66/merge',event:'pull_request'}),false);
  assert.throws(()=>executionReceipt({repository:receipt.repository,ref:'refs/pull/66/merge',event:'pull_request'},compute(fixture()),SUITES));
});
const zip=(data,name='execution.json')=>{const p=spawnSync('python3',['-c',"import io,sys,zipfile\nb=io.BytesIO()\nwith zipfile.ZipFile(b,'w') as z:z.writestr(sys.argv[1],sys.stdin.buffer.read())\nsys.stdout.buffer.write(b.getvalue())",name],{input:JSON.stringify(data)});assert.equal(p.status,0);return p.stdout;};
test('I: corrupt, oversized, wrong digest or wrong ZIP membership never authenticates',()=>{
  const {receipt}=authenticatedFixture(),bytes=zip(receipt);assert.deepEqual(unpackArtifact(bytes,'sha256:'+hash(bytes)),receipt);
  assert.throws(()=>unpackArtifact(bytes,'sha256:'+'0'.repeat(64)));
  const wrong=zip(receipt,'../execution.json');assert.throws(()=>unpackArtifact(wrong,'sha256:'+hash(wrong)));
  assert.throws(()=>unpackArtifact(Buffer.from('bad zip'),'sha256:'+hash('bad zip')));
  assert.throws(()=>unpackArtifact(Buffer.alloc(1048577),'sha256:'+'0'.repeat(64)));
});
test('trust audit fails closed on absent protection, unreadable API or no required review',async()=>{
  assert.equal((await auditAuthority(async()=>({protected:false}))).ok,false);
  assert.equal((await auditAuthority(async()=>{throw Error('401');})).ok,false);
  assert.equal((await auditAuthority(async()=>({protected:true}))).ok,false);
  const policy={repository:'QSOLKCB/VANILLAJS',workflow:'.github/workflows/flight-lab.yml'};
  const loaded=await loadMainExecutions({policy,api:async()=>({protected:false}),download:()=>{throw Error('must not download');}});assert.deepEqual(loaded.executions,[]);
});
test('immutable artifact is selected by authoritative run, never restored cache metadata',async()=>{
  const {run,receipt,tree}=authenticatedFixture(),rules=[{type:'pull_request',parameters:{required_approving_review_count:1}}],classic={};
  receipt.authorityDigest=identity({rules,classic});const bytes=zip(receipt);
  const api=async p=>{
    if(p.endsWith('branches/main'))return p.includes('/rules/')?rules:{protected:true};
    if(p.endsWith('/protection'))return classic;
    if(p.includes('/runs?'))return {workflow_runs:[run]};
    if(p.includes('/artifacts?'))return {artifacts:[{id:9,name:ARTIFACT_PREFIX+'1-1',expired:false,digest:'sha256:'+hash(bytes),workflow_run:{id:1,head_sha:run.head_sha,head_branch:'main'}}]};
    if(p.includes('/git/commits/'))return {tree:{sha:'b'.repeat(40)}};
    if(p.includes('/git/trees/'))return tree;
    throw Error(p);
  };
  const loaded=await loadMainExecutions({policy:{repository:receipt.repository,workflow:receipt.workflow},api,download:async()=>bytes});assert.equal(loaded.authority.ok,true);assert.equal(loaded.executions.length,1);
  const corrupt=await loadMainExecutions({policy:{repository:receipt.repository,workflow:receipt.workflow},api,download:async()=>Buffer.from('forged PR cache')});assert.equal(corrupt.executions.length,0);
  const missing=await loadMainExecutions({policy:{repository:receipt.repository,workflow:receipt.workflow},api:async p=>p.includes('/artifacts?')?{artifacts:[]}:api(p),download:async()=>bytes});assert.equal(missing.executions.length,0);
});
test('L: manual full-browser selects all seven regardless of qualification',()=>{
  const profiles=compute(fixture()),receipts=[1,2,3].map(run=>({run,results:Object.fromEntries(SUITES.map(g=>[g,{fingerprint:profiles[g].fingerprint,inputs:profiles[g].inputs}]))}));
  assert.equal(Object.values(executionPlan(profiles,trusted,receipts)).filter(x=>x.reuse).length,7);
  assert.equal(Object.values(executionPlan(profiles,trusted,receipts,true)).filter(x=>x.reuse).length,0);
});
test('workflow retains mandatory gates, main-only artifact publication and no PR-scoped witness restore',async()=>{
  const yaml=await readFile(new URL('../.github/workflows/flight-lab.yml',import.meta.url),'utf8');
  for(const command of ['node --test tests/*.test.js','node scripts/check.js','node scripts/build.js','node scripts/verify-offline.js','node scripts/flight-browser-preflight.mjs','scripts/ci_invariant_oracle.py --check','full_browser:'])assert.ok(yaml.includes(command),command);
  assert.doesNotMatch(yaml,/actions\/cache\/(restore|save)@/);assert.match(yaml,/github.ref == 'refs\/heads\/main'.*BROWSER_PUBLISH_EXECUTION/);
});

test('independent Python fixture agrees on finite closure and qualification cases',async()=>{
  const input=JSON.parse(await readFile(new URL('./fixtures/ci-invariant-001-input.json',import.meta.url),'utf8'));
  const expected=JSON.parse(await readFile(new URL('./fixtures/ci-invariant-001-expected.json',import.meta.url),'utf8'));
  assert.equal(expected.inputSHA256,hash(await readFile(new URL('./fixtures/ci-invariant-001-input.json',import.meta.url))));
  for(const group of input.groups){
    const visited=new Set([group]);let count=-1;
    while(count!==visited.size){count=visited.size;for(const node of [...visited])for(const dependency of input.graph[node])visited.add(dependency);}
    const closure=input.workerConsumers.includes(group)?Object.keys(input.graph).sort():[...visited].sort();
    assert.deepEqual(closure,expected.closures[group]);
  }
  const profile=compute(fixture()).worlds;
  input.qualificationCases.forEach((runs,i)=>assert.equal(decide({profile,authority:trusted,executions:runs.map(run=>({run,fingerprint:profile.fingerprint}))}).reuse,expected.qualifies[i]));
});

test('changed reachable executable cannot qualify until its closure audit is reviewed',()=>{
  const f=fixture();f.policy.auditedRuntime=Object.fromEntries(Object.entries(f.files).filter(([p])=>p.endsWith('.js')).map(([p,s])=>[p,hash(s)]));
  assert.deepEqual(compute(f).worlds.issues,[]);
  f.files['modules/navigation/index.js']+='\n// changed';const p=compute(f).worlds;
  assert.ok(p.issues.some(i=>i.includes('unreviewed executable')));
  assert.equal(decide({profile:p,authority:trusted,executions:qualify(p)}).reuse,false);
});
