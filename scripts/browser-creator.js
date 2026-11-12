// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {packageGame} from './export-game.js';
import {createStarterScene} from '../demos/editor/creator-workflow.js';
import {createAssetLibrary,serializeProject} from '../demos/editor/asset-foundry.js';
export async function checkCreator(browser,base){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(base+'demos/creator-hub/index.html');
    for(const href of await page.locator('a').evaluateAll(links=>links.map(a=>a.href))){
      const response=await page.request.get(href);assert.equal(response.status(),200,href);
    }
    await page.setViewportSize({width:320,height:800});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'creator hub fits narrow screen');
    await page.goto(base+'demos/circuit-mod-lab/index.html');
    await page.locator('#loop-width').fill('101');await page.locator('#loop-laps').fill('3');
    await page.locator('#loop-builder button').click();
    assert.match(await page.locator('#status').textContent(),/PASS.*4 cardinal gates.*3 laps/);
    await page.locator('#sweep').click();assert.match(await page.locator('#sweep-status').textContent(),/1 gate; next index 1/);
    const pending=page.waitForEvent('download');await page.locator('#download').click();
    const download=await pending,pack=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.equal(pack.entries[0].data.course.gates[0].x,'50.5');
    assert.equal(pack.entries[0].data.course.laps,3);
    const previous=await page.locator('#manifest').inputValue();
    await page.locator('#loop-width').fill('0');
    await page.locator('#loop-builder').dispatchEvent('submit');
    assert.match(await page.locator('#builder-status').textContent(),/Draft unchanged/);
    assert.equal(await page.locator('#manifest').inputValue(),previous);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'course builder fits narrow screen');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
  // Verify an actual exported folder at a nested deployment prefix, including
  // offline reload. The test build stays outside dist and cannot alter its hash.
  const dir=await mkdtemp(join(tmpdir(),'creator-browser-')),out=join(dir,'game');
  let server,context;
  try{
    const source=join(dir,'project.json');
    await writeFile(source,serializeProject(createStarterScene('trigger-trail'),createAssetLibrary()));
    await packageGame(source,out);
    server=createServer(async(req,res)=>{
      try{
        const url=new URL(req.url,'http://localhost');
        if(!url.pathname.startsWith('/play/my-game/'))throw Error('outside prefix');
        const file=resolve(out,decodeURIComponent(url.pathname.slice('/play/my-game/'.length))||'index.html');
        if(!file.startsWith(out+sep))throw Error('outside game');
        const bytes=await readFile(file);
        res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json'})[extname(file)]||'text/plain');res.end(bytes);
      }catch{res.writeHead(404);res.end();}
    });
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const url=`http://127.0.0.1:${server.address().port}/play/my-game/`;
    context=await browser.newContext();const game=await context.newPage(),failures=[];
    game.on('pageerror',error=>failures.push(error.message));
    await game.goto(url);await game.waitForFunction(()=>document.documentElement.dataset.offlineWorker==='registered');
    await game.evaluate(()=>navigator.serviceWorker.ready);
    assert.equal(await game.locator('#game-status').textContent(),'');
    await game.locator('#pause').click();assert.equal(await game.locator('#pause').textContent(),'Resume');
    await game.locator('#restart').click();assert.equal(await game.locator('#game-status').textContent(),'Restarted.');
    await game.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await game.locator('#pause').textContent(),'Resume');
    await game.reload();await game.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await game.reload();
    await game.locator('#restart').click();assert.equal(await game.locator('#game-status').textContent(),'Restarted.');
    assert.equal(await game.locator('#view').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4!==3&&v>80)),true,'exported game draws actual scene pixels');
    assert.deepEqual(failures,[]);
  }finally{
    if(context)await context.close();if(server)await new Promise(done=>server.close(done));
    await rm(dir,{recursive:true,force:true});
  }
  console.log('Creator hub, course form, rejected edit, complete exported game, restart, blur and nested-path offline reload passed.');
}
