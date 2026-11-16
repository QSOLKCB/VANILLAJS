// SPDX-License-Identifier: Apache-2.0
import {validateStory,analyzeStory,createState,availableChoices,choose,serializeStory,serializeSave,restoreSave,replayEvents,NARRATIVE_BYTES,NARRATIVE_SAVE_BYTES} from '../../modules/narrative/index.js';
import {lanternStory} from './story.js';
import {LanternView,lanternScene,SCENE_CUES} from './scene.js';
const $=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x));
const tags={a:()=>document.createElement('a'),button:()=>document.createElement('button'),span:()=>document.createElement('span'),strong:()=>document.createElement('strong'),div:()=>document.createElement('div'),small:()=>document.createElement('small'),option:()=>document.createElement('option'),p:()=>document.createElement('p'),li:()=>document.createElement('li'),dt:()=>document.createElement('dt'),dd:()=>document.createElement('dd')};
const element=(tag,text,className)=>{if(!Object.hasOwn(tags,tag))throw Error('Unsupported UI element');const e=tags[tag]();if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
let story=validateStory(lanternStory()),selected=story.start,choiceId=null,current=createState(story),cues=[...current.events],past=[],future=[],generation=0,view=null;
const node=()=>story.nodes.find(n=>n.id===selected);
function report(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function reject(error){report('Not applied: '+error.message,true);}
function scene(){
  const state=lanternScene(cues).state;
  $('scene-label').textContent='THE LANTERN / '+({unlit:'UNLIT',harbor:'HARBOR HOME',courier:'NEW CROSSING',dark:'WAITING FOR DAWN'}[state.ending]);
  $('scene').dataset.cue=state.ending;$('scene').dataset.lit=String(state.lit);
  try{if(!view)view=new LanternView($('scene'));view.load(cues);$('scene-fallback').hidden=true;}
  catch{view?.dispose();view=null;$('scene-fallback').hidden=false;}
}
function resetPreview(){current=createState(story);cues=[...current.events];}
function accept(value,message,select=selected,history=true){
  // Validate and prepare the full next story before replacing any accepted state.
  const next=validateStory(value),nextState=createState(next);
  if(history){past.push(story);if(past.length>20)past.shift();future=[];}
  generation++;story=next;current=nextState;cues=[...nextState.events];selected=story.nodes.some(n=>n.id===select)?select:story.start;choiceId=null;
  refresh();report(message+' Preview restarted; old progress belongs to the previous story.');
}
function edit(fn,message,select=selected){try{const draft=copy(story);fn(draft);accept(draft,message,select);}catch(error){reject(error);}}
function setOptions(select,entries,currentValue){select.replaceChildren(...entries.map(([value,label])=>{const option=element('option',label);option.value=value;return option;}));if(entries.some(e=>e[0]===currentValue))select.value=currentValue;}
function conditionText(c){if(c.op==='always')return 'always';if(c.op==='objective')return c.objective+' is '+c.status;if(['all','any','not'].includes(c.op))return 'advanced '+c.op+' condition';return c.variable+' '+({eq:'is',ne:'is not',lt:'is less than',lte:'is at most',gt:'is greater than',gte:'is at least'}[c.op])+' '+String(c.value);}
function map(){
  const analysis=analyzeStory(story);$('map').replaceChildren();
  for(const [i,n]of story.nodes.entries()){
    const b=element('button',undefined,'node-card'+(n.ending?' ending':'')+(n.id===current.state.node?' is-current':'')+(analysis.unreachable.includes(n.id)?' unreachable':''));b.dataset.node=n.id;b.setAttribute('aria-pressed',String(n.id===selected));
    b.append(element('span',String(i+1).padStart(2,'0')+(n.id===story.start?' / START':''),'node-index'),element('strong',n.title),element('span',n.choices.length?n.choices.map(c=>'↗ '+c.target).join(' · '):'No outgoing choices','node-links'));
    b.addEventListener('click',()=>{selected=n.id;choiceId=null;refresh();});$('map').append(b);
  }
  $('node-count').textContent=story.nodes.length+' NODES';$('graph-summary').textContent=analysis.reachableEndings.length+' structurally reachable ending'+(analysis.reachableEndings.length===1?'':'s')+' · '+analysis.unreachable.length+' unreachable node'+(analysis.unreachable.length===1?'':'s');
  const messages=[...analysis.warnings];if(analysis.cycles.length)messages.push(analysis.cycles.length+' cycle group(s); traversal still stops at '+story.maxSteps+' choices.');
  for(const id of analysis.unreachable)messages.push('Unreachable: '+id);
  for(const id of story.events)if(!SCENE_CUES.includes(id))messages.push('Scene cue has no mapping here: '+id+' (inert).');
  $('diagnostics').replaceChildren(...(messages.length?messages:['Links and bounds accepted.']).map(s=>element('li',s)));
}
function inspector(){
  const n=node();$('selected-id').textContent=n.id;$('node-title').value=n.title;$('dialogue').value=n.dialogue;$('ending').checked=n.ending;
  $('entry-effects').value=JSON.stringify(n.onEnter,null,2);$('set-start').disabled=n.id===story.start;$('delete-node').disabled=n.id===story.start;
  $('choice-list').replaceChildren();
  for(const c of n.choices){
    const row=element('div',undefined,'choice-row');row.dataset.selected=String(c.id===choiceId);
    const text=element('div');text.append(element('strong',c.label),element('small','→ '+c.target+' / '+conditionText(c.condition)));
    const actions=element('div',undefined,'choice-actions'),edit=element('button','Edit'),remove=element('button','Remove');edit.dataset.editChoice=c.id;remove.dataset.removeChoice=c.id;
    edit.addEventListener('click',()=>{choiceId=c.id;inspector();});remove.addEventListener('click',()=>{editStoryChoice(c.id);});actions.append(edit,remove);row.append(text,actions);$('choice-list').append(row);
  }
  if(!n.choices.length)$('choice-list').append(element('p',n.ending?'An ending closes this branch.':'No choices yet. Add a link to another moment.','hint'));
  setOptions($('choice-target'),story.nodes.map(n=>[n.id,n.title]),n.choices.find(c=>c.id===choiceId)?.target);
  const c=n.choices.find(c=>c.id===choiceId);$('choice-form-title').textContent=c?'Edit choice: '+c.id:'Add a choice';$('choice-id').value=c?.id??'';$('choice-label').value=c?.label??'';
  $('condition-op').value=c?(c.condition.op==='always'?'always':['eq','ne','lt','lte','gt','gte','objective'].includes(c.condition.op)?c.condition.op:'preserve'):'always';
  conditionSubjects(c?.condition.variable??c?.condition.objective);$('condition-value').value=c?.condition.value!==undefined?String(c.condition.value):c?.condition.status??'';
  $('effect-op').value=c&&c.effects.length?'preserve':'none';effectSubjects();$('effect-value').value='';
  $('new-choice').disabled=n.ending;$('apply-choice').disabled=n.ending;
}
function editStoryChoice(id){edit(draft=>{const n=draft.nodes.find(n=>n.id===selected);n.choices=n.choices.filter(c=>c.id!==id);},'Choice removed.');}
function conditionSubjects(value){const op=$('condition-op').value;setOptions($('condition-subject'),(op==='objective'?story.objectives:story.variables).map(v=>[v.id,v.id]),value);$('condition-subject').disabled=['always','preserve'].includes(op);$('condition-value').disabled=['always','preserve'].includes(op);}
function effectSubjects(value){const op=$('effect-op').value,entries=op==='event'?story.events.map(id=>[id,id]):(op==='objective'?story.objectives:story.variables.filter(v=>op!=='add'||v.type==='integer')).map(v=>[v.id,v.id]);setOptions($('effect-subject'),entries,value);$('effect-subject').disabled=['none','preserve'].includes(op);$('effect-value').disabled=['none','preserve','event'].includes(op);}
function valueFor(id,text){const v=story.variables.find(v=>v.id===id);if(!v)throw Error('Choose a declared variable.');if(v.type==='boolean'){if(!['true','false'].includes(text.trim()))throw Error('Boolean values must be true or false.');return text.trim()==='true';}if(v.type==='integer'){if(!/^-?\d+$/.test(text.trim()))throw Error('An integer value is required.');return Number(text);}return text;}
function choiceFromForm(){
  const previous=node().choices.find(c=>c.id===choiceId),op=$('condition-op').value,subject=$('condition-subject').value,text=$('condition-value').value;
  let condition;if(op==='preserve'){if(!previous)throw Error('No existing condition to keep.');condition=copy(previous.condition);}else if(op==='always')condition={op:'always'};else if(op==='objective')condition={op,objective:subject,status:text.trim()};else condition={op,variable:subject,value:valueFor(subject,text)};
  const effect=$('effect-op').value,id=$('effect-subject').value,value=$('effect-value').value;let effects=[];
  if(effect==='preserve'){if(!previous)throw Error('No existing effects to keep.');effects=copy(previous.effects);}else if(effect==='event')effects=[{op:effect,event:id}];else if(effect==='objective')effects=[{op:effect,objective:id,status:value.trim()}];else if(effect==='set'||effect==='add')effects=[{op:effect,variable:id,value:valueFor(id,value)}];
  return {id:$('choice-id').value.trim(),label:$('choice-label').value,target:$('choice-target').value,condition,effects};
}
function preview(){
  const s=current.state,n=story.nodes.find(n=>n.id===s.node),eligible=new Set(availableChoices(story,s).map(c=>c.id));
  $('preview-step').textContent=s.steps+' / '+story.maxSteps;$('preview-kind').textContent=n.ending?'AN ENDING / YOUR CHOICE LED HERE':'A MOMENT / '+n.id;$('preview-title').textContent=n.title;$('preview-text').textContent=n.dialogue;
  $('preview-choices').replaceChildren();
  for(const c of n.choices){const b=element('button',c.label);b.dataset.playChoice=c.id;b.disabled=!eligible.has(c.id);if(b.disabled)b.append(element('small',s.steps>=story.maxSteps?'Step budget reached':'Requires '+conditionText(c.condition)));b.addEventListener('click',()=>play(c.id));$('preview-choices').append(b);}
  $('preview-limit').textContent=!n.ending&&s.steps>=story.maxSteps?'Choice budget reached. Restart or restore earlier progress.':'';
  $('state-values').replaceChildren(...Object.entries(s.variables).flatMap(([id,value])=>[element('dt',id),element('dd',String(value))]));
  $('objective-values').replaceChildren(...story.objectives.map(o=>{const p=element('div',o.title+' · '+s.objectives[o.id],'objective');p.dataset.status=s.objectives[o.id];return p;}));
  const emitted=cues.length?cues.slice(-6).join(' → '):'None yet';$('event-note').textContent='Scene cues: '+emitted+'. Preview changes only through the four app-owned mappings.';scene();
}
function play(id){try{const next=choose(story,current.state,id);current=next;cues.push(...next.events);generation++;preview();map();$('preview-title').focus({preventScroll:true});report('Played choice: '+id+'. Only accepted story state and declared effects advanced.');}catch(error){reject(error);}}
function initialValue(){const v=story.variables.find(v=>v.id===$('initial-variable').value);$('initial-value').value=v?String(v.initial):'';$('apply-initial').disabled=!v;}
function refresh(){
  $('story-heading').textContent=story.title;$('story-meta').textContent=story.id+' / '+story.nodes.length+' moments / '+story.maxSteps+' choices maximum';$('story-title').value=story.title;
  $('story-json').value=serializeStory(story);$('undo').disabled=!past.length;$('redo').disabled=!future.length;
  setOptions($('initial-variable'),story.variables.map(v=>[v.id,v.id]),$('initial-variable').value);initialValue();
  $('declarations').replaceChildren(...story.variables.map(v=>element('div',v.id+' · '+v.type+(v.type==='integer'?' ['+v.min+', '+v.max+']':v.type==='string'?' ['+v.values.join(', ')+']':''))));
  map();inspector();preview();
}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=element('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function progressCues(state){return [...replayEvents(story,state)];}
$('add-node').addEventListener('click',()=>{const id=$('new-node-id').value.trim(),title=$('new-node-title').value;edit(draft=>draft.nodes.push({id,title,dialogue:'Write the next moment here.',ending:true,onEnter:[],choices:[]}),'Node created.',id);});
$('apply-node').addEventListener('click',()=>edit(draft=>{const n=draft.nodes.find(n=>n.id===selected);n.title=$('node-title').value;n.dialogue=$('dialogue').value;n.ending=$('ending').checked;},'Node updated.'));
$('set-start').addEventListener('click',()=>edit(draft=>{draft.start=selected;},'Start node changed.'));
$('delete-node').addEventListener('click',()=>edit(draft=>{draft.nodes=draft.nodes.filter(n=>n.id!==selected);},'Node deleted.',story.start));
$('new-choice').addEventListener('click',()=>{choiceId=null;inspector();$('choice-id').focus();});
$('choice-form').addEventListener('submit',event=>{event.preventDefault();try{const choice=choiceFromForm();edit(draft=>{const n=draft.nodes.find(n=>n.id===selected),i=n.choices.findIndex(c=>c.id===choiceId);if(i>=0)n.choices[i]=choice;else n.choices.push(choice);},'Choice validated and linked.');}catch(error){reject(error);}});
$('condition-op').addEventListener('change',()=>conditionSubjects());$('effect-op').addEventListener('change',()=>effectSubjects());
$('apply-entry').addEventListener('click',()=>edit(draft=>{draft.nodes.find(n=>n.id===selected).onEnter=JSON.parse($('entry-effects').value);},'Entry effects validated.'));
$('apply-title').addEventListener('click',()=>edit(draft=>{draft.title=$('story-title').value;},'Story title updated.'));
$('initial-variable').addEventListener('change',initialValue);$('apply-initial').addEventListener('click',()=>edit(draft=>{const id=$('initial-variable').value;draft.variables.find(v=>v.id===id).initial=valueFor(id,$('initial-value').value);},'Initial variable updated.'));
$('apply-json').addEventListener('click',()=>{try{accept($('story-json').value,'Validated story imported.');}catch(error){reject(error);}});
$('undo').addEventListener('click',()=>{if(!past.length)return;const value=past.pop();future.push(story);accept(value,'Undid accepted edit.',selected,false);});
$('redo').addEventListener('click',()=>{if(!future.length)return;const value=future.pop();past.push(story);accept(value,'Redid accepted edit.',selected,false);});
$('example').addEventListener('click',()=>accept(lanternStory(),'Original story restored.','arrival'));
$('restart').addEventListener('click',()=>{generation++;resetPreview();preview();map();report('Story restarted. Authoring edits are preserved.');});
$('export-story').addEventListener('click',()=>{try{download(story.id+'.narrative.json',serializeStory(story));report('Exported validated story data. Keep your game runtime and scene mappings separately.');}catch(error){reject(error);}});
$('export-save').addEventListener('click',()=>{try{download(story.id+'.progress.json',serializeSave(story,current.state));report('Exported progress bound to this exact story.');}catch(error){reject(error);}});
for(const kind of ['story','save'])$('import-'+kind).addEventListener('change',async event=>{
  const file=event.target.files[0],ticket=++generation;if(!file)return;
  try{if(file.size>(kind==='story'?NARRATIVE_BYTES:NARRATIVE_SAVE_BYTES))throw Error(kind==='story'?'Story exceeds 256 KiB.':'Progress exceeds 1 MiB.');const text=await file.text();if(ticket!==generation)return;
    if(kind==='story')accept(text,'Validated story imported.');else{const state=restoreSave(story,text),events=progressCues(state);current={state,events:[]};cues=events;preview();map();report('Progress restored against the exact story; scene cues reconstructed as inert state.');}
  }catch(error){if(ticket===generation)reject(error);}finally{event.target.value='';}
});
window.addEventListener('resize',()=>{try{view?.draw();}catch{view?.dispose();view=null;$('scene-fallback').hidden=false;}});
window.addEventListener('pagehide',event=>{generation++;if(!event.persisted){view?.dispose();view=null;}});
window.addEventListener('pageshow',()=>scene());
$('scene').addEventListener('webglcontextlost',event=>{event.preventDefault();view?.dispose();view=null;$('scene-fallback').hidden=false;});
$('scene').addEventListener('webglcontextrestored',()=>scene());
globalThis.__narrativeFoundry={refresh,snapshot:()=>({story:serializeStory(story),state:copy(current.state),selected,choiceId,cues:[...cues],scene:lanternScene(cues).state,view:view?{...view.stats}:null,history:past.length,future:future.length})};
refresh();report('Ready. Follow the original story, or select a moment to make it your own.');document.documentElement.dataset.labReady='narrative-foundry';
