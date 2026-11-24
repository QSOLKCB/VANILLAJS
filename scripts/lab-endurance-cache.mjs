// SPDX-License-Identifier: Apache-2.0
// OPT-INV-001: reuse complete observations only when every execution input matches.
// Authority is an immutable successful main run tied to a merged PR, never a PR cache.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {hash,gitBlob,identity} from './browser-dependencies.mjs';
import {githubJSON,downloadArtifact,unpackArtifact,producerAllowed} from './browser-receipt-authority.mjs';
import {endurancePlan} from './lab-endurance-plan.mjs';

const ROOT=resolve(import.meta.dirname,'..');
export const REPOSITORY='QSOLKCB/VANILLAJS';
export const WORKFLOW='.github/workflows/lab-endurance.yml';
export const KIND='qsol.vanillajs.lab-endurance-execution.v1';
// All local imports of these harnesses are covered; the closure is regression-tested.
export const HARNESS=Object.freeze([
  WORKFLOW,'scripts/lab-endurance-cache.mjs','scripts/lab-endurance.mjs',
  'scripts/lab-endurance-plan.mjs','scripts/flight-browser-preflight.mjs',
  'scripts/browser-dependencies.mjs','scripts/browser-receipt-authority.mjs',
  'scripts/browser-receipt-codec.mjs','scripts/browser-package-provenance.mjs',
  'scripts/pursuit-package.mjs'
].sort());
const sha256=/^[a-f0-9]{64}$/;
export const artifactName=(group,run,attempt)=>`lab-endurance-main-${group}-${run}-${attempt}`;

async function inventory(root,prefix=''){
  const files=[];
  for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){
    const path=prefix+entry.name;
    assert.ok(!entry.isSymbolicLink(),'symlink in endurance package');
    if(entry.isDirectory())files.push(...await inventory(root,path+'/'));
    else files.push(path);
  }
  return files.sort();
}
export async function executionInputs(root,plan,environment){
  const bytes=await readFile(join(root,'dist/manifest.json')),manifest=JSON.parse(bytes);
  const actual=(await inventory(join(root,'dist'))).filter(p=>p!=='manifest.json');
  assert.deepEqual(actual,manifest.files.map(f=>f.path).sort(),'endurance package inventory changed');
  for(const f of manifest.files){
    const content=await readFile(join(root,'dist',f.path));
    assert.equal(hash(content),f.sha256,'endurance package digest: '+f.path);
    assert.equal(content.length,f.bytes,'endurance package size: '+f.path);
  }
  const harness=await Promise.all(HARNESS.map(async path=>{
    const bytes=await readFile(join(root,path));return {path,sha256:hash(bytes),gitBlob:gitBlob(bytes)};
  }));
  // Hash the entire verified package. No dependency inference can miss dynamic
  // imports, generated runtime namespaces, styles, assets or newly added files.
  return {schema:1,plan,packageManifestSHA256:hash(bytes),harness,environment};
}
export function reportComplete(report,inputs,sourceSHA){
  try{
    const {plan}=inputs;
    assert.equal(plan.iterations,1000,'only full endurance executions qualify');
    assert.equal(report.kind,'qsol.vanillajs.lab-endurance.v1');
    assert.equal(report.status,'PASS');assert.equal(report.sourceSHA,sourceSHA);
    assert.equal(report.group,plan.group);assert.equal(report.seed,plan.seed);
    assert.equal(report.requiredCyclesPerLab,plan.iterations);
    assert.equal(report.packageManifestSHA256,inputs.packageManifestSHA256);
    assert.equal(report.chromium,inputs.environment.chromium);
    assert.deepEqual(report.labs.map(l=>l.lab),plan.labs);
    for(const lab of report.labs){
      assert.equal(lab.status,'PASS');assert.equal(lab.required,plan.iterations);
      assert.equal(lab.completed,plan.iterations);assert.match(lab.digestSHA256,sha256);
      assert.deepEqual(lab.pixelProbes.map(p=>p.at),[1,plan.iterations]);
      assert.ok(lab.pixelProbes.every(p=>p.width>0&&p.height>0));
    }
    return true;
  }catch{return false;}
}
export function eligibleRun(run){
  return run?.repository?.full_name===REPOSITORY&&run.head_branch==='main'&&
    ['push','workflow_dispatch'].includes(run.event)&&run.path===WORKFLOW&&
    run.status==='completed'&&run.conclusion==='success'&&/^[a-f0-9]{40}$/.test(run.head_sha);
}
export function mergedPRForRun(pr,run){
  return Number.isSafeInteger(pr?.number)&&pr.number>0&&pr.state==='closed'&&Boolean(pr.merged_at)&&
    pr.merge_commit_sha===run.head_sha&&pr.base?.ref==='main'&&pr.base?.repo?.full_name===REPOSITORY;
}
export function validateExecution(receipt,run,inputs,tree){
  try{
    assert.ok(eligibleRun(run));assert.equal(receipt.kind,KIND);assert.equal(receipt.executed,true);
    assert.equal(receipt.repository,REPOSITORY);assert.equal(receipt.workflow,WORKFLOW);
    assert.equal(receipt.ref,'refs/heads/main');assert.equal(receipt.event,run.event);
    assert.equal(receipt.run,String(run.id));assert.equal(receipt.attempt,String(run.run_attempt));
    assert.equal(receipt.sha,run.head_sha);
    assert.equal(receipt.fingerprint,identity(inputs));assert.deepEqual(receipt.inputs,inputs);
    assert.ok(reportComplete(receipt.report,inputs,run.head_sha),'incomplete execution');
    assert.equal(tree.truncated,false);
    const files=new Map(tree.tree.filter(f=>f.type==='blob'&&f.mode==='100644').map(f=>[f.path,f.sha]));
    for(const file of inputs.harness)assert.equal(files.get(file.path),file.gitBlob,'producer harness source mismatch');
    return true;
  }catch{return false;}
}
export async function findExecution({inputs,forceFull=false,token,
  api=path=>githubJSON(path,token),download=id=>downloadArtifact(id,token),unpack=unpackArtifact}={}){
  const diagnostics=[];
  if(forceFull)return {reason:'manual full-run override',diagnostics};
  if(!token)return {reason:'GitHub authentication unavailable',diagnostics};
  try{
    const list=await api(`repos/${REPOSITORY}/actions/workflows/lab-endurance.yml/runs?branch=main&status=success&per_page=30`);
    for(const run of list.workflow_runs??[]){
      if(!eligibleRun(run))continue;
      try{
        const artifacts=await api(`repos/${REPOSITORY}/actions/runs/${run.id}/artifacts?per_page=100`);
        const name=artifactName(inputs.plan.group,run.id,run.run_attempt);
        const matches=(artifacts.artifacts??[]).filter(a=>a.name===name&&!a.expired);
        if(matches.length!==1)continue;
        const artifact=matches[0];
        assert.equal(artifact.workflow_run?.id,run.id);assert.equal(artifact.workflow_run?.head_sha,run.head_sha);
        assert.equal(artifact.workflow_run?.head_branch,'main');
        const receipt=unpack(await download(artifact.id),artifact.digest);
        if(receipt.fingerprint!==identity(inputs))continue;
        const prs=await api(`repos/${REPOSITORY}/commits/${run.head_sha}/pulls?per_page=100`);
        const pr=prs.find(pr=>mergedPRForRun(pr,run));
        assert.ok(pr,'producer main commit is not tied to a merged PR');
        const commit=await api(`repos/${REPOSITORY}/git/commits/${run.head_sha}`);
        const tree=await api(`repos/${REPOSITORY}/git/trees/${commit.tree.sha}?recursive=1`);
        assert.ok(validateExecution(receipt,run,inputs,tree),'execution/source binding rejected');
        return {receipt,pr:pr.number,artifact:artifact.id,reason:'exact inputs match a successful main run tied to merged PR #'+pr.number,diagnostics};
      }catch(error){diagnostics.push(String(run.id)+': '+error.message);}
    }
    return {reason:'no complete authenticated main execution matches every input',diagnostics};
  }catch(error){return {reason:'evidence lookup unavailable: '+error.message,diagnostics};}
}
async function summary(text){
  console.log(text);
  if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,text+'\n',{flag:'a'});
}
async function main(){
  const plan=endurancePlan(process.argv.slice(2));
  const temp=process.env.RUNNER_TEMP;
  assert.ok(temp,'RUNNER_TEMP required for verified browser environment');
  const environment=JSON.parse(await readFile(join(temp,'flight-browser-environment.json'),'utf8'));
  assert.equal(environment.node,process.version);assert.equal(environment.platform,process.platform);
  assert.equal(environment.arch,process.arch);assert.equal(environment.imageVersion,process.env.ImageVersion??'local-untrusted');
  assert.equal(environment.playwright,'1.64.0');assert.match(environment.browserManifestSHA256,sha256);
  const inputs=await executionInputs(ROOT,plan,environment);
  const decision=await findExecution({inputs,token:process.env.GITHUB_TOKEN,
    forceFull:process.env.LAB_ENDURANCE_FORCE_FULL==='true'});
  for(const reason of decision.diagnostics)console.log('ENDURANCE RECEIPT REJECTED: '+reason);
  const out=join(ROOT,'browser-artifacts/lab-endurance');await mkdir(out,{recursive:true});
  if(decision.receipt){
    const {receipt}=decision,url=`https://github.com/${REPOSITORY}/actions/runs/${receipt.run}`;
    // Preserve the original report unchanged; explicitly distinguish inference
    // here from the browser cycles actually executed in the producer run.
    await writeFile(join(out,plan.group+'-reuse.json'),JSON.stringify({status:'REUSED',executed:false,
      reason:decision.reason,producerURL:url,mergedPR:decision.pr,artifact:decision.artifact,receipt},null,2)+'\n');
    await summary(`Endurance ${plan.group}: REUSED; 0 new cycles. ${decision.reason}. [Original execution](${url}).\n`+
      receipt.report.labs.map(l=>`- ${l.lab}: ${l.completed} original cycles; SHA-256 \`${l.digestSHA256}\``).join('\n'));
    return;
  }
  console.log('Endurance '+plan.group+': EXECUTE — '+decision.reason);
  // Never pass the read-only GitHub token to the browser runner.
  const {GITHUB_TOKEN:unused,...env}=process.env;
  const result=spawnSync(process.execPath,['scripts/lab-endurance.mjs',...process.argv.slice(2)],{cwd:ROOT,env,stdio:'inherit'});
  if(result.error||result.status!==0)throw Error('Endurance browser execution failed');
  const report=JSON.parse(await readFile(join(out,plan.group+'.json'),'utf8'));
  assert.ok(reportComplete(report,inputs,process.env.GITHUB_SHA??null),'incomplete endurance report');
  await summary(`Endurance ${plan.group}: EXECUTED ${plan.labs.length} labs × ${plan.iterations} browser cycles; ${decision.reason}.`);
  const source={repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,event:process.env.GITHUB_EVENT_NAME};
  if(producerAllowed(source)){
    assert.match(process.env.GITHUB_SHA,/^[a-f0-9]{40}$/);
    assert.match(process.env.GITHUB_RUN_ID,/^[1-9]\d*$/);assert.match(process.env.GITHUB_RUN_ATTEMPT,/^[1-9]\d*$/);
    const receipt={kind:KIND,executed:true,...source,workflow:WORKFLOW,run:process.env.GITHUB_RUN_ID,
      attempt:process.env.GITHUB_RUN_ATTEMPT,sha:process.env.GITHUB_SHA,fingerprint:identity(inputs),inputs,report};
    const folder=join(temp,'lab-endurance-execution',plan.group);await mkdir(folder,{recursive:true});
    await writeFile(join(folder,'execution.json'),JSON.stringify(receipt)+'\n');
    if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,'publish=true\n',{flag:'a'});
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.stack);process.exitCode=1;});
