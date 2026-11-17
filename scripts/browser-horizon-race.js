// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {parseRaceProject} from '../demos/horizon-lab/race-project.js';
const snapshot=page=>page.evaluate(()=>__horizonRace.snapshot());
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-race');
const speed=s=>Math.hypot(...s.player.velocity);
async function ticks(page,count){const before=(await snapshot(page)).ticks;await page.waitForFunction(n=>__horizonRace.snapshot().ticks>=n,before+count);}
async function pixels(page){return page.evaluate(()=>{dispatchEvent(new Event('resize'));const canvas=document.querySelector('#race-canvas'),gl=canvas.getContext('webgl'),data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);let hash=2166136261,lit=0;const colors=new Set();for(let i=0;i<data.length;i+=4){hash=Math.imul(hash^data[i],16777619);hash=Math.imul(hash^data[i+1],16777619);if(data[i]+data[i+1]+data[i+2]>100)lit++;if(i%64===0)colors.add((data[i]>>4)*256+(data[i+1]>>4)*16+(data[i+2]>>4));}return {hash:hash>>>0,lit,colors:colors.size,error:gl.getError()};});}
/** Actual key handlers and actual fixed-step vehicle motion. Read-only route advice
 * chooses the next key press; no state teleport, checkpoint mutation or model stepping. */
export async function driveRaceWithKeyboard(page){
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.locator('#race-start').click();const held=new Set(),started=Date.now();let s;
  try{for(let i=0;i<1000;i++){
    s=await snapshot(page);if(s.phase==='finished')break;assert.equal(s.running,true,'race remains running');assert.equal(s.player.needsRecovery,false,'real course requires no recovery');
    const a=s.drivingAdvice,wanted=new Set();if(a.throttle>.2)wanted.add('KeyW');if(a.brake>.2)wanted.add('KeyS');if(a.steer>.045)wanted.add('KeyD');else if(a.steer<-.045)wanted.add('KeyA');
    for(const key of held)if(!wanted.has(key)){await page.keyboard.up(key);held.delete(key);}for(const key of wanted)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}await page.clock.runFor(67);
  }}finally{for(const key of held)await page.keyboard.up(key);await page.clock.resume();}
  s=await snapshot(page);assert.equal(s.phase,'finished','ordered finish reached through real keyboard driving');assert.equal(s.progress.checkpointIndex,s.checkpointCount);assert.equal(s.progress.recoveries,0);assert.ok(s.rivalProgress.distance>200,'rival actually drives the same world');assert.ok(s.time>30&&s.time<65);return {time:s.time,result:s.result,checkpoints:s.checkpointCount,position:s.player.position,rivalDistance:s.rivalProgress.distance,wallMilliseconds:Date.now()-started,graphics:s.view.graphics};
}
/** Real authoring, key/touch handlers, gear telemetry and physics; no hidden setters. */
export async function checkHorizonReverse(browser,base){
  const context=await browser.newContext({viewport:{width:800,height:900},hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'demos/horizon-lab/index.html');await ready(page);await page.emulateMedia({reducedMotion:'reduce'});
    const project=JSON.parse((await snapshot(page)).project);project.scenery.profile='low';project.race.countdownSeconds=0;
    await page.getByText('Inspect or edit race JSON',{exact:true}).click();await page.locator('#race-json').fill(JSON.stringify(project));await page.locator('#race-apply-json').click();assert.equal(JSON.parse((await snapshot(page)).project).race.countdownSeconds,0);
    await page.locator('#race-sound').click();await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    const initial=(await snapshot(page)).player.position.slice();await page.locator('#race-start').click();await page.keyboard.down('KeyS');await page.clock.runFor(1500);let reversed=await snapshot(page);
    assert.equal(reversed.player.gear,-1);assert.ok(reversed.player.position[2]>initial[2]+1,'S physically reverses from rest');assert.ok(speed(reversed)>2);assert.equal(reversed.progress.checkpointIndex,0);assert.match(await page.locator('#race-gear').textContent(),/^R ·/);assert.equal(await page.locator('#race-player').getAttribute('data-motion'),'reverse');assert.ok(await page.locator('#race-player').evaluate(el=>Number(el.style.getPropertyValue('--rpm-level'))>0));assert.equal(reversed.physicalInput.throttle,1);assert.equal(reversed.audio.stream.gear,-1);assert.ok(reversed.audio.stream.controls.throttle>.5);assert.notEqual(reversed.player.wheelSpin,0);assert.ok(reversed.rivalProgress.distance>12);
    await page.keyboard.down('Space');await page.clock.runFor(150);let braking=await snapshot(page);assert.equal(braking.player.gear,-1);assert.equal(braking.physicalInput.brake,1);assert.equal(braking.physicalInput.throttle,0);assert.ok(speed(braking)<speed(reversed));await page.keyboard.up('Space');
    // Escape, window blur, driving-focus loss and hidden tabs each clear reverse.
    for(const cancel of ['escape','blur','focus','hidden']){
      if(!(await snapshot(page)).inputs.input.reverse){await page.keyboard.up('KeyS');await page.keyboard.down('KeyS');}
      await page.clock.runFor(100);
      if(cancel==='escape')await page.keyboard.press('Escape');
      else if(cancel==='blur')await page.evaluate(()=>dispatchEvent(new Event('blur')));
      else if(cancel==='focus')await page.locator('#race-name').focus();
      else await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
      let stopped=await snapshot(page);assert.equal(stopped.running,false,cancel+' pauses');assert.equal(stopped.inputs.input.reverse,0);assert.equal(stopped.physicalInput.throttle,0);assert.equal(stopped.audio.voices,0);
      await page.locator('#race-start').click();await page.keyboard.down('KeyS');await page.clock.runFor(50);assert.equal((await snapshot(page)).inputs.input.reverse,0,'held S cannot re-engage after '+cancel);assert.equal((await snapshot(page)).physicalInput.throttle,0);await page.keyboard.up('KeyS');
    }
    await page.keyboard.down('KeyS');await page.clock.runFor(200);await page.keyboard.up('KeyS');const transition=await snapshot(page);assert.ok(speed(transition)>.5);
    await page.keyboard.down('ArrowUp');await page.clock.runFor(20);assert.equal((await snapshot(page)).player.gear,-1,'Up initially brakes a moving reverse vehicle');assert.equal((await snapshot(page)).physicalInput.brake,1);
    let forward;for(let i=0;i<60;i++){await page.clock.runFor(100);forward=await snapshot(page);if(forward.player.gear>0&&forward.player.position[2]<transition.player.position[2]-1)break;}
    await page.keyboard.up('ArrowUp');assert.ok(forward.player.gear>0);assert.ok(forward.player.position[2]<transition.player.position[2]-1,'Up safely returns to physical forward motion');assert.ok(speed(forward)>2);
    await page.keyboard.press('Escape');await page.locator('#race-recover').click();assert.equal((await snapshot(page)).player.gear,1);await page.locator('#race-restart').click();assert.equal((await snapshot(page)).player.gear,1);
    await page.locator('#race-start').click();await page.keyboard.down('ArrowDown');await page.clock.runFor(500);assert.equal((await snapshot(page)).player.gear,-1);await page.keyboard.up('ArrowDown');await page.keyboard.press('Escape');await page.locator('#race-restart').click();
    // Native touch-emulated reverse plus steering, then pointer cancellation.
    await page.setViewportSize({width:320,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#race-start').tap();await page.locator('[data-drive="reverse"]').scrollIntoViewIfNeeded();
    const reverse=await page.locator('[data-drive="reverse"]').boundingBox(),left=await page.locator('[data-drive="left"]').boundingBox(),client=await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:reverse.x+reverse.width/2,y:reverse.y+reverse.height/2,id:1},{x:left.x+left.width/2,y:left.y+left.height/2,id:2}]});await page.clock.runFor(1300);const touched=await snapshot(page);assert.equal(touched.player.gear,-1);assert.equal(touched.inputs.input.reverse,1);assert.equal(touched.inputs.input.steer,-1);assert.ok(touched.player.position[2]>initial[2]+1);assert.ok(Math.abs(touched.player.steering)>.1);assert.equal(touched.progress.checkpointIndex,0);assert.match(await page.locator('#race-gear').textContent(),/^R ·/);
    await page.locator('#race-canvas').screenshot({path:'browser-artifacts/horizon-reverse.png'});
    await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await client.detach();await page.clock.runFor(50);assert.deepEqual((await snapshot(page)).inputs.input,{throttle:0,brake:0,steer:0,reverse:0});assert.equal((await snapshot(page)).physicalInput.throttle,0);
    await page.locator('[data-drive="reverse"]').focus();await page.keyboard.down('Space');assert.equal((await snapshot(page)).inputs.input.reverse,1);await page.keyboard.up('Space');assert.equal((await snapshot(page)).inputs.input.reverse,0);await page.keyboard.press('Escape');await page.locator('#race-restart').click();assert.equal((await snapshot(page)).player.gear,1);assert.deepEqual(errors,[]);
    return {initial,keyboard:{position:reversed.player.position,gear:reversed.player.gear,wheelSpin:reversed.player.wheelSpin,audioGear:reversed.audio.stream.gear},forward:{position:forward.player.position,gear:forward.player.gear},touch:{position:touched.player.position,gear:touched.player.gear,steering:touched.player.steering},checkpointIndex:touched.progress.checkpointIndex};
  }finally{await context.close();}
}
async function checkHorizonSafetyRecovery(browser,base){
  const context=await browser.newContext({viewport:{width:800,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'demos/horizon-lab/index.html');await ready(page);
    assert.equal((await snapshot(page)).courseAssist,true);
    const project=JSON.parse((await snapshot(page)).project);
    project.scenery.profile='low';project.race.countdownSeconds=0;
    await page.getByText('Inspect or edit race JSON',{exact:true}).click();
    await page.locator('#race-json').fill(JSON.stringify(project));await page.locator('#race-apply-json').click();
    await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    // Deliberately unassisted high-speed off-road fixture: the safety path
    // must remain testable despite course assist being enabled by default.
    await page.locator('#race-assist').click();
    assert.equal((await snapshot(page)).courseAssist,false);
    await page.locator('#race-start').click();await page.keyboard.down('KeyW');await page.clock.runFor(11500);
    const recovered=await snapshot(page);
    assert.equal(recovered.running,false,'physics inversion must pause after safe respawn');
    assert.equal(recovered.player.needsRecovery,false,'cannot leave the player inverted after safety recovery');
    assert.equal(recovered.progress.recoveries,1,'exactly one recovery per incident');
    assert.equal(recovered.progress.penaltySeconds,project.race.recoveryPenaltySeconds);
    assert.match(await page.locator('#race-banner').textContent(),/CAR RECOVERED/);
    assert.equal(await page.locator('#race-start').isEnabled(),true);
    assert.equal(await page.locator('#race-recover').isDisabled(),true,'no duplicate safety penalty');
    await page.keyboard.up('KeyW');await page.locator('#race-start').click();
    await page.keyboard.down('KeyW');await page.clock.runFor(600);
    const resumed=await snapshot(page);assert.equal(resumed.running,true);
    assert.equal(resumed.progress.recoveries,1);
    await page.keyboard.up('KeyW');await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    return {recovered:recovered.player.position,penalty:recovered.progress.penaltySeconds,resumedTick:resumed.ticks};
  }finally{await context.close();}
}
export async function checkHorizonRace(browser,base){
  const context=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true}),page=await context.newPage(),errors=[],evidence={scope:'Packaged native Chromium/SwiftShader, actual DOM input handlers and fixed-step vehicle physics; no physical GPU, mobile or controller claim.'};page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);await mkdir('browser-artifacts',{recursive:true});
  try{
    // The public HORIZON URL must start the physical racing player, not the
    // earlier scenery camera tour. Keep the specialist workshop discoverable.
    await page.goto(base+'demos/horizon-lab/index.html');await ready(page);
    assert.equal(await page.locator('#tour').count(),0,'canonical HORIZON entry is not the orbit-only scenery study');
    await page.getByRole('link',{name:'Scenery Atelier',exact:true}).click();
    assert.equal(page.url(),base+'demos/horizon-lab/scenery.html');
    await page.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-lab');
    assert.equal(await page.locator('#tour').isVisible(),true,'original camera workshop remains accessible');
    await page.getByRole('link',{name:'Race Foundry',exact:true}).click();
    assert.equal(page.url(),base+'demos/horizon-lab/index.html');await ready(page);
    const alias=await context.newPage();alias.on('pageerror',e=>errors.push(e.message));
    await alias.goto(base+'demos/horizon-lab/race.html');await ready(alias);
    assert.equal(await alias.locator('#race-start').isEnabled(),true,'previous direct race URL remains playable');
    assert.equal((await snapshot(alias)).project,(await snapshot(page)).project);
    await alias.close();await page.bringToFront();
    let s=await snapshot(page);
    assert.equal(s.courseAssist,true);assert.equal(await page.locator('#race-assist').getAttribute('aria-pressed'),'true');
    await page.locator('#race-assist').click();assert.equal((await snapshot(page)).courseAssist,false);
    await page.locator('#race-assist').click();assert.equal((await snapshot(page)).courseAssist,true);
    assert.equal(s.running,false);assert.equal(s.phase,'ready');assert.equal(s.view.graphics.profile,'high');const initial=await pixels(page);assert.ok(initial.lit>10000&&initial.colors>12);assert.equal(initial.error,0);const initialPosition=s.player.position.slice(),uploads=s.view.graphics.uploads;evidence.entry=page.url();evidence.high=s.view.graphics;await page.screenshot({path:'browser-artifacts/horizon-race-desktop.png',fullPage:true});
    // Every advertised camera changes the actual renderer pose and pixels.
    const cameraPositions=new Set(),cameraPixels=new Set();for(const mode of ['bonnet','cockpit','chase']){await page.locator('button[data-camera="'+mode+'"]').click();assert.equal((await snapshot(page)).view.cameraMode,mode);const image=await pixels(page);assert.equal(image.error,0);cameraPositions.add(JSON.stringify((await snapshot(page)).view.camera.position));cameraPixels.add(image.hash);}assert.equal(cameraPositions.size,3);assert.equal(cameraPixels.size,3);
    await page.locator('#race-sound').click();assert.equal((await snapshot(page)).audio.enabled,true);await page.locator('#race-start').click();await page.keyboard.down('KeyW');await ticks(page,430);await page.keyboard.up('KeyW');let moving=await snapshot(page);assert.ok(speed(moving)>2);assert.ok(Math.hypot(...moving.player.position.map((n,i)=>n-initialPosition[i]))>.4,'W must move the car in world space at the public index URL');assert.ok(moving.audio.started>0);assert.ok(moving.audio.voices<=moving.audio.maxVoices);assert.equal(moving.view.graphics.uploads,uploads);await page.locator('#race-canvas').screenshot({path:'browser-artifacts/horizon-race-at-speed.png'});await page.keyboard.press('Escape');s=await snapshot(page);assert.equal(s.audio.voices,0);assert.equal(s.inputs.input.throttle,0);await page.waitForTimeout(150);assert.equal((await snapshot(page)).ticks,s.ticks);assert.equal((await snapshot(page)).view.frames,s.view.frames);
    // Focus loss cancels held controls and audio; resuming requires fresh input.
    await page.locator('#race-start').click();await page.keyboard.down('KeyW');await ticks(page,15);await page.evaluate(()=>dispatchEvent(new Event('blur')));assert.equal((await snapshot(page)).running,false);assert.equal((await snapshot(page)).audio.voices,0);await page.locator('#race-start').click();await page.keyboard.down('KeyW');assert.equal((await snapshot(page)).inputs.input.throttle,0);await page.keyboard.up('KeyW');await page.keyboard.down('KeyW');await ticks(page,15);assert.equal((await snapshot(page)).inputs.input.throttle,1);await page.keyboard.up('KeyW');await page.keyboard.press('Escape');await page.locator('#race-restart').click();assert.equal((await snapshot(page)).phase,'ready');
    // Existing independent route-input reference is explicitly unassisted.
    await page.locator('#race-assist').click();
    assert.equal((await snapshot(page)).courseAssist,false);
    // Full route through actual key handlers; low profile bounds software-render time.
    await page.locator('#quality').selectOption('low');await page.locator('#race-apply').click();await page.setViewportSize({width:800,height:900});evidence.race=await driveRaceWithKeyboard(page);await page.locator('#race-canvas').screenshot({path:'browser-artifacts/horizon-race-finish.png'});assert.equal((await snapshot(page)).running,false);
    // Meaningful track edits, original silhouettes, material/engine and accepted history.
    await page.locator('#race-name').fill('Coastal creator trial');await page.locator('#knot').selectOption('2');await page.locator('#knot-y').fill('8');await page.locator('#knot-bank').fill('-0.04');await page.locator('#knot-width').fill('17');await page.locator('#knot-surface').selectOption('gravel');await page.locator('#environment').selectOption('dusk');await page.locator('#race-apply').click();s=await snapshot(page);const edited=JSON.parse(s.project);assert.equal(edited.scenery.road[2].y,8);assert.equal(edited.scenery.road[2].surface,'gravel');assert.equal(edited.scenery.environment,'dusk');assert.equal(s.phase,'ready');
    await page.getByText('02 — Body, paint & materials',{exact:true}).click();await page.locator('#vehicle-class').selectOption('utility');assert.equal(JSON.parse((await snapshot(page)).project).vehicle.mass,1750);await page.locator('#vehicle-class').selectOption('touring');assert.equal(JSON.parse((await snapshot(page)).project).appearance.classId,'touring');await page.locator('#paint').fill('#6677aa');await page.locator('#roughness').fill('.6');await page.getByText('03 — Engine, grip & suspension',{exact:true}).click();await page.locator('#final-drive').fill('4');await page.locator('#spring').fill('42000');await page.getByText('05 — Original engine synthesis',{exact:true}).click();await page.locator('#exhaust-tone').fill('1.4');await page.locator('#race-apply').click();const accepted=(await snapshot(page)).project;assert.equal(JSON.parse(accepted).audio.exhaustTone,1.4);assert.equal(JSON.parse(accepted).vehicle.gearbox.finalDrive,4);await page.locator('#race-undo').click();assert.notEqual((await snapshot(page)).project,accepted);await page.locator('#race-redo').click();assert.equal((await snapshot(page)).project,accepted);
    await page.getByText('Inspect or edit race JSON',{exact:true}).click();const bad=JSON.parse(accepted);bad.run='globalThis.horizonCompromised=true';const stateBefore=(await snapshot(page)).player;await page.locator('#race-json').fill(JSON.stringify(bad));await page.locator('#race-apply-json').click();assert.match(await page.locator('#author-status').textContent(),/Not applied/);assert.equal((await snapshot(page)).project,accepted);assert.deepEqual((await snapshot(page)).player,stateBefore);assert.equal(await page.evaluate(()=>globalThis.horizonCompromised),undefined);
    await page.locator('#race-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"unsupported"}')});await page.waitForFunction(()=>document.querySelector('#author-status').textContent.startsWith('Not applied'));assert.equal((await snapshot(page)).project,accepted);
    const downloaded=page.waitForEvent('download');await page.locator('#race-export-project').click();const raw=await readFile(await (await downloaded).path());assert.deepEqual(parseRaceProject(raw.toString()),JSON.parse(accepted));await page.locator('#race-defaults').click();await page.locator('#race-import').setInputFiles({name:'accepted.json',mimeType:'application/json',buffer:raw});await page.waitForFunction(()=>document.querySelector('#author-status').textContent==='Validated race imported.');assert.equal((await snapshot(page)).project,accepted);
    // Race restart and failed import restore an invalidated asynchronous export button.
    await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle),pending=[];crypto.subtle.digest=(...args)=>new Promise(resolve=>pending.push(()=>original(...args).then(resolve)));globalThis.finishRaceHash=()=>{crypto.subtle.digest=original;for(const release of pending)release();};});await page.locator('#race-export-game').click();assert.equal(await page.locator('#race-export-game').isDisabled(),true);await page.locator('#race-restart').click();assert.equal(await page.locator('#race-export-game').isEnabled(),true);await page.locator('#race-export-game').click();assert.equal(await page.locator('#race-export-game').isDisabled(),true);await page.locator('#race-import').setInputFiles({name:'failed-during-export.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#author-status').textContent.startsWith('Not applied'));assert.equal(await page.locator('#race-export-game').isEnabled(),true);await page.evaluate(()=>finishRaceHash());
    // Native loss/restoration keeps accepted project and race state.
    const stateLoss=(await snapshot(page)).player;await page.locator('#race-canvas').evaluate(canvas=>{globalThis.raceLoss=canvas.getContext('webgl').getExtension('WEBGL_lose_context');if(!raceLoss)throw Error('Native context loss required');raceLoss.loseContext();});await page.waitForFunction(()=>__horizonRace.snapshot().lost);await page.waitForTimeout(100);await page.evaluate(()=>raceLoss.restoreContext());await page.waitForFunction(()=>!__horizonRace.snapshot().lost&&__horizonRace.snapshot().view?.graphics.frames>0);assert.equal((await snapshot(page)).project,accepted);assert.deepEqual((await snapshot(page)).player,stateLoss);assert.equal((await snapshot(page)).running,false);assert.equal((await pixels(page)).error,0);
    await page.locator('#race-defaults').click();await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#race-start').tap();await page.locator('[data-drive="throttle"]').scrollIntoViewIfNeeded();const t=await page.locator('[data-drive="throttle"]').boundingBox(),l=await page.locator('[data-drive="left"]').boundingBox(),client=await context.newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:t.x+t.width/2,y:t.y+t.height/2,id:1},{x:l.x+l.width/2,y:l.y+l.height/2,id:2}]});assert.deepEqual((await snapshot(page)).inputs.input,{throttle:1,brake:0,steer:-1,reverse:0});await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual((await snapshot(page)).inputs.input,{throttle:0,brake:0,steer:0,reverse:0});await client.detach();await page.keyboard.press('Escape');await page.screenshot({path:'browser-artifacts/horizon-race-mobile.png',fullPage:true});
    await page.waitForFunction(async scope=>(await navigator.serviceWorker.getRegistrations()).some(r=>r.scope===scope&&r.active?.state==='activated'),base,{timeout:45000});await context.setOffline(true);const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));const response=await offline.goto(base+'demos/horizon-lab/index.html');assert.equal(response.fromServiceWorker(),true);await ready(offline);await offline.locator('#race-start').click();await offline.keyboard.down('KeyW');await ticks(offline,425);await offline.keyboard.up('KeyW');await offline.keyboard.press('Escape');assert.ok(speed(await snapshot(offline))>1);evidence.offline={fromServiceWorker:response.fromServiceWorker(),position:(await snapshot(offline)).player.position};await offline.locator('#race-recover').click();const backStart=(await snapshot(offline)).player.position.slice();await offline.locator('#race-start').click();await offline.keyboard.down('ArrowDown');await ticks(offline,180);await offline.keyboard.up('ArrowDown');await offline.keyboard.press('Escape');const back=await snapshot(offline);assert.equal(back.player.gear,-1);assert.ok(back.player.position[2]>backStart[2]+1,'offline player physically reverses');evidence.offline.reversePosition=back.player.position;assert.deepEqual(errors,[]);
  }finally{await context.close();}
  const fallback=await browser.newContext(),p=await fallback.newPage();try{await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});await p.goto(base+'demos/horizon-lab/index.html');await ready(p);assert.equal(await p.locator('#race-graphics-error').isVisible(),true);assert.equal(await p.locator('#race-start').isDisabled(),true);await p.locator('#race-name').fill('Editable without graphics');await p.locator('#race-apply').click();assert.equal(JSON.parse((await snapshot(p)).project).name,'Editable without graphics');const download=p.waitForEvent('download');await p.locator('#race-export-project').click();await download;}finally{await fallback.close();}
  // Device rejection is independent of graphics and does not prevent driving.
  const unavailable=await browser.newContext(),noAudio=await unavailable.newPage();try{await noAudio.addInitScript(()=>{globalThis.AudioContext=class {constructor(){throw Error('Test device unavailable');}};});await noAudio.goto(base+'demos/horizon-lab/index.html');await ready(noAudio);await noAudio.locator('#race-sound').click();assert.equal((await snapshot(noAudio)).audio.enabled,false);assert.match(await noAudio.locator('#race-status').textContent(),/Audio unavailable/);await noAudio.locator('#race-start').click();await ticks(noAudio,15);assert.equal((await snapshot(noAudio)).running,true);await noAudio.keyboard.press('Escape');}finally{await unavailable.close();}
  // A delayed older native resume must not stop a newer successful gesture.
  const delayed=await browser.newContext(),late=await delayed.newPage();try{await late.addInitScript(()=>{const Native=AudioContext;let first=true;globalThis.AudioContext=class extends Native{resume(){const result=super.resume();if(!first)return result;first=false;return new Promise(resolve=>{globalThis.releaseOldRaceResume=()=>result.then(resolve);});}};});await late.goto(base+'demos/horizon-lab/index.html');await ready(late);await late.locator('#race-sound').click();assert.equal((await snapshot(late)).audio.enabled,true);await late.locator('#race-pause').evaluate(b=>b.click());await late.evaluate(()=>dispatchEvent(new Event('blur')));await late.locator('#race-start').click();await ticks(late,20);assert.equal((await snapshot(late)).audio.active,true);await late.evaluate(()=>releaseOldRaceResume());await ticks(late,10);assert.equal((await snapshot(late)).audio.active,true,'stale native resume cannot cancel newer audio');assert.ok((await snapshot(late)).audio.started>0);await late.keyboard.press('Escape');assert.equal((await snapshot(late)).audio.voices,0);}finally{await delayed.close();}
  evidence.reverse=await checkHorizonReverse(browser,base);
  evidence.failSafe=await checkHorizonSafetyRecovery(browser,base);await writeFile('browser-artifacts/horizon-race-diagnostics.json',JSON.stringify(evidence,null,2)+'\n');
  console.log('HORIZON race: bridge guardrails and recoverable rollover, real keyboard/touch reverse, safe direction changes and cancellation, canonical index car movement, scenery/return navigation, race alias, actual keyboard course completion, rival/checkpoints/finish, three cameras/classes, course/vehicle/audio editing, strict rollback/history/export cancellation, sound lifecycle, 320px touch, native context recovery, graphics fallback and offline startup PASS');
}
