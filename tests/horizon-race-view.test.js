// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {raceCamera,raceRig,raceMatrix,raceGateTransforms,raceGateMesh,RaceCameraFilter,RaceView} from '../demos/horizon-lab/race-view.js';
import {starterRaceProject,raceVehicleForClass} from '../demos/horizon-lab/race-project.js';
import {createVehicle} from '../modules/vehicle3d/index.js';
import {buildVehicleVisual,ScenicRoad} from '../modules/scenic3d/index.js';
import {rotate} from '../modules/math/index.js';
import {createRaceCheckpoints} from '../demos/horizon-lab/race-course.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≈ ${b}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>a.map(v=>v/Math.hypot(...a));
const frozen=v=>{if(v&&typeof v==='object'){for(const child of Object.values(v))frozen(child);Object.freeze(v);}return v;};
test('race camera modes have distinct owned positions without changing vehicle state',()=>{const p=starterRaceProject(),state=createVehicle(p.vehicle).spawn({position:[4,8,-20],yaw:.4}),before=structuredClone(state),views=['chase','bonnet','cockpit'].map(mode=>raceCamera(state,p.camera,mode));assert.equal(new Set(views.map(v=>JSON.stringify(v.position))).size,3);for(const v of views){assert.ok([...v.position,...v.target].every(Number.isFinite));assert.ok(Math.hypot(...v.target.map((x,i)=>x-v.position[i]))>5);}assert.deepEqual(state,before);});
test('all three original class rigs put wheel meshes at authoritative hubs and preserve axle scale',()=>{for(const id of ['sport','touring','utility']){const recipe=raceVehicleForClass(id),visual=buildVehicleVisual(id),state=createVehicle(recipe).spawn({position:[3,8,-9],yaw:.4});state.steering=.2;state.wheelSpin=-2;const rig=raceRig(state,recipe,visual.dimensions);for(let i=0;i<4;i++){for(let k=0;k<3;k++)near(rig.wheels[i][12+k],state.wheels[i].position[k]);near(Math.hypot(rig.wheels[i][4],rig.wheels[i][5],rig.wheels[i][6]),recipe.wheel.radius/visual.dimensions.wheelRadius);}const up=rotate(state.orientation,[0,recipe.wheel.radius+recipe.suspension.restLength,0]);for(let k=0;k<3;k++)near(rig.body[12+k],state.position[k]-up[k]);}});
test('right steering rotates only the two front wheels and leaves body pose independent',()=>{const p=starterRaceProject(),visual=buildVehicleVisual('sport'),state=createVehicle(p.vehicle).spawn(),before=raceRig(state,p.vehicle,visual.dimensions);state.steering=.3;const after=raceRig(state,p.vehicle,visual.dimensions);assert.deepEqual(before.body,after.body);assert.notDeepEqual(before.wheels[0],after.wheels[0]);assert.notDeepEqual(before.wheels[1],after.wheels[1]);assert.deepEqual(before.wheels[2],after.wheels[2]);assert.deepEqual(before.wheels[3],after.wheels[3]);});
test('race affine transform keeps position and orthogonal scaled quaternion axes',()=>{const q=[0,Math.sin(.3),0,Math.cos(.3)],m=raceMatrix([2,3,4],q,[2,3,4]);assert.deepEqual(Array.from(m.slice(12)),[2,3,4,1]);near(Math.hypot(m[0],m[1],m[2]),2);near(Math.hypot(m[4],m[5],m[6]),3);near(Math.hypot(m[8],m[9],m[10]),4);near(m[0]*m[8]+m[1]*m[9]+m[2]*m[10],0);});

test('checkpoint posts and crossbar follow the banked graded gate plane',()=>{const normal=[-.3,.9,.2],n=Math.hypot(...normal),gate={position:[4,20,-60],right:[1,0,0],normal:normal.map(v=>v/n),halfWidth:7};const poses=raceGateTransforms(gate);for(let i=0;i<2;i++){const p=Array.from(poses[i].slice(12,15)).map((v,k)=>v-gate.normal[k]*2.2-gate.position[k]);near(p.reduce((v,x,k)=>v+x*gate.normal[k],0),0);near(p[0],(i===0?-1:1)*7);assert.notEqual(p[1],0);}const bar=poses[2];for(let k=0;k<3;k++)near(bar[12+k],gate.position[k]+gate.normal[k]*4.4);});

test('camera filtering owns its output and never advances from repeated paused redraws',()=>{
  const settings=frozen(structuredClone(starterRaceProject().camera)),model=createVehicle(),initial=frozen(model.spawn({position:[3,8,-20],yaw:.2})),before=structuredClone(initial),filter=new RaceCameraFilter();
  assert.deepEqual(filter.sample(initial,settings),raceCamera(initial,settings));
  const next=frozen({...structuredClone(initial),tick:8,position:[3,8.18,-20]}),nextBefore=structuredClone(next),camera=filter.sample(next,settings);
  assert.notDeepEqual(camera,raceCamera(next,settings),'vertical suspension presentation is damped');
  for(let i=0;i<40;i++)assert.deepEqual(filter.sample(next,settings),camera,'paused draws cannot continue interpolation');
  const exposed=filter.sample(next,settings);exposed.position.fill(999);exposed.target.fill(-999);assert.deepEqual(filter.sample(next,settings),camera,'returned arrays do not alias retained camera state');
  assert.deepEqual(initial,before);assert.deepEqual(next,nextBefore);
});

test('chase damping suppresses vertical jitter while retaining horizontal vehicle translation',()=>{
  const settings=starterRaceProject().camera,state=createVehicle().spawn({position:[0,8,-20]}),filter=new RaceCameraFilter(),first=filter.sample(state,settings);let largest=0;
  for(let i=1;i<=120;i++){
    const sample={...state,tick:i*2,position:[i*.02,8+(i%2?.18:-.18),-20-i*.08]},actual=filter.sample(sample,settings),desired=raceCamera(sample,settings);
    near(actual.position[0],desired.position[0]);near(actual.position[2],desired.position[2]);near(actual.target[0],desired.target[0]);near(actual.target[2],desired.target[2]);largest=Math.max(largest,Math.abs(actual.position[1]-first.position[1]));
  }
  assert.ok(largest<.18*.15,'120 Hz vertical chatter is visibly damped without camera/vehicle horizontal lag');
});

test('held-target damping is equivalent across supported render cadences and respects internal 240 Hz ticks',()=>{
  const settings=starterRaceProject().camera,state=createVehicle().spawn({position:[0,8,-20]}),target={...state,position:[0,8.3,-20],orientation:[0,Math.sin(.1),0,Math.cos(.1)]};
  const run=hz=>{const filter=new RaceCameraFilter();filter.sample(state,settings);let camera;for(let i=1;i<=hz;i++)camera=filter.sample({...target,tick:i*240/hz},settings);return camera;};
  const reference=run(30);for(const hz of [60,120])for(const field of ['position','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(run(hz)[field][i]-reference[field][i])<1e-12);
  const filter=new RaceCameraFilter(),old=filter.sample(state,settings),actual=filter.sample({...target,tick:24},settings),desired=raceCamera(target,settings);
  for(const field of ['position','target'])for(let i=0;i<3;i++)near(actual[field][i],desired[field][i]+(old[field][i]-desired[field][i])*Math.exp(-1));
});

test('camera reset, backwards ticks, large recovery, settings and each mode snap to their owned view',()=>{
  const settings=starterRaceProject().camera,state=createVehicle().spawn({position:[0,8,-20]}),filter=new RaceCameraFilter(),settled={...state,tick:40,position:[0,8.3,-20]};
  filter.sample(state,settings);filter.sample(settled,settings);filter.reset();assert.deepEqual(filter.sample(settled,settings),raceCamera(settled,settings));
  assert.deepEqual(filter.sample(state,settings),raceCamera(state,settings),'restart resets tick history');
  const moved={...settled,position:[9,8.3,-20]};assert.deepEqual(filter.sample(moved,settings),raceCamera(moved,settings),'large recovery must not ease across the world');
  for(const mode of ['bonnet','cockpit','chase'])assert.deepEqual(filter.sample(moved,settings,mode),raceCamera(moved,settings,mode));
  const changed={...settings,chaseHeight:settings.chaseHeight+1};assert.deepEqual(filter.sample(moved,changed),raceCamera(moved,changed));
});

// Independent old unit-cube face coordinates; no renderer normal helper or new
// mesh implementation is used to derive the reference structural triangles.
const cubeFaces=[
  [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],
  [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
  [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],
  [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],
  [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]],
  [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]
];
function referenceGateVertices(gate){
  const data=[];
  for(const matrix of raceGateTransforms(gate))for(const face of cubeFaces){
    const points=face.map(p=>[0,1,2].map(k=>matrix[k]*p[0]+matrix[k+4]*p[1]+matrix[k+8]*p[2]+matrix[k+12])),normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
    for(const index of [0,1,2,0,2,3])data.push(...points[index],...normal,1,1,1,0,0);
  }
  return new Float32Array(data);
}
function fixtureGate(finish=false){const direction=unit([.3,0,-1]);return {id:finish?'finish':'gate',position:[4,20,-60],normal:unit([-.3,.9,.2]),direction,right:[-direction[2],0,direction[0]],halfWidth:7.3,finish};}

test('retained gate mesh preserves all 108 old structural vertices and inverse-transpose normals',()=>{
  const road=new ScenicRoad(starterRaceProject().scenery),gates=[{...fixtureGate(),normal:[0,1,0]},fixtureGate(),...createRaceCheckpoints(road)];
  for(const gate of gates){const before=structuredClone(gate),expected=referenceGateVertices(gate),actual=raceGateMesh(frozen(gate));assert.equal(expected.length,108*11);
    for(let i=0;i<expected.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<2e-6,`structural ${gate.id} field ${i}: ${actual[i]} ≈ ${expected[i]}`);
    assert.deepEqual(gate,before);
  }
});

test('gate decorations are finite, bounded, outward triangles on the graded gate plane',()=>{
  for(const finish of [false,true]){const gate=fixtureGate(finish),data=raceGateMesh(gate),expectedVertices=108+(finish?24*6:12*6+9);assert.equal(data.length,expectedVertices*11);assert.ok(data.every(Number.isFinite));
    const upward=gate.normal,right=[gate.right[0],-(upward[0]*gate.right[0]+upward[2]*gate.right[2])/upward[1],gate.right[2]],outward=unit(cross(right,upward));
    for(let at=108*11;at<data.length;at+=33){const points=[0,11,22].map(offset=>Array.from(data.slice(at+offset,at+offset+3))),geometric=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));assert.ok(dot(geometric,gate.direction)<-.9,'front decoration faces approaching traffic');assert.ok(dot(geometric,outward)>.999999);
      for(let i=0;i<3;i++){const normal=Array.from(data.slice(at+i*11+3,at+i*11+6)),delta=sub(points[i],gate.position);assert.ok(dot(normal,geometric)>.999999,'authored normals must follow actual triangle winding on slopes');near(Math.hypot(...normal),1);assert.ok(Math.abs(dot(delta,outward)-.12)<3e-6,'decoration stays on its explicit offset plane');assert.ok(Math.hypot(...delta)<11,'decoration cannot create unbounded mesh extents');for(let c=6;c<9;c++)assert.ok(data[at+i*11+c]>=0&&data[at+i*11+c]<=1);}
    }
  }
});

test('race view retains one mesh per gate across redraws and snaps short-distance paused recovery',()=>{
  // Resource-call spy only: native GPU execution is covered by packaged Chromium.
  const project=structuredClone(starterRaceProject());project.scenery.profile='low';const checkpoints=createRaceCheckpoints(new ScenicRoad(project.scenery)),handles=new Set(),calls={uploads:0,draws:[]};
  const renderer={stats(){return {vertices:[...handles].reduce((n,h)=>n+h.data.length/11,0),meshes:handles.size};},mesh(data){const handle={data};handles.add(handle);calls.uploads++;return handle;},deleteMesh(handle){assert.ok(handles.delete(handle));},begin(){calls.draws=[];},draw(handle){assert.ok(handles.has(handle));calls.draws.push(handle);}};
  const view=Object.assign(Object.create(RaceView.prototype),{renderer,project,rows:[],carRows:[],gateRows:[],cameraFilter:new RaceCameraFilter(),frames:0}),world={batches:[],stats:{}};
  view.replace(project,world,checkpoints);assert.equal(view.gateRows.length,checkpoints.length);assert.equal(view.carRows.length,13);assert.equal(handles.size,13+checkpoints.length);const uploads=calls.uploads,gateHandles=view.gateRows.map(row=>row.handle);
  const model=createVehicle(project.vehicle),player=model.spawn({position:[0,8,-20]}),rival=model.spawn({position:[2,8,-22]}),session={player:frozen(player),rival:frozen(rival),progress:{checkpointIndex:0,recoveries:0}},before=structuredClone(session);view.draw(session);
  assert.equal(calls.draws.length,26+checkpoints.length);for(const handle of gateHandles)assert.equal(calls.draws.filter(value=>value===handle).length,1,'each decorated gate consumes one draw');
  const moving={...session,player:frozen({...structuredClone(player),tick:24,position:[0,8.3,-21]})};view.draw(moving);const paused=structuredClone(view.lastCamera);for(let i=0;i<5;i++){view.draw(moving);assert.deepEqual(view.lastCamera,paused);}assert.equal(calls.uploads,uploads);assert.deepEqual(session,before);
  const recovered={...moving,player:frozen({...structuredClone(player),tick:24}),progress:{checkpointIndex:0,recoveries:1}};assert.ok(Math.hypot(...sub(recovered.player.position,moving.player.position))<5);view.draw(recovered);assert.deepEqual(view.lastCamera,raceCamera(recovered.player,project.camera),'same-tick near recovery snaps without waiting for physics');view.draw(recovered);assert.deepEqual(view.lastCamera,raceCamera(recovered.player,project.camera));
  view.replace(project,world,checkpoints);assert.equal(calls.uploads,uploads);assert.deepEqual(view.gateRows.map(row=>row.handle),gateHandles,'unchanged authoring replacement reuses accepted meshes');
});

test('failed combined scenery, vehicle and gate replacement preserves the accepted drawable view without leaking staged handles',()=>{
  // Inject a late resource failure after new scenery, all car parts and one gate
  // have allocated. This distinguishes transactional replacement from validating
  // only each individual mesh upload (covered by the renderer's own tests).
  const project=structuredClone(starterRaceProject());project.scenery.profile='low';
  const checkpoints=createRaceCheckpoints(new ScenicRoad(project.scenery)),live=new Set(),drawn=[];let attempted=0,failAt=Infinity;
  const renderer={stats(){return {vertices:[...live].reduce((n,h)=>n+h.data.length/11,0),meshes:live.size};},mesh(data){if(++attempted===failAt)throw Error('injected resource exhaustion');const handle={data:new Float32Array(data)};live.add(handle);return handle;},deleteMesh(handle){assert.ok(live.delete(handle),'only a live owned handle can be deleted');},begin(){drawn.length=0;},draw(handle){assert.ok(live.has(handle),'accepted resources remain drawable');drawn.push(handle);}};
  const triangle=new Float32Array([-1,0,0,0,1,0,1,1,1,0,0, 0,0,1,0,1,0,1,1,1,.5,1, 1,0,0,0,1,0,1,1,1,1,0]),world={batches:[{id:'test-terrain',vertices:triangle,material:{color:[.3,.4,.2]}}],stats:{}},view=Object.assign(Object.create(RaceView.prototype),{renderer,project,rows:[],carRows:[],gateRows:[],cameraFilter:new RaceCameraFilter(),frames:0});
  view.replace(project,world,checkpoints);const acceptedHandles=[...live],acceptedBytes=acceptedHandles.map(handle=>[...handle.data]),acceptedRows=view.rows,acceptedCars=view.carRows,acceptedGates=view.gateRows,acceptedMap=view.carMap;
  const model=createVehicle(project.vehicle),session={player:frozen(model.spawn({position:[0,8,-20]})),rival:frozen(model.spawn({position:[2,8,-22]})),progress:{checkpointIndex:0,recoveries:0}};view.draw(session);const acceptedCamera=structuredClone(view.lastCamera);
  const replacement=structuredClone(project);replacement.scenery.name='Replacement scene';replacement.appearance.paint=[.5,.3,.7];replacement.race.checkpointCount=9;
  const nextGates=createRaceCheckpoints(new ScenicRoad(replacement.scenery),9),nextWorld={batches:[{...world.batches[0],vertices:triangle.map((value,i)=>i%11===1?value+.1:value)}],stats:{}};
  failAt=attempted+1+13+2;assert.throws(()=>view.replace(replacement,nextWorld,nextGates),/injected resource exhaustion/);
  assert.deepEqual([...live],acceptedHandles,'all staged allocations are cleaned and every accepted handle survives');assert.deepEqual(acceptedHandles.map(handle=>[...handle.data]),acceptedBytes);
  assert.equal(view.project,project);assert.equal(view.world,world);assert.equal(view.checkpoints,checkpoints);assert.equal(view.rows,acceptedRows);assert.equal(view.carRows,acceptedCars);assert.equal(view.gateRows,acceptedGates);assert.equal(view.carMap,acceptedMap);view.draw(session);assert.deepEqual(view.lastCamera,acceptedCamera);assert.equal(drawn.length,1+26+checkpoints.length);
  failAt=Infinity;view.replace(replacement,nextWorld,nextGates);assert.equal(live.size,1+13+nextGates.length);assert.ok(acceptedHandles.every(handle=>!live.has(handle)),'successful retry releases all superseded resources exactly once');assert.equal(view.project,replacement);assert.equal(view.world,nextWorld);assert.equal(view.checkpoints,nextGates);view.draw(session);assert.equal(drawn.length,1+26+nextGates.length);
});
