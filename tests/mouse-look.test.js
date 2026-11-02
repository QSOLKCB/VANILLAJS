import test from 'node:test';
import assert from 'node:assert/strict';
import {attachMouseLook,flightBindings,Actions,attachKeyboard} from '../modules/input/index.js';
import {createBody,lookFlight,stepFlight,flightConfig} from '../modules/flight/index.js';
import {rotate,length,integrateOrientation} from '../modules/math/index.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const zero={pitch:0,yaw:0,primary:false,pressed:false};
function send(target,type,values={}) {
  const event=new Event(type,{cancelable:true});Object.assign(event,values);target.dispatchEvent(event);return event;
}
function rig(options={}) {
  const doc=new EventTarget(),canvas=new EventTarget();let exits=0,requests=0,locks=0,unlocks=0,errors=0,enabled=true;
  doc.pointerLockElement=null;canvas.ownerDocument=doc;canvas.focus=()=>{};canvas.setPointerCapture=()=>{};
  doc.exitPointerLock=()=>{exits++;doc.pointerLockElement=null;send(doc,'pointerlockchange');};
  canvas.requestPointerLock=()=>{requests++;};
  const input=attachMouseLook(canvas,{enabled:()=>enabled,onLock:()=>locks++,onUnlock:()=>unlocks++,onError:()=>errors++,...options});
  const down=(extra={})=>send(canvas,'pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:100,...extra});
  const lock=()=>{doc.pointerLockElement=canvas;send(doc,'pointerlockchange');};
  const up=()=>{send(canvas,'pointerup',{pointerId:1});send(doc,'mouseup',{button:0});};
  const move=(x,y)=>send(doc,'mousemove',{movementX:x,movementY:y});
  return {doc,canvas,input,down,up,lock,move,setEnabled:value=>enabled=value,get counts(){return {exits,requests,locks,unlocks,errors};}};
}
test('relative mouse samples accumulate once; stationary input adds no turning',()=>{
  const r=rig();r.down();r.lock();r.up();r.move(40,-20);r.move(20,-10);
  const s=r.input.consume();near(s.yaw,-.15);near(s.pitch,.075);assert.deepEqual(r.input.consume(),zero);
  r.move(NaN,2);r.move(0,Infinity);assert.deepEqual(r.input.consume(),zero);r.input.dispose();
});
test('capture click never fires; short and held captured clicks survive ticks',()=>{
  const r=rig();r.down();r.lock();send(r.doc,'mousedown',{button:0});assert.deepEqual(r.input.consume(),zero);r.up();
  send(r.doc,'mousedown',{button:0});send(r.doc,'mouseup',{button:0});assert.equal(r.input.consume().pressed,true);assert.deepEqual(r.input.consume(),zero);
  send(r.doc,'mousedown',{button:0});assert.deepEqual(r.input.consume(),{...zero,primary:true,pressed:true});
  assert.deepEqual(r.input.consume(),{...zero,primary:true});r.input.release();assert.deepEqual(r.input.consume(),zero);r.input.dispose();
});
test('a capture arriving after mouseup does not swallow the first firing click',()=>{
  const r=rig();r.down();r.up();r.lock();send(r.doc,'mousedown',{button:0});assert.equal(r.input.consume().pressed,true);r.input.dispose();
});
test('unexpected unlock cancels motion and firing; deliberate release has no unlock callback',()=>{
  const r=rig();r.down();r.lock();r.up();r.move(10,10);send(r.doc,'mousedown',{button:0});
  r.doc.exitPointerLock();assert.equal(r.counts.unlocks,1);assert.deepEqual(r.input.consume(),zero);
  r.down();r.lock();r.up();r.input.release();assert.equal(r.counts.unlocks,1);assert.deepEqual(r.input.consume(),zero);r.input.dispose();
});
for(const action of ['release','disable','dispose'])test(`late legacy capture after ${action} is exited immediately`,()=>{
  const r=rig();r.down();r.up();
  if(action==='disable')r.setEnabled(false);else r.input[action]();
  r.lock();assert.equal(r.doc.pointerLockElement,null);assert.equal(r.counts.locks,0);assert.equal(r.counts.exits,1);r.input.dispose();
});
test('rejected capture reports once and permits relative drag fallback',async()=>{
  const r=rig();r.canvas.requestPointerLock=()=>Promise.reject(new Error('denied'));r.down();await Promise.resolve();
  send(r.doc,'pointerlockerror');assert.equal(r.counts.errors,1);
  send(r.canvas,'pointermove',{pointerId:1,clientX:120,clientY:90});let s=r.input.consume();near(s.yaw,-.05);near(s.pitch,.025);
  send(r.canvas,'pointermove',{pointerId:1,clientX:120,clientY:90});assert.deepEqual(r.input.consume(),zero);
  r.up();send(r.canvas,'pointermove',{pointerId:1,clientX:500,clientY:90});assert.deepEqual(r.input.consume(),zero);r.input.dispose();
});
test('touch drag is relative, single pointer and cancelled on pause without capture requests',()=>{
  const r=rig();r.down({pointerType:'touch'});r.down({pointerId:2,pointerType:'touch'});
  send(r.canvas,'pointermove',{pointerId:2,clientX:150,clientY:150});assert.deepEqual(r.input.consume(),zero);
  send(r.canvas,'pointermove',{pointerId:1,clientX:150,clientY:100});near(r.input.consume().yaw,-.125);
  r.input.release();send(r.canvas,'pointermove',{pointerId:1,clientX:200,clientY:100});assert.deepEqual(r.input.consume(),zero);
  assert.equal(r.counts.requests,0);r.input.dispose();r.down();assert.equal(r.counts.requests,0);
});
test('disabled adapter ignores input; missing capture API falls back; invalid sensitivity fails',()=>{
  const r=rig();r.setEnabled(false);r.down();assert.equal(r.counts.requests,0);r.setEnabled(true);
  r.canvas.requestPointerLock=undefined;r.down();assert.equal(r.counts.errors,1);r.input.dispose();
  for(const sensitivity of [0,-1,NaN,Infinity])assert.throws(()=>attachMouseLook(r.canvas,{sensitivity}),RangeError);
});
test('pointer cancellation discards pending look while a brief released drag survives until a tick',()=>{
  const r=rig();r.down({pointerType:'touch'});
  send(r.canvas,'pointermove',{pointerId:1,clientX:120,clientY:100});send(r.canvas,'pointercancel',{pointerId:1});
  assert.deepEqual(r.input.consume(),zero);r.down({pointerType:'touch'});
  send(r.canvas,'pointermove',{pointerId:1,clientX:120,clientY:100});r.up();near(r.input.consume().yaw,-.05);r.input.dispose();
});
test('mouse right looks right and mouse up looks up with a level horizon',()=>{
  const b=createBody();lookFlight(b,{yaw:-Math.PI/2,pitch:Math.PI/6});const f=rotate(b.orientation,[0,0,-1]);
  near(f[0],Math.cos(Math.PI/6));near(f[1],.5);near(f[2],0);near(rotate(b.orientation,[1,0,0])[1],0);near(length(b.orientation),1);
});
test('mouse takeover levels roll and cancels spin without changing translation',()=>{
  const b=createBody({position:[1,2,3],velocity:[4,5,6],angularVelocity:[1,2,3],orientation:integrateOrientation([0,0,0,1],[0,0,1],.7)});
  lookFlight(b);const q=[...b.orientation];assert.deepEqual(b.velocity,[4,5,6]);assert.deepEqual(b.position,[1,2,3]);
  near(rotate(b.orientation,[1,0,0])[1],0);
  for(let i=0;i<600;i++)stepFlight(b,{},1/120,flightConfig());
  assert.deepEqual(b.orientation,q);assert.deepEqual(b.angularVelocity,[0,0,0]);assert.deepEqual(b.velocity,[4,5,6]);
});
test('look clamps pitch without flipping, remains normalized and rejects invalid angles atomically',()=>{
  const b=createBody();lookFlight(b,{pitch:10});near(rotate(b.orientation,[0,0,-1])[1],Math.cos(.01));
  lookFlight(b,{pitch:-20,yaw:1e100});near(rotate(b.orientation,[0,0,-1])[1],-Math.cos(.01));near(length(b.orientation),1);
  const before=structuredClone(b);assert.throws(()=>lookFlight(b,{yaw:NaN}));assert.deepEqual(b,before);
});
test('WASD, arrows and roll keys retain their original bindings and torque behaviour',()=>{
  const target=new EventTarget(),actions=new Actions(),keys=attachKeyboard(target,actions);
  for(const [code,vector,axis,value] of [['KeyW','thrust',2,-1],['KeyS','thrust',2,1],['KeyA','thrust',0,-1],['KeyD','thrust',0,1],
    ['ArrowUp','turn',0,1],['ArrowDown','turn',0,-1],['ArrowLeft','turn',1,1],['ArrowRight','turn',1,-1],['KeyQ','turn',2,1],['KeyE','turn',2,-1]]){
    send(target,'keydown',{code});assert.equal(actions.flight()[vector][axis],value);send(target,'keyup',{code});
  }
  assert.equal(flightBindings.ArrowUp,'pitchUp');const b=createBody();stepFlight(b,{turn:[0,1,0]},1/120,flightConfig());
  assert.ok(b.angularVelocity[1]>0);keys.dispose();
});
