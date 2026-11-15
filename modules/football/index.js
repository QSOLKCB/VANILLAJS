// SPDX-License-Identifier: Apache-2.0
// SOCCERWEB v3.1.1; see docs/FOOTBALL_SDK.md and football PROVENANCE.json.
// Compatibility frame: Q8 pixels, +Y down, 60 Hz; not engine SI coordinates.
import {validateMatchSetup, validateTactics, validatePlayer, copyFootballData} from '../mod-football/index.js';
// Adapted source: simulation/math.mjs
// Q8 positions and velocities. All authoritative calculations round toward zero.
export const Q = 256;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const mul = (a, b, scale = Q) => Math.trunc(a * b / scale);
export function isqrt(n) {
  if (n <= 0) return 0;
  let x = n, y = Math.floor((x + 1) / 2);
  while (y < x) { x = y; y = Math.floor((x + Math.floor(n / x)) / 2); }
  return x;
}
export const length = (x, y) => isqrt(x * x + y * y);
export const distance = (a, b) => length(a.x - b.x, a.y - b.y);
export function vector(x, y, speed) {
  const d = length(x, y);
  return d ? [Math.trunc(x * speed / d), Math.trunc(y * speed / d)] : [0, 0];
}
export function random(s) {
  let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0; return s.rng;
}
export function hash(value) {
  const str = JSON.stringify(value); let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Adapted source: game/state.mjs
export const EMPTY = Object.freeze({ x: 0, y: 0, fire: false, pass: false, chip: false, switch: false, curve: 0, cancel: false });
// Internal donor state version; the public management replay envelope is v1.
export const VERSION = 5;
function config(options = {}) {
  const c = { seed: (Number(options.seed) >>> 0) || 1988, indoor: !!options.indoor,
    weather: options.weather === 'rain' ? 'rain' : 'clear', seconds: clamp(Math.trunc(Number(options.seconds) || 120), 20, 720),
    difficulty: clamp(Math.trunc(Number(options.difficulty) || 1), 1, 3),
    teams: [clamp(Math.trunc(options.teams?.[0] || 0), 0, 7), clamp(Math.trunc(options.teams?.[1] ?? 1), 0, 7)],
    humans: [options.humans?.[0] !== false, !!options.humans?.[1]], auto: options.auto !== false,
    aftertouch: clamp(Math.trunc(Number(options.aftertouch) || 0), 0, 3), knockout: !!options.knockout };
  return c;
}
export const attack = (s, team) => (team === 0 ? -1 : 1) * (s.half === 1 ? 1 : -1);
export const goalY = (s, team) => attack(s, team) < 0 ? 0 : s.h;
function createState(options = {}) {
  const c = config(options), w = (c.indoor ? 540 : 720) * Q, h = (c.indoor ? 800 : 1120) * Q;
  const s = { version: VERSION, config: c, rng: c.seed, tick: 0, elapsed: 0, half: 1, w, h, goal: 150 * Q,
    phase: 'kickoff', timer: 90, restartTeam: 0, restartType: 'KICK OFF', score: [0, 0],
    players: [], selected: [1, 1], previous: [{...EMPTY}, {...EMPTY}], ball: {}, events: [],
    stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], completedPasses: [0, 0], possession: [0, 0] }, sudden: false };
  const count = c.indoor ? 6 : 11;
  for (let t = 0; t < 2; t++) for (let i = 0; i < count; i++) {
    const row = c.indoor ? (i <= 2 ? .25 : .43) : (i <= 4 ? .23 : i <= 8 ? .37 : .46);
    const col = c.indoor ? (i <= 2 ? (i - 1) / 1 : (i - 3) / 2) : i <= 4 ? (i - 1) / 3 : i <= 8 ? (i - 5) / 3 : (i - 9);
    s.players.push({ id: t * count + i, team: t, number: i + 1, keeper: i === 0,
      hx: i === 0 ? 128 : Math.round((.18 + col * .64) * Q), hy: i === 0 ? 14 : Math.round(row * Q),
      x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: attack(s, t) * Q,
      fireMode: 'idle', pending: null, charge: 0, cooldown: 0, slide: 0, slip: 0, dive: 0, control: 0, think: 0, tx: 0, ty: 0, intent: 'shape' });
  }
  s.selected = [1, count + 1]; resetPositions(s, 0); return s;
}
export function resetPositions(s, team) {
  for (const p of s.players) {
    p.x = Math.trunc(s.w * p.hx / Q);
    const fromEnd = Math.trunc(s.h * p.hy / Q);
    p.y = attack(s, p.team) < 0 ? s.h - fromEnd : fromEnd;
    p.vx = p.vy = p.charge = p.slide = p.slip = p.cooldown = p.dive = p.control = 0;
    p.fireMode='idle'; p.pending=null; p.fx = 0; p.fy = attack(s, p.team) * Q; p.tx=p.x; p.ty=p.y;
  }
  s.ball = { x: s.w / 2, y: s.h / 2, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, owner: -1, last: team,
    kicker: -1, immunity: 0, flight: 0, kind: 'loose', receiver: -1 };
  const p = s.players.find(p => p.team === team && p.number === (s.config.indoor ? 6 : 10));
  p.x = s.w / 2; p.y = s.h / 2 - attack(s, team) * 15 * Q; s.selected[team] = p.id;
  s.restartTeam = team;
}
export function nearest(s, team, exclude = -1) {
  let best = -1, d = Infinity;
  for (const p of s.players) if (p.team === team && !p.keeper && p.id !== exclude) {
    const n = distance(p, s.ball); if (n < d) { d = n; best = p.id; }
  }
  return best;
}

// Adapted source: ai/team.mjs

// Pixel-quantized segment projection keeps utility intermediates exact and below 2^53.
export function laneClearance(s, from, to, team) {
  const dx=Math.trunc((to.x-from.x)/Q),dy=Math.trunc((to.y-from.y)/Q),den=dx*dx+dy*dy;
  let gap=180;
  if(!den)return 0;
  for(const foe of s.players)if(foe.team!==team){
    const ex=Math.trunc((foe.x-from.x)/Q),ey=Math.trunc((foe.y-from.y)/Q);
    const dot=ex*dx+ey*dy;
    if(dot<0||dot>den)continue;
    const px=ex-Math.trunc(dx*dot/den),py=ey-Math.trunc(dy*dot/den);
    gap=Math.min(gap,length(px,py));
  }
  return gap;
}
export function passTarget(s,p,dx=0,dy=0) {
  let best=null,utility=-Infinity;
  for(const mate of s.players)if(mate.team===p.team&&mate.id!==p.id&&!mate.keeper){
    const d=Math.trunc(distance(p,mate)/Q);if(d<40||d>(s.config.indoor?310:440))continue;
    const forward=Math.trunc((mate.y-p.y)/Q)*attack(s,p.team);
    const aim=dx||dy?Math.trunc(((mate.x-p.x)*dx+(mate.y-p.y)*dy)/(d*Q)*120):0;
    let space=130;
    for(const foe of s.players)if(foe.team!==p.team)space=Math.min(space,Math.trunc(distance(mate,foe)/Q));
    const lane=laneClearance(s,p,mate,p.team);
    const score=forward+space+aim-Math.trunc(Math.abs(d-150)/3)-(lane<23?(23-lane)*12:0);
    if(score>utility){utility=score;best=mate;}
  }
  return best;
}
function steer(s,p,tx,ty,separate=true) {
  let dx=tx-p.x,dy=ty-p.y;
  if(separate)for(const mate of s.players)if(mate.team===p.team&&mate.id!==p.id&&!mate.keeper){
    const d=distance(p,mate);
    if(d<52*Q){const [x,y]=vector(p.x-mate.x||((p.id&1)?Q:-Q),p.y-mate.y,Math.trunc((52*Q-d)*.8));dx+=x;dy+=y;}
  }
  if(length(dx,dy)<5*Q)return{x:0,y:0};
  const [x,y]=vector(dx,dy,Q);return{x,y};
}
export function aiIntent(s,p) {
  const b=s.ball,dir=attack(s,p.team),difficulty=p.ability?.decision ?? s.config.difficulty;
  const own=b.owner>=0?s.players[b.owner]:null,team=s.clubs[p.team];
  if(p.keeper){
    const gy=dir<0?s.h:0,g=goalGeometry(s,gy);
    if(own?.id===p.id){p.intent='distribute';return p.control<18?{x:0,y:0}:{x:0,y:dir*Q,kick:'pass',power:36,target:passTarget(s,p)};}
    // Reaction intervals change with difficulty; neither running speed nor reach is secretly boosted.
    const reaction=p.ability?.reaction ?? (s.config.indoor?8-difficulty:15-difficulty*3);
    if(s.tick%reaction===p.id%reaction||!p.ty){
      const incoming=b.vy*dir<-2*Q;
      const line=gy+dir*24*Q;
      const time=incoming?clamp(Math.trunc((line-b.y)/b.vy),0,35):0;
      const predicted=b.x+b.vx*time;
      p.tx=clamp(incoming?predicted:b.x,g.left+10*Q,g.right-10*Q);
      p.ty=gy+dir*(Math.abs(b.y-gy)<230*Q?31:20)*Q;
      if(incoming&&time>0&&time<19&&Math.abs(predicted-g.center)<g.width/2+12*Q&&b.z<35*Q&&p.cooldown===0){p.dive=18;p.cooldown=60;}
    }
    p.intent=p.dive?'dive':'guard';return steer(s,p,p.tx,p.ty,false);
  }
  if(own?.id===p.id){
    p.intent='attack';const targetGoal=goalGeometry(s,goalY(s,p.team));
    const goalDist=Math.abs(goalY(s,p.team)-p.y)/Q,alignment=Math.abs(p.x-s.w/2)/Q;
    if(--p.think<=0&&p.control>=(s.config.indoor?16:8)){
      p.think=p.ability?.think ?? (40-difficulty*7);
      const keeper=s.players.find(q=>q.team!==p.team&&q.keeper);
      const side=keeper.x>=targetGoal.center?-1:1;
      const target={x:targetGoal.center+side*Math.min(43*Q,targetGoal.width/2-18*Q),y:goalY(s,p.team)};
      const shotLane=laneClearance(s,p,target,p.team);
      if(goalDist<260+team.attack&&alignment<s.w/Q*.33&&(shotLane>12||goalDist<145)){
        const error=(random(s)%(p.ability?.error ?? (39-difficulty*9))-Math.floor((p.ability?.error ?? (39-difficulty*9))/2))*Q;
        return{x:0,y:dir*Q,kick:'shot',power:36+difficulty*7,aimX:target.x+error,aimY:target.y};
      }
      let pressure=1000*Q;
      for(const foe of s.players)if(foe.team!==p.team)pressure=Math.min(pressure,distance(foe,p));
      const mate=passTarget(s,p),progress=mate?(mate.y-p.y)*dir:0;
      // Don't turn every possession into an immediate sideways pass. A clear forward lane is valuable.
      if(mate&&laneClearance(s,p,mate,p.team)>17&&p.control>=(s.config.indoor?18:14)&&
          (pressure<48*Q||(progress>80*Q&&random(s)%100<team.pass)))
        return{x:0,y:dir*Q,kick:'pass',power:25,target:mate};
    }
    let tx=s.w/2+Math.trunc((p.x-s.w/2)/3);
    for(const foe of s.players)if(foe.team!==p.team&&!foe.keeper&&distance(foe,p)<70*Q&&(foe.y-p.y)*dir>0){tx+=(p.x>=foe.x?1:-1)*65*Q;break;}
    return steer(s,p,clamp(tx,35*Q,s.w-35*Q),p.y+dir*200*Q);
  }
  const receiver=b.owner<0&&b.kind==='pass'&&b.last===p.team&&b.receiver>=0?b.receiver:-1;
  const chaser=receiver>=0?receiver:nearest(s,p.team);
  // A teammate carrying the ball needs passing options, not a second player chasing their feet.
  if(own?.team!==p.team&&chaser===p.id){
    p.intent='chase';const ahead=difficulty*3;
    const action=steer(s,p,clamp(b.x+b.vx*ahead,10*Q,s.w-10*Q),clamp(b.y+b.vy*ahead,10*Q,s.h-10*Q));
    action.tackle=own&&own.team!==p.team&&distance(p,b)<(25+difficulty*3)*Q&&p.control===0&&s.tick%(p.ability?.tackle ?? (75-difficulty*10))===p.id%(p.ability?.tackle ?? (75-difficulty*10));
    return action;
  }
  const base=Math.trunc(s.h*p.hy/Q),homeY=dir<0?s.h-base:base;
  let tx=Math.trunc(s.w*p.hx/Q)+Math.trunc((b.x-s.w/2)/5);
  let ty=homeY+Math.trunc((b.y-s.h/2)/2);
  if(own?.team===p.team){
    p.intent='support';ty+=dir*(110+team.attack)*Q;
    if(distance(p,own)<310*Q&&!own.keeper){
      const wing=p.hx<128?-1:1,role=p.number%3;
      tx=own.x+wing*(role===0?105:145)*Q;ty=own.y+dir*(role===0?-65:role===1?95:165)*Q;
    }
  }else{
    p.intent='mark';
    if(p.positionRole ? p.positionRole==='DF' : p.number<=(s.config.indoor?3:5)){
      let threat=null,best=Infinity;
      for(const foe of s.players)if(foe.team!==p.team&&!foe.keeper){const d=distance(foe,{x:tx,y:ty});if(d<best){best=d;threat=foe;}}
      if(threat&&best<210*Q){tx+=Math.trunc((threat.x-tx)*(difficulty+1)/6);ty+=Math.trunc((threat.y-dir*27*Q-ty)*(difficulty+1)/6);}
    }
  }
  // In the small court, keep two outlets behind possession instead of sending everyone at goal.
  if(s.config.indoor&&own?.team===p.team&&p.number<=3){
    const end=dir<0?s.h:0,depth=clamp(Math.trunc(Math.abs(own.y-end)*.4),85*Q,230*Q);
    tx=s.w/2+(p.number===2?-80:80)*Q+Math.trunc((b.x-s.w/2)/6);ty=end+dir*depth;p.intent='cover';
  }
  p.tx=clamp(tx,28*Q,s.w-28*Q);p.ty=clamp(ty,55*Q,s.h-55*Q);
  return steer(s,p,p.tx,p.ty);
}

// Adapted source: simulation/physics.mjs
export function kick(s, p, kind = 'shot', power = 30, aim = null, curve = 0) {
  const b = s.ball;
  if (b.kind==='caught' && b.owner>=0 && b.owner!==p.id || distance(p, b) > 30 * Q || b.z > 55 * Q || p.cooldown > 0) return false;
  let dx = p.fx, dy = p.fy;
  const target = kind === 'pass' ? (aim || passTarget(s, p, dx / Q, dy / Q)) : aim;
  if (target) {
    const lead = kind === 'pass' ? clamp(Math.trunc(distance(p,target) / (8 * Q)), 0, 16) : 0;
    dx = clamp(target.x + (target.vx || 0) * lead, 8 * Q, s.w - 8 * Q) - b.x;
    dy = kind === 'pass' ? clamp(target.y + (target.vy || 0) * lead, 8 * Q, s.h - 8 * Q) - b.y : target.y - b.y;
  }
  if (!dx && !dy) dy = attack(s, p.team) * Q;
  const aerial = b.z > 12 * Q;
  const speed = kind === 'pass' ? (Math.trunc(5.5 * Q) + Math.min(4 * Q, Math.trunc((target ? distance(p, target) : 0) / 85))) : (7 * Q + Math.trunc(clamp(power, 0, 60) * Q / 7));
  [b.vx, b.vy] = vector(dx, dy, Math.trunc(speed * (p.ability?.power ?? 100) / 100) + (aerial ? Q : 0));
  b.vz = kind === 'chip' ? 5 * Q + Math.trunc(power * Q / 30) : kind === 'pass' ? (power > 42 ? 4 * Q : Q / 4) : Q + Math.trunc(power * Q / 65);
  if (kind === 'overhead') { [b.vx, b.vy] = vector(goalGeometry(s,goalY(s,p.team)).center - b.x, goalY(s, p.team) - b.y, 13 * Q); b.vz = 3 * Q; }
  b.kind = kind; b.receiver = kind === 'pass' && target && Number.isInteger(target.id) ? target.id : -1;
  b.spin = clamp(curve * 6, -18, 18); b.owner = -1; b.last = p.team; b.kicker = p.id; b.immunity = 14; b.flight = 65;
  p.cooldown = 18; p.charge = 0;
  s.stats[kind === 'pass' ? 'passes' : 'shots'][p.team]++;
  s.events.push({ type: 'kick', kind: kind === 'overhead' ? 'overhead' : aerial ? 'volley' : kind, team: p.team, player: p.id, power: clamp(power,0,60), speed: Math.trunc(speed/Q), x:b.x, y:b.y }); return true;
}
export function tackle(s, p) {
  if (p.cooldown || p.slip || p.slide) return;
  p.slide = 18; p.cooldown = 55; p.vx += mul(p.fx, 3 * Q); p.vy += mul(p.fy, 3 * Q);
  s.events.push({ type: 'slide', team: p.team, player:p.id, speed:Math.trunc(length(p.vx,p.vy)/Q) });
}
export function ballPhysics(s) {
  const b = s.ball, old = { x: b.x, y: b.y, z: b.z };
  if (b.immunity > 0) b.immunity--;
  if (b.flight > 0) b.flight--;
  const vx = b.vx;
  b.vx -= mul(b.vy, b.spin, 4096); b.vy += mul(vx, b.spin, 4096);
  b.x += b.vx; b.y += b.vy; b.z += b.vz;
  b.vz -= 36;
  if (b.z < 0) {
    b.z = 0;
    b.vz = Math.abs(b.vz) > 90 ? -mul(b.vz, 118) : 0;
    if (b.vz > 160) s.events.push({ type: 'bounce', speed:Math.trunc(b.vz/Q) });
  }
  const friction = b.z > 0 ? 255 : s.config.indoor ? 252 : s.config.weather === 'rain' ? 254 : 251;
  b.vx = mul(b.vx, friction); b.vy = mul(b.vy, friction);
  if (Math.abs(b.vx) + Math.abs(b.vy) < 24) b.vx = b.vy = 0;
  // Swept crossing at the goal plane, rather than an endpoint-only goal test.
  if ((old.y >= 0 && b.y < 0) || (old.y <= s.h && b.y > s.h)) {
    const end = b.y < 0 ? 0 : s.h, den = b.y - old.y;
    const crossX = old.x + Math.trunc((b.x - old.x) * (end - old.y) / den);
    const crossZ = old.z + Math.trunc((b.z - old.z) * (end - old.y) / den);
    const geometry=goalGeometry(s,end,end-old.y,den),center=geometry.center,width=geometry.width;
    // Resolve frame contact before scoring: the inner post/crossbar regions overlap the goal opening.
    if (Math.abs(Math.abs(crossX - center) - width / 2) < 8 * Q && crossZ < 40 * Q || Math.abs(crossX - center) < width / 2 && Math.abs(crossZ - 36 * Q) < 5 * Q) {
      b.y = clamp(b.y, 2 * Q, s.h - 2 * Q); b.vy = -mul(b.vy, 205); b.owner = -1;
      s.events.push({ type: 'post', speed:Math.trunc(length(b.vx,b.vy)/Q) }); return;
    }
    if (Math.abs(crossX - center) < width / 2 - 4 * Q && crossZ < 36 * Q) {
      const scoring = goalY(s, 0) === end ? 0 : 1;
      s.score[scoring]++; s.phase = 'goal'; s.timer = 150; s.restartTeam = 1 - scoring;
      s.events.push({ type: 'goal', team: scoring }); return;
    }
  }
  if (s.config.indoor) {
    if (b.x < 4 * Q || b.x > s.w - 4 * Q) { b.x = clamp(b.x, 4 * Q, s.w - 4 * Q); b.vx = -mul(b.vx, 224); b.owner = -1; s.events.push({ type: 'wall', speed:Math.trunc(length(b.vx,b.vy)/Q) }); }
    if (b.y < 0 || b.y > s.h) { b.y = clamp(b.y, 2 * Q, s.h - 2 * Q); b.vy = -mul(b.vy, 224); b.owner = -1; s.events.push({ type: 'wall', speed:Math.trunc(length(b.vx,b.vy)/Q) }); }
  } else if (b.x < 0 || b.x > s.w || b.y < 0 || b.y > s.h) {
    let team = 1 - b.last, type = 'THROW IN';
    if (b.y < 0 || b.y > s.h) {
      const end = b.y < 0 ? 0 : s.h, defending = goalY(s, 0) === end ? 1 : 0;
      if (b.last === defending) { type = 'CORNER'; b.x = b.x < s.w / 2 ? 6 * Q : s.w - 6 * Q; b.y = end === 0 ? 6 * Q : s.h - 6 * Q; }
      else { type = 'GOAL KICK'; team = defending; b.x = goalGeometry(s,end).center; b.y = end === 0 ? 60 * Q : s.h - 60 * Q; }
    } else { b.x = clamp(b.x, 6 * Q, s.w - 6 * Q); b.y = clamp(b.y, 15 * Q, s.h - 15 * Q); }
    b.vx = b.vy = b.vz = b.z = b.spin = 0; b.owner = -1;
    s.phase = 'restart'; s.timer = 65; s.restartTeam = team; s.restartType = type;
    s.events.push({ type: 'whistle' }); return;
  }
  if (b.owner >= 0) {
    const owner = s.players[b.owner];
    if (distance(owner, b) > 34 * Q || b.z > 12 * Q || owner.slip || owner.slide) b.owner = -1;
  }
  const contacts = s.players.filter(p => {
    const reach = (p.keeper && p.dive ? 24 : p.keeper ? 19 : p.slide ? 23 : 12) * Q;
    return !(b.kind==='caught'&&b.owner>=0&&b.owner!==p.id) && !(b.immunity && b.kicker === p.id) && !p.slip && distance(p,b) <= reach;
  }).sort((a,c) => distance(a,b)-distance(c,b) || a.id-c.id);
  for (const p of contacts) {
    const d = distance(p, b), speed = length(b.vx, b.vy);
    const ownEnd = attack(s, p.team) < 0 ? s.h : 0;
    const keeper = p.keeper && Math.abs(p.y - ownEnd) < 165 * Q;
    const radius = (keeper && p.dive ? 24 : keeper ? 19 : p.slide ? 23 : 12) * Q;
    if (b.immunity && b.kicker === p.id || p.slip || d > radius || b.z > (keeper ? 36 : p.slide ? 8 : 13) * Q) continue;
    if (keeper && b.owner !== p.id && b.last !== p.team && speed > 2 * Q && (b.owner<0||d+3*Q<distance(s.players[b.owner],b))) {
      if (['shot','chip','overhead'].includes(b.kind)) s.stats.saves[p.team]++;
      s.events.push({ type: 'save', team: p.team, player:p.id, speed:Math.trunc(speed/Q), caught:!(speed > 11*Q && (!p.dive || d > 10*Q)) });
      if (speed > 11 * Q && (!p.dive || d > 10*Q)) {
        b.vy = attack(s, p.team) * Math.abs(mul(b.vy, 155)); b.vx += Math.trunc((b.x - p.x) / 6); b.vz = 2 * Q;
        b.last = p.team; b.kicker = p.id; b.immunity = 14; b.owner = -1; b.kind='rebound'; break;
      }
      b.vx = b.vy = b.vz = 0; b.z = 0; b.owner = p.id; b.last = p.team; b.kind='caught'; p.control=0; break;
    } else if (p.slide && b.owner !== p.id) {
      b.owner = -1; b.vx = p.vx + mul(p.fx, 4 * Q); b.vy = p.vy + mul(p.fy, 4 * Q);
      b.last = p.team; b.kicker = p.id; b.immunity = 10; s.stats.tackles[p.team]++; b.kind='loose'; s.events.push({type:'tackle',team:p.team,player:p.id});break;
    } else if (b.owner < 0 && (speed < 9 * Q || keeper)) {
      const passed=b.kind==='pass' && b.last===p.team && b.kicker!==p.id;
      if(passed)s.stats.completedPasses[p.team]++;
      b.owner = p.id; b.last = p.team; b.kind=keeper?'caught':'held'; p.control=0;
      b.vx=Math.trunc((b.vx+p.vx)/3);b.vy=Math.trunc((b.vy+p.vy)/3);
      s.events.push({type:'receive',team:p.team,player:p.id,passed});break;
    }
    else if (b.owner >= 0 && s.players[b.owner].team !== p.team && d < 9 * Q && d+3*Q<distance(s.players[b.owner],b)) { b.owner = p.id; b.last = p.team; b.kind='held'; p.control=0; s.events.push({type:'intercept',team:p.team,player:p.id});break; }
    else if (b.owner < 0 && d < 10 * Q) {
      const [nx, ny] = vector(b.x - p.x || Q, b.y - p.y, Q);
      const dot = mul(b.vx, nx) + mul(b.vy, ny);
      if (dot < 0) { b.vx -= mul(nx, dot * 2); b.vy -= mul(ny, dot * 2); b.vx = mul(b.vx, 160); b.vy = mul(b.vy, 160); b.last = p.team; b.kind='loose'; break; }
    }
  }
  // A dribble is a spring impulse toward the runner's leading foot. The ball remains free.
  if (b.owner >= 0) {
    const p = s.players[b.owner];
    const dx = p.x + mul(p.fx, (b.kind==='caught'?3:15) * Q) - b.x, dy = p.y + mul(p.fy, (b.kind==='caught'?3:15) * Q) - b.y;
    b.vx = mul(b.vx, 160) + Math.trunc(dx / 5) + Math.trunc(p.vx / 3);
    b.vy = mul(b.vy, 160) + Math.trunc(dy / 5) + Math.trunc(p.vy / 3);
    b.spin = 0; b.flight = 0; s.stats.possession[p.team]++;
  }
}

// Adapted source: game/match.mjs
export function normalizeInput(i = EMPTY) {
  return { x: clamp(Math.trunc(i.x || 0), -1, 1), y: clamp(Math.trunc(i.y || 0), -1, 1),
    cancel: !!i.cancel, fire: !!i.fire, pass: !!i.pass, chip: !!i.chip, switch: !!i.switch, curve: clamp(Math.trunc(i.curve || 0), -1, 1) };
}
function restart(s) {
  if (s.phase === 'goal') {
    if (s.sudden) { s.phase = 'fulltime'; s.events.push({ type: 'whistle' }); return; }
    resetPositions(s, s.restartTeam); s.phase = 'kickoff'; s.restartType = 'KICK OFF'; s.timer = 70;
  } else if (s.phase === 'halftime') {
    s.half = 2; resetPositions(s, 1); s.phase = 'kickoff'; s.restartType = 'SECOND HALF'; s.timer = 70;
  } else if (s.phase === 'restart') {
    const id = nearest(s, s.restartTeam), p = s.players[id];
    p.x = s.ball.x; p.y = clamp(s.ball.y - attack(s, p.team) * 13 * Q, 5 * Q, s.h - 5 * Q);
    p.fx = s.ball.x < 15 * Q ? Q : s.ball.x > s.w - 15 * Q ? -Q : 0; p.fy = attack(s, p.team) * Q;
    s.ball.owner = id; s.ball.last = p.team; s.selected[p.team] = id; s.phase = 'play';
  } else s.phase = 'play';
}
function step(s, inputs = [EMPTY, EMPTY]) {
  if (s.phase === 'fulltime') return s;
  const ins = inputs.map(normalizeInput); s.events = []; s.tick++;
  if (s.phase !== 'play') {
    for(const p of s.players){p.charge=0;p.fireMode='idle';p.pending=null;}
    if (--s.timer <= 0) restart(s);
    s.previous = ins; return s;
  }
  s.elapsed++;
  if (s.half === 1 && s.elapsed >= s.config.seconds * 30) { s.phase = 'halftime'; s.timer = 150; s.events.push({ type: 'whistle' }); return s; }
  if (s.elapsed >= s.config.seconds * 60 && !s.sudden) {
    if (s.config.knockout && s.score[0] === s.score[1]) { s.sudden = true; s.events.push({ type: 'goldengoal' }); }
    else { s.phase = 'fulltime'; s.events.push({ type: 'whistle' }); return s; }
  }
  for (const p of s.players) {
    p.control = s.ball.owner === p.id ? p.control + 1 : 0;
    p.cooldown = Math.max(0, p.cooldown - 1); p.dive = Math.max(0, p.dive - 1);
    p.charge=0;p.fireMode='idle';p.pending=null;
    const action = aiIntent(s, p);
    if (action.kick) kick(s, p, action.kick, action.power, action.target || (action.aimX !== undefined ? { x: action.aimX, y: action.aimY } : null));
    if (action.tackle) tackle(s, p);
    if (p.slide > 0) { p.slide--; p.vx = mul(p.vx, 245); p.vy = mul(p.vy, 245); }
    else if (p.slip > 0) { p.slip--; p.vx = mul(p.vx, 250); p.vy = mul(p.vy, 250); }
    else {
      const baseSpeed = p.keeper ? (p.dive ? 5 * Q : 3 * Q) : s.config.indoor ? 900 : 790;
      const speed = Math.trunc(baseSpeed * (p.ability?.speed ?? 100) / 100);
      const ax = action.x || 0, ay = action.y || 0;
      const turn = p.vx * ax + p.vy * ay;
      const wet = s.config.weather === 'rain' && !s.config.indoor;
      const traction = wet ? (!ax && !ay ? 44 : turn < 0 ? 46 : 35) : !ax && !ay ? 88 : turn < 0 ? 78 : 62;
      if (s.config.weather === 'rain' && !s.config.indoor && turn < -100000 && random(s) % 180 === 0) { p.slip = 18; s.events.push({ type: 'slip' }); }
      p.vx += mul(mul(ax, speed) - p.vx, traction);
      p.vy += mul(mul(ay, speed) - p.vy, traction);
      if (ax || ay) { p.fx = ax; p.fy = ay; }
    }
    p.x = clamp(p.x + p.vx, 7 * Q, s.w - 7 * Q); p.y = clamp(p.y + p.vy, 7 * Q, s.h - 7 * Q);
  }
  // Resolve overlapping bodies with stable ID order; neither team gets iteration-dependent randomness.
  for (let a = 0; a < s.players.length; a++) for (let b = a + 1; b < s.players.length; b++) {
    const p = s.players[a], q = s.players[b], d = distance(p, q);
    if (d < 15 * Q && !p.slide && !q.slide) {
      const [x, y] = vector(p.x - q.x || Q, p.y - q.y, Math.trunc((15 * Q - d) / 2));
      p.x = clamp(p.x + x, 7 * Q, s.w - 7 * Q); p.y = clamp(p.y + y, 7 * Q, s.h - 7 * Q);
      q.x = clamp(q.x - x, 7 * Q, s.w - 7 * Q); q.y = clamp(q.y - y, 7 * Q, s.h - 7 * Q);
    }
  }
  ballPhysics(s); s.previous = ins; return s;
}

export function goalGeometry(s) { return {center:s.w/2,width:s.goal,left:(s.w-s.goal)/2,right:(s.w+s.goal)/2}; }

// Public management adapter. Decisions change movement, AI and kicks; scores
// always come from the donor ball/goal physics. State is caller-owned and mutable.
export const FOOTBALL_REPLAY = 'qsol.football-replay.v1';
export const MAX_MATCH_TICKS = 120000;
export function playerPerformance(player, tactics, cohesion, role, fatigue=0, home=0) {
  const condition=clamp(player.condition-fatigue,15,100);
  const readiness=(condition*4+player.morale*2+player.sharpness*2+cohesion*2)/10;
  const familiarity=player.role===role?100:player.role==='GK'||role==='GK'?55:86;
  const quality=attribute=>clamp(Math.round((attribute*.6+readiness*.4)*familiarity/100+home),1,100);
  const pace=quality(player.pace),passing=quality(player.passing),finishing=quality(player.finishing),defending=quality(player.defending),keeping=quality(player.keeping);
  return {readiness:Math.round(readiness),familiarity,condition:Math.round(condition),
    speed:Math.round((70+pace*.55)*(0.92+tactics.press*.0016)),
    decision:passing>=75?3:passing>=45?2:1,
    reaction:clamp(17-Math.floor(keeping/8),4,16),
    think:clamp(40-Math.floor(passing/5)-Math.floor(tactics.tempo/7),8,40),
    error:clamp(43-Math.floor(finishing*.35),8,43),
    tackle:clamp(88-Math.floor(defending/3)-Math.floor(tactics.press/4),24,88),
    power:clamp(82+Math.floor(finishing*.28),82,110)};
}
// Integral workload preserves past effort exactly across tactical intervals.
// Divide by match ticks * 40,000 only when deriving condition for performance.
function accrueFatigue(s,team) {
  const managed=s.management.teams[team],active=s.elapsed-managed.fatigueAt;
  if(active<=0)return;
  const intensity=100+2*managed.tactics.press+managed.tactics.tempo;
  for(let slot=0;slot<11;slot++)managed.fatigueLoad[slot]+=active*s.management.setup.rules.fatigue*intensity*(260-managed.players[slot].stamina);
  managed.fatigueAt=s.elapsed;
}
function refreshTeam(s,team) {
  accrueFatigue(s,team);
  const managed=s.management.teams[team],t=managed.tactics;
  const f=s.management.setup.formations.find(f=>f.id===t.formation);
  const base=s.management.setup.teams[team].club;
  s.clubs[team]={...base,attack:clamp(base.attack+t.mentality-50,1,100),pass:clamp(base.pass+Math.trunc((50-t.tempo)/2),1,100)};
  for(let slot=0;slot<11;slot++) {
    const p=s.players[team*11+slot],person=managed.players[slot],anchor=f.slots[slot];
    p.hx=Math.round(clamp(50+(anchor[0]-50)*(.65+t.width*.007),8,92)*Q/100);
    p.hy=Math.round(clamp(anchor[1]+(slot?(t.mentality-50)*.08:0),2,48)*Q/100);
    const fatigue=managed.fatigueLoad[slot]/(s.config.seconds*60*40000);
    p.ability=playerPerformance(person,t,managed.cohesion,anchor[2],fatigue,team===0?s.management.setup.rules.homeAdvantage:0);
    p.rosterId=person.id;p.positionRole=anchor[2];
  }
}
export function createFootballMatch(input) {
  const setup=validateMatchSetup(input);
  const s=createState({seed:setup.seed,seconds:setup.rules.seconds,humans:[false,false],difficulty:2,weather:setup.weather});
  s.clubs=[];
  s.management={setup,commands:[],teams:setup.teams.map(t=>({players:structuredClone(t.players),tactics:{...t.tactics},cohesion:t.cohesion,entered:Array(11).fill(0),fatigueAt:0,fatigueLoad:Array(11).fill(0),used:t.players.map(p=>p.id),substitutions:0}))};
  refreshTeam(s,0);refreshTeam(s,1);resetPositions(s,0);return s;
}
export function stepFootball(s) {
  if(s.phase==='fulltime')return s;
  if(s.tick>=MAX_MATCH_TICKS)throw new RangeError('Football tick budget exceeded');
  if(s.elapsed%60===0){refreshTeam(s,0);refreshTeam(s,1);}
  const priorPhase=s.phase;step(s);
  if(s.phase!==priorPhase&&(s.phase==='halftime'||s.phase==='fulltime')){refreshTeam(s,0);refreshTeam(s,1);}
  return s;
}
export function commandFootball(s,input) {
  const cmd=copyFootballData(input);
  if(s.phase==='fulltime')throw new Error('Match is finished');
  if(s.management.commands.length>=64)throw new RangeError('At most 64 match commands');
  if(cmd.team!==0&&cmd.team!==1)throw new TypeError('Command team must be 0 or 1');
  const team=s.management.teams[cmd.team];
  const exact=keys=>{if(Object.keys(cmd).sort().join()!==keys.sort().join())throw new TypeError('Unexpected match command fields');};
  if(cmd.type==='tactics') {
    exact(['type','team','tactics']);const tactics=validateTactics(cmd.tactics);
    if(!s.management.setup.formations.some(f=>f.id===tactics.formation))throw new TypeError('Unknown formation');
    accrueFatigue(s,cmd.team);team.tactics=tactics;
  }else if(cmd.type==='substitute') {
    exact(['type','team','slot','playerId']);
    if(!Number.isInteger(cmd.slot)||cmd.slot<0||cmd.slot>10||team.substitutions>=3)throw new RangeError('Invalid slot or three substitutions already used');
    const incoming=s.management.setup.teams[cmd.team].club.players.find(p=>p.id===cmd.playerId);
    if(!incoming||team.used.includes(incoming.id))throw new TypeError('Substitute must be an unused squad player');
    if((cmd.slot===0)!==(incoming.role==='GK'))throw new TypeError('Goalkeeper must stay in slot zero');
    const replacement=validatePlayer(incoming);accrueFatigue(s,cmd.team);
    team.players[cmd.slot]=replacement;team.fatigueLoad[cmd.slot]=0;team.used.push(incoming.id);team.entered[cmd.slot]=s.elapsed;team.substitutions++;
  }else throw new TypeError('Unknown match command');
  s.management.commands.push({tick:s.tick,command:cmd});refreshTeam(s,cmd.team);return s;
}
export function footballHash(s){return hash(s);}
export function exportFootballReplay(s){return {kind:FOOTBALL_REPLAY,setup:structuredClone(s.management.setup),commands:structuredClone(s.management.commands),ticks:s.tick,finalHash:footballHash(s)};}
export function verifyFootballReplay(input) {
  const replay=copyFootballData(input);
  if(!replay||Object.keys(replay).sort().join()!==['kind','setup','commands','ticks','finalHash'].sort().join()||replay.kind!==FOOTBALL_REPLAY||!Number.isInteger(replay.ticks)||replay.ticks<0||replay.ticks>MAX_MATCH_TICKS||!Array.isArray(replay.commands)||replay.commands.length>64||! /^[0-9a-f]{8}$/.test(replay.finalHash))throw new TypeError('Invalid football replay');
  const s=createFootballMatch(replay.setup);let i=0,last=-1;
  for(const cmd of replay.commands){if(!cmd||Object.keys(cmd).sort().join()!=='command,tick'||!Number.isInteger(cmd.tick)||cmd.tick<0||cmd.tick<last||cmd.tick>replay.ticks)throw new TypeError('Invalid replay command order');last=cmd.tick;}
  while(true){
    while(i<replay.commands.length&&replay.commands[i].tick===s.tick)commandFootball(s,replay.commands[i++].command);
    if(s.tick===replay.ticks)break;
    if(s.phase==='fulltime')throw new TypeError('Replay continues after full time');
    stepFootball(s);
  }
  if(i!==replay.commands.length||footballHash(s)!==replay.finalHash)throw new TypeError('Football replay checksum mismatch');
  return {status:'PASS',complete:s.phase==='fulltime',state:s};
}
