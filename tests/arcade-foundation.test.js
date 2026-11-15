// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatWorld,addCombatActors,stepCombat2D,combatSnapshot,overlaps2D,sweepContact2D,defineAttack2D} from '../modules/combat2d/index.js';
import {validateArcadePack,ArcadePackSlot,canonicalArcadeJSON} from '../modules/mod-arcade/index.js';
import {createBody2D,stepBody2D} from '../modules/motion2d/index.js';
import {castSegment} from '../modules/collision/index.js';
import {FixedClock} from '../modules/time/index.js';
import {starterPack} from '../demos/arcade-combat-lab/packs.js';
import {createArcadeGame,stepArcadeGame,arcadeSnapshot,ARCADE_TICKS} from '../demos/arcade-combat-lab/world.js';
import {ArcadeSession,readArcadeReplay,readArcadeSnapshot,MAX_REPLAY_BYTES} from '../demos/arcade-combat-lab/replay.js';
import {buildScenery,SceneryCache} from '../demos/arcade-combat-lab/scenery.js';
import {foundryScore} from '../demos/arcade-combat-lab/audio.js';
const actor=(id,x=0,team=id===1?0:1)=>({id,team,x,y:0,faceX:1,faceY:0,health:100,hurtbox:{minX:-10,minY:-10,maxX:10,maxY:10}});
const move=(overrides={})=>({windup:0,active:3,recovery:3,reach:100,halfWidth:10,offset:0,damage:20,knockback:32,stun:3,invulnerability:0,interruptible:true,...overrides});
const shot=(id=1,overrides={})=>({id,vx:1000,vy:0,lifetime:20,radius:0,damage:15,knockback:16,stun:2,invulnerability:0,...overrides});
const clone=x=>JSON.parse(JSON.stringify(x));
function combatData(pack){return pack.entries.find(e=>e.id==='combat').data;}
export function encounterFixture() {
  const p=starterPack(),c=combatData(p);c.actors[0].health=3000;c.actors[1].health=1;
  for(const mode of ['run','arena']) {
    const s=p.entries.find(e=>e.id===mode).data;s.solids=[];s.platforms=[];s.pickups=[];
    s.spawn={x:1000,y:400};s.exit={x:1000,y:400};
    s.encounters=Array.from({length:3},()=>({trigger:0,spawns:[{actor:'scout',x:1400,y:400}]}));
  }
  return p;
}
test('closed hurtbox boundary, corner and one-subunit separation',()=>{
  const b={minX:0,minY:0,maxX:10,maxY:10};
  assert.ok(overlaps2D(b,{minX:10,minY:10,maxX:20,maxY:20}));
  assert.ok(!overlaps2D(b,{minX:11,minY:10,maxX:20,maxY:20}));
  for(const [x,expected]of [[110,80],[111,100],[-10,80],[-21,100]]) {
    const r=stepCombat2D(createCombatWorld({actors:[actor(1),actor(2,x)]}),{attacks:[{id:1,move:move()}]});assert.equal(r.world.actors[1].health,expected);
  }
});
test('facing rotates reach and attack facing is latched through windup',()=>{
  let w=createCombatWorld({actors:[{...actor(1),faceX:-1},actor(2,-80),actor(3,80)]});
  w=stepCombat2D(w,{attacks:[{id:1,move:move({windup:1})}]}).world;
  w=stepCombat2D(w,{poses:[{id:1,x:0,y:0,faceX:1,faceY:0}]}).world;
  assert.deepEqual(w.actors.map(a=>a.health),[100,80,100]);
  w=createCombatWorld({actors:[{...actor(1),faceX:0,faceY:1},{...actor(2),y:90},actor(3,90)]});
  assert.deepEqual(stepCombat2D(w,{attacks:[{id:1,move:move()}]}).world.actors.map(a=>a.health),[100,80,100]);
});
test('swept thin targets, grazing edges, start-inside and finite segment bounds',()=>{
  const b={minX:99,minY:-1,maxX:100,maxY:1};
  assert.deepEqual(sweepContact2D({x:0,y:0,dx:1000,dy:0},b),{n:99,d:1000});
  assert.equal(sweepContact2D({x:0,y:2,dx:1000,dy:0},b),null);
  assert.ok(sweepContact2D({x:0,y:2,dx:1000,dy:0,radius:1},b));
  assert.deepEqual(sweepContact2D({x:99,y:0,dx:0,dy:0},b),{n:0,d:1});
  assert.equal(sweepContact2D({x:101,y:0,dx:1000,dy:0},b),null);
  assert.throws(()=>sweepContact2D({x:0,y:0,dx:4097,dy:0},b));
});
test('integer slab sweep agrees with existing independent 3D segment oracle on 2000 bounded queries',()=>{
  let seed=82;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let i=0;i<2000;i++) {
    const b={minX:rand(500)-250,minY:rand(500)-250};b.maxX=b.minX+1+rand(120);b.maxY=b.minY+1+rand(120);
    const q={x:rand(600)-300,y:rand(600)-300,dx:rand(2001)-1000,dy:rand(2001)-1000,radius:rand(20)};
    const hit=sweepContact2D(q,b),oracle=castSegment([q.x,q.y,0],[q.dx,q.dy,0],[{id:'target',box:{min:[b.minX,b.minY,-1],max:[b.maxX,b.maxY,1]}}],{halfSize:q.radius});
    assert.equal(!!hit,!!oracle);if(hit)assert.ok(Math.abs(hit.n/hit.d-oracle.time)<1e-14);
  }
});
test('projectiles choose earliest contact, ID ties and solid ties regardless of source order',()=>{
  const a=[actor(3,500),actor(1),actor(2,500)];
  const r=stepCombat2D(createCombatWorld({actors:a}),{shots:[shot()]});assert.equal(r.events.find(e=>e.type==='hit').target,2);
  const reverse=stepCombat2D(createCombatWorld({actors:[...a].reverse()}),{shots:[shot()]});assert.deepEqual(r,reverse);
  const blocked=stepCombat2D(createCombatWorld({actors:a,solids:[{id:1,box:{minX:490,minY:-10,maxX:491,maxY:10}}]}),{shots:[shot()]});
  assert.ok(!blocked.events.some(e=>e.type==='hit'));assert.ok(blocked.events.some(e=>e.reason==='wall'));
});
test('multiple attackers, simultaneous trades and invulnerability have stable event order',()=>{
  const initial=createCombatWorld({actors:[actor(1),actor(2,50),actor(3,60,0)]});
  const commands={attacks:[{id:3,move:move({invulnerability:4})},{id:1,move:move({invulnerability:4})}]};
  const r=stepCombat2D(initial,commands);assert.deepEqual(r.events.filter(e=>e.type==='hit').map(e=>[e.source,e.damage]),[[1,20],[3,0]]);
  let w=createCombatWorld({actors:[actor(1),{...actor(2,40),faceX:-1}]});
  const trade=stepCombat2D(w,{attacks:[{id:1,move:move()},{id:2,move:move()}]});
  assert.deepEqual(trade.world.actors.map(a=>a.health),[80,80]);assert.equal(trade.events.filter(e=>e.reason==='interrupted').length,2);
});
test('per-attack victims deduplicate across ticks; later attacks hit again',()=>{
  let w=createCombatWorld({actors:[actor(1),actor(2,50)]});
  for(let i=0;i<6;i++)w=stepCombat2D(w,{attacks:[{id:1,move:move()}]}).world;
  assert.equal(w.actors[1].health,80);assert.equal(w.actors[0].attack,null);
  w=stepCombat2D(w,{attacks:[{id:1,move:move()}]}).world;assert.equal(w.actors[1].health,60);
});
test('stun, knockback decay, recovery and armour timings are reproducible',()=>{
  let r=stepCombat2D(createCombatWorld({actors:[actor(1),actor(2,50)]}),{attacks:[{id:1,move:move({invulnerability:3})}]});
  assert.equal(r.world.actors[1].stun,3);assert.equal(r.world.actors[1].knockX,32);
  r=stepCombat2D(r.world,{attacks:[{id:2,move:move()}]});assert.equal(r.world.actors[1].attack,null);assert.equal(r.world.actors[1].knockX,24);
  r=stepCombat2D(r.world);assert.ok(r.events.some(e=>e.type==='recovery-start'));
  r=stepCombat2D(r.world,{attacks:[{id:2,move:move()}]});assert.ok(r.events.some(e=>e.type==='recovered'));assert.ok(r.world.actors[1].attack);
  const armour=stepCombat2D(createCombatWorld({actors:[actor(1),actor(2,50)]}),{attacks:[{id:1,move:move()},{id:2,move:move({windup:20,interruptible:false})}]});
  assert.ok(armour.world.actors[1].attack);
});
test('knockout and projectile completion are singular; allies never take damage',()=>{
  const r=stepCombat2D(createCombatWorld({actors:[actor(1),{...actor(2,100),health:10},actor(3,80,0)]}),{shots:[shot()]});
  assert.equal(r.world.actors[1].health,0);assert.equal(r.world.actors[2].health,100);
  assert.equal(r.events.filter(e=>e.type==='knockout').length,1);assert.equal(r.world.projectiles.length,0);
});
test('actor, projectile, event and invalid-command failures are atomic',()=>{
  const w=createCombatWorld({actors:[actor(1),actor(2,50)],limits:{actors:2,projectiles:1,events:1}}),before=combatSnapshot(w);
  assert.throws(()=>stepCombat2D(w,{attacks:[{id:1,move:move()}]}),/capacity/);
  assert.throws(()=>stepCombat2D(w,{poses:[{id:1,x:3,y:0,faceX:1,faceY:0}],shots:[shot(2,{vx:Infinity})]}));
  let accessed=false;assert.throws(()=>stepCombat2D(w,{get attacks(){accessed=true;return [];}}));assert.equal(accessed,false);
  assert.throws(()=>addCombatActors(w,[actor(3)]),/capacity/);assert.deepEqual(combatSnapshot(w),before);
  let p=createCombatWorld({actors:[actor(1)],limits:{projectiles:1}});p=stepCombat2D(p,{shots:[shot()]}).world;
  const snap=combatSnapshot(p);assert.throws(()=>stepCombat2D(p,{shots:[shot()]}),/capacity/);assert.deepEqual(combatSnapshot(p),snap);
  assert.throws(()=>stepCombat2D({...p}));assert.throws(()=>createCombatWorld({actors:[actor(1),actor(1)]}));
});
test('bounded broad phase equals full reference for 1200 evolving combat ticks',()=>{
  let a=createCombatWorld({actors:Array.from({length:24},(_,i)=>({...actor(i+1,i*310,i%2),health:10000}))}),b=a;
  let full=0,candidates=0;
  for(let i=0;i<1200;i++) {
    const commands={attacks:i%17===0?a.actors.filter(x=>x.health).slice(0,12).map(x=>({id:x.id,move:move({reach:900,damage:1})})):[],
      shots:i%13===0?[shot(1,{damage:1,lifetime:8})]:[]};
    const ra=stepCombat2D(a,commands),rb=stepCombat2D(b,commands,{reference:true});a=ra.world;b=rb.world;
    assert.deepEqual(combatSnapshot(a),combatSnapshot(b));assert.deepEqual(ra.events,rb.events);full+=ra.work.full;candidates+=ra.work.candidates;
  }
  assert.ok(candidates<full/2);console.log('Arcade broad phase work:',{full,candidates});
});
test('motion motor tuning and impulses reuse point collision; legacy defaults remain exact',()=>{
  const b=createBody2D({grounded:true});assert.equal(stepBody2D(b,{jump:true},{profile:'platform'}).vy,52);
  const tuned=stepBody2D(b,{jump:true,impulseX:70},{profile:'platform',motor:{jumpSpeed:148,gravity:6,fallSpeed:180}});
  assert.equal(tuned.vy,142);assert.equal(tuned.x,70);
  assert.equal(stepBody2D(b,{impulseX:70},{profile:'platform',blockedAt:x=>x>0}).x,0);
  assert.throws(()=>stepBody2D(b,{}, {motor:{speed:NaN}}));
});
test('starter packs round-trip exact accepted version and bytes through existing registry',()=>{
  for(const name of ['iron','neon']){const p=validateArcadePack(starterPack(name)),slot=new ArcadePackSlot(p);
    assert.equal(validateArcadePack(p.bytes).bytes,p.bytes);assert.equal(slot.list()[0].active,true);assert.equal(p.manifest.version,'1.0.0');assert.ok(Object.isFrozen(p.run.encounters[0].spawns));}
});
test('packs reject malformed, unknown, unsafe, oversized and incompatible content atomically',()=>{
  const slot=new ArcadePackSlot(starterPack()),before=slot.pack;
  const invalid=[()=>{const p=starterPack();p.entries[0].data.kind='v2';return p;},()=>{const p=starterPack();p.extra=1;return p;},
    ()=>{const p=starterPack();combatData(p).actors[0].speed=Infinity;return p;},
    ()=>{const p=starterPack();p.entries[2].data.encounters[0].spawns[0].actor='missing';return p;},
    ()=>{const p=starterPack();p.entries[2].data.spawn.x=0;return p;},
    ()=>{const p=starterPack();p.entries[2].data.exit.x=p.entries[2].data.width;return p;},
    ()=>{const p=starterPack();p.entries[2].data.spawn={x:6600,y:400};return p;},
    ()=>{const p=starterPack();p.entries[2].data.solids=Array(33).fill(p.entries[2].data.solids[0]);return p;},
    ()=>{const p=starterPack();Object.defineProperty(p.entries[0].data,'title',{get(){throw new Error('getter must not execute');}});return p;},
    ()=>'{"__proto__":{}}',()=> ' '.repeat(32769),()=>'{"kind":',()=>{const p=starterPack();p.entries[0].data.rules.hard.damagePercent=301;return p;}];
  for(const make of invalid){assert.throws(()=>slot.replace(make()));assert.strictEqual(slot.pack,before);}
});
test('both archetypes complete staged encounters using shared damage; defeat is reachable',()=>{
  for(const mode of ['run','arena']) {
    let s=createArcadeGame(encounterFixture(),mode),events=[];
    for(let i=0;i<500&&s.status==='playing';i++){const r=stepArcadeGame(s,mode==='run'?32:64);s=r.state;events.push(...r.events);}
    assert.equal(s.status,'complete');assert.equal(s.cleared,3);assert.equal(events.filter(e=>e.type==='knockout').length,3);assert.equal(s.score,450);
    const pack=encounterFixture();combatData(pack).actors[0].health=1;combatData(pack).actors[1].health=100;
    s=createArcadeGame(pack,mode);for(let i=0;i<300&&s.status==='playing';i++)s=stepArcadeGame(s,0).state;
    assert.equal(s.status,'game-over');
  }
});
test('run encounter waits for its trigger without falsely clearing absent enemies',()=>{
  const p=encounterFixture();p.entries[2].data.encounters[1].trigger=8000;p.entries[2].data.encounters[2].trigger=9000;
  let s=createArcadeGame(p);for(let i=0;i<500;i++)s=stepArcadeGame(s,32).state;
  assert.equal(s.cleared,1);assert.equal(s.waveActive,false);assert.equal(s.combat.actors.length,2);
});
test('unmodified original starter stages are completable through accepted commands',()=>{
  for(const name of ['iron','neon'])for(const mode of ['run','arena']) {
    let s=createArcadeGame(starterPack(name),mode);
    for(let i=0;i<4000&&s.status==='playing';i++) {
      const p=s.combat.actors[0],enemy=s.combat.actors.filter(a=>a.team&&a.health).sort((a,b)=>
        Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y)||a.id-b.id)[0];
      let word=0;
      if(mode==='arena'&&enemy) {
        const dx=enemy.x-p.x,dy=enemy.y-p.y;
        word=Math.abs(dx)>350?(dx>0?2:1):0;word|=Math.abs(dy)>150?(dy>0?4:8):0;
        if(Math.abs(dx)+Math.abs(dy)<1100){word|=64;if(!p.attack)word|=Math.abs(dy)>Math.abs(dx)?(dy>0?4:8):(dx>0?2:1);}
      }else if(mode==='run') {
        const dx=enemy?enemy.x-p.x:5000,dy=enemy?enemy.y-p.y:0;
        word=32|(Math.abs(dx)>500||!enemy?(dx>0?2:1):0);
        if(dy>400&&Math.abs(dx)<700)word=36;
        if((dy>400||!enemy||s.pack.run.solids.some(o=>Math.abs(o.box.minX-p.x)<900))&&i%50===0)word|=16;
        if(enemy&&Math.abs(dx)<500&&Math.abs(dy)<400)word|=64;
      }
      s=stepArcadeGame(s,word).state;
    }
    assert.equal(s.status,'complete',name+' / '+mode);assert.equal(s.cleared,3);assert.ok(s.combat.actors[0].health>0);
  }
});
test('jump reaches actual ledges, pickups heal, and physical obstacles block endpoints',()=>{
  const p=encounterFixture(),stage=p.entries[2].data;stage.platforms=[{x1:500,x2:2000,y:1200}];stage.pickups=[{x:1000,y:400}];
  let s=createArcadeGame(p),landed=false,peak=0;
  for(let i=0;i<80;i++){s=stepArcadeGame(s,i===0?16:0).state;peak=Math.max(peak,s.combat.actors[0].y);if(s.agents[0].body.y===1200&&s.agents[0].body.grounded)landed=true;}
  assert.ok(peak>1200);assert.ok(landed);assert.equal(s.picked.length,1);
  stage.spawn.y=1200;stage.platforms=[{x1:500,x2:1100,y:1200}];s=createArcadeGame(p);
  for(let i=0;i<5;i++)s=stepArcadeGame(s,2).state;
  assert.ok(s.agents[0].body.x>1100);assert.equal(s.agents[0].body.grounded,false);
  s=stepArcadeGame(s,16).state;assert.ok(s.agents[0].body.vy<0,'walking off a ledge must not permit an airborne jump');
});
test('run completion respects an authored elevated extraction gate',()=>{
  const p=encounterFixture();p.entries[2].data.exit.y=4700;
  let s=createArcadeGame(p);for(let i=0;i<500;i++)s=stepArcadeGame(s,32).state;
  assert.equal(s.cleared,3);assert.equal(s.status,'playing');
});
test('replay and snapshot reproduce exact state and preserve accepted pack versions',()=>{
  for(const mode of ['run','arena']){
    const source=starterPack();source.version='2.3.4';const session=new ArcadeSession(source,mode,'hard',0xffffffff);
    for(let i=0;i<400;i++)session.advance(i%128);
    const text=session.exportReplay(),copy=readArcadeReplay(text),snapshot=readArcadeSnapshot(session.exportSnapshot());
    assert.equal(copy.pack.manifest.version,'2.3.4');assert.equal(copy.exportSnapshot(),session.exportSnapshot());assert.equal(snapshot.exportSnapshot(),session.exportSnapshot());
    const old=session.exportSnapshot();assert.throws(()=>session.replacePack('{}'));assert.equal(session.exportSnapshot(),old);
    const tampered=JSON.parse(session.exportSnapshot());tampered.state.score++;assert.throws(()=>readArcadeSnapshot(JSON.stringify(tampered)),/does not match/);
    for(const change of [r=>r.inputs.push(128),r=>r.inputs.push(-1),r=>r.engine='v2',r=>r.extra=true,r=>r.pack='{}',r=>r.inputs=Array(ARCADE_TICKS+1).fill(0)]){
      const invalid=JSON.parse(text);change(invalid);assert.throws(()=>readArcadeReplay(JSON.stringify(invalid)));assert.equal(session.exportSnapshot(),old);
    }
  }
});
test('every accepted command word fits the worst-case bounded 36000-tick journal',()=>{
  const p=starterPack();for(const mode of ['run','arena']){const s=p.entries.find(e=>e.id===mode).data;s.encounters=[{trigger:6000,spawns:[{actor:'sentry',x:9000,y:4700}]}];s.solids=[];s.platforms=[];}
  const session=new ArcadeSession(p,'run');
  for(let i=0;i<ARCADE_TICKS;i++)session.advance(i%2?127:0);
  assert.equal(session.state.tick,ARCADE_TICKS);assert.equal(session.state.status,'limit');
  const text=session.exportReplay();assert.ok(Buffer.byteLength(text)<MAX_REPLAY_BYTES);assert.equal(session.advance(0).accepted,false);
  assert.equal(readArcadeReplay(text).exportSnapshot(),session.exportSnapshot());
});
test('render partitioning does not change journal-driven simulation state',()=>{
  const run=frames=>{const session=new ArcadeSession(starterPack()),clock=new FixedClock({step:1/60,maxFrame:1,maxSteps:120});let n=0;
    for(const seconds of frames)clock.advance(seconds,()=>{session.advance([0,32,34,16][n++%4]);});return session.exportSnapshot();};
  assert.equal(run(Array(600).fill(1/120)),run(Array(100).fill(.05)));
});
test('retained source-identical scenery matches forced reconstruction and invalidates every pack change',()=>{
  const p=validateArcadePack(starterPack()),cache=new SceneryCache();let scene;
  for(let i=0;i<600;i++){scene=cache.get(p,'run');assert.deepEqual(scene,buildScenery(p,'run'));}
  assert.equal(cache.builds,1);assert.equal(cache.hits,599);
  const changed=starterPack();changed.entries[0].data.palette.accent='#112233';const next=cache.get(validateArcadePack(changed),'run');assert.notStrictEqual(next,scene);
  cache.get(p,'arena');assert.equal(cache.builds,3);
});
test('original music/effects use bounded audio2d and deterministic PCM',()=>{
  for(const name of ['forge','pulse','shot','hit','knockout','pickup']){const score=foundryScore(name);assert.equal(score.sampleRate,48000);assert.ok(score.frames<=384000);assert.deepEqual(score.renderRange(17,80),score.renderAll().slice(17,97));}
});
