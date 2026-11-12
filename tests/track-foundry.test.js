// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODES,createRace,stepRace} from '../demos/racing-lab/world.js';
import {sceneGeometry} from '../demos/racing-lab/geometry.js';
import {setupTrackFoundry} from '../demos/racing-lab/track-editor.js';
import {TRACK_FORMAT,TRACK_TOTAL_LENGTH,SECTION_LENGTH,MAX_TRACK_BYTES,
  starterTrack,validateTrack,serializeTrack,parseTrackJSON,
  trackCenter,trackHalfWidth,trackHeading,environmentTheme} from '../demos/racing-lab/track.js';

const copy=source=>JSON.parse(JSON.stringify(source));
const starter=()=>copy(starterTrack());
test('RACING-002B starter pack strictly validates and roundtrips as inert JSON',()=>{
  const p=starterTrack();
  assert.equal(p.format,TRACK_FORMAT);
  assert.equal(p.sections.length,4);
  assert.equal(p.gates.length,8);
  assert.equal(TRACK_TOTAL_LENGTH,SECTION_LENGTH*4);
  assert.equal(Object.isFrozen(p),true);
  assert.equal(Object.isFrozen(p.sections),true);
  assert.equal(Object.isFrozen(p.gates[0]),true);
  const encoded=serializeTrack(p);
  assert.ok(Buffer.byteLength(encoded,'utf8')<=MAX_TRACK_BYTES);
  assert.deepEqual(parseTrackJSON(encoded),p);
  assert.deepEqual(validateTrack(copy(p)),p);
  assert.deepEqual(environmentTheme('forest').land,[.19,.38,.28]);
  assert.throws(()=>environmentTheme('__proto__'),RangeError);
});
test('RACING-002B rejects malformed packs, exotic prototypes, getters and injected properties',()=>{
  const bad=(change)=>{const p=starter();change(p);assert.throws(()=>validateTrack(p));};
  bad(p=>p.format='other');
  bad(p=>p.version=2);
  bad(p=>p.name='<script>');
  bad(p=>p.environment='invalid');
  bad(p=>p.sections.length=3);
  bad(p=>p.sections[0].curve=Infinity);
  bad(p=>p.sections[2].width=2);
  bad(p=>p.sections[3].fork=99);
  bad(p=>p.sections[0].spoof=true);
  bad(p=>p.gates[0].x=NaN);
  bad(p=>p.gates[1].z=1000);
  bad(p=>p.gates[1]={...p.gates[0]});
  bad(p=>p.gates[0].evil=true);
  bad(p=>Object.assign(p,{__marker:'unexpected'}));
  bad(p=>Object.setPrototypeOf(p,{secret:1}));
  bad(p=>Object.defineProperty(p.sections[0],'curve',{get(){throw Error('getter was executed');}}));
  assert.throws(()=>parseTrackJSON('{'),SyntaxError);
  assert.throws(()=>parseTrackJSON('x'.repeat(MAX_TRACK_BYTES+1)),RangeError);
  const hostile=starter();
  Object.defineProperty(hostile,'__proto__',{value:{bad:1},enumerable:true});
  assert.throws(()=>parseTrackJSON(JSON.stringify(hostile)));
});
test('RACING-002B rejects crossing circuit gates and degenerate layout segments',()=>{
  const p=starter();
  p.gates[1]=copy(p.gates[0]);
  assert.throws(()=>validateTrack(p),/at least 12/);
  const crossed=starter();
  // A bow-tie of distant nonadjacent edges should fail closed.
  crossed.gates=[
    {x:-45,z:-45},{x:45,z:45},{x:45,z:-45},{x:-45,z:45},
    {x:-45,z:58},{x:0,z:68},{x:45,z:58},{x:0,z:-68}
  ];
  assert.throws(()=>validateTrack(crossed),/cross/);
});
test('RACING-002B authored forks change physical road position but remain continuous',()=>{
  const p=starterTrack();
  const left=['left'],right=['right'];
  assert.equal(trackCenter(p,0),0);
  const before=trackCenter(p,SECTION_LENGTH-.0001,[]);
  const at=trackCenter(p,SECTION_LENGTH,left);
  assert.ok(Math.abs(before-at)<.01,'section seam must be continuous');
  const a=trackCenter(p,SECTION_LENGTH+260,left);
  const b=trackCenter(p,SECTION_LENGTH+260,right);
  assert.ok(Math.abs(a-b)>=p.sections[0].fork*1.9,'left/right roads must diverge in the actual centreline');
  for(const route of [[],left,right,['left','right'],['right','left','right']]){
    for(let s=0;s<=TRACK_TOTAL_LENGTH;s+=20){
      assert.ok(Number.isFinite(trackCenter(p,s,route)));
      assert.ok(Number.isFinite(trackHeading(p,s,route)));
      assert.ok(trackHalfWidth(p,s)>=8&&trackHalfWidth(p,s)<=16);
      if(s>0&&s<TRACK_TOTAL_LENGTH){
        const before=trackCenter(p,s-.00001,route),after=trackCenter(p,s+.00001,route);
        assert.ok(Math.abs(before-after)<.01,'no impossible teleports at sections');
      }
    }
  }
  assert.throws(()=>trackCenter(p,50,['wrong']),TypeError);
  assert.throws(()=>trackCenter(p,NaN),RangeError);
});
test('RACING-002B input packs are owned; no references from the caller enter simulation',()=>{
  const source=starter();
  const world=createRace('tour',source);
  source.sections[0].width=8;
  source.gates[0].x=65;
  assert.equal(world.track.sections[0].width,12);
  assert.equal(world.track.gates[0].x,0);
  assert.equal(Object.isFrozen(world.track.sections[0]),true);
  assert.deepEqual(createRace('tour',starterTrack()),createRace('tour',starterTrack()));
  assert.throws(()=>createRace('derby',starter()),RangeError);
});
test('RACING-002B authored tour selects forks relative to the real roadway',()=>{
  const w=createRace('tour',starter());w.bots=[];
  w.distance=SECTION_LENGTH-.5;w.player.speed=70;
  w.player.x=trackCenter(w.track,SECTION_LENGTH,[])-3;
  stepRace(w,{throttle:1});
  assert.deepEqual(w.route,['left']);
  const left=trackCenter(w.track,SECTION_LENGTH+300,w.route);
  const right=trackCenter(w.track,SECTION_LENGTH+300,['right']);
  assert.notEqual(left,right);
});
test('RACING-002B authored 4.8 km sprint checks physical width at finish',()=>{
  const p=starter();
  const w=createRace('sprint',p);w.bots=[];
  w.player.z=-TRACK_TOTAL_LENGTH+.1;
  w.player.x=trackCenter(w.track,TRACK_TOTAL_LENGTH);
  w.player.speed=35;w.player.vz=-35;
  stepRace(w,{throttle:1});
  assert.equal(w.finished,true);
  assert.equal(w.result,'COASTAL SPRINT FINISHED');
  assert.equal(w.player.lap,4);
  const outside=createRace('sprint',p);outside.bots=[];
  outside.player.z=-TRACK_TOTAL_LENGTH+.1;
  outside.player.x=trackCenter(outside.track,TRACK_TOTAL_LENGTH)+20;
  outside.player.vz=-35;outside.player.speed=35;
  stepRace(outside,{throttle:1});
  assert.equal(outside.finished,false);
});
test('RACING-002B circuit points drive both the checkpoints and the road geometry',()=>{
  const p=starter();
  const altered=starter();altered.gates[2].x=56;
  const w=createRace('circuit',altered);w.bots=[];
  assert.equal(w.track.gates[2].x,56);
  for(let lap=0;lap<3;lap++)
    for(let i=1;i<=8;i++){
      const g=altered.gates[i%8];
      w.player.x=g.x;w.player.z=g.z;w.player.speed=0;
      stepRace(w,{});
    }
  assert.equal(w.finished,true);
  const scene=sceneGeometry('circuit',w.track);
  const other=sceneGeometry('circuit',p);
  assert.notDeepEqual(scene,other,'edited gates must change the visible racing track');
  assert.ok(scene.every(Number.isFinite));
});
test('RACING-002B generated geometry stays bounded and finite for authored sprint',()=>{
  const p=starter();
  const scene=sceneGeometry('sprint',p);
  assert.ok(scene.length>0&&scene.length<250000);
  assert.ok(scene.every(Number.isFinite));
  assert.ok(MODES.includes('tour')&&MODES.includes('sprint'));
});
test('RACING-002B editor controls and safety boundaries ship in the game',async()=>{
  assert.equal(typeof setupTrackFoundry,'function','editor module must link in Node without browser globals');
  const [html,app,editor]=await Promise.all([
    readFile(new URL('../demos/racing-lab/index.html',import.meta.url),'utf8'),
    readFile(new URL('../demos/racing-lab/app.js',import.meta.url),'utf8'),
    readFile(new URL('../demos/racing-lab/track-editor.js',import.meta.url),'utf8')
  ]);
  for(const id of ['track-foundry','track-name','track-environment','track-target',
    'track-sections','track-gates','track-preview','track-apply','track-clear',
    'track-new','track-import','track-export','track-message'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/setupTrackFoundry/);
  assert.match(editor,/parseTrackJSON/);
  assert.match(editor,/generation/,'late imports cannot replace newer drafts');
  assert.doesNotMatch(editor,/\b(?:eval|Function)\s*\(/);
});
