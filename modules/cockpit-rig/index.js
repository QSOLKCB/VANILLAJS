// SPDX-License-Identifier: Apache-2.0
// COCKPIT-001: camera, gauges and physical boresight geometry ONLY.
// World +Y up, body forward -Z, quaternion xyzw. No DOM, clocks or game rules.
import {rotate,quatMultiply,quatConjugate,quatNormalize,dot,length,subtract,add,normalize} from '../math/index.js';
export const COCKPIT_MODES=Object.freeze(['cockpit','nose','chase','external']);
const owned=new WeakSet();
function record(v,allowed,label){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(label+' plain object required');
  const d=Object.getOwnPropertyDescriptors(v);
  if(Reflect.ownKeys(d).some(k=>typeof k!=='string'||!allowed.includes(k)||!Object.hasOwn(d[k],'value')))throw TypeError(label+' has unknown or accessor fields');
}
function num(n,lo,hi,label){if(typeof n!=='number'||!Number.isFinite(n)||n<lo||n>hi)throw RangeError(label+' must be finite and bounded');return n;}
function vector(v,count,lo,hi,label){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==count||
     Reflect.ownKeys(v).length!==count+1)throw TypeError(label+' needs a dense plain array');
  return Object.freeze(Array.from({length:count},(_,i)=>{
    const d=Object.getOwnPropertyDescriptor(v,i);if(!d||!Object.hasOwn(d,'value'))throw TypeError(label+' accessor or hole');
    return num(d.value,lo,hi,label);
  }));
}
function physicalPose(pose){
  record(pose,['position','velocity','orientation','angularVelocity','mass','halfSize','inertia',
    'tick','steering','gear','rpm','shiftRemaining','wheelSpin','brake','wheels','contacts','truncated','needsRecovery'],'physical pose');
  const position=vector(pose.position,3,-10000,10000,'position'),velocity=vector(pose.velocity,3,-500,500,'velocity');
  const q=vector(pose.orientation,4,-1,1,'quaternion');
  if(Math.abs(length(q)-1)>1e-6)throw RangeError('unit quaternion required');
  return {position,velocity,orientation:q};
}
const freeze=v=>Object.freeze(v);
const allGuns=guns=>{
  if(!Array.isArray(guns)||Object.getPrototypeOf(guns)!==Array.prototype||guns.length<1||guns.length>8||
    Reflect.ownKeys(guns).length!==guns.length+1)throw TypeError('one to eight dense gun mounts required');
  return freeze(guns.map(g=>vector(g,3,-12,12,'muzzle')));
};
/** Own the presentation rig. A gun mount is local XYZ in metres; no projectile rules. */
export function createCockpitRig(options={}){
  record(options,['seat','nose','chase','external','guns','convergence','fov'],'cockpit rig');
  const result=freeze({
    seat:vector(options.seat??[0,.55,.3],3,-20,20,'seat'),
    nose:vector(options.nose??[0,.15,-2],3,-20,20,'nose'),
    chase:vector(options.chase??[0,2,9],3,-20,20,'chase'),
    external:vector(options.external??[9,4,13],3,-20,20,'external'),
    guns:allGuns(options.guns??[[-2,0,-1],[2,0,-1]]),
    convergence:num(options.convergence??240,20,2000,'convergence'),
    fov:num(options.fov??1.05,.2,2.5,'field of view')
  });
  owned.add(result);return result;
}
function rig(v){if(!owned.has(v))throw TypeError('createCockpitRig result required');return v;}
function lookAngles(v){
  record(v,['yaw','pitch'],'head look');
  const yaw=num(v.yaw??0,-1.5,1.5,'head yaw'),pitch=num(v.pitch??0,-1.2,1.2,'head pitch');
  return quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
    [Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);
}
export function sampleCockpitCamera(pose,configuration,mode='cockpit',head={}){
  const p=physicalPose(pose),r=rig(configuration);
  if(!COCKPIT_MODES.includes(mode))throw RangeError('unsupported view mode');
  const local=mode==='cockpit'?r.seat:mode==='nose'?r.nose:mode==='chase'?r.chase:r.external;
  const position=freeze(add(p.position,rotate(p.orientation,local)));
  const externalBias=mode==='external'?quatMultiply(
    [0,Math.sin(.48/2),0,Math.cos(.48/2)],
    [Math.sin(-.16/2),0,0,Math.cos(-.16/2)]):[0,0,0,1];
  const orientation=freeze(quatNormalize(quatMultiply(
    p.orientation,quatMultiply(externalBias,lookAngles(head)))));
  return freeze({position,orientation,mode,fov:r.fov});
}
/** Screen projection uses the same pinhole vertical FOV convention as WebGL. */
export function projectCockpitPoint(camera,world,{width,height}={}){
  record(camera,['position','orientation','mode','fov'],'camera');
  const position=vector(camera.position,3,-10000,10000,'camera position');
  const orientation=vector(camera.orientation,4,-1,1,'camera quaternion');
  if(Math.abs(length(orientation)-1)>1e-6)throw RangeError('unit camera quaternion required');
  const fov=num(camera.fov,.2,2.5,'fov');
  const point=vector(world,3,-10000,10000,'target point');
  if(!Number.isSafeInteger(width)||width<1||width>8192||!Number.isSafeInteger(height)||height<1||height>8192)
    throw RangeError('viewport dimensions invalid');
  const local=rotate(quatConjugate(orientation),subtract(point,position)),depth=-local[2];
  if(depth<=1e-8)return freeze({visible:false,x:null,y:null,depth});
  const factor=height/(2*Math.tan(fov/2)*depth);
  return freeze({visible:true,x:width/2+local[0]*factor,y:height/2-local[1]*factor,depth});
}
export function cockpitTelemetry(pose){
  const p=physicalPose(pose),forward=rotate(p.orientation,[0,0,-1]),right=rotate(p.orientation,[1,0,0]),up=rotate(p.orientation,[0,1,0]);
  return freeze({speed:length(p.velocity),forwardSpeed:dot(p.velocity,forward),verticalSpeed:p.velocity[1],
    altitude:p.position[1],heading:Math.atan2(-forward[0],-forward[2]),
    pitch:Math.asin(Math.max(-1,Math.min(1,forward[1]))),
    bank:Math.atan2(right[1],up[1])});
}
/** Every gun physically aims from its own muzzle to the body boresight convergence point. */
export function cockpitGunRays(pose,configuration){
  const p=physicalPose(pose),r=rig(configuration),target=freeze(add(p.position,rotate(p.orientation,[0,0,-r.convergence])));
  const rays=freeze(r.guns.map(local=>{
    const muzzle=freeze(add(p.position,rotate(p.orientation,local)));
    const direction=freeze(normalize(subtract(target,muzzle)));
    return freeze({origin:muzzle,direction});
  }));
  return freeze({target,rays,convergence:r.convergence});
}
/** Exact geometric intersection of physical gun rays with a plane across the boresight.
 * Report both screen-space error and physical metres. No visual ray changes physics.
 */
export function inspectCockpitSight(pose,configuration,camera,{range,width,height}={}){
  const p=physicalPose(pose),r=rig(configuration),at=num(range,20,2000,'test range');
  const target=add(p.position,rotate(p.orientation,[0,0,-at]));
  const reticle=projectCockpitPoint(camera,target,{width,height});
  const raySet=cockpitGunRays(p,configuration);
  const forward=rotate(p.orientation,[0,0,-1]),results=raySet.rays.map(ray=>{
    const denominator=dot(ray.direction,forward);
    if(denominator<=1e-9)throw RangeError('gun ray does not face sight plane');
    const distance=dot(subtract(target,ray.origin),forward)/denominator;
    const point=add(ray.origin,ray.direction.map(v=>v*distance));
    const delta=rotate(quatConjugate(p.orientation),subtract(point,target));
    const screen=projectCockpitPoint(camera,point,{width,height});
    return freeze({screen,errorMetres:Math.hypot(delta[0],delta[1]),
      offsetX:delta[0],offsetY:delta[1],point:freeze(point)});
  });
  return freeze({range:at,convergence:r.convergence,reticle,impacts:freeze(results)});
}
/** Independent geometric ray/sphere hit test for the lab's target range. */
export function testCockpitTarget(pose,configuration,center,radius){
  const target=vector(center,3,-10000,10000,'target'),r=num(radius,.01,1000,'target radius');
  const rays=cockpitGunRays(pose,configuration).rays;
  return freeze(rays.map((ray,index)=>{
    const offset=subtract(ray.origin,target),b=dot(offset,ray.direction),c=dot(offset,offset)-r*r;
    const discriminant=b*b-c;
    if(discriminant<0)return freeze({gun:index,hit:false,distance:null});
    const root=Math.sqrt(discriminant),a=-b-root,z=-b+root,t=a>=0?a:z>=0?z:null;
    return freeze({gun:index,hit:t!==null,distance:t});
  }));
}
