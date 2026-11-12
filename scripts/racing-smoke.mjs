// SPDX-License-Identifier: Apache-2.0
// RACING-001 hosted packaged Chromium smoke; no GPU/driver performance claims.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright'); // Pinned in CI runner temp; not a runtime dependency.
const root=resolve(import.meta.dirname,'../dist');
const server=createServer(async(req,res)=>{
  try{
    const pathPart=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathPart.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const file=resolve(root,pathPart.slice('/VANILLAJS/'.length));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);
    res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html',
      '.css':'text/css','.json':'application/json'})[extname(file)]??'text/plain');
    res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:850},acceptDownloads:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/VANILLAJS/demos/racing-lab/index.html');
  try{
    await page.waitForFunction(()=>document.documentElement.dataset.racingReady==='ready',null,{timeout:10000});
  }catch(error){
    const observed=await page.evaluate(()=>({
      ready:document.documentElement.dataset.racingReady??null,
      title:document.title,
      foundry:!!document.querySelector('#track-foundry'),
      script:document.querySelector('script[src="./app.js"]')?.src??null,
      errorText:document.querySelector('#error')?.textContent??null,
      documentState:document.readyState
    }));
    console.error('RACING STARTUP DIAGNOSTIC',JSON.stringify({observed,pageErrors:errors}));
    throw error;
  }
  assert.equal(await page.locator('#status').textContent(),'READY');
  assert.equal(await page.locator('#error').isVisible(),false);
  const nonBlack=await page.locator('#retro-view').evaluate(canvas=>{
    const image=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let count=0;for(let i=0;i<image.length;i+=40)
      if(image[i]+image[i+1]+image[i+2]>120)count++;
    return count;
  });
  assert.ok(nonBlack>100,'retro Canvas must have actual drawn pixels');
  await mkdir('browser-artifacts',{recursive:true});
  await page.screenshot({path:'browser-artifacts/racing-retro.png',fullPage:true});
  await page.locator('#launch').click();
  await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>10);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('[data-mode="circuit"]').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#status').textContent(),'READY');
  await page.locator('#launch').click();
  await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>10);
  await page.keyboard.up('w');
  const pixels=await page.locator('#three-view').evaluate(canvas=>{
    const gl=canvas.getContext('webgl');
    return !!gl&&canvas.width>1&&canvas.height>1;
  });
  assert.equal(pixels,true,'3D mode must allocate a working WebGL canvas');
  const pending=page.waitForEvent('download');
  await page.locator('#export').click();
  const download=await pending,receipt=JSON.parse((await readFile(await download.path())).toString());
  assert.equal(receipt.mode,'circuit');
  assert.equal(receipt.step,1/60);
  assert.ok(receipt.inputs.length>0);
  await page.screenshot({path:'browser-artifacts/racing-circuit.png',fullPage:true});
  for(const mode of ['tour','sprint']){
    await page.locator('[data-mode="'+mode+'"]').click();
    assert.equal(await page.locator('#status').textContent(),'READY');
    await page.locator('#launch').click();
    await page.keyboard.down('w');
    await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>10);
    await page.keyboard.up('w');
    if(mode==='tour'){
      assert.ok(await page.locator('#retro-view').evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[3])>0,
        'scenic touring must render Canvas pixels');
    }else{
      assert.equal(await page.locator('#three-view').evaluate(c=>!!c.getContext('webgl')&&c.width>1),true,
        'coastal sprint must initialise native WebGL');
    }
    await page.screenshot({path:'browser-artifacts/racing-'+mode+'.png',fullPage:true});
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#status').textContent(),'PAUSED');
  }
  for(const mode of ['derby','ball','stunt']){
    await page.locator('[data-mode="'+mode+'"]').click();
    assert.equal(await page.locator('#error').isVisible(),false);
    await page.locator('#launch').click();
    await page.keyboard.down('w');
    await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>7);
    await page.keyboard.up('w');
    if(mode==='stunt')await page.screenshot({path:'browser-artifacts/racing-stunt.png',fullPage:true});
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#status').textContent(),'PAUSED');
  }
  // RACING-002B: author, export, reject malformed input, restore and drive
  // an accepted track through the *actual* packaged browser interface.
  await page.locator('#track-foundry').scrollIntoViewIfNeeded();
  const previewPixels=await page.locator('#track-preview').evaluate(canvas=>{
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    return data[3]+data[11]+data[data.length-1];
  });
  assert.ok(previewPixels>0,'Track Foundry schematic must draw actual pixels');
  await page.locator('#track-name').fill('Morning Sprint');
  await page.locator('#track-environment').selectOption('forest');
  await page.locator('#track-sections [data-section="0"][data-property="curve"]').fill('0.8');
  await page.locator('#track-sections [data-section="0"][data-property="curve"]').press('Tab');
  await page.locator('#track-apply').click();
  assert.match(await page.locator('#track-message').textContent(),/Applied Morning Sprint/);
  assert.match(await page.locator('#mode-title').textContent(),/Scenic Tour/);
  await page.locator('#launch').click();
  await page.locator('#track-name').focus();
  assert.equal(await page.locator('#status').textContent(),'PAUSED');
  const idleSpeed=await page.locator('#speed').textContent();
  await page.keyboard.press('w');await page.keyboard.press('Space');
  assert.equal(await page.locator('#status').textContent(),'PAUSED');
  assert.equal(await page.locator('#speed').textContent(),idleSpeed);
  await page.locator('#track-name').fill('Morning Sprint');
  const trackDownload=page.waitForEvent('download');
  await page.locator('#track-export').click();
  const exported=JSON.parse(await readFile(await (await trackDownload).path(),'utf8'));
  assert.equal(exported.format,'qsol.vanillajs.track.v1');
  assert.equal(exported.name,'Morning Sprint');
  assert.equal(exported.environment,'forest');
  assert.equal(exported.sections[0].curve,.8);
  // Delayed imports may not replace a newer draft edit.
  await page.evaluate(serialized=>{
    const original=File.prototype.text;
    File.prototype.text=function(){
      if(this.name==='slow-track.json')
        return new Promise(resolve=>{globalThis.__resolveSlowTrack=()=>resolve(serialized);});
      return original.call(this);
    };
  },JSON.stringify({...exported,name:'Slow import'}));
  await page.locator('#track-import').setInputFiles({
    name:'slow-track.json',mimeType:'application/json',buffer:Buffer.from('{}')
  });
  await page.waitForFunction(()=>typeof globalThis.__resolveSlowTrack==='function');
  await page.locator('#track-name').fill('Newer edit');
  await page.evaluate(()=>globalThis.__resolveSlowTrack());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#track-name').inputValue(),'Newer edit',
    'later user edit must win over a slow import');
  await page.locator('#track-name').fill('Morning Sprint');
  await page.locator('#track-import').setInputFiles({
    name:'invalid-track.json',mimeType:'application/json',buffer:Buffer.from('{"bad":true}')
  });
  await page.waitForFunction(()=>document.querySelector('#track-message').textContent.includes('Import rejected'));
  assert.equal(await page.locator('#track-name').inputValue(),'Morning Sprint',
    'invalid imports preserve the previously accepted authoring draft');
  await page.locator('#track-new').click();
  await page.locator('#track-import').setInputFiles({
    name:'morning-sprint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))
  });
  await page.waitForFunction(()=>document.querySelector('#track-name').value==='Morning Sprint');
  await page.locator('#track-target').selectOption('sprint');
  await page.locator('#track-apply').click();
  assert.match(await page.locator('#mode-title').textContent(),/Coastal Sprint/);
  assert.equal(await page.locator('#three-view').evaluate(c=>!!c.getContext('webgl')&&c.width>1),true);
  await page.screenshot({path:'browser-artifacts/racing-track-foundry.png',fullPage:true});
  await page.locator('#track-target').selectOption('circuit');
  await page.locator('#track-apply').click();
  assert.match(await page.locator('#mode-title').textContent(),/Circuit Race/);
  assert.equal(await page.locator('#track-gates').isVisible(),true);
  await page.locator('#track-clear').click();
  assert.match(await page.locator('#track-message').textContent(),/built-in tracks/);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
    'mobile view must fit 390 CSS pixels without horizontal page overflow');
  await page.screenshot({path:'browser-artifacts/racing-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('RACING-002B packaged Chromium PASS: seven modes, Track Foundry author/export/reject/re-import/apply/clear, native Canvas/WebGL, pause, evidence and responsive layout.');
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
