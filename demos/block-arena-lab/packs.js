// SPDX-License-Identifier: Apache-2.0
// Original arena, palette and game data. No donor fiction or assets.
import {FPS_PACK_KIND} from '../../modules/mod-fps/index.js';
const weapon=(id,archetype,options)=>({id,archetype,damage:24,headMultiplier:2,range:70,falloff:.65,spread:.02,recoil:.01,interval:.12,reload:1.3,magazine:24,reserve:144,speed:28,radius:0,penetration:0,...options});
export function starterFPSPack(index=0){
  if(![0,1].includes(index))throw new RangeError('starter index');
  const block=(id,x,z,w,d,h,color='cover',material='stone',y=0)=>({id,x,y,z,w,h,d,color,material});
  const geometry=index===0?{blocks:[block('left',-7,-4,3,3,2),block('right',4,0,3,3,2),block('rear',-3,-12,6,2,1.25,'accent','wood'),block('deck',8,-10,4,5,2,'accent')],ramps:[{id:'rise',x:8,y:0,z:-5,w:4,h:2,d:6,direction:-1,color:'accent'}]}:
    {blocks:[block('a',-8,-7,3,8,2.5),block('b',5,-1,3,8,2.5),block('c',-2,-2,4,2,1,'accent','wood'),block('deck',-12,6,4,4,2,'accent')],ramps:[{id:'rise',x:-12,y:0,z:0,w:4,h:2,d:6,direction:1,color:'accent'}]};
  const data={settings:{kind:FPS_PACK_KIND,title:index?'Violet Switchyard':'Cobalt Courtyard',size:32,
    palette:{floor:index?[.16,.12,.24]:[.1,.19,.27],wall:[.24,.32,.42],accent:index?[.8,.3,.72]:[.1,.8,.8],cover:[.82,.55,.22],enemy:[.98,.33,.35]},
    rules:{durationTicks:7200,scoreLimit:12,respawnTicks:120,waveGap:150,friendlyFire:false,selfDamage:true,playerHealth:150,playerArmour:40},
    difficulty:{easy:{reaction:50,error:.13},normal:{reaction:30,error:.065},hard:{reaction:14,error:.025}}},geometry,
    spawns:{player:[0,0,12],bots:[[0,0,-8],[-11,0,-11],[11,0,9],[-10,0,3],[2,0,-14],[11,0,-13]],pickups:[{id:'med-left',position:[-12,0,11],kind:'health',amount:60},{id:'ammo-right',position:[12,0,4],kind:'ammo',amount:36},{id:'med-north',position:[0,0,-5],kind:'health',amount:40},{id:'ammo-west',position:[-12,0,-4],kind:'ammo',amount:24}]},
    arsenal:{weapons:[weapon('needle','precision',{damage:65,headMultiplier:2.5,interval:.65,reload:1.5,magazine:6,reserve:42,spread:0,recoil:.025,falloff:1,penetration:1}),weapon('pulse','automatic',{}),weapon('orb','projectile',{damage:105,interval:.8,reload:1.8,magazine:4,reserve:20,speed:24,radius:4,spread:0,recoil:.04})]},
    bots:{types:[{id:'scout',health:90,armour:0,speed:3.5,range:18,cadence:30,weapon:'pulse',color:[.95,.3,.35]},
      {id:'sentry',health:100,armour:15,speed:2,range:30,cadence:80,weapon:'needle',color:[.9,.6,.15]},
      {id:'heavy',health:170,armour:30,speed:1.8,range:17,cadence:90,weapon:'orb',color:[.65,.35,.95]}]},
    waves:{rosters:[['scout','scout'],['scout','sentry','scout'],['heavy','sentry','scout','scout']]}};
  if(index)data.spawns.bots[3]=[-4,0,8];
  return {kind:'qsol.vanillajs.mod-pack.v1',id:index?'violet-switchyard':'cobalt-courtyard',version:'1.0.0',requires:[],entries:Object.entries(data).map(([id,data])=>({id,kind:'data',data}))};
}
