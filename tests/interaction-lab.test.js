import test from 'node:test';
import assert from 'node:assert/strict';
import {createLab,stepLab,focusTarget} from '../demos/interaction-lab/recipes.js';
import {FixedClock} from '../modules/time/index.js';
import {Actions,attachKeyboard,flightBindings} from '../modules/input/index.js';
const tick=1/120;
function fireOnce(s){stepLab(s,{fire:true},tick);for(let i=0;i<80;i++)stepLab(s,{},tick);return s.history[0];}
test('space recipe: shield blocks, four fresh hits disable hull, spent targets cannot take damage',()=>{
  const s=createLab('space');assert.equal(fireOnce(s).reasons[0].code,'shield-active');assert.equal(s.targets[0].health,100);
  s.context.shields=false;for(let i=0;i<4;i++)assert.equal(fireOnce(s).status,'applied');
  assert.equal(s.targets[0].health,0);assert.equal(s.applied,4);
  assert.equal(fireOnce(s).reasons[0].code,'target-spent');assert.equal(s.targets[0].health,0);
});
test('bench recipe: ignition, missing reactant, product and resistance are distinct outcomes',()=>{
  const s=createLab('bench');assert.equal(fireOnce(s).reasons[0].code,'needs-ignition');
  s.context.oxygen=false;s.context.ignition=true;assert.equal(fireOnce(s).reasons[0].code,'needs-oxygen');
  s.context.oxygen=true;assert.equal(fireOnce(s).effects[0].formula,'H2O');assert.equal(s.products,1);
  focusTarget(s,'neon');assert.equal(fireOnce(s).status,'resisted');assert.equal(s.products,1);
  focusTarget(s,'empty');assert.equal(fireOnce(s).reasons[0].code,'empty-chamber');assert.equal(s.products,1);
});
test('simultaneous effects resolve once in impact order against updated target state',()=>{
  const s=createLab();s.context.shields=false;s.targets[0].health=25;
  for(let i=0;i<2;i++)s.projectiles.spawn({position:[0,0,-28],velocity:[0,0,-1000],data:{kind:'pulse'}});
  stepLab(s,{},tick);assert.equal(s.applied,1);assert.equal(s.hits,2);assert.equal(s.targets[0].health,0);
  assert.equal(s.history[0].reasons[0].code,'target-spent');stepLab(s,{},tick);assert.equal(s.hits,2);
});
test('conditions are sampled at impact, including changes while a projectile travels',()=>{
  const s=createLab();stepLab(s,{fire:true},tick);s.context.shields=false;
  for(let i=0;i<80;i++)stepLab(s,{},tick);
  assert.equal(s.applied,1);assert.equal(s.targets[0].health,75);
});
test('30, 60 and 144 Hz rendering produces identical shots, impacts and body state',()=>{
  const run=hz=>{
    const s=createLab(),clock=new FixedClock();s.context.shields=false;
    for(let i=0;i<hz*3;i++)clock.advance(1/hz,dt=>stepLab(s,{fire:clock.ticks<120},dt));
    return {body:s.body,shots:s.shots,hits:s.hits,history:s.history,targets:s.targets,projectiles:s.projectiles.snapshots(),ticks:clock.ticks};
  };
  assert.deepEqual(run(30),run(60));assert.deepEqual(run(60),run(144));
});
test('pause freezes projectiles/cooldown and cancelled fire needs a fresh keydown',()=>{
  const s=createLab(),clock=new FixedClock(),actions=new Actions(),target=new EventTarget();let enabled=true;
  const keyboard=attachKeyboard(target,actions,{bindings:{...flightBindings,KeyF:'fire'},enabled:()=>enabled});
  const key=(type,repeat=false)=>{const event=new Event(type,{cancelable:true});Object.assign(event,{code:'KeyF',repeat});target.dispatchEvent(event);};
  const update=dt=>stepLab(s,{fire:!!actions.value('fire')},dt);
  key('keydown');clock.advance(tick,update);const before=s.projectiles.snapshots(),cooldown=s.cooldown;
  enabled=false;clock.setPaused(true);keyboard.clear();clock.advance(10,update);
  assert.deepEqual(s.projectiles.snapshots(),before);assert.equal(s.cooldown,cooldown);
  enabled=true;clock.setPaused(false);key('keydown',true);
  for(let i=0;i<100;i++)clock.advance(tick,update);assert.equal(s.shots,1);
  key('keyup');key('keydown');clock.advance(tick,update);assert.equal(s.shots,2);keyboard.dispose();
});
test('focus cancels old shots and motion, reset restores the original scenario',()=>{
  const s=createLab();stepLab(s,{fire:true,thrust:[0,0,-1]},tick);focusTarget(s,'drone-2');
  assert.equal(s.projectiles.size,0);assert.deepEqual(s.body.velocity,[0,0,0]);assert.equal(s.cooldown,0);
  assert.deepEqual(s.body.position,[-11,0,12]);assert.throws(()=>focusTarget(s,'unknown'));
  assert.equal(createLab().shots,0);assert.equal(createLab().context.shields,true);assert.throws(()=>createLab('missing'));
});
test('history and visual effects stay bounded during sustained fire',()=>{
  const s=createLab();for(let i=0;i<2400;i++)stepLab(s,{fire:true},tick);
  assert.equal(s.history.length,8);assert.ok(s.flashes.length<=64);assert.ok(s.projectiles.size<=s.projectiles.capacity);
});
