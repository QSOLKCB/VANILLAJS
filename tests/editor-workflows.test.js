// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {hierarchyRows,eligibleParents,matchesAsset} from '../demos/editor/workflows.js';
const objects=[
  {id:'entity-1',parent:null,name:'Root',body:'static'},
  {id:'entity-2',parent:'entity-1',name:'Child',body:'static'},
  {id:'entity-3',parent:'entity-2',name:'Beacon',body:'static'},
  {id:'entity-4',parent:null,name:'Player',body:'player'}
];
test('hierarchy search retains ancestors, order, depths, and matches IDs/body',()=>{
  assert.deepEqual(hierarchyRows(objects,' BEACON ').map(({object,depth})=>[object.id,depth]),[['entity-1',0],['entity-2',1],['entity-3',2]]);
  assert.deepEqual(hierarchyRows(objects,'entity-4').map(row=>row.object.id),['entity-4']);
  assert.equal(hierarchyRows(objects,'player').length,1);
  assert.equal(hierarchyRows(objects,'missing').length,0);
  assert.equal(hierarchyRows(objects).length,4);
});
test('parent candidates exclude self and all descendants without losing unrelated roots',()=>{
  assert.deepEqual(eligibleParents(objects,'entity-1').map(object=>object.id),['entity-4']);
  assert.deepEqual(eligibleParents(objects,'entity-2').map(object=>object.id),['entity-1','entity-4']);
});
test('asset filtering works for kind/name/id and empty search',()=>{
  const asset={id:'asset-1',name:'Alien wing',kind:'mesh'};
  for(const query of ['',' MESH ','wing','asset-1'])assert.equal(matchesAsset(asset,query),true);
  assert.equal(matchesAsset(asset,'prefab'),false);
});
