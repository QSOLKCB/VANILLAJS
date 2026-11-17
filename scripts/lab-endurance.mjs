// SPDX-License-Identifier: Apache-2.0
// Headless, genuine browser-endurance cycles over built /VANILLAJS/ pages.
// Playwright is pinned in isolated CI tooling, never added as a game dependency.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {endurancePlan,iterationSeed} from './lab-endurance-plan.mjs';

const plan=endurancePlan(process.argv.slice(2));
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'../dist'),out=resolve(import.meta.dirname,'../browser-artifacts/lab-endurance');
const paths=Object.freeze({
  horizon:'demos/horizon-lab/index.html',
  racing:'demos/racing-lab/index.html',
  'block-arena':'demos/block-arena-lab/index.html',
  'weapon-feel':'demos/weapon-feel-lab/index.html',
  'sprite-foundry':'demos/sprite-foundry/index.html',
  'game-maker':'demos/game-maker-lab/index.html',
  'narrative-foundry':'demos/narrative-foundry/index.html',
  demoscene:'demos/demoscene-lab/index.html'
});
const ready=Object.freeze({
  horizon:['labReady','horizon-race'],
  racing:['racingReady','ready'],
  'block-arena':['labReady','block-arena'],
  'weapon-feel':['labReady','weapon-feel'],
  'sprite-foundry':['labReady','sprite-foundry'],
  'game-maker':['labReady','game-maker-lab'],
  'narrative-foundry':['labReady','narrative-foundry'],
  demoscene:['labReady','demoscene']
});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const uri=new URL(req.url,'http://127.0.0.1');
    const pathname=decodeURIComponent(uri.pathname),prefix='/VANILLAJS/';
    if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
    const target=resolve(root,pathname.slice(prefix.length)||'index.html');
    if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(target);
    res.setHeader('Content-Type',mime[extname(target)]??'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end();}
});
const recordPath=join(out,plan.group+'.json');
async function save(record){
  await mkdir(out,{recursive:true});
  const temp=recordPath+'.tmp';
  await writeFile(temp,JSON.stringify(record,null,2)+'\n','utf8');
  await rename(temp,recordPath);
}
function check(v,reason){if(!v)throw Error(reason);}
async function realGameplaySample(lab,page){
  if(lab==='horizon'){
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now()+1000));
    await page.locator('#race-start').click();
    await page.keyboard.down('KeyW');
    await page.clock.runFor(4300); // real countdown and native player/rival simulation
    await page.keyboard.up('KeyW');
    const s=await page.evaluate(()=>__horizonRace.snapshot());
    assert.ok(s.ticks>400&&Math.hypot(...s.player.velocity)>1,'HORIZON must physically accelerate');
    await page.locator('#race-pause').click();
    await page.locator('#race-restart').click();
    return {physicalTicks:s.ticks,gear:s.player.gear,velocity:s.player.velocity};
  }
  if(lab==='racing'){
    await page.locator('#launch').click();
    await page.keyboard.down('w');
    await page.waitForFunction(()=>parseFloat(document.querySelector('#speed')?.textContent)>10,null,{timeout:20000});
    await page.keyboard.up('w');
    const speed=await page.locator('#speed').textContent();
    await page.locator('#pause').click();
    assert.equal(await page.locator('#status').textContent(),'PAUSED');
    return {speed};
  }
  if(lab==='game-maker'){
    await page.locator('#play').click();
    await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.tick>2);
    const tick=await page.evaluate(()=>__gameMakerLab.snapshot().player.state.tick);
    await page.locator('#pause').click();
    await page.locator('#restart').click();
    return {physicalTicks:tick};
  }
  if(lab==='block-arena'){
    await page.locator('#run').click();
    await page.waitForFunction(()=>blockArena.snapshot().tick>3);
    const tick=await page.evaluate(()=>blockArena.snapshot().tick);
    await page.locator('#pause').click();
    return {combatTicks:tick};
  }
  if(lab==='weapon-feel'){
    await page.locator('#run').click();
    await page.waitForFunction(()=>weaponFeelLab.snapshot().timer.tick>2);
    const tick=await page.evaluate(()=>weaponFeelLab.snapshot().timer.tick);
    await page.locator('#pause').click();
    return {rangeTicks:tick};
  }
  return {nativePageReady:true};
}
async function oneCycle(page,lab,index,seed){
  return page.evaluate(async ({lab,index,seed})=>{
    const $=id=>document.getElementById(id);
    const fail=m=>{throw Error(lab+' iteration '+index+': '+m);};
    const click=id=>{const el=$(id);if(!el||el.disabled)fail('missing/disabled #'+id);el.click();};
    let state,tag;
    if(lab==='horizon'){
      click('race-restart');state=__horizonRace.snapshot();
      if(state.phase!=='ready'||state.progress.checkpointIndex!==0||state.player.gear!==1)
        fail('race restart did not restore native ready state');
      if(index%100===0){
        const original=state.courseAssist;click('race-assist');
        if(__horizonRace.snapshot().courseAssist===original)fail('assist toggle ignored');
        click('race-assist');
      }
      click('race-start');if(!__horizonRace.snapshot().running)fail('race did not start');
      click('race-pause');state=__horizonRace.snapshot();
      if(state.running||state.player.needsRecovery)fail('race did not pause cleanly');
      tag='ready/'+state.player.gear+'/'+state.progress.checkpointIndex;
    }else if(lab==='racing'){
      if(index%125===0){
        const modes=['retro','tour','circuit','sprint','derby','ball','stunt'];
        const mode=modes[(index/125)%modes.length];
        const button=document.querySelector('[data-mode="'+mode+'"]');
        if(!button)fail('missing authored racing mode '+mode);
        button.click();
        if($('status').textContent!=='READY')fail('racing mode not ready: '+mode);
      }
      click('launch');
      if($('status').textContent!=='RACING')fail('racing mode did not start');
      click('pause');
      if($('status').textContent!=='PAUSED'||!$('error').hidden)
        fail('racing mode failed to pause without errors');
      tag=$('mode-title').textContent;
    }else if(lab==='block-arena'){
      if(index%125===0)click('restart');
      click('run');if(!blockArena.running())fail('offline match did not start');
      click('pause');if(blockArena.running())fail('offline match did not pause');
      state=blockArena.snapshot();
      if(!Number.isSafeInteger(state.tick)||state.tick<0)fail('non-finite match tick');
      tag=state.mode+'/'+state.tick;
    }else if(lab==='weapon-feel'){
      if(index%125===0)click('reset');
      click('run');if(!weaponFeelLab.running())fail('range did not start');
      click('pause');if(weaponFeelLab.running())fail('range did not pause');
      state=weaponFeelLab.snapshot();
      if(!Number.isSafeInteger(state.timer.tick)||state.timer.tick<0)fail('bad range tick');
      tag='weapon-feel/'+state.timer.tick;
    }else if(lab==='sprite-foundry'){
      const el=$('seed');if(!el)fail('seed field missing');
      el.value=String(seed);el.dispatchEvent(new Event('input',{bubbles:true}));
      click('generate');
      state=__spriteFoundry.snapshot();
      const project=JSON.parse(state.project);
      if(project.recipe.seed!==seed)fail('seeded generator ignored unique input');
      if(!Number.isSafeInteger(state.revision)||state.revision<0)fail('invalid revision');
      if(!project.frames.length||!project.frames[0].pixels.length)fail('empty generated pixels');
      tag=project.recipe.seed+'/'+state.revision;
    }else if(lab==='game-maker'){
      if(index%100===0){
        $('seed').value=String(seed);click('generate');
        state=__gameMakerLab.snapshot();
        if(JSON.parse(state.project).playerSprite.recipe.seed!==seed)fail('sprite seed not applied');
      }
      click('restart');
      click('play');
      state=__gameMakerLab.snapshot();
      if(!state.player?.running)fail('game did not start');
      click('pause');state=__gameMakerLab.snapshot();
      if(state.player?.running||!Number.isSafeInteger(state.player.state.tick))
        fail('game did not pause cleanly');
      tag='maker/'+state.player.state.tick+'/'+state.progress.heroChosen;
    }else if(lab==='narrative-foundry'){
      click('restart');
      state=__narrativeFoundry.snapshot();
      if(state.state.node!=='arrival')fail('story failed to restart');
      const choice=document.querySelector('[data-play-choice="leave-dark"]');
      if(!choice||choice.disabled)fail('valid original ending choice unavailable');
      choice.click();
      state=__narrativeFoundry.snapshot();
      if(state.state.node!=='dark'||state.scene.ending!=='dark')
        fail('story choice failed to enter verified ending');
      tag=state.state.node+'/'+state.state.steps;
    }else if(lab==='demoscene'){
      const frame=seed%3000,sample=frame*960;
      await __demoscene.seek(sample);
      state=__demoscene.snapshot();
      if(state.sample!==sample||state.playing)fail('absolute sample seek drift');
      if(index%125===0){
        const quality=$('quality'),value=quality.value==='low'?'standard':'low';
        quality.value=value;quality.dispatchEvent(new Event('change',{bubbles:true}));
        if(__demoscene.snapshot().quality!==value)fail('quality change failed');
      }
      tag=state.sample+'/'+state.quality;
    }else fail('unregistered lab');
    const canvas=document.querySelector('canvas');
    if(!canvas||canvas.width<1||canvas.height<1)fail('render canvas unavailable');
    if(document.documentElement.dataset.labReady===undefined&&lab!=='racing')
      fail('lab-ready marker lost');
    return {index,seed,tag};
  },{lab,index,seed});
}
async function main(){
  await mkdir(out,{recursive:true});
  const manifest=await readFile(join(root,'manifest.json'));
  const report={kind:'qsol.vanillajs.lab-endurance.v1',group:plan.group,
    sourceSHA:process.env.GITHUB_SHA??null,
    packageManifestSHA256:createHash('sha256').update(manifest).digest('hex'),
    seed:plan.seed,requiredCyclesPerLab:plan.iterations,
    browser:'headless Chromium / software SwiftShader (not physical GPU)',status:'RUNNING',labs:[]};
  await save(report);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port+'/VANILLAJS/';
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    report.chromium=await browser.version();
    for(const lab of plan.labs){
      const started=performance.now(),record={lab,required:plan.iterations,completed:0,status:'RUNNING',sample:[],last:[]},faults=[];
      report.labs.push(record);await save(report);
      const context=await browser.newContext({viewport:{width:1200,height:900},
        serviceWorkers:'block',reducedMotion:'reduce',acceptDownloads:false});
      let page;
      try{
        // Local packaged source only. No browser-side CDN, cloud, or third-party traffic.
        await context.route('**/*',route=>{
          const u=new URL(route.request().url());
          if(u.origin!==new URL(base).origin||!u.pathname.startsWith('/VANILLAJS/'))
            return route.abort('blockedbyclient');
          return route.continue();
        });
        page=await context.newPage();page.setDefaultTimeout(20000);
        page.on('pageerror',e=>faults.push('pageerror: '+e.message));
        page.on('crash',()=>faults.push('Chromium page crashed'));
        const response=await page.goto(base+paths[lab],{waitUntil:'load'});
        assert.equal(response?.status(),200,'packaged lab page available');
        const [kind,value]=ready[lab];
        await page.waitForFunction(([k,v])=>document.documentElement.dataset[k]===v,[kind,value],{timeout:30000});
        record.startup=await realGameplaySample(lab,page);
        assert.equal(faults.length,0,'actual page startup/play caused a browser exception');
        const hash=createHash('sha256');
        for(let i=0;i<plan.iterations;i++){
          if(faults.length)throw Error('Browser error: '+faults.at(-1));
          const seed=iterationSeed(plan.seed,i),w=await oneCycle(page,lab,i,seed);
          assert.equal(w.index,i);assert.equal(w.seed,seed);
          hash.update(JSON.stringify(w)+'\n');
          record.completed++;
          if(i<3)record.sample.push(w);
          record.last.push(w);if(record.last.length>8)record.last.shift();
          if((i+1)%250===0||i+1===plan.iterations){
            record.digestSHA256=hash.copy().digest('hex');
            record.elapsedMs=Math.round(performance.now()-started);
            console.log('ENDURANCE '+lab+' '+(i+1)+'/'+plan.iterations+' '+record.digestSHA256.slice(0,12));
            await save(report);
          }
        }
        assert.equal(record.completed,plan.iterations,'partial lab run cannot PASS');
        assert.equal(faults.length,0,'browser exceptions after last cycle');
        record.status='PASS';
        record.elapsedMs=Math.round(performance.now()-started);
        await save(report);
      }catch(error){
        record.status='FAIL';record.error=String(error?.stack??error);
        record.faults=faults.slice(-12);
        record.elapsedMs=Math.round(performance.now()-started);
        if(page&&!page.isClosed()){
          const image=join(out,plan.group+'-'+lab+'-failure.png');
          await page.screenshot({path:image,fullPage:false,timeout:5000}).then(()=>{record.screenshot=image;}).catch(()=>{});
        }
        report.status='FAIL';await save(report);
        throw error;
      }finally{await context.close();}
    }
    if(report.labs.length!==plan.labs.length||
       report.labs.some(l=>l.status!=='PASS'||l.completed!==plan.iterations))
      throw Error('Incomplete endurance evidence');
    report.status='PASS';await save(report);
    console.log('PASS: '+plan.group+' '+plan.labs.length+' labs × '+plan.iterations+
      ' observed Playwright interaction cycles; SHA-256 evidence '+recordPath);
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error('LAB ENDURANCE FAILED: '+(error?.stack??error));process.exitCode=1;});
