// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parsePack, PACK_FILES } from '../demos/4x-game-lab/voidward/js/content.js';
import { createEngine } from '../demos/4x-game-lab/voidward/js/core.js';
import hooks from '../demos/4x-game-lab/voidward/mods/machine-dawn/hooks.js';
const load = async id => Object.fromEntries(await Promise.all(PACK_FILES.map(async n => [n + '.txt', await fs.readFile(new URL(`../demos/4x-game-lab/voidward/mods/${id}/${n}.txt`, import.meta.url), 'utf8')])));
const raw = await load('frontier'), smallRaw = await load('machine-dawn');
const pack = parsePack(raw), engine = createEngine(pack);
const fresh = () => engine.createGame(2401);
const home = pack.empires[0].home, homePlanet = home * pack.rules.planetsPerSystem;

test('seeded generation, names, faction ship families and integer resources are reproducible', () => {
  const a = fresh(), b = fresh(); assert.deepEqual(a, b); assert.notDeepEqual(a.systems, engine.createGame(1).systems);
  assert.equal(a.planets.length, 60); assert.equal(a.systems[home].name, 'Sol');
  assert.equal(a.fleets[0].name, 'TAS Wayfarer'); assert.equal(a.fleets[3].name, 'VC Whisper');
  assert.equal(new Set(a.fleets.map(f => f.design.hull)).size, 9); assert.equal(engine.validateState(a), true);
  assert.throws(() => engine.createGame(-1)); assert.throws(() => engine.createGame(1.1));
});

test('frontier exploration, queued movement, colonisation and consumed colony ark', () => {
  const s = fresh(), scout = s.fleets[0], ark = s.fleets[1], goal = home + 1;
  assert.equal(s.empires[0].known.includes(goal), false);
  assert.deepEqual(engine.route(s, home, goal), [home, goal]);
  engine.command(s, { type: 'move', fleet: scout.id, target: goal });
  engine.command(s, { type: 'move', fleet: ark.id, target: goal });
  assert.equal(scout.system, home); engine.endTurn(s);
  assert.equal(scout.system, goal); assert.equal(s.empires[0].known.includes(goal), true);
  const minerals = s.empires[0].minerals, energy = s.empires[0].energy;
  engine.command(s, { type: 'colonize', fleet: ark.id, planet: goal * 2 });
  assert.equal(engine.colonies(s).length, 2); assert.equal(s.fleets.some(f => f.id === ark.id), false);
  assert.equal(s.empires[0].minerals, minerals - pack.rules.colonizeMinerals);
  assert.equal(s.empires[0].energy, energy - pack.rules.colonizeEnergy); engine.validateState(s);
});

test('invalid commands are free and leave state byte-for-byte unchanged', () => {
  const s = fresh();
  for (const command of [
    { type: 'move', fleet: 1, target: 29 }, { type: 'move', fleet: 5, target: home },
    { type: 'colonize', fleet: 1, planet: homePlanet + 1 },
    { type: 'build', planet: 0, kind: 'mine' }, { type: 'build', planet: homePlanet, kind: '__proto__' },
    { type: 'cancel', planet: homePlanet, index: 0 }, { type: 'research', field: 'constructor' },
    { type: 'diplomacy', target: 1, offer: 'war' }, { type: 'unknown' }
  ]) { const before = engine.serialize(s); assert.throws(() => engine.command(s, command)); assert.equal(engine.serialize(s), before); }
});

test('construction admits cost up front, completes, and refunds unfinished work exactly', () => {
  const s = fresh(), p = s.planets[homePlanet];
  engine.command(s, { type: 'build', planet: p.id, kind: 'lab' });
  assert.equal(s.empires[0].minerals, pack.rules.startMinerals - pack.buildings.lab.cost);
  engine.endTurn(s); assert.equal(p.queue[0].done, engine.production(s, p));
  const before = s.empires[0].minerals, q = p.queue[0];
  const expected = Number(BigInt(q.cost) * BigInt(q.work - q.done) / BigInt(q.work));
  engine.command(s, { type: 'cancel', planet: p.id, index: 0 }); assert.equal(s.empires[0].minerals, before + expected);
  engine.command(s, { type: 'build', planet: p.id, kind: 'ship', design: 2 });
  for (let i = 0; i < 4; i++) engine.endTurn(s);
  assert.equal(p.queue.length, 0); assert.equal(engine.fleets(s).length, 4); engine.validateState(s);
});

test('facility and fleet capacity include queued reservations', () => {
  const s = fresh(), p = s.planets[homePlanet]; s.empires[0].minerals = 10000;
  for (let i = 0; i < 2; i++) engine.command(s, { type: 'build', planet: p.id, kind: 'mine' });
  const before = engine.serialize(s); assert.throws(() => engine.command(s, { type: 'build', planet: p.id, kind: 'mine' })); assert.equal(engine.serialize(s), before);
  const limited = parsePack({ ...raw, 'rules.txt': raw['rules.txt'].replace('fleetLimit = 60', 'fleetLimit = 3') });
  const e = createEngine(limited), x = e.createGame(); assert.throws(() => e.command(x, { type: 'build', planet: homePlanet, kind: 'ship', design: 0 }));
});

test('ship designer supports repeated parts, faction locks, capacity and research gates', () => {
  const s = fresh();
  const d = { name: 'Twin Lance', hull: 'frigate-0', parts: ['drive-1', 'laser-1', 'laser-1', 'shield-1', 'marines'] };
  engine.command(s, { type: 'design', design: d }); assert.equal(s.empires[0].designs.length, 4); assert.equal(engine.designStats(d).attack, 20);
  for (const bad of [{ ...d, hull: 'frigate-1' }, { ...d, parts: ['drive-5'] }, { ...d, parts: ['laser-1'] }, { ...d, parts: Array(20).fill('drive-1') }, { ...d, parts: ['constructor'] }]) assert.throws(() => engine.command(s, { type: 'design', design: bad }));
  engine.command(s, { type: 'build', planet: homePlanet, kind: 'ship', design: 3 });
  d.parts.push('laser-1'); s.empires[0].designs[3].parts.push('laser-1');
  assert.equal(s.planets[homePlanet].queue[0].design.parts.length, 5, 'queued ship preserves its own snapshot');
});

test('research unlocks newly constructed components without retroactive refits', () => {
  const s = fresh(), original = structuredClone(s.fleets[0]); s.empires[0].science = 200;
  engine.command(s, { type: 'research', field: 'weapons' }); engine.endTurn(s);
  assert.equal(s.empires[0].tech.weapons, 2); assert.deepEqual(s.fleets[0].design, original.design);
  engine.command(s, { type: 'design', design: { name: 'Lance II', hull: 'frigate-0', parts: ['drive-1', 'laser-2', 'marines'] } });
});

test('diplomacy requires contact, has symmetric treaties and real economy consequences', () => {
  const s = fresh(); engine.reveal(s, 0, pack.empires[1].home);
  const before = engine.income(s).energy, reserve = s.empires[0].energy;
  engine.command(s, { type: 'diplomacy', target: 1, offer: 'trade' });
  assert.equal(s.relations[0][1], 'trade'); assert.equal(s.relations[1][0], 'trade');
  assert.equal(engine.income(s).energy, before + pack.rules.tradeIncome); assert.equal(s.empires[0].energy, reserve - pack.rules.tradeCost);
  engine.command(s, { type: 'diplomacy', target: 1, offer: 'war' });
  assert.equal(s.relations[1][0], 'war'); assert.equal(engine.income(s).energy, before);
  engine.command(s, { type: 'diplomacy', target: 1, offer: 'peace' }); assert.equal(s.relations[1][0], 'neutral');
});

test('hostile fleet combat applies volleys and records losses', () => {
  const s = fresh(), enemy = s.fleets.find(f => f.owner === 1);
  enemy.system = home; enemy.hp = 1; enemy.path = [home + 1]; // AI retains this route; put player pursuer there too.
  const target = s.fleets.find(f => f.owner === 0 && engine.role(f.design, 'assault'));
  target.system = home + 1; engine.reveal(s, 0, home + 1); engine.reveal(s, 1, home);
  s.relations[0][1] = s.relations[1][0] = 'war'; engine.endTurn(s);
  assert.equal(s.fleets.some(f => f.id === enemy.id), false); assert.ok(s.battles.some(b => b.losses[1] > 0)); engine.validateState(s);
});

test('planet capture needs marine role, sufficient attack and no defending fleet', () => {
  const s = fresh(), enemyPlanet = s.planets[(home + 1) * 2];
  enemyPlanet.owner = 1; enemyPlanet.pop = 20; enemyPlanet.buildings.defence = 0;
  const f = s.fleets.find(f => f.owner === 0 && engine.role(f.design, 'assault')); f.system = home + 1; engine.reveal(s, 0, home + 1);
  s.relations[0][1] = s.relations[1][0] = 'war'; engine.endTurn(s);
  assert.equal(enemyPlanet.owner, 0); assert.equal(enemyPlanet.pop, 11); assert.ok(s.battles[0].captured.length); engine.validateState(s);
});

test('expansion, scientific victory, defeat and council scoring terminate campaigns', () => {
  let s = fresh(); for (const p of s.planets.slice(0, pack.rules.colonyTarget)) { p.owner = 0; p.pop = 20; } engine.checkVictory(s); assert.equal(s.winner, 0); assert.match(s.victory, /Expansion/); assert.throws(() => engine.endTurn(s));
  s = fresh(); for (const k in s.empires[0].tech) s.empires[0].tech[k] = 5; engine.checkVictory(s); assert.equal(s.winner, 0); assert.match(s.victory, /Ascension/);
  s = fresh(); s.planets[homePlanet].owner = 1; s.fleets = s.fleets.filter(f => f.owner !== 0); engine.checkVictory(s); assert.notEqual(s.winner, null); assert.notEqual(s.winner, 0); assert.match(s.victory, /fallen/);
  s = fresh(); s.turn = pack.rules.turnLimit; engine.checkVictory(s); assert.equal(s.winner, 0); assert.match(s.victory, /Council/);
});

test('legal play can win a shortened, content-defined campaign', () => {
  const p = parsePack({ ...raw, 'rules.txt': raw['rules.txt'].replace('colonyTarget = 14', 'colonyTarget = 2') }); const e = createEngine(p), s = e.createGame();
  const ark = e.fleets(s).find(f => e.role(f.design, 'colony'));
  e.command(s, { type: 'colonize', fleet: ark.id, planet: homePlanet + 1 });
  assert.equal(s.winner, 0); assert.equal(e.validateState(s), true);
});

test('save round-trip and malformed state rejection', () => {
  const s = fresh(); engine.endTurn(s); assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
  for (const mutate of [x => x.empires[0].minerals = -1, x => x.systems[0].links.push(29), x => x.fleets[0].hp = Infinity, x => x.fleets[0].design.parts = ['unknown'], x => x.relations[0][1] = 'war', x => x.planets[0].queue = [{}], x => x.log[0].text = {}, x => x.winner = 99, x => x.planets[0].buildings.unknown = 1, x => x.empires[0].tech.unknown = 'bad', x => x.fleets[0].design.parts[0] = {}, x => x.payload = {}]) {
    const bad = structuredClone(s); mutate(bad); assert.throws(() => engine.deserialize(JSON.stringify(bad)));
  }
  assert.throws(() => engine.deserialize(' '.repeat(1500001)));
});

test('text packs really control names, ships, prices, star topology and music', () => {
  const changed = { ...raw, 'empire_names.txt': raw['empire_names.txt'].replace('Terran Assembly', 'Independent Worlds'), 'planet_names.txt': raw['planet_names.txt'].replace('Sol Prime', 'Liberty'), 'ships.txt': raw['ships.txt'].replace('TAS Wayfarer', 'Free Bird'), 'components.txt': raw['components.txt'].replace('laser-1 | Lance array 1 | weapon | 1 | 18 | 0 | 10', 'laser-1 | Lance array 1 | weapon | 1 | 19 | 0 | 33') };
  const p = parsePack(changed), e = createEngine(p), s = e.createGame(); assert.equal(p.empires[0].name, 'Independent Worlds'); assert.equal(s.planets[homePlanet].name, 'Liberty'); assert.equal(s.fleets[0].name, 'Free Bird'); assert.equal(e.designStats(s.fleets[0].design).attack, 33);
  assert.equal(p.components['laser-1'].cost, 19); assert.ok(p.hulls['ark-1'].shape.length > 3); assert.equal(p.music.length, 8);
});

test('bad content is rejected: missing files, disconnected maps, prototype keys, bad ships and shapes', () => {
  for (const change of [
    { 'empire_names.txt': '' }, { 'map.txt': raw['map.txt'].replace('0 | 1,6', '0 | 2,6') },
    { 'hulls.txt': raw['hulls.txt'].replace('scout-0 |', 'constructor |') },
    { 'hulls.txt': raw['hulls.txt'].replace('0,-50;', '0,-999;') },
    { 'ships.txt': raw['ships.txt'].replace('drive-1,laser-1', 'drive-5,laser-1') },
    { 'rules.txt': raw['rules.txt'] + '\nturnLimit = 200\n' },
    { 'components.txt': raw['components.txt'].replace(' | engine |', ' | executable |') },
    { 'campaign.txt': 'id = ../bad\nversion = 1.0.0\ntitle = Nope\ndescription = Nope' }
  ]) assert.throws(() => parsePack({ ...raw, ...change }));
  assert.throws(() => parsePack({}));
});

test('small mod sector uses ExactGraph routes with the same shortest-path semantics', () => {
  const p = parsePack(smallRaw), e = createEngine(p), s = e.createGame();
  s.empires[0].known = s.systems.map(x => x.id);
  for (const start of s.systems) for (const goal of s.systems) {
    const route = e.route(s, start.id, goal.id);
    const manhattan = Math.abs(start.id % 4 - goal.id % 4) + Math.abs(Math.floor(start.id / 4) - Math.floor(goal.id / 4));
    assert.equal(route.length - 1, manhattan);
    route.slice(1).forEach((id, i) => assert.ok(s.systems[route[i]].links.includes(id)));
  }
});

test('installed source hooks execute once at their declared turn and never during validation', () => {
  const p = parsePack(smallRaw), hooked = createEngine(p, hooks), plain = createEngine(p);
  const a = hooked.createGame(), b = plain.createGame();
  assert.match(a.log[0].text, /Network reboot/); assert.notEqual(a.log[0].text, b.log[0].text);
  for (let i = 1; i < 8; i++) { hooked.endTurn(a); plain.endTurn(b); }
  assert.equal(a.empires[0].minerals, b.empires[0].minerals + 100);
  const before = hooked.serialize(a); hooked.validateState(a); assert.equal(hooked.serialize(a), before);
});

test('32 seeds × two campaigns: deterministic AI, bounded resources and complete state validation', () => {
  for (const content of [pack, parsePack(smallRaw)]) {
    const e = createEngine(content);
    for (let seed = 0; seed < 32; seed++) {
      const a = e.createGame(seed), b = e.createGame(seed);
      for (let turn = 0; turn < 80 && a.winner === null; turn++) { e.endTurn(a); e.endTurn(b); e.validateState(a); }
      assert.equal(e.serialize(a), e.serialize(b)); assert.notEqual(a.winner, null, 'AI must complete this campaign');
    }
  }
});
