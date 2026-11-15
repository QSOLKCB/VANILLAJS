// SPDX-License-Identifier: Apache-2.0
// Original starter content. These functions produce detached, editable JSON.
import {ARCADE_PACK_KIND as kind} from '../../modules/mod-arcade/index.js';
const move=(windup,active,recovery,reach,damage,knockback,stun,interruptible=true)=>
  ({windup,active,recovery,reach,halfWidth:280,offset:256,damage,knockback,stun,invulnerability:10,interruptible});
export function starterPack(variant='iron') {
  if(!['iron','neon'].includes(variant))throw new RangeError('unknown starter');
  const neon=variant==='neon';
  const projectile={speed:640,damage:20,lifetime:42,radius:20,cooldown:14,knockback:64,stun:12,invulnerability:6};
  const hurtbox={minX:-110,minY:0,maxX:110,maxY:512};
  const actor=(id,health,speed,behaviour,light,heavy)=>({id,health,speed,behaviour,light,heavy,hurtbox:{...hurtbox},projectile:{...projectile,...(id!=='player'?{speed:180,damage:12,cooldown:75}: {})}});
  const settings={kind,title:neon?'Neon Shift':'Iron Meridian',palette:neon?
    {sky:'#11132b',ink:'#090b17',accent:'#75f6e2',enemy:'#ff5b9b',steel:'#494e79'}:
    {sky:'#161e27',ink:'#090f16',accent:'#f4b451',enemy:'#ed6b57',steel:'#4c6570'},
    music:neon?'pulse':'forge',rules:{killScore:150,pickupScore:50,heal:35,
      easy:{healthPercent:65,damagePercent:50},normal:{healthPercent:100,damagePercent:100},hard:{healthPercent:140,damagePercent:140}}};
  const combat={kind,moves:[{id:'jab',attack:move(3,4,10,620,24,72,14)},
    {id:'hammer',attack:move(16,6,22,900,58,160,25,false)},
    {id:'claw',attack:move(28,4,34,520,12,64,16)},
    {id:'crush',attack:move(42,8,42,760,24,140,24,false)}],
    actors:[actor('player',120,56,'player','jab','hammer'),actor('scout',44,24,'pursue','claw','claw'),
      actor('sentry',54,12,'sentry','claw','claw'),actor('brute',110,16,'brute','crush','crush')]};
  const run={kind,width:26000,height:5400,ground:400,spawn:{x:700,y:400},exit:{x:24800,y:400},
    solids:[{id:1,box:{minX:6500,minY:400,maxX:7000,maxY:1050}},{id:2,box:{minX:16800,minY:400,maxX:17300,maxY:1050}}],
    platforms:[{x1:4000,x2:5800,y:1200},{x1:11600,x2:13900,y:1400},{x1:19900,x2:21800,y:1200}],
    encounters:[{trigger:0,spawns:[{actor:'scout',x:2800,y:400},{actor:'sentry',x:4800,y:1200}]},
      {trigger:8500,spawns:[{actor:'scout',x:10800,y:400},{actor:'sentry',x:13000,y:1400},{actor:'brute',x:14500,y:400}]},
      {trigger:18500,spawns:[{actor:'sentry',x:21000,y:1200},{actor:'scout',x:22100,y:400},{actor:'brute',x:23800,y:400}]}],
    pickups:[{x:5400,y:1200},{x:15000,y:400},{x:21400,y:1200}]};
  const arena={kind,width:9600,height:5400,ground:400,spawn:{x:4800,y:2100},exit:{x:4800,y:2100},
    solids:[{id:1,box:{minX:1800,minY:3000,maxX:2400,maxY:3600}},{id:2,box:{minX:7200,minY:3000,maxX:7800,maxY:3600}}],platforms:[],
    encounters:[{trigger:0,spawns:[{actor:'scout',x:6200,y:2100},{actor:'scout',x:3000,y:1800}]},
      {trigger:0,spawns:[{actor:'brute',x:7000,y:2500},{actor:'scout',x:2500,y:1900},{actor:'scout',x:4900,y:4000}]},
      {trigger:0,spawns:[{actor:'brute',x:2600,y:2400},{actor:'brute',x:7000,y:2400},{actor:'scout',x:4800,y:3800}]}],
    pickups:[{x:900,y:1000},{x:8700,y:1000}]};
  if(neon){combat.actors[0].speed=66;settings.rules.killScore=200;run.platforms[0].y=1300;run.encounters[0].spawns[1].y=1300;run.pickups[0].y=1300;}
  return {kind:'qsol.vanillajs.mod-pack.v1',id:neon?'neon-shift':'iron-meridian',version:'1.0.0',requires:[],
    entries:Object.entries({settings,combat,run,arena}).map(([id,data])=>({id,kind:'data',data}))};
}
