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
