// SPDX-License-Identifier: Apache-2.0
// Explicitly activated, local headed RTX 5060 Ti evidence. No cloud dependency.
// Never run unreviewed pull_request code on a self-hosted workstation.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {existsSync,readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,readdirSync,realpathSync} from 'node:fs';
import {tmpdir,homedir,hostname,platform,release,arch,cpus} from 'node:os';
import {resolve,join,sep,dirname} from 'node:path';
import {runBrowserProbe} from './rtx5060ti-browser.mjs';
import {findPlaywright} from './rtx-playwright.mjs';

const DEFAULT_BASELINE='1f965f4e5b6669de0f954e3a39b11aa679e56720';
const ALLOWED_BASELINES=new Set([
  DEFAULT_BASELINE,
  '240617e8bc1a935f05eaf75a10531f194f72a173', // RTX5060TI-001 candidate
  'b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f', // RTX5060TI-002 candidate
  '3f5518a168652a003e8db9aa6dc0371ddb4782ea' // RTX5060TI-003 candidate
]);
const root=resolve(import.meta.dirname,'..'),checkHex=x=>/^[0-9a-f]{40}$/.test(x);
const sum=bytes=>createHash('sha256').update(bytes).digest('hex');
const cmd=(program,args,{cwd=root,timeout=120000,env=process.env}={})=>{
  const result=spawnSync(program,args,{cwd,timeout,env,encoding:'utf8',maxBuffer:2*1024*1024});
  if(result.error||result.status!==0)throw new Error(program+' '+args.join(' ')+' failed: '+(result.stderr||result.error?.message||result.status));
  return result.stdout.trim();
};
const git=(...args)=>cmd('git',args);
function parse(){
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){
    const a=args[i];
    if(a==='--help'||a==='-h'){
      console.log('node scripts/rtx5060ti-trusted.mjs [--chrome /absolute/path] [--out /outside/repo] [--expected-head 40hex] [--baseline 40hex-allowlisted]');
      console.log('Requires a clean reviewed checkout, full Git history, a visible desktop, native RTX 5060 Ti WebGL, nvidia-smi and locally installed Playwright.');
      process.exit(0);
    }
    if(!['--chrome','--out','--expected-head','--baseline'].includes(a)||!args[i+1])throw Error('Unknown or incomplete option: '+a);
    options[a.slice(2)]=args[++i];
  }
  return options;
}
const findProgram=names=>{
  for(const name of names){
    const found=spawnSync('which',[name],{encoding:'utf8'});
    if(found.status===0&&found.stdout.trim())return realpathSync(found.stdout.trim());
  }
  throw new Error('No system Chrome/Chromium executable found. Supply --chrome /absolute/path');
};
const hardware=()=>{
  const raw=cmd('nvidia-smi',['--query-gpu=name,driver_version,memory.total','--format=csv,noheader,nounits']);
  const matches=raw.split(/\r?\n/).filter(x=>/RTX\s*5060\s*Ti/i.test(x));
  if(matches.length!==1)throw Error('Expected exactly one NVIDIA RTX 5060 Ti; observed '+JSON.stringify(raw));
  return {verifiedModel:matches[0].split(',')[0].trim(),driverVersion:matches[0].split(',')[1]?.trim(),
    memoryMiB:Number(matches[0].split(',')[2]?.trim()),inventory:raw.split(/\r?\n/)};
};
const safeOut=(path)=>{
  const output=resolve(path);
  if(output===root||output.startsWith(root+sep))throw Error('Evidence output must be outside repository');
  if(existsSync(output)&&readdirSync(output).length)throw Error('Evidence output directory is not empty: '+output);
  mkdirSync(output,{recursive:true,mode:0o700});return output;
};
const serve=(baselineRoot,candidateRoot)=>{
  const {createServer}=require('node:http');
  const {readFile}=require('node:fs/promises');
  const {extname,relative}=require('node:path');
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+
    '<canvas id="gpu" style="display:block;width:384px;height:256px"></canvas></body></html>';
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/__qsol_gpu_harness__'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
      const match=/^\/(baseline|candidate)\/(.+)$/.exec(decodeURIComponent(url.pathname));
      if(!match){res.writeHead(404);res.end();return;}
      const targetRoot=match[1]==='baseline'?baselineRoot:candidateRoot;
      const target=resolve(targetRoot,match[2]),rel=relative(targetRoot,target);
      if(!rel||rel==='..'||rel.startsWith('..'+sep)||rel.startsWith('/')){res.writeHead(403);res.end();return;}
      // Reject symlinks escaping the immutable packaged checkout.
      const actual=realpathSync(target);
      const actualRel=relative(targetRoot,actual);
      if(actualRel==='..'||actualRel.startsWith('..'+sep)||actualRel.startsWith('/')){res.writeHead(403);res.end();return;}
      const data=await readFile(actual);
      const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'};
      res.setHeader('Content-Type',mime[extname(actual)]||'application/octet-stream');
      res.setHeader('Cache-Control','no-store');
      res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
  return server;
};
const require=createRequire(import.meta.url);
async function main(){
  const options=parse();
  const baseline=options.baseline??DEFAULT_BASELINE;
  if(!ALLOWED_BASELINES.has(baseline))throw Error('Baseline is not one of the pinned reviewed source commits');
  if(!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)throw Error('Headed GPU validation requires a visible X11/Wayland desktop; no Xvfb or headless fallback');
  const branch=git('branch','--show-current');
  if(branch!=='main')throw Error('Trusted GPU validation requires a reviewed local main checkout; found '+(branch||'detached HEAD'));
  if(git('status','--porcelain'))throw Error('Checkout has uncommitted or untracked files; use a clean reviewed main');
  const remote=git('remote','get-url','origin');
  if(!/(?:github\.com[:/])QSOLKCB\/VANILLAJS(?:\.git)?$/i.test(remote))throw Error('Unexpected Git remote for VANILLAJS: '+remote);
  const head=git('rev-parse','HEAD');
  if(!checkHex(head))throw Error('Invalid candidate commit');
  if(options['expected-head']&&options['expected-head']!==head)throw Error('Expected SHA differs from checkout HEAD');
  if(git('cat-file','-t',baseline)!=='commit')throw Error('Pinned baseline commit is not locally available; fetch full history explicitly');
  git('merge-base','--is-ancestor',baseline,head);
  const gpu=hardware();
  const chrome=options.chrome?realpathSync(resolve(options.chrome)):
    findProgram(['google-chrome-stable','google-chrome','chromium','chromium-browser']);
  const chromeVersion=cmd(chrome,['--version'],{timeout:30000});
  const {chromium,version:playwrightVersion,location:playwrightLocation}=findPlaywright();
  console.log('Playwright local tooling: '+playwrightVersion+' ('+playwrightLocation+')');
  const defaultRoot=process.env.XDG_STATE_HOME||join(homedir(),'.local','state');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const output=safeOut(options.out||join(defaultRoot,'qsol','vanillajs','rtx5060ti',stamp));
  const temp=mkdtempSync(join(tmpdir(),'qsol-rtx5060ti-'));
  const worktrees=[];
  let server,browser;
  try{
    const a=join(temp,'baseline'),b=join(temp,'candidate');
    for(const [dir,sha] of [[a,baseline],[b,head]]){
      git('worktree','add','--detach','--',dir,sha);worktrees.push(dir);
      if(git('-C',dir,'rev-parse','HEAD')!==sha)throw Error('Worktree SHA mismatch');
      // Use exactly the build script from each pinned checkout, no dependencies.
      cmd(process.execPath,['scripts/build.js'],{cwd:dir,timeout:90000,env:{
        PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',TMPDIR:temp
      }});
    }
    server=serve(join(a,'dist'),join(b,'dist'));
    await new Promise((accept,reject)=>{
      server.once('error',reject);server.listen(0,'127.0.0.1',accept);
    });
    const local='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({executablePath:chrome,headless:false,
      args:['--disable-background-networking','--no-first-run']});
    const proof=await runBrowserProbe(browser,local);
    const report={
      schemaVersion:1,kind:'qsol.vanillajs.rtx5060ti.trusted-comparison.v1',
      baseline:{sha:baseline,tree:git('-C',a,'rev-parse','HEAD^{tree}'),
        manifestSha256:sum(readFileSync(join(a,'dist','manifest.json')))},
      candidate:{sha:head,tree:git('-C',b,'rev-parse','HEAD^{tree}'),
        manifestSha256:sum(readFileSync(join(b,'dist','manifest.json')))},
      environment:{timeUtc:new Date().toISOString(),hostnameSha256:sum(hostname()),
        os:{platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model},
        node:process.version,chromeVersion,playwright:playwrightVersion,
        gpu,nativeWebGL:proof.nativeRenderer},
      comparison:proof,
      trustBoundary:{
        source:'reviewed main exact HEAD and pinned pre-optimization ancestor; clean checkout',
        browser:'headed hardware WebGL1 verified; software rendering rejected; network requests restricted to local server',
        limitations:['No cryptographic hardware attestation','No GPU telemetry proof beyond NVIDIA driver and WebGL reported identities',
          'JS heap allocation sampling is statistical','Clock, CPU frequency, thermals and OS compositor can affect timings',
          'No assumption of cross-driver or cross-browser bit-exactness']
      }
    };
    const receipt=JSON.stringify(report,null,2)+'\n';
    writeFileSync(join(output,'report.json'),receipt,{mode:0o600});
    const simple=(name)=>report.comparison.summary[name];
    const lines=[
      '# VANILLAJS — local RTX 5060 Ti full-path validation',
      '',
      'Baseline: '+baseline,
      'Candidate: '+head,
      'Native WebGL: '+proof.nativeRenderer.renderer,
      'NVIDIA driver: '+gpu.driverVersion,
      '',
      '| Metric | Baseline median | Candidate median | Scope |',
      '| --- | ---: | ---: | --- |',
      ...[
        ['CPU static geometry preparation','geometryPrepMs','ms'],
        ['CPU static collision queries, index-build included','staticCollisionMs','ms'],
        ['Actual FPS Lab JS callback','fpsCallbackMedianMs','ms'],
        ['Actual FPS Lab frame interval p95','fpsFrameIntervalP95Ms','ms'],
        ['FPS Lab GPU upload submitted bytes','fpsUploadBytes','bytes'],
        ['FPS Lab draw calls','fpsDrawCalls','calls']
      ].map(([name,key,unit])=>'| '+name+' | '+simple('baseline')[key].medianMs.toFixed(3)+
        ' | '+simple('candidate')[key].medianMs.toFixed(3)+' | '+unit+' per recorded trial |'),
      '',
      'Native pixel parity: PASS on three deterministic GPU scenes.',
      'CPU geometry and canonical collision receipt hashes: PASS across seven paired trials.',
      '',
      'Memory: CDP *statistical sampled allocation* baseline '+proof.memory.baseline.sampledAllocationBytes+
        ' bytes, candidate '+proof.memory.candidate.sampledAllocationBytes+' bytes; NOT exact process allocation.',
      '',
      'Full raw samples and instrument limitations are in report.json.',
      'This file is an observation receipt, not a release/merge gate or independent hardware attestation.',
      ''
    ];
    writeFileSync(join(output,'SUMMARY.md'),lines.join('\n'),{mode:0o600});
    const checks=['report.json','SUMMARY.md'].map(file=>sum(readFileSync(join(output,file)))+'  '+file).join('\n')+'\n';
    writeFileSync(join(output,'SHA256SUMS'),checks,{mode:0o600});
    console.log('PASS: RTX 5060 Ti headed native WebGL, exact geometry, casts and pixel parity');
    console.log('Baseline '+baseline+' vs candidate '+head);
    console.log('Evidence directory: '+output);
    console.log(lines.join('\n'));
  }catch(error){
    // Fail closed: incomplete comparisons cannot leave a success-looking receipt.
    try{
      for(const file of ['report.json','SUMMARY.md','SHA256SUMS'])
        rmSync(join(output,file),{force:true});
      const failure={schemaVersion:1,kind:'qsol.vanillajs.rtx5060ti.failed.v1',
        status:'FAILED',timeUtc:new Date().toISOString(),baselineSha:baseline,
        candidateSha:head,nvidiaGpu:gpu,chromeVersion,
        error:{name:error?.name??'Error',message:error?.message??String(error)},
        note:'Partial or failed execution is not a validated performance result.'};
      const bytes=JSON.stringify(failure,null,2)+'\n';
      writeFileSync(join(output,'FAILURE.json'),bytes,{mode:0o600});
      writeFileSync(join(output,'SHA256SUMS'),sum(Buffer.from(bytes))+'  FAILURE.json\n',{mode:0o600});
      console.error('FAILED receipt retained in '+output);
    }catch(receiptError){
      console.error('Could not persist failure receipt: '+receiptError.message);
    }
    throw error;
  }finally{
    if(browser)await browser.close().catch(()=>{});
    if(server)await new Promise(done=>server.close(done));
    for(const dir of worktrees.reverse()){
      try{git('worktree','remove','--force','--',dir);}catch(err){console.error('Worktree cleanup failed: '+err.message);}
    }
    rmSync(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error('TRUSTED GPU VALIDATION FAILED: '+error.stack);process.exitCode=1;});
