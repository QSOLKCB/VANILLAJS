// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/4XGAMES 030859385ac8929e066702ef8af0518663480653: native VANILLAJS imports.
// Authoritative campaign state: integer resources, seeded decisions, explicit turns.
import { decodeStateText } from './save-codec.js';
import { nextRandom, mulDiv, add } from '../../../../modules/integer-math/index.js';

import { ExactRational } from '../../../../modules/exact-rational/index.js';
import { ExactGraph, breadthFirst, MAX_VERTICES } from '../../../../modules/exact-graph/index.js';

export function createEngine(content, hooks = {}) {
const { rules: R, empires: FACTIONS, tech: TECH, hulls: HULLS, components: COMPONENTS, buildings: BUILDINGS, planets: PLANET_TYPES } = content;
const MAX_IDENTIFIER = 1000000;
const VERSION = 2, TURN_LIMIT = R.turnLimit, COLONY_TARGET = R.colonyTarget;
const N = content.map.length, E = FACTIONS.length, P = R.planetsPerSystem;
const NAMES = content.systemNames;
const fail = message => { throw new Error(message); };
const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
function random(state, bound) { state.rng = nextRandom(state.rng); return mulDiv(state.rng >>> 1, bound, 2147483647) % bound; }
const colonies = (state, owner = state.player) => state.planets.filter(p => p.owner === owner);
const fleets = (state, owner = state.player) => state.fleets.filter(f => f.owner === owner);
const systemOf = (state, planet) => state.systems[planet.system];
const atWar = (state, a, b) => a !== b && state.relations[a][b] === 'war';
const techCost = level => R.researchBase + level * level * R.researchStep;
function log(state, text, kind = 'info') {
  state.log.unshift({ turn: state.turn, text, kind });
  state.log.length = Math.min(state.log.length, 100);
}
function reveal(state, owner, id) {
  const e = state.empires[owner];
  if (!e.known.includes(id)) {
    e.known.push(id); e.known.sort((a, b) => a - b);
    if (owner === state.player) log(state, `Survey complete: ${state.systems[id].name}.`, 'survey');
  }
  for (const other of state.empires) {
    if (other.id !== owner && (state.planets.some(p => p.system === id && p.owner === other.id) || state.fleets.some(f => f.system === id && f.owner === other.id))) {
      if (!e.contacts.includes(other.id)) {
        e.contacts.push(other.id); other.contacts.push(owner);
        e.contacts = [...new Set(e.contacts)]; other.contacts = [...new Set(other.contacts)];
        if (owner === state.player || other.id === state.player) log(state, `First contact: ${FACTIONS[owner === state.player ? other.id : owner].name}. Diplomatic channels open.`, 'diplomacy');
      }
    }
  }
  if (state.intel?.[owner]) { const row=snapshotIntel(state,id), index=state.intel[owner].findIndex(x=>x.system===id); if(index<0)state.intel[owner].push(row);else state.intel[owner][index]=row; }
}
function visibleSystems(state, owner = state.player) {
  const seen = new Set(state.empires[owner].known);
  for (const id of [...seen]) for (const n of state.systems[id].links) seen.add(n);
  return seen;
}
function route(state, start, goal, owner = state.player) {
  if (!int(start, 0, N - 1) || !int(goal, 0, N - 1)) return [];
  const visible = visibleSystems(state, owner), known = new Set(state.empires[owner].known);
  if (!visible.has(goal)) return [];
  // Ternary Reach's ExactGraph path stays within the donor's 16-vertex contract.
  // Larger mod galaxies use the equivalent bounded, ascending-neighbour BFS below.
  if (N <= MAX_VERTICES) {
    const allowed = id => known.has(id) || id === start || id === goal;
    const edges = state.systems.flatMap(s => s.links.filter(n => s.id < n && allowed(s.id) && allowed(n)).map(n => [s.id, n]));
    const tree = breadthFirst(new ExactGraph(N, edges), start);
    if (tree.depth[goal] < 0) return [];
    const path = []; for (let id = goal; id !== -1; id = tree.parent[id]) path.push(id);
    return path.reverse();
  }
  const queue = [start], parent = new Map([[start, -1]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === goal) { const path = []; for (let p = id; p !== -1; p = parent.get(p)) path.push(p); return path.reverse(); }
    if (id !== start && !known.has(id)) continue; // Never route through an unsurveyed system.
    for (const n of state.systems[id].links) if (visible.has(n) && !parent.has(n)) { parent.set(n, id); queue.push(n); }
  }
  return [];
}
function designStats(design) {
  const hull = HULLS[design.hull];
  const stats = { hp: hull.hp, attack: 0, speed: 0, cost: hull.cost, work: hull.work, slots: 0, roles: [] };
  for (const id of design.parts) {
    const c = COMPONENTS[id];
    stats.hp += c.hp; stats.attack += c.attack; stats.cost += c.cost; stats.slots += c.slots;
    stats.speed = Math.max(stats.speed, c.speed);
    if (!stats.roles.includes(c.kind)) stats.roles.push(c.kind);
  }
  return stats;
}
const role = (design, kind) => designStats(design).roles.includes(kind);
function checkDesign(design, tech, owner = null) {
  if (!design || !Object.hasOwn(HULLS, design.hull) || typeof design.name !== 'string' || !design.name.trim() || design.name.length > 32 || !Array.isArray(design.parts) || !design.parts.length || design.parts.length > 40) fail('Invalid ship design.');
  const h = HULLS[design.hull];
  if (owner !== null && h.faction !== -1 && h.faction !== owner) fail('This hull belongs to another empire.');
  if (h.level > tech[h.tech]) fail('Research this hull first.');
  for (const id of design.parts) {
    if (typeof id !== 'string' || !Object.hasOwn(COMPONENTS, id)) fail('Unknown component.');
    const c = COMPONENTS[id];
    if (c.level > tech[c.tech]) fail('Research this component first.');
  }
  const stats = designStats(design);
  if (!stats.speed) fail('Install at least one engine.');
  if (stats.slots > h.slots) fail('The design exceeds its hull capacity.');
  return true;
}
function addFleet(state, owner, system, design, name = design.name) {
  if (state.fleets.length >= E * R.fleetLimit || fleets(state, owner).length >= R.fleetLimit) return false;
  if (!int(state.nextId,1,MAX_IDENTIFIER-1)) fail('Ship identifier capacity reached.');
  state.fleets.push({ id: state.nextId++, owner, system, name, design: structuredClone(design), hp: designStats(design).hp, path: [], order: { type: 'hold', target: null, origin: system }, refit: null });
  return true;
}
function createGame(seed = 2401, difficulty = 'standard', runHooks = true, player = (content.scenario?.playable || [0])[0]) {
  if (!int(seed, 0, 4294967295) || !['relaxed', 'standard', 'veteran'].includes(difficulty)) fail('Invalid campaign settings.');
  if (!(content.scenario?.playable || [0]).includes(player)) fail('This empire is not playable in this scenario.');
  const state = { version: VERSION, player, groups: [], nextGroup: 1, progress: { completed: [], events: {}, choices: {}, discoveries: Array.from({length:E}, () => []) }, intel: Array.from({length:E}, () => []), reports: [], seed, rng: seed, difficulty, turn: 1, nextId: 1, systems: [], planets: [], fleets: [], empires: [], relations: Array.from({ length: E }, (_, a) => Array.from({ length: E }, (_, b) => a === b ? 'self' : 'neutral')), log: [], battles: [], winner: null, victory: '', modState: {} };
  for (let id = 0; id < N; id++) {
    const row = Math.floor(id / R.columns), col = id % R.columns;
    const map = content.map[id];
    state.systems.push({ id, name: NAMES[id], x: 90 + col * 166 + random(state, 45), y: 90 + row * 156 + random(state, 45), links: [...map.links], relic: map.relic, claimed: false });
    for (let orbit = 0; orbit < P; orbit++) {
      const type = Object.keys(PLANET_TYPES)[random(state, Object.keys(PLANET_TYPES).length)];
      state.planets.push({ id: id * P + orbit, system: id, name: content.planetNames[id * P + orbit], type, owner: -1, pop: 0, buildings: Object.fromEntries(Object.keys(BUILDINGS).map(k => [k, 0])), queue: [] });
    }
  }
  for (let id = 0; id < E; id++) {
    const designs = content.ships.filter(s => s.empire === id).map((s, i) => ({ id: i, name: s.name, hull: s.hull, parts: [...s.parts] }));
    state.empires.push({ id, minerals: R.startMinerals, energy: R.startEnergy, science: 0, tech: Object.fromEntries(Object.keys(TECH).map(k => [k, 1])), research: 'industry', known: [], contacts: [], designs, defeated: false });
    const home = FACTIONS[id].home, planet = state.planets[home * P];
    Object.assign(planet, { owner: id, type: Object.keys(PLANET_TYPES)[0], pop: Math.min(60, Object.values(PLANET_TYPES)[0].max), buildings: Object.fromEntries(Object.keys(BUILDINGS).map(k => [k, ['mine', 'reactor', 'lab', 'yard', 'defence'].includes(k) ? 1 : 0])) });
    for (const design of designs) addFleet(state, id, home, design);
    reveal(state, id, home);
  }
  for (const layout of content.layout || []) Object.assign(state.systems[layout.id], {x:layout.x,y:layout.y});
  for (const start of content.starts || []) {
    const e = state.empires[start.empire];
    for (const field of ['minerals','energy','science']) e[field] = start[field];
    for (const id of start.colonies) {
      const p = state.planets[id]; p.owner = start.empire; p.pop = Math.min(40, PLANET_TYPES[p.type].max);
      p.buildings.mine = 1; p.buildings.yard = 1; reveal(state, start.empire, p.system);
    }
  }
  refreshIntel(state);
  state.log = [];
  log(state, 'The frontier is yours. Survey a neighbouring star, then send your colony ark to settle a new world.', 'survey');
  if (runHooks) {
    if (hooks.onCreate) hooks.onCreate(state, api);
    updateProgress(state); processEvents(state); refreshIntel(state);
  }
  return state;
}
function income(state, owner = state.player) {
  const e = state.empires[owner];
  const out = { minerals: 0, energy: 0, science: 0, upkeep: fleets(state, owner).reduce((sum, f) => sum + Math.max(1, Math.ceil(HULLS[f.design.hull].slots / 4)), 0) };
  for (const p of colonies(state, owner)) {
    out.minerals += PLANET_TYPES[p.type].minerals + facilityYield(p, 'minerals') + e.tech.industry * R.industryMinerals;
    out.energy += R.baseEnergy + Math.floor(p.pop / 10) + facilityYield(p, 'energy');
    out.science += R.baseScience + Math.floor(p.pop / 20) + facilityYield(p, 'science');
  }
  out.energy += state.relations[owner].filter(r => r === 'trade').length * R.tradeIncome;
  out.energy -= out.upkeep;
  return out;
}
function facilityYield(planet, field) { return Object.entries(planet.buildings).reduce((n, [k, count]) => n + count * BUILDINGS[k][field], 0); }
function production(state, planet) { return R.baseProduction + facilityYield(planet, 'production') + state.empires[planet.owner].tech.industry * R.industryProduction; }
function defence(state, planet) { return R.baseDefence + facilityYield(planet, 'defence') + state.empires[planet.owner].tech.shields * R.shieldDefence; }

// Commands validate completely before writing. The caller controls which empire may act.
function command(state, action, owner = state.player) {
  if (state.winner !== null) fail('This campaign has ended. Start a new expedition.');
  const e = state.empires[owner];
  if (!e || e.defeated) fail('This empire can no longer issue orders.');
  if (extendedCommand(state, action, owner)) return;
  if (action.type === 'move') {
    const f = state.fleets.find(f => f.id === action.fleet && f.owner === owner);
    if (!f) fail('Select one of your fleets.');
    const path = route(state, f.system, action.target, owner);
    if (!path.length) fail('No surveyed route. Explore the frontier one star at a time.');
    if (f.refit) fail('This ship is refitting.');
    if (state.groups.some(g => g.ships.includes(f.id))) fail('Issue this course to the fleet group.');
    f.path = path.slice(1); f.order = {type:'hold',target:null,origin:f.system}; return;
  }
  if (action.type === 'hold') {
    const f = state.fleets.find(f => f.id === action.fleet && f.owner === owner);
    if (!f) fail('Fleet unavailable.');
    const group = state.groups.find(g => g.ships.includes(f.id));
    for (const ship of group ? state.fleets.filter(x => group.ships.includes(x.id)) : [f]) { ship.path = []; if (!ship.refit) ship.order = {type:'hold',target:null,origin:ship.system}; } return;
  }
  if (action.type === 'colonize') {
    const p = state.planets[action.planet], f = state.fleets.find(f => f.id === action.fleet && f.owner === owner);
    if (!p || !f || f.system !== p.system || !role(f.design, 'colony') || p.owner !== -1) fail('An unclaimed planet and a colony ark in the same system are required.');
    if (state.fleets.some(enemy => enemy.system === p.system && atWar(state, owner, enemy.owner))) fail('Clear hostile fleets before colonising.');
    if (e.minerals < R.colonizeMinerals || e.energy < R.colonizeEnergy) fail(`Colonisation needs ${R.colonizeMinerals} minerals and ${R.colonizeEnergy} energy.`);
    if (f.refit) fail('A ship undergoing refit cannot colonise.');
    e.minerals -= R.colonizeMinerals; e.energy -= R.colonizeEnergy; p.owner = owner; p.pop = 20; p.buildings.mine = 1;
    state.fleets = state.fleets.filter(x => x !== f); cleanGroups(state);
    if (owner === state.player) log(state, `${p.name} founded. The colony ark becomes the first settlement.`, 'colony');
    checkVictory(state); return;
  }
  if (action.type === 'build') {
    const p = state.planets[action.planet];
    if (!p || p.owner !== owner) fail('Choose one of your colonies.');
    if (p.queue.length >= 5) fail('Production queue full (five orders).');
    let item;
    if (action.kind === 'ship') {
      const d = e.designs.find(d => d.id === action.design);
      if (!d || !p.buildings.yard) fail('Ship construction requires a design and an orbital shipyard.');
      checkDesign(d, e.tech, owner);
      const stats = designStats(d);
      if (fleets(state, owner).length + colonies(state, owner).reduce((n, c) => n + c.queue.filter(q => q.kind === 'ship').length, 0) >= R.fleetLimit) fail('Fleet capacity reached.');
      item = { kind: 'ship', design: structuredClone(d), name: d.name, cost: stats.cost, work: stats.work, done: 0 };
    } else {
      if (!Object.hasOwn(BUILDINGS, action.kind)) fail('Unknown facility.');
      const b = BUILDINGS[action.kind];
      if (p.buildings[action.kind] + p.queue.filter(q => q.kind === action.kind).length >= R.facilityLimit) fail('Facility limit reached.');
      item = { kind: action.kind, name: b.name, cost: b.cost, work: b.work, done: 0 };
    }
    if (e.minerals < item.cost) fail('Insufficient minerals.');
    e.minerals -= item.cost; p.queue.push(item); return;
  }
  if (action.type === 'cancel') {
    const p = state.planets[action.planet];
    if (!p || p.owner !== owner || !int(action.index, 0, p.queue.length - 1)) fail('Production order unavailable.');
    const q = p.queue.splice(action.index, 1)[0];
    const refund = new ExactRational(q.cost).multiply(new ExactRational(q.work - q.done, q.work));
    e.minerals = Math.min(999999, e.minerals + Number(refund.numerator / refund.denominator)); return;
  }
  if (action.type === 'research') {
    if (!Object.hasOwn(TECH, action.field) || e.tech[action.field] >= R.maxTech) fail('Choose an unfinished research field.');
    const gate = researchAvailable(state, action.field, owner); if (!gate.available) fail(gate.reason);
    e.research = action.field; return;
  }
  if (action.type === 'design') {
    checkDesign(action.design, e.tech, owner);
    if (e.designs.length >= 24) fail('Design archive full (24 classes).');
    const { name, hull, parts } = action.design;
    e.designs.push({ id: e.designs.length, name: name.trim(), hull, parts: [...parts] }); return;
  }
  if (action.type === 'diplomacy') {
    const other = action.target;
    if (!int(other, 0, E - 1) || other === owner || !e.contacts.includes(other) || state.empires[other].defeated) fail('Establish contact with an active empire first.');
    const current = state.relations[owner][other];
    if (!['war', 'peace', 'trade'].includes(action.offer)) fail('Unknown diplomatic offer.');
    if (action.offer === 'trade' && current !== 'neutral') fail('A trade pact requires neutral relations.');
    if (action.offer === 'peace' && current !== 'war') fail('You are already at peace.');
    if (action.offer === 'war' && current === 'war') fail('War is already declared.');
    const cost = action.offer === 'war' ? 0 : action.offer === 'peace' ? R.peaceCost : R.tradeCost;
    if (e.energy < cost) fail(`This agreement requires ${cost} energy.`);
    e.energy -= cost;
    state.relations[owner][other] = state.relations[other][owner] = action.offer === 'peace' ? 'neutral' : action.offer;
    if (owner===state.player || other===state.player || [owner,other].every(id=>state.empires[state.player].contacts.includes(id))) log(state, `${FACTIONS[owner].name} and ${FACTIONS[other].name}: ${action.offer === 'trade' ? `trade pact signed (+${R.tradeIncome} energy per turn each)` : action.offer === 'war' ? 'war declared' : 'peace accord signed'}.`, 'diplomacy'); return;
  }
  fail('Unknown order.');
}

// Fleet grouping and last-seen records adapt the small, explicit entity approach in
// QSOLKCB/GAMES SOVEREIGN_LATTICE/core.js, commit
// 7e0a9019d07b491cffc9b698fa51acdb843c49cc (MIT). Validation happens before mutation;
// routes retain VOIDWARD's surveyed-frontier restriction rather than donor omniscience.
const effectiveAttack = (state,f) => state.empires[f.owner].energy === 0 ? Math.floor(designStats(f.design).attack / 2) : designStats(f.design).attack;
function observedSystems(state, owner = state.player) { return new Set([...colonies(state,owner).map(p=>p.system),...fleets(state,owner).map(f=>f.system)]); }
function snapshotIntel(state, system) {
  return {system,turn:state.turn,archive:state.systems[system].relic&&!state.systems[system].claimed,planets:state.planets.filter(p=>p.system===system).map(p=>({id:p.id,owner:p.owner})),fleets:state.empires.map(e=>({owner:e.id,ships:state.fleets.filter(f=>f.system===system&&f.owner===e.id).length,attack:state.fleets.filter(f=>f.system===system&&f.owner===e.id).reduce((n,f)=>n+effectiveAttack(state,f),0)})).filter(f=>f.ships)};
}
function refreshIntel(state) {
  for (let owner=0;owner<E;owner++) for (const system of observedSystems(state,owner)) {
    const row=snapshotIntel(state,system), index=state.intel[owner].findIndex(x=>x.system===system);
    if (index<0) state.intel[owner].push(row); else state.intel[owner][index]=row;
  }
}
function systemIntel(state, system, owner = state.player) {
  if (observedSystems(state,owner).has(system)) return {...snapshotIntel(state,system),current:true};
  const row=state.intel[owner].find(x=>x.system===system); return row ? {...structuredClone(row),current:false} : null;
}
function researchAvailable(state, field, owner = state.player) {
  const e=state.empires[owner], next=(e.tech[field]||0)+1;
  const requirements=(content.dependencies||[]).filter(d=>d.field===field && d.level===next).map(d=>({field:d.requires,level:d.requiresLevel,current:e.tech[d.requires]}));
  const missing=requirements.filter(r=>r.current<r.level), available=Object.hasOwn(TECH,field)&&e.tech[field]<R.maxTech&&!missing.length;
  return {available,requirements,reason:!Object.hasOwn(TECH,field)?'Unknown research field.':e.tech[field]>=R.maxTech?'Field mastered.':missing.length?'Requires '+missing.map(r=>`${TECH[r.field].name} ${r.level}`).join(', '):'Available'};
}
function unlocks(field, level) { return {hulls:Object.values(HULLS).filter(x=>x.tech===field&&x.level===level),components:Object.values(COMPONENTS).filter(x=>x.tech===field&&x.level===level)}; }
function cleanGroups(state) {
  for (const g of state.groups) g.ships=g.ships.filter(id=>state.fleets.some(f=>f.id===id&&f.owner===g.owner));
  state.groups=state.groups.filter(g=>g.ships.length>1);
}
function movementSpeed(state,f) {
  if (f.refit) return 0;
  const group=state.groups.find(g=>g.ships.includes(f.id));
  return group?Math.min(...state.fleets.filter(x=>group.ships.includes(x.id)).map(x=>x.refit?0:designStats(x.design).speed)):designStats(f.design).speed;
}
function refitQuote(state, fleet, design, owner=state.player) {
  const f=state.fleets.find(x=>x.id===fleet&&x.owner===owner),d=state.empires[owner]?.designs.find(x=>x.id===design);
  if (!f || !d) fail('Choose an owned ship and registered class.');
  checkDesign(d,state.empires[owner].tech,owner);
  if (f.design.hull!==d.hull) fail('Refits must retain the same hull frame.');
  if (f.refit || f.path.length || state.groups.some(g=>g.ships.includes(f.id))) fail('Hold and detach this ship before refitting.');
  const yard=colonies(state,owner).find(p=>p.system===f.system&&p.buildings.yard);
  if (!yard || state.fleets.some(g=>g.system===f.system&&atWar(state,owner,g.owner))) fail('Refits require an uncontested friendly shipyard.');
  const old=designStats(f.design),stats=designStats(d),cost=Math.max(1,stats.cost-old.cost)+Math.ceil(stats.cost/10),work=Math.max(1,Math.ceil(stats.work/2));
  return {cost,work,turns:Math.ceil(work/production(state,yard)),design:structuredClone(d)};
}
function extendedCommand(state,action,owner) {
  const e=state.empires[owner];
  if (action.type==='group') {
    if(typeof action.name!=='string'||!action.name.trim()||action.name.length>40||!Array.isArray(action.fleets)||action.fleets.length<2||action.fleets.length>R.fleetLimit||new Set(action.fleets).size!==action.fleets.length) fail('Select at least two ships and name their fleet (up to 40 characters).');
    const ships=action.fleets.map(id=>state.fleets.find(f=>f.id===id&&f.owner===owner));
    if(ships.some(f=>!f||f.refit||state.groups.some(g=>g.ships.includes(f.id)))||ships.some(f=>f.system!==ships[0].system)) fail('Fleet members must be ungrouped, available and in the same system.');
    if (!int(state.nextGroup,1,MAX_IDENTIFIER-1)) fail('Fleet group identifier capacity reached.');
    for(const f of ships) {f.path=[];f.order={type:'hold',target:null,origin:f.system};}
    state.groups.push({id:state.nextGroup++,owner,name:action.name.trim(),ships:[...action.fleets]});return true;
  }
  if(action.type==='ungroup'||action.type==='groupMove') {
    const g=state.groups.find(g=>g.id===action.group&&g.owner===owner);if(!g)fail('Fleet group unavailable.');
    if(action.type==='ungroup'){state.groups=state.groups.filter(x=>x!==g);return true;}
    const ships=state.fleets.filter(f=>g.ships.includes(f.id));
    const path=route(state,ships[0].system,action.target,owner);if(!path.length||ships.some(f=>f.system!==ships[0].system||f.refit))fail('No legal course for this fleet group.');
    for(const f of ships){f.path=path.slice(1);f.order={type:'hold',target:null,origin:f.system};}return true;
  }
  if(action.type==='order') {
    const f=state.fleets.find(f=>f.id===action.fleet&&f.owner===owner);if(!f||f.refit)fail('Ship unavailable for orders.');
    if(!['hold','explore','patrol','return'].includes(action.order))fail('Unknown standing order.');
    const g=state.groups.find(g=>g.ships.includes(f.id)),ships=g?state.fleets.filter(x=>g.ships.includes(x.id)):[f];
    let target=null;if(action.order==='patrol'){target=action.target;if(!e.known.includes(target)||target===f.system||!route(state,f.system,target,owner).length)fail('Choose a different surveyed patrol destination.');}
    if(action.order==='return'){const options=colonies(state,owner).filter(p=>p.buildings.yard).map(p=>({system:p.system,path:route(state,f.system,p.system,owner)})).filter(x=>x.path.length).sort((a,b)=>a.path.length-b.path.length||a.system-b.system);if(!options.length)fail('No surveyed route to a friendly shipyard.');target=options[0].system;}
    for(const ship of ships){ship.path=[];ship.order={type:action.order,target,origin:f.system};}return true;
  }
  if(action.type==='reorder') {
    const p=state.planets[action.planet];if(!p||p.owner!==owner||!int(action.from,0,p.queue.length-1)||!int(action.to,0,p.queue.length-1))fail('Choose valid queue positions.');
    const [q]=p.queue.splice(action.from,1);p.queue.splice(action.to,0,q);return true;
  }
  if(action.type==='updateDesign') {
    const d=action.design;if(!d||!int(d.id,0,e.designs.length-1))fail('Registered class unavailable.');checkDesign(d,e.tech,owner);
    e.designs[d.id]={id:d.id,name:d.name.trim(),hull:d.hull,parts:[...d.parts]};return true;
  }
  if(action.type==='refit') {
    const quote=refitQuote(state,action.fleet,action.design,owner);if(e.minerals<quote.cost)fail(`Refit requires ${quote.cost} minerals.`);
    const f=state.fleets.find(f=>f.id===action.fleet);e.minerals-=quote.cost;f.refit={design:quote.design,cost:quote.cost,work:quote.work,done:0};f.order={type:'hold',target:null,origin:f.system};return true;
  }
  if(action.type==='chooseObjective') {
    const o=objectives(state,owner).find(o=>o.id===action.id);if(!o||!o.branch||o.status!=='active'||state.progress.choices[`${owner}:route`])fail('This objective branch cannot be selected.');
    state.progress.choices[`${owner}:route`]=o.branch;updateProgress(state);return true;
  }
  return false;
}
function prepareOrders(state) {
  const done=new Set();
  for(const f of state.fleets){
    if(done.has(f.id)||f.path.length||f.refit)continue;
    const g=state.groups.find(g=>g.ships.includes(f.id)),ships=g?state.fleets.filter(x=>g.ships.includes(x.id)):[f];ships.forEach(x=>done.add(x.id));
    let target=f.order.target;
    if(f.order.type==='explore') {
      const known=state.empires[f.owner].known, options=[...visibleSystems(state,f.owner)].filter(id=>!known.includes(id)).map(id=>({id,path:route(state,f.system,id,f.owner)})).filter(x=>x.path.length).sort((a,b)=>a.path.length-b.path.length||a.id-b.id);target=options[0]?.id;
    } else if(f.order.type==='patrol') target=f.system===target?f.order.origin:target;
    else if(f.order.type==='return' && f.system===target){for(const ship of ships)ship.order={type:'hold',target:null,origin:ship.system};continue;}
    else if(f.order.type==='hold')continue;
    if(target!==null&&target!==undefined){const path=route(state,f.system,target,f.owner);if(path.length)for(const ship of ships)ship.path=path.slice(1);}
  }
}
function objectiveCurrent(state,o,owner) {
  const e=state.empires[owner],target=Number(o.target);
  if(o.kind==='colonies')return colonies(state,owner).length;
  if(o.kind==='survey')return o.target==='*'?e.known.length:Number(e.known.includes(target));
  if(o.kind==='archives')return o.target==='*'?state.progress.discoveries[owner].length:Number(state.progress.discoveries[owner].includes(target));
  if(o.kind==='research')return e.tech[o.target]||0;
  if(o.kind==='resources')return e[o.target]||0;
  if(o.kind==='survive')return e.defeated?0:state.turn;
  if(o.kind==='trade')return o.target==='*'?state.relations[owner].filter(x=>x==='trade').length:Number(state.relations[owner][target]==='trade');
  if(o.kind==='control')return colonies(state,owner).filter(p=>p.system===target).length;
  if(o.kind==='defeat')return Number(state.empires[target]?.defeated);
  return 0;
}
function objectives(state, owner=state.player) {
  return (content.objectives||[]).filter(o=>o.owner==='*'||o.owner==='player'&&owner===state.player||o.owner===owner).map(o=>{
    const chosen=state.progress.choices[`${owner}:route`];
    const complete=state.progress.completed.includes(`${owner}:${o.id}`),excluded=o.branch&&chosen&&chosen!==o.branch;
    const ready=o.requires.every(id=>state.progress.completed.includes(`${owner}:${id}`));
    return {...o,chosen:!o.branch||chosen===o.branch,current:objectiveCurrent(state,o,owner),status:complete?'complete':excluded?'excluded':ready?'active':'locked'};
  });
}
function updateProgress(state) {
  for(let owner=0;owner<E;owner++) for(let pass=0;pass<(content.objectives||[]).length;pass++) {
    let changed=false;
    for(const o of objectives(state,owner))if(o.status==='active'&&(!o.branch||state.progress.choices[`${owner}:route`]===o.branch)&&o.current>=o.amount){state.progress.completed.push(`${owner}:${o.id}`);changed=true;if(owner===state.player)log(state,`Objective complete: ${o.title}.`,'info');}
    if(!changed)break;
  }
}
function missionTargets(state,owner,f) {
  const active=objectives(state,owner).filter(o=>o.status==='active'&&(!o.branch||state.progress.choices[`${owner}:route`]===o.branch));
  let targets=[];
  for(const o of active){
    if(o.kind==='archives'&&role(f.design,'survey'))targets.push(...state.systems.filter(s=>state.empires[owner].known.includes(s.id)&&systemIntel(state,s.id,owner)?.archive&&(o.target==='*'||s.id===Number(o.target))).map(s=>s.id));
    if(o.kind==='survey'&&o.target!=='*')targets.push(Number(o.target));
    if(o.kind==='control'&&(role(f.design,'colony')||role(f.design,'assault')))targets.push(Number(o.target));
  }
  return [...new Set(targets)].filter(id=>id!==f.system&&visibleSystems(state,owner).has(id)&&route(state,f.system,id,owner).length);
}
function processEvents(state) {
  for(const event of content.events||[]) {
    const owner=event.owner==='player'?state.player:event.owner;
    const previous=state.progress.events[event.id];
    if(state.turn<event.turn||previous!==undefined&&(!event.repeat||state.turn-previous<event.repeat)||!event.requires.every(id=>state.progress.completed.includes(`${owner}:${id}`)))continue;
    const e=state.empires[owner];
    if(event.kind==='resources')e[event.target]=Math.min(999999,e[event.target]+event.value);
    else if(event.kind==='spawn'){
      const owned=fleets(state,owner),settlements=colonies(state,owner),reserved=settlements.reduce((n,p)=>n+p.queue.filter(q=>q.kind==='ship').length,0);
      if(e.defeated||!settlements.length&&!owned.some(f=>role(f.design,'colony'))||owned.length+reserved>=R.fleetLimit)continue;
      const d=e.designs[Number(event.target)];if(!d||!addFleet(state,owner,event.value,d))continue;reveal(state,owner,event.value);
    }
    else if(event.kind==='message')log(state,event.target,'info');
    else if(event.kind==='war') {
      const other=Number(event.target);if(e.defeated||state.empires[other].defeated)continue;
      if(!e.contacts.includes(other)){e.contacts.push(other);state.empires[other].contacts.push(owner);}
      if(state.relations[owner][other]!=='war')command(state,{type:'diplomacy',target:other,offer:'war'},owner);
    }
    state.progress.events[event.id]=state.turn;
    if(event.kind!=='message')log(state,`Campaign event: ${event.id}.`,'info');
  }
}
function migrateState(source) {
  const s=structuredClone(source);
  if(s?.version===1){
    // v1 already exposed live information for every surveyed system. Preserve
    // that knowledge at the migration boundary, then use last-seen snapshots.
    if(['player','groups','nextGroup','progress','reports','intel'].some(k=>Object.hasOwn(s,k)))fail('Invalid legacy save fields.');
    if(s.fleets?.some(f=>Object.hasOwn(f,'order')||Object.hasOwn(f,'refit')))fail('Invalid legacy ship fields.');
    s.version=2;s.player=0;s.groups=[];s.nextGroup=1;s.progress={completed:[],events:{},choices:{},discoveries:Array.from({length:E},()=>[])};s.reports=[];s.intel=Array.from({length:E},()=>[]);
    if(!Array.isArray(s.fleets)||!Array.isArray(s.battles)||!Array.isArray(s.empires)||!Array.isArray(s.systems)||!Array.isArray(s.planets))fail('Invalid legacy save.');
    for(const f of s.fleets){f.order={type:'hold',target:null,origin:f.system};f.refit=null;}
    for(const b of s.battles){if(Object.hasOwn(b,'damage')||Object.hasOwn(b,'forces'))fail('Invalid legacy battle fields.');b.damage=0;b.forces=[];}
    for(let owner=0;owner<E;owner++)for(const system of s.empires[owner]?.known||[])if(int(system,0,N-1))s.intel[owner].push(snapshotIntel(s,system));
  }
  validateState(s);return s;
}
function validateExtensions(s,assert,record) {
  assert(int(s.player,0,E-1)&&(content.scenario?.playable||[0]).includes(s.player),'playable empire');
  assert(int(s.nextGroup,1,MAX_IDENTIFIER)&&Array.isArray(s.groups)&&s.groups.length<=E*R.fleetLimit/2,'fleet groups');
  const used=new Set(),groupIds=new Set();
  for(const g of s.groups){record(g,['id','owner','name','ships'],'fleet group');assert(int(g.id,1,s.nextGroup-1)&&!groupIds.has(g.id)&&int(g.owner,0,E-1)&&typeof g.name==='string'&&g.name.length>0&&g.name.length<=40&&Array.isArray(g.ships)&&g.ships.length>=2&&g.ships.length<=R.fleetLimit,'fleet group');groupIds.add(g.id);let system=null,path=null,order=null;
    for(const id of g.ships){const f=s.fleets.find(f=>f.id===id&&f.owner===g.owner);assert(f&&!used.has(id)&&!f.refit,'group membership');used.add(id);assert(system===null||system===f.system,'group location');assert(path===null||path===JSON.stringify(f.path),'group route');assert(order===null||order===JSON.stringify(f.order),'group standing order');system=f.system;path=JSON.stringify(f.path);order=JSON.stringify(f.order);}
  }
  record(s.progress,['completed','events','choices','discoveries'],'campaign progress');
  assert(Array.isArray(s.progress.completed)&&s.progress.completed.length<=E*(content.objectives||[]).length&&new Set(s.progress.completed).size===s.progress.completed.length,'objective ledger');
  for(const key of s.progress.completed){assert(typeof key==='string','objective key');const [owner,id]=key.split(':');assert(int(Number(owner),0,E-1)&&(content.objectives||[]).some(o=>o.id===id&&(o.owner==='*'||o.owner==='player'&&Number(owner)===s.player||o.owner===Number(owner))),'objective reference');}
  for(const key of s.progress.completed){const [owner,id]=key.split(':'),o=(content.objectives||[]).find(o=>o.id===id);assert(String(Number(owner))===owner&&o.requires.every(parent=>s.progress.completed.includes(`${owner}:${parent}`)),'objective prerequisites');}
  for(const field of ['events','choices'])assert(s.progress[field]&&Object.getPrototypeOf(s.progress[field])===Object.prototype&&!Array.isArray(s.progress[field]),'progress record');
  assert(Object.keys(s.progress.events).length<=(content.events||[]).length,'event ledger');for(const [id,turn]of Object.entries(s.progress.events))assert((content.events||[]).some(e=>e.id===id)&&int(turn,1,s.turn),'event reference');
  assert(Object.keys(s.progress.choices).length<=E*(content.objectives||[]).length,'choice ledger');for(const [key,branch]of Object.entries(s.progress.choices)){const [owner,tag]=key.split(':');assert(tag==='route'&&String(Number(owner))===owner&&int(Number(owner),0,E-1)&&(content.objectives||[]).some(o=>o.branch===branch&&(o.owner==='*'||o.owner==='player'&&Number(owner)===s.player||o.owner===Number(owner))),'objective choice');}
  for(const key of s.progress.completed){const [owner,id]=key.split(':'),o=(content.objectives||[]).find(o=>o.id===id);assert(!o.branch||s.progress.choices[`${owner}:route`]===o.branch,'completed branch');}
  assert(Array.isArray(s.progress.discoveries)&&s.progress.discoveries.length===E,'discovery ledger');const discoveries=new Set();for(const ids of s.progress.discoveries){assert(Array.isArray(ids)&&ids.length<=N&&new Set(ids).size===ids.length,'discovery count');for(const id of ids){assert(int(id,0,N-1)&&s.systems[id].relic&&s.systems[id].claimed&&!discoveries.has(id),'discovery reference');discoveries.add(id);}}
  assert(Array.isArray(s.intel)&&s.intel.length===E,'intelligence');
  for(let owner=0;owner<E;owner++){const rows=s.intel[owner];assert(Array.isArray(rows)&&rows.length<=N&&new Set(rows.map(x=>x.system)).size===rows.length,'intelligence count');for(const row of rows){record(row,['system','turn','archive','planets','fleets'],'intelligence record');assert(typeof row.archive==='boolean'&&int(row.system,0,N-1)&&s.empires[owner].known.includes(row.system)&&int(row.turn,1,s.turn)&&Array.isArray(row.planets)&&row.planets.length===P&&Array.isArray(row.fleets)&&row.fleets.length<=E,'intelligence record');for(const [i,p]of row.planets.entries()){record(p,['id','owner'],'planet intelligence');assert(p.id===row.system*P+i&&int(p.owner,-1,E-1),'planet intelligence');}for(const f of row.fleets){record(f,['owner','ships','attack'],'fleet intelligence');assert(int(f.owner,0,E-1)&&int(f.ships,1,R.fleetLimit)&&int(f.attack,0,10000000),'fleet intelligence');}}}
  assert(Array.isArray(s.reports)&&s.reports.length<=30,'turn reports');for(const r of s.reports){record(r,['turn','income','completed','discovered','battles'],'turn report');assert(int(r.turn,1,s.turn)&&Array.isArray(r.income)&&r.income.length===E&&Array.isArray(r.completed)&&r.completed.length<=N*P+E*R.fleetLimit&&Array.isArray(r.discovered)&&r.discovered.length<=E*N&&int(r.battles,0,N),'turn report');for(const i of r.income){record(i,['minerals','energy','science','upkeep'],'income report');for(const k of Object.keys(i))assert(int(i[k],k==='energy'?-1000000:0,Number.MAX_SAFE_INTEGER),'income report');}for(const c of r.completed){record(c,['owner','planet','name'],'completion report');assert(int(c.owner,0,E-1)&&int(c.planet,0,N*P-1)&&typeof c.name==='string'&&c.name.length<=200,'completion report');}for(const d of r.discovered){record(d,['owner','system'],'survey report');assert(int(d.owner,0,E-1)&&int(d.system,0,N-1),'survey report');}}
}

function ai(state, owner) {
  const e = state.empires[owner]; if (e.defeated || state.winner !== null) return;
  for (const o of objectives(state,owner)) if (o.branch && o.status === 'active' && !state.progress.choices[`${owner}:route`]) { command(state,{type:'chooseObjective',id:o.id},owner); break; }
  const tryOrder = a => { try { command(state, a, owner); return true; } catch { return false; } };
  // AI has exactly the same fog, prices, ship limits and command rules as the player.
  const research = Object.keys(TECH).filter(k => e.tech[k] < R.maxTech).sort((a, b) => e.tech[a] - e.tech[b]);
  const desired=objectives(state,owner).find(o=>o.status==='active'&&o.chosen&&o.kind==='research'&&e.tech[o.target]<o.amount);
  if(desired){const prioritize=(field,seen=new Set())=>{if(seen.has(field))return;seen.add(field);const gate=researchAvailable(state,field,owner);if(gate.available){const i=research.indexOf(field);if(i>=0){research.splice(i,1);research.unshift(field);}}else for(const r of gate.requirements)if(r.current<r.level)prioritize(r.field,seen);};prioritize(desired.target);}
  if (research.length) tryOrder({type:'research',field:research.find(k => researchAvailable(state,k,owner).available) || research[0]});
  for (const d of e.designs) {
    const next=structuredClone(d), template=content.ships.filter(x=>x.empire===owner)[d.id]||d, roles=template.parts.map(id=>COMPONENTS[id].kind),combat=roles.includes('assault');
    const value=c=>c.kind==='engine'?c.speed*1000+c.hp:c.kind==='weapon'?c.attack*100+c.hp:c.kind==='shield'?c.hp*100:c.level;
    const available=kind=>Object.values(COMPONENTS).filter(c=>c.kind===kind&&c.level<=e.tech[c.tech]).sort((a,b)=>value(b)-value(a)||a.slots-b.slots||a.cost-b.cost||a.id.localeCompare(b.id));
    const minimum=kind=>Math.min(...available(kind).map(c=>c.slots));
    const candidates=Object.values(HULLS).filter(h=>(h.faction===owner||h.faction===-1)&&h.level<=e.tech[h.tech]&&(combat||h.id===d.hull)&&h.slots>=roles.reduce((n,k)=>n+minimum(k),0)).sort((a,b)=>b.slots-a.slots||b.hp-a.hp||a.cost-b.cost||a.id.localeCompare(b.id));
    next.hull=candidates[0]?.id||d.hull;let room=HULLS[next.hull].slots;next.parts=[];
    for(let i=0;i<roles.length;i++){
      const reserve=roles.slice(i+1).reduce((n,k)=>n+minimum(k),0),part=available(roles[i]).find(c=>c.slots<=room-reserve);
      if(!part){next.parts=[...d.parts];next.hull=d.hull;break;}next.parts.push(part.id);room-=part.slots;
    }
    if(combat)while(room>0&&next.parts.length<40){const weapon=available('weapon').find(c=>c.slots<=room);if(!weapon)break;next.parts.push(weapon.id);room-=weapon.slots;}
    try { command(state, {type:'updateDesign', design:next}, owner); } catch { /* Retain the legal original design. */ }
  }
  for (const p of colonies(state, owner)) {
    if (p.queue.length) continue;
    const owned = fleets(state, owner), arks = owned.filter(f => role(f.design, 'colony')).length;
    if (!p.buildings.yard) tryOrder({ type: 'build', planet: p.id, kind: 'yard' });
    else if (arks + colonies(state,owner).reduce((n,c)=>n+c.queue.filter(q=>q.kind==='ship' && role(q.design,'colony')).length,0) < (content.ai?.colonyShips || 2) && colonies(state, owner).length < COLONY_TARGET && e.minerals > (content.ai?.reserveMinerals ?? 80)) tryOrder({ type: 'build', planet: p.id, kind: 'ship', design: e.designs.find(d => role(d, 'colony')).id });
    else if (objectives(state,owner).some(o=>o.status==='active'&&o.kind==='archives') && !owned.some(f=>role(f.design,'survey')) && !colonies(state,owner).some(c=>c.queue.some(q=>q.kind==='ship'&&role(q.design,'survey')))) tryOrder({type:'build',planet:p.id,kind:'ship',design:e.designs.find(d=>role(d,'survey')).id});
    else if (p.buildings.lab < Math.min(2, R.facilityLimit) && state.turn % 4 === 0) tryOrder({ type: 'build', planet: p.id, kind: 'lab' });
    else if (owned.length < Math.min(content.ai?.militaryLimit || 35, R.fleetLimit - 2, 3 + Math.floor(state.turn / 3))) tryOrder({ type: 'build', planet: p.id, kind: 'ship', design: e.designs.find(d => role(d, 'assault')).id });
    else if (p.buildings.mine < R.facilityLimit) tryOrder({ type: 'build', planet: p.id, kind: 'mine' });
    else if (p.buildings.defence < R.facilityLimit) tryOrder({ type: 'build', planet: p.id, kind: 'defence' });
  }
  // Form small task forces only when a known enemy or campaign target exists.
  // Every creation/course still uses the same player commands and fog-limited routes.
  if (content.scenario?.victory === 'objectives') {
    const targetsFor=f=>{const mission=missionTargets(state,owner,f);return mission.length?mission:e.known.filter(id=>systemIntel(state,id,owner)?.planets.some(p=>p.owner>=0&&atWar(state,owner,p.owner)));};
    for(const system of [...new Set(fleets(state,owner).map(f=>f.system))]){
      const ships=fleets(state,owner).filter(f=>f.system===system&&!f.path.length&&!f.refit&&role(f.design,'assault')&&!state.groups.some(g=>g.ships.includes(f.id)));
      if(ships.length>=3&&targetsFor(ships[0]).some(id=>id!==system))tryOrder({type:'group',name:`${FACTIONS[owner].short} Task Force ${state.nextGroup}`.slice(0,40),fleets:ships.slice(0,4).map(f=>f.id)});
    }
    for(const group of state.groups.filter(g=>g.owner===owner)){
      const lead=state.fleets.find(f=>f.id===group.ships[0]);if(!lead||lead.path.length)continue;
      const targets=targetsFor(lead).filter(id=>id!==lead.system).map(id=>({id,path:route(state,lead.system,id,owner)})).filter(o=>o.path.length).sort((a,b)=>a.path.length-b.path.length||a.id-b.id);
      if(targets.length)tryOrder({type:'groupMove',group:group.id,target:targets[0].id});
    }
  }
  for (const f of [...fleets(state, owner)]) {
    const upgrade=e.designs.find(d=>d.id===f.design.id&&d.hull===f.design.hull);
    if(upgrade && !f.path.length && !f.refit && e.minerals>(content.ai?.reserveMinerals??80) && JSON.stringify(upgrade.parts)!==JSON.stringify(f.design.parts))tryOrder({type:'refit',fleet:f.id,design:upgrade.id});
    if (f.path.length || f.refit || state.groups.some(g=>g.ships.includes(f.id))) continue;
    if (role(f.design, 'colony')) {
      const here = state.planets.find(p => p.system === f.system && p.owner === -1);
      if (here && tryOrder({ type: 'colonize', planet: here.id, fleet: f.id })) continue;
    }
    const known = new Set(e.known), visible = [...visibleSystems(state, owner)];
    let targets = visible.filter(id => !known.has(id));
    if (role(f.design, 'colony')) {
      const settle = e.known.filter(id => systemIntel(state,id,owner)?.planets.some(p => p.owner === -1));
      if (settle.length) targets = settle;
    } else if (role(f.design, 'assault')) {
      const hostile = e.known.filter(id => systemIntel(state,id,owner)?.planets.some(p => p.owner >= 0 && atWar(state, owner, p.owner)));
      if (hostile.length) targets = hostile;
    }
    const mission = missionTargets(state, owner, f); if (mission.length) targets = mission;
    const options = targets.filter(id => id !== f.system).map(id => ({ id, path: route(state, f.system, id, owner) })).filter(o => o.path.length > 0).sort((a, b) => a.path.length - b.path.length || a.id - b.id);
    if (options.length) tryOrder({ type: 'move', fleet: f.id, target: options[random(state, Math.min(3, options.length))].id });
  }
  for (const other of e.contacts) {
    if (state.relations[owner][other] === 'neutral' && objectives(state,owner).some(o=>o.status==='active' && o.kind==='trade') && e.energy >= R.tradeCost) tryOrder({type:'diplomacy',target:other,offer:'trade'});
  }
  const baseGrace=R.warGrace+Math.floor((50-(content.ai?.aggression??50))/2);
  const grace = state.difficulty === 'relaxed' ? baseGrace + 23 : state.difficulty === 'veteran' ? Math.max(5, baseGrace - 14) : baseGrace;
  if (state.turn > grace && state.turn % 11 === owner) {
    const target = e.contacts.find(id => !state.empires[id].defeated && state.relations[owner][id] === 'neutral');
    if (target !== undefined) tryOrder({ type: 'diplomacy', target, offer: 'war' });
  }
}

function battles(state) {
  for (const system of state.systems) {
    const present = state.fleets.filter(f => f.system === system.id);
    const combat = present.some(a => present.some(b => atWar(state, a.owner, b.owner)) || state.planets.some(p => p.system === system.id && p.owner >= 0 && atWar(state, a.owner, p.owner)));
    if (!combat) continue;
    const participants = [...new Set([...present.map(f => f.owner), ...state.planets.filter(p => p.system === system.id && p.owner >= 0).map(p => p.owner)])];
    const losses = Array(E).fill(0), damage = new Map();
    // All volleys are scheduled from the same pre-combat state; no first-owner advantage.
    for (const f of present) {
      const enemies = present.filter(g => atWar(state, f.owner, g.owner)).sort((a, b) => a.id - b.id);
      const attack = designStats(f.design).attack;
      if (attack && enemies.length && !f.refit) {
        const target = enemies[random(state, enemies.length)];
        const strength = state.empires[f.owner].energy === 0 ? Math.floor(attack / 2) : attack;
        damage.set(target.id, (damage.get(target.id) || 0) + strength + random(state, 5));
      }
    }
    for (const p of state.planets.filter(p => p.system === system.id && p.owner >= 0)) {
      const enemy = present.find(f => atWar(state, p.owner, f.owner));
      if (enemy) damage.set(enemy.id, (damage.get(enemy.id) || 0) + Math.floor(defence(state, p) / 3));
    }
    for (const f of present) { f.hp -= damage.get(f.id) || 0; if (f.hp <= 0) losses[f.owner]++; }
    state.fleets = state.fleets.filter(f => f.hp > 0);
    const captured = [];
    for (const p of state.planets.filter(p => p.system === system.id && p.owner >= 0)) {
      const attackers = state.fleets.filter(f => f.system === system.id && atWar(state, f.owner, p.owner));
      for (const owner of [...new Set(attackers.map(f => f.owner))]) {
        const force = attackers.filter(f => f.owner === owner);
        if (!force.some(f => role(f.design, 'assault')) || state.fleets.some(f => f.system === system.id && f.owner === p.owner)) continue;
        const power = force.reduce((n, f) => n + (f.refit ? 0 : effectiveAttack(state,f)), 0);
        if (power >= defence(state, p)) {
          p.owner = owner; p.pop = Math.max(10, Math.floor(p.pop / 2)); p.queue = []; p.buildings.defence = Math.max(0, p.buildings.defence - 1);
          captured.push(`${p.name} → ${FACTIONS[owner].short}`); break;
        }
      }
    }
    if (participants.includes(state.player) || observedSystems(state,state.player).has(system.id)) {
      const report = { turn: state.turn, system: system.id, participants, losses, captured, damage: [...damage.values()].reduce((a,b)=>a+b,0), forces: participants.map(owner=>({owner,ships:present.filter(f=>f.owner===owner).length,attack:present.filter(f=>f.owner===owner).reduce((n,f)=>n+effectiveAttack(state,f),0)})) };
      state.battles.unshift(report); state.battles.length = Math.min(30, state.battles.length);
      log(state, `${system.name}: ${losses.reduce((a, b) => a + b, 0)} ship(s) lost.${captured.length ? ' ' + captured.join('; ') : ' Combat continues while hostile forces remain.'}`, 'battle');
    }
  }
}
const score = (state, owner) => colonies(state, owner).length * 100 + Object.values(state.empires[owner].tech).reduce((a, b) => a + b, 0) * 25 + fleets(state, owner).length * 5;
function checkVictory(state) {
  for (const e of state.empires) e.defeated = colonies(state, e.id).length === 0 && !fleets(state, e.id).some(f => role(f.design, 'colony'));
  if (state.winner !== null) return;
  if (hooks.victory) {
    const result = hooks.victory(state, api);
    if (result) {
      if (!int(result.winner, 0, E - 1) || typeof result.text !== 'string' || result.text.length > 200) fail('Invalid custom victory result.');
      state.winner = result.winner; state.victory = result.text; return;
    }
  }
  updateProgress(state);
  const contenders = state.empires.filter(e => !e.defeated);
  let winner;
  if (content.scenario?.victory === 'objectives') {
    winner = contenders.filter(e=>state.turn >= (content.scenario.minVictoryTurn || 1) && objectives(state,e.id).some(o=>o.victory && o.status==='complete')).sort((a,b)=>score(state,b.id)-score(state,a.id)||a.id-b.id)[0];
    if (winner) state.victory = 'Campaign objectives complete';
  } else winner = contenders.find(e => colonies(state, e.id).length >= COLONY_TARGET);
  if (winner && content.scenario?.victory !== 'objectives') state.victory = `Expansion victory — ${COLONY_TARGET} colonies`;
  if (!winner && content.scenario?.victory !== 'objectives') { winner = contenders.find(e => Object.values(e.tech).every(n => n >= R.maxTech)); if (winner) state.victory = 'Ascension victory — all sciences mastered'; }
  if (!winner && contenders.length === 1) { winner = contenders[0]; state.victory = 'Conquest victory — last empire standing'; }
  if (!winner && (state.turn >= TURN_LIMIT || state.empires[state.player].defeated)) {
    winner = contenders.filter(e=> !(content.scenario?.defeatAtLimit && state.turn >= TURN_LIMIT && e.id === state.player)).sort((a, b) => score(state, b.id) - score(state, a.id) || a.id - b.id)[0] || contenders[0];
    state.victory = state.empires[state.player].defeated ? 'Your civilisation has fallen' : content.scenario?.defeatAtLimit ? 'The campaign deadline has passed' : 'Council victory — highest empire score';
  }
  if (winner) { state.winner = winner.id; log(state, `${FACTIONS[winner.id].name}: ${state.victory}.`, 'victory'); }
}
function endTurn(state) {
  if (state.winner !== null) fail('Campaign complete.');
  for (let owner = 0; owner < E; owner++) { if (owner === state.player) continue; ai(state, owner); if (state.winner !== null) return state; }
  state.turn++;
  const report = {turn:state.turn,income:state.empires.map(e=>income(state,e.id)),completed:[],discovered:[],battles:0};
  prepareOrders(state);
  const moved = new Set();
  for (const f of state.fleets) {
    if (moved.has(f.id)) continue;
    const group=state.groups.find(g=>g.ships.includes(f.id)), ships=group?state.fleets.filter(x=>group.ships.includes(x.id)):[f];
    ships.forEach(x=>moved.add(x.id));
    const speed=movementSpeed(state,f);
    for (let step=0;step<speed&&f.path.length;step++) {
      const next=f.path[0]; if(!state.systems[f.system].links.includes(next)) fail('Invalid fleet route.');
      for(const ship of ships){ship.path.shift();ship.system=next;}
      if(!state.empires[f.owner].known.includes(next))report.discovered.push({owner:f.owner,system:next});reveal(state,f.owner,next);
      if(state.fleets.some(other=>other.system===next&&atWar(state,f.owner,other.owner))||state.planets.some(p=>p.system===next&&p.owner>=0&&atWar(state,f.owner,p.owner)))break;
    }
  }
  for (const f of state.fleets) {
    const sys = state.systems[f.system];
    if (sys.relic && !sys.claimed && role(f.design, 'survey')) {
      sys.claimed = true; state.progress.discoveries[f.owner].push(sys.id); state.empires[f.owner].science = Math.min(999999,state.empires[f.owner].science + R.relicScience); state.empires[f.owner].minerals = Math.min(999999,state.empires[f.owner].minerals + R.relicMinerals);
      if (f.owner === state.player) log(state, `Ancient archive recovered at ${sys.name}: +${R.relicScience} research, +${R.relicMinerals} minerals.`, 'relic');
    }
  }
  battles(state); cleanGroups(state);
  report.battles = state.battles.filter(b=>b.turn===state.turn).length;
  for (const e of state.empires) {
    for (const f of fleets(state, e.id)) reveal(state, e.id, f.system);
    const yields = income(state, e.id);
    e.minerals = Math.min(999999, add(e.minerals, Math.min(999999, yields.minerals)));
    e.energy = Math.min(999999, Math.max(0, add(e.energy, Math.min(999999, yields.energy))));
    e.science = Math.min(999999, add(e.science, Math.min(999999, yields.science)));
    if (researchAvailable(state,e.research,e.id).available && e.science >= techCost(e.tech[e.research])) {
      e.science -= techCost(e.tech[e.research]); e.tech[e.research]++;
      if (e.id === state.player) log(state, `Research complete: ${TECH[e.research].name} ${e.tech[e.research]}. New capabilities available.`, 'research');
      if (e.tech[e.research] === R.maxTech) e.research = Object.keys(TECH).find(k => e.tech[k] < R.maxTech) || e.research;
    }
    for (const p of colonies(state, e.id)) {
      p.pop = Math.min(PLANET_TYPES[p.type].max, p.pop + Math.max(1, Math.floor(p.pop / 20)));
      const q = p.queue[0];
      if (q) {
        q.done = Math.min(q.work, q.done + production(state, p));
        if (q.done === q.work) {
          if (q.kind === 'ship') {
            if (!addFleet(state, e.id, p.system, q.design)) continue;
          } else p.buildings[q.kind]++;
          report.completed.push({owner:e.id,planet:p.id,name:q.name});
          p.queue.shift(); if (e.id === state.player) log(state, `${p.name}: ${q.name} ready.`, 'build');
        }
      }
    }
    for (const f of fleets(state,e.id)) if (f.refit) {
      const yard = colonies(state,e.id).find(p=>p.system===f.system && p.buildings.yard);
      if (yard && !state.fleets.some(g=>g.system===f.system && atWar(state,e.id,g.owner))) {
        f.refit.done = Math.min(f.refit.work,f.refit.done+production(state,yard));
        if (f.refit.done === f.refit.work) { const oldMax=designStats(f.design).hp; f.design=structuredClone(f.refit.design); f.hp=Math.max(1,Math.min(designStats(f.design).hp, f.hp+designStats(f.design).hp-oldMax)); f.name=f.design.name; f.refit=null; report.completed.push({owner:e.id,planet:yard.id,name:`Refit: ${f.name}`}); }
      }
    }
    // Repairs only at a friendly shipyard outside combat.
    for (const f of fleets(state, e.id)) if (colonies(state, e.id).some(p => p.system === f.system && p.buildings.yard) && !state.fleets.some(g => g.system === f.system && atWar(state, e.id, g.owner))) f.hp = Math.min(designStats(f.design).hp, f.hp + R.repair);
  }
  updateProgress(state); processEvents(state); refreshIntel(state);
  state.reports.unshift(report); state.reports.length=Math.min(30,state.reports.length);
  if (hooks.onTurn) hooks.onTurn(state, api);
  checkVictory(state);
  return state;
}

function serialize(state) { return JSON.stringify(state); }
function deserialize(text) {
  const s = migrateState(decodeStateText(text));
  validateState(s);
  return s;
}
function validateState(s) {
  const assert = (condition, name) => { if (!condition) fail(`Invalid save: ${name}.`); };
  const record = (v, keys, name) => assert(v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k) && Object.hasOwn(Object.getOwnPropertyDescriptor(v, k), 'value')), name);
  const designRecord = d => { record(d, ['id', 'name', 'hull', 'parts'], 'design fields'); assert(int(d.id, 0, 23), 'design identifier'); };
  record(s, ['version', 'player', 'groups', 'nextGroup', 'progress', 'intel', 'reports', 'seed', 'rng', 'difficulty', 'turn', 'nextId', 'systems', 'planets', 'fleets', 'empires', 'relations', 'log', 'battles', 'winner', 'victory', 'modState'], 'campaign fields');
  let modNodes = 0;
  function modValue(v, depth = 0) {
    assert(++modNodes <= 4096 && depth <= 10, 'mod state complexity');
    if (v === null || typeof v === 'boolean' || Number.isSafeInteger(v)) return;
    if (typeof v === 'string') { assert(v.length <= 2048, 'mod string'); return; }
    assert(v && typeof v === 'object', 'mod value');
    if (Array.isArray(v)) { assert(v.length <= 256, 'mod array'); v.forEach(x => modValue(x, depth + 1)); return; }
    assert(Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).every(k => k.length <= 80 && !['__proto__', 'prototype', 'constructor'].includes(k)), 'mod record');
    Object.values(v).forEach(x => modValue(x, depth + 1));
  }
  assert(s.modState && !Array.isArray(s.modState) && typeof s.modState === 'object', 'mod state'); modValue(s.modState);
  assert(JSON.stringify(s.modState).length <= 16384, 'mod state size');
  assert(s && s.version === VERSION && int(s.seed, 0, 4294967295) && int(s.rng, 0, 4294967295), 'version / seed');
  assert(['relaxed', 'standard', 'veteran'].includes(s.difficulty) && int(s.turn, 1, TURN_LIMIT) && int(s.nextId, 1, MAX_IDENTIFIER), 'campaign');
  assert(Array.isArray(s.systems) && s.systems.length === N && Array.isArray(s.planets) && s.planets.length === N * P && Array.isArray(s.empires) && s.empires.length === E, 'galaxy shape');
  const clean = createGame(s.seed, s.difficulty, false, s.player);
  const name = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
  const ids = new Set();
  for (const [i, sys] of s.systems.entries()) {
    record(sys, ['id', 'name', 'x', 'y', 'links', 'relic', 'claimed'], 'system fields');
    const original = clean.systems[i];
    assert(sys && sys.id === i && sys.name === original.name && sys.x === original.x && sys.y === original.y && sys.relic === original.relic && typeof sys.claimed === 'boolean' && (!sys.claimed || sys.relic) && JSON.stringify(sys.links) === JSON.stringify(original.links), 'immutable starmap');
  }
  for (const [i, e] of s.empires.entries()) {
    record(e, ['id', 'minerals', 'energy', 'science', 'tech', 'research', 'known', 'contacts', 'designs', 'defeated'], 'empire fields');
    record(e.tech, Object.keys(TECH), 'technology fields');
    assert(e && e.id === i && ['minerals', 'energy', 'science'].every(k => int(e[k], 0, 999999)) && typeof e.defeated === 'boolean', 'empire resources');
    assert(e.tech && Object.keys(TECH).every(k => int(e.tech[k], 1, R.maxTech)) && Object.hasOwn(TECH, e.research), 'research');
    for (const [field, max] of [['known', N - 1], ['contacts', E - 1]]) assert(Array.isArray(e[field]) && e[field].length <= max + 1 && new Set(e[field]).size === e[field].length && e[field].every(id => int(id, 0, max)), field);
    assert(!e.contacts.includes(i) && e.known.includes(FACTIONS[i].home), 'empire knowledge');
    assert(Array.isArray(e.designs) && e.designs.length >= 1 && e.designs.length <= 24, 'design archive');
    e.designs.forEach((d, n) => { designRecord(d); assert(d.id === n, 'design id'); checkDesign(d, e.tech, e.id); });
  }
  assert(Array.isArray(s.relations) && s.relations.length === E && s.relations.every(row => Array.isArray(row) && row.length === E), 'relations');
  for (let a = 0; a < E; a++) for (let b = 0; b < E; b++) assert(a === b ? s.relations[a][b] === 'self' : ['neutral', 'trade', 'war'].includes(s.relations[a][b]) && s.relations[a][b] === s.relations[b][a], 'symmetric relations');
  for (const [i, p] of s.planets.entries()) {
    record(p, ['id', 'system', 'name', 'type', 'owner', 'pop', 'buildings', 'queue'], 'planet fields');
    record(p.buildings, Object.keys(BUILDINGS), 'facility fields');
    assert(p && p.id === i && p.system === Math.floor(i / P) && p.name === clean.planets[i].name && Object.hasOwn(PLANET_TYPES, p.type) && p.type === clean.planets[i].type && int(p.owner, -1, E - 1) && int(p.pop, 0, PLANET_TYPES[p.type].max), 'planet');
    assert(p.buildings && Object.keys(BUILDINGS).every(k => int(p.buildings[k], 0, R.facilityLimit)) && Array.isArray(p.queue) && p.queue.length <= 5, 'colony facilities');
    assert(p.owner >= 0 || (p.pop === 0 && p.queue.length === 0 && Object.values(p.buildings).every(n => n === 0)), 'unclaimed planet');
    for (const q of p.queue) {
      record(q, q?.kind === 'ship' ? ['kind', 'design', 'name', 'cost', 'work', 'done'] : ['kind', 'name', 'cost', 'work', 'done'], 'queue fields');
      if (q.kind === 'ship') designRecord(q.design);
      assert(q && (q.kind === 'ship' || Object.hasOwn(BUILDINGS, q.kind)) && name(q.name), 'queue item');
      const expected = q.kind === 'ship' ? (checkDesign(q.design, s.empires[p.owner].tech, p.owner), designStats(q.design)) : BUILDINGS[q.kind];
      assert(q.cost === expected.cost && q.work === expected.work && int(q.done, 0, q.work), 'production accounting');
    }
    for (const k of Object.keys(BUILDINGS)) assert(p.buildings[k] + p.queue.filter(q => q.kind === k).length <= R.facilityLimit, 'facility limit');
  }
  assert(Array.isArray(s.fleets) && s.fleets.length <= E * R.fleetLimit, 'fleet count');
  for (const f of s.fleets) {
    record(f, ['id', 'owner', 'system', 'name', 'design', 'hp', 'path', 'order', 'refit'], 'fleet fields'); designRecord(f.design);
    assert(f && int(f.id, 1, s.nextId - 1) && !ids.has(f.id) && int(f.owner, 0, E - 1) && int(f.system, 0, N - 1) && name(f.name), 'fleet'); ids.add(f.id);
    checkDesign(f.design, s.empires[f.owner].tech, f.owner);
    record(f.order,['type','target','origin'],'ship order');
    assert(['hold','explore','patrol','return'].includes(f.order.type) && (['hold','explore'].includes(f.order.type)?f.order.target===null:int(f.order.target,0,N-1)&&s.empires[f.owner].known.includes(f.order.target)) && int(f.order.origin,0,N-1),'ship orders');
    if (f.refit!==null) { record(f.refit,['design','cost','work','done'],'refit'); designRecord(f.refit.design); checkDesign(f.refit.design,s.empires[f.owner].tech,f.owner); assert(f.refit.design.hull===f.design.hull && f.refit.cost===Math.max(1,designStats(f.refit.design).cost-designStats(f.design).cost)+Math.ceil(designStats(f.refit.design).cost/10) && f.refit.work===Math.max(1,Math.ceil(designStats(f.refit.design).work/2)) && int(f.refit.done,0,f.refit.work) && !f.path.length,'refit accounting'); }
    assert(int(f.hp, 1, designStats(f.design).hp) && Array.isArray(f.path) && f.path.length < N, 'fleet condition');
    let previous = f.system;
    for (const id of f.path) { assert(int(id, 0, N - 1) && s.systems[previous].links.includes(id) && visibleSystems(s, f.owner).has(id), 'fleet route'); previous = id; }
  }
  for (const e of s.empires) assert(fleets(s, e.id).length <= R.fleetLimit && e.contacts.every(id => s.empires[id].contacts.includes(e.id)), 'empire consistency');
  assert(Array.isArray(s.log) && s.log.length <= 100 && s.log.every(l => l && int(l.turn, 1, s.turn) && typeof l.text === 'string' && l.text.length <= 1200 && ['info', 'survey', 'diplomacy', 'colony', 'battle', 'relic', 'research', 'build', 'victory'].includes(l.kind)), 'log');
  for (const l of s.log) record(l, ['turn', 'text', 'kind'], 'log fields');
  assert(Array.isArray(s.battles) && s.battles.length <= 30 && s.battles.every(b => b && int(b.turn, 1, s.turn) && int(b.system, 0, N - 1) && Array.isArray(b.participants) && b.participants.length <= E && b.participants.every(n => int(n, 0, E - 1)) && Array.isArray(b.losses) && b.losses.length === E && b.losses.every(n => int(n, 0, 60)) && Array.isArray(b.captured) && b.captured.length <= P && b.captured.every(name)), 'battle reports');
  assert((s.winner === null || int(s.winner, 0, E - 1)) && typeof s.victory === 'string' && s.victory.length <= 200, 'victory');
  for (const b of s.battles) { record(b, ['turn', 'system', 'participants', 'losses', 'captured','damage','forces'], 'battle fields'); assert(int(b.damage,0,10000000) && Array.isArray(b.forces) && b.forces.length<=E && b.forces.every(f=>int(f.owner,0,E-1)&&int(f.ships,0,R.fleetLimit)&&int(f.attack,0,10000000)),'battle detail'); for(const f of b.forces) record(f,['owner','ships','attack'],'battle force'); }
  validateExtensions(s,assert,record);
  return true;
}

const api = Object.freeze({ content, createGame, command, endTurn, colonies, fleets, income, production, defence, score, checkVictory, log, reveal, atWar, route, visibleSystems, designStats, checkDesign, role, techCost, serialize, deserialize, validateState, migrateState, ai, researchAvailable, unlocks, refitQuote, objectives, systemIntel, observedSystems });
return api;
}
