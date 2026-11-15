// SPDX-License-Identifier: Apache-2.0
// Minimal consumer example: public modules only, no demo-directory dependency.
// The consuming game supplies its own bot policy, match rules and input adapter.
import {validateFPSPack} from '../../modules/mod-fps/index.js';
import {Combat3D,fpsNumber} from '../../modules/combat3d/index.js';
import {createCharacter,characterConfig,characterView,lookCharacter,stepCharacter} from '../../modules/character/index.js';
import {rotate} from '../../modules/math/index.js';
export function createFPSExample(source){
  const pack=validateFPSPack(source),character=createCharacter({position:pack.spawns.player}),config=characterConfig(),boxes=pack.solids.map(s=>s.box);
  const combat=new Combat3D({actors:[{id:'player',team:0,position:pack.spawns.player,health:pack.settings.rules.playerHealth,armour:pack.settings.rules.playerArmour},
    {id:'target',team:1,position:pack.spawns.bots[0],health:100,armour:0}],weapons:pack.arsenal.weapons,solids:pack.solids.map(({id,box,material})=>({id,box,material})),friendlyFire:pack.settings.rules.friendlyFire,selfDamage:pack.settings.rules.selfDamage});
  return {pack,character,combat,step({move=[0,0],look={yaw:0,pitch:0},jump=false,crouch=false,fire=false,reload=false,weapon=0}={}){
    fpsNumber(weapon,0,2,true);lookCharacter(character,look);stepCharacter(character,{move,jump,crouch},1/60,config,boxes);
    const view=characterView(character);combat.setPoses([{id:'player',position:character.position,height:character.halfExtents[1]*2}]);
    return combat.step([{actor:'player',weapon:pack.arsenal.weapons[weapon].id,origin:view.position,direction:rotate(view.orientation,[0,0,-1]),fire,reload}]);
  }};
}
