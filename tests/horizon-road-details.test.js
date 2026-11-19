// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceRoadDetails} from '../demos/horizon-lab/race-road-details.js';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession} from '../demos/horizon-lab/race-model.js';
import {locateOnRoad} from '../demos/horizon-lab/race-course.js';
import {validateLitMaterial} from '../modules/render-lit/index.js';

test('roadside details are deterministic, bounded and never enter native physics',()=>{
  const input=starterRaceProject(),race=createRaceSession(input),before=race.world.physics.sampleSurface(0,0,2000),
    world=JSON.stringify(race.world.stats),project=JSON.stringify(race.project);
  const high=createRaceRoadDetails(race.road,'high',input.scenery.environment),
    same=createRaceRoadDetails(race.road,'high',input.scenery.environment),
    low=createRaceRoadDetails(race.road,'low',input.scenery.environment);
  assert.deepEqual(high,same,'same authored route gives exact Float32 bytes and stable batch order');
  assert.ok(high.postPairs>2&&high.warningSigns>=1,'coast race has roadside posts and turn chevrons');
  assert.ok(high.postPairs>=low.postPairs&&high.vertices>low.vertices);
  assert.ok(high.vertices>0&&high.vertices<=20000&&high.batches.length<=48);
  assert.deepEqual(race.world.physics.sampleSurface(0,0,2000),before);
  assert.equal(JSON.stringify(race.world.stats),world);
  assert.equal(JSON.stringify(race.project),project);
  assert.ok(high.batches.every(b=>b.detailKind&&b.id.startsWith('race-detail-')));
  let lastChunk=-1,lastKind=-1;
  for(const b of high.batches){
    const [, ,chunk,kind]=b.id.split('-'),index=['posts','reflectors','signs','ink'].indexOf(kind);
    assert.ok(Number(chunk)>=lastChunk);
    if(Number(chunk)===lastChunk)assert.ok(index>lastKind);else lastKind=-1;
    lastKind=index;lastChunk=Number(chunk);
    assert.equal(b.vertices.length%33,0);
    assert.ok(b.vertices.every(Number.isFinite));
    assert.ok(b.visibilityBounds.radius>0);
    assert.doesNotThrow(()=>validateLitMaterial(b.material));
    for(let i=0;i<b.vertices.length;i+=11){
      assert.ok(Math.abs(Math.hypot(b.vertices[i+3],b.vertices[i+4],b.vertices[i+5])-1)<1e-5);
      for(let c=6;c<=8;c++)assert.ok(b.vertices[i+c]>=0&&b.vertices[i+c]<=1);
    }
  }
});

test('a validated 2400 m horizontal course may have a longer graded 3D spline',()=>{
  const project=structuredClone(starterRaceProject());
  project.scenery.road=Array.from({length:13},(_,i)=>({
    id:'graded-'+i,x:-1200+i*200,y:i*10,z:0,width:10,bank:0,
    structure:'ground',surface:'asphalt'
  }));
  const race=createRaceSession(project),snapshot=race.snapshot(),
    originalSupport=race.world.physics.sampleSurface(0,0,2000);
  assert.ok(race.road.length>2400,'the admitted 3D spline is longer than the horizontal knot limit');
  for(const profile of ['low','high']){
    const details=createRaceRoadDetails(race.road,profile,'coast');
    assert.ok(details.postPairs>0&&details.vertices>0);
    assert.ok(details.vertices<=20000&&details.batches.length<=48);
    assert.deepEqual(details,createRaceRoadDetails(race.road,profile,'coast'));
  }
  assert.deepEqual(race.snapshot(),snapshot,'decorative placement never alters the race');
  assert.deepEqual(race.world.physics.sampleSurface(0,0,2000),originalSupport);
});

test('bend-warning boards stand on the outer shoulder for both turn signs',()=>{
  const observed=new Set();
  for(const mirrored of [false,true]){
    const project=structuredClone(starterRaceProject());
    if(mirrored)for(const knot of project.scenery.road)knot.x=-knot.x;
    const race=createRaceSession(project),details=createRaceRoadDetails(race.road,'high','coast');
    const panels=details.batches.filter(batch=>batch.detailKind==='signs');
    assert.ok(panels.length>0,'the actual course must produce warning signs');
    for(const panel of panels)for(let start=0;start<panel.vertices.length;start+=66){
      const vertices=panel.vertices,center=[0,1,2].map(axis=>{
        let sum=0;for(let v=0;v<6;v++)sum+=vertices[start+v*11+axis];return sum/6;
      });
      const location=locateOnRoad(race.road,center,race.rows),distance=location.distance;
      const prev=race.road.sample(Math.max(0,distance-10),0).position,
        mid=race.road.sample(distance,0).position,
        next=race.road.sample(Math.min(race.road.length,distance+10),0).position,
        a=[mid[0]-prev[0],mid[2]-prev[2]],b=[next[0]-mid[0],next[2]-mid[2]],
        turn=a[0]*b[1]-a[1]*b[0];
      assert.ok(Math.abs(turn)>1e-7,'a sign must correspond to a genuine bend');
      assert.equal(Math.sign(location.lateral),-Math.sign(turn),
        'the sign must be outside the bend rather than on its inside shoulder');
      assert.ok(Math.abs(location.lateral)>location.width/2,
        'the sign must clear the authored road edge');
      observed.add(Math.sign(turn));
    }
  }
  assert.deepEqual([...observed].sort((a,b)=>a-b),[-1,1],
    'mirroring the road must exercise both left-hand and right-hand bends');
});

test('decorative rendering preserves scene/world identity for each environment and profile',()=>{
  for(const environment of ['coast','alpine','dusk'])for(const profile of ['low','high']){
    const p=structuredClone(starterRaceProject());p.scenery.environment=environment;p.scenery.profile=profile;
    const race=createRaceSession(p),start=race.snapshot(),before=race.world.batches;
    const details=createRaceRoadDetails(race.road,profile,environment);
    assert.ok(details.batches.length>0);
    assert.deepEqual(race.snapshot(),start);
    assert.strictEqual(race.world.batches,before);
  }
});

test('malformed budgets and missing road methods are rejected',()=>{
  for(const value of [null,{}, {sample(){},length:5}])assert.throws(()=>createRaceRoadDetails(value));
  const race=createRaceSession(starterRaceProject());
  assert.throws(()=>createRaceRoadDetails(race.road,'ultra'));
  assert.throws(()=>createRaceRoadDetails(race.road,'high','unknown'));
});

test('first roadside reflectors remain attached to road-based bollards',()=>{
  const race=createRaceSession(starterRaceProject()),details=createRaceRoadDetails(race.road,'high','coast');
  const post=details.batches.find(b=>b.detailKind==='posts'),reflector=details.batches.find(b=>b.detailKind==='reflectors');
  assert.ok(post&&reflector);
  const points=data=>Array.from({length:data.length/11},(_,i)=>Array.from(data.slice(i*11,i*11+3)));
  const body=points(post.vertices.slice(0,36*11)),panels=points(reflector.vertices.slice(0,12*11));
  const base=race.road.sample(18,-Math.min(race.road.sample(18).width/2-.2,8.8)).position[1];
  assert.ok(Math.abs(Math.min(...body.map(p=>p[1]))-base)<.001,'post starts at the banked road edge');
  assert.ok(Math.abs(Math.max(...body.map(p=>p[1]))-(base+1.1))<.001);
  assert.ok(panels.every(p=>p[1]>base+.6&&p[1]<base+.94),'retroreflectors stay on the visible post');
});
