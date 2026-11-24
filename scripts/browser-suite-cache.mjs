// SPDX-License-Identifier: Apache-2.0
// CI-INVARIANT-001: auditable closures + authenticated immutable execution receipts.
import {readFile,readdir,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {SUITES,selectedChecks,activeShards} from './browser-shards.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {hash,gitBlob,identity,closures,jsDependencies,resolveLocal} from './browser-dependencies.mjs';
import {encodeReceipt} from './browser-receipt-codec.mjs';
import {applyLiveProfile,LIVE_PROFILE} from './browser-cache-profile.mjs';
import {packageProvenance} from './browser-package-provenance.mjs';
import {RECEIPT_KIND,producerAllowed,loadMainExecutions,decide,changedInputs} from './browser-receipt-authority.mjs';
const ROOT=resolve(import.meta.dirname,'..');
export {SUITES};
export const REQUIRED_PASSES=1;
export const PROFILE='CI-INVARIANT-001/1';
const policyPath=join(ROOT,'scripts/browser-reuse-policy.json');
const read=p=>readFile(join(ROOT,p),'utf8');
const record=(path,bytes)=>({path,sha256:hash(bytes),gitBlob:gitBlob(bytes)});
async function inventory(dir,prefix=''){
  const result=[];for(const e of await readdir(dir,{withFileTypes:true})){
    const path=prefix+e.name;if(e.isSymbolicLink())throw Error('symlink in source inventory: '+path);
    if(e.isDirectory())result.push(...await inventory(join(dir,e.name),path+'/'));else result.push(path);
  }return result.sort();
}
export async function profileInputs({environment}={}){
  const policy=applyLiveProfile(await readFile(policyPath,'utf8'),JSON.parse(await read(LIVE_PROFILE)));
  if(Object.keys(policy.suites).join(',')!==SUITES.join(',')||policy.qualification!==REQUIRED_PASSES||!policy.auditedRuntime)throw Error('invalid suite policy');
  const manifest=JSON.parse(await read('dist/manifest.json')),files=manifest.files,sources={},gitBlobs={};
  // Do not trust a stale manifest or omit newly introduced package members.
  const actual=(await inventory(join(ROOT,'dist'))).filter(p=>p!=='manifest.json');
  if(JSON.stringify(actual)!==JSON.stringify(files.map(f=>f.path).sort()))throw Error('package inventory mismatch');
  for(const f of files){
    const bytes=await readFile(join(ROOT,'dist',f.path));if(hash(bytes)!==f.sha256||bytes.length!==f.bytes)throw Error('package digest mismatch: '+f.path);
    sources[f.path]=bytes.toString('utf8');
    if(!['service-worker.js','.nojekyll'].includes(f.path))gitBlobs[f.path]=gitBlob(bytes);
  }
  const extra={gitBlobs,shared:[],tests:{},roots:{},issues:[],suiteIssues:{},manifestVersion:manifest.version,catalogue:JSON.parse(sources['MODULES.json'])};
  for(const path of policy.shared){const bytes=await read(path);extra[path]=bytes;extra.shared.push(record(path,bytes));if(path==='scripts/browser-check.js'&&policy.auditedHarnesses[path]!==hash(bytes))extra.issues.push('unreviewed shared browser dispatcher');}
  // Unknown browser harnesses are not silently excluded, even if not dispatched.
  const registered=new Set(Object.values(policy.suites).flatMap(s=>s.scripts));registered.add('scripts/browser-check.js');
  for(const path of await inventory(join(ROOT,'scripts'),'scripts/'))if(/^scripts\/browser-.*\.[cm]?js$/.test(path)&&!registered.has(path)&&!policy.shared.includes(path)){
    extra.shared.push(record(path,await read(path)));extra.issues.push('unclassified browser harness: '+path);
  }
  for(const paths of Object.values(policy.contracts))for(const path of paths)extra[path]=await read(path);
  for(const group of SUITES){
    const queue=[...policy.suites[group].scripts],seen=new Set(),rows=[],roots=[],issues=[];
    while(queue.length){
      const path=queue.shift();if(seen.has(path))continue;seen.add(path);
      let source;try{source=await read(path);}catch{issues.push('missing harness dependency: '+path);continue;}
      rows.push(record(path,source));
      if(path.startsWith('scripts/')&&policy.auditedHarnesses[path]!==hash(source))issues.push('unreviewed browser harness closure: '+path);
      if(!/\.[cm]?js$/.test(path))continue;
      const deps=jsDependencies(source),opaque=policy.opaqueHarness[path]??policy.opaqueRuntime[path];
      if(opaque&&hash(source)===opaque.sha256)roots.push(...opaque.roots);
      else issues.push(...deps.issues.map(x=>path+': '+x));
      const reviewed=opaque&&hash(source)===opaque.sha256;
      for(const spec of reviewed&&opaque.imports?opaque.imports:deps.imports){
        if(reviewed&&opaque.browserImports?.[spec]){roots.push(opaque.browserImports[spec]);continue;}
        if(spec.startsWith('node:'))continue;
        // Browser absolute dynamic imports are pinned explicit roots above.
        if(spec.startsWith('/VANILLAJS/')&&opaque&&hash(source)===opaque.sha256){roots.push(spec.slice(11));continue;}
        try{const target=resolveLocal(path,spec);queue.push(target);if(files.some(f=>f.path===target))roots.push(target);}catch(e){issues.push(path+': '+e.message);}
      }
    }
    extra.tests[group]=rows.sort((a,b)=>a.path.localeCompare(b.path));extra.roots[group]=roots;extra.suiteIssues[group]=issues;
  }
  let env=environment;
  if(!env){
    try{env=JSON.parse(await readFile(join(process.env.RUNNER_TEMP??'', 'flight-browser-environment.json'),'utf8'));}
    catch{env={node:process.version,platform:process.platform,arch:process.arch,unverified:true};extra.issues.push('pinned real browser preflight environment missing');}
    if(env.node!==process.version||env.platform!==process.platform||env.arch!==process.arch||env.imageVersion!==(process.env.ImageVersion??'local-untrusted'))extra.issues.push('preflight environment mismatch');
  }
  const provenance=await packageProvenance({root:ROOT,files});
  for(const row of provenance.sources)if(!extra.shared.some(existing=>existing.path===row.path))extra.shared.push(row);
  return {files,sources,policy,extra,environment:env,packageProvenance:provenance.metadata};
}
/** The package-provenance gate independently rebuilt and byte-verified every
 * generated namespace. A copy inherits an audited source pin only if its
 * underlying original JS matches exactly. Unknown copies remain unreviewed. */
export function inheritVerifiedCopyAudits(inputs){
  const {policy,files,sources,packageProvenance}=inputs;
  for(const pkg of packageProvenance.packages){
    const prefix='demos/'+pkg.lab+'/runtime-'+pkg.version+'/';
    for(const file of files){
      if(!file.path.startsWith(prefix)||!file.path.endsWith('.js'))continue;
      const original=file.path.slice(prefix.length),source=sources[original],copy=sources[file.path];
      if(typeof source!=='string'||typeof copy!=='string')continue;
      const digest=hash(source);
      if(hash(copy)===digest&&policy.auditedRuntime[original]===digest)
        policy.auditedRuntime[file.path]=digest;
    }
  }
}

export async function sourceProfile(options){
  const inputs=await profileInputs(options);
  inheritVerifiedCopyAudits(inputs);
  const profiles=closures(inputs);
  for(const profile of Object.values(profiles)){profile.inputs.packageProvenance=inputs.packageProvenance;profile.fingerprint=identity(profile.inputs);}
  return {policy:inputs.policy,profiles};
}
export function executionReceipt({repository,ref,event,run,attempt,sha,workflow,authorityDigest},profiles,executed){
  if(!producerAllowed({repository,ref,event})||!/^\d+$/.test(run??'')||!/^\d+$/.test(attempt??'')||!/^[a-f0-9]{40}$/.test(sha??''))throw Error('untrusted execution producer');
  return {kind:RECEIPT_KIND,repository,ref,event,run,attempt,sha,workflow,authorityDigest,
    results:Object.fromEntries(executed.map(g=>[g,{status:'PASS',executed:true,fingerprint:profiles[g].fingerprint,inputs:profiles[g].inputs}]))};
}
// Historical oracle/workload callers keep three runs; live execute() must pass
// the explicit threshold from the validated live profile.
export function executionPlan(profiles,authority,receipts,forceFull=false,qualification=3){
  return Object.fromEntries(SUITES.map(group=>{
    const executions=receipts.filter(r=>r.results[group]).map(r=>({run:r.run,...r.results[group]}));
    const decision=decide({profile:profiles[group],executions,authority,forceFull,qualification});
    const prior=receipts.find(r=>r.results[group]);
    return [group,{...decision,changed:prior?changedInputs(prior.results[group].inputs,profiles[group].inputs):['no prior authenticated execution']}];
  }));
}
async function prepare(){
  const {policy,profiles}=await sourceProfile(),token=process.env.GITHUB_TOKEN;
  const {authority,executions,diagnostics}=token?await loadMainExecutions({token,policy}):{authority:{ok:false,reason:'GitHub token unavailable'},executions:[],diagnostics:[]};
  const plan=executionPlan(profiles,authority,executions,process.env.BROWSER_FORCE_FULL==='true',policy.qualification);
  const stale=SUITES.filter(g=>!plan[g].reuse);
  const temp=process.env.RUNNER_TEMP;if(!temp)throw Error('RUNNER_TEMP required');
  const out=join(temp,'flight-suite-evidence');await mkdir(out,{recursive:true});
  for(const g of SUITES)console.log(`${g}: ${plan[g].reuse?'REUSE':'EXECUTE'} — ${plan[g].reason}; qualifying runs: ${plan[g].runs.join(", ")||"none"}; changed: ${plan[g].changed.join(', ')}`);
  for(const d of diagnostics)console.log('RECEIPT REJECTED: '+d);
  const data={protocol:PROFILE,workflow:policy.workflow,source:runContext(),authority,plan,diagnostics,profiles};
  await writeFile(join(out,'plan.json'),JSON.stringify(data,null,2)+'\n');
  if(process.env.GITHUB_OUTPUT)
    await writeFile(process.env.GITHUB_OUTPUT,'shards='+JSON.stringify(activeShards(stale))+'\n',{flag:'a'});
  return data;
}

function runContext(){
  return {repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,event:process.env.GITHUB_EVENT_NAME,
    run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,sha:process.env.GITHUB_SHA};
}
function staleSuites(data){
  assert.deepEqual(Object.keys(data.plan).sort(),[...SUITES].sort(),'invalid browser plan inventory');
  return SUITES.filter(suite=>{
    const decision=data.plan[suite];
    assert.equal(typeof decision.reuse,'boolean','invalid suite decision');
    if(decision.reuse)assert.ok(data.authority.ok&&decision.runs.length&&!data.profiles[suite].issues.length,'unqualified suite reuse');
    return !decision.reuse;
  });
}
function runChromium(suites,shard,report){
  const args=['scripts/browser-check.js','--suites='+suites.join(',')];
  if(shard)args.push('--shard='+shard);
  const result=spawnSync(process.execPath,args,{cwd:ROOT,env:{...process.env,...(report?{FLIGHT_CHECK_REPORT:report}:{})},stdio:'inherit'});
  if(result.error||result.status!==0)throw Error('Chromium verification failed');
}
async function summarize(data,eligible){
  const {profiles,authority,plan}=data,stale=staleSuites(data);
  const context={...runContext(),workflow:data.workflow,authorityDigest:authority.policyDigest};
  const out=join(process.env.RUNNER_TEMP,'flight-suite-evidence');
  await mkdir(out,{recursive:true});
  if(authority.ok&&producerAllowed(context)&&eligible.length){
    const target=join(out,'execution.json');
    await writeFile(target+'.tmp',JSON.stringify(encodeReceipt(executionReceipt(context,profiles,eligible)))+'\n',{mode:0o600});
    await rename(target+'.tmp',target);
    if(process.env.GITHUB_ENV)await writeFile(process.env.GITHUB_ENV,'BROWSER_PUBLISH_EXECUTION=true\n',{flag:'a'});
  }
  const summary=['## CI-INVARIANT-001 browser decisions','',
    `Executed ${stale.length}; reused ${SUITES.length-stale.length}. Authority: ${authority.reason}`,'',
    ...SUITES.map(g=>`- ${g}: ${plan[g].reuse?'REUSED':'EXECUTED'} — ${plan[g].reason}`),''];
  console.log(summary.join('\n'));
  if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,summary.join('\n'),{flag:'a'});
}
function sameRun(actual,expected){
  for(const field of ['repository','sha','run','ref','event'])assert.equal(actual[field],expected[field],'wrong '+field);
}
function attempt(value){
  assert.match(value,/^[1-9]\d{0,8}$/,'invalid run attempt');
  return Number(value);
}
function checkTransfer(data,digest,context){
  assert.equal(data.protocol,PROFILE);
  assert.match(digest,/^[a-f0-9]{64}$/,'missing verified input digest');
  assert.match(context.sha,/^[a-f0-9]{40}$/);
  assert.match(context.run,/^[1-9]\d*$/);
  sameRun(data.source,context);
  assert.ok(attempt(data.source.attempt)<=attempt(context.attempt),'plan from a future attempt');
}
export function verifiedShards(data,reports,digest,context){
  checkTransfer(data,digest,context);
  const stale=staleSuites(data),expected=activeShards(stale);
  assert.deepEqual(reports.map(r=>r.shard).sort(),[...expected].sort(),'incomplete or duplicate browser shard');
  const eligible=new Set(stale.filter(g=>!data.profiles[g].issues.length));
  for(const report of reports){
    sameRun(report.source,context);
    assert.ok(attempt(report.source.attempt)>=attempt(data.source.attempt)&&attempt(report.source.attempt)<=attempt(context.attempt),'invalid worker attempt');
    assert.equal(report.inputSHA256,digest,'worker used different package or plan');
    assert.match(report.environment,/^[a-f0-9]{64}$/);
    const checks=selectedChecks(stale,report.shard);
    assert.deepEqual(report.passed.map(row=>row.id),checks.map(check=>check.id),'missing, duplicate or misassigned browser check');
    assert.ok(report.passed.every(row=>Number.isSafeInteger(row.ms)&&row.ms>=0),'invalid check duration');
    for(const {suite} of checks){
      // A successful earlier attempt can finish verification. Only freshly observed
      // checks in this attempt and exact preflight environment can mint a new PASS.
      if(report.source.attempt!==context.attempt||report.environment!==identity(data.profiles[suite].inputs.environment))
        eligible.delete(suite);
    }
  }
  return [...eligible];
}
async function worker(shard){
  const data=JSON.parse(await read('plan.json')),context=runContext(),digest=process.env.FLIGHT_INPUT_SHA256;
  checkTransfer(data,digest,context);
  const stale=staleSuites(data),checks=selectedChecks(stale,shard);
  assert.ok(shard&&checks.length,'worker has no assignment');
  const temp=process.env.RUNNER_TEMP;
  const environment=identity(JSON.parse(await readFile(join(temp,'flight-browser-environment.json'),'utf8')));
  const report=join(temp,'flight-passed-'+shard+'.json');
  runChromium(stale,shard,report);
  const passed=JSON.parse(await readFile(report,'utf8'));
  assert.deepEqual(passed.map(row=>row.id),checks.map(check=>check.id));
  await writeFile(join(ROOT,'browser-artifacts','checks.json'),JSON.stringify({shard,source:context,inputSHA256:digest,environment,passed})+'\n',{flag:'wx'});
}
async function finish(){
  const data=JSON.parse(await read('plan.json')),reports=[];
  const prefix='flight-shard-'+data.source.attempt+'-';
  const shards=activeShards(staleSuites(data));
  if(shards.length){
    const folders=await readdir(join(ROOT,'browser-artifacts'));
    assert.deepEqual(folders.sort(),shards.map(shard=>prefix+shard).sort(),'unexpected shard artifacts');
    for(const shard of shards)reports.push(JSON.parse(await read('browser-artifacts/'+prefix+shard+'/checks.json')));
  }
  const eligible=verifiedShards(data,reports,process.env.FLIGHT_INPUT_SHA256,runContext());
  if(reports.length)console.log('Verified '+reports.reduce((n,r)=>n+r.passed.length,0)+' browser checks across '+reports.length+' workers');
  await summarize(data,eligible);
}
async function main(){
  switch(process.argv[2]){
  case 'plan': console.log(JSON.stringify((await sourceProfile()).profiles,null,2));break;
  case 'prepare': await prepare();break;
  case 'worker': await worker(process.argv[3]);break;
  case 'finish': await finish();break;
  case 'execute': {
    const data=await prepare(),stale=staleSuites(data);
    if(stale.length)runChromium(stale);
    await summarize(data,stale.filter(g=>!data.profiles[g].issues.length));
    break;
  }
  default: throw Error('usage: browser-suite-cache.mjs plan|prepare|worker NAME|finish|execute');
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.stack);process.exitCode=1;});
