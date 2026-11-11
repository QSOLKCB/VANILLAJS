// SPDX-License-Identifier: Apache-2.0
// Checks real packaged controls and exact displayed invariants; no GPU claim.
import assert from 'node:assert/strict';
export async function verifyGraphLab(browser,base){
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'demos/graph-lab/index.html');
    const text=id=>page.locator('#'+id).textContent();
    await page.waitForFunction(()=>document.getElementById('size').textContent==='9 / 12');
    const polynomial=await text('polynomial');assert.equal(polynomial,'[1, 0, -12, 0, 36, 0, -32, 0, 0, 0]');assert.equal(await text('density'),'1/3');
    assert.equal(await text('order'),'0 → 1 → 3 → 2 → 4 → 6 → 5 → 7 → 8');
    await page.screenshot({path:'browser-artifacts/graph-lab.png',fullPage:true});
    await page.locator('#step').click();assert.match(await text('status'),/Visited 1 of 9/);
    const before=await page.locator('canvas').evaluate(c=>c.toDataURL());
    await page.locator('#symmetry').selectOption('r');
    assert.notEqual(await page.locator('canvas').evaluate(c=>c.toDataURL()),before);assert.equal(await text('polynomial'),polynomial);
    await page.locator('#relabel').click();assert.equal(await text('polynomial'),polynomial);assert.equal(await page.locator('#start').inputValue(),'8');
    await page.locator('#mode').selectOption('dfs');assert.match(await text('status'),/Visited 0/);
    await page.locator('#preset').selectOption('star');const star=await text('polynomial');assert.equal(await text('components'),'1');
    await page.locator('#preset').selectOption('cycle');assert.equal(await text('polynomial'),star);assert.equal(await text('components'),'2');
    await page.locator('#start').selectOption('4');assert.equal(await text('order'),'4');await page.locator('#step').click();assert.equal(await page.locator('#step').isDisabled(),true);
    await page.locator('#reset').click();assert.equal(await page.locator('#step').isDisabled(),false);
    await page.locator('#preset').selectOption('empty');assert.equal(await text('polynomial'),'[1]');assert.equal(await page.locator('#step').isDisabled(),true);
    await page.locator('#relabel').click();assert.equal(await text('size'),'0 / 0');
    await page.locator('#preset').selectOption('complete');assert.equal(await text('triangles'),'20');
    await page.setViewportSize({width:320,height:800});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:'browser-artifacts/graph-lab-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    const fallback=await browser.newPage();try{
      await fallback.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
      await fallback.goto(base+'demos/graph-lab/index.html');await fallback.waitForFunction(()=>document.getElementById('drawing-status').textContent.includes('Canvas unavailable'));
      assert.equal(await fallback.locator('#size').textContent(),'9 / 12');await fallback.locator('#step').click();assert.match(await fallback.locator('#status').textContent(),/Visited 1/);
    }finally{await fallback.close();}
    await verifyCourseLab(browser,base);
    console.log('Graph Lab: exact polynomial, cospectral distinction, traversal/relabel/D4 controls, empty/disconnected cases, Canvas fallback and 320px layout passed.');
  }finally{await page.close();}
}

async function verifyCourseLab(browser,base){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'demos/alien-course-lab/index.html');
    await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('PASS'));
    assert.match(await page.locator('#status').textContent(),/6 exact gates/);
    assert.match(await page.locator('#result').textContent(),/"leftRaw": -458752/);
    await page.locator('#sweep-button').click();
    assert.match(await page.locator('#sweep').textContent(),/credited 2 consecutive gates/);
    const data=JSON.parse(await page.locator('#course').inputValue());
    data.gates[0].width='not-a-number';
    await page.locator('#course').fill(JSON.stringify(data));
    await page.locator('#compile').click();
    assert.match(await page.locator('#status').textContent(),/REJECTED/);
    assert.equal(await page.locator('#download').isDisabled(),true);
    await page.reload();
    await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('PASS'));
    await page.locator('#rounding').selectOption('nearest-even');
    await page.locator('#compile').click();
    assert.match(await page.locator('#status').textContent(),/PASS/);
    assert.equal(await page.locator('.play').getAttribute('href'),'https://qsolkcb.github.io/DRONE-RACER/');
    await page.setViewportSize({width:320,height:700});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
      'ALIEN Course Foundry must fit a 320px viewport');
    await page.screenshot({path:'browser-artifacts/alien-course-foundry.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('ALIEN Course Foundry: actual browser module, Q16 output, multi-gate sweep, bad data rejection, rounding and 320px viewport passed.');
  }finally{await page.close();}
}
