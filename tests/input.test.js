import test from 'node:test';
import assert from 'node:assert/strict';
import {Actions,FlightGamepad,deadzone,attachKeyboard} from '../modules/input/index.js';
test('opposing actions cancel; edges fire once and clear removes all held inputs',()=>{
  const a=new Actions();a.set('forward',true);a.set('forward',true);assert.equal(a.consume('forward'),true);assert.equal(a.consume('forward'),false);
  a.set('backward',true);assert.equal(a.flight().thrust[2],0);a.clear();assert.deepEqual(a.flight().thrust,[0,0,0]);
});
test('keyboard handles two bindings for the same action and clears on blur',()=>{
  const target=new EventTarget(),a=new Actions(),binding=attachKeyboard(target,a);
  const key=(type,code)=>{const event=new Event(type);event.code=code;target.dispatchEvent(event);};
  key('keydown','ControlLeft');key('keydown','ControlRight');key('keyup','ControlLeft');assert.equal(a.value('down'),1);
  target.dispatchEvent(new Event('blur'));assert.equal(a.value('down'),0);binding.dispose();key('keydown','KeyW');assert.equal(a.value('forward'),0);
});
function sendKey(target,type,code,repeat=false){
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{code,repeat});target.dispatchEvent(event);return event;
}
for(const [code,action] of [['KeyW','forward'],['ArrowLeft','yawLeft'],['KeyX','brake']]){
  for(const reset of ['clear','blur'])test(`keyboard ${action} requires a fresh press after ${reset}`,()=>{
    const target=new EventTarget(),a=new Actions(),binding=attachKeyboard(target,a);
    sendKey(target,'keydown',code);assert.equal(a.value(action),1);assert.equal(a.consume(action),true);
    if(reset==='clear')binding.clear();else target.dispatchEvent(new Event('blur'));
    for(let i=0;i<3;i++){
      const repeat=sendKey(target,'keydown',code,true);
      assert.equal(a.value(action),0);assert.equal(a.consume(action),false);
      assert.equal(repeat.defaultPrevented,true,'cancel gameplay-key defaults while active');
    }
    sendKey(target,'keyup',code);sendKey(target,'keydown',code);
    assert.equal(a.value(action),1);assert.equal(a.consume(action),true);
    sendKey(target,'keyup',code);assert.equal(a.value(action),0);binding.dispose();
  });
}
test('tracked keyboard repeats keep a held action without creating new press edges',()=>{
  const target=new EventTarget(),a=new Actions(),binding=attachKeyboard(target,a);
  sendKey(target,'keydown','KeyW');assert.equal(a.consume('forward'),true);
  const repeat=sendKey(target,'keydown','KeyW',true);
  assert.equal(a.value('forward'),1);assert.equal(a.consume('forward'),false);assert.equal(repeat.defaultPrevented,true);
  sendKey(target,'keyup','KeyW');assert.equal(a.value('forward'),0);binding.dispose();
});
test('a key first pressed while disabled cannot activate on repeat after enabling',()=>{
  const target=new EventTarget(),a=new Actions();let enabled=false;
  const binding=attachKeyboard(target,a,{enabled:()=>enabled});
  assert.equal(sendKey(target,'keydown','KeyW').defaultPrevented,false);
  enabled=true;sendKey(target,'keydown','KeyW',true);
  assert.equal(a.value('forward'),0);assert.equal(a.consume('forward'),false);
  sendKey(target,'keyup','KeyW');sendKey(target,'keydown','KeyW');assert.equal(a.value('forward'),1);binding.dispose();
});
test('a stale repeat cannot latch another binding of a newly pressed action',()=>{
  const target=new EventTarget(),a=new Actions(),binding=attachKeyboard(target,a);
  sendKey(target,'keydown','ControlLeft');binding.clear();sendKey(target,'keydown','ControlRight');
  assert.equal(a.consume('down'),true);sendKey(target,'keydown','ControlLeft',true);
  assert.equal(a.consume('down'),false);sendKey(target,'keyup','ControlRight');
  assert.equal(a.value('down'),0);binding.dispose();
});
const pad=()=>({id:'test',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0}))});
test('gamepad held input is blocked until neutral after connection and resume',()=>{
  const g=new FlightGamepad(),p=pad();p.axes[1]=-1;assert.equal(g.sample([p]).thrust[2],0);
  p.axes[1]=0;g.sample([p]);p.axes[1]=-1;assert.equal(g.sample([p]).thrust[2],-1);
  g.reset();assert.equal(g.sample([p]).thrust[2],0);
});
test('gamepad pause uses an edge; disconnect and replacement disarm',()=>{
  const g=new FlightGamepad(),p=pad();g.sample([p]);p.buttons[9].value=1;assert.equal(g.sample([p]).pause,true);assert.equal(g.sample([p]).pause,false);
  assert.equal(g.sample([]).connected,false);p.axes[0]=1;assert.equal(g.sample([p]).thrust[0],0);
  p.id='replacement';assert.equal(g.sample([p]).thrust[0],0);
});
test('deadzone rejects invalid samples and unmapped controllers are ignored',()=>{
  assert.equal(deadzone(.1),0);assert.equal(deadzone(NaN),0);assert.equal(deadzone(1),1);
  assert.equal(new FlightGamepad().sample([{...pad(),mapping:''}]).connected,false);
});
test('non-finite controller button values cannot poison flight commands',()=>{
  const g=new FlightGamepad(),p=pad();g.sample([p]);p.buttons[7].value=NaN;
  assert.deepEqual(g.sample([p]).thrust,[0,0,0]);
});
