// SPDX-License-Identifier: Apache-2.0
// Owner-only headed RTX experiment, executed ONLY after review/merge to main.
// Old RTX5060TI-001 is verified separately; these are NEW paired workloads.
import {spawnSync} from 'node:child_process';
import {readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,relative,extname,sep} from 'node:path';
import {findPlaywright} from './rtx-playwright.mjs';

const ROOT=resolve(import.meta.dirname,'..');
function cmd(program,args){
  const r=spawnSync(program,args,{cwd:ROOT,encoding:'utf8',timeout:30000});
  if(r.error||r.status!==0)throw Error(program+' failed: '+(r.stderr||r.error?.message||r.status));
  return r.stdout.trim();
}
function options(){
  const out={};
  for(let i=2;i<process.argv.length;i++){
    const arg=process.argv[i];
    if(arg==='--help'){
      console.log('node scripts/rtx5060ti-adaptive-browser.mjs --expected-head SHA --out /absolute/output.json');
      console.log('Requires reviewed clean main, native headed RTX 5060 Ti, Chrome, pinned Playwright and dist build.');
      process.exit(0);
    }
    if(!['--expected-head','--out'].includes(arg)||!process.argv[i+1])
      throw Error('Unknown/incomplete argument '+arg);
    out[arg.slice(2)]=process.argv[++i];
  }
  if(!/^[0-9a-f]{40}$/.test(out['expected-head']??'')||
    !out.out||!out.out.startsWith('/'))
    throw Error('Expected 40hex source SHA and absolute output path');
  return out;
}
function chrome(){
  for(const name of ['google-chrome-stable','google-chrome','chromium','chromium-browser']){
    const r=spawnSync('which',[name],{encoding:'utf8',timeout:5000});
    if(r.status===0&&r.stdout.trim())return realpathSync(r.stdout.trim());
  }
  throw Error('No installed Chrome/Chromium executable');
}
function serve(){
  const root=realpathSync(resolve(ROOT,'dist'));
  const server=createServer((req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/__qsol_native__'){
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end('<!doctype html><meta charset="utf-8"><canvas id="gpu" width="384" height="256" style="width:384px;height:256px;display:block"></canvas>');
        return;
      }
      const target=resolve(root,'.'+decodeURIComponent(url.pathname));
      const rel=relative(root,target);
      if(!rel||rel==='..'||rel.startsWith('..'+sep)||rel.startsWith('/'))
        throw Error('outside');
      const real=realpathSync(target),actual=relative(root,real);
      if(actual==='..'||actual.startsWith('..'+sep)||actual.startsWith('/'))
        throw Error('symlink outside');
      const data=readFileSync(real);
      res.setHeader('Content-Type',extname(real)==='.js'?'text/javascript':'application/octet-stream');
      res.setHeader('Cache-Control','no-store');
      res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
  return server;
}
async function run(){
  const o=options();
  if(cmd('git',['branch','--show-current'])!=='main')throw Error('Reviewed main branch required');
  if(cmd('git',['rev-parse','HEAD'])!==o['expected-head'])throw Error('Source SHA mismatch');
  if(cmd('git',['status','--porcelain']))throw Error('Dirty checkout');
  if(!/(?:github\.com[:/])QSOLKCB\/VANILLAJS(?:\.git)?$/i.test(cmd('git',['remote','get-url','origin'])))
    throw Error('Unexpected origin remote');
  if(!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)throw Error('Headed desktop required');
  const inventory=cmd('nvidia-smi',['--query-gpu=name,driver_version','--format=csv,noheader,nounits']);
  const cards=inventory.split(/\r?\n/).filter(x=>/RTX\s*5060\s*Ti/i.test(x));
  if(cards.length!==1)throw Error('Expected exactly one RTX 5060 Ti');
  const {chromium,version:playwrightVersion}=findPlaywright(),exe=chrome();
  const server=serve();
  let browser;
  try{
    await new Promise((accept,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',accept);
    });
    const local='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({executablePath:exe,headless:false,
      args:['--disable-background-networking','--no-first-run']});
    const page=await browser.newPage({viewport:{width:1024,height:768}});
    await page.route('**/*',route=>{
      if(route.request().url().startsWith(local+'/'))return route.continue();
      throw Error('External request prohibited: '+route.request().url());
    });
    await page.goto(local+'/__qsol_native__');
    await page.bringToFront();
    const result=await page.evaluate(async()=>{
      const {AdaptiveCircleQueries}=await import('/modules/adaptive-circles/index.js');
      const {CuboidStream}=await import('/modules/cuboid-stream/index.js');
      const {nextRandom}=await import('/modules/integer-math/index.js');
      const {boxVertices}=await import('/modules/render-webgl/index.js');
      const {perspective,viewMatrix,multiplyMatrices}=await import('/modules/math/index.js');
      const {WebGLAPI}=await import('/api/webgl/index.js');
      const identity=()=>{
        const gl=document.getElementById('gpu').getContext('webgl',{antialias:true,alpha:false});
        if(!gl)throw Error('WebGL1 unavailable');
        const ext=gl.getExtension('WEBGL_debug_renderer_info');
        if(!ext)throw Error('Native GPU identity extension unavailable');
        const vendor=gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        const renderer=gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if(!/NVIDIA/i.test(vendor)||!/RTX\s*5060\s*Ti/i.test(renderer)||
           /swiftshader|llvmpipe|lavapipe|software/i.test(renderer))
          throw Error('Native RTX 5060 Ti identity failed');
        return {vendor,renderer};
      };
      const native=identity();
      const focusFailures=[];
      const checkFocus=()=>{
        if(document.hidden||!document.hasFocus()||focusFailures.length)
          throw Error('Browser was hidden, blurred or unfocused');
      };
      addEventListener('blur',()=>focusFailures.push('blur'));
      addEventListener('pagehide',()=>focusFailures.push('pagehide'));
      document.addEventListener('visibilitychange',()=>{if(document.hidden)focusFailures.push('hidden');});
      checkFocus();
      const hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
        b=>b.toString(16).padStart(2,'0')).join('');
      const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
      const fixture=count=>{
        let seed=83+count;
        const next=()=>{seed=nextRandom(seed);return seed/4294967296;};
        const circles=Array.from({length:count},(_,i)=>({
          id:i+1,x:(next()-.5)*3000,y:(next()-.5)*3000,radius:5+next()*12
        }));
        const queries=Array.from({length:250},(_,i)=>({
          origin:[(next()-.5)*2800,(next()-.5)*2800],
          displacement:[(next()-.5)*450,(next()-.5)*450],
          ignoreIds:i%13===0?[1,2]:[]
        }));
        return {circles,queries};
      };
      const runCircle=(f,mode)=>{
        checkFocus();
        const t=performance.now();
        const threshold=mode==='brute'?16384:mode==='grid'?1:32;
        const query=new AdaptiveCircleQueries(f.circles,{cellSize:128,gridMin:threshold});
        let tested=0,grid=0;const hits=[];
        for(const q of f.queries){
          const result=query.castSegment(q.origin,q.displacement,{ignoreIds:q.ignoreIds});
          tested+=result.tested;grid+=Number(result.mode==='grid');
          hits.push(result.hit&&[result.hit.id,result.hit.index,result.hit.time]);
        }
        const elapsed=performance.now()-t;
        return {ms:elapsed,tested,grid,hits};
      };
      const circles=[];
      for(const count of [14,26,58,128]){
        const f=fixture(count),samples={brute:[],grid:[],adaptive:[]};
        for(let k=0;k<2;k++)for(const mode of ['brute','grid','adaptive'])runCircle(f,mode);
        for(let k=0;k<7;k++){
          for(const mode of (k%2?['adaptive','grid','brute']:['brute','grid','adaptive']))
            samples[mode].push(runCircle(f,mode));
        }
        const reference=JSON.stringify(samples.brute[0].hits);
        for(const s of Object.values(samples))for(const trial of s){
          if(JSON.stringify(trial.hits)!==reference)
            throw Error('Circle narrowphase parity failure count '+count);
        }
        const digest=await hex(new TextEncoder().encode(reference));
        circles.push({count,queries:f.queries.length,paritySha256:digest,
          strategies:Object.fromEntries(Object.entries(samples).map(([mode,s])=>[mode,{
            samplesMs:s.map(x=>x.ms),medianMs:median(s.map(x=>x.ms)),
            candidatesTested:s[0].tested,gridQueries:s[0].grid
          }]))});
      }
      // A conservative prototype geometry workload. No shader, asset or
      // simulation changes; identical API context, vertices, view and frames.
      const canvas=document.getElementById('gpu'),vp=multiplyMatrices(
        perspective(Math.PI/2.6,canvas.width/canvas.height),
        viewMatrix([0,1.5,7],[0,0,0,1])
      );
      const build=(count,tick,offset)=>{
        const stream=new CuboidStream({capacity:count});
        for(let i=0;i<count;i++)stream.box(
          (i%12)*.6-3.3+offset,
          .5+(i%4)*.25+Math.sin((tick+i)*.17)*.035,
          -3-Math.floor(i/12)*.9,
          .42,.35,.55,
          [.2+(i%5)*.08,.3+(i%4)*.06,.6],0,0
        );
        const packed=stream.view(),out=[];
        for(let i=0;i<packed.length;i+=12)
          boxVertices([packed[i],packed[i+1],packed[i+2]],
            [packed[i+3],packed[i+4],packed[i+5]],
            [packed[i+6],packed[i+7],packed[i+8]],out);
        return new Float32Array(out);
      };
      const pixels=async gl=>{
        gl.finish();
        const data=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
        if(gl.getError()!==gl.NO_ERROR)throw Error('readPixels failed');
        let bright=0;
        for(let i=0;i<data.length;i+=4)
          if(data[i]+data[i+1]+data[i+2]>105)bright++;
        if(bright<50)throw Error('Empty native GPU scene');
        return {sha256:await hex(data),brightPixels:bright};
      };
      const runGPU=async mode=>{
        checkFocus();
        const api=new WebGLAPI(canvas);
        let staticMesh=null,dynamicMesh=null,builds=0;
        const count=32; // Complete 32-frame draw/upload workload per trial.
        const t=performance.now();
        for(let frame=0;frame<count;frame++){
          if(mode==='fresh'){
            if(staticMesh)api.deleteMesh(staticMesh);
            if(dynamicMesh)api.deleteMesh(dynamicMesh);
            staticMesh=api.createMesh(build(64,0,0));builds++;
            dynamicMesh=api.createMesh(build(8,frame,.15));builds++;
          }else{
            if(!staticMesh){staticMesh=api.createMesh(build(64,0,0));builds++;}
            if(!dynamicMesh){dynamicMesh=api.createMesh(build(8,frame,.15));builds++;}
            else{api.updateMesh(dynamicMesh,build(8,frame,.15));builds++;}
          }
          api.beginFrame({vp,fog:.003,pointSize:1});
          api.draw(staticMesh);api.draw(dynamicMesh);api.endFrame();
          api.gl.finish();
        }
        const measuredMs=performance.now()-t;
        const image=await pixels(api.gl);
        const stats=api.stats();
        api.dispose();
        checkFocus();
        return {ms:measuredMs,builds,stats,image,frames:count};
      };
      const gpu={fresh:[],retained:[]};
      for(let k=0;k<2;k++)for(const mode of ['fresh','retained'])await runGPU(mode);
      for(let k=0;k<7;k++){
        checkFocus();
        for(const mode of (k%2?['retained','fresh']:['fresh','retained']))
          gpu[mode].push(await runGPU(mode));
      }
      for(let i=0;i<7;i++){
        if(gpu.fresh[i].image.sha256!==gpu.retained[i].image.sha256)
          throw Error('Native WebGL pixels differ between fresh and retained frame '+i);
      }
      return {
        native,
        protocol:{warmupPairs:2,measuredPairs:7,circleQueries:250,
          gpuFramesPerTrial:32,execution:'one headed Chromium renderer; no workers',
          timingGate:false},
        circles,
        gpu:{
          pixelParitySha256:gpu.fresh[0].image.sha256,
          fresh:{samples:gpu.fresh,medianMs:median(gpu.fresh.map(x=>x.ms))},
          retained:{samples:gpu.retained,medianMs:median(gpu.retained.map(x=>x.ms))}
        },
        status:'PASS'
      };
    });
    if(!result?.native?.renderer||result.status!=='PASS')throw Error('Invalid native benchmark result');
    const report={schemaVersion:1,kind:'qsol.vanillajs.rtx5060ti.new-workloads.v1',
      sourceSha:o['expected-head'],timeUtc:new Date().toISOString(),
      chrome:cmd(exe,['--version']),playwright:playwrightVersion,
      nvidiaSmi:cards[0],...result,
      limitations:['New workloads have no historical RTX5060TI-001 equivalent',
        'Fenced native browser comparisons are fresh vs retained on the same current source',
        'gl.finish timings include CPU/driver/compositor costs; not GPU timer queries',
        'No guarantee of cross-driver bit-exactness or hardware cryptographic attestation']};
    writeFileSync(o.out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('PASS: native RTX adaptive circles and fresh/retained WebGL pixel parity');
    console.log('New GPU sample file: '+o.out);
  }finally{
    if(browser)await browser.close().catch(()=>{});
    await new Promise(done=>server.close(done));
  }
}
run().catch(err=>{console.error('RTX NEW WORKLOAD FAILED: '+err.stack);process.exitCode=1;});
