// SPDX-License-Identifier: Apache-2.0
// FX-PIPE-001: opt-in packaged WebGL1 output-parity smoke; no native-GPU speed claim.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'../dist');
const destination=resolve(process.argv[2]??'fx-pipe-evidence');
const sha256=v=>createHash('sha256').update(v).digest('hex');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_SHA&&head!==process.env.GITHUB_SHA)throw Error('source checkout mismatch');
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/VANILLAJS/fx-pipe-fixture.html'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end('<!doctype html><title>FX-PIPE-001 browser oracle</title><body></body>');return;
    }
    if(!pathname.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const file=resolve(root,decodeURIComponent(pathname.slice('/VANILLAJS/'.length)));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(file);
    const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html',
      '.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream',
      'Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await mkdir(destination);
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port+'/VANILLAJS/fx-pipe-fixture.html';
let browser,context;
try{
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:900,height:560},deviceScaleFactor:1,
    serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>requests.push(request.url()));
  await page.goto(url,{waitUntil:'load',timeout:25000});
  const result=await page.evaluate(async()=>{
    const {SCALE:Q}=await import('/VANILLAJS/modules/integer-math/index.js');
    const {FxGraphicsPipe}=await import('/VANILLAJS/modules/fx-pipe/index.js');
    const {Renderer}=await import('/VANILLAJS/modules/render-webgl/index.js');
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=420;
    canvas.style.cssText='display:block;width:640px;height:420px';
    document.body.append(canvas);
    const pipe=new FxGraphicsPipe(64*6),renderer=new Renderer(canvas);
    const mesh=renderer.mesh([]);
    const m=[46341,-46341,0,0,46341,46341,0,0,0,0,Q,0];
    const baseline=[];
    for(let i=0;i<64;i++){
      const x=((i%8)-4)*22937,y=((i/8|0)-4)*22937,z=-4*Q,w=18000,h=18000;
      const corners=[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]];
      for(const k of [0,1,2,0,2,3]){
        const p=corners[k];
        for(let a=0;a<3;a++){
          const j=a*4;
          baseline.push((Math.trunc((m[j]*p[0]+m[j+1]*p[1]+m[j+2]*p[2])/Q)+m[j+3])/Q);
        }
        baseline.push(244/255,165/255,72/255);
      }
    }
    const expected=new Float32Array(baseline);
    pipe.setTransform(m);
    for(let i=0;i<64;i++){
      const x=((i%8)-4)*22937,y=((i/8|0)-4)*22937;
      pipe.appendQuadXY(x,y,-4*Q,18000,18000,244,165,72);
    }
    const actual=pipe.view();
    if(actual.length!==expected.length)throw Error('Float32 parity length');
    const aa=new Uint32Array(actual.buffer,actual.byteOffset,actual.length);
    const bb=new Uint32Array(expected.buffer);
    for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])throw Error('Float32 byte mismatch '+i);
    const gl=renderer.gl,info=gl.getExtension('WEBGL_debug_renderer_info');
    function draw(vertices){
      renderer.update(mesh,vertices);
      renderer.begin([0,0,0],[0,0,0,1],{fog:0});
      renderer.draw(mesh);
      const pixels=new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL readPixels error');
      let hash=2166136261,nonBackground=0;
      for(let i=0;i<pixels.length;i+=4){
        hash=Math.imul(hash^pixels[i],16777619);
        hash=Math.imul(hash^pixels[i+1],16777619);
        hash=Math.imul(hash^pixels[i+2],16777619);
        if(pixels[i]+pixels[i+1]+pixels[i+2]>200)nonBackground++;
      }
      return {hash:hash>>>0,nonBackground};
    }
    const candidate=draw(actual),reference=draw(expected);
    if(candidate.hash!==reference.hash||candidate.nonBackground!==reference.nonBackground)
      throw Error('WebGL pixel parity mismatch');
    if(candidate.nonBackground<100)throw Error('No meaningful RGB geometry visible');
    // Shrinking to one triangle must not draw stale sprite tails.
    pipe.resetTransform().reset().appendTriangleXYZRGB(-Q,-Q,-3*Q,Q,-Q,-3*Q,0,Q,-3*Q,255,0,0);
    const shrink=draw(pipe.view());
    if(mesh.count!==3)throw Error('Stale draw count after shrink');
    const report={
      kind:'qsol.vanillajs.fx-pipe-001.webgl.v1',
      webgl:gl.getParameter(gl.VERSION),
      renderer:gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
      viewport:[canvas.width,canvas.height],
      full:{quads:64,vertices:actual.length/6,drawCalls:1,
        float32ByteParity:true,pixelHash:candidate.hash,nonBackground:candidate.nonBackground},
      shrink:{vertices:mesh.count,pixelHash:shrink.hash},
      retainedBytes:pipe.retainedBytes
    };
    renderer.dispose();
    if(renderer.meshes.size!==0)throw Error('Renderer did not dispose buffers');
    return report;
  });
  assert.deepEqual(errors,[]);
  const local='http://127.0.0.1:'+server.address().port+'/VANILLAJS/';
  assert.ok(requests.every(x=>x.startsWith(local)), 'external request');
  await page.screenshot({path:join(destination,'fx-pipe-001.png')});
  const sources={};
  for(const path of ['modules/fx-pipe/index.js','modules/integer-math/index.js',
    'modules/render-webgl/index.js','scripts/fx-pipe-browser.mjs'])
    sources[path]=sha256(await readFile(path));
  const evidence={...result,sourceHead:head,chromium:browser.version(),
    backendRequested:'ANGLE SwiftShader',sourceSHA256:sources,
    scope:'Real packaged WebGL1 submission and readPixels parity; no physical GPU FPS or GC claims',
    localRequests:requests.map(x=>new URL(x).pathname)};
  const raw=JSON.stringify(evidence,null,2)+'\n';
  await writeFile(join(destination,'fx-pipe-001.json'),raw,{flag:'wx'});
  await writeFile(join(destination,'SHA256SUMS'),sha256(raw)+'  fx-pipe-001.json\n',{flag:'wx'});
  console.log('FX-PIPE-001 BROWSER '+JSON.stringify({sourceHead:head,
    float32ByteParity:result.full.float32ByteParity,
    pixelHash:result.full.pixelHash,nonBackground:result.full.nonBackground,
    retainedBytes:result.retainedBytes,sha256:sha256(raw)}));
}finally{
  await context?.close();
  await browser?.close();
  await new Promise(done=>server.close(done));
}
