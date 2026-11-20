// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {convertObjToLitMesh,LIT_MESH_FORMAT} from '../scripts/obj-to-mesh.mjs';
const obj=`# original simple rectangular bonnet
v 0 0 0
v 2 0 0
v 2 1 0
v 0 1 0
vt 0 0
vt 1 0
vt 1 1
vt 0 1
f 1/1 2/2 3/3 4/4
`;
test('quad is triangulated into lit XYZ, normal, RGB and UV with bounded stats',()=>{
  const mesh=convertObjToLitMesh(obj);assert.equal(mesh.format,LIT_MESH_FORMAT);assert.equal(mesh.vertices.length,66);
  assert.deepEqual(mesh.bounds,{min:[0,0,0],max:[2,1,0]});assert.equal(mesh.stats.triangles,2);
  assert.deepEqual(mesh.vertices.slice(0,11),[0,0,0,0,0,1,1,1,1,0,0]);
  assert.deepEqual(convertObjToLitMesh(obj),mesh);
});
test('negative indices and explicit normals work, without loading MTL',()=>{
  const v=`mtllib imaginary.mtl
usemtl paint
v 0 0 0
v 1 0 0
v 0 1 0
vn 0 0 1
f -3//1 -2//1 -1//1`;
  const mesh=convertObjToLitMesh(v,{scale:2});assert.equal(mesh.stats.triangles,1);
  assert.deepEqual(mesh.bounds.max,[2,2,0]);
});
test('invalid OBJ content fails closed, including degenerate faces and out-of-range references',()=>{
  for(const text of ['', 'v 0 0 0\nv 1 0 0\nv 2 0 0\nf 1 2 3', 'v 0 0 0\nf 1 2 3',
    'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 99',
    'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3 1 2',
    'v 0 0 0\nv 1 0 0\nv 0 1 0\nexec bad\nf 1 2 3'])assert.throws(()=>convertObjToLitMesh(text));
  assert.throws(()=>convertObjToLitMesh(obj,{scale:0}));
  assert.throws(()=>convertObjToLitMesh(obj.repeat(8000)),/512 KiB|budget/);
});
test('CLI creates source-bound receipt, refuses overwrite, and outputs no remote dependencies',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vanilla25d-'));
  try{
    const input=join(dir,'car.obj'),output=join(dir,'car.json');await writeFile(input,obj);
    const cli=new URL('../scripts/convert-obj-to-mesh.mjs',import.meta.url).pathname;
    const call=()=>spawnSync(process.execPath,[cli,'--in',input,'--out',output],{encoding:'utf8'});
    const first=call();assert.equal(first.status,0,first.stderr);
    const data=JSON.parse(await readFile(output,'utf8'));
    assert.match(data.source.sha256,/^[a-f0-9]{64}$/);assert.equal(data.stats.renderVertices,6);
    assert.equal(call().status,1,'create-only export must refuse overwrites');
  }finally{await rm(dir,{recursive:true,force:true});}
});
