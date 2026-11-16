// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {WeaponFeel,validateWeaponFeel,exportWeaponFeel,WEAPON_FEEL_BYTES} from '../modules/weapon-feel/index.js';
import {WeaponTimer} from '../modules/weapons/index.js';
import {FixedClock} from '../modules/time/index.js';
import {starterFeel} from '../demos/weapon-feel-lab/profiles.js';
import {FeelRange} from '../demos/weapon-feel-lab/world.js';
const copy=v=>structuredClone(v);
function rig(index=0){const recipe=starterFeel(),feel=new WeaponFeel(recipe);feel.select(index);const timers=recipe.profiles.map(p=>new WeaponTimer({magazineSize:p.weapon.magazine,interval:p.weapon.interval,reserve:p.weapon.reserve,reloadTime:p.weapon.reload}));let ticks=0;const shots=[];
  return {feel,timers,shots,tick({held=false,reload=false}={}){const i=feel.presentation().selected,c=feel.step({actor:'player',origin:[0,1.62,0],timer:timers[i].snapshot(),held,reload});for(let j=0;j<timers.length;j++){const e=timers[j].step(1/60,{fire:j===i&&c.fire,reload:j===i&&c.reload});if(e.some(e=>e.type==='shot')){shots.push({tick:ticks,weapon:i,direction:c.direction});feel.confirm({shot:true,hit:false,damage:0,reloading:false});}}ticks++;return c;}};
}
test('weapon recipe validation is strict, bounded, versioned and owns frozen data',()=>{
  const source=copy(starterFeel()),accepted=validateWeaponFeel(source);source.profiles[0].view.hipFov=2;assert.equal(accepted.profiles[0].view.hipFov,1.15);assert.ok(Object.isFrozen(accepted.profiles[0].view));
  const cases=[p=>p.version=2,p=>p.script='alert(1)',p=>p.seed=-1,p=>p.profiles.push(p.profiles[0]),p=>p.profiles[1].id=p.profiles[0].id,p=>p.profiles[0].view.adsFov=2,p=>p.profiles[0].weapon.recoil=Infinity,p=>p.profiles[0].handling.triggerBuffer=.3,p=>p.profiles[0].view.effects='yes'];
  for(const change of cases){const draft=copy(starterFeel());change(draft);assert.throws(()=>validateWeaponFeel(draft));}
  let invoked=false;const getter=copy(starterFeel());Object.defineProperty(getter,'seed',{get(){invoked=true;return 1;}});assert.throws(()=>validateWeaponFeel(getter));assert.equal(invoked,false);
  assert.throws(()=>validateWeaponFeel(' '.repeat(WEAPON_FEEL_BYTES)+exportWeaponFeel(starterFeel())));
  assert.throws(()=>validateWeaponFeel('{"'+('é'.repeat(9000))+'":0}'),/16 KiB/);
  assert.deepEqual(validateWeaponFeel(exportWeaponFeel(accepted)),accepted);
});
test('look applies before ticks, accumulates once, and rendering never consumes it',()=>{
  const feel=new WeaponFeel(starterFeel());for(let i=0;i<30;i++){feel.addLook(-.01,.002);feel.presentation();feel.aim();}
  assert.ok(Math.abs(feel.aim().yaw+.3)<1e-12);assert.ok(Math.abs(feel.aim().pitch-.06)<1e-12);const queued=feel.consumeLook();assert.ok(Math.abs(queued.yaw+.3)<1e-12);assert.ok(Math.abs(queued.pitch-.06)<1e-12);assert.deepEqual(feel.consumeLook(),{yaw:0,pitch:0});
  const before=feel.aim();assert.throws(()=>feel.addLook(NaN,0));assert.deepEqual(feel.aim(),before);feel.addLook(0,Math.PI);assert.ok(feel.aim().pitch<Math.PI/2);
});
test('zero-tick frames retain fire edges; cooldown permits short buffering only',()=>{
  const r=rig();r.feel.trigger();for(let i=0;i<100;i++)r.feel.presentation();r.tick();assert.equal(r.shots.length,1);
  r.feel.trigger();for(let i=0;i<30;i++)r.tick();assert.equal(r.shots.length,1,'early edge expires rather than firing after cooldown');
  r.feel.trigger();r.tick();for(let i=0;i<18;i++)r.tick();r.feel.trigger();for(let i=0;i<8;i++)r.tick();assert.equal(r.shots.length,3,'late edge is consumed as soon as timer is ready');
  assert.ok(r.shots[2].tick-r.shots[1].tick>=22);
});
test('switching retains canonical per-weapon cooldowns and cancels queued triggers',()=>{
  const r=rig();r.feel.trigger();r.tick();const cooldown=r.timers[0].snapshot().cooldown;r.feel.trigger();r.feel.select(1);r.feel.select(0);assert.equal(r.timers[0].snapshot().cooldown,cooldown);
  for(let i=0;i<11;i++)r.tick({held:true});assert.equal(r.shots.length,1);r.feel.trigger();r.tick();assert.equal(r.shots.length,1,'old slow weapon still in cooldown');for(let i=0;i<30;i++)r.tick();assert.equal(r.shots.length,1,'buffer cannot bridge entire cooldown');
  r.feel.select(1);for(let i=0;i<30;i++)r.tick({held:true});const automatic=r.shots.filter(s=>s.weapon===1);assert.ok(automatic.length>=3);assert.ok(automatic[0].tick>=54);for(let i=1;i<automatic.length;i++)assert.ok(automatic[i].tick-automatic[i-1].tick>=6);
});
test('reload and lifecycle cancellation discard pending fire and look',()=>{
  const r=rig();r.feel.trigger();r.tick();r.feel.trigger();r.feel.addLook(.1,.1);r.feel.cancel();assert.deepEqual(r.feel.consumeLook(),{yaw:0,pitch:0});for(let i=0;i<30;i++)r.tick();assert.equal(r.shots.length,1);
  r.feel.trigger();r.tick({reload:true});for(let i=0;i<90;i++)r.tick();assert.equal(r.shots.length,1);assert.equal(r.timers[0].snapshot().ammo,8);
});
test('ADS coordinates FOV, sensitivity and canonical ray independently from cosmetic recoil',()=>{
  const r=rig(),initial=r.feel.aim();r.feel.setADS(true);for(let i=0;i<20;i++)r.tick();const p=r.feel.presentation();assert.equal(p.ads,1);assert.equal(p.fov,.65);assert.ok(Math.abs(p.sensitivity-Math.tan(.65/2)/Math.tan(1.15/2))<1e-12);assert.deepEqual(r.feel.aim(),initial);
  r.feel.confirm({shot:true,hit:true,damage:10,reloading:false});assert.ok(r.feel.presentation().recoil>0);assert.deepEqual(r.feel.aim(),initial);assert.deepEqual(initial.direction,[0,0,-1]);assert.ok(r.feel.presentation().hit>0&&r.feel.presentation().hurt>0);
  for(let i=0;i<60;i++)r.tick();assert.ok(r.feel.presentation().recoil<.001);assert.equal(r.feel.presentation().flash,0);
});
test('seeded spread repeats for fixed inputs and responds to seed, ADS and recovery',()=>{
  const run=(seed,ads)=>{const data=copy(starterFeel());data.seed=seed;const feel=new WeaponFeel(data),timer=new WeaponTimer({magazineSize:100,interval:.05});feel.setADS(ads);for(let i=0;i<30;i++){feel.step({actor:'player',origin:[0,1,0],timer:timer.snapshot()});timer.step(1/60);}
    const directions=[];for(let i=0;i<30;i++){if(i%6===0)feel.trigger();const c=feel.step({actor:'player',origin:[0,1,0],timer:timer.snapshot()});if(timer.step(1/60,{fire:c.fire}).some(e=>e.type==='shot')){directions.push(c.direction);feel.confirm({shot:true,hit:false,damage:0,reloading:false});}}return {directions,spread:feel.presentation().spread};};
  const a=run(10,false);assert.deepEqual(run(10,false),a);assert.notDeepEqual(run(11,false),a);const ads=run(10,true);assert.ok(Math.abs(ads.directions[0][0])<Math.abs(a.directions[0][0]));for(const d of a.directions)assert.ok(Math.abs(Math.hypot(...d)-1)<1e-12);
});
test('same fixed tick input stream produces equal shots at 30, 60 and 144 render Hz',()=>{
  const run=hz=>{const r=rig(1),clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:8}),events=[];for(let frame=0;frame<hz*3;frame++){
    // Logical inputs have explicit tick order; render snapshots are nonmutating.
    clock.advance(1/hz,()=>{if(clock.ticks%12===0)r.feel.addLook(.003,-.001);r.tick({held:true});});r.feel.aim();r.feel.presentation();events.push(r.shots.length);
  }return {shots:r.shots,timers:r.timers.map(t=>t.snapshot()),aim:r.feel.aim()};};
  assert.deepEqual(run(30),run(60));assert.deepEqual(run(144),run(60));
});
test('real range uses canonical combat hits, moving target poses and projectile travel',()=>{
  const world=new FeelRange(starterFeel());world.feel.trigger();world.step();assert.equal(world.shots,1);assert.equal(world.hits,1);assert.ok(world.damage>0);assert.ok(world.lastImpact);assert.deepEqual(world.lastShot.origin,world.origin());
  const old=world.combat.actor('target-0').position;for(let i=0;i<60;i++)world.step();assert.notDeepEqual(world.combat.actor('target-0').position,old);
  const bolt=new FeelRange(starterFeel());bolt.targetsMoving=false;bolt.feel.select(2);for(let i=0;i<12;i++)bolt.step();bolt.feel.trigger();bolt.step();assert.equal(bolt.hits,0);assert.equal(bolt.shots,1);for(let i=0;i<60;i++)bolt.step();assert.equal(bolt.hits,1);
});
test('invalid replacement and invalid feedback preserve accepted simulation state',()=>{
  let range=new FeelRange(starterFeel());range.feel.trigger();range.step();const before=range.snapshot(),bad=copy(starterFeel());bad.profiles[0].view.hipFov=NaN;
  assert.throws(()=>{const replacement=new FeelRange(bad);range=replacement;});assert.deepEqual(range.snapshot(),before);
  assert.throws(()=>range.feel.confirm({shot:true,hit:true,damage:NaN,reloading:false}));assert.deepEqual(range.snapshot(),before);
});
test('fractional canonical cooldown cannot consume a buffered edge or spread sample early',()=>{
  const recipe=copy(starterFeel());recipe.profiles[0].weapon.interval=.10000000005;
  const early=new FeelRange(recipe),reference=new FeelRange(recipe);
  for(const range of [early,reference]){range.targetsMoving=false;range.feel.trigger();range.step();for(let i=0;i<5;i++)range.step();assert.ok(range.timer().cooldown>1e-12&&range.timer().cooldown<1e-10);}
  early.feel.trigger();early.step();reference.step();assert.equal(early.shots,1);assert.ok(early.feel.presentation().bufferRemaining>0,'buffer survives blocked fractional remainder');
  reference.feel.trigger();early.step();reference.step();assert.equal(early.shots,2);assert.equal(reference.shots,2);assert.deepEqual(early.lastShot.direction,reference.lastShot.direction,'blocked command did not advance spread RNG');
});
test('positive final reload remainder reserves its whole tick before buffered fire',()=>{
  const recipe=copy(starterFeel());recipe.profiles[0].weapon.reload=.100000000005;
  const world=new FeelRange(recipe);world.targetsMoving=false;world.feel.trigger();world.step();for(let i=0;i<30;i++)world.step();world.step({reload:true});for(let i=0;i<5;i++)world.step();
  assert.ok(world.timer().reloadRemaining>0&&world.timer().reloadRemaining<1e-10);world.feel.trigger();world.step();assert.equal(world.shots,1);assert.equal(world.timer().reloadRemaining,0);assert.ok(world.feel.presentation().bufferRemaining>0);world.step();assert.equal(world.shots,2);
});
