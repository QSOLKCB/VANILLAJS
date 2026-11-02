// SPDX-License-Identifier: Apache-2.0
import {aabb,raycast} from '../../modules/collision/index.js';
import {createCharacter,characterConfig,characterView,lookCharacter,stepCharacterPlatforms} from '../../modules/character/index.js';
import {createInteractionResolver} from '../../modules/interactions/index.js';
import {finiteVector} from '../../modules/math/index.js';
import {PUZZLES,VaultLock,LEVEL_SET,integer,exactRecord} from './puzzles.js';

export const STEP=1/120, MAX_TICKS=120*60*60*4;
export const GATES=Object.freeze([-3,-13,-23,-33,-43,-53]);
export const palette=Object.freeze({stone:[.28,.25,.20],dark:[.14,.14,.12],brass:[.64,.45,.21],light:[.94,.75,.39],floor:[.21,.20,.17]});
const baseY=index=>index===5?2:0;
export const consolePosition=index=>[-2.8,baseY(integer(index,0,5,'console index'))+1.3,GATES[index]+3.2];
export function solid(id,center,size,color=palette.stone) {
  return {id,center,size,color,box:aabb(center.map((v,i)=>v-size[i]/2),center.map((v,i)=>v+size[i]/2))};
}
function architecture() {
  const parts=[solid('floor-south',[0,-.5,-13],[16,1,42],palette.floor),
    solid('floor-middle',[0,-.5,-40.5],[16,1,5],palette.floor),
    solid('floor-upper',[0,1,-55],[16,2,16],palette.floor),
    solid('wall-west',[-8.4,3.5,-27.5],[.8,7,71]),solid('wall-east',[8.4,3.5,-27.5],[.8,7,71]),
    solid('wall-south',[0,3.5,8.4],[16,7,.8]),solid('wall-north',[0,4.5,-63.4],[16,9,.8]),
    solid('pit-bottom',[0,-5.5,-40.5],[16,1,15],palette.dark)];
  GATES.forEach((z,i)=>{
    const y=baseY(i);
    for(const side of [-1,1]){
      parts.push(solid(`partition-${i}-${side}`,[side*5.25,y+3,z],[5.5,6,.8]),
        solid(`pilaster-${i}-${side}`,[side*2.7,y+2.25,z+.17],[.48,4.5,1.15],palette.brass),
        solid(`plinth-${i}-${side}`,[side*3,y+.22,z+.25],[1.2,.44,1.5],palette.dark));
    }
    parts.push(solid(`lintel-${i}`,[0,y+4.5,z],[5.8,.6,1.2],palette.brass));
    const c=consolePosition(i);
    parts.push(solid(`console-${i}`,[c[0],y+.6,c[2]],[1.25,1.2,1.1],palette.dark),
      solid(`console-top-${i}`,[c[0],y+1.23,c[2]],[1.48,.16,1.3],palette.brass));
  });
  return parts;
}
export function progress(session) {let n=0;while(n<6&&session.sealedAt[n]!==null)n++;return n;}
export function mechanismGeometry(session,tick=session.mechanismTick) {
  const parts=[];
  for(let i=0;i<6;i++){
    const release=session.sealedAt[i],age=release===null?0:Math.max(0,tick-release),open=Math.min(1,age/180),z=GATES[i],y=baseY(i);
    if(i===1){
      for(const side of [-1,1])parts.push(solid(`door-${i}-${side}`,[side*(1.25+open*2.6),y+2,z],[2.5,4,.5],palette.brass));
    }else parts.push(solid(`door-${i}`,[0,y+2+open*4.6,z],[5,4,.5],i===5?palette.light:palette.brass));
  }
  const bridgeAge=session.sealedAt[3]===null?0:Math.max(0,tick-session.sealedAt[3]);
  parts.push(solid('causeway',[0,-2.25+2*Math.min(1,bridgeAge/240),-36],[5,.5,4],palette.brass));
  const age=session.sealedAt[4]===null?0:Math.max(0,tick-session.sealedAt[4]),phase=age%960;
  const height=phase<240?0:phase<480?(phase-240)/120:phase<720?2:2-(phase-720)/120;
  parts.push(solid('lift',[0,height-.25,-45],[5,.5,4],palette.brass));
  return parts;
}
const resolver=createInteractionResolver([{id:'engage-seal',match:{source:'keeper',target:'seal'},requires:[
  {scope:'context',key:'reachable',equals:true,code:'distance',message:'Approach the active console with a clear line of sight.'},
  {scope:'context',key:'active',equals:true,code:'sequence',message:'Release the preceding seals first.'},
  {scope:'target',key:'idle',equals:true,code:'pending',message:'Finish or undo the pending revolution before engaging.'},
  {scope:'target',key:'matches',equals:true,code:'word',message:'The latched word must match the engraved target.'}
],effects:[{type:'release'}],reason:{code:'released',message:'The seal is engaged. Its mechanism is released.'}}]);
export function createVault() {
  const character=createCharacter({position:[0,0,5]});
  return {ticks:0,mechanismTick:0,locks:PUZZLES.map((_,i)=>new VaultLock(i)),sealedAt:Array(6).fill(null),
    character,previous:characterView(character),solids:architecture(),config:characterConfig({walkSpeed:4.5,sprintSpeed:7}),
    checkpoint:0,console:null,rescues:0,complete:false,blocked:false,truncated:false,limit:false};
}
export function consoleAccess(session,index=progress(session)) {
  if(index===6)return {index,distance:0,available:false};
  integer(index,0,5,'console index');
  const from=characterView(session.character).position,to=consolePosition(index),direction=to.map((v,i)=>v-from[i]),distance=Math.hypot(...direction);
  const hit=raycast(from,direction,distance,[...session.solids,...mechanismGeometry(session)],{ignoreIds:[`console-${index}`,`console-top-${index}`]});
  return {index,distance,available:index===progress(session)&&distance<=3.8&&!hit&&session.character.grounded&&!session.complete};
}
export function openConsole(session) {
  const access=consoleAccess(session);if(!access.available)return false;
  session.console=access.index;session.checkpoint=Math.max(session.checkpoint,access.index);
  session.character.velocity[0]=0;session.character.velocity[2]=0;return true;
}
export function closeConsole(session) {
  if(session.console!==null)session.locks[session.console].stopMotor();
  session.console=null;
}
export function operateLock(session,command) {
  const i=session.console;
  if(i===null||i!==progress(session)||session.complete)return false;
  const lock=session.locks[i];
  if(command==='turn')return lock.turn();
  if(command==='detent')return lock.detent();
  if(command==='undo')return lock.undo();
  if(command==='reset'){lock.reset();return true;}
  if(Number.isInteger(command))return lock.lever(command);
  throw new TypeError('Unknown lock operation.');
}
export function engageSeal(session,index=session.console) {
  integer(index,0,5,'seal index');const state=session.locks[index].snapshot();
  const result=resolver.evaluate({source:{kind:'keeper'},target:{kind:'seal',matches:state.word===PUZZLES[index].target,
    idle:state.detents===0&&state.subTick===0&&!state.motor},context:{reachable:consoleAccess(session,index).available,active:index===progress(session)}});
  if(result.status==='applied'){
    session.sealedAt[index]=session.mechanismTick;session.checkpoint=Math.max(session.checkpoint,index);closeConsole(session);
  }
  return result;
}
function recover(session) {
  const i=session.checkpoint;session.character=createCharacter({position:[0,baseY(i),GATES[i]+4]});
  session.previous=characterView(session.character);session.rescues++;closeConsole(session);
}
export function stepVault(session,input={},dt=STEP) {
  if(dt!==0&&dt!==STEP)throw new RangeError('Vault updates require one 1/120-second tick.');
  if(dt===0||session.complete||session.ticks===MAX_TICKS)return;
  const move=finiteVector(input.move??[0,0],2,'move'),yaw=input.look?.yaw??0,pitch=input.look?.pitch??0;
  if(!Number.isFinite(yaw)||!Number.isFinite(pitch))throw new RangeError('Invalid look input.');
  const walking=session.console===null;
  session.previous=characterView(session.character);
  lookCharacter(session.character,walking?{yaw,pitch}:{yaw:0,pitch:0});
  const current=mechanismGeometry(session),next=mechanismGeometry(session,session.mechanismTick+1);
  const moving=current.map((part,i)=>({...part,displacement:next[i].center.map((v,k)=>v-part.center[k])}));
  const command=walking?{move,jump:!!input.jump,crouch:!!input.crouch,sprint:!!input.sprint}:{move:[0,0],crouch:session.character.crouched};
  let movement=stepCharacterPlatforms(session.character,command,dt,session.config,[...session.solids,...moving]);
  session.blocked=movement.blocked;
  if(movement.blocked){
    // Hold every mechanism on a blocked kinematic transaction, then allow the
    // player to move out against the stopped world. No partial carry is committed.
    movement=stepCharacterPlatforms(session.character,command,dt,session.config,[...session.solids,...current]);
  }else session.mechanismTick++;
  session.truncated=movement.truncated;session.ticks++;
  if(session.console!==null)session.locks[session.console].tick();
  if(session.character.position[1]<-3)recover(session);
  if(session.console!==null&&!consoleAccess(session,session.console).available)closeConsole(session);
  session.complete=progress(session)===6&&session.character.position[2]<-59&&session.character.position[1]>1.8;
  session.limit=session.ticks===MAX_TICKS;
}

const poseKeys=['position','velocity','yaw','pitch','crouched','grounded','supportId','supportVelocity'];
export function exportVault(session) {
  const player={};for(const key of poseKeys)player[key]=Array.isArray(session.character[key])?[...session.character[key]]:session.character[key];
  return {schemaVersion:1,game:'clockwork-vault',levelSet:LEVEL_SET,ticks:session.ticks,mechanismTick:session.mechanismTick,
    locks:session.locks.map(lock=>lock.exportReplay()),sealedAt:[...session.sealedAt],player,checkpoint:session.checkpoint,
    console:session.console,rescues:session.rescues,complete:session.complete};
}
export function importVault(data) {
  exactRecord(data,['schemaVersion','game','levelSet','ticks','mechanismTick','locks','sealedAt','player','checkpoint','console','rescues','complete'],'vault replay');
  if(data.schemaVersion!==1||data.game!=='clockwork-vault'||data.levelSet!==LEVEL_SET)throw new TypeError('Unsupported vault replay or puzzle revision.');
  integer(data.ticks,0,MAX_TICKS,'saved ticks');integer(data.mechanismTick,0,data.ticks,'mechanism ticks');
  integer(data.checkpoint,0,5,'checkpoint');integer(data.rescues,0,MAX_TICKS,'rescue count');
  if(!Array.isArray(data.locks)||data.locks.length!==6||!Array.isArray(data.sealedAt)||data.sealedAt.length!==6)throw new TypeError('Replay must contain six seals.');
  const next=createVault();next.locks=Array.from({length:6},(_,i)=>VaultLock.fromReplay(i,data.locks[i]));
  let earlier=0,unsealed=false;
  for(let i=0;i<6;i++){
    const at=data.sealedAt[i],state=next.locks[i].snapshot();
    if(at!==null){
      integer(at,earlier,data.mechanismTick,'seal time');earlier=at;
      if(unsealed||state.word!==PUZZLES[i].target||state.detents||state.subTick||state.motor)throw new RangeError('Invalid sealed sequence.');
    }else{
      if(unsealed&&(state.commands.length||state.detents||state.subTick||state.motor))throw new RangeError('A future seal cannot already be operated.');
      unsealed=true;
    }
  }
  Object.assign(next,{ticks:data.ticks,mechanismTick:data.mechanismTick,sealedAt:[...data.sealedAt],checkpoint:data.checkpoint,rescues:data.rescues});
  if(data.checkpoint>Math.min(5,progress(next)))throw new RangeError('Checkpoint is ahead of the seals.');
  exactRecord(data.player,poseKeys,'player');const p=data.player;
  const position=finiteVector(p.position,3,'saved position'),velocity=finiteVector(p.velocity,3,'saved velocity'),supportVelocity=finiteVector(p.supportVelocity,3,'support velocity');
  if(position[0]<-7.7||position[0]>7.7||position[1]<-3||position[1]>8||position[2]<-63||position[2]>8||
    velocity.some(v=>Math.abs(v)>100)||supportVelocity.some(v=>Math.abs(v)>100))throw new RangeError('Saved pose is outside the vault bounds.');
  if(!Number.isFinite(p.yaw)||p.yaw< -Math.PI||p.yaw>=Math.PI||!Number.isFinite(p.pitch)||Math.abs(p.pitch)>Math.PI/2-.01||
    typeof p.crouched!=='boolean'||typeof p.grounded!=='boolean'||typeof data.complete!=='boolean')throw new TypeError('Invalid saved player state.');
  const player=createCharacter({position,velocity,yaw:p.yaw,pitch:p.pitch});
  Object.assign(player,{yaw:p.yaw,pitch:p.pitch,crouched:p.crouched,grounded:p.grounded,supportId:p.supportId,supportVelocity});
  if(p.crouched){player.halfExtents[1]=player.crouchHalfHeight;player.eyeHeight=player.crouchEyeHeight;}
  const geometry=[...next.solids,...mechanismGeometry(next)],support=geometry.find(part=>part.id===p.supportId);
  const min=position.map((v,i)=>v-(i===1?0:player.halfExtents[i])),max=position.map((v,i)=>v+(i===1?2*player.halfExtents[i]:player.halfExtents[i]));
  if(geometry.some(part=>min.every((v,i)=>v<part.box.max[i]-1e-5&&max[i]>part.box.min[i]+1e-5)))throw new RangeError('Saved player overlaps solid geometry.');
  if(p.grounded){
    if(!support||Math.abs(position[1]-support.box.max[1])>.003||![0,2].every(i=>max[i]>support.box.min[i]&&min[i]<support.box.max[i]))throw new RangeError('Saved support does not match the player.');
    if(supportVelocity[0]!==0||supportVelocity[2]!==0||Math.abs(supportVelocity[1])>3.1||
      (next.solids.includes(support)&&supportVelocity.some(v=>v!==0)))throw new RangeError('Invalid support motion.');
  }else if(p.supportId!==null||supportVelocity.some(v=>v!==0))throw new RangeError('Airborne player has an invalid support.');
  next.character=player;next.previous=characterView(player);
  if(data.console!==null){
    integer(data.console,0,5,'open console');
    if(!consoleAccess(next,data.console).available)throw new RangeError('Saved console is not reachable.');
  }else if(next.locks.some(lock=>lock.snapshot().motor))throw new RangeError('A motor cannot run without its console.');
  next.console=data.console;
  next.complete=progress(next)===6&&position[2]<-59&&position[1]>1.8;
  if(data.complete!==next.complete)throw new RangeError('Completion does not match the saved expedition.');
  next.limit=next.ticks===MAX_TICKS;return next;
}
