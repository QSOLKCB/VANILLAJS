// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENIC_FORMAT,ScenicRoad,buildScenicWorld,validateScenery} from '../modules/scenic3d/index.js';

function straightRecipe(widths,{height=2,environment='alpine',profile='low',seed=1}={}){
  return {format:SCENIC_FORMAT,version:1,name:'Straight road reference',seed,profile,environment,
    road:widths.map((width,i)=>({id:'straight-'+i,x:0,y:height,z:-30*i,width,bank:0,structure:'ground',surface:'asphalt'}))};
}
function near(actual,expected,label,tolerance=2e-6){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected}, received ${actual}`);
}
function checkStraightPosition(road,distance,offset){
  const sample=road.sample(distance,offset);
  // This planar road has an analytic answer independent of its triangulation.
  near(sample.position[0],offset,'metres right of the straight centerline');
  near(sample.position[1],2,'flat road height');
  near(sample.position[2],-distance,'metres along the straight centerline');
  near(sample.normal[0],0,'normal x');near(sample.normal[1],1,'normal y');near(sample.normal[2],0,'normal z');
  const vertical=road.sampleAt(offset,-distance);
  assert.ok(vertical,'independent vertical query reaches the requested road position');
  for(let axis=0;axis<3;axis++)near(sample.position[axis],vertical.position[axis],'longitudinal / vertical query agreement');
}

test('reported widening road preserves exact centerline position at 1.1572265625 metres',()=>{
  const road=new ScenicRoad(straightRecipe([5,18,18,18]));
  checkStraightPosition(road,1.1572265625,0);
});
test('reported widening road preserves a one-metre lateral offset',()=>{
  const road=new ScenicRoad(straightRecipe([5,18,18,18]));
  checkStraightPosition(road,1.1572265625,1);
});
for(const [direction,widths] of [['expanding',[5,18,18,18]],['contracting',[18,5,5,5]]]){
  test(`${direction} road keeps zero and signed metre offsets across strips and knot joins`,()=>{
    const road=new ScenicRoad(straightRecipe(widths));near(road.length,90,'reference road length');
    for(const distance of [0,.25,1.1572265625,2.2,3,5,15,29.5,30,31,44.5,61,89.75,90]){
      for(const offset of [-2,-1,0,1,2])checkStraightPosition(road,distance,offset);
    }
  });
}

const subtract=(a,b)=>a.map((value,i)=>value-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function embankments(){
  const world=buildScenicWorld(straightRecipe([9,9,9,9],{height:4}));
  const vertices=world.batches.find(batch=>batch.id==='terrain').vertices;
  // The terrain batch begins with the documented 56 × 56 grid, six vertices per cell.
  const gridVertices=56*56*6;assert.ok(vertices.length>gridVertices*11,'fixture includes roadside banks');
  const result=[];
  for(let i=gridVertices*11;i<vertices.length;i+=33){
    const points=[0,11,22].map(offset=>Array.from(vertices.slice(i+offset,i+offset+3)));
    const normals=[0,11,22].map(offset=>Array.from(vertices.slice(i+offset+3,i+offset+6)));
    result.push({points,normals});
  }
  return result;
}

test('reported alpine low-profile embankment triangles face upward rather than into the terrain',()=>{
  let count=0;
  for(const {points,normals} of embankments()){
    const geometric=cross(subtract(points[1],points[0]),subtract(points[2],points[0]));
    assert.ok(geometric[1]>0,'roadside bank triangle winding must expose its top surface');
    for(const normal of normals)assert.ok(normal[1]>0,'the shipped vertex normal must point upward');
    count++;
  }
  assert.ok(count>=4,'both sides contain multiple independently checked bank faces');
});
test('both sloped roadside banks point away from the centerline and receive overhead diffuse light',()=>{
  const sides=new Set();
  for(const {points,normals} of embankments()){
    const centerX=points.reduce((sum,p)=>sum+p[0]/3,0),side=Math.sign(centerX);sides.add(side);
    assert.ok(points.some(p=>Math.abs(p[0])===4.5&&p[1]===4),'bank joins the authored road edge');
    assert.ok(points.some(p=>Math.abs(p[0])===7.5&&p[1]<4),'bank slopes down toward the outer terrain');
    for(const normal of normals){
      assert.ok(normal[0]*side>0,'bank surface normal points away from the straight road');
      near(Math.hypot(...normal),1,'unit surface normal');
      const overheadLambert=Math.max(0,normal[1]);
      assert.ok(overheadLambert>0,'a light directly above must illuminate the bank, not only ambient light');
      assert.ok(overheadLambert<1,'the sloping bank receives less overhead diffuse light than the flat road');
    }
  }
  assert.deepEqual([...sides].sort(),[-1,1],'left and right slopes are checked');
});

for(const bank of [-.4,.4]){
  test(`constant ${bank} radian bank measures offsets in the sloped surface, including joins and endpoints`,()=>{
    const recipe=straightRecipe([5,18,9,12]);for(const knot of recipe.road)knot.bank=bank;
    const road=new ScenicRoad(recipe),distances=new Set([0,1.1572265625,15,45,road.length]);
    for(const station of road.stations())distances.add(station.distance);
    for(const distance of distances)for(const offset of [-2,-1,0,1,2]){
      const sample=road.sample(distance,offset);
      near(sample.position[0],Math.cos(bank)*offset,'banked offset x');
      near(sample.position[1],2+Math.sin(bank)*offset,'banked offset height');
      near(sample.position[2],-distance,'banked forward distance');
      near(sample.normal[0],-Math.sin(bank),'banked normal x');
      near(sample.normal[1],Math.cos(bank),'banked normal y');
      near(sample.normal[2],0,'banked normal z');
    }
  });
}

function sectionBetween(a,b,fraction){
  // Reference locations come from the public rendered-edge data, not road.sample.
  const left=a.left.map((value,i)=>(1-fraction)*value+fraction*b.left[i]);
  const right=a.right.map((value,i)=>(1-fraction)*value+fraction*b.right[i]);
  const span=subtract(right,left),length=Math.hypot(...span);
  return {left,right,halfWidth:length/2,at:offset=>left.map((value,i)=>(value+right[i])/2+span[i]*offset/length)};
}
function geometricHits(triangles,x,z){
  const hits=[];
  for(const triangle of triangles){
    const points=triangle.points,signs=points.map((a,i)=>{const b=points[(i+1)%3];return (b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]);});
    if(!signs.every(value=>value>=-1e-7)&&!signs.every(value=>value<=1e-7))continue;
    const normal=cross(subtract(points[1],points[0]),subtract(points[2],points[0]));
    // Solve the face's plane equation; no shared barycentric helper or sampler.
    const height=points[0][1]-(normal[0]*(x-points[0][0])+normal[2]*(z-points[0][2]))/normal[1];
    hits.push({triangle,height});
  }
  return hits;
}

test('curved changing-bank tapers preserve requested cross-section XZ and lift onto the rendered face',()=>{
  const recipe=straightRecipe([5,18,7,16,9]);
  const authored=[[0,2,0,-.3],[8,4,-40,.35],[12,8,-80,-.2],[-5,10,-125,.4],[0,12,-170,-.1]];
  recipe.road=recipe.road.map((knot,i)=>{const [x,y,z,bank]=authored[i];return {...knot,x,y,z,bank};});
  const road=new ScenicRoad(recipe),stations=road.stations(),triangles=road.triangles();let lifted=0;
  for(let strip=0;strip<stations.length-1;strip++)for(const fraction of [0,.17,.5,.83,1]){
    const a=stations[strip],b=stations[strip+1],distance=a.distance+(b.distance-a.distance)*fraction,section=sectionBetween(a,b,fraction);
    for(const offset of [-2,0,2]){
      const requested=section.at(offset),sample=road.sample(distance,offset);
      near(sample.position[0],requested[0],'curved cross-section x');near(sample.position[2],requested[2],'curved cross-section z');
      const hits=geometricHits(triangles,requested[0],requested[2]);assert.ok(hits.length,'reference XZ is on a rendered triangle');
      const hit=hits.find(candidate=>candidate.triangle.surfaceId===sample.surfaceId&&candidate.triangle.triangle===sample.triangle&&Math.abs(candidate.height-sample.position[1])<=2e-6);
      assert.ok(hit,'contact height solves the selected rendered face plane');
      const vertical=road.sampleAt(requested[0],requested[2],{surfaceId:sample.surfaceId});assert.ok(vertical);
      near(sample.position[1],vertical.position[1],'vertical query agrees at curved offset');
      if(Math.abs(requested[1]-sample.position[1])>1e-4)lifted++;
    }
  }
  assert.ok(lifted>10,'fixture exercises nonplanar strips where cross-section interpolation needs a real face lift');
});

test('actual rendered half-width admits only a bounded Float32 edge clamp and keeps strict distance bounds',()=>{
  const recipe=straightRecipe([5,5,5,5]);for(const knot of recipe.road){knot.x=1000;knot.bank=.4;}
  const road=new ScenicRoad(recipe),stations=road.stations();
  // Large coordinates make the rendered Float32 half-width differ from nominal 2.5m.
  const halfWidth=sectionBetween(stations[0],stations[1],0).halfWidth;
  assert.ok(Math.abs(halfWidth-2.5)>1e-7,'fixture exercises rounded physical width');
  for(const station of [stations[0],stations[Math.floor(stations.length/2)],stations.at(-1)]){
    const section=sectionBetween(station,station,0);
    for(const side of [-1,1]){
      const edge=side<0?section.left:section.right;
      for(const extra of [0,1e-4,1.99e-4]){
        const sample=road.sample(station.distance,side*(section.halfWidth+extra));
        for(let axis=0;axis<3;axis++)near(sample.position[axis],edge[axis],'bounded edge clamp');
      }
      assert.throws(()=>road.sample(station.distance,side*(section.halfWidth+2.01e-4)),/outside road/);
      const inside=road.sample(station.distance,side*(section.halfWidth-3e-4));
      assert.ok(Math.abs(inside.position[0]-edge[0])>2e-4,'admitted interior offsets retain their position');
    }
  }
  assert.throws(()=>road.sample(-1e-8),/road distance/);
  assert.throws(()=>road.sample(road.length+1e-8),/road distance/);
  const wide=new ScenicRoad(straightRecipe([18,18,18,18]));
  for(const side of [-1,1]){
    near(wide.sample(0,side*9).position[0],side*9,'public lateral limit is usable');
    assert.throws(()=>wide.sample(0,side*(9+1e-8)),/lateral offset/);
  }
});

test('concave tapered strips are rejected even when their individual triangle normals face up',()=>{
  const recipe=straightRecipe([5,18,18,18]);
  const xz=[[0,0],[-8.833271300082226,1.4429160981628066],[-16.58075887550349,-2.8959320215716358],[-27.65319739124562,-16.874510625087453]];
  recipe.road=recipe.road.map((knot,i)=>({...knot,x:xz[i][0],y:0,z:xz[i][1]}));
  assert.throws(()=>validateScenery(recipe),/convex/);
  assert.throws(()=>new ScenicRoad(recipe),/convex/);
});
