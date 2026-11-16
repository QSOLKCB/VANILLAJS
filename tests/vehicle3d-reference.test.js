// SPDX-License-Identifier: Apache-2.0
// Independent physical/reference cases. These do not import solver internals.
import test from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLE_STEP,vehiclePreset,createVehicle} from '../modules/vehicle3d/index.js';
import {SCENIC_FORMAT,ScenicRoad} from '../modules/scenic3d/index.js';
import {createCourseScenery,createDriveWorld} from '../demos/horizon-lab/drive-world.js';

const G=9.81;
const copy=value=>JSON.parse(JSON.stringify(value));
const close=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
const speed=state=>Math.hypot(state.velocity[0],state.velocity[2]);
function recipe(){
  const value=copy(vehiclePreset('simulation'));
  value.drag=0;value.tyres.rollingResistance=0;value.engine.engineBrake=0;
  return value;
}
function plane({height=0,slopeX=0,slopeZ=0,friction=1}={}){
  const magnitude=Math.hypot(slopeX,1,slopeZ),normal=[-slopeX/magnitude,1/magnitude,-slopeZ/magnitude];
  return {barriers:[],sampleSurface(x,z,maxY){const y=height+slopeX*x+slopeZ*z;return y<=maxY?{height:y,normal:[...normal],friction,surfaceId:'reference-plane'}:null;}};
}
const equilibrium=value=>value.wheel.radius+value.suspension.restLength-value.mass*G/(4*value.suspension.spring);
function advance(car,state,input,world,seconds,dt=VEHICLE_STEP){
  const steps=Math.round(seconds/dt);assert.ok(Math.abs(steps*dt-seconds)<1e-10,'reference duration must contain whole fixed steps');
  for(let i=0;i<steps;i++)state=car.step(state,input,world,dt);
  return state;
}
function levelStart(car,value,{height=0,velocity=[0,0,0]}={}){return car.spawn({position:[0,height+equilibrium(value),0],velocity});}

test('vehicle reference: four springs support mg and settle at the analytic static compression',()=>{
  for(const multiplier of [1,1.2]){
    const value=recipe();value.mass*=multiplier;const car=createVehicle(value),world=plane();
    const initial=car.spawn({position:[0,equilibrium(value)+.12,0]});
    const state=advance(car,initial,{gear:0},world,5);
    close(state.position[1],equilibrium(value),.004,'static COM height');
    close(state.velocity[1],0,.005,'settled vertical velocity');
    close(state.wheels.reduce((sum,w)=>sum+w.load,0),value.mass*G,value.mass*G*.01,'total support balances weight');
    for(const wheel of state.wheels){
      assert.equal(wheel.grounded,true);
      close(wheel.load,value.mass*G/4,value.mass*G*.003,'equal corner load');
      close(wheel.compression,value.mass*G/(4*value.suspension.spring),.004,'Hooke-law compression');
    }
    assert.deepEqual(initial,car.spawn({position:[0,equilibrium(value)+.12,0]}),'integration owns its output state');
  }
});

test('vehicle reference: suspension damping reduces a displaced body oscillation without creating energy',()=>{
  const dampedRecipe=recipe(),undampedRecipe=recipe();undampedRecipe.suspension.damper=0;
  const damped=createVehicle(dampedRecipe),undamped=createVehicle(undampedRecipe),world=plane();
  let a=damped.spawn({position:[0,equilibrium(dampedRecipe)+.05,0]}),b=undamped.spawn({position:[0,equilibrium(undampedRecipe)+.05,0]});
  const energy=(state,value)=>.5*value.mass*state.velocity[1]**2+2*value.suspension.spring*(state.position[1]-equilibrium(value))**2;
  const initialEnergy=energy(b,undampedRecipe);let peakEnergy=initialEnergy;
  for(let tick=0;tick<480;tick++){
    a=damped.step(a,{gear:0},world);b=undamped.step(b,{gear:0},world);
    peakEnergy=Math.max(peakEnergy,energy(b,undampedRecipe));
  }
  assert.ok(energy(a,dampedRecipe)<initialEnergy*.01,'damped perturbation dissipates');
  assert.ok(peakEnergy<initialEnergy*1.08,'undamped numerical integration stays within an 8% energy envelope');
  assert.ok(energy(b,undampedRecipe)>initialEnergy*.7,'negative control keeps substantial undamped motion');
});

test('vehicle reference: neutral coasting with all resistance disabled preserves horizontal momentum',()=>{
  const value=recipe(),car=createVehicle(value),world=plane();
  const initial=levelStart(car,value,{velocity:[0,0,-18]});
  const state=advance(car,initial,{gear:0},world,3);
  close(state.velocity[2],-18,.02,'neutral longitudinal velocity');
  close(state.position[2],-54,.06,'distance = speed × time');
  close(state.position[0],0,1e-8,'no uncommanded lateral displacement');
});

test('vehicle reference: airborne motion follows gravity and receives no drive force without wheel contact',()=>{
  const value=recipe(),car=createVehicle(value),world={barriers:[],sampleSurface:()=>null};
  const initial=car.spawn({position:[0,20,0],velocity:[0,4,-12]});
  const a=advance(car,initial,{throttle:1,steer:1},world,.5),b=advance(car,initial,{gear:0},world,.5);
  close(a.position[1],20+4*.5-.5*G*.5**2,.012,'ballistic height (bounded fixed-step error)');
  close(a.velocity[1],4-G*.5,1e-8,'ballistic vertical velocity');
  close(a.position[2],-6,1e-8,'no airborne propulsion');
  close(a.velocity[2],b.velocity[2],1e-8,'air throttle cannot propel the chassis');
  for(const wheel of a.wheels){assert.equal(wheel.grounded,false);assert.equal(wheel.load,0);}
});

test('vehicle reference: low and high grip braking follow the friction-limited stopping-distance ordering',()=>{
  const value=recipe(),car=createVehicle(value),startSpeed=20;
  function stop(friction){
    const world=plane({friction});let state=levelStart(car,value,{velocity:[0,0,-startSpeed]}),ticks=0;
    for(;ticks<2400&&speed(state)>.08;ticks++)state=car.step(state,{gear:0,brake:1},world);
    assert.ok(ticks<2400,'braking reaches a near-stop');
    const distance=-state.position[2],ideal=startSpeed**2/(2*friction*value.tyres.grip*G);
    assert.ok(distance>=ideal*.82,`cannot stop materially faster than available tyre friction: ${distance} vs ${ideal}`);
    assert.ok(distance<=ideal*1.35,`full braking uses the declared contact friction: ${distance} vs ${ideal}`);
    return {distance,state};
  }
  const low=stop(.35),high=stop(1);
  assert.ok(low.distance>high.distance*2,'low grip requires distinctly more stopping space');
  close(low.state.position[0],0,1e-7,'symmetric braking has no lateral bias');
});

test('vehicle reference: engaged engine braking slows the car more than neutral coasting',()=>{
  const value=recipe();value.engine.engineBrake=100;value.gearbox.automatic=false;
  const car=createVehicle(value),world=plane(),initial=levelStart(car,value,{velocity:[0,0,-15]});
  const engaged=advance(car,initial,{gear:2},world,2),neutral=advance(car,initial,{gear:0},world,2);
  assert.ok(speed(engaged)<speed(neutral)-.5,'drivetrain braking transfers to contacted driven wheels');
  close(speed(neutral),15,.08,'neutral separates the engine-braking torque');
});

test('vehicle reference: forward acceleration remains below the total available grip force',()=>{
  const value=recipe();value.drive='all';const car=createVehicle(value),friction=.25,world=plane({friction});
  const initial=levelStart(car,value),state=advance(car,initial,{throttle:1},world,2);
  assert.ok(-state.velocity[2]>1,'powered wheels accelerate the vehicle');
  assert.ok(-state.velocity[2]<=friction*value.tyres.grip*G*2+.15,'longitudinal acceleration cannot exceed μg');
  assert.ok(state.position[2]<-.5,'vehicle travels in the -Z world direction');
});

test('vehicle reference: interpolated crank torque and gear ratios produce the expected low-throttle wheel impulse',()=>{
  const value=recipe();value.gearbox.automatic=false;const car=createVehicle(value),world=plane(),rpm=2800,throttle=.2,dt=1/240;
  // 2800 rpm lies 30% between the authored 2200/240 Nm and 4200/300 Nm points.
  const expectedTorque=240+(300-240)*.3;
  for(const gear of [1,2,5]){
    const ratio=value.gearbox.ratios[gear-1],velocity=rpm*2*Math.PI*value.wheel.radius/(ratio*value.gearbox.finalDrive*60);
    const state=levelStart(car,value,{velocity:[0,0,-velocity]});state.rpm=rpm;state.gear=gear;
    const next=car.step(state,{throttle},world,dt);
    const expectedAcceleration=throttle*expectedTorque*ratio*value.gearbox.finalDrive*value.gearbox.efficiency/(value.mass*value.wheel.radius);
    close((state.velocity[2]-next.velocity[2])/dt,expectedAcceleration,1e-9,'torque × ratio × final drive × efficiency / radius / mass');
    assert.equal(next.gear,gear,'manual gearbox keeps the requested ratio');
  }
});

test('vehicle reference: unsupported driven wheels cannot transmit engine torque to the ground',()=>{
  const value=recipe(),world=plane();
  world.sampleSurface=(x,z,maxY)=>z<0&&maxY>=0?{height:0,normal:[0,1,0],friction:1,surfaceId:'front-axle-only'}:null;
  const velocities={};
  for(const drive of ['front','rear','all']){
    const selected={...value,drive},car=createVehicle(selected),state=car.step(levelStart(car,selected),{throttle:.2},world,1/240);
    velocities[drive]=-state.velocity[2];
    assert.ok(state.wheels.slice(0,2).every(w=>w.grounded)&&state.wheels.slice(2).every(w=>!w.grounded),'fixture supports only the front axle');
  }
  assert.ok(velocities.front>0,'front-drive vehicle moves through front contact');
  close(velocities.rear,0,1e-12,'airborne rear drive has no propulsive support');
  close(velocities.all,velocities.front/2,1e-12,'equal AWD torque split sends half to the unsupported axle');
});

test('vehicle reference: positive steering turns right in world space and approximately follows the bicycle radius at low speed',()=>{
  const value=recipe();value.steering.speedReduction=0;value.tyres.corneringStiffness=4000;
  const car=createVehicle(value),world=plane(),initial=levelStart(car,value,{velocity:[0,0,-5]}),steer=.25;
  const state=advance(car,initial,{gear:0,steer},world,2);
  assert.ok(state.position[0]>.5,'right steer produces positive world X from -Z heading');
  assert.ok(state.angularVelocity[1]<0,'right turn is negative right-handed yaw');
  const actualRadius=speed(state)/Math.abs(state.angularVelocity[1]);
  const idealRadius=value.wheel.wheelbase/Math.tan(value.steering.maxAngle*steer);
  assert.ok(actualRadius>idealRadius*.7&&actualRadius<idealRadius*1.4,`dynamic turn radius ${actualRadius} near low-speed geometric reference ${idealRadius}`);
});

test('vehicle reference: split-friction braking creates yaw toward the higher-friction side',()=>{
  const value=recipe(),car=createVehicle(value),world=plane();
  world.sampleSurface=(x,z,maxY)=>maxY>=0?{height:0,normal:[0,1,0],friction:x<0?1:.15,surfaceId:x<0?'grippy-left':'slippery-right'}:null;
  const initial=levelStart(car,value,{velocity:[0,0,-18]}),state=advance(car,initial,{gear:0,brake:1},world,.5);
  assert.ok(state.angularVelocity[1]>.015,'larger left braking force creates positive yaw torque');
  assert.ok(state.wheels.some(w=>w.surfaceId==='grippy-left')&&state.wheels.some(w=>w.surfaceId==='slippery-right'),'each wheel queries its own surface');
});

test('vehicle reference: banked and elevated road contacts lie on the actual rendered triangle planes',()=>{
  const value=recipe(),car=createVehicle(value),bank=.12,height=12;
  const scenery={format:SCENIC_FORMAT,version:1,name:'Independent bank reference',seed:1,profile:'low',environment:'alpine',road:[0,1,2,3].map(i=>({id:'reference-'+i,x:0,y:height,z:-40*i,width:12,bank,structure:'bridge',surface:'asphalt'}))};
  const road=new ScenicRoad(scenery),triangles=road.triangles();
  const world={barriers:[],sampleSurface(x,z,maxY){const hit=road.sampleAt(x,z,{maxY});return hit?{height:hit.position[1],normal:hit.normal,friction:1,surfaceId:hit.surfaceId}:null;}};
  const state=advance(car,car.spawn({position:[0,height+equilibrium(value),-30],roll:bank}),{gear:0,brake:1},world,.5);
  for(const wheel of state.wheels){
    assert.equal(wheel.grounded,true);
    const [x,y,z]=wheel.contactPoint;
    close(y,height+Math.tan(bank)*x,2e-5,'contact point on analytic bank plane');
    const hit=triangles.find(t=>t.surfaceId===wheel.surfaceId);assert.ok(hit,'contact identifies an authored rendered road span');
    close(wheel.normal[0],-Math.sin(bank),2e-6,'bank normal x');close(wheel.normal[1],Math.cos(bank),2e-6,'bank normal y');
  }
  assert.ok(state.position[1]>height,'elevated road is not confused with ground at y=0');
});

test('vehicle reference: powered travel follows an elevated bank while retaining independent left and right contacts',()=>{
  const value=recipe(),car=createVehicle(value),bank=.15,height=9;
  const world=plane({height,slopeX:Math.tan(bank)});
  const initial=car.spawn({position:[0,height+equilibrium(value),0],roll:bank});
  const state=advance(car,initial,{throttle:.8},world,3);
  assert.ok(state.position[2]<-10,'vehicle really drives along the banked plane');
  assert.ok(state.wheels.every(w=>w.grounded),'four contact queries remain supported while moving');
  for(const wheel of state.wheels){
    close(wheel.contactPoint[1],height+Math.tan(bank)*wheel.contactPoint[0],1e-8,'moving wheel contact remains on the bank plane');
  }
  assert.ok(state.wheels[1].contactPoint[1]>state.wheels[0].contactPoint[1]+.15,'right and left suspension sample different elevations');
  const [x,y,z,w]=state.orientation,roll=Math.atan2(2*(x*y+w*z),1-2*(x*x+z*z));
  close(roll,bank,.05,'sprung chassis follows bank without a hard-coded road pose');
});

test('vehicle reference: a falling body reacquires all wheel contacts and damps after landing',()=>{
  const value=recipe(),car=createVehicle(value),world=plane(),initial=car.spawn({position:[0,3,0],velocity:[0,-5,0]});
  let state=initial,airborne=false,landed=false,minY=Infinity;
  for(let i=0;i<720;i++){
    state=car.step(state,{gear:0},world);airborne ||=state.wheels.every(w=>!w.grounded);landed ||=state.wheels.every(w=>w.grounded);minY=Math.min(minY,state.position[1]);
  }
  assert.ok(airborne&&landed,'fixture actually loses and reacquires four-wheel support');
  assert.ok(minY>=value.wheel.radius+value.suspension.restLength-value.suspension.travel-.03,'bounded bump stop prevents the body passing through the surface');
  close(state.position[1],equilibrium(value),.01,'restored equilibrium after impact');
  close(state.velocity[1],0,.01,'landing energy dissipates');
});

test('vehicle reference: real ramp driving climbs rendered geometry, jumps the crest and settles on the lower pad',()=>{
  const value=vehiclePreset('simulation'),car=createVehicle(value),world=createDriveWorld(createCourseScenery('ramp','low'),{asphalt:1,gravel:.65,terrain:.45},'ramp');
  let state=car.spawn({position:[0,4+equilibrium(value),-8]}),climbed=false,airborne=false,landed=false,peak=state.position[1];
  for(let i=0;i<960;i++){
    state=car.step(state,{throttle:1},world.physics);peak=Math.max(peak,state.position[1]);
    assert.equal(state.needsRecovery,false,'reference jump remains in the supported simulation envelope');
    if(state.position[2]<-35&&state.position[2]>-50){
      climbed=true;assert.ok(state.position[1]>7,'wheel support follows actual rising geometry');
      assert.ok(state.velocity[1]>1,'vehicle acquires upward world velocity on the climb');
    }
    if(state.position[2]<-55&&state.wheels.every(w=>!w.grounded))airborne=true;
    if(airborne&&state.position[2]<-65&&state.wheels.every(w=>w.grounded))landed=true;
  }
  assert.ok(climbed&&airborne&&landed,'one continuous simulation crosses all three phases');
  assert.ok(peak>12.5,'car leaves the eight-metre-high ramp with upward momentum');
  assert.ok(state.position[2]<-100,'the chassis advances in world space across the complete jump');
  close(state.position[1],4+equilibrium(value),.03,'post-landing springs return to pad equilibrium');
  close(state.velocity[1],0,.03,'landing oscillation dissipates');
});

test('vehicle reference: a 2 cm barrier stops a high-speed chassis instead of tunnelling',()=>{
  const value=recipe(),car=createVehicle(value),world=plane();
  world.barriers=[{id:'thin-wall',min:[-20,-2,-8.02],max:[20,8,-8]}];
  const initial=levelStart(car,value,{velocity:[0,0,-100]});
  const state=advance(car,initial,{gear:0},world,.2);
  assert.ok(state.position[2]>-8+value.chassis.length/2-.02,'front of conservative chassis remains before the barrier');
  assert.ok(state.velocity[2]>=-.01,'inward velocity is removed');
  const clear=advance(car,initial,{gear:0},plane(),.2);
  assert.ok(clear.position[2]<-18,'negative control travels far beyond the wall without a barrier');
});

test('vehicle reference: ground bottom-out cannot lift the chassis through an overhead barrier',()=>{
  const value=recipe(),car=createVehicle(value),radius=Math.hypot(value.chassis.width,value.chassis.length,value.chassis.height)/2;
  const ceiling={id:'low-ceiling',min:[-20,3.3,-20],max:[20,3.5,-2]};
  const world={barriers:[ceiling],sampleSurface(x,z,maxY){const height=z<-3?.6:0;return height<=maxY?{height,normal:[0,1,0],friction:1,surfaceId:'raised-ground'}:null;}};
  let state=levelStart(car,value,{velocity:[0,0,-5]}),blocked=false;
  for(let i=0;i<150;i++){
    state=car.step(state,{gear:0},world);
    const overlapping=state.position.every((coordinate,axis)=>coordinate+radius>ceiling.min[axis]&&coordinate-radius<ceiling.max[axis]);
    assert.equal(overlapping,false,'post-contact corrections must respect the same conservative solid bound as the initial sweep');
    if(state.needsRecovery){blocked=true;break;}
  }
  assert.equal(blocked,true,'an impossible ground/ceiling clearance requests recovery rather than silently entering the solid');
});

test('vehicle reference: acceleration transfers support rearward and braking transfers it forward',()=>{
  const value=recipe(),car=createVehicle(value),world=plane();
  const accelerating=advance(car,levelStart(car,value),{throttle:1},world,1);
  const braking=advance(car,levelStart(car,value,{velocity:[0,0,-20]}),{brake:1,gear:0},world,.4);
  const front=state=>state.wheels[0].load+state.wheels[1].load,rear=state=>state.wheels[2].load+state.wheels[3].load;
  assert.ok(rear(accelerating)>front(accelerating)+100,'forward contact thrust produces a measurable rearward weight transfer');
  assert.ok(front(braking)>rear(braking)+100,'brake contact torque loads the front axle');
  assert.ok(accelerating.orientation[0]>0,'acceleration raises the nose in +Y-up / -Z-forward coordinates');
  assert.ok(braking.orientation[0]<0,'braking pitches the nose downward');
});

test('vehicle reference: 60 Hz and 120 Hz calls produce identical fixed-quantum simulation state',()=>{
  const value=recipe(),car=createVehicle(value),world=plane(),initial=levelStart(car,value);
  const input={throttle:.7,steer:.13};
  const at60=advance(car,initial,input,world,1,1/60),at120=advance(car,initial,input,world,1,1/120),at240=advance(car,initial,input,world,1,1/240);
  assert.deepEqual(at60,at120,'public caller cadence does not alter internal fixed quanta');
  assert.deepEqual(at120,at240,'240 Hz calls use the same quanta');
});

test('vehicle reference: invalid surface output or controls reject without altering the accepted state',()=>{
  const value=recipe(),car=createVehicle(value),initial=levelStart(car,value),before=copy(initial);
  for(const input of [{throttle:NaN},{brake:2},{steer:Infinity},{gear:100}])assert.throws(()=>car.step(initial,input,plane()));
  for(const surface of [{height:0,normal:[0,0,0],friction:1,surfaceId:'bad-normal'},{height:NaN,normal:[0,1,0],friction:1,surfaceId:'bad-height'},{height:0,normal:[0,1,0],friction:-1,surfaceId:'bad-grip'}]){
    assert.throws(()=>car.step(initial,{}, {barriers:[],sampleSurface:()=>surface}));
  }
  assert.deepEqual(initial,before,'a rejected call cannot partially replace prior simulation data');
  const healthy=car.step(initial,{gear:0},plane());assert.ok(healthy.wheels.every(w=>w.grounded),'subsequent valid operation remains usable');
});

test('drive surface reference: road and shoulder supports use their exact rendered triangle planes',()=>{
  const scenery={format:SCENIC_FORMAT,version:1,name:'Rendered support reference',seed:1,profile:'low',environment:'alpine',road:[0,1,2,3].map(i=>({id:'support-'+i,x:0,y:4+i,z:-30*i,width:9,bank:.08,structure:'ground',surface:i<2?'asphalt':'gravel'}))};
  const world=createDriveWorld(scenery,{asphalt:1.1,gravel:.6,terrain:.35},'coast');
  let roadFaces=0,shoulderFaces=0;
  for(const batch of world.batches){
    if(!['asphalt','gravel','terrain'].includes(batch.id))continue;
    // Skip the heightfield grid: this deliberately verifies the extra embankment
    // triangles which a Heightfield-only collision adapter would miss.
    const start=batch.id==='terrain'?56*56*6*11:0;
    for(let offset=start;offset<batch.vertices.length;offset+=33*3){
      const points=[0,11,22].map(i=>Array.from(batch.vertices.slice(offset+i,offset+i+3)));
      const p=[0,1,2].map(axis=>points.reduce((sum,point)=>sum+point[axis]/3,0));
      const sample=world.physics.sampleSurface(p[0],p[2],p[1]+.0001);assert.ok(sample,'rendered support has a contact query');
      close(sample.height,p[1],2e-6,'centroid lies on exact Float32 rendered face');
      const expectedGrip={asphalt:1.1,gravel:.6,terrain:.35}[batch.id];close(sample.friction,expectedGrip,0,'surface classification selects explicit friction');
      for(const vertex of points){
        const planeDistance=sample.normal[0]*(vertex[0]-p[0])+sample.normal[1]*(vertex[1]-sample.height)+sample.normal[2]*(vertex[2]-p[2]);
        close(planeDistance,0,2e-6,'contact normal is perpendicular to rendered face');
      }
      if(batch.id==='terrain')shoulderFaces++;else roadFaces++;
    }
  }
  assert.ok(roadFaces>10&&shoulderFaces>10,'both road and shoulder surfaces are exercised');
});

test('drive surface reference: stacked ramp and pad select the highest surface below the supplied probe ceiling',()=>{
  const world=createDriveWorld(createCourseScenery('ramp','low'),{asphalt:1,gravel:.5,terrain:.3},'ramp');
  const above=world.physics.sampleSurface(0,-40,20),below=world.physics.sampleSurface(0,-40,4.1);
  assert.ok(above&&below,'both supported levels remain queryable');
  close(above.height,4+8*20/35,2e-6,'ramp grade follows its rendered endpoints');
  close(below.height,4,2e-6,'a lower probe cannot be teleported onto the ramp overhead');
  assert.match(above.surfaceId,/launch-ramp/);assert.notEqual(below.surfaceId,above.surfaceId);
});

test('drive surface reference: collision boxes are represented by the visible barrier mesh',()=>{
  const world=createDriveWorld(createCourseScenery('pad','low'),{asphalt:1,gravel:.5,terrain:.3},'pad');
  for(const x of [-49,-35,-10,0,10,35,49])for(const z of [-209,-160,-100,-40,0,19]){
    const support=world.physics.sampleSurface(x,z,100);assert.ok(support);
    close(support.height,4,2e-6,'handling pad stays flat even outside the original narrow road');
    close(support.normal[1],1,2e-6,'buried terrain cannot intrude into the flat proving surface');
  }
  const vertices=world.batches.find(batch=>batch.id==='contact-barriers').vertices;
  assert.equal(vertices.length,world.physics.barriers.length*36*11,'each public solid has six rendered quad faces');
  for(let index=0;index<world.physics.barriers.length;index++){
    const barrier=world.physics.barriers[index],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let offset=index*36*11;offset<(index+1)*36*11;offset+=11)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],vertices[offset+axis]);max[axis]=Math.max(max[axis],vertices[offset+axis]);}
    for(let axis=0;axis<3;axis++){close(min[axis],barrier.min[axis],2e-6,'barrier visible minimum');close(max[axis],barrier.max[axis],2e-6,'barrier visible maximum');}
  }
});
