// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {WebGLAPI} from '../api/webgl/index.js';

const verts=()=>new Float32Array([
  -.7,-.7,0,1,0,0, .7,-.7,0,0,1,0, 0,.7,0,0,0,1
]);

function device(){
  const live=new Set(),calls={data:[],sub:[],draw:[],bind:[],pointer:[],
    uniforms:[],viewport:[],clear:0,program:0,deleted:0};
  let bound=null,pointing=null,lastProgram=null;
  const gl={
    ARRAY_BUFFER:1,DYNAMIC_DRAW:2,TRIANGLES:3,LINES:4,POINTS:5,FLOAT:6,
    VERTEX_SHADER:7,FRAGMENT_SHADER:8,COMPILE_STATUS:9,LINK_STATUS:10,
    DEPTH_TEST:11,COLOR_BUFFER_BIT:0x4000,DEPTH_BUFFER_BIT:0x100,
    createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
    getShaderInfoLog:()=>'',deleteShader(){},createProgram:()=>({}),attachShader(){},
    linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',deleteProgram(){calls.deleted++;},
    getAttribLocation:(_,name)=>name==='position'?0:1,getUniformLocation:(_,name)=>({name}),
    useProgram(p){lastProgram=p;calls.program++;},enable(){},clearColor(){},
    uniformMatrix4fv(_,transpose,v){assert.equal(transpose,false);calls.uniforms.push(['matrix',Array.from(v)]);},
    uniform1f(location,value){calls.uniforms.push([location.name,value]);},
    viewport(...args){calls.viewport.push(args);},clear(){calls.clear++;},
    createBuffer(){const b={data:new Float32Array(0)};live.add(b);return b;},
    bindBuffer(_,buffer){assert.ok(live.has(buffer));bound=buffer;calls.bind.push(buffer);},
    bufferData(_,value){
      if(gl.fail)throw Error('GPU upload failed');
      assert.ok(bound);bound.data=new Float32Array(value);calls.data.push(value.byteLength);
    },
    bufferSubData(_,offset,value){
      if(gl.fail)throw Error('GPU upload failed');
      assert.ok(bound);assert.ok(offset+value.byteLength<=bound.data.byteLength);
      bound.data.set(value,offset/4);calls.sub.push({offset,bytes:value.byteLength,source:value});
    },
    deleteBuffer(buffer){assert.ok(live.delete(buffer));calls.deleted++;},
    enableVertexAttribArray(){},
    vertexAttribPointer(index,components,type,normalized,stride,offset){
      assert.equal(components,3);assert.equal(type,gl.FLOAT);
      assert.equal(normalized,false);assert.equal(stride,24);
      calls.pointer.push({buffer:bound,index,offset});pointing=bound;
    },
    drawArrays(mode,first,count){
      assert.ok(lastProgram&&pointing===bound);
      calls.draw.push({mode,first,count,bytes:Array.from(bound.data.slice(0,count*6))});
    }
  };
  return {gl,calls,live,canvas:{width:384,height:256,getContext(name){assert.equal(name,'webgl');return gl;}}};
}
const begin=api=>api.beginFrame({vp:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])});
test('cold upload, exact upload reuse and bounded growth/shrink/empty semantics',()=>{
  const d=device(),api=new WebGLAPI(d.canvas),source=verts();
  const mesh=api.createMesh(source);
  assert.equal(d.calls.data.length,1);
  assert.equal(api.updateMesh(mesh,source),false);
  const changed=source.slice();changed[0]=.2;
  assert.equal(api.updateMesh(mesh,changed),true);
  assert.equal(d.calls.data.length,1);assert.equal(d.calls.sub.length,1);
  assert.equal(api.updateMesh(mesh,changed),false);
  const grown=new Float32Array(30).fill(.25);
  api.updateMesh(mesh,grown);
  assert.equal(d.calls.data.length,2);
  api.updateMesh(mesh,new Float32Array(6).fill(.5));
  assert.equal(d.calls.sub.length,2);
  api.updateMesh(mesh,[]);
  begin(api);assert.equal(api.draw(mesh),false);api.endFrame();
  api.updateMesh(mesh,source);
  begin(api);api.draw(mesh);api.endFrame();
  assert.equal(d.calls.draw.at(-1).count,3);
  assert.deepEqual(d.calls.draw.at(-1).bytes,Array.from(source));
  const stats=api.stats();assert.equal(stats.skippedIdentical,2);
  assert.equal(stats.bufferData,2);
  assert.equal(stats.liveMeshes,1);
  assert.equal(stats.uploadedBytes,source.byteLength+changed.byteLength+
    grown.byteLength+6*4+source.byteLength);
  api.dispose();assert.equal(d.live.size,0);assert.equal(d.calls.deleted,2);
  assert.throws(()=>api.createMesh(source),/disposed/);
});

test('typed subviews upload directly, but mutable views do not forge cache hits',()=>{
  const d=device(),api=new WebGLAPI(d.canvas);
  const raw=new Float32Array(30).fill(0),view=raw.subarray(6,24);
  const handle=api.createMesh(view);
  assert.equal(api.updateMesh(handle,view),false);
  view[5]=1;
  assert.equal(api.updateMesh(handle,view),true);
  assert.equal(d.calls.sub.at(-1).source,view);
  const expected=Array.from(view);
  view.fill(9);
  begin(api);api.draw(handle);api.endFrame();
  assert.deepEqual(d.calls.draw.at(-1).bytes,expected);
  api.dispose();
});

test('partial-range updates skip unchanged bytes, leave other vertices intact and reject stale tails',()=>{
  const d=device(),api=new WebGLAPI(d.canvas),handle=api.createMesh(verts());
  const patch=new Float32Array(6).fill(.125);
  assert.equal(api.updateRange(handle,1,patch),true);
  assert.equal(api.updateRange(handle,1,patch),false);
  begin(api);api.draw(handle);api.endFrame();
  const expected=verts();expected.set(patch,6);
  assert.deepEqual(d.calls.draw.at(-1).bytes,Array.from(expected));
  assert.equal(d.calls.sub.length,1);assert.equal(d.calls.sub[0].offset,24);
  for(const [first,values] of [[-1,patch],[4,[]],[2,new Float32Array(12)],[.5,patch]]){
    assert.throws(()=>api.updateRange(handle,first,values),RangeError);
  }
  const snap=Array.from(d.calls.draw.at(-1).bytes);
  assert.throws(()=>api.updateRange(handle,0,new Float32Array(5)),RangeError);
  begin(api);api.draw(handle);api.endFrame();
  assert.deepEqual(d.calls.draw.at(-1).bytes,snap);
  api.updateMesh(handle,new Float32Array(6));
  assert.throws(()=>api.updateRange(handle,1,patch),RangeError);
  api.dispose();
});

test('failed uploads do not bless CPU snapshots; recovery republishes before draws',()=>{
  const d=device(),api=new WebGLAPI(d.canvas),handle=api.createMesh(verts());
  d.gl.fail=true;
  assert.throws(()=>api.updateMesh(handle,new Float32Array(12).fill(.1)),/GPU upload failed/);
  begin(api);assert.throws(()=>api.draw(handle),/recover/);api.endFrame();
  d.gl.fail=false;
  assert.equal(api.updateMesh(handle,verts()),true,'dirty state must not skip even if source bytes match');
  begin(api);api.draw(handle);api.endFrame();
  assert.equal(d.calls.data.length,2,'dirty recovery forces full upload');
  const patch=new Float32Array(6).fill(.33);
  d.gl.fail=true;
  assert.throws(()=>api.updateRange(handle,1,patch),/GPU upload failed/);
  d.gl.fail=false;
  assert.equal(api.updateRange(handle,1,patch),true);
  assert.equal(d.calls.data.length,3,'partial failure requires full mirror restore');
  begin(api);api.draw(handle);api.endFrame();
  const expected=verts();expected.set(patch,6);
  assert.deepEqual(d.calls.draw.at(-1).bytes,Array.from(expected));
  api.dispose();
});

test('rendering state caches uniforms/program/viewport and still clear every frame',()=>{
  const d=device(),api=new WebGLAPI(d.canvas),mesh=api.createMesh(verts());
  begin(api);api.draw(mesh);api.draw(mesh);api.endFrame();
  const first=api.stats(),firstPointers=d.calls.pointer.length;
  begin(api);api.draw(mesh);api.endFrame();
  assert.equal(api.stats().programBinds,1);
  assert.equal(api.stats().uniformUploads,3);
  assert.equal(api.stats().viewportCalls,1);
  assert.equal(api.stats().clearCalls,2);
  assert.equal(d.calls.pointer.length,firstPointers);
  assert.equal(api.stats().drawCalls,3);
  d.canvas.width=512;
  begin(api);api.draw(mesh);api.endFrame();
  assert.equal(api.stats().viewportCalls,2);
  const view=new Float32Array(16);view[0]=1;view[5]=1;view[10]=1;view[15]=1;
  view[12]=.2;
  api.beginFrame({vp:view,fog:.3,pointSize:3});api.draw(mesh);api.endFrame();
  assert.equal(api.stats().uniformUploads,6);
  view[12]=.4;
  api.beginFrame({vp:view,fog:.3,pointSize:3});api.draw(mesh);api.endFrame();
  assert.equal(api.stats().uniformUploads,7,'in-place vp mutation invalidates matrix cache');
  api.invalidateState();
  begin(api);api.draw(mesh);api.endFrame();
  assert.equal(api.stats().programBinds,2);
  assert.ok(d.calls.pointer.length>firstPointers);
  assert.deepEqual(first.drawCalls,2);
  api.dispose();
});

test('mesh and vertex-attribute binding caches are independent across range writes',()=>{
  const d=device(),api=new WebGLAPI(d.canvas);
  const a=api.createMesh(verts()),b=api.createMesh(verts(),'lines');
  begin(api);api.draw(a);api.draw(b);
  api.updateRange(a,0,new Float32Array(6).fill(.25));
  // Buffer a is bound by upload, but attrib pointer still refers to b.
  api.draw(a);api.endFrame();
  assert.equal(d.calls.draw.length,3);
  assert.equal(d.calls.draw[2].mode,d.gl.TRIANGLES);
  assert.ok(d.calls.pointer.length>=6);
  api.dispose();
});

test('strict validation rejects malformed data without changing GPU state',()=>{
  const d=device(),api=new WebGLAPI(d.canvas);
  assert.throws(()=>api.createMesh([1,2,3]),RangeError);
  assert.throws(()=>api.createMesh([0,0,0,1,1,Infinity]),RangeError);
  assert.throws(()=>api.createMesh([0,0,0,1,1,1],'quads'),RangeError);
  assert.throws(()=>api.createMesh('bad'),TypeError);
  const mesh=api.createMesh(verts());
  const prior=api.stats(),native=Array.from(d.calls.draw);
  assert.throws(()=>api.updateMesh(mesh,[0,0,0,1,'0',1]),RangeError);
  assert.throws(()=>api.updateMesh(mesh,new Float32Array(7)),RangeError);
  assert.throws(()=>api.beginFrame({vp:new Float32Array(15)}),RangeError);
  assert.throws(()=>api.beginFrame({fog:-1}),RangeError);
  assert.throws(()=>api.draw(mesh),/beginFrame required/);
  assert.equal(api.stats().bufferData,prior.bufferData);
  assert.deepEqual(d.calls.draw,native);
  const other=new WebGLAPI(device().canvas),foreign=other.createMesh(verts());
  assert.throws(()=>api.draw(foreign),/foreign/);
  api.deleteMesh(mesh);assert.throws(()=>api.updateMesh(mesh,verts()),/foreign/);
  other.dispose();api.dispose();
});

test('unsupported WebGL, shader compile and context loss reject instead of replacing GPU',()=>{
  assert.throws(()=>new WebGLAPI({getContext:()=>null}),/WebGL1 unavailable/);
  const d=device();
  d.gl.getShaderParameter=()=>false;
  assert.throws(()=>new WebGLAPI(d.canvas),/compilation failed/);
  const q=device(),api=new WebGLAPI(q.canvas);
  q.gl.isContextLost=()=>true;
  assert.throws(()=>api.createMesh(verts()),/context lost/);
  q.gl.isContextLost=()=>false;api.dispose();
});
