// SPDX-License-Identifier: Apache-2.0
// Independent HORIZON-004 visual references. These do not define collision geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildScenicWorld,buildVehicleVisual,SCENIC_PROFILES} from '../modules/scenic3d/index.js';
import {createCapeAsterScenery} from '../demos/horizon-lab/scenery.js';
const near=(a,b,e=2e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const unit=v=>{const length=Math.hypot(...v);return v.map(x=>x/length);};
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const fixtures={
  sport:{dimensions:{length:4.4,width:1.95,height:1.25,wheelbase:2.62,track:1.76,wheelRadius:.34},roof:[-.13,.61,.64]},
  touring:{dimensions:{length:4.9,width:1.88,height:1.52,wheelbase:2.85,track:1.68,wheelRadius:.35},roof:[-.45,.88,.64]},
  utility:{dimensions:{length:4.7,width:2.08,height:1.86,wheelbase:2.72,track:1.84,wheelRadius:.42},roof:[-.71,1.14,.74]}
};
function flattened(vertices){
  const out=vertices.slice();for(let i=0;i<out.length;i+=33){const a=Array.from(out.slice(i,i+3)),b=Array.from(out.slice(i+11,i+14)),c=Array.from(out.slice(i+22,i+25)),n=unit(cross(sub(b,a),sub(c,a)));for(const at of [i,i+11,i+22])out.set(n,at+3);}return out;
}
function checkRoofNormals(vertices,fixture){
  const {dimensions:d,roof:[front,back,factor]}=fixture,rw=d.width/2*factor;let count=0,curved=0;
  for(let i=0;i<vertices.length;i+=11){const [x,y,z]=vertices.slice(i,i+3),t=(z-front)/(back-front),expectedY=d.height-.065*(x/rw)**2-.025*(2*t-1)**2;
    if(Math.abs(x)>rw-.06||t<.12||t>.88||Math.abs(y-expectedY)>2e-6)continue;
    const expected=unit([.13*x/(rw*rw),1,.1*(2*t-1)/(back-front)]);for(let k=0;k<3;k++)near(vertices[i+3+k],expected[k],3e-6);
    if(Math.abs(expected[0])>.05)curved++;count++;
  }
  assert.ok(count>100,'a sampled curved roof, not a flat box roof');assert.ok(curved>30,'both sides contain nonvertical analytic normals');
}
function checkTyreNormals(vertices,radius){
  let count=0;for(let i=0;i<vertices.length;i+=11){const y=vertices[i+1],z=vertices[i+2],ny=vertices[i+4],nz=vertices[i+5],radial=Math.hypot(y,z);if(radial<radius*.89)continue;
    const normalRadial=Math.hypot(ny,nz);assert.ok(normalRadial>.2);near(ny/normalRadial,y/radial);near(nz/normalRadial,z/radial);count++;
  }assert.ok(count>300,'tread and rounded shoulders are sampled around the full circumference');
}
function checkSeam(vertices){
  const seen=new Map();let repeated=0;
  for(let i=0;i<vertices.length;i+=11){const key=[0,1,2].map(k=>Math.round(vertices[i+k]*1e6)).join(':'),normal=Array.from(vertices.slice(i+3,i+6));if(seen.has(key)){const previous=seen.get(key);for(let k=0;k<3;k++)near(normal[k],previous[k],2e-6);repeated++;}else seen.set(key,normal);}
  assert.ok(repeated>100,'duplicated triangle and wrap-seam vertices agree');
}
function sideCovers(vertices,side,width,y,z){
  for(let i=0;i<vertices.length;i+=33){const p=[0,11,22].map(o=>Array.from(vertices.slice(i+o,i+o+3)));if(!p.every(v=>v[0]*side>width*.35))continue;
    const area=(p[1][1]-p[0][1])*(p[2][2]-p[0][2])-(p[1][2]-p[0][2])*(p[2][1]-p[0][1]);if(Math.abs(area)<1e-7)continue;
    const s=p.map((a,j)=>{const b=p[(j+1)%3];return (b[1]-a[1])*(z-a[2])-(b[2]-a[2])*(y-a[1]);});if(s.every(n=>n>=-1e-7)||s.every(n=>n<=1e-7))return true;
  }return false;
}
for(const profile of ['low','high'])for(const [classId,fixture] of Object.entries(fixtures)){
  test(`${classId}/${profile}: curved roof and tyre normals match independent analytic surfaces with continuous seams`,()=>{
    const visual=buildVehicleVisual(classId,{profile}),body=visual.parts[0].vertices,tire=visual.parts[5].vertices;
    checkRoofNormals(body,fixture);checkTyreNormals(tire,fixture.dimensions.wheelRadius);checkSeam(tire);
    // Original per-triangle faceting and inverted normals must not satisfy the new curved-surface contract.
    assert.throws(()=>checkRoofNormals(flattened(body),fixture));assert.throws(()=>checkTyreNormals(flattened(tire),fixture.dimensions.wheelRadius));
    const inverted=tire.slice();for(let i=0;i<inverted.length;i+=11)for(let k=3;k<6;k++)inverted[i+k]*=-1;assert.throws(()=>checkTyreNormals(inverted,fixture.dimensions.wheelRadius));
  });
  test(`${classId}/${profile}: open wheel arches, original physical dimensions and fixed retained parts stay bounded`,()=>{
    const visual=buildVehicleVisual(classId,{profile}),d=fixture.dimensions,body=visual.parts[0].vertices;assert.deepEqual(visual.dimensions,d);assert.equal(visual.parts.length,13);
    assert.ok(visual.stats.vertices<(profile==='low'?28000:48000));assert.equal(visual.stats.vertices*44,visual.parts.reduce((n,p)=>n+p.vertices.byteLength,0));
    for(const [i,wheel] of visual.wheels.entries()){
      assert.deepEqual(wheel.position,[(i%2===0?-1:1)*d.track/2,d.wheelRadius,(i<2?-1:1)*d.wheelbase/2]);assert.equal(wheel.radius,d.wheelRadius);
      for(const dz of [-.1,0,.1])assert.equal(sideCovers(body,i%2===0?-1:1,d.width,d.wheelRadius+.1,wheel.position[2]+dz),false,'body does not fill the visible tyre clearance');
    }
    for(const side of [-1,1])assert.equal(sideCovers(body,side,d.width,.5,0),true,'reference detects the solid side sill between the arches');
  });
}
test('HORIZON-004 preserves the exact reviewed road and terrain contact source values in both visual profiles',()=>{
  // SHA-256 of JSON triangle records from reviewed f263d43627970d8c3cfb2d54eed8fdeed2e7c457,
  // captured independently before changing scenic3d. No screenshot or GPU rounding participates.
  const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  for(const profile of ['low','high']){
    const world=buildScenicWorld({...createCapeAsterScenery(),profile}),terrain=[];
    assert.equal(hash(world.road.triangles()),'b83bd3c7a11521f579f6ac1c90638ca6fe19be4ad665a78986effbea9acc85bd');
    for(let z=0;z<56;z++)for(let x=0;x<56;x++)terrain.push(world.terrain.triangleAt(x,z));
    assert.equal(hash(terrain),'379a32a11d531ca218b369c017d37f784a4b63e4631610452e37cf5fba3163ab');
    const vertices=world.batches.find(b=>b.id==='terrain').vertices;
    for(let i=56*56*6*11;i<vertices.length;i+=11){near(vertices[i+9],vertices[i]/8,5e-6);near(vertices[i+10],vertices[i+2]/8,5e-6);}
  }
});
test('layered crowns, tunnel ribs and bridge rails use bounded retained material batches',()=>{
  const worlds=['low','high'].map(profile=>buildScenicWorld({...createCapeAsterScenery(),profile}));
  for(const world of worlds){assert.equal(world.batches.length,11);assert.ok(world.stats.vertices<SCENIC_PROFILES[world.recipe.profile].maxVertices);assert.ok(world.batches.find(b=>b.id==='foliage').vertices.length/11>world.stats.trees*200,'tree silhouettes have layered crowns');}
  assert.ok(worlds[1].stats.vertices>worlds[0].stats.vertices);assert.ok(worlds[1].stats.vertices<140000,'authored high world stays below the reviewed budget');
});
function checkWeightedNormals(vertices){
  // Independent incident-face sum from shipped triangle positions; no scenic helper is used.
  const sums=new Map(),key=p=>p.join('/');
  for(let i=0;i<vertices.length;i+=33){const points=[0,11,22].map(o=>Array.from(vertices.slice(i+o,i+o+3))),face=cross(sub(points[1],points[0]),sub(points[2],points[0]));
    for(const p of points){const id=key(p),sum=sums.get(id)??[0,0,0];for(let k=0;k<3;k++)sum[k]+=face[k];sums.set(id,sum);}}
  let nonplanar=0;
  for(let i=0;i<vertices.length;i+=33){const points=[0,11,22].map(o=>Array.from(vertices.slice(i+o,i+o+3))),face=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
    for(let j=0;j<3;j++){const n=unit(sums.get(key(points[j])));for(let k=0;k<3;k++)near(vertices[i+j*11+k+3],n[k]);if(n.some((value,k)=>Math.abs(value-face[k])>.01))nonplanar++;}}
  assert.ok(nonplanar>100,'visual surface uses shared normals rather than flat face lighting');
}
test('terrain and layered foliage use shared incident-face visual normals, while flat-normal negative controls are rejected',()=>{
  for(const profile of ['low','high']){
    const world=buildScenicWorld({...createCapeAsterScenery(),profile});
    for(const id of ['terrain','foliage']){const vertices=world.batches.find(b=>b.id===id).vertices;checkWeightedNormals(vertices);checkSeam(vertices);assert.throws(()=>checkWeightedNormals(flattened(vertices)));}
    for(let z=0;z<56;z+=7)for(let x=0;x<56;x+=7)for(const points of world.terrain.triangleAt(x,z)){
      const point=[0,1,2].map(k=>points.reduce((s,p)=>s+p[k]/3,0)),normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0]))),sample=world.terrain.sample(point[0],point[2]);
      for(let k=0;k<3;k++)near(sample.normal[k],normal[k],1e-10);
    }
  }
});
test('sport bonnet centerline rises smoothly without transverse wheel-arch humps',()=>{
  for(const profile of ['low','high']){
    const vertices=buildVehicleVisual('sport',{profile}).parts[0].vertices,stations=new Map();
    for(let i=0;i<vertices.length;i+=11)if(Math.abs(vertices[i])<1e-7&&vertices[i+2]>-1.65&&vertices[i+2]<-.70&&vertices[i+1]>.75)stations.set(vertices[i+2],vertices[i+1]);
    const sorted=[...stations].sort((a,b)=>a[0]-b[0]);assert.ok(sorted.length>=6);for(let i=1;i<sorted.length;i++)assert.ok(sorted[i][1]>=sorted[i-1][1]-1e-6,'arch lift belongs at the fenders, not across the bonnet');
  }
});
test('maximum 32-knot ground, bridge and tunnel recipes retain the existing world vertex ceilings',()=>{
  for(const profile of ['low','high'])for(const structure of ['ground','bridge','tunnel']){
    const recipe={...createCapeAsterScenery(),profile,environment:'alpine',road:Array.from({length:32},(_,i)=>({id:'budget-'+i,x:0,y:12,z:-30*i,width:9,bank:0,structure,surface:'asphalt'}))};
    const world=buildScenicWorld(recipe);assert.equal(world.road.triangles().length,31*8*2);assert.ok(world.stats.vertices<=SCENIC_PROFILES[profile].maxVertices);assert.ok(world.batches.length<=12);
  }
});
