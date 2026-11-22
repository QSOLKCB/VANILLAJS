// SPDX-License-Identifier: Apache-2.0
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {checkCatalogue,localFile,root} from './validate-agent-catalog.mjs';
import {jsDependencies} from './browser-dependencies.mjs';
// Archive hashes independently checked against git show at audited main 128d7c9.
const archiveHashes={'README.md':'3895215459b4ca9388b73f99a2ea8a8076bd619e564d04bbb5a7a0676ee2c0d5','ROADMAP.md':'6e964832e833eacbd267d54763375b6f380e7bcd34afbb92c57bad228ef2c0ee'};
const docs=['README.md','ROADMAP.md','AGENTS.md','agents/README.md',...['START_HERE','CREATOR_QUICKSTART','HOW_TO_BUILD_A_GAME','HOW_TO_MOD_A_GAME','HOW_TO_EXPORT_A_GAME','TROUBLESHOOTING','AGENT_GUIDE','GAMES2_INTEGRATION','CREATOR_GATEWAY_VERIFICATION','CREATOR_GATEWAY_2_5_0_DRAFT','BROWSER_CACHE','SPRITE_FEEL_001','SPRITE_FOUNDRY','WEAPON_FEEL','AFTER_ZERO_GAME_FEEL_AUDIT','ENGINE_EXPANSION_001','SPRITE_FEEL_2_6_0_DRAFT','SCENE_NARRATIVE_001','SCENE_NARRATIVE_2_7_0_DRAFT','SCENE_COMPOSITION','NARRATIVE_API','NARRATIVE_FOUNDRY','GAME_MAKER_001','GAME_MAKER_API','TILEMAP_API','GAME_MAKER_LAB','GAME_MAKER_EXPORT','GAME_MAKER_2_8_0_DRAFT','HORIZON_001','HORIZON_002','HORIZON_003','HORIZON_004','HORIZON_RACING','VEHICLE_AUDIO_API','VEHICLE3D_API','HORIZON_DRIVING','HORIZON_LAB','RENDER_LIT_API','RENDER_PACKING_001','FX_PIPE_001','BLIT_001','COPPER_001','GC_PROFILE_001','SCENIC3D_API','CHIP_AUDIO_API','COCKPIT_PHYSICS_001','SENSING_API','TACTICS_API','CAD_001','CAD_002','CAD_003','WORLD_VIS_001','CREATOR_INTEROP_001','TRAJECTORY_001','REPLAY_AUDIT_001','MATERIAL_001','DABBLECAD_NOTICE','PROJECTION25D_API','HORIZON_2_9_0_DRAFT'].map(n=>'docs/'+n+'.md')];
const slug=s=>s.toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu,'').replace(/ /g,'-');
let links=0;
async function link(from,href,anchors=true){
  if(/^(?:https?:|mailto:|data:)/.test(href))return;
  const [part,anchor]=href.split('#');
  const target=resolve(root,dirname(from),decodeURIComponent(part||from.split('/').at(-1)));
  assert.ok(target.startsWith(root+'/'),'link escapes checkout '+href);
  await stat(target);links++;
  if(anchors&&anchor&&target.endsWith('.md')){
    const body=await readFile(target,'utf8');
    const ids=[...body.matchAll(/^#{1,6} (.+)$/gm)].map(m=>slug(m[1]));
    ids.push(...[...body.matchAll(/<a id="([^"]+)"/g)].map(m=>m[1]));
    assert.ok(ids.includes(decodeURIComponent(anchor)),`${from}: missing anchor ${href}`);
  }
}
for(const path of docs){
  const source=await readFile(resolve(root,path),'utf8');
  for(const m of source.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g))await link(path,m[1]);
}
// Exact archives preserve every original byte and the original root-relative links.
for(const [archive,original]of [['README_HISTORY.md','README.md'],['ROADMAP_HISTORY.md','ROADMAP.md']]){
  const bytes=await readFile(resolve(root,archive));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),archiveHashes[original],'historical archive changed');
  for(const m of bytes.toString().matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g))await link(archive,m[1],false);
}
for(const path of ['demos/tutorial-lab/index.html','demos/creator-hub/index.html','demos/sprite-foundry/index.html','demos/weapon-feel-lab/index.html','demos/narrative-foundry/index.html','demos/game-maker-lab/index.html','demos/horizon-lab/index.html','demos/horizon-lab/drive.html','demos/horizon-lab/race.html','demos/horizon-lab/scenery.html','demos/chip-audio-lab/index.html','demos/cockpit-physics-lab/index.html','demos/sensing-lab/index.html','demos/tactics-lab/index.html','demos/world-vis-lab/index.html','demos/creator-interop-lab/index.html','demos/trajectory-lab/index.html','demos/replay-audit-lab/index.html','demos/material-lab/index.html','demos/projection25d-lab/index.html']){
  const html=await readFile(resolve(root,path),'utf8');
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g))await link(path,m[1]);
}
const hub=await readFile(resolve(root,'demos/creator-hub/index.html'),'utf8');
assert.ok(hub.includes('../tutorial-lab/index.html'),'hub must reach tutorial');
for(const lab of ['sprite-foundry','weapon-feel-lab','narrative-foundry','game-maker-lab','horizon-lab','material-lab'])assert.ok(hub.includes('../'+lab+'/index.html'),'hub must reach '+lab);
assert.ok(hub.includes('../horizon-lab/index.html'),'hub must reach the primary playable HORIZON entry');
assert.ok(hub.includes('../horizon-lab/scenery.html'),'hub must reach the preserved scenery workshop');
const horizon=await readFile(resolve(root,'demos/horizon-lab/index.html'),'utf8');
assert.ok(horizon.includes('id="race-canvas"')&&horizon.includes('id="race-start"')&&horizon.includes('src="./race-start.js"'),'primary HORIZON entry must mount the real playable race');
const catalogue=JSON.parse(await readFile(resolve(root,'MODULES.json'),'utf8'));
// v2.8.0: 67/48; merged HORIZON-001: 69/49; HORIZON-002: 70/50; HORIZON-003 adds vehicle-audio and its race recipe.
assert.equal(Object.keys(catalogue.modules).length,87);assert.equal(Object.keys(catalogue.recipes).length,52);assert.equal(Object.keys(catalogue.experiments).length,2);
assert.ok(Object.values(catalogue.modules).every(m=>m.status==='experimental'));
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
assert.equal(pkg.version,'1.0.0');assert.equal(catalogue.release,'1.0.0');
for(const path of ['README.md','ROADMAP.md'])assert.match(await readFile(resolve(root,path),'utf8'),/v2\.4\.0/);
// Check the documented module names, and every local static import reachable from
// advertised JS examples. Dynamic resources remain the browser suite's concern.
const agent=JSON.parse(await readFile(resolve(root,'agents/catalog.json'),'utf8'));
const advertised=[...new Set(agent.workflows.flatMap(w=>[...w.entryPoints,...w.examples]))];
const pending=advertised.filter(p=>p.endsWith('.js'));
// Follow the browser entry points too: a valid world.js does not guarantee that
// the start.js actually loaded by its HTML page still imports working modules.
for(const path of advertised.filter(p=>p.endsWith('.html'))){
  const html=await readFile(resolve(root,path),'utf8');
  for(const tag of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    const src=/\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag[1]);
    assert.ok(src||!tag[2].trim(),path+' inline script needs an explicit audited source file');
    if(!src)continue;
    assert.ok(!/^(?:[a-z]+:|\/)/i.test(src[2]),path+' external script');
    await link(path,src[2]);
    pending.push(resolve(root,dirname(path),src[2]).slice(root.length+1));
  }
}
const seen=new Set();
while(pending.length){
  const path=pending.pop();if(seen.has(path))continue;seen.add(path);
  const source=await readFile(resolve(root,path),'utf8');
  const dependencies=jsDependencies(source);
  assert.deepEqual(dependencies.issues.filter(issue=>/import|identifier|literal|comment/.test(issue)),[],path+' unsupported import analysis');
  for(const spec of dependencies.imports){
    assert.ok(spec.startsWith('.'),path+' external import');
    const target=resolve(root,dirname(path),spec);assert.ok(target.startsWith(root+'/'));
    await localFile(target.slice(root.length+1));if(target.endsWith('.js'))pending.push(target.slice(root.length+1));
  }
}
const readme=await readFile(resolve(root,'README.md'),'utf8');
const table=readme.split('| Family |')[1].split('## Modding')[0];
for(const m of table.matchAll(/`([^`]+)`/g))assert.ok(catalogue.modules[m[1]],'unknown advertised module '+m[1]);
console.log(`Documentation audit: ${links} local links, ${seen.size} source imports, unchanged historical archives, published baseline references and ${await checkCatalogue()} workflows passed.`);
