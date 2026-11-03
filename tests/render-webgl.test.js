import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../modules/render-webgl/index.js';

// Model the externally observable WebGL buffer/draw contract, including stale tails.
function device(){
  let bound;const live=new Set(),calls={allocations:0,writes:0,deleted:0,draws:[]};
  const gl={ARRAY_BUFFER:1,STATIC_DRAW:2,DYNAMIC_DRAW:3,LINES:4,POINTS:5,TRIANGLES:6,
    FLOAT:7,VERTEX_SHADER:8,FRAGMENT_SHADER:9,COMPILE_STATUS:10,LINK_STATUS:11,DEPTH_TEST:12,
    createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
    createProgram:()=>({}),attachShader(){},linkProgram(){},deleteShader(){},getProgramParameter:()=>true,
    useProgram(){},getAttribLocation:()=>0,getUniformLocation:()=>({}),enable(){},clearColor(){},deleteProgram(){},
    createBuffer(){const b={data:new Float32Array()};live.add(b);return b;},
    bindBuffer(_,b){assert.ok(live.has(b));bound=b;},
    bufferData(_,data){if(gl.fail)throw new Error('upload failed');bound.data=new Float32Array(data);calls.allocations++;},
    bufferSubData(_,offset,data){if(gl.fail)throw new Error('upload failed');assert.ok(offset+data.byteLength<=bound.data.byteLength);bound.data.set(data,offset/4);calls.writes++;},
    deleteBuffer(b){assert.ok(live.delete(b));calls.deleted++;},
    enableVertexAttribArray(){},vertexAttribPointer(){},
    drawArrays(mode,first,count){calls.draws.push({mode,count,values:Array.from(bound.data.slice(first*6,(first+count)*6))});}
  };
  return {gl,calls,live,canvas:{getContext:()=>gl}};
}
const vertices=n=>Array.from({length:n*6},(_,i)=>(i-3)/7);

test('Renderer retains exact draw output across grow, shrink, empty and typed subview updates',()=>{
  const d=device(),r=new Renderer(d.canvas),m=r.mesh(vertices(1),'lines');
  const samples=[vertices(3),vertices(2),[],new Float32Array(vertices(5)).subarray(6,24)];
  for(const values of samples){r.update(m,values);r.draw(m);assert.deepEqual(d.calls.draws.at(-1),{mode:d.gl.LINES,count:values.length/6,values:Array.from(new Float32Array(values))});}
  assert.equal(d.calls.allocations,2);assert.equal(d.calls.writes,2);assert.equal(m.buffer.data.length,18);
  samples.at(-1).fill(99);r.draw(m);assert.notEqual(d.calls.draws.at(-1).values[0],99,'uploads own their Float32 bytes');
});
test('Empty initial buffers grow independently; clear/dispose release all capacity and reject stale handles',()=>{
  const d=device(),r=new Renderer(d.canvas),a=r.mesh([]),b=r.mesh([],'points');
  r.update(a,vertices(2));r.update(b,vertices(1));r.draw(a);r.draw(b);
  assert.equal(d.calls.draws[0].count,2);assert.equal(d.calls.draws[1].mode,d.gl.POINTS);
  const foreign=new Renderer(device().canvas).mesh([]);assert.throws(()=>r.update(foreign,vertices(1)),/not owned/);
  r.clearMeshes();assert.equal(d.live.size,0);assert.throws(()=>r.update(a,vertices(1)),/not owned/);
  r.mesh(vertices(3));r.dispose();assert.equal(d.live.size,0);assert.equal(d.calls.deleted,3);
});
test('Failed upload does not bless capacity or change draw count; the next attempt retries growth',()=>{
  const d=device(),r=new Renderer(d.canvas),m=r.mesh(vertices(1));d.gl.fail=true;
  assert.throws(()=>r.update(m,vertices(3)),/upload failed/);assert.equal(m.count,1);assert.equal(d.calls.allocations,1);
  d.gl.fail=false;r.update(m,vertices(3));assert.equal(d.calls.allocations,2);assert.equal(m.count,3);
  r.draw(m);assert.deepEqual(d.calls.draws.at(-1).values,Array.from(new Float32Array(vertices(3))));
});
