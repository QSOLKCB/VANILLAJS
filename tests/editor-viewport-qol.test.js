// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {frameCamera,cameraMatrix,createSceneVertices,sceneResourceBudget} from '../demos/editor/viewport.js';

const camera={yaw:38,pitch:23,distance:18,target:[0,1,0]};
const box=(id,position=[0,0,0],scale=[1,1,1],parent=null)=>({
  id,parent,position,scale,visible:true,rotationY:0,color:[.3,.6,.9]});
const visibleInFrame=(camera,points,width,height)=>{
  const matrix=cameraMatrix(camera,width,height);
  for(const point of points){
    const p=[...point,1],clip=Array.from({length:4},(_,r)=>
      p.reduce((sum,v,c)=>sum+matrix[c*4+r]*v,0));
    assert.ok(clip[3]>0,'point is in front of the camera');
    for(let i=0;i<3;i++)assert.ok(Math.abs(clip[i]/clip[3])<1,
      'point is inside the '+['horizontal','vertical','depth'][i]+' clipping planes');
  }
};
test('framing a rotated selection fits every corner in portrait and landscape',()=>{
  const entity={...box('entity-1',[800,12,-500],[12,4,8]),rotationY:45},
    angle=Math.PI/4,c=Math.cos(angle),s=Math.sin(angle),points=[];
  for(const x of [-6,6])for(const y of [-2,2])for(const z of [-4,4])
    points.push([800+c*x+s*z,12+y,-500-s*x+c*z]);
  const before=structuredClone({camera,entity});
  for(const [width,height] of [[1200,600],[300,900]]){
    const framed=frameCamera(camera,[entity],entity.id,width,height);
    assert.deepEqual(framed.target,entity.position);
    assert.equal(framed.yaw,camera.yaw);assert.equal(framed.pitch,camera.pitch);
    visibleInFrame(framed,points,width,height);
  }
  assert.deepEqual({camera,entity},before,'framing never mutates authoring/camera inputs');
});
test('selection framing includes descendants and ignores unrelated or hidden objects',()=>{
  const world=[box('entity-1'),box('entity-2',[10,0,0],[1,1,1],'entity-1'),
    box('entity-3',[-900,0,0]),{...box('entity-4',[800,0,0]),visible:false}];
  const selected=frameCamera(camera,world,'entity-1',800,600);
  assert.deepEqual(selected.target,[5,0,0]);
  const all=frameCamera(camera,world,null,800,600);
  assert.deepEqual(all.target,[-445,0,0]);
  assert.deepEqual(frameCamera(camera,world,'entity-4').target,[800,0,0]);
});
test('empty framing preserves view and invalid dimensions are refused',()=>{
  const result=frameCamera(camera,[]);
  assert.deepEqual(result,camera);assert.notEqual(result.target,camera.target);
  assert.deepEqual(frameCamera(camera,[box('entity-1')],'missing'),camera);
  assert.throws(()=>frameCamera(camera,[],null,0,400),RangeError);
  assert.throws(()=>frameCamera(camera,[],null,400,NaN),RangeError);
});
const library=()=>({schemaVersion:1,nextId:4,assets:[
  {id:'asset-1',kind:'mesh',name:'Wide triangle',license:'OWNER-LOCAL-ONLY',
    sourceName:'wide.obj',sourceSha256:'a'.repeat(64),
    vertices:[-100,0,0,0,0,100,0,0,1,0,0,100,0,.5,1]},
  {id:'asset-2',kind:'texture',name:'Pixel',license:'OWNER-LOCAL-ONLY',
    sourceName:'pixel.png',sourceSha256:'b'.repeat(64),width:1,height:1,
    rgba:Buffer.from([255,128,64,255]).toString('base64')},
  {id:'asset-3',kind:'material',name:'Material',license:'OWNER-LOCAL-ONLY',
    color:[1,.5,.25],textureId:'asset-2'}],
  placements:[1,2,3].map(i=>({entityId:'entity-'+i,meshId:'asset-1',materialId:'asset-3'}))});
test('framing uses imported mesh extents and expands depth clipping for large worlds',()=>{
  const world=[box('entity-1',[1000,0,0],[100,100,100])],assets=library(),
    framed=frameCamera(camera,world,'entity-1',500,800,assets);
  assert.deepEqual(framed.target,[1000,5000,0]);assert.ok(framed.distance>300);
  visibleInFrame(framed,[[-9000,0,0],[11000,0,0],[1000,10000,0]],500,800);
});
test('shared texture batching preserves exact vertex bytes and refreshes edited pixels',()=>{
  const world=[box('entity-1'),box('entity-2',[3,4,5]),box('entity-3',[-4,2,1])],
    assets=library(),combined=createSceneVertices(world,'entity-2',assets),
    singles=world.map(e=>createSceneVertices([e],'entity-2',assets)),
    expected=new Float32Array(singles.flatMap(a=>[...a]));
  assert.deepEqual(new Uint8Array(combined.buffer),new Uint8Array(expected.buffer));
  assert.deepEqual([...combined.slice(3,6)], [...new Float32Array([1,.5*128/255,.25*64/255])]);
  const budget=sceneResourceBudget(world,assets);
  assert.equal(budget.vertexBytes,3*3*6*4);
  assets.assets[1].rgba=Buffer.from([0,255,128,255]).toString('base64');
  assert.notDeepEqual(createSceneVertices(world,'entity-2',assets),combined,
    'per-call caching never hides a texture update');
  assets.assets[1].rgba=Buffer.from([0,255,128,0]).toString('base64');
  assert.throws(()=>sceneResourceBudget(world,assets),/alpha textures unsupported/,
    'budget-only preparation retains asset validation');
});
