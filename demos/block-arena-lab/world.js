// SPDX-License-Identifier: Apache-2.0
import {Combat3D,fpsList,fpsNumber} from '../../modules/combat3d/index.js';
import {validateFPSPack} from '../../modules/mod-fps/index.js';
import {createCharacter,characterConfig,characterView,lookCharacter,stepCharacter} from '../../modules/character/index.js';
import {rotate,seededRandom} from '../../modules/math/index.js';
import {arenaNavigation,botCommand} from './bots.js';
export const FPS_MAX_TICKS=36000;
export const FPS_INPUT=Object.freeze({fire:1,reload:2,jump:4,crouch:8,sprint:16,scope:32,cancel:64});
/** One complete logical-tick command: move milliunits, look microradians,
 * action bitfield, selected weapon 0..2. No accepted input lies outside replay. */
export function validateFPSInput(v){fpsList(v,6);if(v.length!==6)throw new TypeError('six input channels required');
  v.forEach((x,i)=>fpsNumber(x,i<2?-1000:i<4?-3141593:0,i<2?1000:i<4?3141593:i===4?127:2,true));return [...v];}
export class ArenaWorld {
  constructor(source,mode='skirmish',difficulty='normal',seed=2026){
    const pack=validateFPSPack(source);if(!['skirmish','survival'].includes(mode)||!Object.hasOwn(pack.settings.difficulty,difficulty))throw new TypeError('mode/difficulty');fpsNumber(seed,0,4294967295,true);
    Object.assign(this,{pack,mode,difficulty,seed,tick:0,status:'playing',wave:0,wait:0,events:[],bots:[],pickups:pack.spawns.pickups.map(p=>({...p,available:true})),work:{paths:0,expanded:0,coverRays:0},random:seededRandom(seed),player:createCharacter({position:pack.spawns.player}),weapon:0,scope:false});
    this.config=characterConfig({walkSpeed:6,sprintSpeed:9});this.boxes=pack.solids.map(s=>s.box);this.grid=arenaNavigation(pack);
    this.cover=[];for(let z=1;z<this.grid.height-1;z++)for(let x=1;x<this.grid.width-1;x++)if(this.grid.walkable([x,z])&&[[x-1,z],[x+1,z],[x,z-1],[x,z+1]].some(p=>!this.grid.walkable(p)))this.cover.push(this.grid.cellCenter([x,z]));
    this.combat=new Combat3D({actors:[{id:'player',team:0,position:pack.spawns.player,health:pack.settings.rules.playerHealth,armour:pack.settings.rules.playerArmour}],weapons:pack.arsenal.weapons,solids:pack.solids.map(({id,box,material})=>({id,box,material})),friendlyFire:pack.settings.rules.friendlyFire,selfDamage:pack.settings.rules.selfDamage});
    this.beginWave(mode==='skirmish'?pack.spawns.bots.slice(0,4).map((_,i)=>pack.bots.types[i%pack.bots.types.length].id):pack.waves.rosters[0]);
  }
  beginWave(roster){
    this.wave++;for(let i=0;i<roster.length;i++){
      const id='bot-'+i,profile=this.pack.bots.types.find(b=>b.id===roster[i]),position=this.pack.spawns.bots[i],existing=this.bots.find(b=>b.id===id);
      if(existing)this.events.push(this.combat.respawn(id,position,{health:profile.health,armour:profile.armour}));else this.combat.addActor({id,team:1,position,health:profile.health,armour:profile.armour});
      const b={id,profile,character:createCharacter({position,yaw:Math.PI}),state:'idle',path:[],seen:false,lastSeen:null,lostAt:-1000,readyAt:0,nextPath:0,nextFire:0,nextCover:0,coverGoal:null};
      if(existing)this.bots[this.bots.indexOf(existing)]=b;else this.bots.push(b);
    }
  }
  snapshot(){return {tick:this.tick,status:this.status,mode:this.mode,difficulty:this.difficulty,seed:this.seed,wave:this.wave,wait:this.wait,weapon:this.weapon,scope:this.scope,player:structuredClone(this.player),bots:structuredClone(this.bots),pickups:structuredClone(this.pickups),combat:this.combat.snapshot(),work:{...this.work}};}
  step(value){
    const input=validateFPSInput(value);if(this.status!=='playing')return {accepted:false,events:[]};
    const [mx,mz,yaw,pitch,bits,weapon]=input;this.events=[];this.weapon=weapon;this.scope=!!(bits&FPS_INPUT.scope)&&this.pack.arsenal.weapons[weapon].archetype==='precision';
    if(bits&FPS_INPUT.cancel)this.combat.cancelTriggers();
    const playerAlive=this.combat.actor('player').health>0;
    if(playerAlive){lookCharacter(this.player,{yaw:yaw/1e6,pitch:pitch/1e6});stepCharacter(this.player,{move:[mx/1000,mz/1000],jump:!!(bits&4),crouch:!!(bits&8),sprint:!!(bits&16)&&!this.scope},1/60,this.config,this.boxes);}
    const controls=[];
    for(let i=0;i<this.bots.length;i++){const b=this.bots[i];if(this.combat.actor(b.id).health<=0){b.state='dead';continue;}
      const c=botCommand(this,b,i);stepCharacter(b.character,{move:c.move},1/60,characterConfig({walkSpeed:b.profile.speed}),this.boxes);controls.push([b,c]);}
    this.combat.setPoses([{id:'player',position:this.player.position,height:this.player.halfExtents[1]*2},...this.bots.map(b=>({id:b.id,position:b.character.position,height:1.8}))]);
    const command=(id,c,w,fire,reload,error=0)=>{
      const view=characterView(c),direction=rotate(view.orientation,[0,0,-1]);
      // The same seeded dispersion affects the actual shot ray, including bots.
      if(fire)for(let i=0;i<3;i++)direction[i]+=(this.random()*2-1)*(w.spread+error);
      const length=Math.hypot(...direction);return {actor:id,weapon:w.id,origin:view.position,direction:direction.map(v=>v/length),fire,reload};
    };
    const w=this.pack.arsenal.weapons[weapon],commands=[command('player',this.player,w,playerAlive&&!!(bits&1),playerAlive&&!!(bits&2))];
    const timers=this.combat.snapshot().weapons;
    for(const [b,c] of controls){const weapon=this.pack.arsenal.weapons.find(w=>w.id===c.weapon),ammo=timers.find(t=>t.actor===b.id).timers.find(t=>t.id===weapon.id);
      commands.push(command(b.id,b.character,weapon,c.fire,ammo.ammo===0,c.error));}
    this.events.push(...this.combat.step(commands));
    for(const e of this.events)if(e.type==='shot'&&e.source==='player')lookCharacter(this.player,{pitch:w.recoil});
    let player=this.combat.actor('player');
    if(player.health>0)for(const p of this.pickups)if(p.available&&Math.hypot(...p.position.map((v,i)=>v-this.player.position[i]))<1.2&&this.combat.pickup('player',p.kind,p.amount)>0){p.available=false;this.events.push({type:'pickup',actor:'player',kind:p.kind,point:p.position});}
    if(this.mode==='skirmish'){
      for(const a of this.combat.snapshot().actors)if(a.health===0&&this.tick-a.deadAt>=this.pack.settings.rules.respawnTicks){
        const bot=this.bots.find(b=>b.id===a.id),position=bot?this.pack.spawns.bots[this.bots.indexOf(bot)]:this.pack.spawns.player;
        this.events.push(this.combat.respawn(a.id,position));if(bot){bot.character=createCharacter({position,yaw:Math.PI});bot.seen=false;bot.lastSeen=null;bot.path=[];bot.nextPath=0;bot.nextFire=this.tick+60;bot.nextCover=0;bot.coverGoal=null;}else this.player=createCharacter({position});
      }
      player=this.combat.actor('player');if(player.kills>=this.pack.settings.rules.scoreLimit)this.status='victory';
      else if(this.combat.snapshot().actors.filter(a=>a.id!=='player').reduce((n,a)=>n+a.kills,0)>=this.pack.settings.rules.scoreLimit)this.status='defeat';
    }else if(player.health===0)this.status='defeat';
    else if(this.bots.every(b=>this.combat.actor(b.id).health===0)){
      if(this.wave>=this.pack.waves.rosters.length)this.status='victory';
      else if(++this.wait>=this.pack.settings.rules.waveGap){this.wait=0;this.beginWave(this.pack.waves.rosters[this.wave]);}
    }
    this.tick++;if(this.tick>=this.pack.settings.rules.durationTicks&&this.status==='playing'){
      const enemies=this.combat.snapshot().actors.filter(a=>a.id!=='player').reduce((n,a)=>n+a.kills,0);this.status=this.mode==='survival'?'defeat':player.kills>enemies?'victory':player.kills===enemies?'draw':'defeat';
    }
    return {accepted:true,events:structuredClone(this.events)};
  }
}
