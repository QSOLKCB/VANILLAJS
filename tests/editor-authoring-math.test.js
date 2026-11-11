// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExactPosition,formatPositionNumber,previewQ16Position,transformExactPositionXY,snapEditorDelta}
  from '../demos/editor/authoring-math.js';
import {createForgeScene} from '../demos/editor/model.js';
import {applyGizmo} from '../demos/editor/gizmos.js';

test('exact XYZ authoring canonicalizes decimals before the explicit Number boundary',()=>{
  const input=['0.100000000000000001','-0.000','1000'];
  const result=parseExactPosition(input);
  assert.deepEqual(result.decimals,['0.100000000000000001','0','1000']);
  assert.deepEqual(result.position,[.1,0,1000]);
  assert.deepEqual(result.fractions,['100000000000000001/1000000000000000000','0','1000']);
  assert.deepEqual(input,['0.100000000000000001','-0.000','1000']);
  assert.deepEqual(parseExactPosition(['-1000','1000','0']).position,[-1000,1000,0]);
});

test('exact intervals reject coordinates that Number rounding would hide beyond the bounds',()=>{
  for(const text of ['1000.000000000000000001','-1000.000000000000000001']){
    assert.equal(Math.abs(Number(text)),1000);
    assert.throws(()=>parseExactPosition([text,'0','0']),/X: position.*closed interval/);
  }
  for(const bad of ['', '1e2', '+1', '01', ' 1', 'NaN', '0.1234567890123456789', 1, null])
    assert.throws(()=>parseExactPosition(['0',bad,'0']),/Y:/);
  for(const bad of [[],['0','0'],['0','0','0','0'],new Array(3),null])
    assert.throws(()=>parseExactPosition(bad),TypeError);
});

test('stored Number formatting expands exponents only within the exact decimal grammar',()=>{
  assert.equal(formatPositionNumber(1e-7),'0.0000001');
  assert.equal(formatPositionNumber(-1e-7),'-0.0000001');
  assert.equal(formatPositionNumber(1e-18),'0.000000000000000001');
  assert.equal(formatPositionNumber(-0),'0');
  assert.equal(formatPositionNumber(1000),'1000');
  for(const value of [1e-19,-1e-19,Number.MIN_VALUE,1.0000000000000001e-7])
    assert.throws(()=>formatPositionNumber(value),/more than 18 decimal places/);
  for(const value of [NaN,Infinity,1001,'1'])
    assert.throws(()=>formatPositionNumber(value),/finite within/);
});

test('Q16 preview exposes signed raw values, quantized decimals and exact errors',()=>{
  assert.deepEqual(previewQ16Position(['0.1','-0.1','0.25'],
    {rounding:'nearest-even',overflow:'reject'}),{
    raw:[6554,-6554,16384],decimals:['0.100006103515625','-0.100006103515625','0.25'],
    errors:['1/163840','-1/163840','0']});
  const half=['0.00000762939453125','-0.00000762939453125','0'];
  assert.deepEqual(previewQ16Position(half,{rounding:'nearest-even',overflow:'reject'}).raw,[0,0,0]);
  assert.deepEqual(previewQ16Position(half,{rounding:'nearest-away',overflow:'reject'}).raw,[1,-1,0]);
  assert.deepEqual(previewQ16Position(half,{rounding:'floor',overflow:'reject'}).raw,[0,-1,0]);
  assert.deepEqual(previewQ16Position(half,{rounding:'ceil',overflow:'reject'}).raw,[1,0,0]);
  assert.deepEqual(previewQ16Position(half,{rounding:'toward-zero',overflow:'reject'}).raw,[0,0,0]);
  assert.deepEqual(previewQ16Position(['0.25','-0.25','0'],{rounding:'exact',overflow:'reject'}).raw,[16384,-16384,0]);
});

test('Q16 preview requires explicit policies and reports inexactness and overflow without mutation',()=>{
  const input=['40000','-40000','0'];
  for(const options of [undefined,{}, {rounding:'floor'}, {rounding:'exact',overflow:'saturate'},
    {rounding:'unknown',overflow:'reject'}])
    assert.throws(()=>previewQ16Position(input,options),TypeError);
  assert.throws(()=>previewQ16Position(input,{rounding:'nearest-even',overflow:'reject'}),/X:.*overflow/);
  assert.throws(()=>previewQ16Position(['0','0.1','0'],{rounding:'exact',overflow:'reject'}),/Y:.*not exactly representable/);
  assert.deepEqual(previewQ16Position(input,{rounding:'nearest-even',overflow:'saturate'}).raw,
    [2147483647,-2147483648,0]);
  assert.deepEqual(input,['40000','-40000','0']);
});

test('D4 transforms only the exact local XY point, preserving Z and documented signs',()=>{
  const expected={e:['2','3','0.1'],r:['-3','2','0.1'],r2:['-2','-3','0.1'],r3:['3','-2','0.1'],
    s:['2','-3','0.1'],rs:['3','2','0.1'],r2s:['-2','3','0.1'],r3s:['-3','-2','0.1']};
  for(const [g,result] of Object.entries(expected))
    assert.deepEqual(transformExactPositionXY(['2','3','0.1'],g).decimals,result);
  let value=['0.100000000000000001','-2','7'];
  for(let i=0;i<4;i++)value=transformExactPositionXY(value,'r').decimals;
  assert.deepEqual(value,['0.100000000000000001','-2','7']);
  assert.deepEqual(transformExactPositionXY(['0','0','0'],'r').position,[0,0,0]);
  assert.throws(()=>transformExactPositionXY(['0','0','0'],'quarter-turn'),TypeError);
  assert.throws(()=>transformExactPositionXY(['1001','0','0'],'r'),/Y: position/);
});

test('decimal snap ties preserve toward-positive-infinity policy without binary division errors',()=>{
  for(const [value,expected] of [[.05,.1],[-.05,0],[.15,.2],[-.15,-.1],[.35,.4],[-.35,-.3]])
    assert.equal(snapEditorDelta(value,.1),expected);
  assert.equal(snapEditorDelta(.15-Number.EPSILON,.1),.1);
  assert.equal(snapEditorDelta(.15+Number.EPSILON,.1),.2);
  assert.equal(snapEditorDelta(-.15-Number.EPSILON,.1),-.2);
  assert.equal(snapEditorDelta(-.15+Number.EPSILON,.1),-.1);
  for(const step of [.1,.25,15]){
    assert.equal(snapEditorDelta(Number.MIN_VALUE,step),0);
    assert.equal(snapEditorDelta(-Number.MIN_VALUE,step),0);
    assert.equal(snapEditorDelta(-0,step),0);
  }
});

test('snaps agree with independent integer millistep reference over signed sweeps',()=>{
  for(const grid of [100,250,15000])for(let millisteps=-2000;millisteps<=2000;millisteps++){
    const expected=Math.floor((millisteps+grid/2)/grid)*grid/1000;
    assert.equal(snapEditorDelta(millisteps/1000,grid/1000),expected);
  }
  for(const bad of [NaN,Infinity,-Infinity,10000.1,-10000.1,'1'])
    assert.throws(()=>snapEditorDelta(bad,.1),RangeError);
  for(const step of [0,-.1,.2,'0.1',null,undefined])
    assert.throws(()=>snapEditorDelta(1,step),RangeError);
  assert.equal(snapEditorDelta(10000,.1),10000);
  assert.equal(snapEditorDelta(-10000,.1),-10000);
});

test('gizmo integration applies decimal snap ties while unsnapped transforms remain available',()=>{
  const scene=createForgeScene(),before=structuredClone(scene);
  assert.equal(applyGizmo(scene,'entity-4','scale','x',.15,{snapping:true}).objects[3].scale[0],1.3);
  assert.equal(applyGizmo(scene,'entity-4','scale','x',-.15,{snapping:true}).objects[3].scale[0],1);
  assert.equal(applyGizmo(scene,'entity-4','scale','x',.15,{snapping:false}).objects[3].scale[0],1.25);
  assert.equal(applyGizmo(scene,'entity-4','move','x',.125,{snapping:true}).objects[3].position[0],3.25);
  assert.equal(applyGizmo(scene,'entity-4','rotate','y',-7.5,{snapping:true}).objects[3].rotationY,0);
  assert.deepEqual(scene,before);
});
