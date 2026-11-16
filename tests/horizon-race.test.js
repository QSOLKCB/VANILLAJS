// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {RACE_PROJECT_FORMAT,RACE_PROJECT_BYTES,starterRaceProject,raceVehicleForClass,validateRaceProject,parseRaceProject,serializeRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession,raceDriverInput} from '../demos/horizon-lab/race-model.js';
import {createRaceCheckpoints,crossesRaceCheckpoint,locateOnRoad,raceRoadStatus} from '../demos/horizon-lab/race-course.js';
import {ScenicRoad} from '../modules/scenic3d/index.js';
const clone=v=>structuredClone(v);
function run(session,seconds,input={brake:1},dt=1/120){for(let i=0;i<Math.round(seconds/dt);i++)session.step(input,dt);}

test('race study strictly owns versioned scenery, complete vehicle, camera, appearance and audio data',()=>{
  const source=starterRaceProject(),accepted=validateRaceProject(source),bytes=serializeRaceProject(accepted);assert.equal(accepted.format,RACE_PROJECT_FORMAT);assert.deepEqual(parseRaceProject(bytes),accepted);
  source.appearance.paint[0]=0;source.camera.fov=1.2;source.race.rivalSpeed=18;assert.equal(serializeRaceProject(accepted),bytes);
  for(const id of ['sport','touring','utility']){const recipe=raceVehicleForClass(id);assert.ok(recipe.wheel.track<recipe.chassis.width);assert.ok(recipe.wheel.wheelbase<recipe.chassis.length);assert.ok(recipe.suspension.spring*recipe.suspension.travel>recipe.mass*9.81/4);}
  const invalid=[v=>v.version=2,v=>v.format='qsol.vanillajs.track.v1',v=>v.script='execute',v=>v.camera.url='https://example.test',v=>v.appearance.paint=[1,2,0],v=>v.appearance.classId='ferrari',v=>v.race.rivalSpeed=100,v=>v.race.checkpointCount=4.1,v=>v.scenery.road[0].width=9,v=>v.scenery.road[1].bank=1,v=>v.vehicle.engine.torqueCurve[0][1]=-1,v=>v.audio.engineGain=20,v=>v.surfaces.asphalt=NaN];
  for(const mutate of invalid){const candidate=clone(starterRaceProject());mutate(candidate);assert.throws(()=>validateRaceProject(candidate));}
  let reads=0;const malicious=starterRaceProject();Object.defineProperty(malicious.camera,'fov',{get(){reads++;return 1;}});assert.throws(()=>validateRaceProject(malicious));assert.equal(reads,0);
  const array=starterRaceProject();Object.defineProperty(array.appearance.paint,0,{get(){reads++;return 1;}});assert.throws(()=>validateRaceProject(array));assert.equal(reads,0);
  const sparse=starterRaceProject();delete sparse.appearance.paint[1];assert.throws(()=>validateRaceProject(sparse));assert.throws(()=>parseRaceProject(' '.repeat(RACE_PROJECT_BYTES+1)));assert.throws(()=>raceVehicleForClass('unknown'));assert.equal(serializeRaceProject(accepted),bytes);
});

test('original race route has elevation, banking, bridge and tunnel, with identical low/high gate geometry',()=>{
  const high=starterRaceProject(),low=clone(high);low.scenery.profile='low';const a=new ScenicRoad(high.scenery),b=new ScenicRoad(low.scenery);assert.deepEqual(a.triangles(),b.triangles());assert.deepEqual(createRaceCheckpoints(a),createRaceCheckpoints(b));
  assert.ok(high.scenery.road.some(k=>k.structure==='bridge'));assert.ok(high.scenery.road.some(k=>k.structure==='tunnel'));assert.ok(Math.max(...high.scenery.road.map(k=>k.y))-Math.min(...high.scenery.road.map(k=>k.y))>=15);assert.ok(high.scenery.road.some(k=>Math.abs(k.bank)>.04));
  const gates=createRaceCheckpoints(a);assert.equal(gates.length,8);assert.equal(gates.at(-1).finish,true);for(let i=0;i<gates.length;i++){const gate=gates[i];assert.ok(gate.halfWidth<=8);assert.ok(gate.distance>(gates[i-1]?.distance??12));assert.ok(gate.normal[1]>.9);assert.ok(Math.abs(Math.hypot(...gate.direction)-1)<1e-12);assert.deepEqual(gate.position,a.sample(gate.distance).position);}
});

test('checkpoint crossing rejects wrong direction, stationary, distant, airborne and shortcut sweeps',()=>{
  const gate={position:[0,4,0],direction:[0,0,-1],right:[1,0,0],normal:[0,1,0],halfWidth:7.3,altitudeMin:-.3,altitudeMax:2.8};
  assert.equal(crossesRaceCheckpoint(gate,[0,4.7,.2],[0,4.7,-.2]),true);
  for(const [before,after] of [[[0,4.7,-.2],[0,4.7,.2]],[[0,4.7,0],[0,4.7,0]],[[9,4.7,.2],[9,4.7,-.2]],[[0,20,.2],[0,20,-.2]],[[0,1,.2],[0,1,-.2]],[[0,4.7,50],[0,4.7,-50]]])assert.equal(crossesRaceCheckpoint(gate,before,after),false);
  assert.throws(()=>crossesRaceCheckpoint(gate,[0,NaN,0],[0,4,0]));assert.throws(()=>crossesRaceCheckpoint(gate,[0,4,1],[0,4,-1],100));
});

test('countdown, stationary controls, rejected transitions, explicit recovery and reset preserve progression',()=>{
  const session=createRaceSession(starterRaceProject());assert.equal(session.phase,'ready');assert.throws(()=>{session.player.position[2]=-400;});run(session,1,{throttle:1});assert.equal(session.time,0);session.start();run(session,2,{throttle:1});assert.equal(session.phase,'countdown');assert.equal(session.time,0);assert.equal(session.progress.checkpointIndex,0);run(session,1,{throttle:1});assert.equal(session.phase,'running');assert.equal(session.time,0);
  run(session,1);assert.equal(session.progress.checkpointIndex,0);const accepted=session.snapshot();assert.throws(()=>session.step({throttle:NaN}));assert.throws(()=>session.step({},1/30));assert.deepEqual(session.snapshot(),accepted);
  assert.equal(session.recover(),true);assert.equal(session.progress.checkpointIndex,0);assert.equal(session.progress.recoveries,1);assert.equal(session.progress.penaltySeconds,4);assert.equal(session.time,1);
  session.reset();assert.equal(session.phase,'ready');assert.equal(session.progress.recoveries,0);assert.equal(session.time,0);assert.equal(session.result,null);assert.equal(session.recover(),false);
  const damaged=clone(session.project);damaged.scenery.road[1].x=damaged.scenery.road[0].x;damaged.scenery.road[1].z=damaged.scenery.road[0].z;assert.throws(()=>createRaceSession(damaged));assert.equal(session.phase,'ready');assert.equal(session.progress.checkpointIndex,0);
});

test('player integration uses identical physics quanta under different supplied render cadences',()=>{
  const project=starterRaceProject();project.race.countdownSeconds=0;const a=createRaceSession(project),b=createRaceSession(project);a.start();b.start();const input={throttle:.8,steer:.08};run(a,2,input,1/120);run(b,2,input,1/60);assert.deepEqual(a.player,b.player);assert.deepEqual(a.progress,b.progress);assert.equal(a.time,b.time);
});

test('physical route drivers complete all ordered checkpoints and rival wins against a slower player',()=>{
  const session=createRaceSession(starterRaceProject());session.start();let maxPlayerStep=0,maxRivalStep=0,maxElevation=-Infinity,minElevation=Infinity,lastPlayer=0,lastRival=0;
  for(let i=0;i<4500&&session.phase!=='finished';i++){
    const previous=clone(session.player.position),rivalPrevious=clone(session.rival.position);session.step(raceDriverInput(session.road,session.player,session.project.vehicle,{speed:8,lateral:-2,rows:session.rows}),1/60);
    maxPlayerStep=Math.max(maxPlayerStep,Math.hypot(...session.player.position.map((n,k)=>n-previous[k])));maxRivalStep=Math.max(maxRivalStep,Math.hypot(...session.rival.position.map((n,k)=>n-rivalPrevious[k])));maxElevation=Math.max(maxElevation,session.player.position[1]);minElevation=Math.min(minElevation,session.player.position[1]);
    assert.ok(session.progress.checkpointIndex-lastPlayer<=1);assert.ok(session.rivalProgress.checkpointIndex-lastRival<=1);lastPlayer=session.progress.checkpointIndex;lastRival=session.rivalProgress.checkpointIndex;
  }
  assert.equal(session.phase,'finished');assert.equal(session.result,'loss');assert.equal(session.progress.checkpointIndex,8);assert.equal(session.rivalProgress.checkpointIndex,8);assert.equal(session.progress.recoveries,0);assert.equal(session.rivalProgress.recoveries,0);assert.ok(session.rivalProgress.finishTime<session.progress.finishTime);assert.ok(session.progress.finishTime>60&&session.progress.finishTime<65);assert.ok(maxElevation-minElevation>15);assert.ok(maxPlayerStep<.2);assert.ok(maxRivalStep<.2);assert.ok(session.player.tick>12000);assert.equal(session.player.tick,session.rival.tick);
  const finished=session.snapshot();run(session,1,{throttle:1});assert.deepEqual(session.snapshot(),finished);
});

test('binary keyboard-like commands at 66.7 ms intervals can win the real physical race',()=>{
  const session=createRaceSession(starterRaceProject());session.start();let input={},offRoad=false;
  for(let i=0;i<7200&&session.phase!=='finished';i++){
    if(i%8===0){const advice=raceDriverInput(session.road,session.player,session.project.vehicle,{speed:13,lateral:-2,rows:session.rows});input={throttle:advice.throttle>.2?1:0,brake:advice.brake>.2?1:0,steer:Math.abs(advice.steer)>.045?Math.sign(advice.steer):0};}
    session.step(input);offRoad||=session.progress.offRoad;
  }
  assert.equal(session.phase,'finished');assert.equal(session.result,'win');assert.equal(session.progress.checkpointIndex,8);assert.equal(session.progress.recoveries,0);assert.equal(offRoad,false);assert.ok(session.time>40&&session.time<47);
  for(const gate of session.checkpoints)for(const lateral of [-2,0,2]){const road=session.road.sample(gate.distance,lateral),contact=session.world.physics.sampleSurface(road.position[0],road.position[2],road.position[1]+1);assert.ok(contact);assert.ok(Math.abs(contact.height-road.position[1])<1e-5);assert.ok(contact.surfaceId.startsWith('asphalt:'));}
});


test('road status uses the supported banked face rather than centreline altitude',()=>{
  const p=clone(starterRaceProject());p.scenery.road=p.scenery.road.slice(0,4).map((k,i)=>({...k,x:0,y:4,z:-50*i,width:16,bank:.4,structure:'ground'}));const road=new ScenicRoad(p.scenery);
  for(const lateral of [-7,7]){
    const surface=road.sample(60,lateral),com=surface.position.map((n,i)=>n+(i===1?.7:0)),status=raceRoadStatus(road,com);
    assert.equal(status.offRoad,false);assert.ok(Math.abs(status.height-.7*Math.cos(.4))<1e-6);
    if(lateral>0)assert.ok(locateOnRoad(road,com).height>3,'negative control: old centreline-height test rejects a supported banked position');
    assert.equal(raceRoadStatus(road,[com[0],com[1]+5,com[2]]).offRoad,true);
    assert.equal(raceRoadStatus(road,[com[0],com[1]-3,com[2]]).offRoad,true);
  }
  assert.equal(raceRoadStatus(road,[30,4.7,-60]).offRoad,true);
});

function straightRace(){const p=clone(starterRaceProject());p.scenery.road=p.scenery.road.slice(0,4).map((k,i)=>({...k,x:0,y:4,z:-50*i,width:16,bank:0,structure:'ground'}));p.race.countdownSeconds=0;p.race.checkpointCount=4;return p;}

test('reversing and re-crossing a completed gate cannot award another checkpoint or recovery shortcut',()=>{
  const session=createRaceSession(straightRace());session.start();let steps=0;
  while(session.progress.checkpointIndex<1&&steps++<600)session.step({throttle:.8},1/60);
  assert.equal(session.progress.checkpointIndex,1);run(session,3,{brake:1},1/60);steps=0;
  while(session.player.position[2]<-39.5&&steps++<1200)session.step({throttle:.5,gear:-1},1/60);
  assert.ok(session.player.position[2]>-39.5);assert.equal(session.progress.checkpointIndex,1);run(session,3,{brake:1},1/60);steps=0;
  while(session.player.position[2]>-46&&steps++<1200)session.step({throttle:.5,gear:1},1/60);
  assert.ok(session.player.position[2]<-46);assert.equal(session.progress.checkpointIndex,1);const time=session.time;assert.equal(session.recover(),true);assert.equal(session.progress.checkpointIndex,1);assert.equal(session.progress.penaltySeconds,4);assert.equal(session.time,time);assert.ok(Math.abs(session.progress.distance-session.checkpoints[0].distance-2)<1e-8);
  const skipped=session.checkpoints[2],before=skipped.position.map((n,i)=>n-skipped.direction[i]*.2+(i===1?.7:0)),after=skipped.position.map((n,i)=>n+skipped.direction[i]*.2+(i===1?.7:0));assert.equal(crossesRaceCheckpoint(skipped,before,after),true);assert.equal(crossesRaceCheckpoint(session.checkpoints[session.progress.checkpointIndex],before,after),false,'Crossing a later gate is not crossing the required next gate');
});

test('a recovery penalty can change a physical first finish from a win to a loss',()=>{
  const project=straightRace(),plain=createRaceSession(project),penalized=createRaceSession(project);plain.start();penalized.start();penalized.recover();let steps=0;
  while(!plain.progress.finished&&steps++<1500){const input=raceDriverInput(plain.road,plain.player,project.vehicle,{speed:13,lateral:-2,rows:plain.rows});plain.step(input,1/60);penalized.step(input,1/60);}
  assert.equal(plain.phase,'finished');assert.equal(plain.result,'win');assert.deepEqual(plain.player,penalized.player);assert.equal(penalized.progress.finished,true);assert.equal(penalized.rivalProgress.finished,false);assert.equal(penalized.phase,'running');assert.equal(penalized.result,null);assert.equal(penalized.progress.finishTime,plain.progress.finishTime+4);assert.equal(penalized.recover(),false);
  steps=0;while(penalized.phase!=='finished'&&steps++<600)penalized.step({},1/60);
  assert.equal(penalized.phase,'finished');assert.equal(penalized.result,'loss');assert.equal(penalized.rivalProgress.finished,true);assert.ok(penalized.rivalProgress.finishTime<penalized.progress.finishTime);
});
