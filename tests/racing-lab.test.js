// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODES,STEP,TRACK_LENGTH,RACE_GATES,stuntRoad,createRace,stepRace} from '../demos/racing-lab/world.js';
import {sceneGeometry,dynamicGeometry} from '../demos/racing-lab/geometry.js';
const drive={throttle:1,steer:.28,boost:true,handbrake:false,jump:false,flip:false};
test('all five racing presets initialize and reject invalid state and timestep',()=>{
  assert.deepEqual(MODES,['retro','circuit','derby','ball','stunt']);
  assert.throws(()=>createRace('none'),RangeError);
  for(const mode of MODES){
    const w=createRace(mode);
    assert.equal(w.mode,mode);assert.equal(w.player.health,100);
    assert.equal(w.tick,0);assert.equal(w.elapsed,0);
    assert.throws(()=>stepRace(w,{},NaN),RangeError);
    assert.throws(()=>stepRace(w,{},-.1),RangeError);
    assert.throws(()=>stepRace(w,{},1),RangeError);
  }
});
test('identical tick inputs generate identical Float64 sessions without ambient randomness',()=>{
  for(const mode of MODES){
    const a=createRace(mode),b=createRace(mode);
    for(let i=0;i<800;i++){
      const input={throttle:i%120<95?1:-.7,steer:i%180<70?.4:-.25,
        boost:i%140<25,handbrake:i%90<15,jump:i%100===0,flip:i%100<26};
      stepRace(a,input);stepRace(b,input);
    }
    assert.deepEqual(a,b,mode);
    assert.ok(Number.isFinite(a.player.x));assert.ok(Number.isFinite(a.player.y));
    assert.ok(Number.isFinite(a.player.speed));assert.ok(a.tick<=800);
  }
});
test('retro tour counts passed distance and impacts, with boost and road shoulder friction',()=>{
  const w=createRace('retro');
  stepRace(w,{throttle:1,boost:true},STEP);
  assert.ok(w.player.speed>0);assert.ok(w.player.boost<100);
  w.player.x=8;w.player.speed=50;
  stepRace(w,{throttle:0});
  assert.ok(w.player.x<=6.3);assert.ok(w.player.speed<50);
  w.player.x=0;w.player.cooldown=0;
  const bot=w.bots[0];bot.x=0;bot.s=w.distance+2;
  w.player.speed=60;stepRace(w,{throttle:1});
  assert.ok(w.contacts>=1);
  w.distance=3599.99;w.player.speed=70;
  stepRace(w,{throttle:1});assert.equal(w.finished,true);
  assert.equal(w.player.lap,3);
});
test('ordered circuit gates count three complete laps',()=>{
  const w=createRace('circuit');w.bots=[];
  for(let lap=0;lap<3;lap++){
    for(let i=1;i<=8;i++){
      const target=RACE_GATES[i%8];
      w.player.x=target.x;w.player.z=target.z;w.player.speed=0;
      stepRace(w,{});
    }
  }
  assert.equal(w.player.lap,3);assert.equal(w.finished,true);
  const tick=w.tick;stepRace(w,{throttle:1});assert.equal(w.tick,tick);
});
test('derby impacts can disable rivals without unbounded negative health',()=>{
  const w=createRace('derby'),b=w.bots[0];
  w.bots=[b];b.x=w.player.x+.5;b.z=w.player.z;b.health=1;b.cooldown=0;
  stepRace(w,{throttle:1});
  assert.equal(b.health,0);assert.equal(w.player.knockouts,1);
  assert.ok(w.player.health>=0);assert.ok(w.contacts>0);
});
test('derby ram advantage permits the four-knockout objective without symmetric self-destruction',()=>{
  const w=createRace('derby'),b=w.bots[0],p=w.player;
  w.bots=[b];
  for(let i=0;i<4;i++){
    p.cooldown=0;p.x=0;p.z=0;p.vx=0;p.vz=0;p.speed=20;
    b.x=.5;b.z=0;b.vx=0;b.vz=0;b.speed=0;b.health=20;b.cooldown=0;
    stepRace(w,{throttle:1});
  }
  assert.equal(p.knockouts,4);
  assert.ok(p.health>0,'four knocks must be achievable with health remaining');
  assert.equal(w.result,'DERBY CHAMPION');
});
test('car football awards a goal only inside the mouth',()=>{
  const w=createRace('ball');w.bots=[];
  w.ball.x=20;w.ball.z=-59;stepRace(w,{});
  assert.equal(w.score[0],0);assert.ok(w.ball.z>=-58);
  w.ball.x=0;w.ball.z=-59;stepRace(w,{});
  assert.equal(w.score[0],1);assert.equal(w.ball.z,0);
  w.ball.x=0;w.ball.z=59;stepRace(w,{});
  assert.equal(w.score[1],1);
});
test('stunt circuit has elevated ramps, two real gaps, controlled descent and respawn',()=>{
  assert.equal(stuntRoad(0),2);assert.equal(stuntRoad(160),9);
  assert.equal(stuntRoad(220),null);assert.equal(stuntRoad(600),null);
  assert.equal(stuntRoad(TRACK_LENGTH),2);
  const w=createRace('stunt');
  w.player.z=-195;w.player.y=9;w.player.speed=40;
  w.player.vx=0;w.player.vz=-40;w.player.grounded=true;
  for(let i=0;i<38;i++)stepRace(w,{throttle:1});
  assert.ok(w.player.z< -210,'car reaches first broken span');
  assert.ok(w.player.y<=9.1);
  // Force a miss and prove recovery is bounded.
  w.player.x=16;
  stepRace(w,{});
  assert.equal(w.event,'TRACK FALL · RESPAWN -18 HP');
  assert.equal(w.player.x,0);
  assert.ok(w.player.health<100);
  w.player.z=-TRACK_LENGTH+.1;w.player.y=2;w.player.speed=30;
  w.player.vz=-30;w.player.grounded=true;
  stepRace(w,{throttle:1});
  assert.equal(w.player.lap,1);assert.ok(w.player.z>-10);
});
test('low-poly geometry remains finite, non-empty and bounded for each mode',()=>{
  for(const mode of MODES.filter(v=>v!=='retro')){
    const w=createRace(mode),scene=sceneGeometry(mode),cars=dynamicGeometry(w);
    assert.ok(scene.length>0&&scene.length<250000,mode);
    assert.ok(cars.length>0&&cars.length<50000,mode);
    for(const list of [scene,cars]){
      assert.equal(list.length%6,0);
      assert.ok(list.every(Number.isFinite),mode);
    }
    stepRace(w,drive);assert.ok(dynamicGeometry(w).every(Number.isFinite));
  }
});
test('browser entrypoint and CSS expose each mode and core safety controls',async()=>{
  const html=await readFile(new URL('../demos/racing-lab/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../demos/racing-lab/app.js',import.meta.url),'utf8');
  for(const mode of MODES)assert.match(html,new RegExp('data-mode="'+mode+'"'));
  for(const control of ['pause','reset','launch','export'])assert.match(html,new RegExp('id="'+control+'"'));
  for(const event of ['visibilitychange','pagehide','blur','webglcontextlost'])assert.ok(app.includes(event));
});

test('homepage gives Racing and FPS distinct links and keeps both visible in narrow navigation',async()=>{
  const home=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const css=await readFile(new URL('../demos/flight-lab/style.css',import.meta.url),'utf8');
  assert.match(home,/<a class="racing-link" href="demos\/racing-lab\/index\.html">/);
  assert.match(home,/<a class="fps-link" href="demos\/fps-lab\/index\.html">/);
  assert.equal((home.match(/class="fps-link"/g)||[]).length,1,'FPS browser selector must match one link');
  assert.match(css,/@media\(max-width:780px\)[^\n]*\.masthead nav a\.racing-link\{display:inline;/,
    'the Racing Lab entry must stay visible in compact navigation');
});
