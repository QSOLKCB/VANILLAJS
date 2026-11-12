// SPDX-License-Identifier: Apache-2.0
// Text packs are data. They never evaluate JavaScript, HTML, URLs or expressions.
export const PACK_FILES = ['campaign', 'rules', 'empire_names', 'empires', 'system_names', 'planet_names', 'planet_types', 'hulls', 'components', 'ships', 'buildings', 'research', 'map', 'music'];
export const OPTIONAL_PACK_FILES = ['scenario', 'layout', 'dependencies', 'objectives', 'events', 'ai', 'starts', 'provenance'];
const locations = new WeakMap();
let context = {file: 'pack', line: 1, field: 'files'};
export class PackError extends Error {
  constructor(message, where = context) { super(`${where.file}:${where.line}:${where.field}: ${message}`); this.name = 'PackError'; Object.assign(this, where); }
}
const locate = (record, field = 'row') => { const where = locations.get(record); if (where) context = {...where, line: where.keys?.[field] ?? where.line, field}; };
const bad = (message, record, field) => { if (record) locate(record, field); throw new PackError(message); };
const sourceLines = text => text.split(/\r?\n/).map((text, i) => ({text: text.trim(), line: i + 1})).filter(r => r.text && !r.text.startsWith('#'));
const lines = text => text.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const validId = s => typeof s === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(s) && !['constructor', 'prototype', '__proto__'].includes(s);
const number = (s, min, max, label) => { if (!/^\d+$/.test(String(s)) || !Number.isSafeInteger(Number(s)) || Number(s) < min || Number(s) > max) bad(`${label} must be ${min}..${max}.`); return Number(s); };
function table(raw, file, fields) {
  return sourceLines(raw[file + '.txt'] || '').map(({text, line}) => {
    context = {file: file + '.txt', line, field: 'row'};
    const cells = text.split('|').map(s => s.trim());
    if (cells.length !== fields.length) bad(`expects ${fields.length} pipe-separated fields (${fields.join(', ')}).`);
    const record = Object.fromEntries(fields.map((key, j) => [key, cells[j]]));
    locations.set(record, {file: file + '.txt', line}); return record;
  });
}
function settings(text, file) {
  const result = Object.create(null), keys = {};
  for (const {text: line, line: index} of sourceLines(text || '')) {
    context = {file, line: index, field: 'setting'};
    const at = line.indexOf('='); if (at <= 0) bad('Settings use key = value.');
    const key = line.slice(0, at).trim(), value = line.slice(at + 1).trim();
    context.field = key;
    if (Object.hasOwn(result, key) || ['constructor', 'prototype', '__proto__'].includes(key)) bad('Duplicate or reserved setting.');
    result[key] = value; keys[key] = index;
  }
  locations.set(result, {file, line: 1, keys}); return result;
}
function catalog(records, file) {
  const out = Object.create(null);
  if (!records.length || records.length > 128) bad(`${file} requires 1..128 records.`);
  for (const r of records) { locate(r, 'id'); if (!validId(r.id) || Object.hasOwn(out, r.id)) bad(`Invalid or duplicate ID in ${file}.`); out[r.id] = r; }
  return out;
}
export function parsePack(input) {
  context = {file: 'pack', line: 1, field: 'files'};
  if (!input || typeof input !== 'object' || Array.isArray(input)) bad('Expected a text file collection.');
  const raw = {};
  for (const file of [...PACK_FILES, ...OPTIONAL_PACK_FILES.filter(f => Object.hasOwn(input, f + '.txt'))]) {
    context = {file: file + '.txt', line: 1, field: 'file'};
    const value = input[file + '.txt'];
    if (typeof value !== 'string' || new TextEncoder().encode(value).length > 100000 || value.includes('\0')) bad(`Missing or oversized ${file}.txt.`);
    raw[file + '.txt'] = value;
  }
  if (new TextEncoder().encode(JSON.stringify(raw)).length > 500000) bad('Combined pack exceeds 500 KB.');
  const meta = settings(raw['campaign.txt'], 'campaign.txt');
  if (Object.keys(meta).length !== 4 || !['id', 'version', 'title', 'description'].every(k => Object.hasOwn(meta, k))) bad('campaign.txt needs exactly id, version, title and description.');
  if (!validId(meta.id) || !/^\d+\.\d+\.\d+$/.test(meta.version) || !meta.title || meta.title.length > 80 || !meta.description || meta.description.length > 600) bad('Invalid campaign identity.');
  const r = settings(raw['rules.txt'], 'rules.txt');
  const limits = {
    columns: [2, 10], rows: [2, 8], planetsPerSystem: [1, 4], turnLimit: [20, 500], colonyTarget: [2, 200], maxTech: [2, 8],
    startMinerals: [0, 100000], startEnergy: [0, 100000], colonizeMinerals: [0, 10000], colonizeEnergy: [0, 10000],
    baseProduction: [1, 100], industryProduction: [0, 100], industryMinerals: [0, 100], baseEnergy: [0, 100], baseScience: [1, 100],
    baseDefence: [0, 200], shieldDefence: [0, 100], researchBase: [1, 10000], researchStep: [1, 10000],
    tradeIncome: [0, 1000], tradeCost: [0, 10000], peaceCost: [0, 10000], warGrace: [1, 200],
    relicScience: [0, 10000], relicMinerals: [0, 10000], repair: [0, 100], facilityLimit: [1, 10], fleetLimit: [3, 60]
  };
  const rules = {};
  for (const [key, bounds] of Object.entries(limits)) { locate(r, key); rules[key] = number(r[key], ...bounds, key); }
  for (const key of Object.keys(r)) if (!Object.hasOwn(limits, key)) bad('Unknown rule key.', r, key);
  const count = rules.columns * rules.rows;
  if (count > 64 || rules.colonyTarget > count * rules.planetsPerSystem) bad('Galaxy capacity exceeded.');
  const empireNames = lines(raw['empire_names.txt']), systemNames = lines(raw['system_names.txt']), planetNames = lines(raw['planet_names.txt']);
  if (systemNames.length < count || planetNames.length < count * rules.planetsPerSystem) bad('Provide enough system and planet names for the galaxy.');
  for (const n of [...empireNames, ...systemNames, ...planetNames]) if (n.length > 60) bad('Names must have at most 60 characters.');
  const empires = table(raw, 'empires', ['id', 'short', 'color', 'accent', 'home', 'ethos']);
  if (empires.length < 2 || empires.length > 6 || empireNames.length !== empires.length) bad('Use 2..6 empires and one name per empire.');
  empires.forEach((e, i) => {
    locate(e, 'home');
    e.id = number(e.id, 0, 5, 'empire id'); e.home = number(e.home, 0, count - 1, 'home system'); e.name = empireNames[i];
    if (e.id !== i || !/^#[\da-f]{6}$/i.test(e.color) || !/^#[\da-f]{6}$/i.test(e.accent) || !e.short || e.short.length > 15 || e.ethos.length > 150) bad('Invalid empire row.');
  });
  if (new Set(empires.map(e => e.home)).size !== empires.length) bad('Empires need distinct home systems.');
  const tech = catalog(table(raw, 'research', ['id', 'name', 'desc']), 'research');
  for (const id of ['industry', 'propulsion', 'weapons', 'shields']) if (!Object.hasOwn(tech, id)) bad(`Required research field: ${id}.`);
  const planets = catalog(table(raw, 'planet_types', ['id', 'name', 'max', 'minerals', 'palette']), 'planet types');
  for (const p of Object.values(planets)) { locate(p, 'palette'); p.max = number(p.max, 20, 1000, 'population'); p.minerals = number(p.minerals, 0, 200, 'minerals'); if (!['ocean', 'gas', 'ice'].includes(p.palette)) bad('Planet palette must be ocean, gas or ice.'); }
  const hulls = catalog(table(raw, 'hulls', ['id', 'name', 'faction', 'slots', 'hp', 'cost', 'work', 'tech', 'level', 'shape']), 'hulls');
  for (const h of Object.values(hulls)) {
    locate(h, 'faction');
    h.faction = h.faction === '*' ? -1 : number(h.faction, 0, empires.length - 1, 'hull faction');
    for (const [key, min, max] of [['slots', 2, 40], ['hp', 1, 1000], ['cost', 1, 10000], ['work', 1, 10000], ['level', 1, rules.maxTech]]) { locate(h, key); h[key] = number(h[key], min, max, key); }
    if (!Object.hasOwn(tech, h.tech)) bad('Unknown hull research field.', h, 'tech');
    locate(h, 'shape');
    h.shape = h.shape.split(';').map(point => point.trim().split(',').map(Number));
    if (h.shape.length < 3 || h.shape.length > 40 || h.shape.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v) || Math.abs(v) > 60))) bad('Hull shape needs 3..40 x,y vertices in -60..60.');
  }
  const components = catalog(table(raw, 'components', ['id', 'name', 'kind', 'slots', 'cost', 'hp', 'attack', 'speed', 'tech', 'level', 'description']), 'components');
  for (const c of Object.values(components)) {
    locate(c, 'kind');
    if (!['engine', 'weapon', 'shield', 'survey', 'colony', 'assault'].includes(c.kind) || !Object.hasOwn(tech, c.tech)) bad('Unknown component role or research.');
    for (const [key, min, max] of [['slots', 1, 20], ['cost', 0, 10000], ['hp', 0, 1000], ['attack', 0, 500], ['speed', 0, 4], ['level', 1, rules.maxTech]]) { locate(c, key); c[key] = number(c[key], min, max, key); }
    if ((c.kind === 'engine') !== (c.speed > 0)) bad('Only engines provide movement, at least one lane per turn.', c, 'speed');
  }
  const buildings = catalog(table(raw, 'buildings', ['id', 'name', 'cost', 'work', 'minerals', 'energy', 'science', 'production', 'defence', 'desc']), 'buildings');
  for (const id of ['mine', 'reactor', 'lab', 'yard', 'defence']) if (!Object.hasOwn(buildings, id)) bad(`Required facility: ${id}.`);
  for (const b of Object.values(buildings)) for (const key of ['cost', 'work', 'minerals', 'energy', 'science', 'production', 'defence']) { locate(b, key); b[key] = number(b[key], key === 'work' || key === 'cost' ? 1 : 0, 10000, `building ${key}`); }
  const ships = table(raw, 'ships', ['empire', 'name', 'hull', 'parts']);
  if (ships.length > 60) bad('At most 60 starting ship records.');
  for (const ship of ships) {
    locate(ship, 'empire');
    ship.empire = number(ship.empire, 0, empires.length - 1, 'ship empire'); ship.parts = ship.parts.split(',').map(s => s.trim());
    if (!ship.name || ship.name.length > 32 || !Object.hasOwn(hulls, ship.hull) || ship.parts.some(id => !Object.hasOwn(components, id))) bad('Invalid starting ship.', ship, 'hull/parts/name');
    const h = hulls[ship.hull];
    if ((h.faction !== -1 && h.faction !== ship.empire) || h.level !== 1 || ship.parts.some(id => components[id].level !== 1) || ship.parts.reduce((n, id) => n + components[id].slots, 0) > h.slots || !ship.parts.some(id => components[id].speed > 0)) bad('Starting ships must be legal at technology I.', ship, 'parts');
  }
  for (const e of empires) for (const kind of ['colony', 'survey', 'assault']) if (!ships.some(s => s.empire === e.id && s.parts.some(id => components[id].kind === kind))) bad(`Empire ${e.id} needs a starting ${kind} ship.`);
  for (const e of empires) if (ships.filter(s => s.empire === e.id).length > Math.min(24, rules.fleetLimit)) bad('Starting ships exceed the design or fleet capacity.');
  const map = table(raw, 'map', ['id', 'links', 'relic']);
  if (map.length !== count) bad('map.txt needs one row per star.');
  map.forEach((s, i) => {
    locate(s, 'links');
    s.id = number(s.id, 0, count - 1, 'map id'); s.relic = number(s.relic, 0, 1, 'relic') === 1;
    s.links = s.links ? s.links.split(',').map(n => number(n, 0, count - 1, 'starlane')).sort((a, b) => a - b) : [];
    if (s.id !== i || new Set(s.links).size !== s.links.length || s.links.includes(i)) bad('Invalid starlane.');
  });
  for (const s of map) for (const n of s.links) if (!map[n].links.includes(s.id)) bad('Starlanes must be reciprocal.', s, 'links');
  const seen = new Set([0]); for (const id of seen) for (const n of map[id].links) seen.add(n);
  if (seen.size !== count) bad('Galaxy must be connected.', map.find(s => !seen.has(s.id)), 'links');
  const music = table(raw, 'music', ['note', 'duration']);
  if (!music.length || music.length > 32) bad('Use 1..32 ambient notes.');
  music.forEach(n => { locate(n, 'note/duration'); n.note = number(n.note, 24, 96, 'MIDI note'); n.duration = number(n.duration, 1, 8, 'note seconds'); });
  for (const record of [...Object.values(hulls), ...Object.values(components), ...Object.values(buildings), ...Object.values(tech), ...Object.values(planets)]) for (const [k, v] of Object.entries(record)) if (typeof v === 'string' && v.length > (k === 'desc' || k === 'description' ? 300 : 80)) bad('Catalog text exceeds its bound.', record, k);
  const extra = parseExtensions(raw, {rules, empires, tech, ships, hulls, components, map, count});
  return { ...extra, meta: { id: meta.id, version: meta.version, title: meta.title, description: meta.description }, rules, empires, systemNames, planetNames, planets, hulls, components, ships, buildings, tech, map, music, raw };
}
export async function loadPack(base, optionalFiles = []) {
  if (!Array.isArray(optionalFiles) || optionalFiles.some(f => !OPTIONAL_PACK_FILES.includes(f))) throw new Error('Unknown optional campaign file.');
  const raw = {};
  await Promise.all([...PACK_FILES, ...optionalFiles].map(async name => {
    const response = await fetch(new URL(`${name}.txt`, base));
    if (!response.ok) throw new Error(`Cannot load ${name}.txt (${response.status}).`);
    raw[name + '.txt'] = await response.text();
  }));
  return parsePack(raw);
}
export async function loadDirectory(files) {
  const raw = {};
  for (const file of files) {
    const name = file.name;
    if (![...PACK_FILES, ...OPTIONAL_PACK_FILES].some(n => n + '.txt' === name)) continue;
    if (Object.hasOwn(raw, name)) bad(`Duplicate ${name}; select a single campaign directory.`);
    if (file.size > 100000) bad('File exceeds 100 KB.');
    raw[name] = await file.text();
  }
  return parsePack(raw);
}

function parseExtensions(raw, {rules, empires, tech, ships, hulls, map, count}) {
  const int = (r, key, min, max) => { locate(r, key); return number(r[key], min, max, key); };
  const owner = r => r.owner === 'player' ? 'player' : int(r, 'owner', 0, empires.length - 1);
  const csv = value => value ? value.split(',').map(s => s.trim()) : [];
  const rows = (file, fields, limit) => {
    const out = table(raw, file, fields);
    if (out.length > limit) { context = {file: file + '.txt', line: 1, field: 'records'}; bad(`At most ${limit} records.`); }
    return out;
  };
  const unique = (records, key = 'id') => { const seen = new Set(); for (const r of records) { if (seen.has(r[key])) bad('Duplicate identity.', r, key); seen.add(r[key]); } };
  const ids = records => { unique(records); for (const r of records) if (!validId(r.id)) bad('Invalid ID.', r, 'id'); };
  const text = (r, key, max = 300) => { if (typeof r[key] !== 'string' || !r[key] || r[key].length > max || /[\u0000-\u001f\u007f]/.test(r[key])) bad(`Use 1..${max} printable characters.`, r, key); };
  const opts = settings(raw['scenario.txt'], 'scenario.txt');
  const scenario = {playable: [0], victory: 'legacy', minVictoryTurn: 1, defeatAtLimit: false};
  for (const key of Object.keys(opts)) if (!Object.hasOwn(scenario, key)) bad('Unknown scenario setting.', opts, key);
  if (opts.playable !== undefined) {
    locate(opts, 'playable'); scenario.playable = csv(opts.playable).map(n => number(n, 0, empires.length - 1, 'playable empire'));
    if (!scenario.playable.length || new Set(scenario.playable).size !== scenario.playable.length) bad('Choose distinct playable empire IDs.');
  }
  if (opts.victory !== undefined) { if (!['legacy', 'objectives'].includes(opts.victory)) bad('Choose legacy or objectives.', opts, 'victory'); scenario.victory = opts.victory; }
  if (opts.minVictoryTurn !== undefined) scenario.minVictoryTurn = int(opts, 'minVictoryTurn', 1, rules.turnLimit);
  if (opts.defeatAtLimit !== undefined) scenario.defeatAtLimit = int(opts, 'defeatAtLimit', 0, 1) === 1;
  const layout = rows('layout', ['id', 'x', 'y'], 64);
  for (const p of layout) { p.id = int(p, 'id', 0, count - 1); for (const key of ['x','y']) { locate(p, key); if (!/^-?\d+(\.\d+)?$/.test(p[key]) || !Number.isFinite(Number(p[key])) || Math.abs(Number(p[key])) > 2000) bad('Coordinate must be finite within -2000..2000.'); p[key] = Number(p[key]); } }
  unique(layout);
  const dependencies = rows('dependencies', ['field', 'level', 'requires', 'requiresLevel'], 128);
  const techEdges = new Map();
  for (const field of Object.keys(tech)) for (let level = 2; level <= rules.maxTech; level++) techEdges.set(`${field}:${level}`, [`${field}:${level - 1}`]);
  for (const d of dependencies) {
    if (!Object.hasOwn(tech, d.field)) bad('Unknown research field.', d, 'field');
    if (!Object.hasOwn(tech, d.requires)) bad('Unknown prerequisite field.', d, 'requires');
    d.level = int(d, 'level', 2, rules.maxTech); d.requiresLevel = int(d, 'requiresLevel', 1, rules.maxTech);
    techEdges.get(`${d.field}:${d.level}`).push(`${d.requires}:${d.requiresLevel}`);
  }
  const visitGraph = (graph, onCycle) => { const done = new Set(), visiting = new Set(); const visit = id => { if (visiting.has(id)) onCycle(id); if (done.has(id)) return; visiting.add(id); for (const next of graph.get(id) || []) visit(next); visiting.delete(id); done.add(id); }; for (const id of graph.keys()) visit(id); };
  visitGraph(techEdges, id => bad('Cyclic research prerequisites.', dependencies.find(d => `${d.field}:${d.level}` === id) || dependencies[0], 'requires'));
  const objectives = rows('objectives', ['id', 'owner', 'kind', 'target', 'amount', 'requires', 'branch', 'title', 'description', 'victory'], 64);
  ids(objectives);
  const objectiveMap = new Map(objectives.map(o => [o.id, o]));
  for (const o of objectives) {
    o.owner = o.owner === '*' ? '*' : owner(o); o.amount = int(o, 'amount', 1, 1000000); o.victory = int(o, 'victory', 0, 1) === 1;
    if (!['colonies','survey','archives','research','trade','control','survive','defeat','resources'].includes(o.kind)) bad('Unknown objective kind.', o, 'kind');
    o.requires = csv(o.requires); if (new Set(o.requires).size !== o.requires.length || o.requires.some(id => !objectiveMap.has(id))) bad('Unknown or duplicate prerequisite objective.', o, 'requires');
    if (o.branch && !validId(o.branch)) bad('Invalid branch ID.', o, 'branch');
    text(o, 'title', 80); text(o, 'description');
    if (o.kind === 'research' && !Object.hasOwn(tech, o.target)) bad('Unknown research target.', o, 'target');
    if (o.kind === 'resources' && !['minerals','energy','science'].includes(o.target)) bad('Unknown resource target.', o, 'target');
    if (o.kind === 'control' || (['survey','archives'].includes(o.kind) && o.target !== '*')) int(o, 'target', 0, count - 1);
    if (o.kind === 'defeat' || (o.kind === 'trade' && o.target !== '*')) int(o, 'target', 0, empires.length - 1);
    const max = {colonies: count * rules.planetsPerSystem, survey: o.target === '*' ? count : 1, archives: o.target === '*' ? map.filter(s => s.relic).length : 1, research: rules.maxTech, trade: o.target === '*' ? empires.length - 1 : 1, control: rules.planetsPerSystem, survive: rules.turnLimit, defeat: 1, resources: 999999}[o.kind];
    if (o.kind === 'archives' && o.target !== '*' && !map[Number(o.target)].relic) bad('Target system has no archive.', o, 'target');
    if (o.amount > max) bad(`Objective amount exceeds supported maximum ${max}.`, o, 'amount');
  }
  visitGraph(new Map(objectives.map(o => [o.id, o.requires])), id => bad('Cyclic objective prerequisites.', objectiveMap.get(id), 'requires'));
  if (scenario.victory === 'objectives' && !objectives.some(o => o.victory)) { context = {file: 'objectives.txt', line: 1, field: 'victory'}; bad('Objective campaigns need at least one victory objective.'); }
  const applies = (o, empire, human) => o.owner === '*' || o.owner === empire || o.owner === 'player' && empire === human;
  for (const o of objectives) {
    for (const id of o.requires) {
      const prerequisite = objectiveMap.get(id);
      for (const human of scenario.playable) for (const e of empires) if (applies(o, e.id, human) && !applies(prerequisite, e.id, human)) bad('Prerequisite does not apply to the same empire for every playable choice.', o, 'requires');
    }
    // A campaign permits one route choice. Multiple nonempty branch labels in
    // the prerequisite closure are structurally incompatible, not a balance issue.
    const branches = new Set(), seen = new Set();
    const collect = item => { if (seen.has(item.id)) return; seen.add(item.id); if (item.branch) branches.add(item.branch); for (const id of item.requires) collect(objectiveMap.get(id)); };
    collect(o); if (branches.size > 1) bad('Prerequisites require mutually exclusive campaign routes.', o, 'requires');
  }
  if (scenario.victory === 'objectives') for (const human of scenario.playable) if (!objectives.some(o => o.victory && applies(o, human, human))) { context = {file: 'objectives.txt', line: 1, field: 'owner'}; bad(`Playable empire ${human} has no applicable victory objective.`); }
  const events = rows('events', ['id', 'turn', 'requires', 'kind', 'owner', 'target', 'value', 'repeat'], 128); ids(events);
  for (const e of events) {
    e.turn = int(e, 'turn', 1, rules.turnLimit); e.owner = owner(e); e.repeat = int(e, 'repeat', 0, rules.turnLimit); e.requires = csv(e.requires);
    if (new Set(e.requires).size !== e.requires.length || e.requires.some(id => !objectiveMap.has(id))) bad('Unknown or duplicate prerequisite objective.', e, 'requires');
    for (const id of e.requires) for (const human of scenario.playable) { const empire = e.owner === 'player' ? human : e.owner; if (!applies(objectiveMap.get(id), empire, human)) bad('Event prerequisite does not apply to its recipient.', e, 'requires'); }
    if (!['resources','spawn','message','war'].includes(e.kind)) bad('Unknown event kind.', e, 'kind');
    if (e.kind === 'resources') { if (!['minerals','energy','science'].includes(e.target)) bad('Unknown resource.', e, 'target'); e.value = int(e, 'value', 1, 1000000); }
    else if (e.kind === 'spawn') {
      // Design index is local to the event owner, never a global design ID.
      const owners = e.owner === 'player' ? scenario.playable : [e.owner];
      e.target = String(int(e, 'target', 0, 23)); e.value = int(e, 'value', 0, count - 1);
      for (const id of owners) if (Number(e.target) >= ships.filter(s => s.empire === id).length) bad(`Empire ${id} has no such starting design.`, e, 'target');
    } else if (e.kind === 'war') { e.target = String(int(e, 'target', 0, empires.length - 1)); e.value = int(e, 'value', 0, 0); if ((e.owner === 'player' ? scenario.playable : [e.owner]).includes(Number(e.target))) bad('An empire cannot declare war on itself.', e, 'target'); }
    else { text(e, 'target'); e.value = int(e, 'value', 0, 0); }
  }
  const aiSettings = settings(raw['ai.txt'], 'ai.txt'), ai = {reserveMinerals: 80, colonyShips: 2, militaryLimit: 35, aggression: 50};
  const aiLimits = {reserveMinerals: [0,10000], colonyShips: [1,6], militaryLimit: [3,60], aggression: [0,100]};
  for (const key of Object.keys(aiSettings)) { if (!Object.hasOwn(aiLimits, key)) bad('Unknown AI setting.', aiSettings, key); ai[key] = int(aiSettings, key, ...aiLimits[key]); }
  const starts = rows('starts', ['empire', 'minerals', 'energy', 'science', 'colonies'], 6), owned = new Map(empires.map(e => [e.home * rules.planetsPerSystem, e.id]));
  for (const s of starts) {
    s.empire = int(s, 'empire', 0, empires.length - 1); for (const key of ['minerals','energy','science']) s[key] = int(s, key, 0, 999999);
    locate(s, 'colonies'); s.colonies = csv(s.colonies).map(n => number(n, 0, count * rules.planetsPerSystem - 1, 'colony'));
    if (new Set(s.colonies).size !== s.colonies.length) bad('Duplicate starting colony.');
    for (const id of s.colonies) { if (owned.has(id) && owned.get(id) !== s.empire) bad('Starting colony already belongs to another empire.', s, 'colonies'); owned.set(id, s.empire); }
  }
  unique(starts, 'empire');
  const provenance = rows('provenance', ['hull', 'source', 'sha256', 'license', 'operation'], 128);
  for (const p of provenance) { if (!Object.hasOwn(hulls, p.hull)) bad('Unknown hull provenance reference.', p, 'hull'); text(p,'hull',40); text(p,'source',160); text(p,'operation',300); if (!/^[a-f0-9]{64}$/.test(p.sha256)) bad('Expected SHA-256 hex digest.', p, 'sha256'); if (!['OWNER-LOCAL-ONLY','CC0-1.0','CC-BY-4.0','MIT','Apache-2.0'].includes(p.license)) bad('Unsupported declared licence.', p, 'license'); }
  return {scenario, layout, dependencies, objectives, events, ai, starts, provenance};
}
