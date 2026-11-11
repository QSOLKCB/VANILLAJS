// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parsePack, PACK_FILES } from '../demos/4x-game-lab/voidward/js/content.js';
import { createEngine } from '../demos/4x-game-lab/voidward/js/core.js';
import hooks from '../demos/4x-game-lab/voidward/mods/machine-dawn/hooks.js';
const raw = Object.fromEntries(await Promise.all(PACK_FILES.map(async n=>[`${n}.txt`,await fs.readFile(new URL(`../demos/4x-game-lab/voidward/mods/frontier/${n}.txt`,import.meta.url),'utf8')])));
const scenario = 'playable = 0,1,2\nvictory = objectives\nminVictoryTurn = 1\ndefeatAtLimit = 0';
const make = extra => createEngine(parsePack({...raw,'scenario.txt':scenario,'objectives.txt':'hold | * | survive | - | 160 | | | Hold the line | Remain viable. | 1',...extra}));
const home = 12, planet = 24;
const unchanged = (engine,state,action) => {const before=engine.serialize(state);assert.throws(()=>engine.command(state,action));assert.equal(engine.serialize(state),before);};

test('scenario empire selection controls defaults and AI excludes the selected empire',()=>{
  for(const player of [0,1,2]){
    const e=make(),s=e.createGame(44,'standard',true,player);assert.equal(s.player,player);assert.equal(e.fleets(s).length,3);assert.ok(e.colonies(s).every(p=>p.owner===player));
    const ships=e.fleets(s).map(f=>({id:f.id,system:f.system,path:f.path}));e.endTurn(s);assert.deepEqual(e.fleets(s).map(f=>({id:f.id,system:f.system,path:f.path})),ships);e.validateState(s);
  }
  assert.throws(()=>createEngine(parsePack(raw)).createGame(1,'standard',true,1));
});

test('original v1 save fixtures migrate without firing source hooks or changing existing assets',async()=>{
  for(const id of ['frontier','machine-dawn']){
    const fixture=JSON.parse(await fs.readFile(new URL(`fixtures/voidward-v1-${id}.json`,import.meta.url),'utf8'));
    const e=createEngine(parsePack(fixture.pack),id==='machine-dawn'?hooks:{}),before=JSON.stringify(fixture.state),s=e.migrateState(fixture.state);
    assert.equal(s.version,2);assert.equal(s.player,0);assert.equal(s.turn,fixture.state.turn);assert.equal(JSON.stringify(fixture.state),before);
    assert.deepEqual(s.empires,fixture.state.empires);assert.deepEqual(s.planets,fixture.state.planets);assert.deepEqual(s.modState,fixture.state.modState);assert.deepEqual(s.log,fixture.state.log);
    for(const [i,f]of s.fleets.entries()){const {order,refit,...old}=f;assert.deepEqual(old,fixture.state.fleets[i]);assert.equal(order.type,'hold');assert.equal(refit,null);}
    assert.deepEqual(e.deserialize(e.serialize(s)),s);e.endTurn(s);e.validateState(s);
  }
});

test('fleet groups validate atomically and travel at their slowest member speed',()=>{
  const e=make({'components.txt':raw['components.txt']+'\nfast-drive | Fast survey engine | engine | 1 | 12 | 0 | 0 | 3 | propulsion | 1 | Survey drive.\n','ships.txt':raw['ships.txt'].replace('drive-1','fast-drive')}),s=e.createGame();
  const [scout,ark]=e.fleets(s);e.reveal(s,0,13);e.reveal(s,0,14);
  unchanged(e,s,{type:'group',name:'Invalid convoy',fleets:[scout.id,999]});
  e.command(s,{type:'group',name:'First Expedition',fleets:[scout.id,ark.id]});
  e.command(s,{type:'groupMove',group:s.groups[0].id,target:14});e.endTurn(s);
  assert.equal(scout.system,13);assert.equal(ark.system,13);assert.deepEqual(scout.path,[14]);assert.deepEqual(scout.path,ark.path);e.validateState(s);
  unchanged(e,s,{type:'move',fleet:scout.id,target:12});
  e.command(s,{type:'hold',fleet:ark.id});assert.deepEqual(scout.path,[]);e.command(s,{type:'ungroup',group:s.groups[0].id});assert.equal(s.groups.length,0);
});

test('persistent exploration, patrol and return orders survive serialization',()=>{
  const e=make(),s=e.createGame(),scout=e.fleets(s)[0];e.command(s,{type:'order',fleet:scout.id,order:'explore'});e.endTurn(s);
  assert.notEqual(scout.system,home);assert.ok(s.empires[0].known.length>1);
  const loaded=e.deserialize(e.serialize(s)),ship=e.fleets(loaded)[0];assert.equal(ship.order.type,'explore');
  e.command(loaded,{type:'order',fleet:ship.id,order:'return'});for(let i=0;i<5&&ship.system!==home;i++)e.endTurn(loaded);assert.equal(ship.system,home);
  e.command(loaded,{type:'order',fleet:ship.id,order:'patrol',target:scout.system});e.endTurn(loaded);assert.equal(ship.system,scout.system);e.endTurn(loaded);assert.equal(ship.system,home);e.validateState(loaded);
});

test('production reordering preserves paid work and refund accounting',()=>{
  const e=make(),s=e.createGame(),p=s.planets[planet];e.command(s,{type:'build',planet,kind:'lab'});e.endTurn(s);
  const work=p.queue[0].done;e.command(s,{type:'build',planet,kind:'mine'});const minerals=s.empires[0].minerals;
  e.command(s,{type:'reorder',planet,from:1,to:0});assert.equal(p.queue[0].kind,'mine');assert.equal(p.queue[1].done,work);assert.equal(s.empires[0].minerals,minerals);
  unchanged(e,s,{type:'reorder',planet,from:9,to:0});e.validateState(s);
});

test('refits pay explicitly, retain old combat snapshot until completion and require same hull/yard',()=>{
  const e=make(),s=e.createGame(),ship=e.fleets(s)[2],original=structuredClone(ship.design);
  const design={name:'Shielded Marine',hull:ship.design.hull,parts:['drive-1','laser-1','shield-1','shield-1','marines']};
  e.command(s,{type:'design',design});const id=s.empires[0].designs.at(-1).id,quote=e.refitQuote(s,ship.id,id),minerals=s.empires[0].minerals;
  e.command(s,{type:'refit',fleet:ship.id,design:id});assert.equal(s.empires[0].minerals,minerals-quote.cost);assert.deepEqual(ship.design,original);unchanged(e,s,{type:'move',fleet:ship.id,target:13});
  const restored=e.deserialize(e.serialize(s)),refitted=e.fleets(restored).find(f=>f.id===ship.id);for(let i=0;i<quote.turns;i++)e.endTurn(restored);
  assert.equal(refitted.refit,null);assert.equal(refitted.design.name,design.name);assert.notDeepEqual(refitted.design,original);e.validateState(restored);
  unchanged(e,restored,{type:'refit',fleet:refitted.id,design:0});
});

test('research dependencies gate commands and automatic advancement while exposing exact unlocks',()=>{
  const e=make({'dependencies.txt':'weapons | 2 | industry | 2'}),s=e.createGame();
  assert.equal(e.researchAvailable(s,'weapons').available,false);unchanged(e,s,{type:'research',field:'weapons'});
  while(s.empires[0].tech.industry<2)e.endTurn(s);assert.equal(e.researchAvailable(s,'weapons').available,true);
  e.command(s,{type:'research',field:'weapons'});assert.ok(e.unlocks('weapons',2).components.some(c=>c.id==='laser-2'));e.validateState(s);
});

const stagedObjectives = [
 'settle | player | colonies | - | 2 | | | A second home | Found a colony. | 0',
 'science-choice | player | research | industry | 2 | settle | science | Science charter | Select the research route. | 0',
 'science-finish | player | survive | - | 8 | science-choice | science | Patient science | Reach turn eight after research. | 1',
 'expand-choice | player | colonies | - | 3 | settle | expand | Expansion charter | Select the settlement route. | 1'
].join('\n');

test('staged objectives branch once, preserve milestones and complete through legal commands',()=>{
  const e=make({'objectives.txt':stagedObjectives}),s=e.createGame();
  assert.equal(e.objectives(s).find(o=>o.id==='science-choice').status,'locked');const ark=e.fleets(s).find(f=>e.role(f.design,'colony'));
  e.command(s,{type:'colonize',fleet:ark.id,planet:25});assert.equal(e.objectives(s)[0].status,'complete');e.command(s,{type:'chooseObjective',id:'science-choice'});
  assert.equal(e.objectives(s).find(o=>o.id==='expand-choice').status,'excluded');unchanged(e,s,{type:'chooseObjective',id:'expand-choice'});
  let loaded=e.deserialize(e.serialize(s));while(loaded.winner===null&&loaded.turn<30)e.endTurn(loaded);
  assert.equal(loaded.winner,0);assert.equal(loaded.victory,'Campaign objectives complete');assert.ok(loaded.turn>=8);assert.equal(e.objectives(loaded).find(o=>o.id==='science-finish').status,'complete');assert.equal(e.objectives(loaded,1).length,0);e.validateState(loaded);
});

test('shared objectives race across all empires and respect minimum victory turn',()=>{
  const e=make({'scenario.txt':scenario.replace('minVictoryTurn = 1','minVictoryTurn = 5'),'objectives.txt':'hold | * | survive | - | 2 | | | Hold fast | Keep an empire alive. | 1'}),s=e.createGame(2401,'standard',true,2);
  while(s.turn<4)e.endTurn(s);assert.equal(s.winner,null);e.endTurn(s);assert.equal(s.turn,5);assert.equal(s.winner,[...s.empires].sort((a,b)=>e.score(s,b.id)-e.score(s,a.id)||a.id-b.id)[0].id);assert.equal(e.objectives(s,2)[0].status,'complete');
});

test('data events run once or on their bounded interval and survive save/load',()=>{
  const events=['gift | 2 | | resources | player | minerals | 101 | 0','pulse | 2 | | resources | player | energy | 7 | 2','arrival | 3 | | spawn | player | 0 | 12 | 0'].join('\n');
  const e=make({'events.txt':events}),plain=make(),a=e.createGame(),b=plain.createGame();e.endTurn(a);plain.endTurn(b);assert.equal(a.empires[0].minerals,b.empires[0].minerals+101);assert.equal(a.empires[0].energy,b.empires[0].energy+7);
  let s=e.deserialize(e.serialize(a));e.endTurn(s);assert.equal(e.fleets(s).length,4);assert.equal(s.progress.events.arrival,3);e.endTurn(s);assert.equal(s.progress.events.gift,2);assert.equal(s.progress.events.pulse,4);assert.equal(e.fleets(s).length,4);e.validateState(s);
});

test('intelligence retains last-seen ownership and AI decisions do not read remote ownership changes',()=>{
  const e=make(),s=e.createGame(),scout=e.fleets(s)[0];e.command(s,{type:'move',fleet:scout.id,target:13});e.endTurn(s);e.command(s,{type:'move',fleet:scout.id,target:home});e.endTurn(s);
  const before=e.systemIntel(s,13);assert.equal(before.current,false);assert.equal(before.planets[0].owner,-1);
  const a=structuredClone(s),b=structuredClone(s);b.planets[26].owner=1;b.planets[26].pop=20;
  assert.deepEqual(e.systemIntel(a,13),e.systemIntel(b,13));e.ai(a,0);e.ai(b,0);assert.deepEqual(e.fleets(a).map(f=>f.path),e.fleets(b).map(f=>f.path));assert.equal(before.turn,2);
});

test('zero-energy invasion uses reduced attack and combat reports include force and damage',()=>{
  const e=make(),s=e.createGame(),p=s.planets[26],marine=e.fleets(s)[2];p.owner=1;p.pop=20;p.buildings.defence=0;marine.system=13;e.reveal(s,0,13);e.reveal(s,1,13);s.relations[0][1]=s.relations[1][0]='war';s.empires[0].energy=0;
  assert.equal(e.designStats(marine.design).attack,20);assert.equal(e.defence(s,p),16);e.endTurn(s);assert.equal(p.owner,1);assert.ok(s.battles[0].damage>0);assert.equal(s.battles[0].forces.find(f=>f.owner===0).attack,10);e.validateState(s);
});

test('extension save admission rejects invalid group, order, event, report and intelligence records',()=>{
  const e=make(),s=e.createGame();e.endTurn(s);
  for(const mutation of [x=>x.player=99,x=>x.fleets[0].order.type='execute',x=>x.groups.push({id:1,owner:0,name:'ghost',ships:[999,1000]}),x=>x.progress.events.unknown=1,x=>x.progress.completed.push('0:unknown'),x=>x.intel[0][0].fleets[0].ships=999,x=>x.reports[0].income[0].minerals=Infinity,x=>x.fleets[0].refit={design:x.fleets[0].design,cost:0,work:1,done:0}]){const bad=structuredClone(s);mutation(bad);assert.throws(()=>e.deserialize(JSON.stringify(bad)));}
});

test('AI upgrades combat hulls and larger modules without silently changing existing ships',()=>{
  const e=make(),s=e.createGame(),before=e.fleets(s).map(f=>structuredClone(f.design));
  for(const field of Object.keys(s.empires[0].tech))s.empires[0].tech[field]=3;
  e.ai(s,0);const template=s.empires[0].designs.find(d=>e.role(d,'assault'));
  assert.equal(template.hull,'cruiser-0');assert.ok(template.parts.some(id=>e.content.components[id].level>=3&&e.content.components[id].slots>1));
  assert.ok(e.designStats(template).attack>e.designStats(before[2]).attack);assert.ok(e.role(template,'assault'));assert.ok(e.role(template,'engine'));
  for(const f of e.fleets(s))assert.deepEqual(f.design,before[f.design.id]);e.validateState(s);
});

test('archive mission targeting uses last-seen recovery status rather than hidden current state',()=>{
  const objectives='find | player | archives | * | 1 | | | Recover an archive | Survey a relic. | 1';
  const e=make({'objectives.txt':objectives}),s=e.createGame(),relic=s.systems.find(x=>x.relic&&x.id!==home);
  e.reveal(s,0,relic.id);const a=structuredClone(s),b=structuredClone(s);b.systems[relic.id].claimed=true;
  assert.equal(e.systemIntel(a,relic.id).archive,true);assert.deepEqual(e.systemIntel(a,relic.id),e.systemIntel(b,relic.id));
  e.ai(a,0);e.ai(b,0);assert.deepEqual(e.fleets(a).map(f=>f.path),e.fleets(b).map(f=>f.path));assert.deepEqual(a.empires[0].designs,b.empires[0].designs);
});

test('migration rejects injected v2 fields instead of silently replacing unknown v1 data',async()=>{
  const fixture=JSON.parse(await fs.readFile(new URL('fixtures/voidward-v1-frontier.json',import.meta.url),'utf8')),e=createEngine(parsePack(fixture.pack));
  for(const mutation of [x=>x.player=2,x=>x.progress={},x=>x.intel=[],x=>x.fleets[0].order={type:'execute'},x=>x.battles.push({turn:1,system:0,participants:[],losses:[0,0,0],captured:[],damage:9})]){const s=structuredClone(fixture.state);mutation(s);assert.throws(()=>e.migrateState(s));}
});

test('uncontacted foreign diplomacy does not reveal names in player dispatches',()=>{
  const e=make(),s=e.createGame();e.reveal(s,1,e.content.empires[2].home);const before=structuredClone(s.log);
  e.command(s,{type:'diplomacy',target:2,offer:'trade'},1);assert.deepEqual(s.log,before);assert.equal(s.relations[1][2],'trade');
});

test('turn-one events execute during creation exactly once and never during save validation',()=>{
  const e=make({'events.txt':'arrival | 1 | | resources | player | minerals | 111 | 0'}),s=e.createGame();assert.equal(s.empires[0].minerals,e.content.rules.startMinerals+111);assert.equal(s.progress.events.arrival,1);
  const before=e.serialize(s);e.validateState(s);assert.equal(e.serialize(s),before);assert.equal(e.deserialize(before).empires[0].minerals,s.empires[0].minerals);
  e.endTurn(s);assert.equal(s.progress.events.arrival,1);
});

test('event reinforcements respect queued ship reservations and retry after space opens',()=>{
  const e=make({'rules.txt':raw['rules.txt'].replace('fleetLimit = 60','fleetLimit = 4'),'events.txt':'arrival | 2 | | spawn | player | 0 | 12 | 0'}),s=e.createGame();
  e.command(s,{type:'build',planet,kind:'ship',design:2});e.endTurn(s);assert.equal(s.progress.events.arrival,undefined);assert.equal(e.fleets(s).length,3);
  e.command(s,{type:'cancel',planet,index:0});e.endTurn(s);assert.equal(s.progress.events.arrival,3);assert.equal(e.fleets(s).length,4);e.validateState(s);
});

test('defeated empires cannot be resurrected by marine-only reinforcement events',()=>{
  const e=make({'events.txt':'ghost | 2 | | spawn | 1 | 2 | 0 | 0'}),s=e.createGame();
  for(const p of e.colonies(s,1)){p.owner=2;e.reveal(s,2,p.system);}s.fleets=s.fleets.filter(f=>f.owner!==1);e.checkVictory(s);assert.equal(s.empires[1].defeated,true);
  e.endTurn(s);assert.equal(e.fleets(s,1).length,0);assert.equal(s.progress.events.ghost,undefined);e.validateState(s);
});

test('monotonic counters admit long campaign IDs and reject generation before overflow',()=>{
  const e=make({'events.txt':'arrival | 2 | | spawn | player | 0 | 12 | 0'}),s=e.createGame();s.nextId=999999;e.validateState(s);e.endTurn(s);
  assert.equal(s.nextId,1000000);assert.ok(s.fleets.some(f=>f.id===999999));e.validateState(s);
  const x=e.createGame();x.nextId=1000000;const count=e.fleets(x).length;assert.throws(()=>e.endTurn(x),/identifier capacity/);assert.equal(x.nextId,1000000);assert.equal(e.fleets(x).length,count);assert.ok(x.fleets.every(f=>f.id<1000000));
  const y=e.createGame();y.nextGroup=1000000;e.validateState(y);unchanged(e,y,{type:'group',name:'overflow',fleets:e.fleets(y).slice(0,2).map(f=>f.id)});
});
