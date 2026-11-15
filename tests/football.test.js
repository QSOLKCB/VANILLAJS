// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadFootballBundle,validateFootballMod,validateMatchSetup,copyFootballData} from '../modules/mod-football/index.js';
import {createFootballMatch,stepFootball,commandFootball,exportFootballReplay,verifyFootballReplay,footballHash,playerPerformance,ballPhysics,aiIntent,Q} from '../modules/football/index.js';
import {createCareer,trainRound,matchSetup,fixtureList,standings,finishRound,playOtherFixtures,selectPlayer,autoLineup,signPlayer,sellPlayer,improveFacilities,nextSeason,exportCareer,importCareer,ownClub} from '../demos/football-manager/career.js';
const starter=JSON.parse(await readFile(new URL('../demos/football-manager/starter.json',import.meta.url)));
const career=()=>createCareer(starter,'sol',1988);
const setup=()=>matchSetup(trainRound(career()),'sol','neo');
function finish(s){while(s.phase!=='fulltime')stepFootball(s);return s;}

test('SOCCERWEB eight clubs, colors, strengths and 18-person squads are retained',()=>{
 const c=loadFootballBundle(starter).content;
 assert.deepEqual(c.clubs.map(c=>c.name).sort(),['SOLAR ATHLETIC','NEON ROVERS','TIDAL UNITED','MOSS CITY','VIOLET COMETS','EMBER FC','POLAR WANDERERS','COBALT STARS'].sort());
 assert.deepEqual(c.clubs.map(c=>[c.short,c.attack,c.press,c.pass]).sort(),[['SOL',72,62,65],['NEO',78,74,46],['TID',58,48,88],['MOS',50,84,70],['VIO',90,55,55],['EMB',70,90,57],['POL',62,64,78],['COB',85,80,82]].sort());
 assert.deepEqual(c.clubs.map(c=>[c.short,c.color]).sort(),[['SOL','#f3c850'],['NEO','#ec6482'],['TID','#5ccbe2'],['MOS','#a5db70'],['VIO','#b49aff'],['EMB','#ff9566'],['POL','#e4edf0'],['COB','#729cfc']].sort());
 assert.ok(c.clubs.every(c=>c.players.length===18));assert.equal(c.formations.length,3);c.clubs[0].name='Changed';assert.equal(starter.packs[0].entries[0].data.value.name,'SOLAR ATHLETIC');
});
test('mods reject malformed, unsafe and ambiguous content before activation',()=>{
 for(const edit of [b=>{b.packs[0].entries[0].data.value.color='url(evil)';},b=>{b.packs[0].entries[0].data.value.players[0].pace=101;},b=>{b.packs[0].entries[0].data.value.players[0].pace=NaN;},b=>{b.packs[0].entries[0].data.value.extra=true;},b=>{b.packs[1].entries[0].data.value.id='sol';},b=>{b.packs[1].entries[0].data.value.players[0].id='sol-1';},b=>{b.packs.pop();},b=>{b.packs[0].requires=[{id:'absent',version:'1.0.0'}];},b=>{b.packs[0].entries[0].data.value.players[11].role='DF';}]){const b=structuredClone(starter);edit(b);assert.throws(()=>loadFootballBundle(b));}
 const accessor={};Object.defineProperty(accessor,'kind',{enumerable:true,get(){throw new Error('must not invoke getter');}});assert.throws(()=>loadFootballBundle(accessor),/plain enumerable/);
 const cycle={};cycle.self=cycle;assert.throws(()=>copyFootballData(cycle),/budget/);assert.throws(()=>copyFootballData(JSON.parse('{"__proto__":{}}')),/plain enumerable/);assert.throws(()=>validateFootballMod({...starter.packs[0],entries:[{id:'code',kind:'script',data:'alert(1)'}]}));
});
test('strict match setup rejects ambiguous rosters, seed and formations',()=>{
 for(const edit of [s=>{s.seed=0;},s=>{s.teams[0].players[1]=s.teams[0].players[0];},s=>{s.teams[0].tactics.formation='missing';},s=>{s.rules.seconds=100000;},s=>{s.teams[0].players[0].role='FW';}]){const s=setup();edit(s);assert.throws(()=>validateMatchSetup(s));}
});
test('live football is seeded, finite and replayable with tactics and substitutions',()=>{
 const initial=setup(),a=createFootballMatch(initial),b=createFootballMatch(initial);
 for(let i=0;i<720;i++){stepFootball(a);stepFootball(b);}assert.equal(footballHash(a),footballHash(b));
 const before=footballHash(a);assert.throws(()=>commandFootball(a,{type:'substitute',team:0,slot:1,playerId:'sol-1'}));assert.equal(footballHash(a),before);
 commandFootball(a,{type:'tactics',team:0,tactics:{...a.management.teams[0].tactics,press:95,tempo:85,mentality:90}});
 commandFootball(a,{type:'substitute',team:0,slot:1,playerId:'sol-13'});
 assert.equal(a.players[1].rosterId,'sol-13');assert.equal(a.management.commands.length,2);
 const partial=exportFootballReplay(a);assert.equal(verifyFootballReplay(partial).complete,false);
 finish(a);const replay=exportFootballReplay(a),verified=verifyFootballReplay(replay);assert.equal(verified.status,'PASS');assert.equal(verified.complete,true);assert.deepEqual(verified.state.score,a.score);
 assert.ok(a.stats.shots[0]+a.stats.shots[1]>0);assert.ok(a.stats.passes[0]+a.stats.passes[1]>0);assert.ok(a.tick<120000);
 const corrupt=structuredClone(replay);corrupt.commands[0].command.tactics.press=20;assert.throws(()=>verifyFootballReplay(corrupt),/checksum|after full time/);
 assert.throws(()=>verifyFootballReplay({...replay,ticks:120001}));assert.throws(()=>commandFootball(a,{type:'tactics',team:0,tactics:a.management.teams[0].tactics}),/finished/);
});
test('substitution limits and command ordering fail without partial writes',()=>{
 const s=createFootballMatch(setup());for(const [slot,id]of [[1,'sol-13'],[2,'sol-14'],[5,'sol-15']])commandFootball(s,{type:'substitute',team:0,slot,playerId:id});
 const before=footballHash(s);assert.throws(()=>commandFootball(s,{type:'substitute',team:0,slot:6,playerId:'sol-16'}),/three/);assert.equal(footballHash(s),before);
 const replay=exportFootballReplay(s);replay.commands[0].tick=1;assert.throws(()=>verifyFootballReplay(replay),/order/);
});
test('condition, morale, familiarity, training and tactics change simulation inputs',()=>{
 const c=career(),p=ownClub(c).players[9],t=c.tactics;
 const fit=playerPerformance(p,t,90,'FW'),tired=playerPerformance({...p,condition:20,morale:20,sharpness:20},t,20,'FW');assert.ok(fit.speed>tired.speed);assert.ok(fit.error<tired.error);assert.ok(fit.think<tired.think);
 assert.ok(playerPerformance(p,t,90,'DF').familiarity<fit.familiarity);
 c.training={focus:'attack',load:2,talk:'demand'};const trained=trainRound(c);assert.equal(ownClub(trained).players[9].finishing,p.finishing+2);assert.ok(trained.budget<c.budget);assert.equal(c.round,0);
 const s=createFootballMatch(matchSetup(trained,'sol','neo')),x=s.players[1].hx,y=s.players[1].hy,speed=s.players[1].ability.speed;
 commandFootball(s,{type:'tactics',team:0,tactics:{...t,width:90,mentality:90,press:90}});assert.notEqual(s.players[1].hx,x);assert.notEqual(s.players[1].hy,y);assert.ok(s.players[1].ability.speed>speed);
 const original=s.players[1].ability.condition;for(let i=0;i<2300;i++)stepFootball(s);assert.ok(s.players[1].ability.condition<original);
});
test('frame collision is resolved before a goal, including the inner overlap',()=>{
 for(const [dx,z,event]of [[0,35,'post'],[69,0,'post'],[0,20,'goal']]){const s=createFootballMatch(setup());s.phase='play';s.ball={...s.ball,x:s.w/2+dx*Q,y:Q,z:z*Q,vx:0,vy:-2*Q,vz:0,owner:-1};ballPhysics(s);assert.equal(s.events.at(-1).type,event);assert.equal(s.score[0],event==='goal'?1:0);}
});
test('league has all 56 unique home/away fixtures with no club playing twice per round',()=>{
 const fixtures=fixtureList(career());assert.equal(fixtures.length,14);const pairs=new Set();for(const round of fixtures){assert.equal(new Set(round.flat()).size,8);round.forEach(pair=>pairs.add(pair.join(':')));}assert.equal(pairs.size,56);
});
test('squad operations, budget and injury restrictions are transactional',()=>{
 const c=career();selectPlayer(c,1,'sol-13');assert.equal(c.lineup[1],'sol-13');selectPlayer(c,2,'sol-13');assert.equal(c.lineup[1],'sol-3');c.injuries['sol-13']=2;assert.throws(()=>selectPlayer(c,1,'sol-13'),/fit/);autoLineup(c);assert.ok(!c.lineup.includes('sol-13'));
 const cash=c.budget;signPlayer(c,c.market[0].id);assert.ok(c.budget<cash);assert.equal(ownClub(c).players.length,19);sellPlayer(c,'free-1-0');assert.equal(ownClub(c).players.length,18);assert.throws(()=>sellPlayer(c,c.lineup[0]));improveFacilities(c);assert.equal(c.facility,1);c.budget=0;assert.throws(()=>signPlayer(c,c.market[0].id),/budget/);assert.throws(()=>trainRound(c),/unaffordable/);c.training.load=0;assert.doesNotThrow(()=>trainRound(c));
});
test('complete round uses actual matches, saves consistently and cancellation returns no results',async()=>{
 const c=trainRound(career()),pair=fixtureList(c)[0].find(p=>p.includes(c.clubId)),s=finish(createFootballMatch(matchSetup(c,...pair)));
 let yields=0;assert.equal(await playOtherFixtures(c,s,async()=>{yields++;},()=>yields>0),null);assert.equal(c.round,0);
 const results=await playOtherFixtures(c,s,async()=>{},()=>false),done=finishRound(c,results,s);assert.equal(done.round,1);assert.equal(done.results.length,4);assert.ok(standings(done).every(r=>r.played===1));assert.deepEqual(importCareer(exportCareer(done)),done);
 const save=exportCareer(done);save.career.budget++;assert.throws(()=>importCareer(save),/checksum/);
 assert.throws(()=>finishRound(c,[],s),/mismatch/);assert.throws(()=>nextSeason(done),/Finish/);
});
test('save structural validation rejects invalid game state even with a new checksum',()=>{
 for(const edit of [c=>{c.round=1;},c=>{c.budget=NaN;},c=>{c.lineup[0]='missing';},c=>{c.training.focus='invalid';},c=>{c.squads[0].name='Changed';},c=>{c.market[1].id=c.market[0].id;},c=>{c.injuries.unknown=2;}]){const c=career();edit(c);assert.throws(()=>importCareer(exportCareer(c)));}
});

test('a full short-match season settles 56 fixtures and rolls into a new season',async()=>{
 const bundle=structuredClone(starter);bundle.packs.at(-1).entries.find(e=>e.data.kind==='qsol.football-rules.v1').data.value.seconds=20;
 let c=createCareer(bundle,'sol');
 for(let round=0;round<14;round++){
   autoLineup(c);const prepared=trainRound(c),pair=fixtureList(prepared)[round].find(p=>p.includes(c.clubId)),match=finish(createFootballMatch(matchSetup(prepared,...pair)));
   const results=await playOtherFixtures(prepared,match,async()=>{},()=>false);c=finishRound(prepared,results,match);
 }
 assert.equal(c.results.length,56);assert.ok(standings(c).every(r=>r.played===14));assert.deepEqual(importCareer(exportCareer(c)),c);
 const savedPlayers=structuredClone(ownClub(c).players);nextSeason(c);assert.equal(c.season,2);assert.equal(c.round,0);assert.equal(c.results.length,0);assert.deepEqual(ownClub(c).players,savedPlayers);assert.equal(c.lastReplay,null);
});

test('custom squad IDs do not collide with generated recruitment candidates',()=>{
 const bundle=structuredClone(starter);bundle.packs[0].entries[0].data.value.players[0].id='free-1-0';const c=createCareer(bundle,'sol');assert.equal(c.market[0].id,'free-1-0-1');assert.doesNotThrow(()=>importCareer(exportCareer(c)));
});
test('career copy budget accommodates large custom leagues without widening pack budgets',()=>{
 const large={text:'x'.repeat(8192),rows:Array.from({length:40},()=> 'y'.repeat(8192))};assert.throws(()=>copyFootballData(large),/byte budget/);assert.deepEqual(copyFootballData(large,{maxBytes:1048576,maxNodes:100000}),large);assert.throws(()=>copyFootballData(large,{maxBytes:1048577}),/budget/);
});

test('injuries and reserve sales preserve a legal fit eleven',()=>{
 const c=trainRound(career()),club=ownClub(c);c.injuries[club.players[11].id]=2;
 // Leave exactly ten fit outfield players. Their remaining keeper must stay fit.
 for(const p of club.players.slice(12))c.injuries[p.id]=2;
 const pair=fixtureList(c)[0].find(p=>p.includes(c.clubId)),team=pair[0]===c.clubId?0:1;
 const s=createFootballMatch(matchSetup(c,...pair));s.phase='fulltime';for(const p of s.players)p.ability.condition=20;
 const results=fixtureList(c)[0].map(([home,away])=>({round:0,home,away,score:[0,0]}));
 // Repeat the post-match lottery across seeds; it must never remove the last fit XI.
 for(let seed=1;seed<=100;seed++){const candidate=structuredClone(c);candidate.seed=seed;const done=finishRound(candidate,results,s);assert.equal(ownClub(done).players.filter(p=>!done.injuries[p.id]).length,11);assert.doesNotThrow(()=>autoLineup(done));}
 // A fit reserve cannot be sold if its role is needed to field a legal eleven.
 c.lineup[1]=club.players[12].id;assert.throws(()=>sellPlayer(c,club.players[1].id),/fit/);
 assert.equal(s.management.teams[team].players[0].role,'GK');
});

test('custom formation defender roles drive marking, including the fifth defender',()=>{
 const initial=setup();initial.teams[0].tactics.formation='five-three-two';const s=createFootballMatch(initial),p=s.players[5];assert.equal(p.positionRole,'DF');
 s.ball.owner=11;s.ball.x=s.w/2;s.ball.y=s.h/2;
 for(const foe of s.players.filter(q=>q.team===1)){foe.x=10*Q;foe.y=10*Q;}
 s.players[12].x=p.x+80*Q;s.players[12].y=p.y+20*Q;
 const midfield=structuredClone(s);midfield.players[5].positionRole='MF';
 aiIntent(s,p);aiIntent(midfield,midfield.players[5]);assert.ok(p.tx>midfield.players[5].tx,'the additional defender closes the nearby threat');
});

test('reordered club squads produce legal user and AI elevens and settle every fixture',async()=>{
 const bundle=structuredClone(starter);bundle.packs.at(-1).entries.find(e=>e.data.kind==='qsol.football-rules.v1').data.value.seconds=20;
 for(const pack of bundle.packs)for(const entry of pack.entries)if(entry.data.kind==='qsol.football-club.v1'){
   const players=entry.data.value.players;[players[1],players[11]]=[players[11],players[1]];[players[0],players[5]]=[players[5],players[0]];
 }
 loadFootballBundle(bundle);
 const illegal=structuredClone(bundle),roster=illegal.packs[0].entries[0].data.value.players;roster.filter(p=>p.role!=='GK').slice(0,7).forEach(p=>p.role='GK');assert.throws(()=>loadFootballBundle(illegal),/Ten outfield/);
 for(const club of loadFootballBundle(bundle).content.clubs){const c=createCareer(bundle,club.id),players=c.lineup.map(id=>ownClub(c).players.find(p=>p.id===id));assert.equal(players[0].role,'GK');assert.ok(players.slice(1).every(p=>p.role!=='GK'));assert.equal(new Set(c.lineup).size,11);}
 const c=trainRound(createCareer(bundle,'sol')),pair=fixtureList(c)[0].find(p=>p.includes(c.clubId));const match=finish(createFootballMatch(matchSetup(c,...pair)));
 const results=await playOtherFixtures(c,match,async()=>{},()=>false);assert.equal(finishRound(c,results,match).round,1);
});

test('free recovery allows a debt-funded club to play the next revenue-earning fixture',async()=>{
 const bundle=structuredClone(starter),rules=bundle.packs.at(-1).entries.find(e=>e.data.kind==='qsol.football-rules.v1').data.value;rules.startingBudget=0;rules.seconds=20;
 let c=createCareer(bundle,'vio');c.training.load=0;
 const prepared=trainRound(c),pair=fixtureList(c)[0].find(p=>p.includes(c.clubId));assert.notEqual(pair[0],c.clubId);
 const match=finish(createFootballMatch(matchSetup(prepared,...pair)));c=finishRound(prepared,await playOtherFixtures(prepared,match,async()=>{},()=>false),match);assert.ok(c.budget<0);
 const before=structuredClone(c),recovered=trainRound(c);assert.equal(recovered.budget,c.budget);assert.deepEqual(c,before);
 const nextPair=fixtureList(c)[1].find(p=>p.includes(c.clubId)),next=finish(createFootballMatch(matchSetup(recovered,...nextPair)));
 assert.equal(finishRound(recovered,await playOtherFixtures(recovered,next,async()=>{},()=>false),next).round,2);
 c.training.load=1;assert.throws(()=>trainRound(c),/unaffordable/);
 // Modded training can also be free at a nonzero load.
 c.bundle.packs.at(-1).entries.find(e=>e.data.kind==='qsol.football-rules.v1').data.value.trainingCost=0;assert.equal(trainRound(c).budget,c.budget);
});

test('changing tactical intensity cannot refund accumulated fatigue and replays remain exact',()=>{
 const initial=setup();initial.teams[0].tactics.press=100;initial.teams[0].tactics.tempo=100;
 const s=createFootballMatch(initial);while(s.phase!=='halftime')stepFootball(s);
 const elapsed=s.elapsed,before=s.players[1].ability.condition,person=s.management.teams[0].players[1];
 const highFatigue=elapsed/(s.config.seconds*60)*initial.rules.fatigue*2*(1.3-person.stamina/200);
 commandFootball(s,{type:'tactics',team:0,tactics:{...s.management.teams[0].tactics,press:0,tempo:0}});
 assert.ok(s.players[1].ability.condition<=before,'lowering intensity must not restore condition without a tick');
 assert.equal(s.players[1].ability.condition,Math.round(Math.max(15,person.condition-highFatigue)));
 const atSwitch=s.players[1].ability.condition;for(let i=0;i<90;i++)stepFootball(s);assert.equal(s.elapsed,elapsed);assert.equal(s.players[1].ability.condition,atSwitch,'stoppage time adds no fatigue');
 while(s.elapsed<elapsed+600)stepFootball(s);
 commandFootball(s,{type:'tactics',team:0,tactics:{...s.management.teams[0].tactics,press:100,tempo:100}});
 const expected=highFatigue+600/(s.config.seconds*60)*initial.rules.fatigue*.5*(1.3-person.stamina/200);
 assert.equal(s.players[1].ability.condition,Math.round(Math.max(15,person.condition-expected)),'new intensity applies only after the change');
 const beforeInvalid=footballHash(s);assert.throws(()=>commandFootball(s,{type:'tactics',team:0,tactics:{...s.management.teams[0].tactics,press:101}}));assert.equal(footballHash(s),beforeInvalid);
 const teammateCondition=s.players[2].ability.condition;
 commandFootball(s,{type:'substitute',team:0,slot:1,playerId:'sol-13'});assert.equal(s.players[1].ability.condition,initial.teams[0].club.players[12].condition);assert.equal(s.players[2].ability.condition,teammateCondition);
 assert.equal(verifyFootballReplay(exportFootballReplay(s)).status,'PASS');finish(s);assert.equal(verifyFootballReplay(exportFootballReplay(s)).complete,true);
});

test('late low-intensity instructions preserve the condition saved after a match',async()=>{
 const bundle=structuredClone(starter),rules=bundle.packs.at(-1).entries.find(e=>e.data.kind==='qsol.football-rules.v1').data.value;rules.seconds=20;rules.fatigue=30;
 const c=trainRound(createCareer(bundle,'sol'));c.tactics.press=100;c.tactics.tempo=100;
 const pair=fixtureList(c)[0].find(p=>p.includes(c.clubId)),team=pair[0]===c.clubId?0:1,s=createFootballMatch(matchSetup(c,...pair));
 while(s.elapsed<s.config.seconds*60-1)stepFootball(s);
 const person=s.management.teams[team].players[1],spent=s.elapsed;
 commandFootball(s,{type:'tactics',team,tactics:{...c.tactics,press:0,tempo:0}});finish(s);
 const expected=Math.round(Math.max(15,person.condition-rules.fatigue*(2*spent+.5*(s.elapsed-spent))/(s.config.seconds*60)*(1.3-person.stamina/200)));
 assert.equal(s.players[team*11+1].ability.condition,expected);
 const done=finishRound(c,await playOtherFixtures(c,s,async()=>{},()=>false),s);assert.equal(ownClub(done).players.find(p=>p.id===person.id).condition,expected);assert.deepEqual(importCareer(exportCareer(done)),done);
});
