import test from 'node:test';
import assert from 'node:assert/strict';
import {aabb} from '../modules/collision/index.js';
import {createCharacter,characterConfig,stepCharacter,characterView} from '../modules/character/index.js';
import {Actions,attachKeyboard,fpsBindings} from '../modules/input/index.js';
const dt=1/120,config=characterConfig(),floor=aabb([-20,-1,-50],[20,0,20]);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const advance=(body,count,input={},boxes=[floor])=>{let result;for(let i=0;i<count;i++)result=stepCharacter(body,input,dt,config,boxes);return result;};
test('crouch anchors the feet and lowers both collider and eye, then restores standing dimensions',()=>{
  const c=createCharacter();advance(c,1);const feet=[...c.position];advance(c,120,{crouch:true});
  assert.equal(c.crouched,true);near(c.halfExtents[1]*2,1.08);near(characterView(c).position[1]-c.position[1],.972);c.position.forEach((v,i)=>near(v,feet[i]));
  const standing=advance(c,1);assert.equal(standing.standBlocked,false);assert.equal(c.crouched,false);near(c.halfExtents[1]*2,1.8);near(c.eyeHeight,1.62);
});
test('a low roof blocks standing without moving the feet; leaving it safely restores height',()=>{
  const roof=aabb([-2,1.25,-5],[2,3,2]),c=createCharacter();advance(c,1,{crouch:true},[floor,roof]);
  const feet=[...c.position],blocked=advance(c,1,{},[floor,roof]);assert.equal(blocked.standBlocked,true);assert.equal(c.crouched,true);
  c.position.forEach((v,i)=>near(v,feet[i]));near(c.velocity[1],0);
  advance(c,160,{move:[0,1]},[floor,roof]);assert.ok(c.position[2]>2.35);assert.equal(c.crouched,false);assert.equal(c.grounded,true);
});
test('crouched sprint stays at crouch speed and diagonals remain normalized',()=>{
  for(const move of [[0,-1],[1,-1]]){const c=createCharacter();advance(c,120,{move,sprint:true,crouch:true});near(Math.hypot(c.velocity[0],c.velocity[2]),2.5);}
});
test('stance changes in air keep the feet trajectory; a crouched jump still collides with a ceiling',()=>{
  const a=createCharacter({position:[0,4,0],velocity:[1,2,0]}),b=createCharacter({position:[0,4,0],velocity:[1,2,0]});
  advance(a,1,{crouch:true},[]);advance(b,1,{},[]);assert.deepEqual(a.position,b.position);assert.deepEqual(a.velocity,b.velocity);
  const roof=aabb([-3,1.25,-3],[3,3,3]),c=createCharacter();advance(c,1,{crouch:true},[floor,roof]);
  stepCharacter(c,{crouch:true,jump:true},dt,config,[floor,roof]);let apex=0;
  for(let i=0;i<120;i++){advance(c,1,{crouch:true},[floor,roof]);apex=Math.max(apex,c.position[1]);assert.ok(c.position[1]+2*c.halfExtents[1]<=1.25+1e-5);}
  assert.ok(apex>0);assert.equal(c.grounded,true);
});
test('growing is blocked by partial overhangs but exact face contact is legal',()=>{
  const c=createCharacter();advance(c,1,{crouch:true});const roof=aabb([.3,1.4,-1],[2,3,1]);
  assert.equal(advance(c,1,{},[floor,roof]).standBlocked,true);
  const tangent=aabb([.35,1.4,-1],[2,3,1]);assert.equal(advance(c,1,{},[floor,tangent]).standBlocked,false);assert.equal(c.crouched,false);
});
test('custom stance dimensions validate; zero ticks and invalid queries cannot half-change a stance',()=>{
  const c=createCharacter({halfExtents:[.4,1,.4],eyeHeight:1.8,crouchHalfHeight:.6,crouchEyeHeight:1});advance(c,1,{crouch:true});near(c.eyeHeight,1);
  const before=structuredClone(c);stepCharacter(c,{},0,config,[floor]);assert.deepEqual(c,before);
  assert.throws(()=>stepCharacter(c,{},dt,config,[{min:[0,2,0],max:[NaN,3,2]}]));assert.deepEqual(c,before);
  assert.throws(()=>stepCharacter(c,{crouch:true,move:[NaN,0]},dt,config,[floor]));assert.deepEqual(c,before);
  for(const options of [{crouchHalfHeight:0},{crouchHalfHeight:.9},{crouchEyeHeight:2},{crouchEyeHeight:NaN}])assert.throws(()=>createCharacter(options));
  assert.throws(()=>characterConfig({crouchSpeed:-1}));
});
test('C is held crouch; cancelled input cannot re-arm from keyboard repeat',()=>{
  const target=new EventTarget(),actions=new Actions(),keys=attachKeyboard(target,actions,{bindings:fpsBindings});
  const send=(type,repeat=false)=>{const e=new Event(type);Object.assign(e,{code:'KeyC',repeat});target.dispatchEvent(e);};
  send('keydown');assert.equal(actions.value('crouch'),1);keys.clear();send('keydown',true);assert.equal(actions.value('crouch'),0);
  send('keyup');send('keydown');assert.equal(actions.value('crouch'),1);target.dispatchEvent(new Event('blur'));assert.equal(actions.value('crouch'),0);keys.dispose();
});
