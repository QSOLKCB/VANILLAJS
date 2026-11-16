// SPDX-License-Identifier: Apache-2.0
// Original, bounded narrative data and deterministic explicit choice transitions.
// No DOM, code evaluation, device state, clock, I/O or ambient randomness.
export const NARRATIVE_FORMAT='qsol.vanillajs.narrative.v1';
export const NARRATIVE_SAVE_FORMAT='qsol.vanillajs.narrative-save.v1';
export const NARRATIVE_BYTES=256*1024;
export const NARRATIVE_SAVE_BYTES=1024*1024;
export const NARRATIVE_LIMITS=Object.freeze({nodes:128,choices:8,variables:32,objectives:32,events:32,effects:16,conditionDepth:8,conditionNodes:64,maxSteps:1024});
const statuses=Object.freeze(['inactive','active','complete','failed']);
const own=(value,key)=>Object.hasOwn(value,key);
function record(value,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError(label+' must be a plain record');
  for(const key of Reflect.ownKeys(value))if(typeof key!=='string'||!own(Object.getOwnPropertyDescriptor(value,key),'value'))throw new TypeError(label+' contains executable or symbol fields');
  return value;
}
function exact(value,keys,label){
  record(value,label);const actual=Reflect.ownKeys(value);
  if(actual.length!==keys.length||actual.some(key=>!keys.includes(key)))throw new TypeError(label+' has missing or unknown fields');
  return value;
}
function list(value,min,max,label){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<min||value.length>max)throw new RangeError(label+' exceeds its plain array budget');
  if(Reflect.ownKeys(value).length!==value.length+1)throw new TypeError(label+' must be a dense data array');
  for(let i=0;i<value.length;i++)if(!own(Object.getOwnPropertyDescriptor(value,String(i))??{},'value'))throw new TypeError(label+' contains an accessor or missing item');
  return value;
}
function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(label+' is out of range');return value;}
function text(value,max,label,multiline=false){
  if(typeof value!=='string'||!value.trim()||value.length>max||(multiline?/[\u0000-\u0008\u000b-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(value))throw new TypeError(label+' must be bounded plain text');return value;
}
function id(value){if(typeof value!=='string'||!/^[a-z][a-zA-Z0-9_-]{0,47}$/.test(value)||['constructor','prototype','__proto__'].includes(value))throw new TypeError('invalid narrative ID');return value;}
function unique(items,label){if(new Set(items).size!==items.length)throw new TypeError('duplicate '+label);}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
const clone=value=>JSON.parse(JSON.stringify(value));
function parse(value,budget,label){if(typeof value==='string'){if(value.length>budget||new TextEncoder().encode(value).length>budget)throw new RangeError(label+' byte budget exceeded');return JSON.parse(value);}return value;}
function encoded(value,budget,label){const raw=JSON.stringify(value);if(new TextEncoder().encode(raw).length>budget)throw new RangeError(label+' byte budget exceeded');return raw;}
function variable(input){
  record(input,'variable');
  if(input.type==='boolean'){exact(input,['id','type','initial'],'boolean variable');if(typeof input.initial!=='boolean')throw new TypeError('boolean initial value required');return {id:id(input.id),type:'boolean',initial:input.initial};}
  if(input.type==='integer'){exact(input,['id','type','initial','min','max'],'integer variable');const min=integer(input.min,-1000000,1000000,'minimum'),max=integer(input.max,min,1000000,'maximum');return {id:id(input.id),type:'integer',initial:integer(input.initial,min,max,'initial value'),min,max};}
  if(input.type==='string'){exact(input,['id','type','initial','values'],'string variable');const values=list(input.values,1,16,'string enum').map(v=>text(v,64,'enum value'));unique(values,'enum value');if(!values.includes(input.initial))throw new TypeError('initial value is outside string enum');return {id:id(input.id),type:'string',initial:input.initial,values};}
  throw new TypeError('unsupported variable type');
}
function scalar(value,definition){
  if(definition.type==='integer')return integer(value,definition.min,definition.max,'variable value');
  if(definition.type==='boolean'){if(typeof value!=='boolean')throw new TypeError('boolean value required');return value;}
  if(!definition.values.includes(value))throw new TypeError('value is outside string enum');return value;
}
function reference(map,key,label){id(key);if(!map.has(key))throw new TypeError('unknown '+label+': '+key);return map.get(key);}
function condition(value,vars,objectives,depth=0,budget={count:0}){
  if(depth>NARRATIVE_LIMITS.conditionDepth||++budget.count>NARRATIVE_LIMITS.conditionNodes)throw new RangeError('condition budget exceeded');
  record(value,'condition');const op=value.op;
  if(op==='always'){exact(value,['op'],'always condition');return {op};}
  if(op==='all'||op==='any'){exact(value,['op','conditions'],'boolean condition');return {op,conditions:list(value.conditions,1,8,'conditions').map(c=>condition(c,vars,objectives,depth+1,budget))};}
  if(op==='not'){exact(value,['op','condition'],'not condition');return {op,condition:condition(value.condition,vars,objectives,depth+1,budget)};}
  if(op==='objective'){exact(value,['op','objective','status'],'objective condition');reference(objectives,value.objective,'objective');if(!statuses.includes(value.status))throw new TypeError('invalid objective status');return {op,objective:value.objective,status:value.status};}
  if(['eq','ne','lt','lte','gt','gte'].includes(op)){
    exact(value,['op','variable','value'],'comparison');const def=reference(vars,value.variable,'variable');
    if(!['eq','ne'].includes(op)&&def.type!=='integer')throw new TypeError('ordered comparison requires integer variable');
    return {op,variable:value.variable,value:scalar(value.value,def)};
  }
  throw new TypeError('unsupported condition operation');
}
function effect(value,vars,objectives,events){
  record(value,'effect');const op=value.op;
  if(op==='set'||op==='add'){
    exact(value,['op','variable','value'],'variable effect');const def=reference(vars,value.variable,'variable');
    if(op==='add'&&def.type!=='integer')throw new TypeError('add requires integer variable');
    return {op,variable:value.variable,value:op==='add'?integer(value.value,-1000000,1000000,'increment'):scalar(value.value,def)};
  }
  if(op==='objective'){exact(value,['op','objective','status'],'objective effect');reference(objectives,value.objective,'objective');if(!statuses.includes(value.status))throw new TypeError('invalid objective status');return {op,objective:value.objective,status:value.status};}
  if(op==='event'){exact(value,['op','event'],'event effect');reference(events,value.event,'event');return {op,event:value.event};}
  throw new TypeError('unsupported effect operation');
}
function normalize(input){
  const s=parse(input,NARRATIVE_BYTES,'story');exact(s,['format','version','id','title','start','maxSteps','variables','objectives','events','nodes'],'story');
  if(s.format!==NARRATIVE_FORMAT||s.version!==1)throw new TypeError('unsupported narrative format/version');
  const variables=list(s.variables,0,32,'variables').map(variable),objectives=list(s.objectives,0,32,'objectives').map(o=>{exact(o,['id','title'],'objective');return {id:id(o.id),title:text(o.title,96,'objective title')};}),events=list(s.events,0,32,'events').map(id);
  unique(variables.map(v=>v.id),'variable');unique(objectives.map(v=>v.id),'objective');unique(events,'event');
  const vars=new Map(variables.map(v=>[v.id,v])),goals=new Map(objectives.map(v=>[v.id,v])),signals=new Map(events.map(v=>[v,v]));
  const effects=a=>list(a,0,16,'effects').map(e=>effect(e,vars,goals,signals));
  const nodes=list(s.nodes,1,128,'nodes').map(n=>{
    exact(n,['id','title','dialogue','ending','onEnter','choices'],'node');if(typeof n.ending!=='boolean')throw new TypeError('ending must be boolean');
    const choices=list(n.choices,0,8,'choices').map(c=>{exact(c,['id','label','target','condition','effects'],'choice');return {id:id(c.id),label:text(c.label,160,'choice label'),target:id(c.target),condition:condition(c.condition,vars,goals),effects:effects(c.effects)};});
    unique(choices.map(c=>c.id),'choice');if(n.ending&&choices.length)throw new TypeError('ending nodes cannot have choices');
    return {id:id(n.id),title:text(n.title,96,'node title'),dialogue:text(n.dialogue,2048,'dialogue',true),ending:n.ending,onEnter:effects(n.onEnter),choices};
  });
  unique(nodes.map(n=>n.id),'node');
  const result={format:NARRATIVE_FORMAT,version:1,id:id(s.id),title:text(s.title,96,'story title'),start:id(s.start),maxSteps:integer(s.maxSteps,1,1024,'maxSteps'),variables,objectives,events,nodes};
  encoded(result,NARRATIVE_BYTES,'story');return result;
}
function analyze(s){
  const byId=new Map(s.nodes.map(n=>[n.id,n])),missingLinks=[];
  if(!byId.has(s.start))missingLinks.push({from:null,choice:null,target:s.start});
  for(const node of s.nodes)for(const c of node.choices)if(!byId.has(c.target))missingLinks.push({from:node.id,choice:c.id,target:c.target});
  const reached=new Set(),pending=[s.start];while(pending.length){const key=pending.pop();if(reached.has(key)||!byId.has(key))continue;reached.add(key);pending.push(...byId.get(key).choices.map(c=>c.target));}
  // Tarjan's SCC traversal reports cycles without unbounded path enumeration.
  let next=0;const indices=new Map(),low=new Map(),stack=[],active=new Set(),cycles=[];
  function visit(key){indices.set(key,next);low.set(key,next++);stack.push(key);active.add(key);
    for(const c of byId.get(key).choices){if(!byId.has(c.target))continue;if(!indices.has(c.target)){visit(c.target);low.set(key,Math.min(low.get(key),low.get(c.target)));}else if(active.has(c.target))low.set(key,Math.min(low.get(key),indices.get(c.target)));}
    if(low.get(key)===indices.get(key)){const group=[];let v;do{v=stack.pop();active.delete(v);group.push(v);}while(v!==key);group.sort();if(group.length>1||byId.get(key).choices.some(c=>c.target===key))cycles.push(group);}
  }
  for(const n of s.nodes)if(!indices.has(n.id))visit(n.id);cycles.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  const unreachable=s.nodes.filter(n=>!reached.has(n.id)).map(n=>n.id),reachableEndings=s.nodes.filter(n=>reached.has(n.id)&&n.ending).map(n=>n.id),warnings=[];
  if(unreachable.length)warnings.push(unreachable.length+' structurally unreachable node(s)');
  if(!reachableEndings.length)warnings.push('No structurally reachable ending');
  if(cycles.length)warnings.push('Cycles require explicit choices and stop at the maxSteps budget');
  if(s.nodes.some(n=>!n.ending&&!n.choices.length))warnings.push('A non-ending node has no outgoing choices');
  warnings.push('Reachability ignores conditions; it is not a proof that an ending can be played');
  return {valid:missingLinks.length===0,missingLinks,unreachable,reachableEndings,cycles,warnings};
}
/** Structural graph diagnostics. Conditions are not satisfiability-solved. */
export function analyzeStory(input){return freeze(analyze(normalize(input)));}
export function validateStory(input){const story=normalize(input);if(!analyze(story).valid)throw new TypeError('story contains a missing start or choice target');return freeze(story);}
export function serializeStory(input){return encoded(validateStory(input),NARRATIVE_BYTES,'story');}
function prepared(input){const story=validateStory(input);return {story,nodes:new Map(story.nodes.map(n=>[n.id,n])),vars:new Map(story.variables.map(v=>[v.id,v]))};}
function test(c,state){
  if(c.op==='always')return true;
  if(c.op==='all')return c.conditions.every(x=>test(x,state));if(c.op==='any')return c.conditions.some(x=>test(x,state));if(c.op==='not')return !test(c.condition,state);
  if(c.op==='objective')return state.objectives[c.objective]===c.status;
  const value=state.variables[c.variable];switch(c.op){case 'eq':return value===c.value;case 'ne':return value!==c.value;case 'lt':return value<c.value;case 'lte':return value<=c.value;case 'gt':return value>c.value;case 'gte':return value>=c.value;default:throw new TypeError('unsupported condition');}
}
function apply(effects,state,p,events){
  for(const e of effects){if(e.op==='event')events.push(e.event);else if(e.op==='objective')state.objectives[e.objective]=e.status;else state.variables[e.variable]=scalar(e.op==='add'?state.variables[e.variable]+e.value:e.value,p.vars.get(e.variable));}
}
function initial(p){const state={node:p.story.start,variables:Object.fromEntries(p.story.variables.map(v=>[v.id,v.initial])),objectives:Object.fromEntries(p.story.objectives.map(v=>[v.id,'inactive'])),steps:0,history:[]},events=[];apply(p.nodes.get(state.node).onEnter,state,p,events);return {state,events};}
function transition(p,old,choiceId,owned=false){
  const node=p.nodes.get(old.node);if(node.ending)throw new RangeError('story has ended');if(old.steps>=p.story.maxSteps)throw new RangeError('story choice budget exhausted');
  const c=node.choices.find(c=>c.id===choiceId);if(!c)throw new TypeError('choice does not exist at current node');if(!test(c.condition,old))throw new RangeError('choice condition is not satisfied');
  const state=owned?old:clone(old),events=[];apply(c.effects,state,p,events);state.node=c.target;state.steps++;state.history.push(c.id);apply(p.nodes.get(state.node).onEnter,state,p,events);return {state,events};
}
function replay(p,history,events=null){let result=initial(p);if(events)events.push(...result.events);for(const choiceId of history){result=transition(p,result.state,choiceId,true);if(events)events.push(...result.events);}return result.state;}
function acceptedState(p,input,events=null){
  exact(input,['node','variables','objectives','steps','history'],'state');id(input.node);integer(input.steps,0,p.story.maxSteps,'state steps');
  exact(input.variables,p.story.variables.map(v=>v.id),'state variables');exact(input.objectives,p.story.objectives.map(v=>v.id),'state objectives');
  for(const v of p.story.variables)scalar(input.variables[v.id],v);for(const o of p.story.objectives)if(!statuses.includes(input.objectives[o.id]))throw new TypeError('invalid objective state');
  const history=list(input.history,0,p.story.maxSteps,'choice history').map(id);if(input.steps!==history.length)throw new TypeError('state history length differs from steps');
  const expected=replay(p,history,events);
  if(input.node!==expected.node||p.story.variables.some(v=>input.variables[v.id]!==expected.variables[v.id])||p.story.objectives.some(o=>input.objectives[o.id]!==expected.objectives[o.id]))throw new TypeError('state does not match deterministic choice history');return expected;
}
/** Returns {state,events}; initial node effects run once in the returned value. */
export function createState(input){return freeze(initial(prepared(input)));}
/** Only eligible choices; caller may separately display locked node choices. */
export function availableChoices(input,state){const p=prepared(input),s=acceptedState(p,state),n=p.nodes.get(s.node);return freeze(n.ending||s.steps>=p.story.maxSteps?[]:n.choices.filter(c=>test(c.condition,s)).map(clone));}
/** Atomic pure transition: invalid choice/effect never mutates the prior state. */
export function choose(input,state,choiceId){const p=prepared(input),s=acceptedState(p,state);id(choiceId);return freeze(transition(p,s,choiceId));}
/** Exact canonical story bytes bind this save, not a probabilistic checksum. */
export function serializeSave(input,state){const p=prepared(input),s=acceptedState(p,state);return encoded({format:NARRATIVE_SAVE_FORMAT,version:1,story:p.story.id,storyIdentity:encoded(p.story,NARRATIVE_BYTES,'story'),history:s.history},NARRATIVE_SAVE_BYTES,'save');}
/** Restores owned state by bounded replay. Does not emit or dispatch events. */
export function restoreSave(input,value){const p=prepared(input),s=parse(value,NARRATIVE_SAVE_BYTES,'save');exact(s,['format','version','story','storyIdentity','history'],'save');if(s.format!==NARRATIVE_SAVE_FORMAT||s.version!==1||s.story!==p.story.id||s.storyIdentity!==encoded(p.story,NARRATIVE_BYTES,'story'))throw new TypeError('save format or exact story identity mismatch');const history=list(s.history,0,p.story.maxSteps,'choice history').map(id);encoded({format:s.format,version:s.version,story:s.story,storyIdentity:s.storyIdentity,history},NARRATIVE_SAVE_BYTES,'save');return freeze(replay(p,history));}

/** Reconstructs bounded inert event IDs in one validated replay. No dispatch. */
export function replayEvents(input,state){const p=prepared(input),events=[];acceptedState(p,state,events);return freeze(events);}
