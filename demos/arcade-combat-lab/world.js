// SPDX-License-Identifier: Apache-2.0
// Game-owned stages, AI, pickups and progression. All damage lives in combat2d.
import {createCombatWorld,addCombatActors,stepCombat2D,healCombatActor,combatSnapshot,combatInteger as int} from '../../modules/combat2d/index.js';
import {validateArcadePack} from '../../modules/mod-arcade/index.js';
import {createBody2D,stepBody2D} from '../../modules/motion2d/index.js';
import {nextRandom} from '../../modules/integer-math/index.js';
export const ARCADE_ENGINE='arcade-foundation-001/1',ARCADE_TICKS=36000;
export const INPUT=Object.freeze({left:1,right:2,up:4,down:8,jump:16,primary:32,secondary:64});
const games=new WeakSet();
function own(s) { s.agents.forEach(Object.freeze);Object.freeze(s.agents);Object.freeze(s.picked);Object.freeze(s);games.add(s);return s; }
const sign=Math.sign,clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function decodeInput(word) {
  int(word,'input word',0,127);
  return {x:Number(!!(word&2))-Number(!!(word&1)),y:Number(!!(word&4))-Number(!!(word&8)),
    jump:!!(word&16),primary:!!(word&32),secondary:!!(word&64)};
}
function definition(s,a){return s.pack.combat.actors.find(d=>d.id===a.definition);}
function spawn(s,index) {
  const stage=s.pack[s.mode],wave=stage.encounters[index],actors=[];
  let rng=s.rng;
  for(const [i,p] of wave.spawns.entries()) {
    const d=s.pack.combat.actors.find(d=>d.id===p.actor),id=s.combat.lastActor+i+1;
    const health=Math.max(1,Math.trunc(d.health*s.pack.settings.rules[s.difficulty].healthPercent/100));
    actors.push({id,team:1,x:p.x,y:p.y,faceX:-1,faceY:0,health,hurtbox:d.hurtbox});
    rng=nextRandom(rng);
    s.agents.push({id,definition:d.id,body:createBody2D({x:p.x,y:p.y,grounded:s.mode==='run'}),cooldown:30+rng%30,tell:0,aimX:-1,aimY:0});
  }
  s.combat=addCombatActors(s.combat,actors);s.rng=rng;s.wait=0;s.waveActive=true;s.encounter=index;
}
export function createArcadeGame(pack,mode='run',difficulty='normal',seed=2026) {
  pack=validateArcadePack(pack);if(!['run','arena'].includes(mode)||!['easy','normal','hard'].includes(difficulty))throw new TypeError('mode/difficulty');
  int(seed,'seed',0,0xffffffff);
  const stage=pack[mode],d=pack.combat.actors.find(d=>d.id==='player');
  const combat=createCombatWorld({actors:[{id:1,team:0,...stage.spawn,faceX:1,faceY:0,health:d.health,hurtbox:d.hurtbox}],solids:stage.solids});
  const s={pack,mode,difficulty,seed,rng:seed,tick:0,combat,agents:[{id:1,definition:'player',
    body:createBody2D({...stage.spawn,grounded:mode==='run'}),cooldown:0,tell:0,aimX:1,aimY:0}],
    encounter:0,cleared:0,wait:0,waveActive:false,status:'playing',score:0,picked:[],previousWord:0};
  if(stage.encounters[0].trigger<=stage.spawn.x || mode==='arena')spawn(s,0);
  return own(s);
}
export function stepArcadeGame(current,word,{reference=false}={}) {
  if(!games.has(current))throw new TypeError('owned game required');
  const input=decodeInput(word);
  if(current.status!=='playing')return {state:current,events:[],work:{full:0,candidates:0,narrow:0}};
  const s={...current,agents:current.agents.map(a=>({...a})),picked:[...current.picked]},stage=s.pack[s.mode];
  const poses=[],attacks=[],shots=[],events=[];
  const player=s.combat.actors[0],moves=new Map(s.pack.combat.moves.map(m=>[m.id,m.attack]));
  for(const a of s.agents) {
    const body=s.combat.actors.find(b=>b.id===a.id);if(!body.health)continue;
    const d=definition(s,a),isPlayer=a.id===1;
    let x=0,y=0,jump=false,request=null,shoot=false,faceX=body.faceX,faceY=body.faceY;
    a.cooldown=Math.max(0,a.cooldown-1);
    if(isPlayer) {
      x=input.x;y=s.mode==='arena'?input.y:0;jump=input.jump&&!(s.previousWord&16);
      if(input.secondary)request=d.heavy;
      else if(input.primary){if(s.mode==='run')shoot=true;else request=d.light;}
      // Run mode: secondary is a quick melee; arena has a slower heavy strike.
      if(s.mode==='run'&&input.secondary)request=d.light;
      a.aimX=input.x||body.faceX;a.aimY=input.y;
      if(!input.x&&input.y){a.aimX=0;}
    } else {
      const dx=player.x-body.x,dy=player.y-body.y,range=Math.abs(dx)+Math.abs(dy);
      if(d.behaviour==='sentry') {
        if(a.tell>0) {a.tell--;if(a.tell===0){shoot=true;a.cooldown=d.projectile.cooldown;}}
        else if(!a.cooldown&&range<6500&&!body.stun) {a.tell=32;a.aimX=sign(dx);a.aimY=Math.abs(dy)>280?sign(dy):0;}
        if(s.mode==='arena'&&range<1200){x=-sign(dx);y=-sign(dy);}
      } else if(range<=(d.behaviour==='brute'?700:500)) {
        if(!a.cooldown) {request=d.light;a.cooldown=30;}
      } else {
        x=sign(dx);y=s.mode==='arena'?sign(dy):0;
        jump=s.mode==='run'&&a.body.grounded&&(Math.abs(dy)>300 || stage.solids.some(o=>Math.abs(o.box.minX-body.x)<700));
      }
      if(s.mode==='arena'&&Math.abs(dy)>Math.abs(dx)) {faceX=0;faceY=sign(dy)||1;}
      else {faceX=sign(dx)||body.faceX||1;faceY=0;}
    }
    if(isPlayer&&(x||y)) {if(s.mode==='arena'&&y){faceX=0;faceY=y;}else {faceX=x||faceX;faceY=0;}}
    if(body.stun||body.attack||a.tell){x=0;y=0;jump=false;faceX=body.faceX;faceY=body.faceY;}
    const old=a.body;
    const blockedAt=(px,py)=>stage.solids.some(o=>px>o.box.minX&&px<o.box.maxX&&py>=o.box.minY&&py<o.box.maxY);
    // A supported one-way ledge is a ground line for motion2d. Landing checks
    // cross the top in Y at the endpoint X; actor/obstacle movement stays point-like.
    const support=stage.platforms.find(p=>old.x>=p.x1&&old.x<=p.x2&&old.y===p.y&&old.vy<=0);
    const groundY=s.mode==='run'&&support&&old.x+x*d.speed>=support.x1&&old.x+x*d.speed<=support.x2?support.y:stage.ground;
    a.body=stepBody2D(old,{x,y,jump,impulseX:body.knockX,impulseY:body.knockY},
      {profile:s.mode==='run'?'platform':'shmup',bounds:{minX:180,maxX:stage.width-180,minY:stage.ground,maxY:stage.height-600},
        groundY,blockedAt,motor:{speed:d.speed,acceleration:12,drag:12,jumpSpeed:148,gravity:6,fallSpeed:180}});
    if(s.mode==='run'&&a.body.vy<=0) {
      const landed=stage.platforms.filter(p=>a.body.x>=p.x1&&a.body.x<=p.x2&&old.y>=p.y&&a.body.y<=p.y).sort((p,q)=>q.y-p.y)[0];
      if(landed)a.body=createBody2D({...a.body,y:landed.y,vy:0,grounded:true});
      // A changed ground line cannot retain the old ledge's grounded flag.
      else if(a.body.y>groundY)a.body=createBody2D({...a.body,grounded:false});
    }
    poses.push({id:a.id,x:a.body.x,y:a.body.y,faceX,faceY});
    if(request&&!body.attack&&!body.stun) {
      const move=moves.get(request),damage=isPlayer?move.damage:Math.max(1,Math.trunc(move.damage*s.pack.settings.rules[s.difficulty].damagePercent/100));
      attacks.push({id:a.id,move:{...move,damage}});
    }
    if(shoot&&!body.attack&&!body.stun&&(isPlayer?a.cooldown===0:true)) {
      const p=d.projectile,ax=a.aimX||a.aimY?a.aimX:faceX,ay=a.aimX||a.aimY?a.aimY:faceY;
      const speed=ax&&ay?Math.trunc(p.speed*181/256):p.speed;
      const {cooldown,speed:ignored,...shot}=p;
      shots.push({id:a.id,...shot,vx:(ax||(!ay?faceX:0))*speed,vy:ay*speed,
        damage:isPlayer?p.damage:Math.max(1,Math.trunc(p.damage*s.pack.settings.rules[s.difficulty].damagePercent/100))});
      a.cooldown=cooldown;
    }
  }
  const result=stepCombat2D(s.combat,{poses,attacks,shots},{reference});s.combat=result.world;events.push(...result.events);s.tick++;s.previousWord=word;
  for(const e of events)if(e.type==='knockout'&&e.actor!==1&&e.source===1)s.score+=s.pack.settings.rules.killScore;
  const p=s.combat.actors[0];
  for(const [i,pickup] of stage.pickups.entries())if(p.health>0&&!s.picked.includes(i)&&Math.abs(p.x-pickup.x)<420&&Math.abs(p.y-pickup.y)<450) {
    s.picked.push(i);s.score+=s.pack.settings.rules.pickupScore;s.combat=healCombatActor(s.combat,1,s.pack.settings.rules.heal);events.push({type:'pickup',tick:s.tick,x:pickup.x,y:pickup.y});
  }
  if(!p.health){s.status='game-over';events.push({type:'game-over',tick:s.tick});}
  else {
    const living=s.combat.actors.some(a=>a.team===1&&a.health>0);
    if(!living) {
      if(s.waveActive) {s.waveActive=false;s.cleared++;s.wait=75;events.push({type:'encounter-complete',tick:s.tick,encounter:s.encounter});}
      if(s.wait>0)s.wait--;
      if(s.cleared<stage.encounters.length&&s.wait===0&&(s.mode==='arena'||p.x>=stage.encounters[s.cleared].trigger)) {
        spawn(s,s.cleared);events.push({type:'encounter-start',tick:s.tick,encounter:s.encounter});
      }
      if(s.cleared===stage.encounters.length&&(s.mode==='arena'||p.x>=stage.exit.x&&Math.abs(p.y-stage.exit.y)<=600)) {s.status='complete';events.push({type:'complete',tick:s.tick});}
    }
  }
  if(s.tick===ARCADE_TICKS&&s.status==='playing')s.status='limit';
  return {state:own(s),events:Object.freeze(events),work:result.work};
}
export function arcadeSnapshot(s) {
  if(!games.has(s))throw new TypeError('owned game required');
  const {pack,combat,...rest}=s;
  return {engine:ARCADE_ENGINE,...JSON.parse(JSON.stringify(rest)),combat:combatSnapshot(combat)};
}
