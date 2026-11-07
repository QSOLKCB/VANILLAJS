// SPDX-License-Identifier: Apache-2.0
// Owner-only headed RTX 5060 Ti workload. Not imported by games or hosted CI.
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
    if(process.argv[i]==='--help'){
      console.log('node scripts/rtx5060ti-frame-gate.mjs --expected-head 40hex --out /absolute/path.json');
      process.exit(0);
    }
    if(!['--expected-head','--out'].includes(process.argv[i])||!process.argv[i+1])
      throw Error('Invalid/incomplete option '+process.argv[i]);
    out[process.argv[i++].slice(2)]=process.argv[i];
  }
  if(!/^[0-9a-f]{40}$/.test(out['expected-head']??'')||
     !out.out?.startsWith('/'))throw Error('Exact head and absolute output required');
  return out;
}
function browserExecutable(){
  for(const name of ['google-chrome-stable','google-chrome','chromium','chromium-browser']){
    const r=spawnSync('which',[name],{encoding:'utf8',timeout:5000});
    if(r.status===0&&r.stdout.trim())return realpathSync(r.stdout.trim());
  }
  throw Error('Native Chrome/Chromium executable required');
}
function serve(){
  const root=realpathSync(resolve(ROOT,'dist'));
  return createServer((req,res)=>{
    try{
      const path=new URL(req.url,'http://127.0.0.1').pathname;
      if(path==='/__qsol_frame_gate__'){
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end('<!doctype html><meta charset="utf-8"><title>QSOL RTX frame gate</title><canvas id="gpu" width="384" height="256"></canvas>');
        return;
      }
      const resolved=resolve(root,'.'+decodeURIComponent(path));
      const rel=relative(root,resolved);
      if(!rel||rel==='..'||rel.startsWith('..'+sep)||rel.startsWith('/'))throw Error('outside');
      const real=realpathSync(resolved),actual=relative(root,real);
      if(actual==='..'||actual.startsWith('..'+sep)||actual.startsWith('/'))throw Error('symlink escape');
      const bytes=readFileSync(real);
      res.setHeader('Content-Type',extname(real)==='.js'?'text/javascript':'application/octet-stream');
      res.setHeader('Cache-Control','no-store');res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
}
async function main(){
  const o=options(),head=cmd('git',['rev-parse','HEAD']);
  if(cmd('git',['branch','--show-current'])!=='main'||head!==o['expected-head'])
    throw Error('Exact reviewed main required');
  if(cmd('git',['status','--porcelain']))throw Error('Dirty checkout');
  if(!/(?:github\.com[:/])QSOLKCB\/VANILLAJS(?:\.git)?$/i.test(
     cmd('git',['remote','get-url','origin'])))throw Error('Unexpected origin');
  if(!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)
    throw Error('Visible desktop required; no headless fallback');
  const inventory=cmd('nvidia-smi',['--query-gpu=name,driver_version','--format=csv,noheader,nounits']);
  const cards=inventory.split(/\r?\n/).filter(x=>/RTX\s*5060\s*Ti/i.test(x));
  if(cards.length!==1)throw Error('Exactly one RTX 5060 Ti required');
  const executable=browserExecutable(),{chromium,version:playwright}=findPlaywright();
  const server=serve();let browser;
  try{
    await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
    const base='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({executablePath:executable,headless:false,
      args:['--disable-background-networking','--no-first-run']});
    const page=await browser.newPage({viewport:{width:1024,height:768}});
    await page.route('**/*',route=>{
      if(route.request().url().startsWith(base+'/'))return route.continue();
      throw Error('External request refused '+route.request().url());
    });
    await page.goto(base+'/__qsol_frame_gate__');await page.bringToFront();
    const data=await page.evaluate(async()=>{
      const {WebGLAPI}=await import('/api/webgl/index.js');
      const {FrameGate}=await import('/modules/frame-gate/index.js');
      const canvas=document.getElementById('gpu'),gl=canvas.getContext('webgl');
      if(!gl)throw Error('WebGL1 required');
      const debug=gl.getExtension('WEBGL_debug_renderer_info');
      if(!debug)throw Error('GPU identity extension required');
      const vendor=gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
        renderer=gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
      if(!/NVIDIA/i.test(vendor)||!/RTX\s*5060\s*Ti/i.test(renderer)||
         /swiftshader|software|lavapipe|llvmpipe/i.test(renderer))
        throw Error('Native RTX identity verification failed');
      const blocked=[];const checkFocus=()=>{
        if(document.hidden||!document.hasFocus()||blocked.length)
          throw Error('Unfocused/hidden native browser sample');
      };
      window.addEventListener('blur',()=>blocked.push('blur'));
      window.addEventListener('pagehide',()=>blocked.push('pagehide'));
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden)blocked.push('hidden');
      });
      const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
        b=>b.toString(16).padStart(2,'0')).join('');
      const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
      const verts=revision=>{
        const x=revision%5*.05-.10;
        return new Float32Array([
          -.65+x,-.6,0,.98,.3,.18,
           .65+x,-.6,0,.18,.92,.52,
           0+x,.65,0,.15,.4,.98
        ]);
      };
      const readPixels=async()=>{
        gl.finish();
        const pixels=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        if(gl.getError()!==gl.NO_ERROR)throw Error('pixel readback failed');
        let bright=0;
        for(let i=0;i<pixels.length;i+=4)
          if(pixels[i]+pixels[i+1]+pixels[i+2]>125)bright++;
        if(bright<100)throw Error('Native drawing was empty');
        return await hash(pixels);
      };
      const run=async mode=>{
        checkFocus();
        const api=new WebGLAPI(canvas),mesh=api.createMesh(verts(0)),gate=new FrameGate();
        const samples=[];let epoch=0;
        const t=performance.now();
        for(let frame=0;frame<48;frame++){
          // Eight infrequent scene changes plus a final mandatory update.
          const revision=frame===47?8:Math.floor(frame/6);
          if(revision!==epoch){epoch=revision;api.updateMesh(mesh,verts(epoch));}
          const draw=()=>{
            api.beginFrame({vp:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),fog:0,pointSize:1});
            api.draw(mesh);api.endFrame();gl.finish();
          };
          if(mode==='forced')draw();
          else gate.present({key:epoch,width:canvas.width,height:canvas.height},draw);
          if(frame%6===0||frame===47){
            checkFocus();
            samples.push(await readPixels());
          }
        }
        const ms=performance.now()-t,stats=api.stats(),skipped=gate.stats();
        api.dispose();
        checkFocus();
        return {ms,frames:48,pixels:samples,drawCalls:stats.drawCalls,
          clears:stats.clearCalls,uploadedBytes:stats.uploadedBytes,
          skipped:skipped.skipped,actualDrawn:mode==='forced'?48:skipped.drawn};
      };
      const trials={forced:[],gated:[]};
      for(let i=0;i<2;i++)for(const mode of ['forced','gated'])await run(mode);
      for(let pair=0;pair<7;pair++){
        for(const mode of (pair%2?['gated','forced']:['forced','gated']))
          trials[mode].push(await run(mode));
      }
      for(let i=0;i<7;i++){
        const a=trials.forced[i],b=trials.gated[i];
        if(JSON.stringify(a.pixels)!==JSON.stringify(b.pixels))
          throw Error('Native pixel parity diverged in pair '+i);
        if(a.actualDrawn!==48||b.actualDrawn!==9||b.skipped!==39)
          throw Error('Unexpected draw/skipped count in pair '+i);
      }
      return {
        status:'PASS',native:{vendor,renderer},
        protocol:{warmupPairs:2,measuredPairs:7,framesPerTrial:48,
          snapshotsPerTrial:9,execution:'one visible Chromium renderer; synchronous gl.finish + readPixels',
          timingGate:false,gpuTimerQuery:false},
        paritySha256:await hash(new TextEncoder().encode(JSON.stringify(trials.forced[0].pixels))),
        strategies:Object.fromEntries(Object.entries(trials).map(([name,rows])=>[name,{
          medianMs:median(rows.map(x=>x.ms)),samples:rows
        }]))
      };
    });
    if(data.status!=='PASS'||!data.native?.renderer)throw Error('Incomplete native result');
    const report={schemaVersion:1,kind:'qsol.vanillajs.arcade-frame-gate.native.v1',
      sourceSha:head,timeUtc:new Date().toISOString(),playwright,
      chrome:cmd(executable,['--version']),nvidiaSmi:cards[0],...data,
      limitations:[
        'Forced and gated render on current source only; neither archived receipt measured this workload.',
        'Timing includes readPixels, CPU, driver and gl.finish; not a GPU-only timer query.',
        'No presentation vsync, frame-interval or native game FPS measurement.',
        'Full-frame pixel parity is checked on rendered checkpoints, not every skipped composited frame.'
      ]};
    writeFileSync(o.out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('PASS native RTX frame-gate comparisons: exact checkpoint pixels, 7 paired trials');
  }finally{
    if(browser)await browser.close().catch(()=>{});
    await new Promise(done=>server.close(done));
  }
}
main().catch(err=>{console.error('RTX FRAME GATE FAILED: '+err.stack);process.exitCode=1;});
