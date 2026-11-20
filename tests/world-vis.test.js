// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRetainedWorld,selectRetainedView,RetainedLitWorld,WORLD_VIS_LIMITS}
  from '../modules/world-vis/index.js';
import {classifyAABBFrustum} from '../modules/geometry/index.js';
import {perspective,viewMatrix,multiplyMatrices} from '../modules/math/index.js';
import {createWorldVisStudy,WORLD_CAMERAS,viewCamera} from '../demos/world-vis-lab/world.js';

const MAT={color:[.7,.8,.9],roughness:.8,metalness:0,opacity:1,
  emission:0,pattern:'none',patternScale:1};
const tint={...MAT,color:[.8,.6,.4],opacity:.45};
function mesh(x=0,z=-15,triangles=12){
  const data=new Float32Array(triangles*33);
  for(let i=0;i<triangles;i++){
    const a=x+(i%3)*.018,y=1+(i%4)*.02,base=i*33;
    for(const [j,point]of [[0,[a,y,z]],[1,[a+1,y,z]],[2,[a,y+1,z]]]){
      const o=base+j*11;
      data.set([...point,0,0,1,1,1,1,0,0],o);
    }
  }
  return data;
}
const source=()=>[
  {id:'near',vertices:mesh(0,-12),material:MAT},
  {id:'behind',vertices:mesh(0,15),material:MAT},
  {id:'far',vertices:mesh(0,-155,18),material:MAT},
  {id:'glass-a',vertices:mesh(2,-35,6),material:tint},
  {id:'glass-b',vertices:mesh(-2,-35,6),material:tint}
];
const camera=(position=[0,1,0])=>({
  position,orientation:[0,0,0,1],fov:Math.PI/2,aspect:1.6,near:.1,far:2000
});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stateHash=arr=>arr.map(v=>hash(new Uint8Array(v.vertices.buffer))).join('|');

function fakeRenderer(){
  const live=new Map(),calls=[];
  return {live,calls,
    mesh(data){const handle={};live.set(handle,new Float32Array(data));calls.push(['upload',handle]);return handle;},
    deleteMesh(handle){assert.ok(live.delete(handle));calls.push(['delete',handle]);},
    draw(handle,options){assert.ok(live.has(handle));calls.push(['draw',handle,options.material]);},
    stats(){return {meshes:live.size};}
  };
}
test('one authoritative world, conservative multi-camera culling and full-source parity',()=>{
  const inputs=source(),before=stateHash(inputs),world=createRetainedWorld(inputs);
  const full=selectRetainedView(world,camera(),{cull:false,lod:'high'});
  assert.deepEqual(full.rows.map(r=>r.id),['near','behind','far','glass-a','glass-b']);
  assert.equal(full.culled,0);assert.equal(full.selected,5);
  const selected=selectRetainedView(world,camera(),{cull:true,lod:'high'});
  assert.ok(selected.culled>=1);assert.ok(!selected.rows.some(r=>r.id==='behind'));
  assert.ok(selected.rows.some(r=>r.id==='near'));
  assert.deepEqual(selected.rows.filter(r=>r.transparent).map(r=>r.id),
    ['glass-a','glass-b'],'transparent stable far-to-near/id');
  assert.deepEqual(selected.rows.filter(r=>!r.transparent).map(r=>r.id),
    ['near','far'],'opaque source order retained');
  assert.deepEqual(stateHash(inputs),before,'no physics/source vertex mutation');
  assert.deepEqual(selectRetainedView(world,camera(),{cull:true,lod:'high'}),selected);
  const lookingBack={...camera(),orientation:[0,1,0,0]};
  assert.ok(selectRetainedView(world,lookingBack).rows.some(r=>r.id==='behind'));
  assert.equal(world.batches,inputs.length);
});
test('LOD chooses only far original whole triangles and does not corrupt high geometry',()=>{
  const inputs=source(),before=stateHash(inputs),world=createRetainedWorld(inputs);
  const high=selectRetainedView(world,camera(),{lod:'high',cull:false});
  const auto=selectRetainedView(world,camera(),{lod:'auto',lodDistance:60,cull:false});
  const low=selectRetainedView(world,camera(),{lod:'low',cull:false});
  assert.equal(high.rows.find(r=>r.id==='far').lod,'high');
  assert.equal(auto.rows.find(r=>r.id==='far').lod,'low');
  assert.equal(auto.rows.find(r=>r.id==='near').lod,'high');
  assert.equal(low.rows.find(r=>r.id==='near').lod,'low');
  assert.ok(low.lodVertices<high.lodVertices);
  assert.ok(low.rows.every(r=>r.vertices%3===0));
  assert.deepEqual(stateHash(inputs),before);
  assert.deepEqual(selectRetainedView(world,camera(),{lod:'high',cull:false}),high);
});
test('opaque identity order and translucent back-to-front order stable on ties',()=>{
  const batches=[
    {id:'z-glass',vertices:mesh(-1,-28,3),material:tint},
    {id:'front',vertices:mesh(0,-8,12),material:MAT},
    {id:'a-glass',vertices:mesh(1,-28,3),material:tint},
    {id:'rear',vertices:mesh(0,-35,12),material:MAT}
  ],world=createRetainedWorld(batches);
  const rows=selectRetainedView(world,camera(),{cull:false,lod:'high'}).rows;
  assert.deepEqual(rows.map(r=>r.id),['front','rear','a-glass','z-glass']);
});
test('retainer retains handles, evicts unused meshes, rebinds after context loss',()=>{
  const world=createRetainedWorld(source()),renderer=fakeRenderer(),
    state=new RetainedLitWorld(renderer,world,{maxResidentBytes:65536,maxMeshes:12});
  const forward=selectRetainedView(world,camera(),{cull:true,lod:'high'});
  state.draw(forward);
  assert.equal(state.stats().residentMeshes,forward.rows.length);
  const uploaded=state.stats().uploads;
  state.draw(forward);
  assert.equal(state.stats().uploads,uploaded,'no redundant GPU uploads');
  assert.deepEqual(renderer.calls.filter(x=>x[0]==='draw').slice(0,forward.draws).length,
    forward.draws);
  const reverse=selectRetainedView(world,{...camera(),orientation:[0,1,0,0]},
    {cull:true,lod:'high'});
  state.draw(reverse);
  assert.ok(state.stats().deletions>0);
  assert.ok(state.stats().residentBytes<=65536);
  const second=fakeRenderer();
  state.rebind(second);
  assert.equal(state.stats().residentMeshes,0);
  assert.equal(renderer.live.size,0);
  state.draw(forward);assert.equal(second.live.size,forward.selected);
  state.dispose();state.dispose();assert.equal(second.live.size,0);
  assert.throws(()=>state.draw(forward),/disposed/);
});
test('preflight budget refuses oversubscribed visibility without cache eviction',()=>{
  const world=createRetainedWorld(source()),renderer=fakeRenderer(),
    lowMax=20*33*4,retainer=new RetainedLitWorld(renderer,world,
      {maxResidentBytes:lowMax,maxMeshes:3});
  const forward=selectRetainedView(world,camera(),{cull:true,lod:'low'});
  const tooMany=selectRetainedView(world,camera(),{cull:false,lod:'high'});
  // A single forward-plan is allowed to fail too; never upload partial work.
  assert.throws(()=>retainer.draw(tooMany),/budget/);
  assert.equal(renderer.live.size,0);
  assert.equal(retainer.stats().residentBytes,0);
  const foreign=createRetainedWorld(source());
  assert.throws(()=>retainer.draw(selectRetainedView(foreign,camera())),/foreign/);
  assert.throws(()=>retainer.draw({...forward}),/forged/);
  assert.equal(renderer.live.size,0);
});
test('invalid sources/option data fail before budget GPU actions',()=>{
  const good=source(),valid=createRetainedWorld(good),data=source()[0],
    getter={id:'bad',material:MAT};
  let reads=0;Object.defineProperty(getter,'vertices',{enumerable:true,get(){reads++;return mesh();}});
  assert.throws(()=>createRetainedWorld([getter]));assert.equal(reads,0);
  assert.throws(()=>createRetainedWorld([{...data,id:'bad/name'}]));
  assert.throws(()=>createRetainedWorld([data,data]));
  assert.throws(()=>createRetainedWorld([{...data,vertices:new Float32Array([1,2,3])}]));
  assert.throws(()=>createRetainedWorld([{...data,vertices:new Float32Array([1,2,Infinity,...Array(30).fill(0)])}]));
  assert.throws(()=>createRetainedWorld([{...data,material:{...MAT,unknown:1}}]));
  assert.throws(()=>createRetainedWorld([,data]));
  assert.throws(()=>createRetainedWorld([{...data,extra:5}]));
  assert.throws(()=>createRetainedWorld(Array.from({length:WORLD_VIS_LIMITS.batches+1},(_,i)=>({...data,id:'i-'+i}))));
  assert.throws(()=>selectRetainedView(valid,{...camera(),fov:Infinity}));
  assert.throws(()=>selectRetainedView(valid,{...camera(),orientation:[0,0,0,0]}));
  assert.throws(()=>selectRetainedView(valid,{...camera(),unknown:1}));
  assert.throws(()=>selectRetainedView(valid,camera(),{cull:'yes'}));
  assert.throws(()=>selectRetainedView(valid,camera(),{lod:'cheap'}));
  assert.throws(()=>selectRetainedView(valid,camera(),{lodDistance:0}));
  assert.throws(()=>new RetainedLitWorld({},valid));
});
test('seeded conservative oracle: if any corner of AABB lies strictly inside all six planes, do not cull',()=>{
  // This oracle is deliberately independent of AABB classifier: explicitly
  // project all 8 corners using the canonical perspective/view matrices.
  let seed=990;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<130;i++){
    const x=(random()-.5)*60,z=-2-random()*140,
      world=createRetainedWorld([{id:'target',vertices:mesh(x,z,3),material:MAT}]),
      cam={...camera([(random()-.5)*20,(random()-.5)*7,0]),fov:.8+random()*.7},
      vp=multiplyMatrices(perspective(cam.fov,cam.aspect,cam.near,cam.far),
        viewMatrix(cam.position,cam.orientation)),
      vertices=mesh(x,z,3),mins=[Infinity,Infinity,Infinity],maxes=[-Infinity,-Infinity,-Infinity];
    for(let j=0;j<vertices.length;j+=11)for(let k=0;k<3;k++){
      mins[k]=Math.min(mins[k],vertices[j+k]);maxes[k]=Math.max(maxes[k],vertices[j+k]);
    }
    let definitelyInside=false;
    for(const xx of [mins[0],maxes[0]])for(const yy of [mins[1],maxes[1]])
      for(const zz of [mins[2],maxes[2]]){
        const p=[xx,yy,zz,1],clip=Array.from({length:4},(_,r)=>
          vp[r]*p[0]+vp[4+r]*p[1]+vp[8+r]*p[2]+vp[12+r]);
        if(clip[3]>1e-6&&[0,1,2].every(k=>Math.abs(clip[k])<clip[3]-.0001))
          definitelyInside=true;
      }
    const plan=selectRetainedView(world,cam,{cull:true,lod:'high'});
    if(definitelyInside)assert.equal(plan.selected,1,'false negative culling in trial '+i);
    assert.ok([-1,0,1].includes(classifyAABBFrustum({
      min:mins.map(x=>x-.005),max:maxes.map(x=>x+.005)},
      [[1,0,0,1000],[0,1,0,1000]])));
  }
});
test('real HORIZON static sources and road sampling are unchanged by multiple view plans',()=>{
  const study=createWorldVisStudy(),{world}=study,
    initial=JSON.stringify(study.fixedSample),
    before=study.source.map(x=>hash(new Uint8Array(x.vertices.buffer))),
    cameras=Object.keys(WORLD_CAMERAS).map(name=>viewCamera(name,1.6));
  assert.ok(world.batches>3);assert.ok(world.highTriangles>1000);
  for(const cam of cameras)for(const lod of ['high','auto','low']){
    const plan=selectRetainedView(world,cam,{cull:true,lod,lodDistance:120});
    assert.ok(plan.selected<=world.batches);
    assert.equal(plan.selected+plan.culled,world.batches);
    assert.ok(plan.lodVertices<=plan.fullVertices);
  }
  assert.equal(JSON.stringify(study.physicsSource.sample(40)),initial);
  assert.deepEqual(study.source.map(x=>hash(new Uint8Array(x.vertices.buffer))),before);
});
