// SPDX-License-Identifier: Apache-2.0
// Local demo UI. Authoritative turn rules and replay validation live in world.js.
import {Game,MAX_REPLAY_BYTES} from './world.js';
const $=id=>document.getElementById(id);
let game=new Game({seed:731}),selected=0,source=0,revision=0;
const ownerLabel={player:'Your empire',rival:'Rival empire',neutral:'Unclaimed'};
function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function option(value,label){const el=document.createElement('option');el.value=String(value);el.textContent=label;return el;}
function fact(name,value){const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=String(value);item.append(dt,dd);return item;}
function choose(id){selected=id;render();}
function act(command){
  try{game.command(command);revision++;render();message(command.type==='endTurn'?'Turn advanced. Income collected; review the frontier dispatches.':'Order accepted. '+game.snapshot().actions+' orders remaining this turn.');}
  catch(error){message('REJECTED · '+error.message,true);}
}
function point(system,systems){
  const xs=systems.map(s=>s.x),ys=systems.map(s=>s.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return {x:105+(system.x-minX)/(maxX-minX||1)*790,y:95+(maxY-system.y)/(maxY-minY||1)*570};
}
function drawMap(state){
  const focused=document.activeElement?.dataset.system;
  $('lanes').replaceChildren();$('stars').replaceChildren();
  const locations=state.systems.map(s=>point(s,state.systems));
  const route=game.route(source,selected);
  for(const [a,b] of state.edges){
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',locations[a].x);line.setAttribute('y1',locations[a].y);
    line.setAttribute('x2',locations[b].x);line.setAttribute('y2',locations[b].y);
    if(!state.systems[a].surveyed||!state.systems[b].surveyed)line.classList.add('fog-lane');
    if(route.some((id,i)=>i<route.length-1&&((id===a&&route[i+1]===b)||(id===b&&route[i+1]===a))))line.classList.add('route-lane');
    $('lanes').append(line);
  }
  for(const star of state.systems){
    const button=document.createElement('button');button.type='button';button.className='star '+(star.surveyed?star.owner:'unknown');button.dataset.system=String(star.id);
    button.style.left=locations[star.id].x/10+'%';button.style.top=locations[star.id].y/7.6+'%';button.setAttribute('aria-pressed',String(star.id===selected));
    const name=star.surveyed?star.name:star.discovered?'Signal '+String(star.id).padStart(2,'0'):'Unknown '+String(star.id).padStart(2,'0');
    const orb=document.createElement('span');orb.className='orb';orb.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.className='star-label';label.textContent=name;
    const detail=document.createElement('span');detail.className='star-detail';detail.textContent=star.surveyed?(ownerLabel[star.owner]+' · '+star.ships):star.discovered?'FRONTIER SIGNAL':'BEYOND FRONTIER';
    button.setAttribute('aria-label',name+' · '+(star.surveyed?ownerLabel[star.owner]+', '+star.ships+' ships':star.discovered?'unsurveyed frontier':'unexplored'));
    button.append(orb,label,detail);button.addEventListener('click',()=>choose(star.id));$('stars').append(button);
  }
  if(focused!==undefined)$('stars').querySelector('[data-system="'+focused+'"]')?.focus({preventScroll:true});
}
function adjacentColony(state,id){return state.edges.some(([a,b])=>(a===id&&state.systems[b].owner==='player')||(b===id&&state.systems[a].owner==='player'));}
function render(){
  const state=game.snapshot(),star=state.systems[selected],owned=state.systems.filter(s=>s.owner==='player'),known=state.systems.filter(s=>s.surveyed),active=!state.winner&&state.actions>0;
  if(!owned.some(s=>s.id===source))source=owned[0]?.id??0;
  $('turn').textContent=String(state.turn);$('actions').textContent=state.actions+' orders available';
  $('ore').textContent=state.resources.oreExact;$('science').textContent=String(state.resources.science);
  $('ore-income').textContent='+'+state.income.ore+' per turn';$('science-income').textContent='+'+state.income.science+' per turn';
  $('ships').textContent=String(owned.reduce((n,s)=>n+s.ships,0));$('colonies').textContent=String(state.colonies);$('charted').textContent=known.length+' / 16 surveyed';
  $('sector-label').textContent='SEED '+state.seed;
  $('system-select').replaceChildren(...state.systems.map(s=>option(s.id,String(s.id).padStart(2,'0')+' / '+(s.surveyed?s.name:s.discovered?'Unsurveyed signal':'Unknown star'))));$('system-select').value=String(selected);
  drawMap(state);
  $('system-number').textContent='SYS '+String(star.id).padStart(2,'0');$('system-title').textContent=star.surveyed?star.name:star.discovered?'Unsurveyed signal':'Unexplored star';
  $('system-owner').textContent=star.surveyed?ownerLabel[star.owner]:'UNKNOWN TERRITORY';
  $('system-owner').style.color=star.owner==='rival'?'var(--coral)':'var(--green)';
  $('system-info').textContent=star.surveyed?(star.id===0?'Your capital. Protect it from the rival.':star.id===15?'Rival capital. Capture this system to win by domination.':star.owner==='neutral'?'A surveyed world, ready for a foothold on the frontier.':star.owner==='rival'?'A rival colony. Dispatch enough ships to overcome its defenses.':'An established colony. Develop its economy or marshal a fleet.'):
    star.discovered?'A signal on the edge of your territory. Survey it to reveal its resources and defenders.':'Outside your frontier. Expand toward this star to discover it.';
  const facts=star.surveyed?[fact('Garrison',star.ships+' ships'),fact('Ore richness',star.richness),fact('Mine level',star.mine),fact('Lab level',star.lab)]:[fact('Telemetry','Unknown'),fact('Survey',star.discovered?'Signal located':'Out of reach')];
  $('system-facts').replaceChildren(...facts);
  const own=star.owner==='player',free=own&&!star.acted,near=adjacentColony(state,star.id);
  $('survey').disabled=!active||!star.discovered||star.surveyed||!near||state.resources.ore<2;
  $('colonize').disabled=!active||!star.surveyed||star.owner!=='neutral'||!near||state.resources.ore<12;
  $('mine').disabled=!active||!free||star.mine>=3||state.resources.ore<8*(star.mine+1);
  $('lab').disabled=!active||!free||star.lab>=3||state.resources.ore<8*(star.lab+1);
  const buildCount=Number($('build-count').value),validBuild=Number.isSafeInteger(buildCount)&&buildCount>=1&&buildCount<=20;
  $('build').disabled=!active||!free||!validBuild||state.resources.ore<3*buildCount||star.ships+buildCount>100;
  $('mine').textContent='Mine · '+(own?8*(star.mine+1):'8+')+' ore';$('lab').textContent='Lab · '+(own?8*(star.lab+1):'8+')+' ore';
  $('survey').textContent='Survey · 2 ore';$('colonize').textContent='Colonize · 12 ore';$('build').textContent='Build · '+(validBuild?3*buildCount:'—')+' ore';
  $('order-costs').textContent=(own&&star.acted?'This colony has acted this turn. End turn to develop or dispatch again. ':'')+'Each order costs 1 action. Each colony may develop or dispatch once per turn.';
  $('fleet-source').replaceChildren(...owned.map(s=>option(s.id,s.name+' · '+s.ships+' ships'+(s.acted?' · acted':''))));$('fleet-source').value=String(source);
  const departure=state.systems[source],count=Number($('fleet-ships').value);
  $('fleet-ships').max=String(Math.max(1,Math.min(100,departure?.ships??1)));
  const path=game.route(source,selected);
  $('send').disabled=!active||departure?.owner!=='player'||departure.acted||path.length<2||!Number.isSafeInteger(count)||count<1||count>departure.ships||(star.owner==='player'&&star.ships+count>100);
  $('fleet-source').disabled=owned.length===0;$('fleet-ships').disabled=owned.length===0;
  $('route').textContent=path.length>1?path.map(id=>state.systems[id].name).join(' → ')+' · '+(path.length-1)+' / '+(2+state.research.navigation)+' hops. Resolves immediately.':source===selected?'Choose another destination star.':!star.surveyed?'Survey the destination before dispatching a fleet.':star.owner==='neutral'?'Colonize this world before transferring ships.':'No supplied route within '+(2+state.research.navigation)+' hops. Intermediate stars must be your colonies.';
  const field=$('research-field').value,level=state.research[field],cost=12*(level+1);
  $('research-level').textContent=field[0].toUpperCase()+field.slice(1)+' · Level '+level+' / 3';
  $('research-info').textContent=field==='industry'?'Improve exact fractional ore production across your colonies.':field==='weapons'?'Improve fleet combat strength.':'Extend your fleet dispatch range.';
  $('research-button').textContent=level>=3?'Field complete':'Research · '+cost+' science';$('research-button').disabled=!active||level>=3||state.resources.science<cost;
  $('science-goal').textContent=state.resources.science+' / '+state.scienceGoal+' science · '+state.colonies+' / 4 colonies';$('domination-goal').textContent='Capture the rival capital at system 15. Protect your own at system 00.';
  $('end-turn').disabled=!!state.winner;
  $('turn-note').textContent='Turn '+state.turn+' / '+state.maxTurns+'. End turn collects income and gives the rival a move. No time passes while you think.';
  $('outcome').hidden=!state.winner;$('outcome').textContent=state.winner?(state.winner==='player'?'VICTORY · ':state.winner==='rival'?'DEFEAT · ':'SECTOR CLOSED · ')+state.outcome+' Start a new sector to play again.':'';
  $('log').replaceChildren(...[...state.log].reverse().map(text=>{const item=document.createElement('li');item.textContent=text;return item;}));
  $('math-inspector').textContent='Seeded integer map: '+state.seed+'\nConnected hyperlane graph: 16 vertices / '+state.edges.length+' undirected edges\nRouting: exact graph breadth-first traversal, ascending vertex tie order\nSelected route: '+(path.length?path.join(' → '):'none')+'; range '+(2+state.research.navigation)+' hops\nCombat: attack = ships × (4 + weapons) / 4; defense = (garrison + 2) × (4 + weapons) / 4; ties repel\nOre balance: '+state.resources.oreExact+' (spendable floor '+state.resources.ore+')\nOre per turn: '+state.income.ore+' (exact rational)\nIndustry / weapons / navigation: '+state.research.industry+' / '+state.research.weapons+' / '+state.research.navigation+'\nAccepted orders: '+game.exportReplay().commands.length+'\nCanonical state advances only when an order is accepted.';
  $('rules').textContent='3 + floor(colonies / 4) orders per turn. Survey 2 ore; colonize 12 ore; ships 3 ore each; upgrades 8 × (new level) ore; research 12 × (new level) science. Structure and research levels cap at 3. Ascension: 120 unspent science and 4 colonies. Domination: rival capital. Game ends by turn 80.';
}
$('system-select').addEventListener('change',()=>choose(Number($('system-select').value)));
for(const type of ['survey','colonize','mine','lab'])$(type).addEventListener('click',()=>act({type,system:selected}));
$('build-count').addEventListener('input',render);
$('build').addEventListener('click',()=>act({type:'build',system:selected,count:Number($('build-count').value)}));
$('end-turn').addEventListener('click',()=>act({type:'endTurn'}));
$('research-field').addEventListener('change',render);
$('research-button').addEventListener('click',()=>act({type:'research',field:$('research-field').value}));
$('fleet-source').addEventListener('change',()=>{source=Number($('fleet-source').value);render();});
$('fleet-ships').addEventListener('input',render);
$('send').addEventListener('click',()=>act({type:'send',from:source,to:selected,count:Number($('fleet-ships').value)}));
$('new-game').addEventListener('click',()=>{
  try{const seed=Number($('seed').value);if($('seed').value.trim()===''||!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Seed must be an integer from 0 to 4294967295.');const candidate=new Game({seed});game=candidate;revision++;selected=0;source=0;render();message('New sector ready. Survey a nearby signal to begin.');}
  catch(error){message('REJECTED · '+error.message,true);}
});
$('export-replay').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(game.exportReplay(),null,2)+'\n'],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='ternary-reach-'+game.snapshot().seed+'-replay.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Replay exported. Import it to resume this exact sequence of orders.');
});
$('import-replay').addEventListener('change',async()=>{
  const file=$('import-replay').files[0],start=++revision;if(!file)return;
  try{if(file.size>MAX_REPLAY_BYTES)throw new Error('Replay exceeds the 128 KiB file limit.');const text=await file.text();if(start!==revision)return;const candidate=Game.fromReplay(JSON.parse(text));game=candidate;selected=0;source=0;$('seed').value=String(game.snapshot().seed);render();message('Replay imported. Accepted orders reproduced; your game is ready to continue.');}
  catch(error){if(start===revision)message('REJECTED · '+error.message,true);}
  finally{$('import-replay').value='';}
});
render();message('Sector ready. Select a nearby signal, Survey, then Colonize.');
