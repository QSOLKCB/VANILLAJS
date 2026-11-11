// SPDX-License-Identifier: Apache-2.0
// Demo rules: exact ALIEN MATH routes and fractional production, not a core API.
import {ExactGraph,breadthFirst} from '../../modules/exact-graph/index.js';
import {ExactRational} from '../../modules/exact-rational/index.js';
import {nextRandom,uint32} from '../../modules/integer-math/index.js';

export const REPLAY_KIND='qsol.4x-replay.v1';
export const MAX_REPLAY_BYTES=131072;
export const MAX_COMMANDS=1024;
const N=16,MAX_TURNS=80,SCIENCE_GOAL=120,MAX_STOCK=100000;
const names=['Aster','Vela','Nacre','Iona','Morrow','Lyra','Orin','Thale','Eos','Nox','Sable','Kora','Mira','Solis','Rhea','Umbra'];
const rat=n=>new ExactRational(n);
const floor=r=>Number(r.numerator/r.denominator);
const ceil=r=>Number((r.numerator+r.denominator-1n)/r.denominator);
function integer(value,min,max,label){
  if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<min||value>max)throw new RangeError(label+' out of range');
  return value;
}
// Validate own data fields before reading values; imported JSON cannot add rules.
function record(value,keys){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
    ![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError('Plain data record required');
  const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(value);
  if(actual.length!==keys.length||!keys.every(k=>Object.hasOwn(descriptors,k)&&Object.hasOwn(descriptors[k],'value')))
    throw new TypeError('Unexpected or missing fields');
}
function canonicalCommand(input){
  if(!input||typeof input!=='object')throw new TypeError('Command record required');
  const typeDescriptor=Object.getOwnPropertyDescriptor(input,'type');
  if(!typeDescriptor||!Object.hasOwn(typeDescriptor,'value'))throw new TypeError('Command type required');
  const type=typeDescriptor.value;
  if(type==='endTurn'){record(input,['type']);return {type};}
  if(type==='research'){
    record(input,['type','field']);
    if(!['industry','weapons','navigation'].includes(input.field))throw new RangeError('Unknown research field');
    return {type,field:input.field};
  }
  if(type==='send'){
    record(input,['type','from','to','count']);
    return {type,from:integer(input.from,0,N-1,'Source'),to:integer(input.to,0,N-1,'Target'),count:integer(input.count,1,100,'Fleet size')};
  }
  if(!['survey','colonize','mine','lab','build'].includes(type))throw new RangeError('Unknown command');
  record(input,type==='build'?['type','system','count']:['type','system']);
  const result={type,system:integer(input.system,0,N-1,'System')};
  if(type==='build')result.count=integer(input.count,1,20,'Ship count');
  return result;
}
const colonies=(s,owner)=>s.systems.filter(system=>system.owner===owner);
function message(s,text){s.log.push(text);if(s.log.length>40)s.log.shift();}
function reveal(s,graph,id){s.systems[id].discovered=true;s.systems[id].surveyed=true;for(const next of graph.adjacency[id])s.systems[next].discovered=true;}
function income(s){
  let ore=rat(0),science=0;
  for(const system of colonies(s,'player')){
    const base=rat(3+system.mine*system.richness);
    ore=ore.add(base.multiply(new ExactRational(4+s.research.industry,4)));
    science+=1+system.lab*2;
  }
  return {ore,science};
}
function spend(s,amount){
  const price=rat(amount);
  if(s.ore.compare(price)<0)throw new RangeError('Not enough ore (need '+amount+')');
  s.ore=s.ore.subtract(price);
}
function owned(s,id){
  const system=s.systems[id];
  if(system.owner!=='player')throw new RangeError('Select one of your colonies');
  if(system.acted)throw new RangeError('This colony already acted this turn');
  return system;
}
function route(s,graph,from,to){
  // Only friendly intermediate systems can supply a fleet. Destination may be hostile.
  const edges=graph.edges.filter(([a,b])=>(s.systems[a].owner==='player'||a===to)&&(s.systems[b].owner==='player'||b===to));
  const tree=breadthFirst(new ExactGraph(N,edges),from);
  if(tree.depth[to]<0)return [];
  const result=[to];while(result[0]!==from)result.unshift(tree.parent[result[0]]);return result;
}
function battle(s,graph,from,to,count,attacker){
  const source=s.systems[from],target=s.systems[to],weapons=attacker==='player'?s.research.weapons:0;
  const defenceLevel=target.owner==='player'?s.research.weapons:0;
  const attack=rat(count).multiply(new ExactRational(4+weapons,4));
  const defence=rat(target.ships+2).multiply(new ExactRational(4+defenceLevel,4));
  source.ships-=count;
  if(attack.compare(defence)>0){
    const loss=ceil(defence.divide(new ExactRational(4+weapons,4)));
    target.owner=attacker;target.ships=Math.max(1,count-loss);target.acted=true;
    if(attacker==='player')reveal(s,graph,to);
    message(s,(attacker==='player'?'Your fleet captured ':'Rival fleet captured ')+target.name+'.');
  }else{
    const loss=ceil(attack.divide(new ExactRational(4+defenceLevel,4)));
    target.ships=Math.max(0,target.ships-loss);
    message(s,(attacker==='player'?'Your attack on ':'Rival attack on ')+target.name+' was repelled.');
  }
}
function finish(s){
  if(s.systems[0].owner!=='player'){s.winner='rival';s.outcome='Homeworld lost. The Umbra Compact prevails.';}
  else if(s.systems[15].owner==='player'){s.winner='player';s.outcome='Domination victory. Umbra has fallen.';}
  else if(s.science>=SCIENCE_GOAL&&colonies(s,'player').length>=4){s.winner='player';s.outcome='Science victory. Four colonies complete the Aster Beacon.';}
  else if(s.turn>=MAX_TURNS){
    const player=colonies(s,'player').reduce((sum,x)=>sum+20+x.ships,0)+s.science;
    const rival=colonies(s,'rival').reduce((sum,x)=>sum+20+x.ships,0);
    s.winner=player===rival?'draw':player>rival?'player':'rival';s.outcome='Turn limit reached. Colony, fleet and science score: '+player+' / '+rival+'.';
  }
}
function rivalTurn(s,graph){
  // Public topology and starting capital coordinates are known to both sides.
  // A rival colony observes its neighbors; only those owners/ships guide orders.
  const distance=breadthFirst(graph,0).depth;
  s.rivalOre=Math.min(MAX_STOCK,s.rivalOre+colonies(s,'rival').length*5);
  // Stable choices by distance then ID; no hidden random draws during play.
  let rivals=colonies(s,'rival');
  if(s.turn%2===0&&rivals.length<5&&s.rivalOre>=12){
    const candidates=s.systems.filter(x=>x.owner==='neutral'&&graph.adjacency[x.id].some(id=>s.systems[id].owner==='rival'))
      .sort((a,b)=>distance[a.id]-distance[b.id]||a.id-b.id);
    const target=candidates[0];
    if(target){target.owner='rival';target.ships=2;s.rivalOre-=12;if(target.surveyed)message(s,'Rival colony established at '+target.name+'.');}
  }
  rivals=colonies(s,'rival').sort((a,b)=>distance[a.id]-distance[b.id]||a.id-b.id);
  const front=rivals[0];
  if(front){const count=Math.min(3,Math.floor(s.rivalOre/3),100-front.ships);front.ships+=count;s.rivalOre-=count*3;}
  if(s.turn>=12){
    for(const source of rivals){
      if(source.ships<6)continue;
      const targets=graph.adjacency[source.id].map(id=>s.systems[id]).filter(x=>x.owner==='player')
        .sort((a,b)=>a.ships-b.ships||a.id-b.id);
      if(targets.length){battle(s,graph,source.id,targets[0].id,source.ships-2,'rival');break;}
      // Reposition one group towards the border; at most one move/attack per turn.
      const target=graph.adjacency[source.id].map(id=>s.systems[id]).filter(x=>x.owner==='rival'&&distance[x.id]<distance[source.id]&&x.ships<100)
        .sort((a,b)=>distance[a.id]-distance[b.id]||a.id-b.id)[0];
      if(target){const count=Math.min(source.ships-2,100-target.ships);source.ships-=count;target.ships+=count;break;}
    }
  }
}
function apply(s,graph,command){
  if(s.winner)throw new RangeError('Campaign ended; start a new seed to play again');
  if(command.type==='endTurn'){
    const production=income(s);s.ore=s.ore.add(production.ore);if(s.ore.compare(rat(MAX_STOCK))>0)s.ore=rat(MAX_STOCK);
    s.science=Math.min(MAX_STOCK,s.science+production.science);s.turn++;
    rivalTurn(s,graph);for(const system of s.systems)system.acted=false;
    s.actions=3+Math.floor(colonies(s,'player').length/4);message(s,'Turn '+s.turn+': +'+String(production.ore)+' ore, +'+production.science+' science.');finish(s);return;
  }
  if(s.actions<1)throw new RangeError('No actions left; end this turn');
  if(command.type==='research'){
    const level=s.research[command.field];if(level>=3)throw new RangeError('Research is already at maximum level');
    const cost=12*(level+1);if(s.science<cost)throw new RangeError('Not enough science (need '+cost+')');
    s.science-=cost;s.research[command.field]++;message(s,command.field+' research advanced to '+s.research[command.field]+'.');
  }else if(command.type==='send'){
    const source=owned(s,command.from),target=s.systems[command.to];
    if(source.id===target.id)throw new RangeError('Choose a different destination');
    if(!target.surveyed)throw new RangeError('Survey the destination first');
    if(target.owner==='neutral')throw new RangeError('Colonize neutral systems before transferring ships');
    if(command.count>source.ships)throw new RangeError('Not enough ships at source');
    const path=route(s,graph,source.id,target.id);
    if(path.length<2)throw new RangeError('No supplied route through your colonies');
    if(path.length-1>2+s.research.navigation)throw new RangeError('Route exceeds navigation range');
    if(target.owner==='player'){
      if(target.ships+command.count>100)throw new RangeError('Destination fleet capacity is 100');
      source.ships-=command.count;target.ships+=command.count;message(s,command.count+' ships transferred via '+path.map(id=>s.systems[id].name).join(' → ')+'.');
    }else battle(s,graph,source.id,target.id,command.count,'player');
    source.acted=true;
  }else{
    const target=s.systems[command.system];
    if(command.type==='survey'||command.type==='colonize'){
      if(!target.discovered)throw new RangeError('System lies beyond your charts');
      if(!graph.adjacency[target.id].some(id=>s.systems[id].owner==='player'))throw new RangeError('A neighboring colony is required');
      if(command.type==='survey'){
        if(target.surveyed)throw new RangeError('System already surveyed');spend(s,2);target.surveyed=true;
        message(s,'Surveyed '+target.name+': richness '+target.richness+', '+target.owner+'.');
      }else{
        if(!target.surveyed)throw new RangeError('Survey the system before colonizing');
        if(target.owner!=='neutral')throw new RangeError('Only neutral systems can be colonized');
        spend(s,12);target.owner='player';target.ships=2;target.acted=true;reveal(s,graph,target.id);message(s,'Colony founded at '+target.name+'.');
      }
    }else{
      owned(s,target.id);
      if(command.type==='build'){
        if(target.ships+command.count>100)throw new RangeError('Colony fleet capacity is 100');
        spend(s,command.count*3);target.ships+=command.count;message(s,command.count+' ships built at '+target.name+'.');
      }else{
        if(target[command.type]>=3)throw new RangeError('Structure already at maximum level');
        spend(s,8*(target[command.type]+1));target[command.type]++;message(s,target.name+' '+command.type+' upgraded to '+target[command.type]+'.');
      }
      target.acted=true;
    }
  }
  s.actions--;finish(s);
}

export class Game {
  #seed;#graph;#state;#commands=[];
  constructor(options={}){
    record(options,Object.hasOwn(options,'seed')?['seed']:[]);this.#seed=uint32(Object.hasOwn(options,'seed')?options.seed:4171,'seed');
    let random=this.#seed;const pick=n=>{random=nextRandom(random);return random%n;};
    const systems=Array.from({length:N},(_,id)=>({id,name:names[id],x:100+(id%4)*250+pick(61)-30,y:100+Math.floor(id/4)*250+pick(61)-30,
      discovered:false,surveyed:false,owner:'neutral',ships:0,mine:0,lab:0,richness:2+pick(3),acted:false}));
    const edges=[];
    for(let id=0;id<N;id++){
      if(id%4<3)edges.push([id,id+1]);if(id<12)edges.push([id,id+4]);
      if(id%4<3&&id<12&&pick(4)===0)edges.push([id,id+5]);
    }
    this.#graph=new ExactGraph(N,edges);
    Object.assign(systems[0],{owner:'player',ships:6,mine:1,lab:1});Object.assign(systems[15],{owner:'rival',ships:6,mine:1,lab:1});
    this.#state={turn:1,actions:3,systems,ore:rat(28),science:0,research:{industry:0,weapons:0,navigation:0},rivalOre:12,log:['Aster founded. Survey a frontier, then plant your next colony.'],winner:null,outcome:''};
    reveal(this.#state,this.#graph,0);
  }
  snapshot(){
    const s=this.#state,production=income(s);
    return {seed:this.#seed,turn:s.turn,actions:s.actions,systems:s.systems.map(x=>x.surveyed?{...x}:{id:x.id,name:x.discovered?'Unsurveyed '+x.id:'Uncharted '+x.id,x:x.x,y:x.y,discovered:x.discovered,surveyed:false,owner:null,ships:null,mine:null,lab:null,richness:null,acted:false}),
      edges:this.#graph.edges.map(edge=>[...edge]),resources:{ore:floor(s.ore),oreExact:String(s.ore),science:s.science},income:{ore:String(production.ore),science:production.science},research:{...s.research},log:[...s.log],winner:s.winner,outcome:s.outcome,
      colonies:colonies(s,'player').length,rivalColonies:colonies(s,'rival').filter(x=>x.surveyed).length,scienceGoal:SCIENCE_GOAL,maxTurns:MAX_TURNS};
  }
  command(input){
    if(this.#commands.length>=MAX_COMMANDS)throw new RangeError('Replay command budget exhausted');
    const command=canonicalCommand(input),previous=this.#state;
    const candidate={...previous,systems:previous.systems.map(x=>({...x})),research:{...previous.research},log:[...previous.log]};
    apply(candidate,this.#graph,command);this.#state=candidate;this.#commands.push(command);return this.snapshot();
  }
  route(from,to){
    integer(from,0,N-1,'Source');integer(to,0,N-1,'Target');const s=this.#state;
    if(from===to||s.systems[from].owner!=='player'||!s.systems[to].surveyed||s.systems[to].owner==='neutral')return [];
    const path=route(s,this.#graph,from,to);return path.length-1<=2+s.research.navigation?path:[];
  }
  exportReplay(){return {kind:REPLAY_KIND,seed:this.#seed,commands:this.#commands.map(command=>({...command}))};}
  static fromReplay(data){
    record(data,['kind','seed','commands']);if(data.kind!==REPLAY_KIND)throw new TypeError('Unknown replay version');uint32(data.seed,'seed');
    const commands=data.commands;
    if(!Array.isArray(commands)||Object.getPrototypeOf(commands)!==Array.prototype||commands.length>MAX_COMMANDS||Reflect.ownKeys(commands).length!==commands.length+1)throw new RangeError('Dense replay command array required; maximum '+MAX_COMMANDS);
    const descriptors=Object.getOwnPropertyDescriptors(commands),checked=[];
    for(let i=0;i<commands.length;i++){
      if(!Object.hasOwn(descriptors,i)||!Object.hasOwn(descriptors[i],'value'))throw new TypeError('Replay commands must be own data');
      checked.push(canonicalCommand(descriptors[i].value));
    }
    if(JSON.stringify({kind:data.kind,seed:data.seed,commands:checked}).length>MAX_REPLAY_BYTES)throw new RangeError('Replay exceeds byte budget');
    const game=new Game({seed:data.seed});for(const command of checked)game.command(command);return game;
  }
}
