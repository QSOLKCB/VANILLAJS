// Packaged Chromium contract: the source-backed 2D demo, audio/store UX,
// responsive Canvas and pause/replay lifecycle. Not a hardware benchmark.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
export async function verify2DLab(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(25000);
  try{
    await page.goto(baseURL+'demos/2d-lab/index.html');
    await page.waitForFunction(()=>document.documentElement.dataset.labReady==='ready');
    assert.equal(await page.locator('#status').textContent(),'READY');
    const pixels=await page.locator('#lab-canvas').evaluate(canvas=>{
      const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
      let bright=0;for(let i=0;i<data.length;i+=4)
        if(data[i]+data[i+1]+data[i+2]>130)bright++;
      return bright;
    });
    assert.ok(pixels>500,'2D Canvas must render a visible grid and actor');
    await mkdir('browser-artifacts',{recursive:true});
    await page.screenshot({path:'browser-artifacts/2d-lab.png',fullPage:true});
    await page.locator('#step').click();
    assert.equal(await page.locator('#tick').textContent(),'0001');
    await page.locator('#run').click();
    await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>=8);
    await page.locator('#pause').click();
    assert.equal(await page.locator('#status').textContent(),'PAUSED');
    const frozen=await page.locator('#tick').textContent();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#tick').textContent(),frozen);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#tick').textContent(),'0000');
    for(const mode of ['shmup','platform','car','rts']){
      await page.locator('[data-mode="'+mode+'"]').click();
      assert.equal(await page.locator('[data-mode="'+mode+'"]').getAttribute('aria-pressed'),'true');
      await page.locator('#step').click();
      assert.equal(await page.locator('#tick').textContent(),'0001');
    }
    await page.locator('#run').click();
    await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>=6);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#status').textContent(),'PAUSED');
    const download=page.waitForEvent('download');
    await page.locator('#save-store').click();
    const dl=await download;assert.equal(dl.suggestedFilename(),'vanillajs-ternary2d.json');
    const saved=await readFile(await dl.path()),snap=JSON.parse(saved.toString('utf8'));
    assert.equal(snap.schemaVersion,1);
    assert.equal(snap.columns,27);
    assert.ok(snap.rows.length>0);
    await page.locator('#restore-file').setInputFiles({
      name:'original.json',mimeType:'application/json',buffer:saved});
    await page.waitForFunction(()=>document.querySelector('#evidence-note').textContent.includes('restored'));
    const forged=structuredClone(snap);forged.rows[0][0]=4;
    await page.locator('#restore-file').setInputFiles({
      name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
    await page.waitForFunction(()=>document.querySelector('#evidence-note').textContent.includes('rejected'));
    const evidenceDownload=page.waitForEvent('download');
    await page.locator('#download-evidence').click();
    const evidence=JSON.parse((await readFile(await (await evidenceDownload).path())).toString('utf8'));
    assert.equal(evidence.kind,'qsol.vanillajs.lab2d.browser-observation.v1');
    assert.equal(evidence.model.kind,'rts');
    assert.equal(evidence.ternary.schemaVersion,1);
    await page.locator('#sound').click();
    assert.match(await page.locator('#audio-note').textContent(),/PCM|Playback/);
    await page.setViewportSize({width:320,height:780});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
      '320px responsive layout must not overflow');
    await page.screenshot({path:'browser-artifacts/2d-lab-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('2D Foundry: RTS A*, shmup/platform/car mode resets, pause/blur, exact tick, PCM preview, ternary save/restore/rejection, evidence download and 320px responsive layout passed.');
  }finally{await page.close();}
}
