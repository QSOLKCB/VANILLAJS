// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {NARRATIVE_FORMAT,NARRATIVE_SAVE_FORMAT,NARRATIVE_BYTES,NARRATIVE_LIMITS,validateStory,analyzeStory,serializeStory,createState,availableChoices,choose,serializeSave,restoreSave,replayEvents} from '../modules/narrative/index.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const always=()=>({op:'always'});
const choice=(id,target,condition=always(),effects=[])=>({id,label:id,target,condition,effects});
const node=(id,choices=[],onEnter=[],ending=false)=>({id,title:id,dialogue:'Original '+id+' dialogue.',ending,onEnter,choices});
function fixture(){return {format:NARRATIVE_FORMAT,version:1,id:'signal',title:'The signal test',start:'arrival',maxSteps:12,
  variables:[{id:'hasKey',type:'boolean',initial:false},{id:'charge',type:'integer',initial:0,min:0,max:3},{id:'route',type:'string',initial:'dock',values:['dock','ridge']}],
  objectives:[{id:'restore',title:'Restore the signal'}],events:['arrive','key-found','signal-lit'],nodes:[
    node('arrival',[
      choice('search','arrival',{op:'not',condition:{op:'eq',variable:'hasKey',value:true}},[{op:'set',variable:'hasKey',value:true},{op:'add',variable:'charge',value:1},{op:'event',event:'key-found'}]),
      choice('repair','restored',{op:'all',conditions:[{op:'eq',variable:'hasKey',value:true},{op:'gte',variable:'charge',value:1},{op:'objective',objective:'restore',status:'active'}]},[{op:'add',variable:'charge',value:-1},{op:'objective',objective:'restore',status:'complete'}]),
      choice('leave','departed',always(),[{op:'set',variable:'route',value:'ridge'},{op:'objective',objective:'restore',status:'failed'}])
    ],[{op:'objective',objective:'restore',status:'active'},{op:'event',event:'arrive'}]),
    node('restored',[],[{op:'event',event:'signal-lit'}],true),node('departed',[],[],true),node('secret',[],[],true)
  ]};}

test('declared conditions, effects, objectives and event order compose a real deterministic branch',()=>{
  const story=validateStory(fixture()),initial=createState(story);
  assert.deepEqual(initial.events,['arrive']);assert.equal(initial.state.objectives.restore,'active');
  assert.deepEqual(availableChoices(story,initial.state).map(c=>c.id),['search','leave']);
  assert.throws(()=>choose(story,initial.state,'repair'),/condition/);
  const found=choose(story,initial.state,'search');
  assert.deepEqual(found.events,['key-found','arrive']);assert.equal(found.state.variables.hasKey,true);assert.equal(found.state.variables.charge,1);
  assert.deepEqual(availableChoices(story,found.state).map(c=>c.id),['repair','leave']);
  const end=choose(story,found.state,'repair');
  assert.deepEqual(end,{state:{node:'restored',variables:{hasKey:true,charge:0,route:'dock'},objectives:{restore:'complete'},steps:2,history:['search','repair']},events:['signal-lit']});
  assert.deepEqual(availableChoices(story,end.state),[]);assert.throws(()=>choose(story,end.state,'leave'),/ended/);
  assert.deepEqual(choose(story,choose(story,createState(story).state,'search').state,'repair'),end);
  const departure=choose(story,initial.state,'leave');assert.equal(departure.state.variables.route,'ridge');assert.equal(departure.state.objectives.restore,'failed');
});

test('story/project ownership and imports are independent snapshots with canonical serialization',()=>{
  const input=fixture(),story=validateStory(input);input.nodes[0].title='Changed externally';assert.equal(story.nodes[0].title,'arrival');
  assert.ok(Object.isFrozen(story)&&Object.isFrozen(story.nodes[0].choices[0].condition));
  const initial=createState(story),choices=availableChoices(story,initial.state);assert.ok(Object.isFrozen(initial.state.history)&&Object.isFrozen(choices[0]));
  const raw=serializeStory(story);assert.equal(serializeStory(JSON.stringify(JSON.parse(raw),null,4)),raw);
  assert.deepEqual(validateStory(raw),story);
});

test('missing links, unreachable nodes, reachable endings and cycles are explicit structural diagnostics',()=>{
  const source=fixture(),report=analyzeStory(source);
  assert.equal(report.valid,true);assert.deepEqual(report.unreachable,['secret']);assert.deepEqual(report.reachableEndings,['restored','departed']);assert.deepEqual(report.cycles,[['arrival']]);
  assert.ok(report.warnings.some(s=>s.includes('ignores conditions')));
  source.nodes[0].choices[1].target='missing';source.start='also-missing';
  const invalid=analyzeStory(source);assert.equal(invalid.valid,false);assert.deepEqual(invalid.missingLinks,[{from:null,choice:null,target:'also-missing'},{from:'arrival',choice:'repair',target:'missing'}]);
  assert.throws(()=>validateStory(source),/missing start or choice target/);
  const impossible=fixture();impossible.nodes[0].choices= [choice('impossible','restored',{op:'not',condition:always()})];
  assert.deepEqual(analyzeStory(impossible).reachableEndings,['restored']);assert.deepEqual(availableChoices(impossible,createState(impossible).state),[]);
  impossible.nodes[0].choices=[];assert.ok(analyzeStory(impossible).warnings.some(s=>s.includes('no outgoing')));
});

test('strict schemas reject executable/unknown fields without invoking input getters',()=>{
  let invoked=0;
  for(const mutate of [
    s=>Object.defineProperty(s,'title',{get(){invoked++;return 'bad';},enumerable:true}),
    s=>Object.defineProperty(s.nodes,'0',{get(){invoked++;return {};},enumerable:true}),
    s=>Object.defineProperty(s.nodes[0].choices[0].condition,'op',{get(){invoked++;return 'always';},enumerable:true}),
    s=>Object.defineProperty(s,'hidden',{value:'unknown',enumerable:false}),
    s=>{s[Symbol('inert?')]=true;},
    s=>{s.source='https://example.invalid/script.js';},
    s=>{s.nodes[0].choices[0].condition={op:'eval',expression:'globalThis.attack()'};},
    s=>{s.nodes[0].onEnter=[{op:'script',code:'alert(1)'}];},
    s=>{Object.setPrototypeOf(s,{inherited:true});},
    s=>{class Custom extends Array{};s.nodes=new Custom(...s.nodes);},
    s=>{delete s.nodes[1];},
    s=>{s.nodes.extra=true;},
    s=>{s.variables[0].id='constructor';},
  ]){const s=fixture();mutate(s);assert.throws(()=>validateStory(s));}
  assert.equal(invoked,0);
  const s=fixture();s.nodes[0].dialogue='<script>literal text</script>';assert.equal(validateStory(s).nodes[0].dialogue,'<script>literal text</script>','dialogue is inert text, never parsed as HTML by the module');
});

test('typed declarations constrain every comparison and effect reference',()=>{
  const bad=[
    s=>{s.variables[1].initial=4;},s=>{s.variables[1].max=NaN;},s=>{s.variables[2].values=['dock','dock'];},
    s=>{s.variables[2].initial='ocean';},s=>{s.variables.push(copy(s.variables[0]));},
    s=>{s.nodes[0].choices[0].condition={op:'gt',variable:'hasKey',value:true};},
    s=>{s.nodes[0].choices[0].condition={op:'eq',variable:'missing',value:true};},
    s=>{s.nodes[0].choices[0].condition={op:'eq',variable:'route',value:'sea'};},
    s=>{s.nodes[0].onEnter=[{op:'add',variable:'route',value:1}];},
    s=>{s.nodes[0].onEnter=[{op:'set',variable:'charge',value:3.5}];},
    s=>{s.nodes[0].onEnter=[{op:'objective',objective:'restore',status:'won'}];},
    s=>{s.nodes[0].onEnter=[{op:'objective',objective:'absent',status:'active'}];},
    s=>{s.nodes[0].onEnter=[{op:'event',event:'undeclared'}];},
    s=>{s.nodes[0].choices.push(copy(s.nodes[0].choices[0]));},
    s=>{s.nodes.push(copy(s.nodes[0]));},s=>{s.nodes[0].ending=true;},
  ];for(const mutate of bad){const s=fixture();mutate(s);assert.throws(()=>validateStory(s));}
});

test('all boolean and comparison operators have defined typed results',()=>{
  const s=fixture();s.nodes[0].choices=[choice('test','restored',{op:'all',conditions:[
    {op:'eq',variable:'charge',value:0},{op:'ne',variable:'route',value:'ridge'},
    {op:'lt',variable:'charge',value:1},{op:'lte',variable:'charge',value:0},
    {op:'gt',variable:'charge',value:0},{op:'gte',variable:'charge',value:0}
  ]})];
  assert.deepEqual(availableChoices(s,createState(s).state),[]);
  s.nodes[0].choices[0].condition.conditions[4]={op:'any',conditions:[{op:'eq',variable:'hasKey',value:true},{op:'not',condition:{op:'eq',variable:'hasKey',value:true}}]};
  assert.equal(availableChoices(s,createState(s).state)[0].id,'test');
});

test('failed later effects are transactional across variables, objectives, events and node entry',()=>{
  const s=fixture();s.nodes[0].choices.push(choice('overflow','restored',always(),[
    {op:'event',event:'key-found'},{op:'set',variable:'hasKey',value:true},{op:'objective',objective:'restore',status:'complete'},{op:'add',variable:'charge',value:4}
  ]));
  const initial=createState(s).state,before=JSON.stringify(initial);assert.throws(()=>choose(s,initial,'overflow'),/out of range/);assert.equal(JSON.stringify(initial),before);
  s.nodes[0].choices.at(-1).effects.pop();s.nodes[1].onEnter.push({op:'add',variable:'charge',value:4});
  assert.throws(()=>choose(s,initial,'overflow'),/out of range/);assert.equal(JSON.stringify(initial),before);
});

test('explicit cycles are bounded without automatic traversal or unbounded events',()=>{
  const s=fixture();s.maxSteps=3;s.nodes[0].choices=[choice('again','arrival')];
  let result=createState(s);assert.equal(result.state.steps,0);assert.deepEqual(result.events,['arrive']);
  for(let i=1;i<=3;i++){result=choose(s,result.state,'again');assert.equal(result.state.steps,i);assert.deepEqual(result.events,['arrive']);}
  assert.deepEqual(availableChoices(s,result.state),[]);const before=JSON.stringify(result.state);
  assert.throws(()=>choose(s,result.state,'again'),/budget exhausted/);assert.equal(JSON.stringify(result.state),before);
  assert.deepEqual(restoreSave(s,serializeSave(s,result.state)),result.state);
  s.maxSteps=1025;assert.throws(()=>validateStory(s));
});

test('save restores exact story-bound choice history without redispatching events',()=>{
  const s=fixture(),end=choose(s,choose(s,createState(s).state,'search').state,'repair').state;
  const raw=serializeSave(s,end),save=JSON.parse(raw);assert.equal(save.format,NARRATIVE_SAVE_FORMAT);assert.equal(save.storyIdentity,serializeStory(s));
  assert.deepEqual(restoreSave(s,raw),end);assert.equal(restoreSave(s,raw).events,undefined);
  for(const mutate of [x=>{x.title+='!';},x=>{x.nodes[1].dialogue+=' Changed';},x=>{x.nodes[0].choices[0].effects[1].value=2;},x=>{x.variables.reverse();}]){const changed=copy(s);mutate(changed);assert.throws(()=>restoreSave(changed,raw),/identity mismatch/);}
  for(const mutate of [x=>{x.history=['repair'];},x=>{x.history=['search','missing'];},x=>{x.version=2;},x=>{x.variables={charge:9};},x=>{x.storyIdentity+=' ';}]){const changed=copy(save);mutate(changed);assert.throws(()=>restoreSave(s,changed));}
});

test('forged public snapshots, invalid histories and getter-based saves cannot alter a session',()=>{
  const s=fixture(),initial=createState(s).state;
  for(const mutate of [x=>{x.variables.hasKey=true;},x=>{x.objectives.restore='complete';},x=>{x.node='restored';},x=>{x.steps=1;},x=>{x.variables.extra=0;},x=>{x.history=['repair'];x.steps=1;}]){const altered=copy(initial);mutate(altered);assert.throws(()=>choose(s,altered,'search'));assert.throws(()=>serializeSave(s,altered));}
  let reads=0;const save=JSON.parse(serializeSave(s,initial));Object.defineProperty(save,'history',{get(){reads++;return [];},enumerable:true});assert.throws(()=>restoreSave(s,save));assert.equal(reads,0);
  assert.deepEqual(createState(s).state,initial);
});

test('format, UTF-8 byte, node, effect and condition budgets reject before execution',()=>{
  const original=fixture();for(const mutate of [s=>{s.format='unsupported';},s=>{s.version=2;},s=>{s.nodes[0].dialogue='';},s=>{s.nodes[0].dialogue='x'.repeat(2049);},s=>{s.nodes[0].choices=Array.from({length:9},(_,i)=>choice('choice'+i,'restored'));},s=>{s.nodes[0].onEnter=Array.from({length:17},()=>({op:'event',event:'arrive'}));}]){const s=copy(original);mutate(s);assert.throws(()=>validateStory(s));}
  let c=always();for(let i=0;i<10;i++)c={op:'not',condition:c};const deep=fixture();deep.nodes[0].choices[0].condition=c;assert.throws(()=>validateStory(deep),/condition budget/);
  const wide=fixture();wide.nodes[0].choices[0].condition={op:'all',conditions:Array.from({length:8},()=>({op:'any',conditions:Array.from({length:8},always)}))};assert.throws(()=>validateStory(wide),/condition budget/);
  const cyclic=fixture();const loop={op:'not'};loop.condition=loop;cyclic.nodes[0].choices[0].condition=loop;assert.throws(()=>validateStory(cyclic),/condition budget/);
  const bounded=fixture();bounded.nodes=Array.from({length:NARRATIVE_LIMITS.nodes},(_,i)=>node('node'+i,[],[],true));bounded.start='node0';assert.equal(validateStory(bounded).nodes.length,128);
  bounded.nodes.push(node('overflow'));assert.throws(()=>validateStory(bounded));bounded.nodes.pop();for(const n of bounded.nodes)n.dialogue='界'.repeat(1200);assert.throws(()=>validateStory(bounded),/byte budget/);
  assert.throws(()=>validateStory(' '.repeat(NARRATIVE_BYTES+1)),/byte budget/);
});

test('event reconstruction is one bounded inert replay and rejects forged snapshots',()=>{
  const s=fixture(),start=createState(s).state;
  assert.deepEqual(replayEvents(s,start),['arrive']);
  const end=choose(s,choose(s,start,'search').state,'repair').state;
  const restored=restoreSave(s,serializeSave(s,end));
  assert.deepEqual(replayEvents(s,restored),['arrive','key-found','arrive','signal-lit']);
  assert.ok(Object.isFrozen(replayEvents(s,restored)));
  const forged=copy(restored);forged.variables.charge=1;assert.throws(()=>replayEvents(s,forged),/history/);
});

test('maximum cyclic replay stays within its explicit event and traversal budgets',()=>{
  const s=fixture();s.maxSteps=1024;
  const events=Array.from({length:16},()=>({op:'event',event:'arrive'}));
  s.nodes[0].onEnter=copy(events);s.nodes[0].choices=[choice('again','arrival',always(),copy(events))];
  const saved=JSON.parse(serializeSave(s,createState(s).state));saved.history=Array(1024).fill('again');
  const restored=restoreSave(s,saved);assert.equal(restored.steps,1024);
  const replayed=replayEvents(s,restored);assert.equal(replayed.length,16+32*1024);assert.ok(replayed.every(id=>id==='arrive'));
  saved.history.push('again');assert.throws(()=>restoreSave(s,saved),/budget/);
});
