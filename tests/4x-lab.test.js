// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,REPLAY_KIND,MAX_COMMANDS} from '../demos/4x-game-lab/world.js';
import {ExactGraph,breadthFirst} from '../modules/exact-graph/index.js';

const game=()=>new Game({seed:731});
const end=g=>g.command({type:'endTurn'});
function colonize(g,id){g.command({type:'survey',system:id});g.command({type:'colonize',system:id});}
function rejected(g,command){const before=g.snapshot(),replay=g.exportReplay();assert.throws(()=>g.command(command));assert.deepEqual(g.snapshot(),before);assert.deepEqual(g.exportReplay(),replay);}

test('seeded maps are connected, repeatable, bounded and conceal unexplored information',()=>{
  for(const seed of [0,1,731,4294967295]){
    const a=new Game({seed}),b=new Game({seed}),s=a.snapshot();assert.deepEqual(s,b.snapshot());
    assert.equal(s.systems.length,16);assert.equal(breadthFirst(new ExactGraph(16,s.edges),0).order.length,16);
    for(const system of s.systems.filter(x=>!x.surveyed))for(const key of ['owner','ships','mine','lab','richness'])assert.equal(system[key],null);
    assert.ok(s.systems.every(x=>x.x>=70&&x.x<=880&&x.y>=70&&x.y<=880));
    s.systems[0].ships=999;s.resources.ore=999;s.edges[0][0]=999;s.research.weapons=3;
    assert.deepEqual(a.snapshot(),b.snapshot(),'snapshots cannot mutate game authority');
  }
  assert.notDeepEqual(new Game({seed:0}).snapshot().systems,new Game({seed:1}).snapshot().systems);
  for(const seed of [null,undefined,-1,1.5,4294967296,'731',NaN])assert.throws(()=>new Game({seed}));
});

test('explore, expand and exploit change charts, income and colony action budgets',()=>{
  const g=game();rejected(g,{type:'colonize',system:1});rejected(g,{type:'survey',system:15});
  g.command({type:'survey',system:1});assert.equal(g.snapshot().systems[1].owner,'neutral');assert.equal(g.snapshot().resources.ore,26);
  g.command({type:'colonize',system:1});assert.equal(g.snapshot().colonies,2);assert.equal(g.snapshot().systems[2].discovered,true);
  assert.equal(g.snapshot().systems[1].acted,true);rejected(g,{type:'mine',system:1});
  g.command({type:'survey',system:4});assert.equal(g.snapshot().actions,0);rejected(g,{type:'mine',system:0});
  end(g);assert.equal(g.snapshot().actions,3);assert.equal(g.snapshot().resources.ore,22);
  g.command({type:'mine',system:0});assert.equal(g.snapshot().income.ore,'14');end(g);
  assert.equal(g.snapshot().systems[0].acted,false);assert.equal(g.snapshot().resources.ore,20);
  g.command({type:'lab',system:1});assert.equal(g.snapshot().income.science,6);
});

test('fractional industry production remains exact across turns and research has real tradeoffs',()=>{
  const g=game();for(let i=0;i<4;i++)end(g);
  assert.equal(g.snapshot().resources.science,12);g.command({type:'research',field:'industry'});
  assert.equal(g.snapshot().income.ore,'35/4');assert.equal(g.snapshot().resources.science,0);
  assert.equal(g.snapshot().resources.oreExact,'56');end(g);assert.equal(g.snapshot().resources.oreExact,'259/4');
  assert.equal(g.snapshot().resources.ore,64);end(g);assert.equal(g.snapshot().resources.oreExact,'147/2');
  rejected(g,{type:'research',field:'industry'});rejected(g,{type:'research',field:'quantum'});
});

test('supplied shortest routes, ship transfers and per-colony exhaustion reject atomically',()=>{
  const g=game();colonize(g,1);end(g);
  g.command({type:'build',system:0,count:2});rejected(g,{type:'send',from:0,to:1,count:1});end(g);
  assert.deepEqual(g.route(0,1),[0,1]);g.command({type:'send',from:0,to:1,count:3});
  assert.equal(g.snapshot().systems[0].ships,5);assert.equal(g.snapshot().systems[1].ships,5);
  assert.deepEqual(g.route(0,15),[]);rejected(g,{type:'send',from:1,to:15,count:1});
  rejected(g,{type:'send',from:1,to:1,count:1});rejected(g,{type:'send',from:1,to:0,count:6});
  for(const command of [{type:'build',system:1,count:0},{type:'build',system:1,count:21},{type:'send',from:1,to:0,count:1.5},{type:'survey',system:-1},{type:'endTurn',script:'x'},{type:'mine',system:1,ore:0},null])rejected(g,command);
  let touched=false;const accessor={get type(){touched=true;return 'endTurn';}};rejected(g,accessor);assert.equal(touched,false);
});

test('navigation research extends a supplied route without allowing hostile intermediates',()=>{
  const g=game();colonize(g,1);end(g);colonize(g,2);end(g);colonize(g,3);
  assert.deepEqual(g.route(0,3),[]);rejected(g,{type:'send',from:0,to:3,count:1});end(g);
  g.command({type:'research',field:'navigation'});assert.deepEqual(g.route(0,3),[0,1,2,3]);
  g.command({type:'send',from:0,to:3,count:1});assert.equal(g.snapshot().systems[3].ships,3);
  assert.deepEqual(g.route(0,15),[],'unexplored hostile space cannot supply a route');
});

test('rival decisions advance only on end turn; neglect produces a terminal defeat',()=>{
  const g=game(),before=g.snapshot();rejected(g,{type:'send',from:15,to:0,count:100});assert.deepEqual(g.snapshot(),before);
  while(!g.snapshot().winner)end(g);
  assert.equal(g.snapshot().turn,12);assert.equal(g.snapshot().winner,'rival');assert.match(g.snapshot().outcome,/Homeworld lost/);
  rejected(g,{type:'endTurn'});rejected(g,{type:'build',system:0,count:1});
  assert.deepEqual(Game.fromReplay(g.exportReplay()).snapshot(),g.snapshot());
});

test('a legal expansion, mine and defensive fleet strategy reaches science victory',()=>{
  const g=game();
  for(const id of [4,8,12]){
    while(g.snapshot().resources.ore<14||g.snapshot().actions<2)end(g);colonize(g,id);
  }
  while(!g.snapshot().winner){
    const s=g.snapshot(),home=s.systems[0];
    if(!home.acted&&home.mine<3&&s.resources.ore>=8*(home.mine+1))g.command({type:'mine',system:0});
    else if(!home.acted&&s.resources.ore>=3&&home.ships<90)g.command({type:'build',system:0,count:Math.min(10,Math.floor(s.resources.ore/3))});
    end(g);
  }
  const s=g.snapshot();assert.equal(s.turn,22);assert.equal(s.winner,'player');assert.match(s.outcome,/Science victory/);assert.equal(s.colonies,4);
  assert.ok(s.log.some(line=>line.includes('was repelled')),'defence is part of the playable victory path');
  assert.deepEqual(Game.fromReplay(g.exportReplay()).snapshot(),s);
});

test('armed expansion and a routed attack can capture Umbra for domination',()=>{
  const g=game(),expansion=[4,8,12,13,14];let next=0;
  while(!g.snapshot().winner){
    let s=g.snapshot();
    while(next<expansion.length&&s.actions>1&&s.resources.ore>=14){colonize(g,expansion[next++]);s=g.snapshot();}
    if(s.actions&&s.resources.science>=12*(s.research.weapons+1)&&s.research.weapons<3){g.command({type:'research',field:'weapons'});s=g.snapshot();}
    if(s.actions&&!s.systems[0].acted&&s.systems[0].ships<35&&s.resources.ore>=3){g.command({type:'build',system:0,count:Math.min(10,Math.floor(s.resources.ore/3))});s=g.snapshot();}
    if(next===5&&s.actions&&!s.systems[14].acted){
      if(s.systems[14].ships<14&&s.resources.ore>=3)g.command({type:'build',system:14,count:Math.min(14-s.systems[14].ships,Math.floor(s.resources.ore/3))});
      else if(s.systems[14].ships>=14){
        if(!s.systems[15].surveyed&&s.resources.ore>=2){g.command({type:'survey',system:15});s=g.snapshot();}
        if(s.actions&&g.snapshot().systems[15].surveyed){assert.deepEqual(g.route(14,15),[14,15]);g.command({type:'send',from:14,to:15,count:14});}
      }
    }
    if(!g.snapshot().winner)end(g);
  }
  assert.equal(g.snapshot().winner,'player');assert.match(g.snapshot().outcome,/Domination victory/);assert.equal(g.snapshot().systems[15].owner,'player');
  assert.deepEqual(Game.fromReplay(g.exportReplay()).snapshot(),g.snapshot());
});

test('turn limit resolves a surviving empire and logs stay bounded',()=>{
  const g=game();
  while(!g.snapshot().winner){
    let s=g.snapshot();
    if(s.research.weapons<3&&s.resources.science>=12*(s.research.weapons+1)){g.command({type:'research',field:'weapons'});s=g.snapshot();}
    if(s.systems[0].mine<3&&s.resources.ore>=8*(s.systems[0].mine+1))g.command({type:'mine',system:0});
    else if(s.resources.ore>=3&&s.systems[0].ships<90)g.command({type:'build',system:0,count:Math.min(10,Math.floor(s.resources.ore/3))});
    end(g);
  }
  assert.equal(g.snapshot().turn,80);assert.match(g.snapshot().outcome,/Turn limit reached/);assert.ok(g.snapshot().log.length<=40);
  assert.ok(g.snapshot().systems.filter(x=>x.surveyed).every(x=>x.ships>=0&&x.ships<=100));rejected(g,{type:'endTurn'});
});

test('replays reproduce accepted commands and reject altered rules, illegal histories and oversized work',()=>{
  const g=game();colonize(g,1);end(g);g.command({type:'build',system:0,count:2});
  const replay=g.exportReplay();assert.deepEqual(Game.fromReplay(JSON.parse(JSON.stringify(replay))).snapshot(),g.snapshot());
  replay.commands[0].system=15;assert.throws(()=>Game.fromReplay(replay));assert.equal(g.exportReplay().commands[0].system,1);
  const empty={kind:REPLAY_KIND,seed:0,commands:[]};assert.equal(Game.fromReplay(empty).snapshot().seed,0);
  for(const invalid of [{...empty,script:'evil'},{...empty,kind:'other'},{...empty,seed:-1},{...empty,commands:Array(MAX_COMMANDS+1).fill({type:'endTurn'})},{...empty,commands:Array(2)},{...empty,commands:[{type:'survey',system:15}]},{...empty,commands:[{type:'endTurn',code:'x'}]}])assert.throws(()=>Game.fromReplay(invalid));
  let touched=false;const commands=[];Object.defineProperty(commands,0,{get(){touched=true;return {type:'endTurn'};},enumerable:true});assert.throws(()=>Game.fromReplay({...empty,commands}));assert.equal(touched,false);
});
