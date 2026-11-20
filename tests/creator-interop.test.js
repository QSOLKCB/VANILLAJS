// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneGraph} from '../modules/scene-graph/index.js';
import {querySight} from '../modules/sensing/index.js';
import {createTacticsState} from '../modules/tactics/index.js';
import {CREATOR_FORMAT,createCreatorProject,creatorCADAsset,createCreatorSightWorld,createCreatorTacticsWorld,
 sealCreatorPackage,creatorPackageJSON,openCreatorPackage,CREATOR_LIMITS,CREATOR_PACKAGE} from '../modules/creator-interop/index.js';
const p=()=>({format:CREATOR_FORMAT,version:1,name:'Workshop',scene:createSceneGraph('Workshop'),
 assets:[{id:'mesh-1',dimension:'2d',vertices:[[0,0,0],[1,0,0],[0,1,0]],
 triangles:[[0,1,2]],origin:'original',license:'Apache-2.0',sourceRef:'original:qsol'}],
 placements:[{id:'prop-1',kind:'prop',assetId:'mesh-1',position:[1,1,-2]},
 {id:'target-1',kind:'target',assetId:null,position:[9,1,-2]}],
 zones:[{id:'wall-1',kind:'occluder',min:[3,0,-3],max:[4,4,-1]}],
 tactical:{width:12,height:10,cellMetres:2,cover:[{id:'cover-1',x:3,z:3,w:1,h:1,height:2}],
 units:[{id:'alpha-1',team:'alpha',cell:[1,1],heading:[1,0]},
 {id:'bravo-1',team:'bravo',cell:[8,7],heading:[-1,0]}],objective:[10,5],seed:3}});
test('strict native scene, SENSE occlusion and tactical adapter are real engine authorities',()=>{
 const project=createCreatorProject(p());
 assert.ok(Object.isFrozen(project.assets[0].vertices[0]));
 const report=querySight(createCreatorSightWorld(project),
  {position:[0,1,-2],direction:[1,0,0]},{range:30,fov:Math.PI});
 assert.equal(report[0].reason,'occluded');assert.equal(report[0].occluderId,'wall-1');
 assert.equal(createTacticsState(createCreatorTacticsWorld(project)).turn,0);
});
test('optional tactical sidecar remains optional at the creator boundary',()=>{
 const project=createCreatorProject({...p(),tactical:null});
 assert.equal(project.tactical,null);
 const report=querySight(createCreatorSightWorld(project),
  {position:[0,1,-2],direction:[1,0,0]},{range:30,fov:Math.PI});
 assert.equal(report.length,1);
 assert.throws(()=>createCreatorTacticsWorld(project),/no tactical scenario/);
});
test('reproducible offline SHA256 package and exact import round trip',async()=>{
 const source=p(),before=structuredClone(source);
 const one=await sealCreatorPackage(source),two=await sealCreatorPackage(source);
 assert.deepEqual(one,two);assert.deepEqual(source,before);
 const text=creatorPackageJSON(one);
 assert.deepEqual(await openCreatorPackage(text),one.project);
 assert.match(one.sha256,/^[0-9a-f]{64}$/);
 const tampered=JSON.parse(text);tampered.project.placements[0].position=[10,1,-2];
 await assert.rejects(openCreatorPackage(JSON.stringify(tampered)),/integrity mismatch/);
});
test('bad asset hashes, version, malformed package and executable data reject atomically',async()=>{
 const seed=p(),ok=await sealCreatorPackage(seed),bad=structuredClone(ok);
 bad.hashes[0].sha256='0'.repeat(64);
 await assert.rejects(openCreatorPackage(JSON.stringify(bad)),/integrity mismatch/);
 assert.throws(()=>createCreatorProject({...seed,version:99}),/unsupported/);
 assert.throws(()=>createCreatorProject({...seed,assets:[{...seed.assets[0],vertices:[[0,0,0],[1,0,0],[0,1,2]]}]}),/2d asset/);
 assert.throws(()=>createCreatorProject({...seed,assets:[{...seed.assets[0],vertices:[[0,0,0],[1,0,0],[2,0,0]]}]}),/nondegenerate/);
 assert.throws(()=>createCreatorProject({...seed,placements:[{...seed.placements[0],assetId:'missing'}]}),/unresolved/);
 assert.throws(()=>createCreatorProject({...seed,assets:[{...seed.assets[0],get vertices(){throw Error('unsafe');}}]}),/non-executable/);
 assert.throws(()=>createCreatorProject({...seed,zones:[{...seed.zones[0],max:[3,2,-1]}]}),/positive/);
 await assert.rejects(openCreatorPackage('x'.repeat(262145)),/bounded/);
 await assert.rejects(openCreatorPackage('{"format":"oops"}'),/exact/);
});
test('duplicate IDs and invalid tactical occupancy cannot cross authoring boundary',()=>{
 const seed=p();
 assert.throws(()=>createCreatorProject({...seed,zones:[{...seed.zones[0],id:'target-1'}]}),/distinct/);
 const tactical=structuredClone(seed.tactical);
 tactical.cover.push({id:'bad',x:1,z:1,w:1,h:1,height:2});
 assert.throws(()=>createCreatorProject({...seed,tactical}),/walkable/);
});

test('real CAD-003 tower geometry becomes a distinct portable indexed asset',()=>{
 const generated=creatorCADAsset({id:'cad-1',kind:'tower',
   options:{width:2,depth:2,height:3,bevel:.2}});
 assert.equal(generated.dimension,'3d');assert.equal(generated.origin,'original');
 assert.ok(generated.vertices.length>=8&&generated.triangles.length>=12);
 assert.ok(generated.vertices.length<generated.triangles.length*3);
 const seed=p();const project=createCreatorProject({...seed,assets:[...seed.assets,generated],
   placements:[...seed.placements,{id:'tower-1',kind:'prop',assetId:'cad-1',position:[3,1,-9]}]});
 assert.equal(project.assets.length,2);
 assert.throws(()=>creatorCADAsset({id:'bad',kind:'tower',options:{width:2,depth:2,height:3,
   get bevel(){throw Error('not executable');}}}),/non-executable/);
});

test('exact 256 KiB serialized package boundary never appends unbudgeted bytes',()=>{
 const mock={format:CREATOR_PACKAGE,project:{padding:''},hashes:[],sha256:'a'.repeat(64)};
 mock.project.padding='x'.repeat(CREATOR_LIMITS.bytes-Buffer.byteLength(JSON.stringify(mock)));
 const serialized=creatorPackageJSON(mock);
 assert.equal(Buffer.byteLength(serialized),CREATOR_LIMITS.bytes);
 assert.equal(serialized.endsWith(String.fromCharCode(10)),false);
 assert.throws(()=>creatorPackageJSON({...mock,project:{padding:mock.project.padding+'x'}}),/byte limit/);
});
