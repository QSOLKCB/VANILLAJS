// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGamepadMapper,defaultGamepadProfile,validateGamepadProfile,captureGamepadBinding,gamepadReleased} from '../modules/gamepad/index.js';
const sample=()=>({connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))});
test('gamepad actions are game-owned and compiled profiles are isolated from caller mutation',()=>{
  const source=JSON.parse(JSON.stringify(defaultGamepadProfile({jump:0,attack:1,pause:9}))),mapper=createGamepadMapper(source),pad=sample();
  source.buttons.jump=3;source.directions.left.value=1;pad.buttons[0].pressed=true;pad.axes[0]=-1;
  assert.deepEqual(mapper.read(pad),{x:-1,y:0,jump:true,attack:false,pause:false});
  assert.ok(Object.isFrozen(mapper.profile.directions.left));
  assert.equal(mapper.read({...pad,connected:false}).jump,false);
  assert.equal(mapper.read(null).x,0);
});
test('malformed profiles fail before accessors execute and cannot override x/y or prototypes',()=>{
  for(const input of [null,[],{},Object.create(defaultGamepadProfile()),{...defaultGamepadProfile(),version:2}])assert.throws(()=>validateGamepadProfile(input));
  let calls=0;const input={version:1,get buttons(){calls++;return {};},directions:{}};
  assert.throws(()=>validateGamepadProfile(input));assert.equal(calls,0);
  for(const buttons of [{x:0},{constructor:0},{jump:128},{jump:0,fire:0}])assert.throws(()=>defaultGamepadProfile(buttons));
  const conflict=JSON.parse(JSON.stringify(defaultGamepadProfile()));conflict.directions.left.neutral=3;assert.throws(()=>validateGamepadProfile(conflict));
});
test('calibration refuses oversized samples, ambiguous inputs and unconfirmed centres',()=>{
  const p=sample();p.buttons[2].pressed=true;
  assert.equal(captureGamepadBinding(p,[]),null);assert.equal(gamepadReleased(p,[]),false);
  assert.deepEqual(captureGamepadBinding(p,[0,0]),{kind:'button',index:2});
  p.buttons[3].pressed=true;assert.equal(captureGamepadBinding(p,[0,0]),null);
  p.buttons=[];p.axes=[0,0,0];assert.equal(captureGamepadBinding(p,[0,0]),null);
  p.axes=Array(33).fill(0);assert.equal(createGamepadMapper().read(p).x,0);
  assert.equal(gamepadReleased(p,p.axes),false);
});
test('nonzero raw hat centre, diagonals, buttons and disconnected samples retain donor behaviour',()=>{
  const profile=JSON.parse(JSON.stringify(defaultGamepadProfile())),values={up:-1,right:-3/7,down:1/7,left:5/7};
  for(const key of Object.keys(values))profile.directions[key]={kind:'axis',index:0,value:values[key],neutral:3};
  const mapper=createGamepadMapper(profile),p=sample();p.axes=[3];assert.equal(mapper.read(p).y,0);assert.equal(gamepadReleased(p,[3]),true);
  p.axes=[-5/7];assert.deepEqual([mapper.read(p).x,mapper.read(p).y],[1,-1]);
  p.axes=[1];assert.deepEqual([mapper.read(p).x,mapper.read(p).y],[-1,-1]);
  p.axes=[Infinity];assert.equal(mapper.read(p).x,0);
});
