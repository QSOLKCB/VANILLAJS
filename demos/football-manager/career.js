// SPDX-License-Identifier: Apache-2.0
// Demo-owned world and progression. Money is fictional club credits.
import {loadFootballBundle,validatePlayer,validateTactics,copyFootballData} from '../../modules/mod-football/index.js';
import {createFootballMatch,stepFootball,exportFootballReplay,verifyFootballReplay,clamp,random,hash} from '../../modules/football/index.js';
export const SAVE_KIND='qsol.touchline-career.v1';
export function schedule(ids){
  const ring=[...ids],rounds=[];
  for(let r=0;r<ring.length-1;r++){
    const fixtures=[];for(let i=0;i<ring.length/2;i++){const pair=[ring[i],ring[ring.length-1-i]];fixtures.push((r+i)%2?pair.reverse():pair);}
    rounds.push(fixtures);ring.splice(1,0,ring.pop());
  }
  return [...rounds,...rounds.map(round=>round.map(([a,b])=>[b,a]))];
}
export function standings(c){
  const rows=c.squads.map(club=>({id:club.id,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0}));
  for(const r of c.results){const a=rows.find(x=>x.id===r.home),b=rows.find(x=>x.id===r.away);a.played++;b.played++;a.gf+=r.score[0];a.ga+=r.score[1];b.gf+=r.score[1];b.ga+=r.score[0];if(r.score[0]===r.score[1]){a.drawn++;b.drawn++;a.points++;b.points++;}else{const winner=r.score[0]>r.score[1]?a:b,loser=winner===a?b:a;winner.won++;winner.points+=3;loser.lost++;}}
  return rows.sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.id.localeCompare(b.id));
}
export function fixtureList(c){return schedule(c.squads.map(s=>s.id));}
export function ownClub(c){return c.squads.find(s=>s.id===c.clubId);}
export function log(c,message){c.log.unshift(message);c.log.length=Math.min(24,c.log.length);}
function marketId(season,index,existing){const base=`free-${season}-${index}`;let id=base,n=0;while(existing.includes(id))id=base+'-'+(++n);return id;}
function market(seed,season,existing=[]){const rng={rng:(seed+season*31337)>>>0||1};return Array.from({length:6},(_,i)=>({id:marketId(season,i,existing),name:['Sage Quinn','River Lane','Ellis Moss','Sky Arden','Drew Stone','Finley West'][i],role:['DF','MF','FW','GK','DF','MF'][i],...Object.fromEntries(['pace','passing','finishing','defending','keeping','stamina'].map(k=>[k,48+random(rng)%37])),condition:90,morale:65,sharpness:62}));}
function startingEleven(players){
  const keeper=players.find(p=>p.role==='GK'),outfield=players.filter(p=>p.role!=='GK').slice(0,10);
  if(!keeper||outfield.length!==10)throw new TypeError('A goalkeeper and ten outfield players are required');
  return [keeper,...outfield];
}
export function createCareer(bundle,clubId,seed=1988){
  const validated=loadFootballBundle(bundle),content=validated.content,club=content.clubs.find(c=>c.id===clubId);if(!club)throw new TypeError('Choose a club');
  if(!Number.isInteger(seed)||seed<1||seed>4294967295)throw new RangeError('Invalid career seed');
  const formation=content.formations.find(f=>f.id==='four-four-two')||content.formations[0];
  return {kind:SAVE_KIND,bundle:validated.bundle,seed,season:1,clubId,round:0,budget:content.rules.startingBudget,board:60,facility:0,cohesion:65,training:{focus:'balanced',load:1,talk:'encourage'},tactics:{formation:formation.id,mentality:50,press:50,tempo:50,width:50},lineup:startingEleven(club.players).map(p=>p.id),squads:structuredClone(content.clubs),injuries:{},results:[],market:market(seed,1,content.clubs.flatMap(c=>c.players.map(p=>p.id))),log:['Welcome to the touchline. Finish in the top half and keep the club solvent.'],lastReplay:null};
}
export function selectPlayer(c,slot,id){
  if(!Number.isInteger(slot)||slot<0||slot>10)throw new TypeError('Unknown lineup slot');
  const player=ownClub(c).players.find(p=>p.id===id);if(!player||c.injuries[id]>0||(slot===0)!==(player.role==='GK'))throw new TypeError('Select a fit player in a compatible slot');
  const previous=c.lineup.indexOf(id),old=c.lineup[slot];c.lineup[slot]=id;if(previous>=0)c.lineup[previous]=old;
}
export function autoLineup(c){
  const f=loadFootballBundle(c.bundle).content.formations.find(f=>f.id===c.tactics.formation),available=ownClub(c).players.filter(p=>!c.injuries[p.id]);
  const used=new Set();const ids=f.slots.map((slot,i)=>{
    const candidates=available.filter(p=>!used.has(p.id)&&(i===0)===(p.role==='GK')).sort((a,b)=>((b.role===slot[2]?30:0)+b.condition+b.sharpness)-((a.role===slot[2]?30:0)+a.condition+a.sharpness)||a.id.localeCompare(b.id));
    if(!candidates.length)throw new Error('Not enough fit players; sign a replacement.');used.add(candidates[0].id);return candidates[0].id;
  });c.lineup=ids;
}
// This compact demo has no emergency loan market: retain a legal fit XI.
function canSideline(c,player){const role=player.role==='GK';return ownClub(c).players.filter(p=>!c.injuries[p.id]&&(p.role==='GK')===role).length>(role?1:10);}
export function trainRound(input){
  const c=structuredClone(input),rules=loadFootballBundle(c.bundle).content.rules,rng={rng:(c.seed+c.season*10007+c.round*7919)>>>0||1};
  for(const [id,left] of Object.entries(c.injuries)){if(left<=1)delete c.injuries[id];else c.injuries[id]--;}
  const cost=rules.trainingCost*c.training.load;
  if(cost>0&&c.budget<cost)throw new Error('Training is unaffordable. Choose recovery (load 0) or sell a player.');
  c.budget-=cost;
  for(const club of c.squads)for(const p of club.players){
    const own=club.id===c.clubId,load=own?c.training.load:1;
    p.condition=clamp(p.condition+18+c.facility*(own?3:0)-load*7,1,100);
    p.sharpness=clamp(p.sharpness+load*4-3,1,100);
    if(own){
      p.morale=clamp(p.morale+(c.training.talk==='encourage'?4:c.training.talk==='demand'?(p.morale>=65?2:-7):0),1,100);
      if(c.training.talk==='demand')p.sharpness=clamp(p.sharpness+3,1,100);
      const attributes={balanced:['passing','defending'],attack:['finishing','pace'],defence:['defending','keeping'],possession:['passing','stamina']}[c.training.focus];
      if(load>0)for(const key of attributes)p[key]=clamp(p[key]+(load===2?2:1),1,100);
      // Injury only sidelines reserves here; starters may pick up a knock after the game.
      if(load===2&&!c.lineup.includes(p.id)&&!c.injuries[p.id]&&random(rng)%100<6&&canSideline(c,p))c.injuries[p.id]=2;
    }
  }
  c.cohesion=clamp(c.cohesion+2+c.training.load,1,100);
  return c;
}
export function matchSetup(c,home,away){
  const content=loadFootballBundle(c.bundle).content;
  return {seed:((c.seed+c.season*101+c.round*1009+c.squads.findIndex(s=>s.id===home)*73)>>>0)||1,rules:content.rules,formations:content.formations,weather:(c.round+c.seed)%4===0?'rain':'clear',teams:[home,away].map(id=>{
    const club=c.squads.find(s=>s.id===id),own=id===c.clubId;
    const players=own?c.lineup.map(id=>club.players.find(p=>p.id===id)):startingEleven(club.players);
    if(own&&players.some(p=>c.injuries[p.id]>0))throw new Error('Replace injured starters before kick-off.');
    return {club,players,tactics:own?c.tactics:{formation:(content.formations.find(f=>f.id==='four-four-two')||content.formations[0]).id,mentality:club.attack,press:club.press,tempo:100-club.pass,width:50},cohesion:own?c.cohesion:70};
  })};
}
export async function playOtherFixtures(c,live,yieldTask,cancelled){
  const results=[];
  for(const [home,away] of fixtureList(c)[c.round]){
    if(cancelled())return null;
    let match;
    if(home===c.clubId||away===c.clubId)match=live;
    else {match=createFootballMatch(matchSetup(c,home,away));while(match.phase!=='fulltime'){for(let i=0;i<600&&match.phase!=='fulltime';i++)stepFootball(match);await yieldTask();if(cancelled())return null;}}
    results.push({round:c.round,home,away,score:[...match.score]});
  }
  return results;
}
export function finishRound(input,results,match){
  if(match.phase!=='fulltime')throw new Error('Match still playing');
  const c=structuredClone(input),rules=loadFootballBundle(c.bundle).content.rules;
  const expected=fixtureList(c)[c.round];if(!expected||results.length!==expected.length||results.some((r,i)=>r.home!==expected[i][0]||r.away!==expected[i][1]||r.round!==c.round))throw new TypeError('Fixture result mismatch');
  const own=results.find(r=>r.home===c.clubId||r.away===c.clubId),team=own.home===c.clubId?0:1,delta=own.score[team]-own.score[1-team],club=ownClub(c);
  const wages=club.players.reduce((sum,p)=>sum+Math.round((p.pace+p.passing+p.finishing+p.defending+p.keeping+p.stamina)/6)*rules.wage,0);
  const revenue=(team===0?rules.gate+Math.round(rules.gate*c.facility*.1):0)+(delta>0?rules.prize:delta===0?Math.round(rules.prize/3):0);
  c.budget+=revenue-wages;c.board=clamp(c.board+(delta>0?5:delta===0?0:-4)+(c.budget<0?-5:0),0,100);
  const managed=match.management.teams[team];c.tactics={...managed.tactics};c.lineup=managed.players.map(p=>p.id);
  const rng={rng:(c.seed+c.round*433+c.season*67)>>>0||1};
  for(const p of club.players){
    const slot=managed.players.findIndex(q=>q.id===p.id),used=managed.used.includes(p.id);
    if(slot>=0)p.condition=Math.round(match.players[team*11+slot].ability.condition);
    else if(used)p.condition=clamp(p.condition-rules.fatigue,1,100);
    p.morale=clamp(p.morale+(delta>0?6:delta===0?1:-5)+(used?0:-1),1,100);
    if(used&&p.condition<55&&random(rng)%100<18&&canSideline(c,p))c.injuries[p.id]=2;
  }
  c.results.push(...results);c.lastReplay=exportFootballReplay(match);c.round++;
  log(c,`${own.score[team]}–${own.score[1-team]} · ${delta>0?'Three points earned':delta===0?'A point on the board':'Time to regroup'}. Income ${revenue.toLocaleString()} · wages ${wages.toLocaleString()} credits.`);
  if(c.round===fixtureList(c).length){const rank=standings(c).findIndex(r=>r.id===c.clubId)+1;log(c,`Season ${c.season} complete: ${rank}/${c.squads.length}. ${rank<=c.squads.length/2&&c.budget>=0?'Board objective achieved.':'The board wants improvement next season.'}`);}
  return c;
}
export function transferPrice(c,p){const r=loadFootballBundle(c.bundle).content.rules;return Math.round(r.transferCost*(p.pace+p.passing+p.finishing+p.defending+p.keeping+p.stamina)/360);}
export function signPlayer(c,id){const p=c.market.find(p=>p.id===id);if(!p)throw new TypeError('Player unavailable');const club=ownClub(c),price=transferPrice(c,p);if(club.players.length>=22)throw new Error('Squad limit: 22. Sell a reserve first.');if(c.budget<price)throw new Error('Insufficient transfer budget');club.players.push({...p});c.market=c.market.filter(q=>q.id!==id);c.budget-=price;c.cohesion=clamp(c.cohesion-4,1,100);log(c,`${p.name} signed for ${price.toLocaleString()} credits.`);}
export function sellPlayer(c,id){const club=ownClub(c),p=club.players.find(p=>p.id===id);if(!p||c.lineup.includes(id)||club.players.length<=16||p.role==='GK'&&club.players.filter(q=>q.role==='GK').length<=2)throw new Error('Keep 16 players, two keepers and the starting eleven.');if(!c.injuries[id]&&!canSideline(c,p))throw new Error('Keep a fit goalkeeper and ten fit outfield players.');club.players=club.players.filter(q=>q.id!==id);delete c.injuries[id];const price=Math.round(transferPrice(c,p)*.65);c.budget+=price;c.cohesion=clamp(c.cohesion-2,1,100);log(c,`${p.name} sold for ${price.toLocaleString()} credits.`);}
export function improveFacilities(c){const price=75000*(c.facility+1);if(c.facility>=3||c.budget<price)throw new Error('Upgrade unavailable or unaffordable');c.budget-=price;c.facility++;log(c,'Recovery facilities upgraded. Better weekly recovery and home attendance.');}
export function nextSeason(c){if(c.round!==fixtureList(c).length)throw new Error('Finish the season first');c.season++;c.round=0;c.results=[];c.lastReplay=null;c.market=market(c.seed,c.season,c.squads.flatMap(s=>s.players.map(p=>p.id)));c.injuries={};c.budget+=50000;c.board=clamp(c.board+5,0,100);log(c,'New season. Sponsorship adds 50,000 credits.');}
export function exportCareer(c){return {kind:'qsol.touchline-save.v1',checksum:hash(c),career:structuredClone(c)};}
export function importCareer(input){
  const envelope=copyFootballData(input,{maxBytes:1048576,maxNodes:100000}),c=envelope.career;
  if(Object.keys(envelope).sort().join()!=='career,checksum,kind'||envelope.kind!=='qsol.touchline-save.v1'||!c||hash(c)!==envelope.checksum)throw new TypeError('Save checksum mismatch');
  const template=createCareer(c.bundle,c.clubId,c.seed);
  if(Object.keys(c).sort().join()!==Object.keys(template).sort().join()||c.kind!==SAVE_KIND)throw new TypeError('Unsupported career fields');
  const int=(n,lo,hi)=>{if(!Number.isSafeInteger(n)||n<lo||n>hi)throw new TypeError('Invalid career number');};
  for(const [key,lo,hi] of [['season',1,10000],['round',0,30],['budget',-1000000000,1000000000],['board',0,100],['facility',0,3],['cohesion',1,100]])int(c[key],lo,hi);
  validateTactics(c.tactics);if(!loadFootballBundle(c.bundle).content.formations.some(f=>f.id===c.tactics.formation))throw new TypeError('Missing saved formation');
  if(!c.training||Object.keys(c.training).sort().join()!=='focus,load,talk'||!['balanced','attack','defence','possession'].includes(c.training.focus)||!['encourage','demand','calm'].includes(c.training.talk))throw new TypeError('Invalid training');int(c.training.load,0,2);
  if(!Array.isArray(c.squads)||c.squads.length!==template.squads.length)throw new TypeError('Invalid clubs');
  for(let i=0;i<c.squads.length;i++){const {players,...club}=c.squads[i],{players:_,...original}=template.squads[i];if(JSON.stringify(club)!==JSON.stringify(original)||!Array.isArray(players)||players.length<16||players.length>22)throw new TypeError('Invalid saved squad');players.forEach(validatePlayer);if(players.filter(p=>p.role==='GK').length<2)throw new TypeError('Two keepers required');if(players.filter(p=>p.role!=='GK').length<10)throw new TypeError('Ten outfield players required');}
  const all=c.squads.flatMap(c=>c.players),ids=all.map(p=>p.id);if(new Set(ids).size!==ids.length)throw new TypeError('Duplicate player');
  if(!Array.isArray(c.lineup)||c.lineup.length!==11||new Set(c.lineup).size!==11||c.lineup.some((id,i)=>{const p=ownClub(c).players.find(p=>p.id===id);return !p||(i===0)!==(p.role==='GK');}))throw new TypeError('Invalid lineup');
  if(!c.injuries||Array.isArray(c.injuries)||typeof c.injuries!=='object')throw new TypeError('Invalid injuries');for(const [id,left]of Object.entries(c.injuries)){if(!ids.includes(id))throw new TypeError('Unknown injured player');int(left,1,2);}
  const fixtures=fixtureList(c);if(c.round>fixtures.length||!Array.isArray(c.results)||c.results.length!==c.round*c.squads.length/2)throw new TypeError('Incomplete saved round');
  c.results.forEach((r,i)=>{const round=Math.floor(i/(c.squads.length/2)),pair=fixtures[round][i%(c.squads.length/2)];if(Object.keys(r).sort().join()!=='away,home,round,score'||r.round!==round||r.home!==pair[0]||r.away!==pair[1]||!Array.isArray(r.score)||r.score.length!==2)throw new TypeError('Invalid result');r.score.forEach(n=>int(n,0,1000));});
  if(!Array.isArray(c.market)||c.market.length>6)throw new TypeError('Invalid market');c.market.forEach(validatePlayer);if(new Set([...ids,...c.market.map(p=>p.id)]).size!==ids.length+c.market.length)throw new TypeError('Duplicate market player');
  if(!Array.isArray(c.log)||c.log.length>24||c.log.some(s=>typeof s!=='string'||s.length>300))throw new TypeError('Invalid club news');
  if(c.lastReplay!==null){const verified=verifyFootballReplay(c.lastReplay);if(!verified.complete)throw new TypeError('Saved match must be complete');}
  return c;
}
