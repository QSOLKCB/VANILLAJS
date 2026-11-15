/* SPDX-License-Identifier: Apache-2.0 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SubHunt} from '../demos/subhunt-lab/js/sim.js';
const {create,step,SURFACE,FLOOR}=SubHunt;
function advance(s,n,input={}){for(let i=0;i<n;i++)step(s,input);return s;}
function quiet(s){s.enemies.forEach(e=>{e.vx=0;e.cooldown=1000;});s.player.invincible=0;return s;}
function shot(x,y,friendly=true,down=true){return {id:999,x,y,vx:0,vy:down?150:-190,friendly,down,age:0};}

test('both roles replay exactly from the same seed and inputs',()=>{
  for(const role of ['boat','sub']){const a=create(role,314159),b=create(role,314159);for(let i=0;i<9000;i++){
    const input={x:Math.sin(i/80),y:Math.cos(i/93),fire:i%7===0,sonar:i%181===0};step(a,input);step(b,input);
  }assert.deepEqual(a,b);}
});
test('role validation and boundaries reject invalid and unbounded input',()=>{
  assert.throws(()=>create('duck'),TypeError);
  const s=quiet(create('sub'));advance(s,600,{x:100,y:100});assert.equal(s.player.x,935);assert.equal(s.player.y,FLOOR-30);
  advance(s,600,{x:-100,y:-100});assert.equal(s.player.x,65);assert.equal(s.player.y,210);
  advance(s,2,{x:NaN,y:Infinity});assert.ok(Number.isFinite(s.player.x)&&Number.isFinite(s.player.y));
  const boat=quiet(create('boat'));advance(boat,60,{y:1});assert.equal(boat.player.y,SURFACE);
});
test('weapons travel in opposite directions with bounded rate of fire',()=>{
  for(const role of ['boat','sub']){const s=quiet(create(role));step(s,{fire:true});assert.equal(s.projectiles.length,1);
    const q=s.projectiles[0],y=q.y;advance(s,10,{fire:true});assert.equal(s.projectiles.length,1);assert.ok(role==='boat'?q.y>y:q.y<y);
  }
});
test('sonar reveals contacts, clears hostile weapons, and respects cooldown',()=>{
  const s=quiet(create());s.enemies.forEach(e=>e.reveal=0);s.projectiles=[shot(510,160,false,false)];
  advance(s,20,{sonar:true});assert.equal(s.projectiles.length,0);assert.ok(s.enemies.every(e=>e.reveal>3));
  assert.ok(s.player.sonar>6);const age=s.pulse.age;step(s,{sonar:true});assert.ok(s.pulse.age>age);
});
test('ducks block rising weapons from both fleets, but not falling depth charges',()=>{
  for(const friendly of [true,false]){const s=quiet(create('sub'));s.projectiles=[shot(300,155,friendly,false)];
    step(s);assert.equal(s.projectiles.length,0);assert.ok(s.events.some(e=>e.type==='duck'));}
  const s=quiet(create());s.projectiles=[shot(300,155,true,true)];step(s);assert.equal(s.projectiles.length,1);
});
test('a charge or torpedo hits only one target, with armour absorbing the first hit',()=>{
  for(const role of ['boat','sub']){const s=quiet(create(role));const y=role==='boat'?300:SURFACE;
    s.enemies=[{id:1,x:500,y,vx:0,hp:2,cooldown:100,reveal:0,flash:0}];
    s.projectiles=[shot(500,y,true,role==='boat')];step(s);assert.equal(s.enemies[0].hp,1);assert.equal(s.projectiles.length,0);
    s.projectiles=[shot(500,y,true,role==='boat')];step(s);assert.equal(s.enemies.length,0);assert.equal(s.kills,1);assert.ok(s.score>=150);
  }
});
test('one hit grants immunity; terminal loss freezes simulation',()=>{
  const s=quiet(create());s.projectiles=[shot(500,SURFACE,false,false),shot(500,SURFACE,false,false)];step(s);assert.equal(s.player.hp,4);
  s.player.hp=1;s.player.invincible=0;s.projectiles=[shot(500,SURFACE,false,false)];step(s);assert.equal(s.status,'lost');
  const frozen=JSON.stringify(s);advance(s,60,{fire:true,x:1});assert.equal(JSON.stringify(s),frozen);
});
test('both sides can clear three missions, repair, score and reach a frozen victory',()=>{
  for(const role of ['boat','sub']){const s=quiet(create(role));s.player.hp=3;
    for(let mission=0;mission<3;mission++){
      assert.equal(s.mission,mission);quiet(s);
      // Place stationary targets in a clear firing lane; use actual travelling weapons.
      s.enemies.forEach(e=>{e.x=500;e.y=role==='boat'?300:SURFACE;});
      for(let i=0;i<1500&&s.enemies.length;i++)step(s,{fire:true});
      assert.equal(s.enemies.length,0);if(mission<2){const hp=s.player.hp;advance(s,160);assert.equal(s.player.hp,Math.min(5,hp+1));}
    }
    assert.equal(s.kills,12);assert.equal(s.status,'won');assert.ok(s.score>2000);const frozen=JSON.stringify(s);advance(s,60,{fire:true});assert.equal(JSON.stringify(s),frozen);
  }
});
test('deadline loses, and drain current affects only final-sector submerged objects',()=>{
  const s=quiet(create('sub'));s.timeLeft=.001;step(s);assert.equal(s.status,'lost');
  const a=quiet(create('sub')),b=quiet(create('sub'));a.mission=2;a.player.x=b.player.x=820;a.player.y=b.player.y=450;
  step(a);step(b);assert.ok(a.player.x>b.player.x);assert.equal(b.player.x,820);
});
test('seed sweep keeps state finite and projectile storage bounded',()=>{
  for(const role of ['boat','sub'])for(let seed=0;seed<25;seed++){
    const s=create(role,seed);for(let i=0;i<6000&&s.status==='playing';i++){
      step(s,{x:Math.sin(i/60),y:Math.cos(i/120),fire:true,sonar:true});
      assert.ok(s.player.hp>=0&&s.player.hp<=5);assert.ok(s.projectiles.length<60);
      for(const q of s.projectiles)assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y));
    }
  }
});

test('enemies telegraph once before each attack without changing their firing schedule',()=>{
  const s=create();let warnings=0,shots=0;
  s.enemies=[s.enemies[0]];s.enemies[0].reveal=0;s.enemies[0].cooldown=1;
  for(let i=0;i<59;i++){step(s);warnings+=s.events.filter(e=>e.type==='warning').length;shots+=s.events.filter(e=>e.type==='enemyFire').length;}
  assert.equal(warnings,1);assert.equal(shots,0);assert.ok(s.enemies[0].reveal>0);
  advance(s,2);assert.ok(s.projectiles.some(q=>!q.friendly));
});
test('campaign counters count fired shots, armour hits, pings and actual hull damage',()=>{
  const s=quiet(create());step(s,{fire:true,sonar:true});assert.equal(s.stats.shots,1);assert.equal(s.stats.pings,1);
  advance(s,10,{fire:true,sonar:true});assert.equal(s.stats.shots,1);assert.equal(s.stats.pings,1);
  s.enemies=[{id:1,x:500,y:300,vx:0,hp:2,maxHp:2,cooldown:100,reveal:0,flash:0}];
  s.projectiles=[shot(500,300)];step(s);assert.equal(s.stats.hits,1);assert.equal(s.kills,0);
  s.pulse=null;s.projectiles=[shot(500,SURFACE,false,false),shot(500,SURFACE,false,false)];step(s);assert.equal(s.stats.damageTaken,1);
  step(s,{x:-1});assert.equal(s.player.facing,-1);step(s,{x:1});assert.equal(s.player.facing,1);
});
test('loss reasons distinguish deadline expiry from hull loss',()=>{
  const timed=quiet(create());timed.timeLeft=0;step(timed);assert.equal(timed.lossReason,'timeout');
  const hit=quiet(create());hit.player.hp=1;hit.projectiles=[shot(500,SURFACE,false,false)];step(hit);assert.equal(hit.lossReason,'hull');
});
