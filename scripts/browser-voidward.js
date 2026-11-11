// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/4XGAMES PR #2, commit 030859385ac8929e066702ef8af0518663480653.
// Uses the caller's isolated Chromium instance; never launches a desktop.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {campaigns} from '../demos/4x-game-lab/voidward/mods/registry.js';
import {PACK_FILES,parsePack} from '../demos/4x-game-lab/voidward/js/content.js';
import {createCampaign,editSetting,exportPack,readRows,writeRows} from '../demos/4x-game-lab/voidward/js/workshop.js';
import {createLargeSaveFixture} from '../tests/voidward-save-fixtures.js';
import {decodeSaveEnvelope} from '../demos/4x-game-lab/voidward/js/save-codec.js';

export async function verifyVoidwardLab(browser, base, options={}) {
const root=path.resolve(import.meta.dirname,'..');
const stage=path.join(root,'dist/demos/4x-game-lab/voidward');
const out=path.resolve(options.out||'browser-artifacts/voidward');
const url=base+'demos/4x-game-lab/voidward/index.html';
await fs.mkdir(out,{recursive:true});
const planned=['all-campaign-empires','editor-handoff-transaction','player-orders','group-orders','ship-refit-construction','diplomacy-combat','creator-roundtrip','legacy-save-migration','large-save-roundtrip','campaign-progress','large-list-filtering','audio-preferences','keyboard-responsive-touch','offline','render-parity-performance'];
const checks=Object.fromEntries(planned.map(name=>[name,{status:'NOT_RUN'}]));
const errors=[],httpFailures=[],externalRequests=[];
// Construct the bounded stress state in Node before the browser is launched.
// The shared generator validates it; no diagnostic browser state is mutated.
const largeSaveFixture=await createLargeSaveFixture();
let context,page,current;
const receipt={status:'RUNNING',checks,environment:{node:process.version,browser:browser.version()},coverage:{touch:'emulated',manualGameplay:'scripted UI actions',listening:'not assessed',hardwareAcceleration:'reported by owner runner separately'}};
const snapshot=()=>page.evaluate(()=>globalThis.__voidward);
const action=(name,extra='')=>page.locator(`[data-action="${name}"]${extra}`);
const nav=name=>page.locator('.nav').getByRole('button',{name,exact:true});
const close=async()=>{if(await page.locator('#dialog').evaluate(el=>el.open))await page.locator('#dialog [data-action="close"]').first().click();};
const download=async button=>{const promise=page.waitForEvent('download');await button.click();const file=await promise;return fs.readFile(await file.path(),'utf8');};
// Both upload paths await the application's async handler, not only DOM change
// dispatch. Success replaces workshop inputs or clears save-file; rejection clears
// the same input. No native OS file picker remains open.
async function upload(selector,text,name='fixture.json') {
  const input=await page.locator(selector).elementHandle();
  try { await input.setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(input=>!input.isConnected||input.files.length===0,input); }
  finally { await input.dispose(); }
}
async function chooseAndUpload(button,text,name='fixture.json') {
  const pending=page.waitForEvent('filechooser');await button.click();const chooser=await pending,input=chooser.element();
  try { await chooser.setFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(input=>!input.isConnected||input.files.length===0,input); }
  finally { await input.dispose(); }
}
async function traceMap(campaign) {
  const result={campaign,categories:['gpu','viz','cc'],durationTargetMs:2000,status:'UNAVAILABLE',attribution:'Dedicated browser; explicit repeated game drawMap calls. Trace events require interpretation; no hardware conclusion is inferred.'};
  let cdp,stream,started=false,completionTimer;
  try {
    cdp=await browser.newBrowserCDPSession();
    await cdp.send('Tracing.start',{categories:result.categories.join(','),options:'record-continuously',transferMode:'ReturnAsStream'});started=true;
    const complete=new Promise((resolve,reject)=>{completionTimer=setTimeout(()=>reject(new Error('GPU trace completion timeout')),10000);cdp.once('Tracing.tracingComplete',event=>{clearTimeout(completionTimer);resolve(event);});});
    complete.catch(()=>{}); // Preserve a later awaited rejection without an unhandled promise.
    await page.bringToFront();
    result.workload=await page.evaluate(async()=>{
      const {drawMap}=await import('./js/render.js'),{createEngine}=await import('./js/core.js'),s=__voidward,engine=createEngine(s.pack),canvas=document.querySelector('#galaxy-canvas'),start=performance.now();let frames=0;
      do {drawMap(canvas,s.state,engine,s.selected,null,1,'political');frames++;await new Promise(resolve=>requestAnimationFrame(resolve));}while(performance.now()-start<2000&&frames<240);
      return{frames,elapsedMs:performance.now()-start,canvasWidth:canvas.width,canvasHeight:canvas.height};
    });
    await cdp.send('Tracing.end');started=false;stream=(await complete).stream;
    if(!stream)throw new Error('Trace returned no stream');
    const file=path.join(out,`gpu-trace-${campaign}.json`),handle=await fs.open(file,'w');let bytes=0,truncated=false;
    try{while(true){const chunk=await cdp.send('IO.read',{handle:stream,size:65536}),buffer=Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8');if(bytes+buffer.length>32*1024*1024){truncated=true;break;}await handle.write(buffer);bytes+=buffer.length;if(chunk.eof)break;}}finally{await handle.close();}
    Object.assign(result,{status:truncated?'TRUNCATED':'CAPTURED',file:path.basename(file),bytes,truncated});
  }catch(error){result.error=error.message;}
  finally{clearTimeout(completionTimer);if(started)await cdp?.send('Tracing.end').catch(()=>{});if(stream)await cdp?.send('IO.close',{handle:stream}).catch(()=>{});await cdp?.detach().catch(()=>{});}
  return result;
}
async function check(name,fn){current=name;const start=Date.now();checks[name]={status:'RUNNING'};await fn();checks[name]={status:'PASS',elapsedMs:Date.now()-start};await fs.writeFile(path.join(out,'progress.json'),JSON.stringify(receipt,null,2));}
async function launch(id,player=0){await close();await nav('Campaign workshop').click();await action('campaign-prompt',`[data-pack="${id}"]`).click();await page.waitForFunction(({id,player})=>document.querySelector('#dialog').open&&document.querySelector('#new-pack')?.value===id&&[...document.querySelector('#new-player').options].some(o=>o.value===String(player)),{id,player});await page.locator('#new-player').selectOption(String(player));await page.locator('#new-seed').fill('2401');await action('launch').click();await page.waitForFunction(({id,player})=>__voidward?.pack.meta.id===id&&__voidward.state.player===player&&__voidward.state.turn===1&&!document.querySelector('#dialog').open,{id,player});}
async function end(){const before=(await snapshot()).state.turn;await action('end').click();await page.waitForFunction(n=>__voidward.state.turn===n+1,before);}
async function loadTextPack(text){await close();await nav('Campaign workshop').click();await action('visual-workshop').click();await upload('#workshop-upload',text);const envelope=JSON.parse(text),expected=(envelope.files||envelope.entries[0].data.files)['campaign.txt'];await page.waitForFunction(expected=>__voidward.workshop?.files['campaign.txt']===expected,expected);await action('workshop-launch').click();await action('workshop-start').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);}
try {
  context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
  page=await context.newPage();page.setDefaultTimeout(12000);
  const observe=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)httpFailures.push({url:new URL(r.url()).pathname,status:r.status()});});p.on('request',r=>{if(!r.url().startsWith(new URL(url).origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))externalRequests.push(r.url());});};observe(page);
  await page.goto(url);await page.waitForFunction(()=>globalThis.__voidward?.state);
  await check('all-campaign-empires',async()=>{
    receipt.campaigns=[];
    for(const c of campaigns){const raw=Object.fromEntries(await Promise.all([...PACK_FILES,...(c.files||[])].map(async f=>[f+'.txt',await fs.readFile(new URL(f+'.txt',c.base),'utf8')])));const p=parsePack(raw);
      for(const player of p.scenario.playable){await launch(c.id,player);const s=await snapshot();assert.equal(s.selected,p.empires[player].home);assert.equal(s.state.planets[p.empires[player].home*p.rules.planetsPerSystem].owner,player);
        await nav('Colonies').click();assert.ok(await action('manage').count());await action('manage').first().click();await action('build','[data-kind="mine"]').click();assert.ok((await snapshot()).state.planets.some(x=>x.owner===player&&x.queue.length));await close();
        await nav('Research').click();assert.ok(await page.locator('.unlock-list').count());await action('research','[data-field="propulsion"]').click();assert.equal((await snapshot()).state.empires[player].research,'propulsion');await end();await nav('Galaxy map').click();
        await page.screenshot({path:path.join(out,`${c.id}-empire-${player}.png`),fullPage:true});receipt.campaigns.push({campaign:c.id,player,turn:2});
      }
    }
  });
  const rawBase=Object.fromEntries(await Promise.all(PACK_FILES.map(async f=>[f+'.txt',await fs.readFile(path.join(stage,'mods/frontier',f+'.txt'),'utf8')])));
  await check('editor-handoff-transaction',async()=>{
    const key='vanillajs.editor.4x-handoff.v1',before=(await snapshot()).state;
    const savedBefore=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('vanillajs.voidward.')).sort());
    const invalid='{"kind":"voidward.text-pack.v1","files":{}}';
    await page.evaluate(({key,text})=>localStorage.setItem(key,text),{key,text:invalid});
    await page.goto(url+'?draft=editor');await page.waitForFunction(()=>__voidward?.state&&document.querySelector('#toast').textContent.startsWith('Editor draft rejected:'));
    assert.deepEqual((await snapshot()).state,before,'invalid handoff restores the exact active campaign');
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),invalid,'rejected draft stays available for repair');
    assert.deepEqual(await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('vanillajs.voidward.')).sort()),savedBefore,'rejection cannot overwrite autosave slots');
    await page.evaluate(key=>localStorage.removeItem(key),key);await page.reload();
    await page.waitForFunction(()=>__voidward?.state&&document.querySelector('#toast').textContent.includes('No pending editor draft'));
    assert.deepEqual((await snapshot()).state,before,'missing handoff also preserves the active campaign');
    const {exportSDKPack}=await import('../demos/4x-game-lab/voidward/js/workshop.js');
    for(const format of ['native','sdk']){
      const raw=editSetting(rawBase,'campaign','id',`editor-handoff-${format}`),text=format==='native'?exportPack(raw):exportSDKPack(raw);
      await page.evaluate(({key,text})=>localStorage.setItem(key,text),{key,text});await page.goto(url+'?draft=editor');
      await page.waitForFunction(({id,key})=>__voidward?.pack.meta.id===id&&__voidward.state.turn===1&&localStorage.getItem(key)===null&&!location.search,{id:`editor-handoff-${format}`,key});
      assert.deepEqual((await snapshot()).pack.raw,raw);assert.equal((await snapshot()).state.player,0);
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(localStorage.getItem('vanillajs.voidward.active.v1'))));
      assert.equal(saved.extension,null,'editor drafts activate without installed source hooks');assert.equal(saved.kind,'voidward.save.v1');
      assert.equal(saved.pack['campaign.txt'],raw['campaign.txt']);
    }
    // Previously installed games remain separate recoverable slots after both launches.
    const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
    for(const [savedKey,value]of savedBefore.filter(([k])=>k.startsWith('vanillajs.voidward.save.v1.')))assert.equal(after[savedKey],value);
  });
  let fixture=editSetting(rawBase,'rules','colonyTarget',8);fixture=editSetting(fixture,'rules','startMinerals',5000);fixture=editSetting(fixture,'rules','startEnergy',5000);
  fixture=createCampaign(fixture,{id:'browser-proving-ground',title:'Browser proving ground',description:'Explicit test fixture made with the campaign workshop API.',columns:2,rows:2,homes:[0,1,3],geography:'grid',files:{'scenario.txt':'playable = 0\nvictory = objectives\nminVictoryTurn = 60\n','objectives.txt':'patient | player | survive | - | 60 | | patient-route | Endurance | Hold until turn sixty. | 1\nbold | player | survive | - | 60 | | bold-route | Vanguard | Hold until turn sixty. | 1\n','events.txt':'supply | 2 | | resources | player | minerals | 17 | 0\n'}});
  await loadTextPack(exportPack(fixture));
  await check('player-orders',async()=>{
    await action('colonize').first().click();assert.equal((await snapshot()).state.planets[1].owner,0);
    await nav('Colonies').click();await action('manage','[data-id="0"]').click();await action('build','[data-kind="mine"]').click();await action('build','[data-kind="lab"]').click();
    await action('reorder','[data-from="1"][data-to="0"]').click();assert.equal((await snapshot()).state.planets[0].queue[0].kind,'lab');await action('cancel-build','[data-index="1"]').click();assert.equal((await snapshot()).state.planets[0].queue.length,1);await close();
    await nav('Research').click();await action('research','[data-field="weapons"]').click();assert.equal((await snapshot()).state.empires[0].research,'weapons');
  });
  await check('ship-refit-construction',async()=>{
    await nav('Fleets').click();const s=await snapshot(),frigate=s.state.fleets.find(f=>f.owner===0&&f.design.hull==='frigate-0');
    await action('copy-design',`[data-fleet="${frigate.id}"]`).click();await page.locator('#design-name').fill('Browser Vanguard');await action('add-part','[data-part="laser-1"]').click();await action('save-design').click();
    const design=(await snapshot()).state.empires[0].designs.at(-1);assert.equal(design.name,'Browser Vanguard');assert.ok(await page.locator('#compare-design').count());
    await nav('Fleets').click();await action('ship-orders',`[data-id="${frigate.id}"]`).click();await action('refit',`[data-design="${design.id}"]`).click();assert.ok((await snapshot()).state.fleets.find(f=>f.id===frigate.id).refit);
    for(let i=0;i<15&&(await snapshot()).state.fleets.find(f=>f.id===frigate.id).refit;i++)await end();assert.equal((await snapshot()).state.fleets.find(f=>f.id===frigate.id).design.name,'Browser Vanguard');
    await nav('Colonies').click();await action('manage','[data-id="0"]').click();await action('build-ship',`[data-design="${design.id}"]`).click();await close();
    for(let i=0;i<20&&!(await snapshot()).state.fleets.some(f=>f.id!==frigate.id&&f.name==='Browser Vanguard');i++)await end();
    assert.ok((await snapshot()).state.fleets.some(f=>f.id!==frigate.id&&f.name==='Browser Vanguard'));
  });
  await check('group-orders',async()=>{
    await nav('Fleets').click();const ships=(await snapshot()).state.fleets.filter(f=>f.owner===0&&f.system===0&&!f.refit).slice(0,2);assert.equal(ships.length,2);
    for(const ship of ships)await page.locator(`[data-ship-select="${ship.id}"]`).check();await action('group-prompt').click();await page.locator('#group-name').fill('Browser Task Force');await action('create-group').click();
    const group=(await snapshot()).state.groups.find(g=>g.name==='Browser Task Force');assert.ok(group);await action('group-orders',`[data-group="${group.id}"]`).click();await page.locator('#group-target').selectOption('2');await action('group-move').click();await end();
    assert.ok((await snapshot()).state.fleets.filter(f=>group.ships.includes(f.id)).every(f=>f.system===2));assert.ok((await snapshot()).state.empires[0].known.includes(2));await action('ungroup',`[data-group="${group.id}"]`).click();
    await action('ship-orders',`[data-id="${ships[0].id}"]`).click();await action('ship-order','[data-order="return"]').click();await end();assert.equal((await snapshot()).state.fleets.find(f=>f.id===ships[0].id).system,0);
  });
  await check('diplomacy-combat',async()=>{
    // A fresh explicit scenario fixture bounds time and removes dependence on a long campaign opening.
    await loadTextPack(exportPack(fixture));await nav('Fleets').click();const f=(await snapshot()).state.fleets.find(f=>f.owner===0&&f.design.hull==='frigate-0');await action('fleet-on-map',`[data-id="${f.id}"]`).click();await action('system','[data-id="1"]').click();await action('move').click();await end();
    await nav('Diplomacy').click();await action('diplomacy','[data-target="1"][data-offer="trade"]').click();assert.equal((await snapshot()).state.relations[0][1],'trade');await action('war-prompt','[data-target="1"]').click();await action('diplomacy','[data-target="1"][data-offer="war"]').click();await end();assert.ok((await snapshot()).state.battles.length);await nav('Turn reports').click();await page.screenshot({path:path.join(out,'combat-report.png'),fullPage:true});
  });
  await check('campaign-progress',async()=>{
    await action('objectives').first().click();await action('choose-objective','[data-id="patient"]').click();await close();const progress=(await snapshot()).state.progress;assert.equal(progress.choices['0:route'],'patient-route');assert.equal(progress.events.supply,2);
    await page.reload();await page.waitForFunction(()=>__voidward?.state.progress.choices['0:route']==='patient-route');assert.deepEqual((await snapshot()).state.progress,progress);await end();assert.equal((await snapshot()).state.progress.events.supply,2);
  });
  await check('creator-roundtrip',async()=>{
    await launch('frontier');const active=JSON.stringify((await snapshot()).state);await nav('Campaign workshop').click();await action('visual-workshop').click();
    await action('workshop-tab','[data-tab="settings"]').click();await page.locator('#workshop-id').fill('browser-created-universe');await page.locator('#workshop-title').fill('Browser Created Universe');await action('workshop-settings-save').click();
    await action('workshop-tab','[data-tab="map"]').click();await page.locator('#workshop-x').fill('180');await page.locator('#workshop-y').fill('220');await page.locator('#workshop-system-name').fill('Browser Beacon');await action('workshop-system-save').click();await page.locator('#workshop-link').selectOption('29');await action('workshop-lane','[data-enable="true"]').click();
    await action('workshop-tab','[data-tab="hulls"]').click();await action('hull-clear').click();for(const [x,y] of [[0,-40],[30,30],[-30,30]]){await page.locator('#vertex-x').fill(String(x));await page.locator('#vertex-y').fill(String(y));await action('hull-add').click();}await action('hull-apply').click();
    const project=await download(action('workbench-hull-export'));await fs.writeFile(path.join(out,'creator-workbench-project.json'),project);await chooseAndUpload(action('workbench-hull-import'),project,'hull-workbench.json');await action('workbench-preview').click();await action('workbench-apply').click();
    const portable=await download(action('workshop-export')),sdk=await download(action('workshop-sdk-export'));await fs.writeFile(path.join(out,'creator-pack.json'),portable);await fs.writeFile(path.join(out,'creator-sdk.json'),sdk);
    const p=parsePack(JSON.parse(portable).files);assert.equal(p.systemNames[0],'Browser Beacon');assert.ok(p.map[0].links.includes(29));assert.ok(p.provenance.length>=1,'Attribution must survive the hull roundtrip');assert.equal(JSON.stringify((await snapshot()).state),active);
    await upload('#workshop-upload','{"kind":"voidward.text-pack.v1","files":{}}','bad.json');await page.waitForFunction(()=>document.querySelector('#toast')?.classList.contains('error'));assert.equal(JSON.stringify((await snapshot()).state),active);
    await chooseAndUpload(action('workshop-import'),portable,'native.json');await page.waitForFunction(expected=>__voidward.workshop?.files['campaign.txt']===expected,p.raw['campaign.txt']);await upload('#workshop-upload',sdk,'sdk.json');await action('workshop-launch').click();await action('workshop-start').click();await page.waitForFunction(()=>__voidward?.pack.meta.id==='browser-created-universe');assert.deepEqual((await snapshot()).pack.raw,p.raw);await end();
    await page.screenshot({path:path.join(out,'created-universe.png'),fullPage:true});
  });
  await check('legacy-save-migration',async()=>{
    for(const id of ['frontier','machine-dawn']){const fixture=await fs.readFile(path.join(root,'tests/fixtures',`voidward-v1-${id}.json`),'utf8'),old=JSON.parse(fixture);await close();await upload('#save-file',fixture);await page.waitForFunction(({id,turn})=>globalThis.__voidward?.pack.meta.id===id&&__voidward.state.version===2&&__voidward.state.turn===turn,{id,turn:old.state.turn});assert.equal((await snapshot()).state.turn,old.state.turn);const migrated=(await snapshot()).state;await page.reload();await page.waitForFunction(()=>__voidward?.state.version===2);assert.deepEqual((await snapshot()).state,migrated);}
    const before=JSON.stringify((await snapshot()).state);await upload('#save-file','{"kind":"wrong"}');await page.waitForFunction(()=>document.querySelector('#toast').classList.contains('error'));assert.equal(JSON.stringify((await snapshot()).state),before);
  });
  await check('large-save-roundtrip',async()=>{
    await close();const fixture=largeSaveFixture,timings=receipt.largeSave={status:'RUNNING',fixtureBytes:Buffer.byteLength(fixture.text,'utf8'),workload:'Generated validated synthetic boundary fixture with populated report history; not a played campaign; no turns simulated in browser',timingMeaning:'Single Node monotonic wall-time sample per UI transfer, including Playwright protocol, import completion or download/read; not pure simulation time'};
    let start=performance.now();await upload('#save-file',fixture.text,'large-save-fixture.json');
    await page.waitForFunction(({id,turn})=>__voidward?.pack.meta.id===id&&__voidward.state.turn===turn,{id:fixture.pack.meta.id,turn:fixture.state.turn});timings.fixtureImportMs=performance.now()-start;
    let restored=await snapshot();assert.ok(isDeepStrictEqual(restored.state,fixture.state),'Large fixture import changed authoritative state');assert.ok(isDeepStrictEqual(restored.pack.raw,fixture.pack.raw),'Large fixture import changed pack content');
    await action('saves').first().click();start=performance.now();const exported=await download(action('export-save'));timings.uiExportDownloadMs=performance.now()-start;
    const exportedBytes=Buffer.byteLength(exported,'utf8');Object.assign(timings,{exportedBytes,exportedFile:'large-save-export.json'});await fs.writeFile(path.join(out,'large-save-export.json'),exported);
    assert.ok(exportedBytes>2000000,'Large-save witness must exceed the old two-million-byte UI admission limit');
    const envelope=decodeSaveEnvelope(exported);assert.ok(isDeepStrictEqual(envelope.state,fixture.state),'UI export changed authoritative state');assert.ok(isDeepStrictEqual(envelope.pack,fixture.pack.raw),'UI export changed pack content');
    // A rejected import must not pass merely because the target state is already
    // active. Switch to a different real campaign before restoring the download.
    assert.notEqual(fixture.pack.meta.id,'machine-dawn');await launch('machine-dawn');
    start=performance.now();await upload('#save-file',exported,'large-save-export.json');await page.waitForFunction(id=>__voidward?.pack.meta.id===id,fixture.pack.meta.id);timings.uiExportReimportMs=performance.now()-start;
    restored=await snapshot();assert.ok(isDeepStrictEqual(restored.state,fixture.state),'Exported large save did not restore every state field');assert.ok(isDeepStrictEqual(restored.pack.raw,fixture.pack.raw),'Exported large save did not restore its pack');
    Object.assign(timings,{status:'PASS',stateParity:'Every authoritative state field and every pack file compared after import, UI export and reimport from a different active campaign'});
    // This synthetic record must not consume the profile's storage budget for
    // independent later cases. Keep the active state until the next fixture loads.
    await page.evaluate(()=>{const key=localStorage.getItem('vanillajs.voidward.active.v1');if(key)localStorage.removeItem(key);});
  });
  await check('large-list-filtering',async()=>{
    const c=campaigns.find(c=>c.id==='grand-frontier');let large=Object.fromEntries(await Promise.all([...PACK_FILES,...c.files].map(async f=>[f+'.txt',await fs.readFile(new URL(f+'.txt',c.base),'utf8')])));const lp=parsePack(large),protectedHomes=new Set(lp.empires.slice(1).map(e=>e.home*lp.rules.planetsPerSystem));
    large=editSetting(large,'campaign','id','browser-large-empire');large=writeRows(large,'starts',[{empire:0,minerals:90000,energy:90000,science:0,colonies:Array.from({length:lp.map.length*lp.rules.planetsPerSystem},(_,i)=>i).filter(i=>!protectedHomes.has(i)).slice(0,48)}]);const ships=readRows(large,'ships'),family=ships.filter(s=>s.empire==='0');large=writeRows(large,'ships',ships.filter(s=>s.empire!=='0').concat(Array.from({length:24},(_,i)=>({...family[i%family.length],name:'Browser Fleet '+i}))));await loadTextPack(exportPack(large));assert.equal((await snapshot()).state.fleets.filter(f=>f.owner===0).length,24);assert.ok((await snapshot()).state.planets.filter(p=>p.owner===0).length>=48);for(const [name,id]of[['Colonies','colonies'],['Fleets','fleets'],['Turn reports','reports']]){await nav(name).click();const before=JSON.stringify((await snapshot()).state);await page.locator(`#search-${id}`).fill('NO_SUCH_NAME_9821');assert.equal(await page.locator(`#search-${id}`).inputValue(),'NO_SUCH_NAME_9821');assert.match(await page.locator('main').innerText(),/No matching|0 dispatches|0 recent/i);await page.locator(`#search-${id}`).fill('');assert.equal(JSON.stringify((await snapshot()).state),before);}
    await nav('Galaxy map').click();await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement?.blur());
    await page.waitForFunction(()=>document.querySelector('.star-node.selected span')&&getComputedStyle(document.querySelector('.star-node.selected span')).visibility==='visible');
    receipt.chartLabels=await page.evaluate(()=>{
      const buttons=[...document.querySelectorAll('.star-node')],labels=buttons.map(b=>b.querySelector('span')).filter(label=>getComputedStyle(label).visibility==='visible'),overlaps=[];
      for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].getBoundingClientRect(),b=labels[j].getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)overlaps.push([labels[i].textContent,labels[j].textContent]);}
      return{buttons:buttons.length,visible:labels.length,crowded:buttons.filter(b=>b.classList.contains('label-crowded')).length,overlaps,accessibleNamesComplete:buttons.every(b=>b.getAttribute('aria-label')?.includes(b.querySelector('span').textContent))};
    });
    assert.deepEqual(receipt.chartLabels.overlaps,[],'Visible large-chart labels overlap');assert.equal(receipt.chartLabels.accessibleNamesComplete,true);assert.ok(receipt.chartLabels.crowded>0,'Large-chart fixture must exercise hidden crowded labels');
    await page.screenshot({path:path.join(out,'large-chart-labels.png'),fullPage:true});
    await page.keyboard.press('Tab');const crowded=page.locator('.star-node.label-crowded').first();await crowded.focus();
    assert.equal(await crowded.evaluate(b=>b.matches(':focus-visible')&&getComputedStyle(b.querySelector('span')).visibility==='visible'),true,'Keyboard focus must reveal the full crowded label');await crowded.blur();
  });
  await check('audio-preferences',async()=>{
    await page.evaluate(()=>{
      const connect=AudioNode.prototype.connect;window.__qaAudioMeters=[];
      AudioNode.prototype.connect=function(destination,...args){
        const result=connect.call(this,destination,...args);
        if(destination instanceof AudioDestinationNode){const meter=this.context.createAnalyser();meter.fftSize=2048;connect.call(this,meter);window.__qaAudioMeters.push(meter);}
        return result;
      };
    });
    const before=JSON.stringify((await snapshot()).state);await page.locator('header [data-action="settings"]').click();await page.locator('#audio-enabled').check();await page.waitForFunction(()=>__voidward.audio.context==='running');
    receipt.audioSignal=await page.evaluate(async()=>{let peak=0;for(let n=0;n<30;n++){for(const meter of window.__qaAudioMeters){const data=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(data);for(const x of data)peak=Math.max(peak,Math.abs(x));}if(peak>0.00001)break;await new Promise(r=>setTimeout(r,50));}return{meters:window.__qaAudioMeters.length,peak,meaning:'Nonzero signal on nodes connected to the real audio destination; no human listening claim.'};});
    assert.ok(receipt.audioSignal.peak>0.00001,'Enabled music/effects must produce a nonzero audio signal');
    await page.locator('#music-volume').focus();await page.keyboard.press('Home');await page.locator('#effects-volume').focus();await page.keyboard.press('Home');for(let i=0;i<35;i++)await page.keyboard.press('ArrowRight');assert.equal((await snapshot()).audio.levels.music,0);assert.equal((await snapshot()).audio.levels.effects,.35);await page.locator('#motion-setting').selectOption('reduce');await close();await page.reload();await page.waitForFunction(()=>__voidward?.state);assert.equal((await snapshot()).audio.levels.music,0);assert.equal((await snapshot()).audio.levels.effects,.35);assert.equal(JSON.stringify((await snapshot()).state),before);
  });
  await check('keyboard-responsive-touch',async()=>{
    await launch('frontier');await page.locator('main').focus();await page.keyboard.press('4');assert.equal((await snapshot()).view,'research');await page.locator('main').focus();await page.keyboard.press('e');assert.equal((await snapshot()).state.turn,2);await nav('Ship designer').click();await page.locator('#design-name').fill('Typed');await page.locator('#design-name').press('e');assert.equal((await snapshot()).state.turn,2);await action('help').first().click();await page.keyboard.press('e');assert.equal((await snapshot()).state.turn,2);await close();
    for(const width of [390,320]){await page.setViewportSize({width,height:844});for(const name of ['Galaxy map','Colonies','Fleets','Research','Ship designer','Campaign workshop']){await nav(name).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${name}`);}await page.screenshot({path:path.join(out,`narrow-${width}.png`),fullPage:true});}
    const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});try{const phone=await touch.newPage();observe(phone);await phone.goto(url);await phone.waitForFunction(()=>__voidward?.state);await phone.locator('[data-action="colonize"]').first().tap();assert.equal(await phone.evaluate(()=>__voidward.state.planets.filter(p=>p.owner===0).length),2);await phone.locator('[data-action="end"]').tap();assert.equal(await phone.evaluate(()=>__voidward.state.turn),2);}finally{await touch.close();}await page.setViewportSize({width:1440,height:1000});
  });
  await check('offline',async()=>{
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});const before=(await snapshot()).state.turn;await context.setOffline(true);try{await page.reload();await page.waitForFunction(()=>__voidward?.state);assert.equal((await snapshot()).state.turn,before);await end();}finally{await context.setOffline(false);}
  });
  await check('render-parity-performance',async()=>{
    receipt.performance=[];
    for(const id of ['machine-dawn','grand-frontier']){await launch(id);await nav('Galaxy map').click();const before=JSON.stringify((await snapshot()).state);
      const measurements=await page.evaluate(async()=>{
        const {drawMap,paintPlanet,backdropStats,clearBackdropCache}=await import('./js/render.js'),{bakePlanet}=await import('./vendor/offline-games/shared/surface-detail.js'),{createEngine}=await import('./js/core.js');const snap=__voidward,engine=createEngine(snap.pack),results=[],failures=[];
        function compare(reference,production,label){
          const x=reference.getContext('2d').getImageData(0,0,reference.width,reference.height).data,y=production.getContext('2d').getImageData(0,0,production.width,production.height).data;
          let byteMismatches=0,pixelMismatches=0,lastPixel=-1,maxChannelDelta=0,firstMismatch=null;
          for(let i=0;i<Math.max(x.length,y.length);i++)if(x[i]!==y[i]){
            byteMismatches++;const pixel=Math.floor(i/4);if(pixel!==lastPixel){pixelMismatches++;lastPixel=pixel;}
            maxChannelDelta=Math.max(maxChannelDelta,Math.abs((x[i]??0)-(y[i]??0)));
            firstMismatch??={x:pixel%reference.width,y:Math.floor(pixel/reference.width),channel:'RGBA'[i%4],reference:x[i]??null,production:y[i]??null};
          }
          if(byteMismatches||reference.width!==production.width||reference.height!==production.height)failures.push({label,error:'Exact RGBA parity failed',referenceSize:[reference.width,reference.height],productionSize:[production.width,production.height],byteMismatches,pixelMismatches,maxChannelDelta,firstMismatch,images:{reference:reference.toDataURL('image/png'),production:production.toDataURL('image/png')}});
        }
        for(const palette of ['ocean','gas','ice']){const a=document.createElement('canvas');let b;try{paintPlanet(a,palette);b=bakePlanet(palette);compare(b,a,`planet-${palette}`);}finally{a.remove();b?.remove();}}
        for(const [width,height]of[[600,420],[900,620]]){const a=document.createElement('canvas'),b=document.createElement('canvas');try{
          for(const c of[a,b]){c.style.width=width+'px';c.style.height=height+'px';document.body.append(c);}clearBackdropCache();drawMap(a,snap.state,engine,snap.selected,null,1,'political',{cache:false});drawMap(b,snap.state,engine,snap.selected,null);compare(a,b,`map-${width}x${height}`);
          const reference=[],production=[];for(let i=0;i<5;i++){let start=performance.now();drawMap(a,snap.state,engine,snap.selected,null,1,'political',{cache:false});reference.push(performance.now()-start);start=performance.now();drawMap(b,snap.state,engine,snap.selected,null);production.push(performance.now()-start);}results.push({width,height,referenceMs:reference,productionMs:production,strategy:backdropStats().mode||'UNREPORTED',cache:backdropStats()});
        }finally{a.remove();b.remove();}}
        const cache=backdropStats();if(cache.entries>2||cache.bytes>24*1024*1024)failures.push({label:'cache-budget',error:'Backdrop cache exceeds contract',cache});return{render:results,failures,parity:{status:failures.length?'FAIL':'PASS',comparison:'all RGBA bytes; three planet palettes; two map sizes; zero tolerance'},approximateHeap:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize}:null,saveBytes:new TextEncoder().encode(JSON.stringify(snap.state)).length,domNodes:document.querySelectorAll('*').length,canvasCount:document.querySelectorAll('canvas').length,dpr:devicePixelRatio};
      });assert.equal(JSON.stringify((await snapshot()).state),before);
      for(const failure of measurements.failures)if(failure.images){const images={};for(const [kind,data]of Object.entries(failure.images)){const filename=`parity-${id}-${failure.label}-${kind}.png`;await fs.writeFile(path.join(out,filename),Buffer.from(data.split(',')[1],'base64'));images[kind]=filename;}failure.images=images;}
      const record={campaign:id,...measurements,gpuTrace:{status:'NOT_RUN'},commandToTwoAnimationFramesMs:[],latencyMeaning:'DOM click capture to second animation frame; includes simulation, persistence and rendering, not input device latency'};receipt.performance.push(record);
      // Persist parity evidence before collecting the independent GPU/latency
      // diagnostics. A mismatch remains a hard failure after both workloads.
      await fs.writeFile(path.join(out,'performance-raw.json'),JSON.stringify(receipt.performance,null,2));
      if(options.traceGPU)record.gpuTrace=await traceMap(id);
      for(let i=0;i<5;i++){await page.evaluate(()=>{window.__qaPaint=null;document.addEventListener('click',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>window.__qaPaint=performance.now()-start));},{capture:true,once:true});});await end();await page.waitForFunction(()=>window.__qaPaint!==null);record.commandToTwoAnimationFramesMs.push(await page.evaluate(()=>window.__qaPaint));}
      await fs.writeFile(path.join(out,'performance-raw.json'),JSON.stringify(receipt.performance,null,2));
    }
    const failures=receipt.performance.flatMap(p=>p.failures.map(f=>({campaign:p.campaign,...f})));
    assert.deepEqual(failures,[],'Exact RGBA parity or resource budget failed; both images and measurements are retained in performance-raw.json');
  });
  assert.deepEqual(errors,[]);assert.deepEqual(httpFailures,[]);assert.deepEqual(externalRequests,[]);receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.error=error.stack;if(current)checks[current]={status:'FAIL',error:error.message};if(receipt.largeSave?.status==='RUNNING')receipt.largeSave.status='FAIL';await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;
}finally{
  receipt.pageErrors=errors;receipt.httpFailures=httpFailures;receipt.externalRequests=externalRequests;receipt.finished=new Date().toISOString();
  try{await fs.writeFile(path.join(out,'expansion-result.json'),JSON.stringify(receipt,null,2));}
  finally{await context?.close().catch(()=>{});}
}
return receipt;
}
