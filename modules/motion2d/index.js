// SPDX-License-Identifier: Apache-2.0
// Experimental 2D simulation foundation. +Y is up; canvas adapters invert Y.
// State uses exact signed integer subunits (256 subunits = 1 game unit)
// and one caller-owned fixed simulation tick. No Web Audio, DOM or real clock.
const DOMAIN=1_000_000_000, MAX_SPEED=512, SCALE=256;
const int=(value,name,min=-DOMAIN,max=DOMAIN)=>{
  if(!Number.isSafeInteger(value)||value<min||value>max)
    throw new RangeError(name+' must be an integer in ['+min+','+max+']');
  return value;
};
const axis=(value,name)=>int(value,name,-1,1);
const sign=x=>x>0?1:x<0?-1:0;
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
// Clockwise heading in 16 exact integral Q12 directions.
const DIRS=Object.freeze([[4096,0],[3784,1567],[2896,2896],[1567,3784],
  [0,4096],[-1567,3784],[-2896,2896],[-3784,1567],[-4096,0],
  [-3784,-1567],[-2896,-2896],[-1567,-3784],[0,-4096],
  [1567,-3784],[2896,-2896],[3784,-1567]].map(v=>Object.freeze(v)));
export const MOTION2D_SCALE=SCALE;
export const MOTION2D_PROFILES=Object.freeze(['rts','shmup','platform','car']);
export function direction2D(heading){return [...DIRS[int(heading,'heading',0,15)]];}
export function createBody2D({x=0,y=0,vx=0,vy=0,heading=0,grounded=false}={}){
  return Object.freeze({x:int(x,'x'),y:int(y,'y'),
    vx:int(vx,'vx',-MAX_SPEED,MAX_SPEED),
    vy:int(vy,'vy',-MAX_SPEED,MAX_SPEED),
    heading:int(heading,'heading',0,15),grounded:Boolean(grounded)});
}
/** One fixed tick with deterministic axis-separated static point collision.
 * A supplied blockedAt(x,y) must be pure and read a frozen collision snapshot.
 * Platform ground is a flat horizontal line; no slopes, capsule or rigid bodies.
 * Check caller-owned bounds at integer subunit precision; no silent wrapping.
 */
export function stepBody2D(body,controls={},{
  profile='rts',bounds={minX:-100000,minY:-100000,maxX:100000,maxY:100000},
  groundY=0,blockedAt=null
}={}){
  if(!MOTION2D_PROFILES.includes(profile))throw new RangeError('unknown 2D movement profile');
  const a=createBody2D(body);
  if(!controls||typeof controls!=='object'||Array.isArray(controls))
    throw new TypeError('controls must be an object');
  const x=axis(controls.x??0,'controls.x'),y=axis(controls.y??0,'controls.y');
  const steer=axis(controls.steer??0,'controls.steer'),
    throttle=axis(controls.throttle??0,'controls.throttle');
  if(controls.jump!==undefined&&typeof controls.jump!=='boolean')
    throw new TypeError('jump must be boolean');
  if(blockedAt!==null&&typeof blockedAt!=='function')
    throw new TypeError('blockedAt must be a function');
  if(!bounds||typeof bounds!=='object')throw new TypeError('bounds required');
  const minX=int(bounds.minX,'minX'),maxX=int(bounds.maxX,'maxX'),
    minY=int(bounds.minY,'minY'),maxY=int(bounds.maxY,'maxY');
  if(minX>=maxX||minY>=maxY||a.x<minX||a.x>maxX||a.y<minY||a.y>maxY)
    throw new RangeError('invalid body/bounds');
  groundY=int(groundY,'groundY',minY,maxY);
  let vx=a.vx,vy=a.vy,heading=a.heading,grounded=a.grounded;
  switch(profile){
    case 'rts':
      vx=clamp(vx+8*x,-64,64);vy=clamp(vy+8*y,-64,64);
      vx-=sign(vx)*Math.min(Math.abs(vx),4);
      vy-=sign(vy)*Math.min(Math.abs(vy),4);grounded=false;break;
    case 'shmup':
      vx=16*x;vy=16*y;grounded=false;break;
    case 'platform':
      vx=clamp(vx+8*x,-48,48);
      if(x===0)vx-=sign(vx)*Math.min(8,Math.abs(vx));
      if(a.y<=groundY&&a.vy<=0){grounded=true;vy=0;}
      if(controls.jump===true&&grounded){vy=56;grounded=false;}
      vy=clamp(vy-4,-80,80);
      break;
    case 'car':{
      heading=(heading+steer+16)%16;
      const [dx,dy]=DIRS[heading];
      vx=clamp(vx+Math.trunc(dx*throttle*12/4096),-100,100);
      vy=clamp(vy+Math.trunc(dy*throttle*12/4096),-100,100);
      vx-=sign(vx)*Math.min(2,Math.abs(vx));
      vy-=sign(vy)*Math.min(2,Math.abs(vy));
      grounded=false;break;
    }
  }
  let px=a.x,py=a.y;
  const nx=clamp(px+vx,minX,maxX);
  if(nx===px&&vx!==0)vx=0;
  else if(blockedAt&&blockedAt(nx,py)){vx=0;}
  else px=nx;
  const ny=clamp(py+vy,minY,maxY);
  if(ny===py&&vy!==0)vy=0;
  else if(blockedAt&&blockedAt(px,ny)){vy=0;}
  else py=ny;
  if(profile==='platform'&&py<=groundY){
    py=groundY;
    if(vy<0)vy=0;
    grounded=vy===0;
  }
  return createBody2D({x:px,y:py,vx,vy,heading,grounded});
}
