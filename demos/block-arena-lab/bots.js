// SPDX-License-Identifier: Apache-2.0
// Demo-owned opponent policy; movement, routing and combat are public modules.
import {NavigationGrid,findPath} from '../../modules/navigation/index.js';
import {raycast} from '../../modules/collision/index.js';
import {characterView,lookCharacter} from '../../modules/character/index.js';
export function arenaNavigation(pack){
  const size=pack.settings.size,blocked=[];
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const px=x+.5-size/2,pz=z+.5-size/2;
    if(pack.solids.some(s=>s.box.max[1]>.25&&s.box.min[1]<1.8&&px+.4>s.box.min[0]&&px-.4<s.box.max[0]&&pz+.4>s.box.min[2]&&pz-.4<s.box.max[2]))blocked.push([x,z]);
  }
  return new NavigationGrid({width:size,height:size,origin:[-size/2,-size/2],blocked});
}
export function visible(world,from,to){const delta=to.map((v,i)=>v-from[i]),distance=Math.hypot(...delta);return distance<.001||!raycast(from,delta,distance,world.pack.solids);}
export function botCommand(world,bot,index){
  const c=bot.character,p=world.player,profile=bot.profile,eye=characterView(c).position,targetEye=characterView(p).position,delta=targetEye.map((v,i)=>v-eye[i]),distance=Math.hypot(...delta);
  const alive=world.combat.actor('player').health>0,see=alive&&distance<40&&visible(world,eye,targetEye),difficulty=world.pack.settings.difficulty[world.difficulty];
  if(see){if(!bot.seen)bot.readyAt=world.tick+difficulty.reaction;bot.lastSeen=[...p.position];bot.seen=true;bot.lostAt=world.tick;}else{bot.seen=false;if(world.tick-bot.lostAt>180)bot.lastSeen=null;}
  let goal=bot.lastSeen??world.pack.spawns.bots[(index+Math.floor(world.tick/300))%world.pack.spawns.bots.length];
  const health=world.combat.actor(bot.id).health;
  bot.state=see?'strafe':bot.lastSeen?'pursuit':world.tick%300<45?'idle':'patrol';
  if(health<profile.health*.45&&(see||bot.coverGoal)&&(Math.floor(world.tick/120)+index)%2===0){
    // At most 32 cover rays per decision, at most one decision per bot/second.
    // Alternate cover/peek windows; never rebuild every frame or test all cells.
    if(world.tick>=bot.nextCover){
      const candidates=world.cover.map(q=>({q,d:(q[0]-c.position[0])**2+(q[1]-c.position[2])**2})).sort((a,b)=>a.d-b.d).slice(0,32);
      bot.coverGoal=null;for(const {q}of candidates){world.work.coverRays++;if(!visible(world,targetEye,[q[0],1,q[1]])){bot.coverGoal=[q[0],0,q[1]];break;}}
      bot.nextCover=world.tick+60;
    }
    if(bot.coverGoal){goal=bot.coverGoal;bot.state='cover';}
  }
  if(world.tick%12===index%12&&world.tick>=bot.nextPath&&bot.state!=='strafe'){
    const from=world.grid.worldToCell([c.position[0],c.position[2]]),to=world.grid.worldToCell([goal[0],goal[2]]);
    if(from&&to){const route=findPath(world.grid,from,to,{maxExpanded:256});world.work.expanded+=route.expanded;world.work.paths++;bot.path=route.path.slice(1);}
    bot.nextPath=world.tick+60;
  }
  let dx=0,dz=0;
  if(bot.state==='strafe'){
    const forward=distance>profile.range*.9?1:distance<profile.range*.45?-1:0,side=(Math.floor(world.tick/75)+index)%2?1:-1,n=Math.max(1,Math.hypot(delta[0],delta[2]));
    dx=delta[0]/n*forward-delta[2]/n*side;dz=delta[2]/n*forward+delta[0]/n*side;
  }else if(bot.state!=='idle'&&bot.path.length){const q=world.grid.cellCenter(bot.path[0]);dx=q[0]-c.position[0];dz=q[1]-c.position[2];if(Math.hypot(dx,dz)<.3)bot.path.shift();}
  if(see){const yaw=Math.atan2(-delta[0],-delta[2]),pitch=Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));lookCharacter(c,{yaw:yaw-c.yaw,pitch:pitch-c.pitch});}
  const n=Math.max(1,Math.hypot(dx,dz)),cos=Math.cos(c.yaw),sin=Math.sin(c.yaw);
  const fire=see&&distance<=profile.range&&world.tick>=bot.readyAt&&world.tick>=bot.nextFire;
  if(fire)bot.nextFire=world.tick+profile.cadence;
  return {move:[(cos*dx-sin*dz)/n,(sin*dx+cos*dz)/n],fire,reload:true,weapon:profile.weapon,error:difficulty.error};
}
