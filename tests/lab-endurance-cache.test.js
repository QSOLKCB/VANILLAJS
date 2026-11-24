// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {hash,identity,jsDependencies,resolveLocal} from '../scripts/browser-dependencies.mjs';
import {endurancePlan} from '../scripts/lab-endurance-plan.mjs';
import {HARNESS,KIND,REPOSITORY,WORKFLOW,artifactName,executionInputs,reportComplete,
  eligibleRun,mergedPRForRun,validateExecution,findExecution} from '../scripts/lab-endurance-cache.mjs';

function fixture(){
  const run={id:42,run_attempt:2,repository:{full_name:REPOSITORY},head_branch:'main',
    head_sha:'a'.repeat(40),path:WORKFLOW,event:'push',status:'completed',conclusion:'success'};
  const inputs={schema:1,plan:endurancePlan(['--group=racing']),packageManifestSHA256:'b'.repeat(64),
    environment:{chromium:'156',node:'v22',imageVersion:'test'},
    harness:HARNESS.map(path=>({path,sha256:hash(path),gitBlob:'c'.repeat(40)}))};
  const report={kind:'qsol.vanillajs.lab-endurance.v1',status:'PASS',group:'racing',seed:7337,
    requiredCyclesPerLab:1000,sourceSHA:run.head_sha,packageManifestSHA256:inputs.packageManifestSHA256,
    chromium:'156',labs:inputs.plan.labs.map(lab=>({lab,status:'PASS',required:1000,completed:1000,
      digestSHA256:hash(lab),pixelProbes:[{at:1,width:800,height:600},{at:1000,width:800,height:600}]}))};
  const receipt={kind:KIND,executed:true,repository:REPOSITORY,workflow:WORKFLOW,ref:'refs/heads/main',
    event:'push',run:'42',attempt:'2',sha:run.head_sha,fingerprint:identity(inputs),inputs,report};
  const tree={truncated:false,tree:inputs.harness.map(f=>({path:f.path,sha:f.gitBlob,mode:'100644',type:'blob'}))};
  const pr={number:158,state:'closed',merged_at:'2026-11-24T12:00:00Z',merge_commit_sha:run.head_sha,
    base:{ref:'main',repo:{full_name:REPOSITORY}}};
  const artifact={id:7,name:artifactName('racing',run.id,run.run_attempt),expired:false,
    workflow_run:{id:run.id,head_sha:run.head_sha,head_branch:'main'},digest:'sha256:'+hash('archive')};
  const calls=[];
  const api=async path=>{
    calls.push(path);
    if(path.includes('/workflows/'))return {workflow_runs:[run]};
    if(path.includes('/artifacts?'))return {artifacts:[artifact]};
    if(path.includes('/pulls?'))return [pr];
    if(path.includes('/git/commits/'))return {tree:{sha:'d'.repeat(40)}};
    if(path.includes('/git/trees/'))return tree;
    throw Error('unexpected endpoint '+path);
  };
  return {run,inputs,report,receipt,tree,pr,artifact,calls,api,download:async()=>Buffer.from('archive'),
    unpack:()=>receipt,token:'test-token'};
}

test('endurance reuses an immutable complete main execution tied to a merged PR',async()=>{
  const f=fixture(),decision=await findExecution(f);
  assert.equal(decision.receipt,f.receipt);assert.equal(decision.pr,158);
  assert.equal(decision.artifact,7);assert.deepEqual(decision.diagnostics,[]);
  assert.ok(f.calls.some(p=>p.includes('/pulls?')));
  assert.ok(f.calls.some(p=>p.includes('/git/trees/')));
});

test('partial progress, missing labs/probes and forged execution metadata cannot qualify',()=>{
  const changes=[
    r=>r.executed=false,r=>r.kind='old',r=>r.ref='refs/pull/158/merge',r=>r.repository='other/repo',
    r=>r.workflow='other.yml',r=>r.run='43',r=>r.attempt='1',r=>r.sha='e'.repeat(40),
    r=>r.fingerprint='e'.repeat(64),r=>r.report.status='RUNNING',r=>r.report.status='FAIL',
    r=>r.report.labs.pop(),r=>r.report.labs.push(r.report.labs[0]),r=>r.report.labs.reverse(),
    r=>r.report.labs[0].completed=500,r=>r.report.labs[0].status='RUNNING',
    r=>r.report.labs[0].required=500,r=>r.report.labs[0].digestSHA256='8102ed0cf1a2',
    r=>r.report.labs[0].pixelProbes.pop(),r=>r.report.labs[0].pixelProbes[1].at=500,
    r=>r.report.labs[0].pixelProbes[0].width=0,r=>r.report.requiredCyclesPerLab=999,
    r=>r.report.packageManifestSHA256='f'.repeat(64),r=>r.report.chromium='different',
    r=>r.report.sourceSHA='f'.repeat(40),r=>r.report.group='combat',r=>r.report.seed=1
  ];
  for(const change of changes){
    const f=fixture();change(f.receipt);
    assert.equal(validateExecution(f.receipt,f.run,f.inputs,f.tree),false,String(change));
  }
});

test('any source, environment, lab inventory, seed or cycle-count difference invalidates reuse',()=>{
  const changes=[
    i=>i.packageManifestSHA256='f'.repeat(64),i=>i.harness[0].sha256='f'.repeat(64),
    i=>i.environment.chromium='157',i=>i.environment.node='v23',i=>i.environment.imageVersion='new',
    i=>i.environment.playwright='different',i=>i.environment.renderer='hardware',
    i=>i.plan.seed=2,i=>i.plan.iterations=999,i=>i.plan.labs.reverse(),i=>i.plan.group='combat'
  ];
  for(const change of changes){
    const f=fixture(),current=structuredClone(f.inputs);change(current);
    assert.equal(validateExecution(f.receipt,f.run,current,f.tree),false,String(change));
  }
  const f=fixture(),short=structuredClone(f.inputs);short.plan.iterations=10;
  assert.equal(reportComplete(f.report,short,f.run.head_sha),false);
});

test('PR runs, wrong workflows, failed runs and direct pushes without a merged PR are rejected',async()=>{
  for(const patch of [{event:'pull_request'},{head_branch:'topic'},{conclusion:'failure'},
    {status:'in_progress'},{path:'.github/workflows/other.yml'},{repository:{full_name:'other/repo'}}]){
    const f=fixture();Object.assign(f.run,patch);
    assert.equal(eligibleRun(f.run),false);assert.equal((await findExecution(f)).receipt,undefined);
  }
  for(const change of [p=>p.merged_at=null,p=>p.state='open',p=>p.merge_commit_sha='f'.repeat(40),
    p=>p.base.ref='topic',p=>p.base.repo.full_name='other/repo']){
    const f=fixture();change(f.pr);
    assert.equal(mergedPRForRun(f.pr,f.run),false);
    assert.equal((await findExecution(f)).receipt,undefined);
  }
});

test('missing, expired, foreign, corrupt and wrong-attempt artifacts fail closed to execution',async()=>{
  for(const change of [f=>f.artifact.expired=true,f=>f.artifact.name+='wrong',
    f=>f.artifact.workflow_run.id=43,f=>f.artifact.workflow_run.head_sha='f'.repeat(40),
    f=>f.artifact.workflow_run.head_branch='topic',f=>f.run.run_attempt=3,
    f=>f.unpack=()=>{throw Error('artifact digest mismatch');},f=>f.download=async()=>{throw Error('expired');},
    f=>f.tree.truncated=true,f=>f.tree.tree.pop(),f=>f.tree.tree[0].sha='f'.repeat(40),
    f=>f.tree.tree[0].mode='120000']){
    const f=fixture();change(f);assert.equal((await findExecution(f)).receipt,undefined,String(change));
  }
  const f=fixture();f.api=async()=>{throw Error('GitHub unavailable');};
  assert.equal((await findExecution(f)).receipt,undefined);
});

test('manual full-run and unauthenticated runs never consult cached evidence',async()=>{
  for(const override of [{forceFull:true},{token:undefined}]){
    const f=fixture(),decision=await findExecution({...f,...override});
    assert.equal(decision.receipt,undefined);assert.equal(f.calls.length,0);
  }
});

test('package profile rejects stale manifests and hashes every packaged byte and harness',async()=>{
  const root=await mkdtemp(join(tmpdir(),'endurance-cache-test-'));
  try{
    for(const path of HARNESS){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),path);}
    await mkdir(join(root,'dist'));
    const plan=endurancePlan(['--group=racing']),environment={chromium:'test'};
    async function packageFile(content){
      await writeFile(join(root,'dist/index.html'),content);
      await writeFile(join(root,'dist/manifest.json'),JSON.stringify({files:[{path:'index.html',bytes:content.length,sha256:hash(content)}]}));
    }
    await packageFile('first');const first=await executionInputs(root,plan,environment);
    await writeFile(join(root,'dist/index.html'),'stale');await assert.rejects(executionInputs(root,plan,environment));
    await packageFile('second');const second=await executionInputs(root,plan,environment);
    assert.notEqual(identity(first),identity(second));
    await writeFile(join(root,HARNESS[0]),'changed harness');
    assert.notEqual(identity(second),identity(await executionInputs(root,plan,environment)));
    await writeFile(join(root,'dist/new.js'),'new asset');await assert.rejects(executionInputs(root,plan,environment));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('the pinned harness inventory covers every local import and workflow retains mandatory gates',async()=>{
  for(const path of HARNESS.filter(p=>p.endsWith('.mjs'))){
    const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
    for(const dependency of jsDependencies(source).imports.filter(p=>p.startsWith('.')))
      assert.ok(HARNESS.includes(resolveLocal(path,dependency)),path+' imports unbound '+dependency);
  }
  const workflow=await readFile(new URL('../'+WORKFLOW,import.meta.url),'utf8');
  for(const gate of ['node scripts/check.js','node scripts/build.js','node scripts/verify-offline.js',
    'node scripts/flight-browser-preflight.mjs','--iterations=1000','full_run:',
    "github.ref == 'refs/heads/main' && steps.endurance.outputs.publish == 'true'"])
    assert.ok(workflow.includes(gate),gate);
  assert.doesNotMatch(workflow,/continue-on-error:|restore-keys:/);
});
