// SPDX-License-Identifier: Apache-2.0
// Lab-owned mechanics; SI, +Y up, -Z forward. Rendering never steps this model.
import {parseDecimal} from '../../modules/exact-rational/index.js';
import {quantizeQ16} from '../../modules/rational-q16/index.js';
import {ExactPoint2,orientation2} from '../../modules/exact-geometry/index.js';
import {KeplerOrbit,circularSpeedSI} from '../../modules/orbital-physics/index.js';
import {leadIntercept} from '../../modules/lead-solver/index.js';
export const MODES=['flight','docking','broadside','orbit'];
export const COURSE=Object.freeze([[0,0,-5],[7,2,-16],[-5,0,-28]].map(p=>Object.freeze(p)));
export const TARGET=Object.freeze([12,0,8]);
const distanceToSegment=(p,a,b)=>{const d=b.map((v,i)=>v-a[i]),q=d.reduce((n,v)=>n+v*v,0);const t=q?Math.max(0,Math.min(1,p.reduce((n,v,i)=>n+(v-a[i])*d[i],0)/q)):0;return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));};
// ALIEN-MATH authoring runs once; explicit nearest-even conversion to runtime SI.
const authored=s=>quantizeQ16(parseDecimal(s),{rounding:'nearest-even',overflow:'reject'})/65536;
export const CONFIG=Object.freeze({thrust:authored('6.25'),dockRadius:authored('2.5'),dockSpeed:authored('1.25')});
const pt=(x,y)=>new ExactPoint2(parseDecimal(x),parseDecimal(y));
// Exact non-collinearity check for the authored docking approach triangle.
if(orientation2(pt('0','0'),pt('2.5','0'),pt('0','2.5'))===0)throw new Error('degenerate approach');
export function createWorld(mode='flight'){
  if(!MODES.includes(mode))throw new RangeError('unknown space mechanic');
  const mass=1e13,radius=25;
  return {mode,tick:0,position:mode==='orbit'?[radius,0,0]:[0,0,8],velocity:mode==='orbit'?[0,0,-circularSpeedSI(mass,radius)]:[0,0,0],yaw:0,docked:false,shots:[],hits:0,cooldown:0,checkpoint:0,completed:false,trail:[],
    orbit:mode==='orbit'?new KeplerOrbit({mass,position:[radius,0,0],velocity:[0,0,-circularSpeedSI(mass,radius)],minimumRadius:6}):null};
}
export function stepWorld(w,input={},dt=1/60){
  if(dt!==1/60)throw new RangeError('fixed 60 Hz step required');
  for(const k of ['thrust','turn','rise'])if(input[k]!==undefined&&(!Number.isFinite(input[k])||Math.abs(input[k])>1))throw new RangeError('bounded input required');
  w.tick++;if(w.mode==='orbit'){const next=w.orbit.step(dt);w.position=next.position;w.velocity=next.velocity;w.yaw=Math.atan2(w.velocity[0],-w.velocity[2]);if(w.tick%6===0){w.trail.push([...w.position]);if(w.trail.length>128)w.trail.shift();}return w;}
  const previous=[...w.position];
  w.yaw+=(input.turn??0)*dt;
  if(!w.docked){
    const force=(input.thrust??0)*CONFIG.thrust;
    w.velocity[0]+=Math.sin(w.yaw)*force*dt;w.velocity[2]-=Math.cos(w.yaw)*force*dt;
    w.velocity[1]+=(input.rise??0)*CONFIG.thrust*dt;
    const damp=input.brake?Math.exp(-4*dt):1;
    for(let i=0;i<3;i++){w.velocity[i]*=damp;w.position[i]+=w.velocity[i]*dt;}
    if(Math.hypot(...w.position)>1000){w.position=[0,0,8];w.velocity=[0,0,0];previous.splice(0,3,...w.position);}
    if(w.mode==='flight'&&w.checkpoint<COURSE.length&&distanceToSegment(COURSE[w.checkpoint],previous,w.position)<2.7){w.checkpoint++;w.completed=w.checkpoint===COURSE.length;}
    if(w.mode==='docking'&&input.dock&&Math.hypot(...w.position)<CONFIG.dockRadius&&Math.hypot(...w.velocity)<CONFIG.dockSpeed){w.docked=true;w.completed=true;w.velocity=[0,0,0];}
  }
  w.cooldown=Math.max(0,w.cooldown-dt);
  if(w.mode==='broadside'&&input.fire&&w.cooldown===0&&w.shots.length<=30){
    w.cooldown=.3;for(const side of [-1,1])w.shots.push({p:[...w.position],v:[side*Math.cos(w.yaw)*25,0,side*Math.sin(w.yaw)*25],life:3});
  }
  for(const s of w.shots){
    const old=[...s.p];s.life-=dt;for(let i=0;i<3;i++)s.p[i]+=s.v[i]*dt;
    // Swept segment / target sphere: no tunnelling across a target in one tick.
    const center=TARGET,d=s.p.map((v,i)=>v-old[i]),r=center.map((v,i)=>v-old[i]);
    const t=Math.max(0,Math.min(1,r.reduce((n,v,i)=>n+v*d[i],0)/(d.reduce((n,v)=>n+v*v,0)||1)));
    if(Math.hypot(...old.map((v,i)=>v+d[i]*t-center[i]))<2){w.hits++;s.life=0;}
  }
  w.shots=w.shots.filter(s=>s.life>0);if(w.mode==='broadside')w.completed=w.hits>=5;return w;
}
export function aim(w){return leadIntercept({shooterPosition:w.position,targetPosition:TARGET,projectileSpeed:25});}
