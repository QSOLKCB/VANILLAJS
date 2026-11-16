// SPDX-License-Identifier: Apache-2.0
import {WEAPON_FEEL_FORMAT,validateWeaponFeel} from '../../modules/weapon-feel/index.js';
export function starterFeel(){
  const profile=(id,label,archetype,interval,damage,spread,recoil,adsSeconds,adsFov,magazine)=>({id,label,
    weapon:{id,archetype,damage,headMultiplier:1.5,range:60,falloff:.8,spread,recoil,interval,reload:archetype==='projectile'?1.6:1.1,magazine,reserve:300,speed:30,radius:0,penetration:0},
    view:{hipFov:1.15,adsFov,adsSeconds,sensitivity:1,adsSensitivity:1,recoilReturn:archetype==='automatic'?.08:.2,flashSeconds:.065,effects:true},
    handling:{triggerBuffer:.12,switchSeconds:.18,spreadKick:archetype==='automatic'?.008:.002,spreadRecovery:.06}});
  return validateWeaponFeel({format:WEAPON_FEEL_FORMAT,version:1,seed:260001,profiles:[
    profile('lumen','Lumen / precision', 'precision',.36,35,.002,.085,.14,.65,8),
    profile('thread','Thread / automatic','automatic',.10,11,.025,.035,.24,.8,24),
    profile('anchor','Anchor / travelling bolt','projectile',.65,65,.006,.14,.32,.7,5)
  ]});
}
