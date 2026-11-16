// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {LitRenderer,LIT_PROFILES,validateLitMaterial,litNormalMatrix} from '../modules/render-lit/index.js';
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const triangle=()=>new Float32Array([-1,-1,0,0,0,1,1,.5,.2,0,0, 1,-1,0,0,0,1,1,.5,.2,1,0, 0,1,0,0,0,1,1,.5,.2,.5,1]);
function device(fault={}){
  let bound=null,current=null,next=0,error=0;const buffers=new Set(),programs=new Set(),shaders=new Set(),events=new Map(),calls={uploads:0,draws:[],uniforms:[],resizes:0};
  const gl={ARRAY_BUFFER:1,STATIC_DRAW:2,TRIANGLES:3,FLOAT:4,VERTEX_SHADER:5,FRAGMENT_SHADER:6,COMPILE_STATUS:7,LINK_STATUS:8,DEPTH_TEST:9,BLEND:10,CULL_FACE:11,SCISSOR_TEST:12,COLOR_BUFFER_BIT:16,DEPTH_BUFFER_BIT:32,LEQUAL:20,SRC_ALPHA:21,ONE_MINUS_SRC_ALPHA:22,NO_ERROR:0,
    createShader(){if(fault.shaderAlloc)return null;const s={id:next++};shaders.add(s);return s;},shaderSource(){},compileShader(){},getShaderParameter:()=>!fault.compile,getShaderInfoLog:()=>'injected compile failure',deleteShader:s=>assert.ok(shaders.delete(s)),
    createProgram(){if(fault.programAlloc)return null;const p={id:next++};programs.add(p);return p;},attachShader(){},linkProgram(){},getProgramParameter:()=>!fault.link,getProgramInfoLog:()=>'injected link failure',deleteProgram:p=>assert.ok(programs.delete(p)),
    getAttribLocation:(_,n)=>({position:0,normal:1,color:2,uv:3})[n],getUniformLocation:(p,n)=>({p,n}),useProgram:p=>{current=p;},
    createBuffer(){if(fault.bufferAlloc)return null;const b={id:next++,data:null};buffers.add(b);return b;},bindBuffer:(_,b)=>{assert.ok(buffers.has(b));bound=b;},
    bufferData(_,values){calls.uploads++;if(fault.uploadThrow)throw Error('injected upload failure');if(fault.uploadError){error=1285;return;}bound.data=new Float32Array(values);},
    getError(){const result=error;error=0;return result;},deleteBuffer:b=>assert.ok(buffers.delete(b)),
    viewport(){},disable(){},enable(){},clearDepth(){},clearColor(){},clear(){},depthFunc(){},colorMask(){},depthMask(){},blendFunc(){},
    enableVertexAttribArray(){},disableVertexAttribArray(){},vertexAttribPointer(){},
    uniform1f:(u,v)=>calls.uniforms.push({name:u.n,value:v}),uniform3fv:(u,v)=>calls.uniforms.push({name:u.n,value:[...v]}),uniformMatrix3fv:(u,_,v)=>calls.uniforms.push({name:u.n,value:[...v]}),uniformMatrix4fv:(u,_,v)=>calls.uniforms.push({name:u.n,value:[...v]}),
    drawArrays:(mode,first,count)=>calls.draws.push({mode,first,count,program:current,data:[...bound.data]}),isContextLost:()=>!!fault.lost
  };
  const canvas={width:0,height:0,getContext:()=>fault.unavailable?null:gl,getBoundingClientRect:()=>({width:4000,height:3000}),addEventListener:(type,handler)=>events.set(type,handler),removeEventListener:(type,handler)=>{assert.equal(events.get(type),handler);events.delete(type);}};
  return {gl,canvas,buffers,programs,shaders,events,calls,fault};
}
test('lit material admission copies bounded inert fields and rejects hostile records',()=>{
  const color=[.2,.4,.7],m=validateLitMaterial({color,pattern:'glass',opacity:.45,roughness:.12,metalness:.6});color[0]=1;assert.equal(m.color[0],.2);assert.ok(Object.isFrozen(m)&&Object.isFrozen(m.color));
  for(const bad of [{roughness:0},{metalness:2},{opacity:-1},{emission:5},{pattern:'script'},{patternScale:0},{url:'remote'},JSON.parse('{"__proto__":{}}')])assert.throws(()=>validateLitMaterial(bad));
  let calls=0;assert.throws(()=>validateLitMaterial({get color(){calls++;return [1,1,1];}}));assert.equal(calls,0);
  const c=[1,1,1];Object.defineProperty(c,0,{get(){calls++;return 1;}});assert.throws(()=>validateLitMaterial({color:c}));assert.equal(calls,0);
});
test('inverse transpose preserves perpendicularity under rotation, nonuniform scale and shear',()=>{
  const matrix=[2,0,0,0, .5,3,0,0, 0,.7,4,0, 8,9,10,1],n=litNormalMatrix(matrix);
  const mul=(m,p)=>[0,1,2].map(r=>m[r]*p[0]+m[r+3]*p[1]+m[r+6]*p[2]);
  const normal=mul(n,[1,0,0]);assert.ok(Math.abs(normal[0]*.5+normal[1]*3)<1e-12);assert.ok(Math.abs(normal[1]*.7+normal[2]*4)<1e-12);
  assert.deepEqual(litNormalMatrix(new Float32Array(identity)),[1,0,0,0,1,0,0,0,1]);
  const singular=[...identity];singular[0]=0;assert.throws(()=>litNormalMatrix(singular),/singular/);const perspective=[...identity];perspective[3]=1;assert.throws(()=>litNormalMatrix(perspective),/affine/);
});
test('constructor cleans partial shader/program/buffer allocations on every failure stage',()=>{
  for(const fault of [{shaderAlloc:true},{compile:true},{programAlloc:true},{link:true},{bufferAlloc:true},{uploadThrow:true},{uploadError:true}]){
    const d=device(fault);assert.throws(()=>new LitRenderer(d.canvas));assert.equal(d.buffers.size,0);assert.equal(d.programs.size,0);assert.equal(d.shaders.size,0);assert.equal(d.events.size,0);
  }
  assert.throws(()=>new LitRenderer(device({unavailable:true}).canvas),/unavailable/);
});
test('retained meshes own copied bytes, skip identical data and replace transactionally',()=>{
  const d=device(),r=new LitRenderer(d.canvas),data=triangle(),m=r.mesh(data);data[0]=99;r.begin([0,0,5],[0,0,0,1]);r.draw(m);assert.equal(d.calls.draws.at(-1).data[0],-1);
  const before=r.stats();assert.equal(r.update(m,triangle()),false);assert.equal(r.stats().uploads,before.uploads);
  const next=triangle();next[0]=-.5;d.fault.uploadError=true;assert.throws(()=>r.update(m,next),/upload/);d.fault.uploadError=false;
  assert.equal(r.stats().uploads,before.uploads);assert.equal(d.buffers.size,2);r.draw(m);assert.equal(d.calls.draws.at(-1).data[0],-1);
  assert.equal(r.update(m,next),true);r.draw(m);assert.equal(d.calls.draws.at(-1).data[0],-.5);assert.equal(d.buffers.size,2);r.dispose();assert.equal(d.buffers.size,0);assert.equal(d.programs.size,0);assert.equal(d.events.size,0);r.dispose();
});
test('validation and total budgets reject before changing accepted resources or frame state',()=>{
  const d=device(),r=new LitRenderer(d.canvas,{profile:'low'}),m=r.mesh(triangle());r.begin([0,0,5],[0,0,0,1]);
  assert.ok(d.canvas.width*d.canvas.height<=LIT_PROFILES.low.maxPixels);const before={...r.stats()},draws=d.calls.draws.length,uniforms=d.calls.uniforms.length;
  const malformed=triangle();malformed[3]=malformed[4]=malformed[5]=0;
  for(const data of [malformed,[NaN],new Float64Array(triangle()),new Float32Array(34)])assert.throws(()=>r.update(m,data));
  const hostile=Array.from(triangle());Object.defineProperty(hostile,0,{get(){throw Error('must not evaluate');}});assert.throws(()=>r.mesh(hostile),/accessors/);
  assert.throws(()=>r.begin([0,0,5],[0,0,0,1],{ambient:-1}));assert.throws(()=>r.draw(m,{material:{opacity:9}}));assert.equal(d.calls.draws.length,draws);assert.equal(d.calls.uniforms.length,uniforms);assert.deepEqual(r.stats(),before);
  let invoked=0;const trap=triangle();Object.defineProperty(trap,'length',{get(){invoked++;return 33;}});assert.throws(()=>r.mesh(trap));
  const matrix=new Float32Array(identity);matrix[Symbol.iterator]=()=>{invoked++;throw Error('must not iterate');};assert.throws(()=>r.draw(m,{matrix}));
  assert.throws(()=>new LitRenderer(d.canvas,{profile:{toString(){invoked++;return 'high';}}}));assert.equal(invoked,0,'admission does not execute typed-array overrides or profile coercion');
  assert.throws(()=>r.mesh(new Float32Array((LIT_PROFILES.low.maxVertices+3)*11)),/bounded/);
  for(let i=1;i<LIT_PROFILES.low.maxMeshes;i++)r.mesh([]);assert.throws(()=>r.mesh([]),/mesh budget/);
  for(let i=0;i<LIT_PROFILES.low.maxDraws;i++)r.draw(m);assert.throws(()=>r.draw(m),/draw budget/);r.dispose();
});
test('context loss, disposal and foreign/deleted handles fail closed without hidden resource rebuild',()=>{
  const d=device(),r=new LitRenderer(d.canvas),m=r.mesh(triangle()),other=new LitRenderer(device().canvas),foreign=other.mesh(triangle());
  assert.throws(()=>r.draw(m),/begin/);r.begin([0,0,5],[0,0,0,1]);assert.throws(()=>r.draw(foreign),/foreign/);
  // Native context loss itself destroys GPU allocations; stale deletes after
  // restoration must not be issued against those invalid native handles.
  d.buffers.clear();d.programs.clear();let prevented=false;d.events.get('webglcontextlost')({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(r.lost,true);assert.throws(()=>r.begin([0,0,5],[0,0,0,1]),/context lost/);assert.throws(()=>r.update(m,triangle()),/context lost/);
  r.dispose();assert.equal(r.stats().meshes,0);assert.equal(r.stats().disposed,true);assert.throws(()=>r.mesh(triangle()),/disposed/);other.deleteMesh(foreign);assert.throws(()=>other.update(foreign,triangle()),/deleted/);other.dispose();
});
