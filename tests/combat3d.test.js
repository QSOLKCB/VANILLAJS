// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat3D,actorRegions3D,defineWeapon3D,COMBAT3D_LIMITS} from '../modules/combat3d/index.js';
import {WeaponTimer} from '../modules/weapons/index.js';
const weapon=(patch={})=>({id:'test',archetype:'precision',damage:25,headMultiplier:2,range:60,falloff:1,spread:0,recoil:0,interval:.1,reload:.2,magazine:3,reserve:9,speed:30,radius:0,penetration:0,...patch});
const actor=(id,position,team=1,health=100,armour=0)=>({id,position,team,health,armour});
const command=(patch={})=>({actor:'player',weapon:'test',origin:[0,1,5],direction:[0,0,-1],fire:true,reload:false,...patch});
const wall=(material='stone',z=2)=>({id:'wall',box:{min:[-2,0,z],max:[2,3,z+.25]},material});
const game=(options={})=>new Combat3D({actors:[actor('player',[0,0,5],0),actor('target',[0,0,0])],weapons:[weapon()],...options});
test('weapon reserve pickups preserve timers and refuse malformed amounts',()=>{const w=new WeaponTimer({magazineSize:2,reserve:0});w.step(1/60,{fire:true});const s=w.snapshot();assert.equal(w.addReserve(50,20),20);assert.deepEqual(w.snapshot(),{...s,reserve:20});for(const v of [-1,NaN,1.5,Infinity])assert.throws(()=>w.addReserve(v));assert.equal(w.snapshot().reserve,20);});
test('precision requires fresh trigger; automatic cadence, magazine and reload are simulation timed',()=>{
  for(const archetype of ['precision','automatic']){const g=game({weapons:[weapon({archetype})]});let shots=0;for(let i=0;i<20;i++)shots+=g.step([command()]).filter(e=>e.type==='shot').length;assert.equal(shots,archetype==='precision'?1:3);
    g.step([command({fire:false,reload:true})]);for(let i=0;i<12;i++)g.step([]);const t=g.snapshot().weapons.find(w=>w.actor==='player').timers[0];assert.equal(t.ammo,3);assert.equal(t.reserve,archetype==='precision'?8:6);
  }
});
test('nearest region, head/body multiplier, range and independent axis-aligned reference',()=>{
  for(const y of [.2,.9,1.39,1.41,1.62,1.79,1.9])for(const x of [0,.23,.26,.34,.4]){
    const g=game(),events=g.step([command({origin:[x,y,5]})]),hit=events.find(e=>e.type==='damage');
    const head=Math.abs(x)<=.24&&y>=1.4&&y<=1.8,body=Math.abs(x)<=.35&&y<=1.4;
    assert.equal(hit?.amount??0,head?50:body?25:0);if(hit)assert.equal(hit.part,head?'head':'body');
  }
  const g=game({actors:[actor('player',[0,0,5],0),actor('near',[0,0,0]),actor('far',[0,0,-4])]});g.step([command()]);assert.equal(g.actor('near').health,75);assert.equal(g.actor('far').health,100);
  assert.equal(game({weapons:[weapon({range:2})]}).step([command()]).filter(e=>e.type==='damage').length,0);
});
test('stone occlusion, wood budget, actor penetration, friendly blocking and falloff',()=>{
  for(const material of ['stone','wood'])for(const penetration of [0,1]){const g=game({solids:[wall(material)],weapons:[weapon({penetration})]});g.step([command()]);assert.equal(g.actor('target').health,material==='wood'&&penetration===1?75:100);}
  const g=game({actors:[actor('player',[0,0,5],0),actor('near',[0,0,0]),actor('far',[0,0,-4])],weapons:[weapon({penetration:1})]});g.step([command()]);assert.equal(g.actor('far').health,75);
  const ally=game({actors:[actor('player',[0,0,5],0),actor('target',[0,0,0],0)]});ally.step([command()]);assert.equal(ally.actor('target').health,100);
  const enabled=game({actors:[actor('player',[0,0,5],0),actor('target',[0,0,0],0)],friendlyFire:true});enabled.step([command()]);assert.equal(enabled.actor('target').health,75);
  const f=game({weapons:[weapon({falloff:0,range:10})]});f.step([command()]);assert.equal(f.actor('target').health,100-25*(1-4.65/10));
});
test('wall wins equal-distance hitscan ties regardless of source order',()=>{
  const g=game({solids:[{id:'cover',box:{min:[-2,0,.1],max:[2,3,.35]},material:'stone'}]});g.step([command()]);assert.equal(g.actor('target').health,100);
});
test('zero-damage range-edge impacts cannot contribute assists',()=>{
  const g=new Combat3D({actors:[actor('alpha',[-3,0,5],0),actor('bravo',[3,0,5],0),actor('target',[0,0,0])],weapons:[weapon({range:2,falloff:0}),weapon({id:'lethal',damage:200})]});
  const edge=command({actor:'alpha',origin:[0,1,2.35]});const events=g.step([edge]);assert.ok(events.some(e=>e.type==='impact'));assert.equal(events.some(e=>e.type==='damage'),false);assert.deepEqual(g.actor('target').contributions,{});
  g.step([{...edge,actor:'bravo',weapon:'lethal'}]);assert.equal(g.actor('target').health,0);assert.equal(g.actor('bravo').kills,1);assert.equal(g.actor('alpha').assists,0);
});
test('simultaneous eligible shots trade in stable actor order and attribute assists',()=>{
  const actors=[actor('alpha',[-3,0,5],0),actor('bravo',[3,0,5],0),actor('target',[0,0,0])],weapons=[weapon({damage:60})];
  const commands=[command({actor:'bravo'}),command({actor:'alpha'})];const g=new Combat3D({actors,weapons}),h=new Combat3D({actors:[...actors].reverse(),weapons});
  assert.deepEqual(g.step(commands),h.step([...commands].reverse()));assert.equal(g.actor('target').health,0);assert.equal(g.actor('alpha').assists,1);assert.equal(g.actor('bravo').kills,1);
  const trade=game({weapons:[weapon({damage:200})]});const es=trade.step([command(),command({actor:'target',origin:[0,1,0],direction:[0,0,1]})]);assert.equal(es.filter(e=>e.type==='death').length,2);
});
test('armour absorbs 60 percent up to its remainder; death and respawn are explicit',()=>{
  const g=game({actors:[actor('player',[0,0,5],0),actor('target',[0,0,0],1,30,10)],weapons:[weapon({damage:50})]});const e=g.step([command()]);assert.equal(e.find(e=>e.type==='damage').armour,10);assert.equal(g.actor('target').deaths,1);
  assert.equal(g.respawn('target',[2,0,0]).type,'respawn');assert.equal(g.actor('target').health,30);assert.equal(g.actor('target').armour,10);assert.equal(g.actor('target').deaths,1);assert.throws(()=>g.respawn('target',[0,0,0]));
});
test('projectiles travel finite distances, hit level geometry and expire at range',()=>{
  const g=game({weapons:[weapon({archetype:'projectile'})]});g.step([command()]);assert.equal(g.actor('target').health,100);assert.equal(g.snapshot().projectiles[0].position[2],4.5);for(let i=0;i<10;i++)g.step([]);assert.equal(g.actor('target').health,75);
  const blocked=game({weapons:[weapon({archetype:'projectile'})],solids:[wall()]});blocked.step([command()]);for(let i=0;i<20;i++)blocked.step([]);assert.equal(blocked.actor('target').health,100);assert.equal(blocked.snapshot().projectiles.length,0);
  const short=game({weapons:[weapon({archetype:'projectile',range:2})]});short.step([command()]);for(let i=0;i<10;i++)short.step([]);assert.equal(short.actor('target').health,100);assert.equal(short.snapshot().projectiles.length,0);
});
test('splash is radial, bounded, blocked by walls and obeys self-damage policy',()=>{
  for(const selfDamage of [false,true]){
    const g=game({weapons:[weapon({archetype:'projectile',radius:4,damage:100})],solids:[wall()],selfDamage});g.step([command()]);let explosion;for(let i=0;i<15;i++){const e=g.step([]);explosion??=e.find(e=>e.type==='explosion');}
    assert.ok(explosion);assert.equal(g.actor('target').health,100);assert.equal(g.actor('player').health<100,selfDamage);
  }
});
test('all rejected commands and poses preserve state, including mixed valid/invalid batches',()=>{
  const g=game(),before=g.snapshot();for(const c of [command({fire:'yes'}),command({direction:[0,0,0]}),command({origin:[NaN,1,0]}),command({actor:'missing'}),{...command(),execute:'no'}]){assert.throws(()=>g.step([command(),c]));assert.deepEqual(g.snapshot(),before);}
  assert.throws(()=>g.setPoses([{id:'player',position:[1,0,0],height:1.8},{id:'target',position:[Infinity,0,0],height:1.8}]));assert.deepEqual(g.snapshot(),before);
  const accessor=command();Object.defineProperty(accessor,'fire',{get(){throw Error('accessor executed');},enumerable:true});assert.throws(()=>g.step([accessor]),/accessor field/);
});
test('budgets, detached state, bad definitions and duplicate IDs fail closed',()=>{
  assert.throws(()=>game({actors:Array.from({length:17},(_,i)=>actor('bot-'+i,[0,0,0]))}));assert.throws(()=>game({solids:Array.from({length:257},()=>wall())}));
  for(const patch of [{damage:Infinity},{radius:1},{penetration:4},{magazine:0},{archetype:'script'},{speed:0}])assert.throws(()=>defineWeapon3D(weapon(patch)));
  const g=game(),s=g.snapshot();s.actors[0].position[0]=99;assert.equal(g.actor('player').position[0],0);assert.throws(()=>g.addActor(actor('target',[1,0,1])));
  assert.equal(COMBAT3D_LIMITS.events,4096);assert.equal(actorRegions3D({id:'duck',position:[0,0,0],height:1.08})[0].box.max[1],1.08);
});
