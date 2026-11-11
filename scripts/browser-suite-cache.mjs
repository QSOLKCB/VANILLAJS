// SPDX-License-Identifier: Apache-2.0
// CI-INVARIANT-001: auditable closures + authenticated immutable execution receipts.
import {readFile,readdir,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {hash,gitBlob,identity,closures,jsDependencies,resolveLocal} from './browser-dependencies.mjs';
import {RECEIPT_KIND,producerAllowed,loadMainExecutions,decide,changedInputs} from './browser-receipt-authority.mjs';
const ROOT=resolve(import.meta.dirname,'..');
export const SUITES=Object.freeze(['home','render','play','worlds','research','donor','editor']);
export const REQUIRED_PASSES=3;
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
  const policy=JSON.parse(await readFile(policyPath,'utf8'));
  if(Object.keys(policy.suites).join(',')!==SUITES.join(',')||policy.qualification!==3||!policy.auditedRuntime)throw Error('invalid suite policy');
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
      for(const spec of deps.imports){
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
  return {files,sources,policy,extra,environment:env};
}
export async function sourceProfile(options){const inputs=await profileInputs(options);return {policy:inputs.policy,profiles:closures(inputs)};}
export function executionReceipt({repository,ref,event,run,attempt,sha,workflow,authorityDigest},profiles,executed){
  if(!producerAllowed({repository,ref,event})||!/^\d+$/.test(run??'')||!/^\d+$/.test(attempt??'')||!/^[a-f0-9]{40}$/.test(sha??''))throw Error('untrusted execution producer');
  return {kind:RECEIPT_KIND,repository,ref,event,run,attempt,sha,workflow,authorityDigest,
    results:Object.fromEntries(executed.map(g=>[g,{status:'PASS',executed:true,fingerprint:profiles[g].fingerprint,inputs:profiles[g].inputs}]))};
}
export function executionPlan(profiles,authority,receipts,forceFull=false){
  return Object.fromEntries(SUITES.map(group=>{
    const executions=receipts.filter(r=>r.results[group]).map(r=>({run:r.run,...r.results[group]}));
    const decision=decide({profile:profiles[group],executions,authority,forceFull});
    const prior=receipts.find(r=>r.results[group]);
    return [group,{...decision,changed:prior?changedInputs(prior.results[group].inputs,profiles[group].inputs):['no prior authenticated execution']}];
  }));
}
async function execute(){
  const {policy,profiles}=await sourceProfile(),token=process.env.GITHUB_TOKEN;
  const {authority,executions,diagnostics}=token?await loadMainExecutions({token,policy}):{authority:{ok:false,reason:'GitHub token unavailable'},executions:[],diagnostics:[]};
  const plan=executionPlan(profiles,authority,executions,process.env.BROWSER_FORCE_FULL==='true');
  const stale=SUITES.filter(g=>!plan[g].reuse),reused=SUITES.filter(g=>plan[g].reuse);
  const temp=process.env.RUNNER_TEMP;if(!temp)throw Error('RUNNER_TEMP required');
  const out=join(temp,'flight-suite-evidence');await mkdir(out,{recursive:true});
  for(const g of SUITES)console.log(`${g}: ${plan[g].reuse?'REUSE':'EXECUTE'} — ${plan[g].reason}; qualifying runs: ${plan[g].runs.join(", ")||"none"}; changed: ${plan[g].changed.join(', ')}`);
  for(const d of diagnostics)console.log('RECEIPT REJECTED: '+d);
  await writeFile(join(out,'plan.json'),JSON.stringify({protocol:PROFILE,authority,plan,diagnostics,profiles},null,2)+'\n');
  if(stale.length){
    const result=spawnSync(process.execPath,['scripts/browser-check.js','--suites='+stale.join(',')],{cwd:ROOT,env:process.env,stdio:'inherit'});
    if(result.error||result.status!==0)throw Error('Chromium verification failed; no execution receipt published');
  }
  const context={repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,event:process.env.GITHUB_EVENT_NAME,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,sha:process.env.GITHUB_SHA,workflow:policy.workflow,authorityDigest:authority.policyDigest};
  // Local/PR executions never become trusted artifacts. Unknown analysis cannot
  // seed a future PASS, even if the current browser run happens to succeed.
  const eligible=stale.filter(g=>!profiles[g].issues.length);
  if(authority.ok&&producerAllowed(context)&&eligible.length){
    const target=join(out,'execution.json');await writeFile(target+'.tmp',JSON.stringify(executionReceipt(context,profiles,eligible))+'\n',{mode:0o600});await rename(target+'.tmp',target);
    if(process.env.GITHUB_ENV)await writeFile(process.env.GITHUB_ENV,'BROWSER_PUBLISH_EXECUTION=true\n',{flag:'a'});
  }
  const summary=['## CI-INVARIANT-001 browser decisions','',`Executed ${stale.length}; reused ${reused.length}. Authority: ${authority.reason}`,'',...SUITES.map(g=>`- ${g}: ${plan[g].reuse?'REUSED':'EXECUTED'} — ${plan[g].reason}`),'','Node, source, build, package, archival and preflight gates are never reused.',''];
  console.log(summary.join('\n'));if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,summary.join('\n'),{flag:'a'});
}
async function main(){
  if(process.argv[2]==='plan'){const {profiles}=await sourceProfile();console.log(JSON.stringify(profiles,null,2));}
  else if(process.argv[2]==='execute')await execute();else throw Error('usage: browser-suite-cache.mjs plan|execute');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.stack);process.exitCode=1;});
