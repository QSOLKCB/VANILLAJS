// SPDX-License-Identifier: Apache-2.0
// Owner-dispatched only, physically headed RTX 5060 Ti inspection.
// Canvas2D timings are application/CPU/compositor observations, not GPU compute.
// This is NEVER an automatic GitHub push/PR action.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {existsSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,extname,relative,sep} from 'node:path';
import {findPlaywright} from './rtx-playwright.mjs';

const ROOT=resolve(import.meta.dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function cmd(command,args){
  const r=spawnSync(command,args,{cwd:ROOT,encoding:'utf8',timeout:30000});
  if(r.error||r.status!==0)
    throw Error(command+' failed: '+(r.stderr||r.error?.message||r.status));
  return r.stdout.trim();
}
function args(){
  const found={};
  for(let i=2;i<process.argv.length;i++){
    const key=process.argv[i];
    if(key==='--help'){console.log('Usage: node scripts/rtx5060ti-2d.mjs --expected-head 40hex --out /absolute/fresh/report.json');process.exit(0);}
    if(!['--expected-head','--out','--source-evidence'].includes(key)||!process.argv[i+1])
      throw Error('unknown or incomplete RTX2D argument');
    found[key.slice(2)]=process.argv[++i];
  }
  if(!/^[a-f0-9]{40}$/.test(found['expected-head']??'')||
    !found.out?.startsWith('/')||!found['source-evidence']?.startsWith('/'))
    throw Error('expected exact main, absolute output and public source evidence paths');
  return found;
}
function browserExecutable(){
  for(const name of ['google-chrome-stable','google-chrome','chromium','chromium-browser']){
    const r=spawnSync('which',[name],{encoding:'utf8',timeout:5000});
    if(r.status===0&&r.stdout.trim())return realpathSync(r.stdout.trim());
  }
  throw Error('Native Chrome/Chromium executable required');
}
function server(){
  const root=realpathSync(resolve(ROOT,'dist'));
  return createServer((req,res)=>{
    try{
      const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=resolve(root,'.'+name),rel=relative(root,target);
      if(!rel||rel==='..'||rel.startsWith('..'+sep)||rel.startsWith('/'))
        throw Error('unsafe file path');
      const actual=realpathSync(target),sub=relative(root,actual);
      if(sub==='..'||sub.startsWith('..'+sep)||sub.startsWith('/'))
        throw Error('symlink escape');
      const bytes=readFileSync(actual);
      const type={'.js':'text/javascript','.html':'text/html','.css':'text/css',
        '.json':'application/json'}[extname(actual)]||'application/octet-stream';
      res.setHeader('Content-Type',type);res.setHeader('Cache-Control','no-store');res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
}
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
async function main(){
  const o=args(),head=cmd('git',['rev-parse','HEAD']);
  if(cmd('git',['branch','--show-current'])!=='main'||head!==o['expected-head'])
    throw Error('Exact reviewed main required');
  if(cmd('git',['status','--porcelain']))
    throw Error('dirty checkout; refuse physical evidence');
  if(!/(?:github\.com[:/])QSOLKCB\/VANILLAJS(?:\.git)?$/i.test(cmd('git',['remote','get-url','origin'])))
    throw Error('unexpected Git origin');
  if(!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)
    throw Error('visible desktop required, no Xvfb/headless fallback');
  const nvidia=cmd('nvidia-smi',['--query-gpu=name,driver_version,memory.total','--format=csv,noheader,nounits']);
  const cards=nvidia.split(/\r?\n/).filter(s=>/RTX\s*5060\s*Ti/i.test(s));
  if(cards.length!==1)throw Error('exactly one RTX 5060 Ti required');
  const sourceBytes=readFileSync(o['source-evidence']);
  if(sourceBytes.length>65536||sourceBytes.length===0)
    throw Error('bounded source evidence required');
  const source=JSON.parse(sourceBytes);
  if(source.strict?.kind!=='qsol.vanillajs.lab2d.evidence.v1')
    throw Error('wrong evidence schema');
  if(existsSync(o.out))throw Error('refuse overwrite of existing RTX2D report');
  const chrome=browserExecutable(),{chromium,version:playwright}=findPlaywright();
  const srv=server();let browser;
  try{
    await new Promise((ok,fail)=>{srv.once('error',fail);srv.listen(0,'127.0.0.1',ok);});
    const base='http://127.0.0.1:'+srv.address().port;
    browser=await chromium.launch({executablePath:chrome,headless:false,
      args:['--disable-background-networking','--no-first-run']});
    const page=await browser.newPage({viewport:{width:1280,height:950}});
    await page.route('**/*',route=>{
      if(route.request().url().startsWith(base+'/'))return route.continue();
      throw Error('external browser request refused');
    });
    await page.goto(base+'/demos/2d-lab/index.html');
    await page.bringToFront();
    await page.waitForFunction(()=>document.documentElement.dataset.labReady==='ready');
    const identity=await page.evaluate(()=>{
      const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl');
      if(!gl)throw Error('RTX native WebGL identity unavailable');
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      if(!ext)throw Error('native renderer fingerprint unavailable');
      return {vendor:gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
        renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)};
    });
    assert.match(identity.vendor,/NVIDIA/i);
    assert.match(identity.renderer,/RTX\s*5060\s*Ti/i);
    assert.doesNotMatch(identity.renderer,/swiftshader|software|llvmpipe|lavapipe/i);
    const browserChecks=await page.evaluate(async()=>{
      const canvas=document.querySelector('#lab-canvas');
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
      let bright=0;for(let i=0;i<data.data.length;i+=4)
        if(data.data[i]+data.data[i+1]+data.data[i+2]>135)bright++;
      if(bright<500)throw Error('blank 2D lab canvas');
      const hash=async arr=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',arr)),
        x=>x.toString(16).padStart(2,'0')).join('');
      const pixelHash=await hash(data.data);
      const stamps=[];
      await new Promise(resolve=>{
        let count=0,last=null;
        const next=now=>{
          if(last!==null)stamps.push(now-last);
          last=now;if(++count===96)resolve();else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      });
      const sorted=[...stamps].sort((a,b)=>a-b);
      return {brightPixels:bright,pixelSHA256:pixelHash,
        frameIntervalsMs:stamps,p95FrameIntervalMs:sorted[Math.ceil(sorted.length*.95)-1],
        sampleCount:stamps.length,rendererMode:'Canvas2D'};
    });
    const paired=await page.evaluate(async()=>{
      const {FrameGate}=await import('/modules/frame-gate/index.js');
      const context=document.createElement('canvas');
      context.width=256;context.height=256;
      const ctx=context.getContext('2d',{willReadFrequently:true});
      const hash=async()=>Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,256,256).data)),
        b=>b.toString(16).padStart(2,'0')).join('');
      const run=async reuse=>{
        const gate=new FrameGate();let drawn=0;
        const draw=()=>{
          ctx.fillStyle='#092028';ctx.fillRect(0,0,256,256);
          for(let y=0;y<16;y++)for(let x=0;x<16;x++){
            ctx.fillStyle=(x+y)%3===0?'#83dbc4':'#21354a';
            ctx.fillRect(x*16,y*16,15,15);
          }
          drawn++;
        };
        const start=performance.now();
        for(let i=0;i<240;i++)if(reuse){
          gate.present({key:'idle',width:256,height:256},draw);
        }else draw();
        const ms=performance.now()-start;
        return {ms,drawn,pixels:await hash(),
          stats:reuse?gate.stats():null};
      };
      // Both strategies run on identical fixed bytes and same Canvas2D context.
      const values={forced:[],retained:[]};
      for(let warm=0;warm<2;warm++){await run(false);await run(true);}
      for(let pair=0;pair<7;pair++){
        for(const name of (pair%2?['retained','forced']:['forced','retained']))
          values[name].push(await run(name==='retained'));
      }
      for(let i=0;i<7;i++){
        if(values.forced[i].pixels!==values.retained[i].pixels||
           values.forced[i].drawn!==240||values.retained[i].drawn!==1)
          throw Error('OPT FrameGate workload parity/skip mismatch at '+i);
      }
      return values;
    });
    const report={schemaVersion:1,kind:'qsol.vanillajs.rtx5060ti.2d-foundry.native.v1',
      status:'PASS',candidateSha:head,sourceEvidenceSHA256:sha(sourceBytes),
      sourceStrictSHA256:source.strictSHA256,
      playwright,chromeVersion:cmd(chrome,['--version']),nvidiaInventory:cards[0],
      nativeWebGLIdentity:identity,canvas2D:browserChecks,
      comparison:{
        protocol:{warmups:2,pairs:7,framesPerTrial:240,
          reuse:'FrameGate identical presentation key',timingGate:false},
        forced:{medianMs:median(paired.forced.map(x=>x.ms)),samples:paired.forced},
        retained:{medianMs:median(paired.retained.map(x=>x.ms)),samples:paired.retained}
      },limitations:[
        'Native RTX identity is established through an independent WebGL context, not proof that Canvas2D drawing runs on RTX compute.',
        'Canvas2D timing includes CPU, browser/compositor and driver overhead; not GPU timestamp queries or game FPS.',
        'Paired static draw workload is an environment-scoped OPT example, not a claim all 2D games are faster.',
        'Audio PCM identity and ternary arrays are CPU-only; no quantum hardware or audio-device identity.'
      ]};
    writeFileSync(o.out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('PASS: owner RTX 5060 Ti verified, 2D lab visible, 7 frame-gate pairs and pixel parity');
  }finally{
    if(browser)await browser.close().catch(()=>{});
    await new Promise(done=>srv.close(done));
  }
}
main().catch(e=>{console.error('RTX2D FAIL: '+e.message);process.exitCode=1;});
