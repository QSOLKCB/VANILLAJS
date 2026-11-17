// SPDX-License-Identifier: Apache-2.0
// Lab-owned race progression and route-following driver. Motion is vehicle3d only.
import {rotate} from '../../modules/math/index.js';
import {createVehicle,VEHICLE_STEP} from '../../modules/vehicle3d/index.js';
import {validateRaceProject} from './race-project.js';
import {createDriveWorld} from './drive-world.js';
import {bridgeGuardrails,bridgePhysics} from './race-guardrails.js';
import {resolveRaceContact} from './race-contact.js';
import {createRaceCheckpoints,crossesRaceCheckpoint,locateOnRoad,raceRoadStatus} from './race-course.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
/** Pure driver output. Route samples aim steering; they never set vehicle position. */
export function raceDriverInput(road,state,recipe,{speed=10,lateral=2,rows=road.stations()}={}){
  const location=locateOnRoad(road,state.position,rows),velocity=Math.hypot(state.velocity[0],state.velocity[2]),lookahead=6+velocity*.65,target=road.sample(Math.min(road.length,location.distance+lookahead),clamp(lateral,-location.width/2+2,location.width/2-2)).position;
  const f=rotate(state.orientation,[0,0,-1]),right=rotate(state.orientation,[1,0,0]),delta=target.map((n,i)=>n-state.position[i]),forward=delta.reduce((s,n,i)=>s+n*f[i],0),across=delta.reduce((s,n,i)=>s+n*right[i],0),alpha=Math.atan2(across,forward),distance=Math.hypot(delta[0],delta[2]);
  const desiredAngle=Math.atan2(2*recipe.wheel.wheelbase*Math.sin(alpha),Math.max(2,distance)),steer=clamp(desiredAngle*(1+velocity*recipe.steering.speedReduction)/recipe.steering.maxAngle,-1,1);
  const curveLimit=clamp(1-Math.abs(alpha)*.55,.5,1),targetSpeed=speed*curveLimit,error=targetSpeed-velocity;
  return {throttle:clamp(.3+error*.3,0,1),brake:clamp(-error*.22,0,1),steer};
}
function spawnAt(car,road,distance,lateral){
  const p=road.sample(distance,lateral),r=car.recipe,height=r.wheel.radius+r.suspension.restLength-r.mass*9.81/(4*r.suspension.spring);
  return car.spawn({position:[p.position[0],p.position[1]+height,p.position[2]],yaw:p.yaw,pitch:p.pitch,roll:p.roll});
}
function progress(lateral){return {checkpointIndex:0,finished:false,finishTime:null,penaltySeconds:0,recoveries:0,distance:12,fraction:0,lateral,offRoad:false};}
/** Game-owned fall/terrain admission against the *rendered* triangle sampler.
 * Native vehicle3d and legitimate underpasses remain unchanged.
 */
export function raceWorldSafety(session,which='player'){
  if(!session||!['player','rival'].includes(which))throw TypeError('Accepted race and driver required');
  const s=session[which],world=session.world,rows=session.rows;
  if(!s||!Array.isArray(s.position)||s.position.length!==3||!s.position.every(Number.isFinite)||
    !world?.physics||typeof world.physics.sampleSurface!=='function'||!Array.isArray(rows)||rows.length<2)
    throw TypeError('Finite race state and triangulated world required');
  const [x,y,z]=s.position,first=rows[0],second=rows[1],
    dx=second.center[0]-first.center[0],dz=second.center[2]-first.center[2],len=Math.hypot(dx,dz);
  if(!(len>0))throw RangeError('Degenerate start tangent');
  const behind=((x-first.center[0])*dx+(z-first.center[2])*dz)/len;
  const progress=which==='player'?session.progress:session.rivalProgress;
  // The start plane is not a global boundary: creator routes can loop back
  // across it. Only a vehicle whose nearest route station is at the start
  // has actually reversed out of the starting segment.
  if(behind< -1&&progress.offRoad&&locateOnRoad(session.road,s.position,rows).distance<=rows[1].distance)
    return 'BEHIND_START';
  // Road over terrain: peel away higher asphalt layers until the actual
  // triangulated terrain is found. A bridge underpass is not an anomaly.
  let ceiling=2000;
  for(let i=0;i<6;i++){
    const hit=world.physics.sampleSurface(x,z,ceiling);
    if(!hit)break;
    if(hit.surfaceId.startsWith('terrain:'))
      return y<hit.height-.3?'UNDER_TERRAIN':null;
    ceiling=hit.height-.02;
    if(ceiling< -2000)break;
  }
  if(y<Math.min(...rows.map(row=>row.center[1]))-40)return 'OUT_OF_WORLD';
  return null;
}
export function createRaceSession(value){return new RaceSession(value);}
class RaceSession{
  #player;#rival;#car;#rivalCar;#playerProgress;#rivalProgress;#ticks=0;#countdownTicks=0;#phase='ready';#rivalStuck=0;#result=null;
  constructor(value){
    this.project=freeze(validateRaceProject(value));this.world=createDriveWorld(this.project.scenery,this.project.surfaces,'coast');this.road=this.world.scenic.road;this.rows=this.road.stations();this.bridgeRails=bridgeGuardrails(this.road);this.checkpoints=freeze(createRaceCheckpoints(this.road,this.project.race.checkpointCount));this.#car=createVehicle(this.project.vehicle);this.#rivalCar=createVehicle(this.project.vehicle);this.reset();
  }
  get player(){return this.#player;}get rival(){return this.#rival;}get phase(){return this.#phase;}get countdown(){return this.#countdownTicks/240;}get time(){return this.#ticks/240;}get result(){return this.#result;}get progress(){return {...this.#playerProgress};}get rivalProgress(){return {...this.#rivalProgress};}
  reset(){this.#player=freeze(spawnAt(this.#car,this.road,12,-2));this.#rival=freeze(spawnAt(this.#rivalCar,this.road,12,2));this.#playerProgress=progress(-2);this.#rivalProgress=progress(2);this.#ticks=0;this.#countdownTicks=Math.round(this.project.race.countdownSeconds*240);this.#phase='ready';this.#rivalStuck=0;this.#result=null;return this.snapshot();}
  start(){if(this.#phase==='ready')this.#phase=this.#countdownTicks?'countdown':'running';return this.#phase;}
  #advanceProgress(progress,before,after,dt){
    const location=raceRoadStatus(this.road,after.position,this.rows);progress.distance=location.distance;progress.fraction=clamp((location.distance-12)/(this.checkpoints.at(-1).distance-12),0,1);progress.lateral=location.lateral;progress.offRoad=location.offRoad;
    const gate=this.checkpoints[progress.checkpointIndex];
    if(gate&&crossesRaceCheckpoint(gate,before.position,after.position,Math.min(4,120*dt+.01))){
      progress.checkpointIndex++;
      if(progress.checkpointIndex===this.checkpoints.length){progress.finished=true;progress.finishTime=this.time+progress.penaltySeconds;progress.fraction=1;}
    }
  }
  #recover(which){
    const rival=which==='rival',p=rival?this.#rivalProgress:this.#playerProgress;if(p.finished)return false;
    const distance=p.checkpointIndex?this.checkpoints[p.checkpointIndex-1].distance+2:12,car=rival?this.#rivalCar:this.#car,previous=rival?this.#rival:this.#player,next=spawnAt(car,this.road,Math.min(distance,this.road.length-14),rival?2:-2);next.tick=previous.tick;
    if(rival)this.#rival=freeze(next);else this.#player=freeze(next);p.recoveries++;p.penaltySeconds+=this.project.race.recoveryPenaltySeconds;p.distance=distance;p.fraction=clamp((distance-12)/(this.checkpoints.at(-1).distance-12),0,1);p.lateral=rival?2:-2;p.offRoad=false;return true;
  }
  recover(){if(!['running','countdown'].includes(this.#phase))return false;return this.#recover('player');}
  step(input={},dt=VEHICLE_STEP){
    if(![1/240,VEHICLE_STEP,1/60].includes(dt))throw RangeError('Race dt must be 1/240, 1/120 or 1/60 second');
    if(!['countdown','running'].includes(this.#phase))return this.#phase;
    const quanta=Math.round(dt*240);
    // Countdown settles suspension under brakes; commands have no launch advantage.
    if(this.#phase==='countdown'){
      const player=this.#car.step(this.#player,{brake:1},bridgePhysics(this.world.physics,this.bridgeRails,this.#player.position),dt),rival=this.#rivalCar.step(this.#rival,{brake:1},bridgePhysics(this.world.physics,this.bridgeRails,this.#rival.position),dt);
      this.#player=freeze(player);this.#rival=freeze(rival);this.#countdownTicks=Math.max(0,this.#countdownTicks-quanta);if(!this.#countdownTicks)this.#phase='running';return this.#phase;
    }
    const before=this.#player,rivalBefore=this.#rival,rivalInput=this.#rivalProgress.finished?{brake:1}:raceDriverInput(this.road,rivalBefore,this.#rivalCar.recipe,{speed:this.project.race.rivalSpeed,lateral:2,rows:this.rows});
    // Both transitions complete before replacing accepted state.
    const advancedPlayer=this.#car.step(before,this.#playerProgress.finished?{brake:1}:input,bridgePhysics(this.world.physics,this.bridgeRails,before.position),dt),
          advancedRival=this.#rivalCar.step(rivalBefore,rivalInput,bridgePhysics(this.world.physics,this.bridgeRails,rivalBefore.position),dt),
          {player,rival}=resolveRaceContact(advancedPlayer,advancedRival,this.project.vehicle);
    this.#player=freeze(player);this.#rival=freeze(rival);this.#ticks+=quanta;
    if(!this.#playerProgress.finished)this.#advanceProgress(this.#playerProgress,before,player,dt);
    if(!this.#rivalProgress.finished)this.#advanceProgress(this.#rivalProgress,rivalBefore,rival,dt);
    const stuck=!this.#rivalProgress.finished&&(this.#rivalProgress.offRoad||rival.needsRecovery||(Math.hypot(...rival.velocity)<.5&&this.time>5));this.#rivalStuck=stuck?this.#rivalStuck+quanta:0;
    if(this.#rivalStuck>5*240){this.#recover('rival');this.#rivalStuck=0;}
    const p=this.#playerProgress,r=this.#rivalProgress;
    if(p.finished&&(r.finished||this.time>=p.finishTime)){this.#phase='finished';this.#result=!r.finished||p.finishTime<r.finishTime?'win':p.finishTime===r.finishTime?'draw':'loss';}
    return this.#phase;
  }
  snapshot(){return {phase:this.#phase,countdown:this.countdown,time:this.time,result:this.#result,checkpointIndex:this.#playerProgress.checkpointIndex,checkpointCount:this.checkpoints.length,distance:this.#playerProgress.distance,fraction:this.#playerProgress.fraction,progress:{...this.#playerProgress},rivalProgress:{...this.#rivalProgress},player:clone(this.#player),rival:clone(this.#rival),routeLength:this.road.length,nextCheckpoint:clone(this.checkpoints[this.#playerProgress.checkpointIndex]??null)};}
}
