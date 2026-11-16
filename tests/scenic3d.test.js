// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SCENIC_FORMAT,SCENIC_BYTES,SCENIC_PROFILES,validateScenery,parseScenery,serializeScenery,ScenicRoad,buildScenicWorld,buildVehicleVisual,vehicleDraws,createRoadShadow} from '../modules/scenic3d/index.js';
// Use the lab's authored route as a fixture; core modules do not import demos.
import {createCapeAsterScenery} from '../demos/horizon-lab/scenery.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const transformed=(m,p)=>[0,1,2].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]);
const hash=x=>createHash('sha256').update(new Uint8Array(x.buffer,x.byteOffset,x.byteLength)).digest('hex');
function referenceHeight(t,x,z){const [a,b,c]=t.points,n=cross(sub(b,a),sub(c,a));return a[1]-(n[0]*(x-a[0])+n[2]*(z-a[2]))/n[1];}
function checkMesh(v){
  assert.ok(v instanceof Float32Array);assert.equal(v.length%33,0);
  for(let i=0;i<v.length;i+=33){const a=Array.from(v.slice(i,i+3)),b=Array.from(v.slice(i+11,i+14)),c=Array.from(v.slice(i+22,i+25)),raw=cross(sub(b,a),sub(c,a)),length=Math.hypot(...raw);assert.ok(length>1e-8,'nondegenerate triangle');for(let j=0;j<3;j++){const at=i+j*11,n=Array.from(v.slice(at+3,at+6));near(Math.hypot(...n),1,1e-6);assert.ok(dot(raw,n)/length>.999,'normal follows winding');for(let k=0;k<11;k++)assert.ok(Number.isFinite(v[at+k]));for(let k=6;k<9;k++)assert.ok(v[at+k]>=0&&v[at+k]<=1);}}
}
test('scenery recipe roundtrips owned inert data and rejects unknown/executable/oversized input',()=>{
  const source=clone(createCapeAsterScenery()),accepted=validateScenery(source);assert.equal(accepted.format,SCENIC_FORMAT);assert.deepEqual(parseScenery(serializeScenery(accepted)),accepted);assert.ok(Object.isFrozen(accepted.road[0]));source.road[0].y=100;assert.notEqual(accepted.road[0].y,100);
  for(const mutate of [p=>p.version=2,p=>p.script='run()',p=>p.profile='ultra',p=>p.seed=-1,p=>p.road[1].id=p.road[0].id,p=>p.road[1].width=100,p=>p.road[1].bank=.8,p=>p.road[1].structure='script',p=>p.road[1].surface='ice',p=>p.road[1].y=Infinity,p=>{p.road[1].x=p.road[0].x;p.road[1].z=p.road[0].z;},p=>p.road.splice(0,11)]){const p=clone(accepted);mutate(p);assert.throws(()=>validateScenery(p));}
  let touched=false;const evil=clone(accepted);Object.defineProperty(evil.road[0],'y',{enumerable:true,get(){touched=true;return 4;}});assert.throws(()=>validateScenery(evil));assert.equal(touched,false);
  const hole=clone(accepted);delete hole.road[1];assert.throws(()=>validateScenery(hole));const symbol=clone(accepted);symbol[Symbol('extra')]=1;assert.throws(()=>validateScenery(symbol));assert.throws(()=>parseScenery(' '.repeat(SCENIC_BYTES+1)));assert.throws(()=>parseScenery('{"__proto__":{}}'));
});
test('rendered road positions and barycentric contact are the same Float32 triangles',()=>{
  const road=new ScenicRoad(createCapeAsterScenery()),triangles=road.triangles(),mesh=road.mesh();assert.equal(mesh.length,triangles.length*33);
  for(let i=0;i<triangles.length;i++){
    const t=triangles[i];for(let j=0;j<3;j++)assert.deepEqual(Array.from(mesh.slice(i*33+j*11,i*33+j*11+3)),t.points[j]);
    const p=[0,1,2].map(k=>t.points.reduce((s,v)=>s+v[k]/3,0)),hit=road.sampleAt(p[0],p[2],{surfaceId:t.surfaceId,maxY:200});assert.ok(hit);near(hit.position[1],referenceHeight(t,p[0],p[2]),1e-8);near(hit.position[1],p[1],1e-8);for(let k=0;k<3;k++)near(hit.normal[k],t.normal[k],1e-8);
  }
  for(let i=1;i<100;i++){const s=road.sample(road.length*i/100,2),hit=road.sampleAt(s.position[0],s.position[2],{surfaceId:s.surfaceId,maxY:200});assert.ok(hit);near(hit.position[1],s.position[1],1e-7);}
  const owned=road.triangles();owned[0].points[0][1]=900;assert.notEqual(road.triangles()[0].points[0][1],900);checkMesh(mesh);
});
test('overlapping roads keep explicit surfaces and bounded height selection',()=>{
  const p=clone(createCapeAsterScenery());p.road=[[0,0,40],[0,0,0],[0,0,-40],[40,10,-65],[70,16,-25],[40,20,15],[0,20,0],[-40,20,-20]].map(([x,y,z],i)=>({id:'cross-'+i,x,y,z,width:8,bank:0,structure:i>=4?'bridge':'ground',surface:'asphalt'}));
  const road=new ScenicRoad(p),low=road.sampleAt(0,0,{surfaceId:'cross-0',maxY:2}),high=road.sampleAt(0,0,{surfaceId:'cross-5',maxY:25});assert.ok(low&&high);near(low.position[1],0);near(high.position[1],20);assert.equal(road.sampleAt(0,0,{maxY:2}).surfaceId,'cross-0');assert.ok(road.sampleAt(0,0,{maxY:25}).position[1]>19);assert.equal(road.sampleAt(1200,1200),null);assert.throws(()=>road.sampleAt(0,0,{surfaceId:'unknown'}));assert.throws(()=>road.sample(-1));assert.throws(()=>road.sample(road.length+1));assert.throws(()=>road.sample(50,8));
});
test('quality profiles preserve exact road and terrain contact geometry',()=>{
  const p=createCapeAsterScenery(),low=buildScenicWorld({...p,profile:'low'}),high=buildScenicWorld({...p,profile:'high'});assert.deepEqual(low.road.triangles(),high.road.triangles());assert.deepEqual(low.road.mesh(),high.road.mesh());assert.equal(low.terrain.cellSize,high.terrain.cellSize);
  for(let z=0;z<56;z++)for(let x=0;x<56;x++)assert.deepEqual(low.terrain.triangleAt(x,z),high.terrain.triangleAt(x,z));assert.ok(low.stats.vertices<high.stats.vertices);assert.ok(low.stats.vertices<SCENIC_PROFILES.low.maxVertices);assert.ok(high.stats.vertices<SCENIC_PROFILES.high.maxVertices);assert.ok(low.stats.trees<high.stats.trees);
  const terrain=high.batches.find(b=>b.id==='terrain').vertices;for(let z=0;z<56;z+=7)for(let x=0;x<56;x+=7)for(let i=0;i<2;i++){const tri=high.terrain.triangleAt(x,z)[i],offset=((z*56+x)*2+i)*33;for(let j=0;j<3;j++)assert.deepEqual(Array.from(terrain.slice(offset+j*11,offset+j*11+3)),tri[j]);const p=tri.reduce((s,v)=>s.map((n,k)=>n+v[k]/3),[0,0,0]);near(high.terrain.sample(p[0],p[2]).height,p[1],1e-8);}
});
test('seeded scenery is repeatable, visibly different seeds alter terrain, all batches have valid normals and bounded budgets',()=>{
  const p=createCapeAsterScenery(),first=buildScenicWorld(p),again=buildScenicWorld(p),changed=buildScenicWorld({...p,seed:p.seed+1});assert.deepEqual(first.stats,again.stats);for(let i=0;i<first.batches.length;i++){assert.equal(hash(first.batches[i].vertices),hash(again.batches[i].vertices));checkMesh(first.batches[i].vertices);}assert.notEqual(hash(first.batches[0].vertices),hash(changed.batches[0].vertices));assert.ok(first.batches.some(b=>b.id==='stone'));assert.ok(first.batches.some(b=>b.id==='water'));assert.ok(first.road.triangles().some(t=>t.structure==='bridge'));assert.ok(first.road.triangles().some(t=>t.structure==='tunnel'));
  for(const environment of ['alpine','dusk']){const w=buildScenicWorld({...p,environment,profile:'low'});assert.ok(!w.batches.some(b=>b.id==='water'));assert.ok(w.stats.vertices<SCENIC_PROFILES.low.maxVertices);}
});
test('three original vehicle silhouettes have outward loft normals, real cylindrical wheels and retained parts',()=>{
  const hashes=new Set();for(const id of ['sport','touring','utility']){const visual=buildVehicleVisual(id);hashes.add(hash(visual.parts[0].vertices));assert.equal(visual.parts.length,13);assert.ok(visual.parts.find(p=>p.group==='glass'));assert.equal(visual.wheels.length,4);for(const p of visual.parts)checkMesh(p.vertices);
    const body=visual.parts[0].vertices;assert.ok(Array.from(body).some((v,i)=>i%11===4&&v>.99),'roof and deck normals face up');const front=[];for(let i=0;i<body.length;i+=11)if(body[i+2]<-visual.dimensions.length/2+.001)front.push(body[i+5]);assert.ok(front.some(v=>v<-.99),'front cap faces forward');
    for(const p of visual.parts.filter(p=>p.group==='lamp'||p.group==='brake'))for(let i=0;i<p.vertices.length;i+=11)assert.ok(p.group==='lamp'?p.vertices[i+5]<-.99:p.vertices[i+5]>.99,'lamps face outside vehicle');
    const tire=visual.parts.find(p=>p.id==='front-left-tire').vertices,r=visual.wheels[0].radius;near(Math.hypot(tire[1],tire[2]),r,1e-6);assert.ok(tire[4]>.9,'top tread normal faces outward');assert.ok(visual.stats.vertices>2500);
    const draws=vehicleDraws(visual);assert.equal(draws[0].part,visual.parts[0]);assert.equal(draws[5].part.vertices,visual.parts[5].vertices);
  }assert.equal(hashes.size,3);
});
test('visual wheel steering/spin/compression and brake feedback never mutate geometry or supplied pose',()=>{
  const visual=buildVehicleVisual('sport'),base=vehicleDraws(visual),before=visual.parts.map(p=>hash(p.vertices)),pose={position:[1,2,3],yaw:Math.PI/2,pitch:.1,roll:-.1,wheelSpin:1,steer:.3,compression:[.1,0,0,0],brake:1},snapshot=clone(pose),draws=vehicleDraws(visual,pose);assert.deepEqual(pose,snapshot);assert.deepEqual(visual.parts.map(p=>hash(p.vertices)),before);assert.ok(draws.find(d=>d.part.group==='brake').material.emission>base.find(d=>d.part.group==='brake').material.emission);assert.notDeepEqual(draws[5].matrix,draws[7].matrix);
  const yaw=vehicleDraws(visual,{yaw:Math.PI/2})[0].matrix,p=transformed(yaw,[0,0,-1]);near(p[0],-1);near(p[1],0);near(p[2],0);const road=new ScenicRoad(createCapeAsterScenery()),sample=road.sample(50),m=vehicleDraws(visual,{position:sample.position,yaw:sample.yaw,pitch:sample.pitch,roll:sample.roll})[0].matrix;for(let k=0;k<3;k++)near(m[4+k],sample.normal[k],1e-6);
  assert.throws(()=>vehicleDraws({},{}));assert.throws(()=>vehicleDraws(visual,{steer:1}));assert.throws(()=>vehicleDraws(visual,{compression:[0,0,0,-.1]}));assert.throws(()=>vehicleDraws(visual,{eval:'bad'}));assert.throws(()=>buildVehicleVisual('remote'));assert.throws(()=>buildVehicleVisual('sport',{paint:[2,0,0]}));
});
test('road contact shadows are bounded lifted road patches with radial UV coordinates',()=>{
  const road=new ScenicRoad(createCapeAsterScenery()),shadow=createRoadShadow(road,{distance:50,width:3,length:5,offset:.025});assert.equal(shadow.length,528);checkMesh(shadow);for(let i=0;i<shadow.length;i+=11){assert.ok(shadow[i+9]>=0&&shadow[i+9]<=1);assert.ok(shadow[i+10]>=0&&shadow[i+10]<=1);const hit=road.sampleAt(shadow[i],shadow[i+2],{maxY:200});assert.ok(hit);assert.ok(shadow[i+1]>hit.position[1]);assert.ok(shadow[i+1]-hit.position[1]<.04);}assert.throws(()=>createRoadShadow(road,{distance:0}));assert.throws(()=>createRoadShadow(road,{distance:50,width:20}));
});

test('admitted steep and displaced recipes keep complete bounds and usable road-aligned vehicle poses',()=>{
  const p=clone(createCapeAsterScenery());p.profile='low';p.road=[0,1,2,3,4].map((v,i)=>({id:'extreme-'+i,x:-1100,y:i%2?28:0,z:-40*i,width:5,bank:.4,structure:i===2?'bridge':'ground',surface:'asphalt'}));
  const world=buildScenicWorld(p),visual=buildVehicleVisual('sport',{profile:'low'});let steepest=0;
  for(let i=0;i<=100;i++){const s=world.road.sample(world.road.length*i/100);steepest=Math.max(steepest,Math.abs(s.pitch));assert.equal(vehicleDraws(visual,{position:s.position,yaw:s.yaw,pitch:s.pitch+.15,roll:s.roll+.15}).length,13);}
  assert.ok(steepest>.7,'case exercises interpolated grade beyond old rig bound');
  for(const batch of world.batches)for(let i=0;i<batch.vertices.length;i+=11)for(let k=0;k<3;k++)assert.ok(batch.vertices[i+k]>=world.bounds.min[k]&&batch.vertices[i+k]<=world.bounds.max[k]);
  assert.ok(world.bounds.max[1]>200,'bounds include admitted high terrain, not a guessed height ceiling');
});
