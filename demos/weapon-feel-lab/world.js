// SPDX-License-Identifier: Apache-2.0
import {WeaponFeel,validateWeaponFeel} from '../../modules/weapon-feel/index.js';
import {Combat3D} from '../../modules/combat3d/index.js';
import {createCharacter,characterConfig,stepCharacter} from '../../modules/character/index.js';
import {aabb} from '../../modules/collision/index.js';
import {normalize} from '../../modules/math/index.js';
export const RANGE_SOLIDS=[
  {id:'floor',box:aabb([-9,-1,-25],[9,0,8]),material:'stone'},
  {id:'back',box:aabb([-9,0,-25],[9,6,-24.6]),material:'stone'},
  {id:'left',box:aabb([-9,0,-25],[-8.6,4,8]),material:'stone'},
  {id:'right',box:aabb([8.6,0,-25],[9,4,8]),material:'stone'},
  {id:'rear',box:aabb([-9,0,7.6],[9,4,8]),material:'stone'}
];
const targetStart=[[0,0,-10],[-3.5,0,-16],[3.5,0,-20]];
export class FeelRange{
  constructor(source){
    this.recipe=validateWeaponFeel(source);this.feel=new WeaponFeel(this.recipe);this.player=createCharacter({position:[0,0,3]});this.config=characterConfig();
    this.combat=new Combat3D({actors:[{id:'player',team:0,position:[0,0,3],health:300,armour:0},...targetStart.map((position,i)=>({id:'target-'+i,team:1,position,health:150,armour:0}))],weapons:this.recipe.profiles.map(p=>p.weapon),solids:RANGE_SOLIDS});
    this.tick=0;this.shots=0;this.hits=0;this.damage=0;this.lastShot=null;this.lastImpact=null;this.lastLook={yaw:0,pitch:0};this.effects=[];this.returnFire=false;this.targetsMoving=true;
  }
  timer(){const state=this.combat.snapshot().weapons.find(w=>w.actor==='player').timers.find(t=>t.id===this.feel.profile().id);const {id,...rest}=state;return rest;}
  origin(){return this.player.position.map((v,i)=>v+(i===1?this.player.eyeHeight:0));}
  cancel(){this.feel.cancel();this.combat.cancelTriggers();}
  step(input={}){
    const aim=this.feel.aim();this.lastLook=this.feel.consumeLook();this.player.yaw=aim.yaw;this.player.pitch=aim.pitch;
    stepCharacter(this.player,{move:input.move??[0,0],jump:input.jump??false,sprint:input.sprint??false},1/60,this.config,RANGE_SOLIDS.map(s=>s.box));
    const poses=[{id:'player',position:this.player.position,height:this.player.halfExtents[1]*2}],before=this.combat.snapshot();
    for(const [i,start]of targetStart.entries()){
      const id='target-'+i,a=before.actors.find(a=>a.id===id),position=start.map((v,k)=>v+(k===0&&this.targetsMoving?Math.sin(this.tick/60*(.5+i*.15))*(.8+i*.5):0));
      if(a.health<=0&&this.tick-a.deadAt>=45)this.combat.respawn(id,position);
      poses.push({id,position,height:1.8});
    }
    this.combat.setPoses(poses);
    const command=this.feel.step({actor:'player',origin:this.origin(),timer:this.timer(),held:input.held??false,reload:input.reload??false});
    const commands=[command];
    if(this.returnFire&&this.tick%120===90){const p=poses[2].position.map((v,i)=>v+(i===1?1.5:0));commands.push({actor:'target-1',weapon:this.recipe.profiles[0].id,origin:p,direction:normalize(this.origin().map((v,i)=>v-p[i])),fire:true,reload:false});}
    const events=this.combat.step(commands),shots=events.filter(e=>e.type==='shot'&&e.source==='player'),hits=events.filter(e=>e.type==='damage'&&e.source==='player'),damage=events.filter(e=>e.type==='damage'&&e.target==='player').reduce((n,e)=>n+e.amount,0);
    this.feel.confirm({shot:shots.length>0,hit:hits.length>0,damage,reloading:this.timer().reloadRemaining>0});
    this.shots+=shots.length;this.hits+=hits.length;this.damage+=hits.reduce((n,e)=>n+e.amount,0);
    if(shots.length)this.lastShot=shots.at(-1);const impacts=events.filter(e=>e.type==='impact'&&e.source==='player');if(impacts.length)this.lastImpact=impacts.at(-1).point;
    this.effects=this.effects.filter(e=>e.until>this.tick);for(const e of events)if(['trace','impact'].includes(e.type))this.effects.push({...e,until:this.tick+8});this.effects=this.effects.slice(-32);this.tick++;
    return events;
  }
  snapshot(){return {tick:this.tick,shots:this.shots,hits:this.hits,damage:this.damage,player:{position:[...this.player.position],yaw:this.player.yaw,pitch:this.player.pitch},aim:this.feel.aim(),lastLook:{...this.lastLook},presentation:this.feel.presentation(),timer:this.timer(),lastShot:this.lastShot,lastImpact:this.lastImpact,combat:this.combat.snapshot()};}
}
