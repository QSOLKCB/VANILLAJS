// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileSoundtrack,validateRecipe,parseRecipe,serializeRecipe,PRESETS,MAX_RECIPE_BYTES} from '../demos/soundtrack-lab/score.js';
import {createSound2D} from '../modules/audio2d/index.js';
const clone=recipe=>JSON.parse(JSON.stringify(recipe));
const hash=data=>createHash('sha256').update(data).digest('hex');

test('E8 coordinate source and musical mapping are separate owned values',()=>{
  // First root is [-1,-1,0,0,0,0,0,0], second [-1,1,0,0,0,0,0,0].
  const recipe=clone(PRESETS.chart);recipe.source={kind:'e8-coordinate',start:0,stride:1,axis:1};recipe.mapping.steps=4;
  const score=compileSoundtrack(recipe);
  assert.deepEqual(score.sources.map(source=>source.coordinate),[-1,1,-1,1]);
  assert.deepEqual(score.sources.map(source=>source.degree),[0,4,0,4]);
  assert.deepEqual(score.events.map(event=>event.frequency),[220,392,220,392]);
  recipe.mapping.frequencies[0]=999;assert.equal(score.recipe.mapping.frequencies[0],220);
  assert.ok(Object.isFrozen(score.sources[0]));assert.ok(Object.isFrozen(score.events[0]));
  const changed=clone(score.recipe);changed.mapping.frequencies=[200,300,400,500,600];
  assert.deepEqual(compileSoundtrack(changed).sources,score.sources,'editing the receiver cannot change source observations');
  assert.notDeepEqual(compileSoundtrack(changed).events,score.events);
});

test('half roots, wrapped traversal and ternary reverse cycles have explicit degrees',()=>{
  const recipe=clone(PRESETS.chart);recipe.source={kind:'e8-coordinate',start:112,stride:1,axis:0};recipe.mapping.steps=4;
  assert.deepEqual(compileSoundtrack(recipe).sources.map(source=>source.coordinate),[.5,-.5,-.5,.5]);
  recipe.source={kind:'e8-coordinate',start:239,stride:239,axis:7};
  assert.deepEqual(compileSoundtrack(recipe).sources.map(source=>source.rootIndex),[239,238,237,236]);
  const ternary=clone(PRESETS.race);ternary.mapping.steps=4;ternary.source={kind:'three-state',start:2,stride:2};
  assert.deepEqual(compileSoundtrack(ternary).sources.map(source=>source.state),[2,1,0,2]);
  assert.deepEqual(compileSoundtrack(ternary).events.map(event=>event.frequency),[440,330,220,440]);
});

test('absolute eighth-note sample boundaries stay bounded and avoid cumulative rounding drift',()=>{
  for(const tempo of [60,61,97,120,137,239,240]){
    const recipe=clone(PRESETS.chart);recipe.mapping.tempo=tempo;
    const score=compileSoundtrack(recipe);
    assert.equal(score.frames,Math.floor(16*48000*30/tempo));
    assert.ok(score.frames<=8*48000);
    for(let i=0;i<16;i++){
      const event=score.events[i],next=Math.floor((i+1)*48000*30/tempo);
      assert.equal(event.sample,Math.floor(i*48000*30/tempo));
      assert.ok(event.sample+event.duration<next);
    }
  }
});

test('recipe and game-score round trips reproduce exact PCM/WAV with independent rendering partitions',()=>{
  for(const preset of Object.values(PRESETS)){
    const score=compileSoundtrack(preset),restored=compileSoundtrack(parseRecipe(serializeRecipe(preset)));
    assert.deepEqual(restored.sources,score.sources);assert.deepEqual(restored.events,score.events);
    assert.equal(hash(restored.sound.wav()),hash(score.sound.wav()));
    const imported=createSound2D(JSON.parse(JSON.stringify({frames:score.frames,events:score.events})));
    assert.deepEqual(imported.renderAll(),score.sound.renderAll());
    const pcm=score.sound.renderAll(),split=12345;
    assert.deepEqual(pcm.slice(0,split),score.sound.renderRange(0,split));
    assert.deepEqual(pcm.slice(split),score.sound.renderRange(split,pcm.length-split));
    assert.ok(pcm.some(sample=>sample!==0));
    const wav=score.sound.wav(),view=new DataView(wav.buffer);
    assert.equal(view.getUint32(24,true),48000);assert.equal(view.getUint16(22,true),1);
    assert.equal(view.getUint16(34,true),16);assert.equal(view.getUint32(40,true),score.frames*2);
  }
});

test('strict version and bounded data reject malformed imports without invoking getters',()=>{
  const variants=[null,[],{}, {...PRESETS.chart,kind:'future'}, {...PRESETS.chart,script:'alert(1)'},
    {...PRESETS.chart,source:{...PRESETS.chart.source,axis:8}},
    {...PRESETS.chart,source:{...PRESETS.chart.source,start:-1}},
    {...PRESETS.chart,source:{...PRESETS.chart.source,stride:0}},
    {...PRESETS.race,source:{kind:'three-state',start:3,stride:1}},
    {...PRESETS.race,source:{kind:'three-state',start:0,stride:1,axis:0}}];
  for(const [field,values] of Object.entries({tempo:[59,241,NaN,Infinity,60.5],steps:[3,17,4.5],gain:[-1,6001],wave:['noise','evil'],frequencies:[[30,40,50],[1,2,3,4,5],[2001,300,400,500,600],Array(5)]}))
    for(const value of values)variants.push({...PRESETS.chart,mapping:{...PRESETS.chart.mapping,[field]:value}});
  for(const bad of variants)assert.throws(()=>compileSoundtrack(bad));
  let invoked=false;const getter={...PRESETS.chart};Object.defineProperty(getter,'mapping',{get(){invoked=true;return PRESETS.chart.mapping;}});
  assert.throws(()=>validateRecipe(getter));assert.equal(invoked,false);
  assert.throws(()=>parseRecipe('{broken'));assert.throws(()=>parseRecipe(' '.repeat(MAX_RECIPE_BYTES+1)));
  assert.throws(()=>parseRecipe('😀'.repeat(1025)));assert.throws(()=>parseRecipe(12));
  assert.deepEqual(parseRecipe(serializeRecipe(PRESETS.chart)),PRESETS.chart);
});

test('silent gain is respected and every preset stays within the existing audio2d budget',()=>{
  const recipe=clone(PRESETS.race);recipe.mapping.gain=0;
  assert.ok(compileSoundtrack(recipe).sound.renderAll().every(value=>value===0));
  for(const preset of Object.values(PRESETS))assert.equal(compileSoundtrack(preset).sound.eventCount,preset.mapping.steps);
});
