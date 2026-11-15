/* SPDX-License-Identifier: Apache-2.0 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SubHuntController as C} from '../demos/subhunt-lab/js/controller.js';
const pad = (axes=[0,0]) => ({id:'Generic USB SNES', connected:true, mapping:'', axes, buttons:Array.from({length:16},()=>({pressed:false}))});

test('default USB axes, D-pad buttons and action bindings work without standard mapping',()=>{
  const p=pad();p.axes=[-1,1];p.buttons[0].pressed=true;p.buttons[9].pressed=true;
  assert.equal(C.read(p).x,-1);assert.equal(C.read(p).y,1);assert.equal(C.read(p).fire,true);assert.equal(C.read(p).pause,true);
  p.axes=[0,0];p.buttons[15].pressed=true;assert.equal(C.read(p).x,1);
});
test('custom face-button order is honoured without activating old aliases',()=>{
  const profile=C.freshDefault();profile.buttons={fire:3,sonar:2,pause:7,menu:6,restart:0};
  const p=pad();p.buttons[3].pressed=true;assert.equal(C.read(p,profile).fire,true);assert.equal(C.read(p,profile).sonar,false);
  p.buttons[3].pressed=false;p.buttons[7].pressed=true;assert.equal(C.read(p,profile).pause,true);assert.equal(C.read(p,profile).fire,false);
  assert.ok(C.valid(profile));
  p.buttons[7].pressed=false;p.buttons[0].pressed=true;
  assert.equal(C.read(p).fire,true,'omitted profile uses defaults after a custom mapping');
  assert.equal(C.read(p,profile).fire,false);
});
test('calibration captures one pressed button or an arbitrary raw axis',()=>{
  const p=pad([0,0,0,0]);p.buttons[5].pressed=true;assert.deepEqual(C.capture(p,[0,0,0,0]),{kind:'button',index:5});
  p.buttons[6].pressed=true;assert.equal(C.capture(p,[0,0,0,0]),null);
  p.buttons.forEach(b=>b.pressed=false);p.axes[3]=-1;assert.deepEqual(C.capture(p,[0,0,0,0]),{kind:'axis',index:3,value:-1,neutral:0});
  assert.equal(C.released(p,[0,0,0,0]),false);p.axes[3]=0;assert.equal(C.released(p,[0,0,0,0]),true);
});
test('direction bindings support button-only adapters and diagonals',()=>{
  const profile=C.freshDefault();['left','right','up','down'].forEach((key,i)=>profile.directions[key]={kind:'button',index:10+i});
  assert.ok(C.valid(profile));const p=pad([]);p.buttons[10].pressed=p.buttons[12].pressed=true;
  assert.equal(C.read(p,profile).x,-1);assert.equal(C.read(p,profile).y,-1);
  p.buttons[11].pressed=true;assert.equal(C.read(p,profile).x,0);
});
test('direction calibration supports axes beyond the first pair',()=>{
  const profile=C.freshDefault();profile.directions.left.index=profile.directions.right.index=2;profile.directions.up.index=profile.directions.down.index=3;
  const p=pad([1,1,-1,1]);assert.equal(C.read(p,profile).x,-1);assert.equal(C.read(p,profile).y,1);
  p.axes[2]=.1;p.axes[3]=-.12;assert.equal(C.read(p,profile).x,0);assert.equal(C.read(p,profile).y,0);
});
test('learned single-axis hats recognise cardinal and diagonal values and neutral',()=>{
  const profile=C.freshDefault(), values={up:-1,right:-3/7,down:1/7,left:5/7};
  for(const key of C.DIRECTIONS)profile.directions[key]={kind:'axis',index:4,value:values[key],neutral:3};
  assert.ok(C.valid(profile));const p=pad([0,0,0,0,3]);assert.equal(C.read(p,profile).x,0);assert.equal(C.read(p,profile).y,0);
  p.axes[4]=-1;assert.equal(C.read(p,profile).y,-1);assert.equal(C.read(p,profile).x,0);
  p.axes[4]=-5/7;assert.equal(C.read(p,profile).x,1);assert.equal(C.read(p,profile).y,-1);
  p.axes[4]=1;assert.equal(C.read(p,profile).x,-1);assert.equal(C.read(p,profile).y,-1);
});
test('profile validation rejects corrupt, duplicate and nonfinite bindings',()=>{
  assert.equal(C.valid(null),false);assert.equal(C.valid({version:99}),false);
  const p=C.freshDefault();p.buttons.fire=-1;assert.equal(C.valid(p),false);
  const q=C.freshDefault();q.buttons.sonar=q.buttons.fire;assert.equal(C.valid(q),false);
  const r=C.freshDefault();r.directions.left.value=NaN;assert.equal(C.valid(r),false);
  const s=C.freshDefault();s.directions.up={kind:'button',index:s.buttons.fire};assert.equal(C.valid(s),false);
  const t=C.freshDefault();t.directions.right={...t.directions.left};assert.equal(C.valid(t),false);
});
test('missing or disconnected inputs remain neutral',()=>{
  const p=pad([]);p.buttons=[];const controls=C.read(p);assert.equal(controls.x,0);assert.equal(controls.fire,false);
  p.connected=false;p.axes=[1,1];assert.equal(C.read(p).x,0);
});
