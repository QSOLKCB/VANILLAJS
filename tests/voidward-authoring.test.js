// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parsePack,PACK_FILES,loadDirectory} from '../demos/4x-game-lab/voidward/js/content.js';
import {createEngine} from '../demos/4x-game-lab/voidward/js/core.js';
import {createCampaign,patchFiles,readRows,writeRows,editSetting,editRow,setLane,setLayout,updateHull,updateEmpire,setStartingFleet,exportPack,importPack,exportSDKPack,importSDKPack,diagnosePack} from '../demos/4x-game-lab/voidward/js/workshop.js';
import {inspectWorkbench,importWorkbench,applyWorkbenchHull,exportWorkbenchHull,exportWorkbenchHullBundle,readWorkbenchProject,MAX_HULL_BUNDLE_BYTES,importWorkbenchLayout,exportWorkbenchLayout} from '../demos/4x-game-lab/voidward/js/workbench-bridge.js';
import {parseProject,serializeProject,addMeshAsset,createAssetLibrary,setPlacement} from '../demos/editor/asset-foundry.js';
import {updateEntity} from '../demos/editor/model.js';
const raw=Object.fromEntries(await Promise.all(PACK_FILES.map(async n=>[n+'.txt',await fs.readFile(new URL(`../demos/4x-game-lab/voidward/mods/frontier/${n}.txt`,import.meta.url),'utf8')])));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const objectives='# id | owner | kind | target | amount | requires | branch | title | description | victory\nscout | player | survey | * | 3 | | | Survey | Survey three stars. | 0\nsettle | player | colonies | - | 4 | scout | | Settle | Settle four worlds. | 1\n';
const scenario='playable = 0,1,2\nvictory = objectives\nminVictoryTurn = 12\ndefeatAtLimit = 1\n';

test('legacy packs retain exact original text and content fingerprint without synthetic optional files',()=>{
  const parsed=parsePack(raw);assert.deepEqual(parsed.raw,raw);assert.equal(digest(parsed.raw),digest(raw));
  assert.deepEqual(parsed.scenario,{playable:[0],victory:'legacy',minVictoryTurn:1,defeatAtLimit:false});
  assert.deepEqual(importPack(exportPack(raw)),raw);
});
test('physical file, line and field diagnostics count comments and blank lines',()=>{
  const text='# comment\n\n# another comment\n'+raw['hulls.txt'].split('\n').filter(l=>l&&!l.startsWith('#')).join('\n');
  const rows=text.split('\n'),cells=rows[3].split('|');cells[3]='999';rows[3]=cells.join('|');
  const result=diagnosePack({...raw,'hulls.txt':rows.join('\n')});
  assert.equal(result.ok,false);assert.deepEqual([result.diagnostics[0].file,result.diagnostics[0].line,result.diagnostics[0].field],['hulls.txt',4,'slots']);
  const malformed=diagnosePack({...raw,'map.txt':'# chart\n\nwrong | fields\n'});assert.match(malformed.diagnostics[0].message,/map.txt:3:row/);
});
test('optional scenario, starts, AI, events and prerequisite tables compile to bounded typed data',()=>{
  const p=parsePack({...raw,'scenario.txt':scenario,'objectives.txt':objectives,'dependencies.txt':'weapons | 2 | industry | 2\n','starts.txt':'0 | 500 | 600 | 20 | 25\n','ai.txt':'reserveMinerals = 90\ncolonyShips = 3\n','events.txt':'supply | 3 | scout | resources | player | minerals | 120 | 0\npatrol | 8 | | spawn | 1 | 2 | 5 | 4\n'});
  assert.deepEqual(p.scenario.playable,[0,1,2]);assert.equal(p.scenario.defeatAtLimit,true);assert.equal(p.ai.colonyShips,3);
  assert.deepEqual(p.starts[0].colonies,[25]);assert.deepEqual(p.objectives[1].requires,['scout']);assert.equal(p.events[1].repeat,4);
});
test('invalid prerequisites, unknown targets, unsafe events and overlapping starts are rejected',()=>{
  const invalid=[
    {'dependencies.txt':'weapons | 2 | industry | 2\nindustry | 2 | weapons | 2\n'},
    {'objectives.txt':objectives.replace('3 | | | Survey','3 | settle | | Survey')},
    {'objectives.txt':objectives.replace('scout | | Settle','missing | | Settle')},
    {'events.txt':'bad | 2 | | fetch | 0 | https://example.invalid | 1 | 0\n'},
    {'events.txt':'bad | 2 | | spawn | 1 | 23 | 5 | 0\n'},
    {'events.txt':'bad | 2 | | war | 1 | 1 | 0 | 0\n'},
    {'starts.txt':'0 | 10 | 10 | 10 | 10\n'},
    {'scenario.txt':'playable = 0,0\n'},
    {'scenario.txt':'victory = objectives\n'},
    {'layout.txt':'0 | Infinity | 0\n'},
    {'ai.txt':'execute = alert\n'}
  ];for(const extra of invalid)assert.throws(()=>parsePack({...raw,...extra}));
});
test('workshop edits are atomic: failed graph split and malformed hull leave source unchanged',()=>{
  const before=JSON.stringify(raw);assert.throws(()=>updateHull(raw,'scout-0',{slots:99}));
  const chain=createCampaign(raw,{id:'chain-demo',title:'Chain demo',description:'An authored chain.',columns:6,rows:5,homes:[0,15,29],geography:'chain'});
  assert.throws(()=>setLane(chain,0,1,false),/connected/);assert.equal(JSON.stringify(raw),before);
  const changed=setLane(chain,0,29,true);assert.ok(parsePack(changed).map[0].links.includes(29));assert.ok(parsePack(changed).map[29].links.includes(0));
});
test('create campaign, edit families/fleets/map, export, import and create playable game',()=>{
  let edited=createCampaign(raw,{id:'author-tool-demo',title:'Author tool demo',description:'Built through pure workshop transactions.',columns:6,rows:5,homes:[0,15,29],seed:421,geography:'ring',files:{'scenario.txt':scenario,'objectives.txt':objectives}});
  edited=updateEmpire(edited,0,{short:'MAKERS',ethos:'Build a universe.'});edited=setLayout(edited,0,100,200);
  edited=updateHull(edited,'scout-0',{name:'Workshop courier',shape:[[0,-40],[30,30],[-30,30]]});
  const fleet=readRows(edited,'ships').filter(s=>s.empire==='0');fleet[0].name='Maker One';edited=setStartingFleet(edited,0,fleet);
  const imported=importPack(exportPack(edited)),pack=parsePack(imported),engine=createEngine(pack),state=engine.createGame(421);
  assert.equal(state.systems.length,30);assert.equal(pack.hulls['scout-0'].name,'Workshop courier');assert.equal(state.fleets[0].name,'Maker One');assert.equal(engine.validateState(state),true);
  assert.deepEqual(imported,edited);assert.equal(pack.layout.find(p=>p.id===0).x,100);
});
test('SDK exchange uses actual bounded donor registry and preserves native content',()=>{
  const sdk=exportSDKPack(raw);assert.deepEqual(importSDKPack(sdk),raw);assert.deepEqual(importPack(sdk),raw);
  const wrong=JSON.parse(sdk);wrong.version='9.0.0';assert.throws(()=>importSDKPack(wrong),/identity/);
  wrong.version='1.0.0';wrong.requires=[{id:'uninstalled',version:'1.0.0'}];assert.throws(()=>importSDKPack(wrong),/self-contained/);
  const large={...raw,'system_names.txt':raw['system_names.txt']+'# '+'x'.repeat(9000)};assert.doesNotThrow(()=>exportPack(large));assert.throws(()=>exportSDKPack(large),/string budget/);
});
test('directory import recognizes optional tables without importing JavaScript',async()=>{
  const files={...raw,'scenario.txt':scenario,'objectives.txt':objectives,'hooks.js':'throw new Error("never execute")'};
  const p=await loadDirectory(Object.entries(files).map(([name,value])=>({name,size:Buffer.byteLength(value),text:async()=>value})));
  assert.equal(p.objectives.length,2);assert.equal(Object.hasOwn(p.raw,'hooks.js'),false);
});
test('Workbench Component Forge project and hull projection genuinely roundtrip through donor parser',async()=>{
  const text=await exportWorkbenchHull(raw,'scout-0'),source=parseProject(text);
  assert.equal(source.scene.schemaVersion,2);assert.equal(source.scene.objects[0].components.mesh.enabled,true);
  const choices=inspectWorkbench(text);assert.equal(choices.length,1);
  const result=await importWorkbench(text,{entityId:choices[0].id});assert.ok(result.shape.length>=3);assert.ok(result.warnings.some(s=>s.includes('Convex')));assert.equal(result.shareable,false);
  const edited=applyWorkbenchHull(raw,'scout-0',result),p=parsePack(importPack(exportPack(edited)));
  assert.deepEqual(p.hulls['scout-0'].shape,result.shape);assert.equal(p.provenance[0].sha256,result.provenance[0].sha256);assert.equal(p.provenance[0].license,'OWNER-LOCAL-ONLY');
  assert.equal(createEngine(p).validateState(createEngine(p).createGame()),true);
});
test('Asset Foundry source geometry, licence and digest are retained with deliberate convex projection',async()=>{
  const original=parseProject(await exportWorkbenchHull(raw,'scout-0'));
  const obj='v 0 0 -40\nv 30 0 30\nv 0 0 10\nv -30 0 30\nf 1 2 3 4\n',sha=createHash('sha256').update(obj).digest('hex');
  const mesh=addMeshAsset(createAssetLibrary(),{name:'Original wing',license:'Apache-2.0',sourceName:'original.obj',sourceSha256:sha,text:obj});
  const scene=updateEntity(original.scene,'entity-1',{rotationY:90,scale:[2,1,1]});
  const text=serializeProject(scene,setPlacement(scene,mesh.library,'entity-1',mesh.id));
  const result=await importWorkbench(text,{extent:55});assert.equal(result.shape.length,3,'concave notch is explicitly removed');assert.ok(result.shape.flat().every(n=>Math.abs(n)<=55));
  assert.equal(result.provenance[0].sha256,sha);assert.equal(result.provenance[0].license,'Apache-2.0');assert.equal(result.shareable,true);
});
test('Workbench import refuses scripts, foreign fields, invalid entities and collapsed geometry',async()=>{
  const text=await exportWorkbenchHull(raw,'scout-0'),bad=JSON.parse(text);bad.script='alert(1)';
  await assert.rejects(importWorkbench(JSON.stringify(bad)),/exact fields/);await assert.rejects(importWorkbench(text,{entityId:'missing'}),/valid Workbench entity/);
  await assert.rejects(importWorkbench(text,{extent:61}),/extent/);
  const p=parseProject(text),asset=p.library.assets[0];for(let i=0;i<asset.vertices.length;i+=5)asset.vertices[i+2]=0;
  await assert.rejects(importWorkbench(serializeProject(p.scene,p.library)),/non-degenerate/);
});
test('map layout edits cross actual Workbench project and return unchanged starlanes',()=>{
  let edited=setLayout(raw,0,140,230);const project=exportWorkbenchLayout(edited),p=parseProject(project);
  const scene=updateEntity(p.scene,'entity-1',{position:[310,0,420]});edited=importWorkbenchLayout(edited,serializeProject(scene,p.library));
  assert.deepEqual(parsePack(edited).layout.find(p=>p.id===0),{id:0,x:620,y:840});assert.equal(edited['map.txt'],raw['map.txt']);
  const wrong=updateEntity(scene,'entity-1',{name:'unmapped'});assert.throws(()=>importWorkbenchLayout(raw,serializeProject(wrong,p.library)),/exactly one/);
});

test('structurally impossible resource/archive/owner/branch objectives are rejected before launch',()=>{
  const row=(id,owner,kind,target,amount,requires='',branch='',victory=0)=>`${id} | ${owner} | ${kind} | ${target} | ${amount} | ${requires} | ${branch} | Test | Test objective. | ${victory}\n`;
  const invalid=[
    {'starts.txt':'0 | 1000000 | 0 | 0 |\n'},
    {'objectives.txt':row('bank','player','resources','minerals',1000000)},
    {'objectives.txt':row('archive','player','archives','1',1)},
    {'objectives.txt':row('archive','player','archives','*',64)},
    {'objectives.txt':row('first',1,'survive','-',2)+row('second',0,'survive','-',3,'first')},
    {'scenario.txt':'playable = 0,1\n','objectives.txt':row('first','player','survive','-',2)+row('second','*','survive','-',3,'first')},
    {'objectives.txt':row('first','player','survive','-',2,'','route-one')+row('second','player','survive','-',3,'first','route-two')},
    {'scenario.txt':'playable = 0,1\nvictory = objectives\n','objectives.txt':row('win',0,'survive','-',40,'','',1)}
  ];for(const extra of invalid)assert.throws(()=>parsePack({...raw,...extra}));
  const noArchives={...raw,'map.txt':raw['map.txt'].replace(/\| 1$/gm,'| 0'),'objectives.txt':row('archive','player','archives','*',1)};assert.throws(()=>parsePack(noArchives),/maximum 0/);
  assert.doesNotThrow(()=>parsePack({...raw,'scenario.txt':'playable = 0,1\nvictory = objectives\n','objectives.txt':row('first','*','survive','-',2)+row('finish','player','survive','-',4,'first','',1)}));
});

test('all shipped galaxy layouts fit the Workbench bridge and roundtrip at fixed 2:1 scale',async()=>{
  const {campaigns}=await import('../demos/4x-game-lab/voidward/mods/registry.js');
  for(const c of campaigns.filter(c=>c.files)){
    const files=Object.fromEntries(await Promise.all([...PACK_FILES,...c.files].map(async n=>[n+'.txt',await fs.readFile(new URL(n+'.txt',c.base),'utf8')])));
    const p=parsePack(files),project=exportWorkbenchLayout(files),result=parsePack(importWorkbenchLayout(files,project));
    assert.deepEqual(result.layout,p.layout,c.id);assert.equal(result.raw['map.txt'],p.raw['map.txt']);
  }
});

test('one digest with different source names or licences retains every declaration',async()=>{
  const p=parseProject(await exportWorkbenchHull(raw,'scout-0')),shape='v 0 0 -1\nv 1 0 1\nv -1 0 1\nf 1 2 3\n',sha=createHash('sha256').update(shape).digest('hex');
  const base=p.scene.objects[0];p.scene.objects=[base,{...structuredClone(base),id:'entity-2',parent:base.id},{...structuredClone(base),id:'entity-3',parent:base.id}];p.scene.nextId=4;
  let library=createAssetLibrary();
  for(const [i,sourceName,license]of [[0,'wing.obj','MIT'],[1,'wing.obj','CC-BY-4.0'],[2,'renamed-wing.obj','MIT']]){
    const mesh=addMeshAsset(library,{name:'Wing',license,sourceName,sourceSha256:sha,text:shape});library=setPlacement(p.scene,mesh.library,`entity-${i+1}`,mesh.id);
  }
  const result=await importWorkbench(serializeProject(p.scene,library),{entityId:'entity-1'});
  assert.deepEqual(result.provenance.map(r=>[r.source,r.license]),[['wing.obj','MIT'],['wing.obj','CC-BY-4.0'],['renamed-wing.obj','MIT']]);
  assert.equal(result.shareable,true);
});

test('mixed mesh and primitive hulls retain project attribution and stay owner-local',async()=>{
  const p=parseProject(await exportWorkbenchHull(raw,'scout-0'));p.library.assets[0].license='MIT';
  p.scene.objects.push({...structuredClone(p.scene.objects[0]),id:'entity-2',parent:'entity-1',position:[100,0,0]});p.scene.nextId=3;
  const text=serializeProject(p.scene,p.library),result=await importWorkbench(text,{entityId:'entity-1'});
  assert.equal(result.provenance.length,2);assert.equal(result.provenance[0].license,'MIT');
  assert.equal(result.provenance[1].source,'workbench-project.json');assert.equal(result.provenance[1].sha256,createHash('sha256').update(text).digest('hex'));assert.equal(result.shareable,false);
});

test('lossless hull bundles preserve all source and operation records through native geometry exchange',async()=>{
  const provenance=Array.from({length:3},(_,i)=>({hull:'scout-0',source:i===2?'original-'.repeat(10)+'wing.obj':'wing.obj',sha256:'a'.repeat(64),license:i===1?'CC-BY-4.0':'MIT',operation:`Original operation ${i}; retained without rewriting.`}));
  const edited=writeRows(raw,'provenance',provenance),text=await exportWorkbenchHullBundle(edited,'scout-0'),bundle=JSON.parse(text);
  assert.equal(parseProject(bundle.project).scene.schemaVersion,2,'embedded project remains an ordinary native project');
  assert.deepEqual(readWorkbenchProject(text).provenance,provenance);assert.equal(inspectWorkbench(text).length,1);
  const projected=await importWorkbench(text),roundtrip=applyWorkbenchHull(edited,'scout-0',projected);
  assert.deepEqual(parsePack(roundtrip).provenance,provenance);assert.equal(projected.shareable,true);
  await assert.rejects(exportWorkbenchHull(edited,'scout-0'),/lossless hull bundle/);
  const bad={...bundle,script:'throw new Error("never execute")'};assert.throws(()=>readWorkbenchProject(JSON.stringify(bad)),/fields/);
  bad.script=undefined;delete bad.script;bad.provenance[0].operation='invalid\nrow';assert.throws(()=>readWorkbenchProject(JSON.stringify(bad)),/provenance/);
  assert.throws(()=>readWorkbenchProject(' '.repeat(MAX_HULL_BUNDLE_BYTES+1)),/512 KiB/);
});
