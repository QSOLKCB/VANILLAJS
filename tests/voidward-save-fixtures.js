// SPDX-License-Identifier: Apache-2.0
// Synthetic admission-boundary fixtures, not natural-play or balance evidence.
import fs from 'node:fs/promises';
import {PACK_FILES,parsePack} from '../demos/4x-game-lab/voidward/js/content.js';
import {createEngine} from '../demos/4x-game-lab/voidward/js/core.js';
import {encodeSaveEnvelope} from '../demos/4x-game-lab/voidward/js/save-codec.js';
const source = async () => Object.fromEntries(await Promise.all(PACK_FILES.map(async f=>[f+'.txt',await fs.readFile(new URL('../demos/4x-game-lab/voidward/mods/frontier/'+f+'.txt',import.meta.url),'utf8')])));
export async function createSaveFixture({maximal=false}={}) {
  const raw=await source();
  if(maximal){
    raw['rules.txt']=raw['rules.txt'].replace('columns = 6','columns = 8').replace('rows = 5','rows = 8').replace('planetsPerSystem = 2','planetsPerSystem = 4').replace('facilityLimit = 3','facilityLimit = 10');
    raw['system_names.txt']=Array.from({length:64},(_,i)=>`Star ${i}`).join('\n');
    raw['planet_names.txt']=Array.from({length:256},(_,i)=>`World ${i}`).join('\n');
    raw['map.txt']=Array.from({length:64},(_,id)=>`${id} | ${[id%8?id-1:null,id%8<7?id+1:null,id>=8?id-8:null,id<56?id+8:null].filter(x=>x!==null).join(',')} | 0`).join('\n');
    raw['empire_names.txt']=Array.from({length:6},(_,i)=>`Empire ${i}`).join('\n');
    raw['empires.txt']=Array.from({length:6},(_,i)=>`${i} | E${i} | #778899 | #aabbcc | ${i*10} | Boundary fixture.`).join('\n');
    raw['hulls.txt']=raw['hulls.txt'].split('\n').map(l=>l.startsWith('#')||!l.trim()?l:l.split('|').map((v,i)=>i===2?' * ':v).join('|')).join('\n');
    const starting=raw['ships.txt'].split('\n').filter(l=>l.trim()&&!l.startsWith('#')&&Number(l.split('|')[0])===0);
    raw['ships.txt']=Array.from({length:6},(_,i)=>starting.map(l=>l.replace(/^0\s*\|/,`${i} |`)).join('\n')).join('\n');
    const hull='h'.repeat(40),part='p'.repeat(40);
    raw['hulls.txt']+=`\n${hull} | Boundary hull | * | 40 | 1 | 1 | 1 | industry | 1 | 0,-40;30,30;-30,30`;
    raw['components.txt']+=`\n${part} | Boundary engine | engine | 1 | 1 | 1 | 0 | 1 | propulsion | 1 | Boundary fixture.`;
    const originals=raw['buildings.txt'].split('\n').filter(l=>l.trim()&&!l.startsWith('#'));
    raw['buildings.txt']=originals.concat(Array.from({length:128-originals.length},(_,i)=>`${('facility-'+i).padEnd(40,'z')} | Facility ${i} | 1 | 1 | 0 | 0 | 0 | 0 | 0 | Boundary fixture.`)).join('\n');
  }
  const pack=parsePack(raw),engine=createEngine(pack),state=engine.createGame();state.turn=31;
  if(maximal){
    const hull='h'.repeat(40),part='p'.repeat(40),name='\u0001'.repeat(32);
    const design=id=>({id,name,hull,parts:Array(40).fill(part)}),stats=engine.designStats(design(0));
    for(const empire of state.empires){empire.designs=Array.from({length:24},(_,id)=>design(id));empire.known=state.systems.map(s=>s.id);}
    for(const planet of state.planets){planet.owner=planet.id%6;planet.pop=20;planet.buildings=Object.fromEntries(Object.keys(pack.buildings).map(k=>[k,10]));planet.queue=Array.from({length:5},()=>({kind:'ship',design:design(23),name:'\u0001'.repeat(200),cost:stats.cost,work:stats.work,done:0}));}
    state.fleets=[];state.groups=[];
    for(let owner=0;owner<6;owner++)for(let i=0;i<60;i++)state.fleets.push({id:state.nextId++,owner,system:pack.empires[owner].home,name:'\u0001'.repeat(200),design:design(23),hp:stats.hp,path:[],order:{type:'hold',target:null,origin:pack.empires[owner].home},refit:{design:design(23),cost:1+Math.ceil(stats.cost/10),work:Math.ceil(stats.work/2),done:0}});
    state.log=Array.from({length:100},()=>({turn:31,text:'\u0001'.repeat(1200),kind:'info'}));
    state.battles=Array.from({length:30},()=>({turn:31,system:0,participants:[0,1,2,3,4,5],losses:[60,60,60,60,60,60],captured:Array(4).fill('\u0001'.repeat(200)),damage:10000000,forces:Array.from({length:6},(_,owner)=>({owner,ships:60,attack:10000000}))}));
  }
  const completed=state.planets.length+state.empires.length*pack.rules.fleetLimit;
  state.reports=Array.from({length:30},(_,i)=>({turn:31-i,income:state.empires.map(e=>engine.income(state,e.id)),completed:Array.from({length:completed},()=>({owner:0,planet:0,name:maximal?'\u0001'.repeat(200):'A\n'.repeat(100)})),discovered:[],battles:0}));
  engine.validateState(state);
  const envelope={kind:'voidward.save.v1',extension:null,pack:pack.raw,state};
  return {envelope,expectedState:state,engine,pack};
}
export async function createLargeSaveFixture(){const {envelope,expectedState:state,pack}=await createSaveFixture();return {pack,state,text:encodeSaveEnvelope(envelope)};}
