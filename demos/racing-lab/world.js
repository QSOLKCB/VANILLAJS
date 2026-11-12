// SPDX-License-Identifier: Apache-2.0
// RACING-002: deterministic, demo-owned classic touring and vehicle rules. SI units, +Y up, -Z forward.
// Float64 simulation is repeatable for the same input/tick sequence in one JS runtime;
// it is NOT a claim of cross-engine bit-exact arithmetic.
import {clamp} from '../../modules/math/index.js';

export const STEP=1/60;
export const MODES=Object.freeze(['retro','tour','circuit','sprint','derby','ball','stunt']);
// Original course data: stage-fork touring and a winding 3D point-to-point road.
export const TOUR_STAGE_LENGTH=1200,TOUR_STAGES=4,SPRINT_LENGTH=3600;
export function sprintCenter(s){
  if(!Number.isFinite(s))throw new TypeError('sprint distance must be finite');
  const v=clamp(s,0,SPRINT_LENGTH);
  return 18*Math.sin(v/185)+9*Math.sin(v/75);
}
export function sprintHeading(s){
  const ahead=sprintCenter(s+2),behind=sprintCenter(s-2);
  return Math.atan2(ahead-behind,4);
}
export function tourPalette(route=[]){
  // Only explicit completed fork decisions affect the scenery; no random choice.
  // Advance from the *previous* palette, with distinct steps for each fork.
  // Neither choice can repeat the preceding stage's biome.
  const index=route.reduce((previous,choice)=>(previous+(choice==='right'?2:1))%4,0);
  return Object.freeze([
    {sky:'#17264a',sunset:'#ffd18c',mountain:'#6f5571',verge:'#225854',road:'#303945',name:'Sunset Esplanade'},
    {sky:'#112f50',sunset:'#9ed9dc',mountain:'#476780',verge:'#2c7262',road:'#303e53',name:'Sapphire Coast'},
    {sky:'#51304e',sunset:'#f4b280',mountain:'#90505d',verge:'#5e5334',road:'#403b45',name:'Cinder Canyon'},
    {sky:'#192d45',sunset:'#e3b2d9',mountain:'#635b80',verge:'#335e63',road:'#32384a',name:'Orchid Ridge'}
  ][index]);
}
export const TRACK_LENGTH=900;
export const RACE_GATES=Object.freeze([
  {x:0,z:55},{x:36,z:39},{x:50,z:0},{x:36,z:-39},
  {x:0,z:-55},{x:-36,z:-39},{x:-50,z:0},{x:-36,z:39}
]);

const forward=yaw=>[Math.sin(yaw),-Math.cos(yaw)];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const bounded=v=>Number.isFinite(v)?clamp(v,-1,1):0;
function driver(x,z,yaw=0,color=0){
  return {x,z,y:0,yaw,vx:0,vz:0,vy:0,speed:0,grounded:true,
    boost:100,health:100,lap:0,checkpoint:1,flip:0,knockouts:0,color,
    cooldown:0,lastSafe:0};
}
export function stuntRoad(s){
  if(!Number.isFinite(s))throw new TypeError('track position must be finite');
  const t=((s%TRACK_LENGTH)+TRACK_LENGTH)%TRACK_LENGTH;
  if((t>=210&&t<235)||(t>=590&&t<617))return null;
  if(t<120)return 2;
  if(t<160)return 2+(t-120)*7/40;
  if(t<235)return 9;
  if(t<300)return 7;
  if(t<340)return 7-(t-300)*5/40;
  if(t<400)return 2;
  if(t<470)return 2+Math.sin((t-400)*Math.PI/14)*.6;
  if(t<520)return 2;
  if(t<560)return 2+(t-520)*9/40;
  if(t<617)return 11;
  if(t<670)return 9;
  if(t<720)return 9-(t-670)*7/50;
  return 2;
}
export function retroCurve(s){return Math.sin(s/190)*2.7+Math.sin(s/490)*2;}
export function createRace(mode='retro'){
  if(!MODES.includes(mode))throw new RangeError('unknown racing mode');
  const p=mode==='circuit'?driver(0,55,Math.atan2(36,16)):
    mode==='stunt'||mode==='sprint'?driver(0,0):driver(0,32);
  if(mode==='stunt')p.y=2;
  const bots=mode==='retro'||mode==='tour'?
    [0,1,2,3,4].map(i=>({id:i,x:[-3.2,2.5,0,-1.8,3][i],
      s:105+i*145,speed:24+i*4,color:i%3})):
    mode==='stunt'?[]:
    mode==='sprint'?[0,1,2,3].map(i=>{
      const s=120+i*175;
      return driver(sprintCenter(s)+(i%2?3:-3),-s,sprintHeading(s),i);
    }):
    [0,1,2,3].map(i=>{
      const a=driver(mode==='circuit'?RACE_GATES[i].x:
        [-24,24,-18,18][i],mode==='circuit'?RACE_GATES[i].z:
        [-25,-21,12,19][i],0,i);
      a.checkpoint=(i+1)%RACE_GATES.length;
      return a;
    });
  return {mode,tick:0,elapsed:0,player:p,bots,finished:false,
    result:'',event:'',score:[0,0],distance:0,contacts:0,
    ball:{x:0,y:1.3,z:0,vx:0,vz:0,vy:0},retroLap:0,route:[]};
}
function vehicle(p,input,dt,maxSpeed=38){
  const throttle=bounded(input.throttle),steer=bounded(input.steer);
  const nitro=Boolean(input.boost)&&p.boost>0;
  const limit=nitro?maxSpeed*1.4:maxSpeed;
  p.speed=clamp(p.speed+(throttle>=0?throttle*24:throttle*35)*dt-
    (Math.abs(throttle)<.01?p.speed*1.1*dt:0),-15,limit);
  if(nitro){p.speed=clamp(p.speed+38*dt,-15,limit);p.boost=Math.max(0,p.boost-24*dt);}
  else p.boost=Math.min(100,p.boost+9*dt);
  const turn=Math.min(1,Math.abs(p.speed)/12)*steer*1.9*dt;
  p.yaw+=turn*(p.speed<0?-1:1);
  const [fx,fz]=forward(p.yaw),grip=input.handbrake?1.7:7.5;
  const blend=Math.min(1,grip*dt);
  p.vx+=(fx*p.speed-p.vx)*blend;
  p.vz+=(fz*p.speed-p.vz)*blend;
  p.x+=p.vx*dt;p.z+=p.vz*dt;
  if(p.grounded&&input.jump){p.vy=9.5;p.grounded=false;}
  if(!p.grounded){
    p.vy-=19*dt;
    if(input.flip)p.flip+=4.8*dt;
  }
  p.y+=p.vy*dt;
}
// Return the earliest circle-on-circle encounter during an explicit tick.
// This detects high-speed passes that finish with non-overlapping vehicle poses.
export function sweepVehicleContact(startA,endA,startB,endB,radius=3.5){
  const values=[startA?.x,startA?.z,endA?.x,endA?.z,
    startB?.x,startB?.z,endB?.x,endB?.z,radius];
  if(!values.every(Number.isFinite)||radius<=0)throw new RangeError('invalid swept vehicle segment');
  const rx=startA.x-startB.x,rz=startA.z-startB.z;
  const dx=(endA.x-startA.x)-(endB.x-startB.x);
  const dz=(endA.z-startA.z)-(endB.z-startB.z);
  const c=rx*rx+rz*rz-radius*radius;
  let t=0;
  if(c>0){
    const a=dx*dx+dz*dz,b=2*(rx*dx+rz*dz);
    const discriminant=b*b-4*a*c;
    if(a===0||discriminant<0)return null;
    t=(-b-Math.sqrt(discriminant))/(2*a);
    if(t<0||t>1)return null;
  }
  const nx=rx+dx*t,nz=rz+dz*t,len=Math.hypot(nx,nz);
  return {time:t,nx:len>1e-9?nx/len:0,nz:len>1e-9?nz/len:1};
}
function contact(a,b,w,sweep=null){
  if(a.cooldown||b.cooldown||(!sweep&&distance(a,b)>3.5)||Math.abs(a.y-b.y)>2.5)return;
  const dx=a.x-b.x,dz=a.z-b.z,d=Math.max(.001,Math.hypot(dx,dz));
  const nx=sweep?sweep.nx:dx/d,nz=sweep?sweep.nz:dz/d;
  const relative=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
  const impulse=Math.max(4,Math.abs(relative)*.55);
  a.vx+=nx*impulse;a.vz+=nz*impulse;
  b.vx-=nx*impulse;b.vz-=nz*impulse;
  a.speed*=.73;b.speed*=.65;
  const damage=Math.max(4,Math.round(impulse*1.2));
  // Demo-owned derby balancing: a direct player ram should be capable of
  // eliminating four rivals before the player's own body inevitably fails.
  // Other modes retain symmetric collision damage.
  const suffered=w.mode==='derby'?Math.max(1,Math.round(damage*.4)):damage;
  const inflicted=w.mode==='derby'?damage+20:damage;
  a.health=Math.max(0,a.health-suffered);
  b.health=Math.max(0,b.health-inflicted);
  a.cooldown=18;b.cooldown=18;w.contacts++;
  w.event='BODY CONTACT · '+suffered+' DAMAGE';
  if(b.health===0){a.knockouts++;b.cooldown=180;w.event='RIVAL DISABLED';}
}
function arenaBounds(p){
  if(Math.abs(p.x)>63){p.x=clamp(p.x,-63,63);p.vx*=-.55;p.speed*=.75;}
  if(Math.abs(p.z)>63){p.z=clamp(p.z,-63,63);p.vz*=-.55;p.speed*=.75;}
}
function updateBots(w,dt,playerPrevious=null){
  for(const b of w.bots){
    // All rival cooldowns must expire, not just knocked-out rivals.
    if(b.cooldown>0)b.cooldown--;
    if(b.cooldown>60&&b.health===0)continue;
    if(b.health===0){b.health=100;b.x=-25+b.color*15;b.z=20;b.speed=0;b.cooldown=30;}
    const before={x:b.x,z:b.z};
    const target=w.mode==='circuit'?RACE_GATES[b.checkpoint]:
      w.mode==='sprint'?{x:sprintCenter(-b.z+45)+(b.color%2?3:-3),z:b.z-45}:
      w.mode==='ball'?w.ball:w.player;
    const desired=Math.atan2(target.x-b.x,-(target.z-b.z));
    const delta=Math.atan2(Math.sin(desired-b.yaw),Math.cos(desired-b.yaw));
    vehicle(b,{throttle:1,steer:clamp(delta*2,-1,1),
      boost:w.mode==='derby'&&w.tick%240<55},dt,w.mode==='circuit'?31:w.mode==='sprint'?33:30);
    b.y=0;b.vy=0;b.grounded=true;
    if(w.mode==='circuit'&&distance(b,target)<12){
      if(b.checkpoint===0)b.lap++;
      b.checkpoint=(b.checkpoint+1)%RACE_GATES.length;
    }
    if(w.mode!=='sprint')arenaBounds(b);
    const sweep=w.mode==='sprint'&&playerPrevious?
      sweepVehicleContact(playerPrevious,w.player,before,b):null;
    contact(w.player,b,w,sweep);
  }
}
function updateBall(w,dt){
  const b=w.ball;
  b.x+=b.vx*dt;b.z+=b.vz*dt;
  b.vx*=Math.exp(-.75*dt);b.vz*=Math.exp(-.75*dt);
  for(const car of [w.player,...w.bots]){
    const dx=b.x-car.x,dz=b.z-car.z,d=Math.hypot(dx,dz);
    if(d<3.7){
      const m=Math.max(.1,d),strength=12+Math.abs(car.speed)*.8;
      b.vx=clamp(b.vx+dx/m*strength,-55,55);
      b.vz=clamp(b.vz+dz/m*strength,-55,55);
      b.x=car.x+dx/m*3.7;b.z=car.z+dz/m*3.7;
      w.event='BALL IMPACT';
    }
  }
  if(Math.abs(b.x)>60){b.x=clamp(b.x,-60,60);b.vx*=-.8;}
  if(Math.abs(b.z)>58){
    if(Math.abs(b.x)<15){
      const side=b.z<0?0:1;w.score[side]++;w.event=side===0?'GOAL · YOU SCORED':'GOAL · OPPONENTS';
      Object.assign(b,{x:0,z:0,vx:0,vz:0});
      w.player.x=0;w.player.z=32;w.player.speed=0;
    }else {b.z=clamp(b.z,-58,58);b.vz*=-.8;}
  }
}
function stepRetro(w,input,dt){
  const p=w.player,boosting=Boolean(input.boost)&&p.boost>0;
  // Accumulated nitro speed survives the next tick; it decays after release.
  const speedLimit=boosting?90:Math.max(75,p.speed-45*dt);
  p.speed=clamp(p.speed+bounded(input.throttle)*25*dt-
    (Math.abs(bounded(input.throttle))<.01?p.speed*.35*dt:0),0,speedLimit);
  if(boosting){p.speed=Math.min(90,p.speed+35*dt);p.boost=Math.max(0,p.boost-20*dt);}
  else p.boost=Math.min(100,p.boost+8*dt);
  p.x+=bounded(input.steer)*(3.5+p.speed*.08)*dt;
  if(Math.abs(p.x)>5.6){
    p.x=clamp(p.x,-6.3,6.3);p.speed*=1-1.4*dt;
    if(w.tick%50===0){p.health=Math.max(0,p.health-1);w.event='OFF ROAD';}
  }
  const before=w.distance;
  w.distance+=p.speed*dt;
  for(const b of w.bots){
    b.s+=b.speed*dt;
    if(b.s<w.distance-20){b.s=w.distance+240+(b.id*83)%360;b.x=[-3,2.9,0,-1.5,3.1][b.id];}
    if(before<=b.s+4&&w.distance>=b.s-4&&Math.abs(p.x-b.x)<1.8&&
       !p.cooldown){
      p.speed*=.5;p.health=Math.max(0,p.health-9);
      p.cooldown=48;w.contacts++;w.event='TRAFFIC IMPACT';
    }
  }
  if(w.mode==='tour'){
    const stage=Math.min(TOUR_STAGES,Math.floor(w.distance/TOUR_STAGE_LENGTH));
    // Route choices are committed exactly once at the end of each stage.
    while(w.route.length<Math.min(stage,TOUR_STAGES-1)){
      const choice=p.x<0?'left':'right';
      w.route.push(choice);
      w.event='FORK '+choice.toUpperCase()+' · '+tourPalette(w.route).name.toUpperCase();
    }
    p.lap=stage;
    if(w.distance>=TOUR_STAGES*TOUR_STAGE_LENGTH){w.finished=true;w.result='TOURING ROUTE CLEARED';}
  }else{
    p.lap=Math.min(3,Math.floor(w.distance/1200));
    if(w.distance>=3600){w.finished=true;w.result='RETRO TOUR COMPLETED';}
  }
}
function recoverStunt(w){
  const p=w.player;
  p.x=0;p.z=-p.lastSafe;p.y=stuntRoad(p.lastSafe)??2;
  p.vx=0;p.vy=0;p.vz=0;p.speed=8;p.grounded=true;p.flip=0;
  p.health=Math.max(0,p.health-18);w.contacts++;
  w.event='TRACK FALL · RESPAWN -18 HP';
}
function stepStunt(w,input,dt){
  const p=w.player,previousY=p.y;
  // Stunt lanes use heading-relative steering but retain a narrow, suspended course.
  vehicle(p,input,dt,47);
  const s=-p.z;
  const track=s>=0?stuntRoad(s):null;
  if(track!==null&&Math.abs(p.x)<8){
    const elevation=track;
    // When grounded, suspension follows downhill grade; an actual gap
    // removes support and gravity then takes over on the next fixed tick.
    if(p.grounded){p.y=elevation;p.vy=0;}
    // Airborne contact must cross the road surface from above; no underside teleport.
    if(p.y<=elevation+.05&&p.vy<=0&&
       (p.grounded||previousY>=elevation-1.2)){
      const impact=-p.vy;
      if(!p.grounded&&impact>12){
        const damage=Math.round((impact-12)*2.5);
        p.health=Math.max(0,p.health-damage);w.event='HARD LANDING · -'+damage+' HP';
      }
      p.y=elevation;p.vy=0;p.grounded=true;p.flip=0;
    }
    if(p.grounded&&s-p.lastSafe>55){
      // A checkpoint must never land inside either unsupported bridge span.
      let safe=Math.floor(s/55)*55;
      while(safe>0&&stuntRoad(safe)===null)safe-=55;
      p.lastSafe=safe;
    }
  }else p.grounded=false;
  if(p.y< -15||Math.abs(p.x)>14||s< -20){recoverStunt(w);return;}
  if(p.health===0){w.finished=true;w.result='VEHICLE DESTROYED';return;}
  if(s>=TRACK_LENGTH){
    p.z+=TRACK_LENGTH;p.lastSafe=0;p.lap++;
    w.event='STUNT LAP '+p.lap;
    if(p.lap>=2){w.finished=true;w.result='ELEVATED CIRCUIT CLEARED';}
  }
}
function stepSprint(w,previous){
  const p=w.player,s=Math.max(0,-p.z),center=sprintCenter(s);
  // Roadside mistakes cost speed and, periodically, body health.
  if(Math.abs(p.x-center)>12){
    p.speed*=.965;
    if(w.tick%75===0){p.health=Math.max(0,p.health-2);w.event='SPRINT · OFF ROAD';}
    p.x=clamp(p.x,center-50,center+50);
  }
  const oldStage=Math.floor(w.distance/900),newStage=Math.min(4,Math.floor(s/900));
  w.distance=Math.max(w.distance,Math.min(s,SPRINT_LENGTH));
  p.lap=Math.max(p.lap,newStage);
  if(newStage>oldStage&&newStage<4)w.event='SCENIC CHECKPOINT '+newStage;
  // Award the finish only at the forward crossing of the finish plane.
  // Re-entering the corridor beyond the final piece of asphalt is not a finish.
  if(previous.z>=-SPRINT_LENGTH&&p.z<-SPRINT_LENGTH){
    const fraction=(previous.z+SPRINT_LENGTH)/(previous.z-p.z);
    const finishX=previous.x+(p.x-previous.x)*fraction;
    if(Math.abs(finishX-sprintCenter(SPRINT_LENGTH))<=12){
      w.finished=true;w.result='COASTAL SPRINT FINISHED';
    }
  }
}
function stepCircuit(w){
  const p=w.player;
  if(distance(p,RACE_GATES[p.checkpoint])<12){
    if(p.checkpoint===0){p.lap++;w.event='LAP '+p.lap;}
    p.checkpoint=(p.checkpoint+1)%RACE_GATES.length;
    if(p.lap>=3){w.finished=true;w.result='CIRCUIT RACE WON';}
  }
}
export function stepRace(w,input={},dt=STEP){
  if(!w||!MODES.includes(w.mode))throw new TypeError('invalid racing state');
  if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw new RangeError('fixed timestep outside safe bounds');
  if(w.finished)return w;
  w.event='';w.tick++;w.elapsed+=dt;
  const p=w.player;if(p.cooldown>0)p.cooldown--;
  if(w.mode==='retro'||w.mode==='tour'){stepRetro(w,input,dt);
    if(p.health===0){w.finished=true;w.result='VEHICLE DESTROYED';}
    return w;}
  if(w.mode==='stunt'){stepStunt(w,input,dt);return w;}
  const before={x:p.x,z:p.z};
  vehicle(p,input,dt,w.mode==='circuit'?40:w.mode==='sprint'?48:37);
  // Flat-world suspension: collision plane is Y=0 (the car origin).
  if(p.y<=0){if(!p.grounded&&p.vy< -14){
    p.health=Math.max(0,p.health-Math.round((-p.vy-14)*2));w.event='HARD LANDING';
  }p.y=0;p.vy=0;p.grounded=true;p.flip=0;}
  if(w.mode!=='sprint')arenaBounds(p);
  updateBots(w,dt,before);
  if(w.mode==='sprint')stepSprint(w,before);
  if(w.mode==='circuit')stepCircuit(w);
  if(w.mode==='ball')updateBall(w,dt);
  if(w.mode==='derby'&&p.knockouts>=4){w.finished=true;w.result='DERBY CHAMPION';}
  if(w.mode==='ball'&&Math.max(...w.score)>=5){
    w.finished=true;w.result=w.score[0]>w.score[1]?'ARENA FOOTBALL WIN':'RIVALS WIN';
  }
  if(p.health===0){w.finished=true;w.result='VEHICLE DESTROYED';}
  return w;
}
