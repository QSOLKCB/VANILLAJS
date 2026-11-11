// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/4XGAMES 030859385ac8929e066702ef8af0518663480653: native VANILLAJS imports.
// Authoring transactions operate on detached plain text. No game state or DOM.
import {parsePack, PACK_FILES, OPTIONAL_PACK_FILES} from './content.js';
import {nextRandom} from '../../../../modules/integer-math/index.js';
import {MOD_PACK_KIND, validateModManifest, DataModRegistry} from '../../../../modules/mod-sdk/index.js';
export const TABLE_FIELDS = Object.freeze({
  empires: ['id','short','color','accent','home','ethos'],
  hulls: ['id','name','faction','slots','hp','cost','work','tech','level','shape'],
  components: ['id','name','kind','slots','cost','hp','attack','speed','tech','level','description'],
  ships: ['empire','name','hull','parts'], planet_types: ['id','name','max','minerals','palette'],
  buildings: ['id','name','cost','work','minerals','energy','science','production','defence','desc'],
  research: ['id','name','desc'], map: ['id','links','relic'], music: ['note','duration'],
  layout: ['id','x','y'], dependencies: ['field','level','requires','requiresLevel'],
  objectives: ['id','owner','kind','target','amount','requires','branch','title','description','victory'],
  events: ['id','turn','requires','kind','owner','target','value','repeat'],
  starts: ['empire','minerals','energy','science','colonies'],
  provenance: ['hull','source','sha256','license','operation']
});
const filename = file => file.endsWith('.txt') ? file : file + '.txt';
const keyFor = file => filename(file).slice(0,-4);
const cell = value => { const s = Array.isArray(value) ? value.join(',') : String(value ?? ''); if (/[|\r\n\0]/.test(s)) throw new Error('Table values cannot contain pipes or newlines.'); return s; };
export function diagnosePack(raw) { try { const pack = parsePack(raw); return {ok:true,pack,diagnostics:[]}; } catch(error) { return {ok:false,pack:null,diagnostics:[{file:error.file || 'pack',line:error.line || 1,field:error.field || 'files',message:error.message}]}; } }
export function patchFiles(raw, changes, {validate = true} = {}) {
  const candidate = structuredClone(raw);
  for (const [file,value] of Object.entries(changes)) { if (![...PACK_FILES,...OPTIONAL_PACK_FILES].includes(keyFor(file))) throw new Error('Unsupported campaign file: '+file); candidate[filename(file)] = value; }
  return validate ? parsePack(candidate).raw : candidate;
}
export function editSetting(raw,file,key,value,{validate=true}={}) {
  if (!['campaign','rules','scenario','ai'].includes(keyFor(file))) throw new Error('Choose a settings file.');
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || /[\r\n\0]/.test(String(value))) throw new Error('Invalid setting.');
  const name = filename(file), lines = (raw[name] || '').split(/\r?\n/), index = lines.findIndex(line => line.split('=')[0].trim() === key);
  if (index < 0) lines.push(`${key} = ${value}`); else lines[index] = `${key} = ${value}`;
  return patchFiles(raw,{[name]:lines.join('\n')},{validate});
}
export function readRows(raw,file) {
  const fields = TABLE_FIELDS[keyFor(file)]; if (!fields) throw new Error('Unknown table.');
  return (raw[filename(file)] || '').split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
    const values = line.split('|').map(s=>s.trim()); if (values.length !== fields.length) throw new Error('Malformed table: '+file);
    return Object.fromEntries(fields.map((field,i)=>[field,values[i]]));
  });
}
export function writeRows(raw,file,records,{validate=true}={}) {
  const fields = TABLE_FIELDS[keyFor(file)]; if (!fields || !Array.isArray(records)) throw new Error('Unknown table or rows.');
  const text = '# '+fields.join(' | ')+'\n'+records.map(row=>fields.map(key=>cell(row[key])).join(' | ')).join('\n')+'\n';
  return patchFiles(raw,{[filename(file)]:text},{validate});
}
export function editRow(raw,file,id,values,{validate=true}={}) {
  const fields = TABLE_FIELDS[keyFor(file)]; if (!fields || Object.keys(values).some(k=>!fields.includes(k))) throw new Error('Unknown table field.');
  const rows=readRows(raw,file), index=rows.findIndex(row=>String(row[fields[0]])===String(id));
  const row={...(index < 0 ? {[fields[0]]:id} : rows[index]),...values};
  if (index < 0) rows.push(row); else rows[index]=row;
  return writeRows(raw,file,rows,{validate});
}
export function setLane(raw,a,b,enabled) {
  const pack=parsePack(raw); if (!Number.isInteger(a)||!Number.isInteger(b)||!pack.map[a]||!pack.map[b]||a===b||typeof enabled!=='boolean') throw new Error('Choose two different valid systems.');
  const rows=readRows(raw,'map'); for(const [from,to] of [[a,b],[b,a]]) { const links = new Set(pack.map[from].links); enabled?links.add(to):links.delete(to); rows[from].links=[...links].sort((x,y)=>x-y).join(','); }
  return writeRows(raw,'map',rows);
}
export const setLayout = (raw,id,x,y) => editRow(raw,'layout',id,{id,x,y});
export const updateHull = (raw,id,patch) => editRow(raw,'hulls',id,{...patch,...(Array.isArray(patch.shape)?{shape:patch.shape.map(p=>p.join(',')).join(';')}:{})});
export const updateEmpire = (raw,id,patch) => editRow(raw,'empires',id,patch);
export function setStartingFleet(raw,empire,ships) {
  const rows=readRows(raw,'ships').filter(s=>Number(s.empire)!==empire); rows.push(...ships.map(s=>({...s,empire}))); rows.sort((a,b)=>Number(a.empire)-Number(b.empire)); return writeRows(raw,'ships',rows);
}
export function exportPack(raw) { return JSON.stringify({kind:'voidward.text-pack.v1',files:parsePack(raw).raw},null,2)+'\n'; }
export function importPack(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 1000000) throw new Error('Pack exceeds 1 MB.');
  const value=JSON.parse(text); if (value.kind===MOD_PACK_KIND) return importSDKPack(value);
  if (value.kind!=='voidward.text-pack.v1'||Object.keys(value).some(k=>!['kind','files'].includes(k))) throw new Error('Unknown portable pack format.');
  return parsePack(value.files).raw;
}
export function exportSDKPack(raw) {
  const pack=parsePack(raw), manifest={kind:MOD_PACK_KIND,id:pack.meta.id,version:pack.meta.version,requires:[],entries:[{id:'campaign',kind:'data',data:{kind:'voidward.text-pack.v1',files:pack.raw}}]};
  // Donor caps stay authoritative. Larger packs use native portable export.
  return JSON.stringify(validateModManifest(manifest),null,2)+'\n';
}
export function importSDKPack(source) {
  const manifest=validateModManifest(typeof source==='string'?JSON.parse(source):source);
  if (manifest.requires.length || manifest.entries.length!==1) throw new Error('VOIDWARD SDK exchange requires one self-contained campaign entry.');
  const data=manifest.entries[0].data;
  if (data.kind!=='voidward.text-pack.v1'||Object.keys(data).length!==2||!Object.hasOwn(data,'files')) throw new Error('Expected a typed VOIDWARD text campaign.');
  const pack=parsePack(data.files);
  if(pack.meta.id!==manifest.id||pack.meta.version!==manifest.version) throw new Error('SDK identity must match campaign identity.');
  const registry=new DataModRegistry();registry.register(manifest);registry.activate(manifest.id);return pack.raw;
}
export function createCampaign(baseRaw,{id,title,description,version='1.0.0',columns,rows,planetsPerSystem=2,seed=1,homes,geography='grid',files={}}) {
  if (!Number.isInteger(seed)||seed<0||seed>4294967295) throw new Error('Seed must be uint32.');
  const n=columns*rows;
  if (!Number.isInteger(n)||n<4||n>64||!['grid','ring','chain'].includes(geography)) throw new Error('Use 4..64 stars and grid, ring or chain geography.');
  let draft=structuredClone(baseRaw);
  for (const [key,value] of Object.entries({id,title,description,version})) draft=editSetting(draft,'campaign',key,value,{validate:false});
  for (const [key,value] of Object.entries({columns,rows,planetsPerSystem})) draft=editSetting(draft,'rules',key,value,{validate:false});
  const factions=readRows(draft,'empires'); if (!Array.isArray(homes)||homes.length!==factions.length) throw new Error('Provide one home system for each empire.');
  factions.forEach((f,i)=>f.home=homes[i]);draft=writeRows(draft,'empires',factions,{validate:false});
  const links=Array.from({length:n},()=>new Set()), connect=(a,b)=>{links[a].add(b);links[b].add(a);};
  for(let i=1;i<n;i++) connect(i-1,i); // Connected baseline for every geography.
  if(geography==='ring')connect(0,n-1);
  if(geography==='grid')for(let i=0;i<n-columns;i++)connect(i,i+columns);
  let rng=seed;const random=()=>{rng=nextRandom(rng);return rng>>>0;};
  const map=links.map((adj,id)=>({id,links:[...adj].sort((a,b)=>a-b),relic:homes.includes(id)?0:Number(random()%7===0)}));
  draft=writeRows(draft,'map',map,{validate:false});
  draft=writeRows(draft,'layout',map.map(({id})=>({id,x:geography==='ring'?Math.round(450+350*Math.cos(id/n*Math.PI*2)):80+(id%columns)*100,y:geography==='ring'?Math.round(450+350*Math.sin(id/n*Math.PI*2)):80+Math.floor(id/columns)*100})),{validate:false});
  draft['system_names.txt']=Array.from({length:n},(_,i)=>`Reach ${String(i+1).padStart(2,'0')}`).join('\n')+'\n';
  draft['planet_names.txt']=Array.from({length:n*planetsPerSystem},(_,i)=>`Haven ${String(i+1).padStart(3,'0')}`).join('\n')+'\n';
  return patchFiles(draft,files);
}
