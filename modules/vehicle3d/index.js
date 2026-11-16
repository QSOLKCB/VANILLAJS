// SPDX-License-Identifier: Apache-2.0
// Original bounded four-contact vehicle approximation. SI, +Y up, -Z forward.
// Authored worlds, devices, render clocks and cosmetic effects belong to callers.
import {add,subtract,scale,dot,cross,length,normalize,rotate,quatMultiply,quatConjugate,quatNormalize} from '../math/index.js';
import {moveAndSlideAABB} from '../collision/index.js';

export const VEHICLE_FORMAT='qsol.vanillajs.vehicle3d.v1';
export const VEHICLE_BYTES=16384;
export const VEHICLE_STEP=1/120;
const H=1/240,G=9.81,TAU=2*Math.PI;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=x=>((x+Math.PI)%TAU+TAU)%TAU-Math.PI;
function record(v,keys,label,partial=false){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(label+' must be a plain record');
  const d=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(d);
  if(own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(d[k],'value'))||(!partial&&(own.length!==keys.length||keys.some(k=>!Object.hasOwn(d,k)))))throw TypeError(label+' has missing, unknown or accessor fields');
}
function number(v,a,b,label){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw RangeError(label+' is out of bounds');return v;}
function integer(v,a,b,label){number(v,a,b,label);if(!Number.isSafeInteger(v))throw RangeError(label+' must be an integer');return v;}
function array(v,min,max,label){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length<min||v.length>max||Reflect.ownKeys(v).length!==v.length+1)throw TypeError(label+' must be an ordinary dense array');
  const d=Object.getOwnPropertyDescriptors(v);for(let i=0;i<v.length;i++)if(!d[i]||!Object.hasOwn(d[i],'value'))throw TypeError(label+' has a hole or accessor');return v;
}
const vector=(v,n,a,b,label)=>array(v,n,n,label).map(x=>number(x,a,b,label));
function text(v,label,max=64){if(typeof v!=='string'||!v.length||v.length>max||v.trim()!==v||/[\u0000-\u001f\u007f]/.test(v))throw TypeError(label+' must be printable text');return v;}
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const copy=v=>JSON.parse(JSON.stringify(v));
function fields(v,bounds,label){record(v,Object.keys(bounds),label);return Object.fromEntries(Object.entries(bounds).map(([key,[min,max]])=>[key,number(v[key],min,max,label+'.'+key)]));}

/** Strict data-only recipe admission. The result is an owned, deeply frozen copy. */
export function validateVehicle(v){
  record(v,['format','version','name','mass','inertia','chassis','wheel','suspension','tyres','steering','engine','gearbox','drive','drag'],'vehicle');
  if(v.format!==VEHICLE_FORMAT||v.version!==1)throw TypeError('Unsupported vehicle format/version');
  const mass=number(v.mass,500,4000,'mass'),inertia=vector(v.inertia,3,100,20000,'inertia');
  const chassis=fields(v.chassis,{width:[1,3],length:[2.5,7],height:[.6,2.5]},'chassis');
  const wheel=fields(v.wheel,{radius:[.2,.65],wheelbase:[1.5,4.5],track:[.8,2.6]},'wheel');
  if(wheel.wheelbase>chassis.length||wheel.track>chassis.width)throw RangeError('Wheel centres must fit the chassis footprint');
  const suspension=fields(v.suspension,{restLength:[.2,.8],travel:[.08,.6],spring:[5000,120000],damper:[0,14000]},'suspension');
  if(suspension.travel>suspension.restLength||mass*G/(4*suspension.spring)>=suspension.travel*.9)throw RangeError('Suspension must support static weight within its travel');
  const tyres=fields(v.tyres,{grip:[.1,2],corneringStiffness:[100,12000],rollingResistance:[0,.08]},'tyres');
  const steering=fields(v.steering,{maxAngle:[.1,.65],rate:[.1,5],speedReduction:[0,.15]},'steering');
  record(v.engine,['idleRPM','redlineRPM','torqueCurve','engineBrake'],'engine');
  const idleRPM=number(v.engine.idleRPM,400,2000,'idleRPM'),redlineRPM=number(v.engine.redlineRPM,2500,10000,'redlineRPM');
  const torqueCurve=array(v.engine.torqueCurve,2,12,'torqueCurve').map((p,i)=>vector(p,2,0,10000,'torque point '+i));
  for(let i=0;i<torqueCurve.length;i++){
    if(torqueCurve[i][1]>1000||(i&&torqueCurve[i][0]<=torqueCurve[i-1][0]))throw RangeError('Torque points require ascending RPM and 0–1000 Nm');
  }
  if(torqueCurve[0][0]!==idleRPM||torqueCurve.at(-1)[0]!==redlineRPM)throw RangeError('Torque curve must cover exactly idle to redline');
  const engine={idleRPM,redlineRPM,torqueCurve,engineBrake:number(v.engine.engineBrake,0,300,'engineBrake')};
  record(v.gearbox,['ratios','reverseRatio','finalDrive','efficiency','shiftTime','automatic'],'gearbox');
  const ratios=vector(v.gearbox.ratios,array(v.gearbox.ratios,1,8,'ratios').length,.3,6,'ratios');
  for(let i=1;i<ratios.length;i++)if(ratios[i]>=ratios[i-1])throw RangeError('Forward ratios must strictly decrease');
  if(typeof v.gearbox.automatic!=='boolean')throw TypeError('automatic must be boolean');
  const gearbox={ratios,reverseRatio:number(v.gearbox.reverseRatio,.5,6,'reverseRatio'),finalDrive:number(v.gearbox.finalDrive,1,6,'finalDrive'),efficiency:number(v.gearbox.efficiency,.5,1,'efficiency'),shiftTime:number(v.gearbox.shiftTime,.05,1,'shiftTime'),automatic:v.gearbox.automatic};
  if(!['front','rear','all'].includes(v.drive))throw TypeError('Unknown driven wheels');
  const out={format:VEHICLE_FORMAT,version:1,name:text(v.name,'name'),mass,inertia,chassis,wheel,suspension,tyres,steering,engine,gearbox,drive:v.drive,drag:number(v.drag,0,2,'drag')};
  if(new TextEncoder().encode(JSON.stringify(out)).length>VEHICLE_BYTES)throw RangeError('Vehicle recipe exceeds 16 KiB');
  return freeze(out);
}
export function parseVehicle(source){if(typeof source!=='string'||new TextEncoder().encode(source).length>VEHICLE_BYTES)throw RangeError('Vehicle recipe exceeds 16 KiB');return validateVehicle(JSON.parse(source));}
export function serializeVehicle(value){return JSON.stringify(validateVehicle(value));}
/** Generic model settings, not an authored game vehicle or a realism claim. */
export function vehiclePreset(profile='arcade'){
  if(!['arcade','simulation'].includes(profile))throw TypeError('Unknown vehicle profile');
  return copy(validateVehicle({format:VEHICLE_FORMAT,version:1,name:profile==='arcade'?'Arcade response':'Simulation-oriented response',mass:1200,inertia:[1450,1750,650],chassis:{width:1.95,length:4.4,height:1.25},wheel:{radius:.34,wheelbase:2.62,track:1.76},suspension:{restLength:.45,travel:.32,spring:34000,damper:3400},tyres:{grip:profile==='arcade'?1.15:1,corneringStiffness:profile==='arcade'?2600:1800,rollingResistance:.015},steering:{maxAngle:profile==='arcade'?.52:.48,rate:profile==='arcade'?2.6:1.5,speedReduction:profile==='arcade'?.025:.045},engine:{idleRPM:850,redlineRPM:6800,torqueCurve:[[850,140],[2200,240],[4200,300],[5800,265],[6800,190]],engineBrake:40},gearbox:{ratios:[3.1,2.05,1.48,1.12,.89],reverseRatio:2.8,finalDrive:3.7,efficiency:.9,shiftTime:.18,automatic:true},drive:'rear',drag:.4}));
}

const wheelKeys=['grounded','position','contactPoint','normal','compression','load','longitudinalSpeed','lateralSpeed','slip','surfaceId'];
const stateKeys=['tick','position','orientation','velocity','angularVelocity','steering','gear','rpm','shiftRemaining','wheelSpin','brake','wheels','contacts','truncated','needsRecovery'];
function checkedState(v,r){
  record(v,stateKeys,'state');
  const out={tick:integer(v.tick,0,1000000000,'tick'),position:vector(v.position,3,-2000,2000,'position'),orientation:vector(v.orientation,4,-1,1,'orientation'),velocity:vector(v.velocity,3,-120,120,'velocity'),angularVelocity:vector(v.angularVelocity,3,-20,20,'angularVelocity'),steering:number(v.steering,-r.steering.maxAngle,r.steering.maxAngle,'steering'),gear:integer(v.gear,-1,r.gearbox.ratios.length,'gear'),rpm:number(v.rpm,r.engine.idleRPM,r.engine.redlineRPM,'rpm'),shiftRemaining:number(v.shiftRemaining,0,r.gearbox.shiftTime,'shiftRemaining'),wheelSpin:number(v.wheelSpin,-Math.PI,Math.PI,'wheelSpin'),brake:number(v.brake,0,1,'brake')};
  if(Math.abs(length(out.orientation)-1)>1e-8)throw RangeError('Orientation must be a unit quaternion');
  out.wheels=array(v.wheels,4,4,'wheels').map(w=>{
    record(w,wheelKeys,'wheel state');if(typeof w.grounded!=='boolean')throw TypeError('grounded must be boolean');
    const normal=vector(w.normal,3,-1,1,'wheel normal');if(Math.abs(length(normal)-1)>1e-8)throw RangeError('Wheel normal must be unit length');
    return {grounded:w.grounded,position:vector(w.position,3,-2010,2010,'hub'),contactPoint:vector(w.contactPoint,3,-2010,2010,'contact point'),normal,compression:number(w.compression,0,r.suspension.travel,'compression'),load:number(w.load,0,r.mass*G*4,'load'),longitudinalSpeed:number(w.longitudinalSpeed,-300,300,'longitudinalSpeed'),lateralSpeed:number(w.lateralSpeed,-300,300,'lateralSpeed'),slip:number(w.slip,0,10000,'slip'),surfaceId:w.surfaceId===null?null:text(w.surfaceId,'surfaceId',96)};
  });
  out.contacts=array(v.contacts,0,64,'contacts').map(id=>text(id,'barrier id',64));
  if(new Set(out.contacts).size!==out.contacts.length)throw TypeError('Duplicate collision contacts');
  for(const k of ['truncated','needsRecovery']){if(typeof v[k]!=='boolean')throw TypeError(k+' must be boolean');out[k]=v[k];}
  return out;
}
function controls(v,r){record(v,['throttle','brake','steer','gear'],'input',true);return {throttle:number(Object.hasOwn(v,'throttle')?v.throttle:0,0,1,'throttle'),brake:number(Object.hasOwn(v,'brake')?v.brake:0,0,1,'brake'),steer:number(Object.hasOwn(v,'steer')?v.steer:0,-1,1,'steer'),gear:Object.hasOwn(v,'gear')?integer(v.gear,-1,r.gearbox.ratios.length,'gear request'):null};}
function environment(v){
  record(v,['sampleSurface','barriers'],'world');if(typeof v.sampleSurface!=='function')throw TypeError('world.sampleSurface must be a trusted function');
  const ids=new Set(),barriers=array(v.barriers,0,64,'barriers').map(b=>{
    record(b,['id','min','max'],'barrier');text(b.id,'barrier id',64);if(ids.has(b.id))throw TypeError('Duplicate barrier id');ids.add(b.id);
    const min=vector(b.min,3,-2000,2000,'barrier min'),max=vector(b.max,3,-2000,2000,'barrier max');if(min.some((x,i)=>x>=max[i]))throw RangeError('Barrier must have positive volume');return {id:b.id,min,max};
  });return {sampleSurface:v.sampleSurface,barriers};
}
function surface(world,x,z,maxY){
  const value=world.sampleSurface(x,z,maxY);if(value===null)return null;
  record(value,['height','normal','friction','surfaceId'],'surface');
  const normal=vector(value.normal,3,-1,1,'surface normal');if(Math.abs(length(normal)-1)>1e-6||normal[1]<.15)throw RangeError('Surface needs an upward unit normal');
  const height=number(value.height,-2000,2000,'surface height');if(height>maxY+1e-6)throw RangeError('Surface exceeds query ceiling');
  return {height,normal:normalize(normal),friction:number(value.friction,0,2,'surface friction'),surfaceId:text(value.surfaceId,'surfaceId',96)};
}
const mounts=r=>[[-r.wheel.track/2,0,-r.wheel.wheelbase/2],[r.wheel.track/2,0,-r.wheel.wheelbase/2],[-r.wheel.track/2,0,r.wheel.wheelbase/2],[r.wheel.track/2,0,r.wheel.wheelbase/2]];
function emptyWheel(p,r){return {grounded:false,position:add(p,[0,-r.suspension.restLength,0]),contactPoint:add(p,[0,-r.suspension.restLength-r.wheel.radius,0]),normal:[0,1,0],compression:0,load:0,longitudinalSpeed:0,lateralSpeed:0,slip:0,surfaceId:null};}
function pose(value,r){
  record(value,['position','yaw','pitch','roll','velocity'],'spawn pose',true);
  const position=vector(value.position??[0,r.wheel.radius+r.suspension.restLength-r.mass*G/(4*r.suspension.spring),0],3,-1990,1990,'spawn position'),velocity=vector(value.velocity??[0,0,0],3,-100,100,'spawn velocity');
  const yaw=number(value.yaw??0,-4*Math.PI,4*Math.PI,'yaw'),pitch=number(value.pitch??0,-Math.PI/2,Math.PI/2,'pitch'),roll=number(value.roll??0,-Math.PI/2,Math.PI/2,'roll');
  const orientation=quatNormalize(quatMultiply(quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]),[0,0,Math.sin(roll/2),Math.cos(roll/2)]));
  return {position,velocity,orientation};
}
const torqueAt=(engine,rpm)=>{
  const points=engine.torqueCurve;for(let i=1;i<points.length;i++)if(rpm<=points[i][0]){const [a,b]=[points[i-1],points[i]];return a[1]+(b[1]-a[1])*(rpm-a[0])/(b[0]-a[0]);}return points.at(-1)[1];
};
function inertiaAcceleration(torque,orientation,inertia){return rotate(orientation,rotate(quatConjugate(orientation),torque).map((x,i)=>x/inertia[i]));}
function rotateStep(q,w,dt){const speed=length(w),half=speed*dt/2,s=speed>1e-12?Math.sin(half)/speed:dt/2;return quatNormalize(quatMultiply([...scale(w,s),Math.cos(half)],q));}

function advance(s,input,world,r){
  const forward=rotate(s.orientation,[0,0,-1]),speed=dot(s.velocity,forward),ratio=s.gear>0?r.gearbox.ratios[s.gear-1]:s.gear<0?-r.gearbox.reverseRatio:0;
  let gear=s.gear,shiftRemaining=Math.max(0,s.shiftRemaining-H);
  const mechanicalRPM=Math.abs(speed)/r.wheel.radius*Math.abs(ratio)*r.gearbox.finalDrive*60/TAU;
  const requestedRPM=ratio===0?r.engine.idleRPM+input.throttle*(r.engine.redlineRPM-r.engine.idleRPM):Math.max(r.engine.idleRPM,mechanicalRPM);
  let rpm=clamp(s.rpm+clamp(requestedRPM-s.rpm,-12000*H,12000*H),r.engine.idleRPM,r.engine.redlineRPM);
  const requested=input.gear;
  if(shiftRemaining===0){
    let next=gear;
    if(requested!==null){if(requested===0||speed*Math.sign(requested)>=-2)next=requested;}
    else if(r.gearbox.automatic&&gear>0){if(mechanicalRPM>r.engine.redlineRPM*.91&&gear<r.gearbox.ratios.length)next++;else if(mechanicalRPM<r.engine.redlineRPM*.35&&gear>1)next--;}
    if(next!==gear){gear=next;shiftRemaining=r.gearbox.shiftTime;}
  }
  const steering=s.steering+clamp(input.steer*r.steering.maxAngle/(1+Math.abs(speed)*r.steering.speedReduction)-s.steering,-r.steering.rate*H,r.steering.rate*H);
  const mass=r.mass,force=[0,-mass*G,0],torque=[0,0,0],mountRows=mounts(r),priorMounts=mountRows.map(local=>add(s.position,rotate(s.orientation,local))),up=rotate(s.orientation,[0,1,0]);
  const wheels=[],driven=r.drive==='all'?4:2;
  const forceAt=(f,arm)=>{const moment=cross(arm,f);for(let j=0;j<3;j++){force[j]+=f[j];torque[j]+=moment[j];}};
  for(let i=0;i<4;i++){
    const mount=priorMounts[i],hit=up[1]>.15?surface(world,mount[0],mount[2],mount[1]+r.wheel.radius):null;
    const compression=hit?clamp(r.suspension.restLength+r.wheel.radius+hit.height-mount[1],0,r.suspension.travel):0;
    const grounded=!!hit&&mount[1]-hit.height-r.wheel.radius<=r.suspension.restLength;
    if(!grounded){wheels.push(emptyWheel(mount,r));continue;}
    const contact=[mount[0],hit.height,mount[2]],arm=subtract(contact,s.position),pointVelocity=add(s.velocity,cross(s.angularVelocity,arm));
    const springSpeed=dot(pointVelocity,hit.normal),load=clamp(r.suspension.spring*compression-r.suspension.damper*springSpeed,0,mass*G*4);
    forceAt(scale(hit.normal,load),arm);
    const angle=i<2?steering:0,heading=rotate(s.orientation,[Math.sin(angle),0,-Math.cos(angle)]);
    const tangent=normalize(subtract(heading,scale(hit.normal,dot(heading,hit.normal)))),side=normalize(cross(tangent,hit.normal));
    const longitudinalSpeed=dot(pointVelocity,tangent),lateralSpeed=dot(pointVelocity,side),capacity=load*r.tyres.grip*hit.friction;
    const isDriven=r.drive==='all'||(r.drive==='front'?i<2:i>=2);
    let longitudinal=0,engineDrag=0;
    if(isDriven&&shiftRemaining===0&&gear===s.gear&&ratio!==0){
      if(!input.brake&&mechanicalRPM<r.engine.redlineRPM)longitudinal=input.throttle*torqueAt(r.engine,rpm)*ratio*r.gearbox.finalDrive*r.gearbox.efficiency/(r.wheel.radius*driven);
      engineDrag=r.engine.engineBrake*Math.abs(ratio)*r.gearbox.finalDrive/(r.wheel.radius*driven)*(1-input.throttle);
    }
    const stopBudget=mass/4*Math.abs(longitudinalSpeed)/H;
    longitudinal-=Math.sign(longitudinalSpeed)*Math.min(engineDrag+input.brake*mass*G*.75+r.tyres.rollingResistance*load,stopBudget);
    let lateral=-Math.sign(lateralSpeed)*Math.min(Math.abs(lateralSpeed)*r.tyres.corneringStiffness,mass/4*Math.abs(lateralSpeed)/H);
    const demand=Math.hypot(longitudinal,lateral),fraction=demand>capacity?capacity/Math.max(demand,1e-12):1;
    longitudinal*=fraction;lateral*=fraction;
    forceAt(add(scale(tangent,longitudinal),scale(side,lateral)),arm);
    wheels.push({grounded:true,position:[mount[0],hit.height+r.wheel.radius,mount[2]],contactPoint:contact,normal:hit.normal,compression,load,longitudinalSpeed,lateralSpeed,slip:Math.hypot(lateralSpeed,Math.max(0,demand-capacity)/(mass/4)),surfaceId:hit.surfaceId});
  }
  const drag=scale(s.velocity,-r.drag*length(s.velocity));for(let i=0;i<3;i++)force[i]+=drag[i];
  let velocity=add(s.velocity,scale(force,H/mass));
  const omegaBody=rotate(quatConjugate(s.orientation),s.angularVelocity),angularMomentum=rotate(s.orientation,omegaBody.map((x,i)=>x*r.inertia[i]));
  const angularForce=subtract(torque,cross(s.angularVelocity,angularMomentum));
  let angularVelocity=add(s.angularVelocity,scale(inertiaAcceleration(angularForce,s.orientation,r.inertia),H));
  // Small explicit angular drag prevents indefinite unsupported spin; no pose snapping.
  angularVelocity=scale(angularVelocity,Math.exp(-.12*H));
  let limited=false;
  if(length(velocity)>120){velocity=scale(velocity,120/length(velocity));limited=true;}
  if(length(angularVelocity)>12){angularVelocity=scale(angularVelocity,12/length(angularVelocity));limited=true;}
  const orientation=rotateStep(s.orientation,angularVelocity,H);
  // A fixed circumscribed box covers every chassis orientation throughout the sweep.
  // Deliberately conservative: this is not an oriented mesh collision solver.
  const radius=Math.hypot(r.chassis.width,r.chassis.length,r.chassis.height)/2;
  const moved=moveAndSlideAABB(s.position,velocity,H,[radius,radius,radius],world.barriers,8);
  let position=moved.position;velocity=moved.velocity;
  if(moved.contacts.length)angularVelocity=scale(angularVelocity,.8);
  const collisionIds=new Set(moved.contacts.map(c=>world.barriers[c.index].id));let supportBlocked=false;
  // Clip suspension bottom-out at the destination, retaining the previous query
  // ceiling. A falling mount cannot move below a deck then make that deck disappear.
  // The ceiling still excludes a bridge deck above the vehicle's prior wheel mount.
  let correction=0;const stopNormals=[];
  if(rotate(orientation,[0,1,0])[1]>.15)for(let i=0;i<4;i++){
    const mount=add(position,rotate(orientation,mountRows[i]));
    const hit=surface(world,mount[0],mount[2],Math.max(mount[1],priorMounts[i][1])+r.wheel.radius);
    if(hit){const penetration=hit.height+r.wheel.radius+r.suspension.restLength-r.suspension.travel-mount[1];if(penetration>0){correction=Math.max(correction,penetration);stopNormals.push(hit.normal);}}
  }
  if(correction>0){
    const lifted=moveAndSlideAABB(position,[0,correction/H,0],H,[radius,radius,radius],world.barriers,8);
    supportBlocked=lifted.truncated||lifted.position[1]<position[1]+correction-1e-6;position=lifted.position;
    for(const c of lifted.contacts)collisionIds.add(world.barriers[c.index].id);
    if(supportBlocked){velocity=[0,0,0];angularVelocity=[0,0,0];}
    else{for(const normal of stopNormals){const into=dot(velocity,normal);if(into<0)velocity=subtract(velocity,scale(normal,into));}angularVelocity=scale(angularVelocity,.9);}
  }
  // Diagnostics describe the accepted end pose; force/slip values are the last
  // internal substep's solved values, not forces integrated a second time.
  const finalWheels=mountRows.map((local,i)=>{
    const mount=add(position,rotate(orientation,local)),hit=rotate(orientation,[0,1,0])[1]>.15?surface(world,mount[0],mount[2],Math.max(mount[1],priorMounts[i][1])+r.wheel.radius):null;
    if(!hit||mount[1]-hit.height-r.wheel.radius>r.suspension.restLength)return emptyWheel(mount,r);
    return {...wheels[i],grounded:true,position:[mount[0],hit.height+r.wheel.radius,mount[2]],contactPoint:[mount[0],hit.height,mount[2]],normal:hit.normal,compression:clamp(r.suspension.restLength+r.wheel.radius+hit.height-mount[1],0,r.suspension.travel),surfaceId:hit.surfaceId};
  });
  return {tick:s.tick+1,position,orientation,velocity,angularVelocity,steering,gear,rpm,shiftRemaining,wheelSpin:wrap(s.wheelSpin-speed/r.wheel.radius*H),brake:input.brake,wheels:finalWheels,contacts:[...collisionIds],truncated:moved.truncated||supportBlocked,needsRecovery:moved.truncated||supportBlocked||limited||rotate(orientation,[0,1,0])[1]<.2};
}

/** Explicit state transition. world contains trusted application code, never
 * imported recipe data. Surface results are copied/validated before use. */
export function createVehicle(value=vehiclePreset()){
  const recipe=validateVehicle(value);
  function spawn(value={}){
    const base=pose(value,recipe),wheels=mounts(recipe).map(local=>emptyWheel(add(base.position,rotate(base.orientation,local)),recipe));
    return {tick:0,...base,angularVelocity:[0,0,0],steering:0,gear:1,rpm:recipe.engine.idleRPM,shiftRemaining:0,wheelSpin:0,brake:0,wheels,contacts:[],truncated:false,needsRecovery:false};
  }
  return Object.freeze({recipe,spawn,step(state,input={},world,dt=VEHICLE_STEP){
    if(![H,VEHICLE_STEP,1/60].includes(dt))throw RangeError('Vehicle dt must be 1/240, 1/120 or 1/60 second');
    let next=checkedState(state,recipe);const control=controls(input,recipe),checkedWorld=environment(world),contacts=new Set();let truncated=false,recovery=false;
    for(let i=0;i<Math.round(dt/H);i++){next=advance(next,control,checkedWorld,recipe);for(const id of next.contacts)contacts.add(id);truncated||=next.truncated;recovery||=next.needsRecovery;}
    next.contacts=[...contacts];next.truncated=truncated;next.needsRecovery=recovery;
    return checkedState(next,recipe);
  },recover(state,value={}){const prior=checkedState(state,recipe),reset=spawn(value);reset.tick=prior.tick;return reset;}});
}

/** Legacy scenic3d visual-origin adapter. Hub positions in state.wheels remain
 * authoritative; vertical suspension is approximated by the legacy local rig. */
export function vehiclePose(state,value){
  const r=validateVehicle(value),s=checkedState(state,r),q=s.orientation;
  const f=rotate(q,[0,0,-1]),right=rotate(q,[1,0,0]),up=rotate(q,[0,1,0]);
  const pitch=Math.asin(clamp(f[1],-1,1)),yaw=Math.atan2(-f[0],-f[2]),roll=Math.atan2(right[1],up[1]);
  return {position:subtract(s.position,rotate(q,[0,r.wheel.radius+r.suspension.restLength,0])),yaw,pitch,roll,wheelSpin:s.wheelSpin,steer:-s.steering,compression:s.wheels.map(w=>Math.min(.25,w.compression)),brake:s.brake};
}
