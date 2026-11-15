/* SPDX-License-Identifier: Apache-2.0 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SubHunt} from '../demos/subhunt-lab/js/sim.js';
const {create,step,DIFFICULTIES,POWERUPS,SURFACE}=SubHunt;
const advance=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,input);return s;};
function quiet(s){s.enemies.forEach(e=>{e.vx=0;e.cooldown=1000;});s.player.invincible=0;return s;}
function collect(s,kind){s.pickups=[{id:999,kind,x:s.player.x,y:s.player.y,remaining:720}];step(s);}
function projectile(s,friendly=true,x=s.player.x,y=s.player.y){return {id:999,x,y,vx:0,vy:0,age:0,friendly,down:s.role==='boat'};}

test('difficulty validates, preserves captain rules and changes actual fleet pressure',()=>{
  for(const invalid of ['easy','__proto__','toString',null])assert.throws(()=>create('boat',1,invalid));
  const easy=create('boat',7,'cadet'),normal=create('boat',7),hard=create('boat',7,'admiral');
  assert.deepEqual([easy.timeLeft,normal.timeLeft,hard.timeLeft],[120,95,80]);
  assert.ok(easy.enemies[0].vx<normal.enemies[0].vx && normal.enemies[0].vx<hard.enemies[0].vx);
  assert.ok(easy.enemies[0].cooldown>normal.enemies[0].cooldown && normal.enemies[0].cooldown>hard.enemies[0].cooldown);
  for(const [mode,spec] of Object.entries(DIFFICULTIES)) {const s=quiet(create('boat',1,mode));s.enemies[0].x=500;s.projectiles=[projectile(s,true,500,s.enemies[0].y)];step(s);assert.equal(s.score,Math.floor(150*spec.points/4));}
});
test('supply pickups repair or award capped-hull bonus for both roles',()=>{
  for(const role of ['boat','sub']) {const s=quiet(create(role));s.player.hp=3;collect(s,'repair');assert.equal(s.player.hp,4);assert.equal(s.stats.pickups,1);
    s.player.hp=5;collect(s,'repair');assert.equal(s.player.hp,5);assert.equal(s.score,50);}
});
test('shield absorbs a real hostile shot once, then ordinary damage resumes',()=>{
  for(const role of ['boat','sub']) {const s=quiet(create(role));collect(s,'shield');assert.equal(s.player.powers.shield,720);
    s.projectiles=[projectile(s,false)];step(s);assert.equal(s.player.hp,5);assert.equal(s.stats.blocked,1);assert.equal(s.player.powers.shield,0);
    advance(s,32);s.projectiles=[projectile(s,false)];step(s);assert.equal(s.player.hp,4);assert.equal(s.stats.damageTaken,1);}
});
test('rapid fire boosts firing rate and triple shots diverge with accurate counters',()=>{
  for(const role of ['boat','sub']) {
    const normal=quiet(create(role)),rapid=quiet(create(role));collect(rapid,'rapid');advance(normal,120,{fire:true});advance(rapid,120,{fire:true});assert.ok(rapid.stats.shots>=normal.stats.shots*2);
    const s=quiet(create(role));collect(s,'volley');step(s,{fire:true});assert.equal(s.stats.shots,3);assert.equal(s.projectiles.length,3);
    assert.ok(s.projectiles[0].x<s.projectiles[1].x && s.projectiles[1].x<s.projectiles[2].x);
  }
});
test('power durations and collectible expiry use exact ticks; terminal states freeze them',()=>{
  const s=quiet(create());collect(s,'rapid');s.nextSupply=10000;advance(s,479);assert.equal(s.player.powers.rapid,1);step(s);assert.equal(s.player.powers.rapid,0);
  s.pickups=[{id:999,kind:'shield',x:100,y:SURFACE,remaining:2}];step(s);assert.equal(s.pickups.length,1);step(s);assert.equal(s.pickups.length,0);
  collect(s,'shield');s.status='lost';const frozen=JSON.stringify(s);advance(s,800,{fire:true});assert.equal(JSON.stringify(s),frozen);
});
test('scheduled supplies are reachable, bounded and do not consume the combat PRNG',()=>{
  for(const role of ['boat','sub']) {
    const a=quiet(create(role,42)),b=quiet(create(role,42));a.nextSupply=1;b.nextSupply=100000;
    for(let i=0;i<3000;i++){step(a);step(b);assert.equal(a.seed,b.seed);assert.ok(a.pickups.length<=4);for(const p of a.pickups){assert.ok(p.x>=100&&p.x<=900);assert.ok(role==='boat'?p.y===SURFACE:p.y>=210&&p.y<=484);}}
  }
});
test('both modes and every difficulty replay from identical seeds and tick inputs',()=>{
  for(const mode of ['campaign','pond'])for(const difficulty of Object.keys(DIFFICULTIES))for(const role of ['boat','sub']) {
    const a=create(role,926,difficulty,mode),b=create(role,926,difficulty,mode);
    for(let i=0;i<4200;i++){const input={x:Math.sin(i/70),y:Math.cos(i/51),fire:true,sonar:i%241===0};step(a,input);step(b,input);}
    assert.deepEqual(a,b);
    assert.ok(a.pickups.length<=4);assert.ok(a.stats.hits<=a.stats.shots);
  }
});
test('Pond Panic uses five surface ducks and six underwater fish; fleet mode retains blockers',()=>{
  assert.throws(()=>create('boat',1,'standard','unknown'));
  const s=create('boat',1,'standard','pond');assert.equal(s.ducks.length,0);
  assert.equal(s.targets.filter(t=>t.kind==='duck'&&t.y===SURFACE).length,5);
  assert.equal(s.targets.filter(t=>t.kind==='fish'&&t.y>SURFACE).length,6);
  const x=s.targets[0].x;step(s);assert.notEqual(s.targets[0].x,x);
  assert.equal(create().ducks.length,2);assert.equal(create().targets.length,0);
});
test('each living target awards exactly one point to the shot owner',()=>{
  for(const friendly of [true,false])for(const role of ['boat','sub']) {
    const s=quiet(create(role,1,'standard','pond')),t=s.targets[5];t.vx=0;
    s.projectiles=[projectile(s,friendly,t.x,t.y),projectile(s,friendly,t.x,t.y)];step(s);
    assert.equal(s.targets.length,10);assert.equal(s.race.player,friendly?1:0);assert.equal(s.race.ai,friendly?0:1);
    assert.equal(s.stats.toys,friendly?1:0);assert.equal(s.stats.rivalToys,friendly?0:1);
  }
});
test('both vessels can hit a duck using their real weapon direction',()=>{
  for(const role of ['boat','sub']) {
    const s=quiet(create(role,1,'standard','pond'));
    s.targets=[s.targets[0]];s.targets[0].x=500;s.targets[0].vx=0;
    advance(s,100,{fire:true});assert.equal(s.race.player,1);assert.equal(s.targets.length,0);
  }
});
test('first to six ends a Pond sector; sinking rivals alone does not end the race',()=>{
  for(const role of ['boat','sub']) {
    const s=quiet(create(role,1,'standard','pond'));s.enemies=[];step(s);assert.equal(s.transition,0);
    for(let sector=0;sector<3;sector++) {
      s.enemies=[];s.player.hp=5;
      for(let i=0;i<6;i++){const t=s.targets[0];t.vx=0;s.projectiles=[projectile(s,true,t.x,t.y)];step(s);}
      if(sector<2){assert.ok(s.transition>0);advance(s,151);assert.equal(s.mission,sector+1);assert.equal(s.race.player,0);assert.equal(s.targets.length,11);}
    }
    assert.equal(s.status,'won');assert.equal(s.stats.toys,18);
    const frozen=JSON.stringify(s);advance(s,10);assert.equal(JSON.stringify(s),frozen);
    const lost=quiet(create(role,1,'standard','pond'));lost.race.ai=5;const t=lost.targets[5];t.vx=0;lost.projectiles=[projectile(lost,false,t.x,t.y)];step(lost);assert.equal(lost.status,'lost');assert.equal(lost.lossReason,'outscored');
  }
});
test('unattended rival fleet physically claims toys and wins rather than receiving free points',()=>{
  for(const role of ['boat','sub']) {
    const s=create(role,42,'standard','pond');s.player.x=65;s.player.invincible=1000;
    advance(s,5700);assert.equal(s.status,'lost');assert.equal(s.lossReason,'outscored');assert.ok(s.stats.rivalToys>=6);
  }
});
