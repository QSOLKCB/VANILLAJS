// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {create,step,chooseUpgrade,stats,reload,cancelInput,waveSize,leadPoint} from '../demos/skyguard-lab/js/sim.js';
import {STATIONS,DIFFICULTIES,UPGRADES} from '../demos/skyguard-lab/js/content.js';
import {makeScore,makeEffect} from '../demos/skyguard-lab/js/audio.js';
import {FixedClock} from '../modules/time/index.js';
function station(id){const s=create();while(s.station!==id){s.status='upgrade';s.offers=['repair'];chooseUpgrade(s,'repair');}return s;}
function enemy(id,x,y,kind='drone',hp=40){return {id,x,y,oldX:x,oldY:y,vx:0,vy:0,lane:x,kind,hp,size:kind==='bomber'?34:16,phase:0,age:0,flash:0};}
function fixture(id,enemies){const s=station(id);s.enemies=enemies;s.total=enemies.length;s.spawned=enemies.length;s.nextId=100;return s;}
function pilot(s){const e=s.enemies.reduce((a,b)=>!a||b.y>a.y?b:a,null),p=stats(s);let aim=e?{x:e.x,y:e.y}:s.aim;if(e&&s.station==='cannon')aim=leadPoint(e,p.speed);if(e&&s.station==='flak')aim={x:e.x+e.vx*28,y:e.y+e.vy*28};return {...aim,fire:!!e&&(s.station!=='rail'||s.charge<p.charge)};}
test('Skyguard rejects malformed setup and controls before mutating combat',()=>{
  for(const difficulty of ['__proto__','night',''])assert.throws(()=>create({difficulty}));
  for(const seed of [-1,1.1,NaN,Infinity,4294967296])assert.throws(()=>create({seed}));
  const s=create();for(const input of [{x:NaN},{y:Infinity},{fire:1},{reload:'yes'}]){const before=structuredClone(s);assert.throws(()=>step(s,input));assert.deepEqual(s,before);}
});
test('Cadet begins with eight contacts, grows every raid and limits active aircraft',()=>{
  assert.deepEqual([1,2,3,4].map(r=>waveSize(r)),[8,10,12,14]);
  for(const difficulty of Object.keys(DIFFICULTIES))for(let r=1;r<100;r++)assert.ok(waveSize(r+1,difficulty)>waveSize(r,difficulty));
  const s=create();for(let i=0;i<600;i++){step(s);assert.ok(s.enemies.length<=4);}assert.equal(s.spawned,4);const next=s.nextSpawn;for(let i=0;i<30;i++)step(s);assert.equal(s.nextSpawn,next,'full field freezes the arrival clock');
});
test('All four naval batteries clear two rotations with refits retained across three seeds',()=>{
  for(const seed of [47,47047,2026]){const s=create({seed}),seen=[];let saved;
    for(let t=0;t<60000&&s.round<=8&&s.status!=='lost';t++){
      step(s,pilot(s));assert.ok(s.enemies.length<=8);assert.ok(s.effects.length<=100);assert.ok(s.debris.length<=160);
      if(s.status==='upgrade'){seen.push(s.station);if(s.round===4)saved=structuredClone(s.upgrades.cannon);if(s.round===5)assert.deepEqual(s.upgrades.cannon,saved);chooseUpgrade(s,s.offers.find(x=>x==='power')||s.offers[0]);}
    }
    assert.equal(s.round,9,'seed '+seed+' survives eight raids');assert.deepEqual(seen,STATIONS.concat(STATIONS).map(s=>s.id));assert.ok(s.kills>100);assert.ok(s.hp>50);
  }
});
test('Autocannon uses swept collision so a tracer cannot jump over an aircraft',()=>{
  const s=fixture('cannon',[enemy(1,512,220)]);s.projectiles=[{id:99,kind:'cannon',x:480,y:220,oldX:480,oldY:220,angle:0,age:0,life:65,damage:80}];
  step(s);step(s);assert.equal(s.kills,1);assert.equal(s.hits,1);
});
test('Autocannon heat requires a release to cool, and reload consumes simulation ticks',()=>{
  const s=create();for(let i=0;i<300&&!s.weapon.overheated;i++)step(s,{x:10,y:10,fire:true});assert.ok(s.weapon.overheated);const shots=s.shots;
  for(let i=0;i<120;i++)step(s,{fire:false});assert.equal(s.shots,shots);assert.ok(!s.weapon.overheated);assert.ok(s.weapon.heat<25);
  assert.ok(reload(s));const ticks=s.weapon.reload;for(let i=0;i<ticks-1;i++)step(s);assert.equal(s.weapon.reload,1);step(s);assert.equal(s.weapon.ammo,stats(s).magazine);
});
test('Flak has a delayed airburst, damages a cluster and misses distant aircraft',()=>{
  const s=fixture('flak',[enemy(1,560,270),enemy(2,605,270),enemy(3,940,120)]);step(s,{x:580,y:290,fire:true});assert.equal(s.kills,0);assert.equal(s.projectiles.length,1);
  for(let i=0;i<40;i++)step(s,{fire:false});assert.equal(s.kills,2);assert.equal(s.enemies[0].id,3);assert.ok(s.events.every(e=>e.type!=='breach'));
});
test('Missiles require a continuous target lock and then steer into moving aircraft',()=>{
  const s=fixture('missile',[enemy(1,400,180)]),ammo=s.weapon.ammo;
  for(let i=0;i<30;i++)step(s,{x:1000,y:100,fire:true});assert.equal(s.weapon.ammo,ammo);assert.equal(s.shots,0);
  for(let i=0;i<stats(s).lock-1;i++)step(s,{x:s.enemies[0].x,y:s.enemies[0].y,fire:true});assert.equal(s.shots,0);
  step(s,{x:s.enemies[0].x,y:s.enemies[0].y,fire:true});assert.equal(s.shots,1);assert.equal(s.projectiles[0].targetId,1);
  const first=s.projectiles[0].angle;step(s,{fire:false});assert.notEqual(s.projectiles[0].angle,first);
  for(let i=0;i<200&&s.status==='playing';i++)step(s,{fire:false});assert.equal(s.kills,1);assert.equal(s.projectiles.length,0);
});
test('A vanished missile target is not silently replaced; the orphan missile expires',()=>{
  const s=fixture('missile',[enemy(1,400,180),enemy(2,850,170)]);for(let i=0;i<24;i++)step(s,{x:400,y:180,fire:true});assert.equal(s.projectiles[0].targetId,1);
  s.enemies[0].hp=0;s.resolved++;for(let i=0;i<180;i++)step(s,{fire:false});assert.equal(s.projectiles.length,0);assert.ok(s.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));
});
test('Railgun fires on charged release, pierces aligned targets and ignores a held trigger',()=>{
  const s=fixture('rail',[enemy(1,576,200),enemy(2,576,300),enemy(3,576,400)]);
  for(let i=0;i<stats(s).charge+30;i++)step(s,{x:s.enemies[0].x,y:100,fire:true});assert.equal(s.shots,0);assert.equal(s.weapon.ammo,5);
  step(s,{x:s.enemies[0].x,y:100,fire:false});assert.equal(s.shots,1);assert.equal(s.kills,3);assert.ok(s.events.some(e=>e.type==='collateral'&&e.count===3));
});
test('Early rail release, reload and lifecycle cancellation cannot discharge a queued beam',()=>{
  const s=station('rail');for(let i=0;i<12;i++)step(s,{fire:true});step(s,{fire:false});assert.equal(s.shots,0);
  for(let i=0;i<stats(s).charge;i++)step(s,{fire:true});cancelInput(s);step(s,{fire:false});assert.equal(s.shots,0);assert.equal(s.charge,0);
  s.weapon.ammo--;for(let i=0;i<stats(s).charge;i++)step(s,{fire:true});assert.ok(reload(s));step(s,{fire:false});assert.equal(s.shots,0);assert.equal(s.charge,0);
});
test('Each specialist refit has a useful effect and drafts cannot exceed rank caps',()=>{
  for(const id of STATIONS.map(x=>x.id)){const s=station(id),before=stats(s);s.upgrades[id].systems++;const after=stats(s);assert.ok(id==='cannon'?after.cool>before.cool&&after.heat<before.heat:id==='flak'?after.radius>before.radius:id==='missile'?after.turn>before.turn&&after.lock<before.lock:after.pierce>before.pierce);}
  const s=create(),before=structuredClone(s);assert.equal(chooseUpgrade(s,'power'),false);assert.deepEqual(s,before);
  assert.ok(UPGRADES.every(u=>u.id==='repair'||Number.isInteger(u.max)));
});
test('Fixed-step raid state agrees at 30, 60 and 144 Hz without consuming ambient randomness',()=>{
  const run=fps=>{const s=create({seed:47}),clock=new FixedClock({step:1/60,maxFrame:.15,maxSteps:8});let ticks=0;while(ticks<1800)clock.advance(1/fps,()=>{if(ticks++<1800)step(s,pilot(s));});return s;};
  assert.deepEqual(run(30),run(60));assert.deepEqual(run(144),run(60));
});
test('Hull damage can end the watch; terminal state is inert and every retry is fresh',()=>{
  const s=create({difficulty:'storm'});for(let i=0;i<15000&&s.status==='playing';i++)step(s);assert.equal(s.status,'lost');assert.equal(s.hp,0);const frozen=structuredClone(s);step(s,{fire:true});assert.deepEqual(s,frozen);assert.equal(create().hp,100);assert.equal(create().shots,0);
});
test('Four naval arrangements export deterministic complete WAVs and effects stay finite',()=>{
  const hash=b=>createHash('sha256').update(b).digest('hex'),hashes=[];
  for(const id of STATIONS.map(s=>s.id)){const a=makeScore(id).wav(),b=makeScore(id).wav();assert.equal(hash(a),hash(b));assert.equal(Buffer.from(a).subarray(0,4).toString(),'RIFF');assert.ok(a.length>1000000);hashes.push(hash(a));}
  assert.equal(new Set(hashes).size,4);
  for(const type of ['cannon','flak','missile','rail','impact','clear','reload','breach','lost']){const pcm=makeEffect(type).renderAll();assert.ok(pcm.length>0);assert.ok(pcm.every(Number.isFinite));}
  assert.throws(()=>makeScore('sniper'));
});
