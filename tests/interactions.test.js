import test from 'node:test';
import assert from 'node:assert/strict';
import {createInteractionResolver} from '../modules/interactions/index.js';
const rule={id:'pulse',match:{source:'pulse',target:'drone'},priority:2,
  requires:[{scope:'target',key:'alive',equals:true,code:'spent',message:'Target is spent.'},
    {scope:'context',key:'shield',equals:false,code:'shielded',message:'Shield is active.'}],
  effects:[{type:'damage',amount:25}],reason:{code:'damage',message:'Hull damaged.'}};
const input={source:{kind:'pulse'},target:{kind:'drone',alive:true},context:{shield:false}};
test('conditions admit effects or return all missing conditions in declared order',()=>{
  const resolver=createInteractionResolver([rule]);assert.equal(resolver.evaluate(input).status,'applied');
  const blocked=resolver.evaluate({...input,target:{kind:'drone',alive:false},context:{shield:true}});
  assert.equal(blocked.status,'blocked');assert.deepEqual(blocked.effects,[]);
  assert.deepEqual(blocked.reasons.map(r=>r.code),['spent','shielded']);
});
test('a blocked higher priority rule cannot fall through to a permissive one',()=>{
  const fallback={...rule,id:'fallback',priority:1,requires:[]};
  for(const rules of [[rule,fallback],[fallback,rule]]){
    const result=createInteractionResolver(rules).evaluate({...input,context:{shield:true}});
    assert.equal(result.ruleId,'pulse');assert.equal(result.status,'blocked');
  }
});
test('equal priorities resolve by id regardless of declaration order',()=>{
  for(const rules of [[{...rule,id:'z'},rule],[rule,{...rule,id:'z'}]])assert.equal(createInteractionResolver(rules).evaluate(input).ruleId,'pulse');
});
test('missing values and inherited properties do not satisfy requirements',()=>{
  const resolver=createInteractionResolver([rule]);
  assert.equal(resolver.evaluate({...input,context:{}}).status,'blocked');
  assert.equal(resolver.evaluate({...input,context:Object.create({shield:false})}).status,'blocked');
  assert.equal(resolver.evaluate({...input,context:{shield:0}}).status,'blocked');
});
test('resistance and unmatched pairs both explain outcomes without effects',()=>{
  const resolver=createInteractionResolver([{...rule,requires:[],outcome:'resisted',effects:[],reason:{code:'resisted',message:'No response.'}}]);
  assert.equal(resolver.evaluate(input).status,'resisted');
  const other=resolver.evaluate({...input,source:{kind:'water'}});
  assert.equal(other.status,'unmatched');assert.equal(other.ruleId,null);assert.deepEqual(other.effects,[]);
});
test('rules are snapshotted and returned effects cannot alter future evaluations',()=>{
  const mutable=structuredClone(rule),args=structuredClone(input),resolver=createInteractionResolver([mutable]);
  mutable.effects[0].amount=999;mutable.requires[0].equals=false;
  const result=resolver.evaluate(args);result.effects[0].amount=1000;result.reasons[0].message='changed';
  assert.deepEqual(args,input);assert.equal(resolver.evaluate(input).effects[0].amount,25);
  assert.equal(resolver.evaluate(input).reasons[0].message,'Hull damaged.');
});
test('invalid declarations and malformed inputs fail at the boundary',()=>{
  for(const rules of [[rule,rule],[{...rule,priority:Infinity}],[{...rule,outcome:'unknown'}],
    [{...rule,effects:[{type:'damage',amount:NaN}]}],[{...rule,requires:[{scope:'other',key:'x',equals:true}]}],
    [{...rule,outcome:'resisted'}],[{...rule,reason:null}]])assert.throws(()=>createInteractionResolver(rules));
  const resolver=createInteractionResolver([rule]);assert.throws(()=>resolver.evaluate());
  assert.throws(()=>resolver.evaluate({...input,source:{}}));
});
