/* SPDX-License-Identifier: Apache-2.0 */
  const WIDTH = 1000, HEIGHT = 580, SURFACE = 128, FLOOR = 514, STEP = 1 / 60;
  const MISSIONS = [
    { name: 'Rubber duck reconnaissance', count: 3, speed: 54, interval: 3.4 },
    { name: 'Trouble in the bubble bank', count: 4, speed: 70, interval: 2.8 },
    { name: 'Operation: pull the plug', count: 5, speed: 88, interval: 2.3 }
  ];
  const DIFFICULTIES = Object.freeze({
    cadet: Object.freeze({name:'Cadet', time:120, speed:.75, interval:1.35, points:3, description:'Slower fleet · 120s sectors · ×0.75 score'}),
    standard: Object.freeze({name:'Captain', time:95, speed:1, interval:1, points:4, description:'Classic fleet · 95s sectors · ×1 score'}),
    admiral: Object.freeze({name:'Admiral', time:80, speed:1.25, interval:.75, points:6, description:'Faster attacks · 80s sectors · ×1.5 score'})
  });
  const POWERUPS = Object.freeze({
    repair: Object.freeze({label:'HULL PATCH', glyph:'+', color:'#f7d47b', ticks:0}),
    shield: Object.freeze({label:'BUBBLE SHIELD', glyph:'O', color:'#b8f4ef', ticks:720}),
    rapid: Object.freeze({label:'RAPID FIRE', glyph:'R', color:'#ffc49a', ticks:480}),
    volley: Object.freeze({label:'TRIPLE SHOT', glyph:'3', color:'#e1c6ff', ticks:480})
  });
  const MODES=Object.freeze({
    campaign:Object.freeze({name:'Fleet Hunt',description:'Sink the rival fleet across three sectors.'}),
    pond:Object.freeze({name:'Pond Panic',description:'Living bath toys! Claim 6 of 11 before the AI does.'})
  });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function random(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
  function event(s, type, x, y, text = '') { s.events.push({ type, x, y, text }); }
  function points(s, value) { return Math.floor(value * DIFFICULTIES[s.difficulty].points / 4); }
  // Supplies own their random stream: collecting or spawning one cannot alter enemy AI.
  function supplyRandom(s) { s.supplySeed = (Math.imul(s.supplySeed,1664525)+1013904223)>>>0; return s.supplySeed/4294967296; }
  function supply(s, x) {
    const kind = Object.keys(POWERUPS)[s.supplyCount++ % 4];
    const item = {id:s.nextId++, kind, x:clamp(x,100,900), y:s.role==='boat'?SURFACE:240+Math.floor(supplyRandom(s)*200), remaining:720};
    if (s.pickups.length >= 4) s.pickups.shift();
    s.pickups.push(item); event(s,'supply',item.x,item.y,POWERUPS[kind].label);
  }
  function collect(s, item) {
    const p=s.player, spec=POWERUPS[item.kind];
    s.stats.pickups++;
    if(item.kind==='repair') { if(p.hp<5) p.hp++; else s.score+=points(s,50); }
    else p.powers[item.kind]=spec.ticks;
    event(s,'pickup',p.x,p.y,spec.label);
  }
  function round(s) {
    const m = MISSIONS[s.mission];
    s.timeLeft = DIFFICULTIES[s.difficulty].time; s.sectorTick=0; s.nextSupply=360; s.pickups=[];
    s.player.powers={shield:0,rapid:0,volley:0}; s.pulse=null;
    s.targets=[]; s.race={player:0,ai:0,goal:6,total:11};
    s.projectiles = []; s.enemies = []; s.ducks = [{x: 300, y: SURFACE, r: 25}, {x: 735, y: SURFACE, r: 23}];
    s.player.x = 500; s.player.y = s.role === 'boat' ? SURFACE : 370;
    s.player.cooldown = 0; s.player.sonar = 0; s.player.invincible = 2; s.player.facing = 1;
    for (let i = 0; i < m.count; i++) s.enemies.push({
      id: s.nextId++, slot:i, x: 100 + (i + 0.5) * 800 / m.count + (random(s) - 0.5) * 55,
      y: s.role === 'boat' ? 220 + i * 56 : SURFACE,
      vx: (i % 2 ? -1 : 1) * m.speed * DIFFICULTIES[s.difficulty].speed, hp: s.mission === 2 ? 2 : 1, maxHp: s.mission === 2 ? 2 : 1,
      cooldown: (1.5 + i * 0.85) * DIFFICULTIES[s.difficulty].interval, reveal: 2, flash: 0, warned: false
    });
    if(s.mode==='pond') {
      s.ducks=[];
      for(let i=0;i<11;i++) s.targets.push({id:s.nextId++,kind:i<5?'duck':'fish',
        x:110+(i%5)*175+(random(s)-.5)*35,y:i<5?SURFACE:240+(i-5)*36,
        vx:(i%2?-1:1)*(i<5?26:42)*(1+s.mission*.2),alive:true});
    }
    event(s, 'mission', 500, 270, m.name);
  }
  function create(role = 'boat', seed = 0x5ab2026, difficulty = 'standard', mode = 'campaign') {
    if (!['boat', 'sub'].includes(role)) throw new TypeError('Choose boat or sub');
    if (!Object.hasOwn(DIFFICULTIES,difficulty)) throw new TypeError('Choose cadet, standard or admiral');
    if (!Object.hasOwn(MODES,mode)) throw new TypeError('Choose campaign or pond');
    const s = { role, difficulty, mode, initialSeed:seed>>>0, seed: seed >>> 0, supplySeed:(seed^0xbabb1e)>>>0, supplyCount:0,
      tick: 0, elapsed: 0, status: 'playing', mission: 0, score: 0,
      nextId: 1, kills: 0, events: [], pulse: null, transition: 0, lossReason: null,
      stats: { shots: 0, hits: 0, pings: 0, damageTaken: 0, pickups:0, blocked:0, toys:0, rivalToys:0 },
      player: { x: 500, y: SURFACE, hp: 5, cooldown: 0, sonar: 0, invincible: 0, facing: 1 } };
    round(s); return s;
  }
  function fire(s, actor, friendly) {
    const down = friendly ? s.role === 'boat' : s.role === 'sub';
    for(const vx of friendly && actor.powers.volley>0 ? [-55,0,55] : [0]) {
      if (friendly) s.stats.shots++;
      s.projectiles.push({ id: s.nextId++, x: actor.x, y: actor.y + (down ? 20 : -18),
        vx, vy: down ? 150 : -190, friendly, down, age: 0 });
    }
    event(s, friendly ? 'fire' : 'enemyFire', actor.x, actor.y);
  }
  function step(s, input = {}) {
    if (s.status !== 'playing') return s;
    s.events = [];
    const dt = STEP, p = s.player;
    s.tick++; s.elapsed += dt;
    p.cooldown = Math.max(0, p.cooldown - dt); p.sonar = Math.max(0, p.sonar - dt);
    p.invincible = Math.max(0, p.invincible - dt);
    if (s.transition > 0) {
      s.transition -= dt;
      if (s.transition <= 0) { s.transition = 0; s.mission++; p.hp = Math.min(5, p.hp + 1); round(s); }
      return s;
    }
    s.sectorTick++;
    for(const key of Object.keys(p.powers)) p.powers[key]=Math.max(0,p.powers[key]-1);
    const axis = n => Number.isFinite(n) ? clamp(n, -1, 1) : 0;
    if (axis(input.x)) p.facing = Math.sign(input.x);
    p.x = clamp(p.x + axis(input.x) * 205 * dt, 65, 935);
    if (s.role === 'sub') p.y = clamp(p.y + axis(input.y) * 155 * dt, 210, FLOOR - 30);
    // The drain current is a physical hazard only in the final mission.
    if (s.mission === 2 && s.role === 'sub' && p.x > 770 && p.y > 385) p.x = clamp(p.x + 28 * dt, 65, 935);
    if(s.sectorTick>=s.nextSupply) { supply(s,150+supplyRandom(s)*700); s.nextSupply+=900; }
    s.pickups=s.pickups.filter(item=>{
      item.remaining--;
      if(item.remaining<=0) return false;
      if(Math.abs(item.x-p.x)<42 && Math.abs(item.y-p.y)<34) {collect(s,item);return false;}
      return true;
    });
    if (input.fire && p.cooldown === 0) { fire(s, p, true); p.cooldown = (s.role === 'boat' ? 0.48 : 0.42) * (p.powers.rapid>0 ? .4 : 1); }
    if (input.sonar && p.sonar === 0) {
      p.sonar = 7; s.stats.pings++; s.pulse = {x: p.x, y: p.y, age: 0};
      s.enemies.forEach(e => {e.reveal = 4;}); event(s, 'sonar', p.x, p.y);
    }
    if (s.pulse) { s.pulse.age += dt; if (s.pulse.age > 1.2) s.pulse = null; }
    for(const target of s.targets) {
      target.x+=target.vx*dt;
      if(target.x<80||target.x>920) {target.x=clamp(target.x,80,920);target.vx*=-1;}
    }
    for (const e of s.enemies) {
      // In Pond Panic the fleet pursues living toys using the same physical shots.
      // Sub enemies dive below their chosen fish; boat enemies remain on the surface.
      if(s.mode==='pond' && s.targets.length) {
        const target=s.targets[e.slot%s.targets.length];
        if(s.role==='boat') e.y=clamp(e.y+Math.sign((target.kind==='fish'?target.y+55:260)-e.y)*60*dt,210,FLOOR-30);
        const flight=Math.abs(target.y-e.y)/(s.role==='boat'?190:150);
        const aim=clamp(target.x+target.vx*flight,65,935), delta=aim-e.x;
        e.vx=Math.sign(delta)*Math.min(MISSIONS[s.mission].speed*DIFFICULTIES[s.difficulty].speed,Math.abs(delta)/dt);
      }
      e.x += e.vx * dt;
      if (e.x < 65 || e.x > 935) {e.x = clamp(e.x, 65, 935); e.vx *= -1;}
      e.reveal = Math.max(0, e.reveal - dt); e.flash = Math.max(0, e.flash - dt);
      e.cooldown -= dt;
      if (e.cooldown > 0 && e.cooldown <= 0.75 && !e.warned) {
        e.warned = true; e.reveal = Math.max(e.reveal, 0.9); event(s, 'warning', e.x, e.y);
      }
      if (e.cooldown <= 0) {
        fire(s, e, false); e.reveal = 2.5;
        e.warned = false;
        e.cooldown = (MISSIONS[s.mission].interval + random(s) * 1.3) * DIFFICULTIES[s.difficulty].interval;
      }
    }
    const survivors = [];
    for (const q of s.projectiles) {
      q.age += dt; q.y += q.vy * dt; q.x += q.vx * dt;
      if (s.mission === 2 && q.y > 385 && q.x > 770) q.x += 28 * dt;
      if (q.y < SURFACE - 20 || q.y > FLOOR) {event(s, 'splash', q.x, clamp(q.y, SURFACE, FLOOR)); continue;}
      // Floating ducks shield boats, so aim through the gaps.
      if (!q.down && q.y < SURFACE + 32 && s.ducks.some(d => Math.abs(d.x - q.x) < d.r)) {
        event(s, 'duck', q.x, SURFACE, 'QUACK!'); continue;
      }
      if (!q.friendly && s.pulse && Math.hypot(q.x - s.pulse.x, q.y - s.pulse.y) < s.pulse.age * 290) {
        event(s, 'splash', q.x, q.y); continue;
      }
      const target=s.targets.find(t=>t.alive && Math.abs(t.x-q.x)<(t.kind==='duck'?25:30) && Math.abs(t.y-q.y)<23);
      if(target) {
        target.alive=false;
        if(q.friendly) {s.race.player++;s.stats.toys++;s.stats.hits++;s.score+=points(s,100);}
        else {s.race.ai++;s.stats.rivalToys++;}
        event(s,q.friendly?'toy':'rivalToy',target.x,target.y,q.friendly?'+1 TOY':'RIVAL +1');
        if(q.friendly && s.race.player%2===0) supply(s,target.x);
        continue;
      }
      if (q.friendly) {
        const e = s.enemies.find(e => e.hp > 0 && Math.abs(e.x - q.x) < 36 && Math.abs(e.y - q.y) < 23);
        if (e) {
          e.hp--; s.stats.hits++; e.flash = 0.2; e.reveal = 4;
          if (e.hp <= 0) {
            const reward=points(s,150+s.mission*50); s.score+=reward; s.kills++; event(s,'sink',e.x,e.y,'+ '+reward);
            if(s.kills%2===0) supply(s,e.x);
          }
          else event(s, 'hit', e.x, e.y);
          continue;
        }
      } else if (Math.abs(p.x - q.x) < 32 && Math.abs(p.y - q.y) < 23) {
        if (p.invincible === 0) {
          if(p.powers.shield>0) {p.powers.shield=0;s.stats.blocked++;p.invincible=.5;event(s,'block',p.x,p.y,'SHIELD SAVED YOU');}
          else {p.hp--; s.stats.damageTaken++; p.invincible = 1.4; event(s, 'damage', p.x, p.y, 'HULL HIT');}
        }
        continue;
      }
      survivors.push(q);
    }
    s.projectiles = survivors; s.enemies = s.enemies.filter(e => e.hp > 0); s.targets=s.targets.filter(t=>t.alive);
    s.timeLeft = Math.max(0, s.timeLeft - dt);
    if (p.hp <= 0 || (s.mode==='pond' && s.race.ai>=s.race.goal) || s.timeLeft <= 0) {
      s.status = 'lost'; s.lossReason = p.hp <= 0 ? 'hull' : s.race.ai>=s.race.goal ? 'outscored' : 'timeout'; event(s, 'lost', p.x, p.y);
    }
    else if (s.mode==='pond' ? s.race.player>=s.race.goal : !s.enemies.length) {
      s.score += points(s,Math.ceil(s.timeLeft)*5);
      if (s.mission === MISSIONS.length - 1) {s.status = 'won'; event(s, 'won', p.x, p.y);}
      else {s.transition = 2.5; event(s, 'clear', p.x, p.y, 'BATH SECTOR CLEAR');}
    }
    return s;
  }
export const SubHunt = Object.freeze({ create, step, STEP, WIDTH, HEIGHT, SURFACE, FLOOR, MISSIONS, DIFFICULTIES, POWERUPS, MODES, clamp });
