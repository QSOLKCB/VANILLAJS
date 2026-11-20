// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSightWorld,querySight,SIGHT_LIMITS} from '../modules/sensing/index.js';

const observer=(position=[0,1.6,8],direction=[0,0,-1])=>({position,direction});
const target=(id,position)=>({id,position});
const block=(id,min,max)=>({id,box:{min,max}});
const basic=()=>createSightWorld({blockers:[block('cover',[-1,0,-1],[1,3,1])],
  targets:[target('alpha',[0,1.6,-8]),target('beta',[7,1.6,-8])]});
const find=(rows,id)=>rows.find(x=>x.id===id);
const same=(world,from,opts={})=>assert.deepEqual(
  querySight(world,from,{...opts,backend:'serial'}),
  querySight(world,from,{...opts,backend:'indexed'}));
test('physical wall occludes a target without obscuring the other',()=>{
  const world=basic(),rows=querySight(world,observer());
  assert.deepEqual(rows.map(r=>[r.id,r.visible,r.reason,r.occluderId]),[
    ['alpha',false,'occluded','cover'],['beta',true,'visible',null]]);
  assert.equal(world.blockerCount,1);assert.equal(world.targetCount,2);
  same(world,observer());
});
test('closed wall surfaces, inside observer and coincident blocker ties',()=>{
  const world=createSightWorld({blockers:[
    block('z-wall',[-1,-1,-2],[1,3,-1]),block('a-wall',[-1,-1,-2],[1,3,-1])],
    targets:[target('front',[0,1,-6]),target('at-edge',[0,1,-1])]});
  const rows=querySight(world,observer([0,1,0]),{range:100,fov:Math.PI*2});
  assert.equal(find(rows,'front').occluderId,'a-wall');
  assert.equal(find(rows,'at-edge').occluderId,'a-wall');
  assert.equal(querySight(world,observer([0,1,-1.5]),{fov:Math.PI*2})[0].reason,'occluded');
  const onBoundary=createSightWorld({blockers:[block('wall',[-1,0,-1],[1,2,1])],
    targets:[target('point',[1,1,1])]});
  assert.equal(querySight(onBoundary,observer([1,1,1]))[0].reason,'occluded');
  same(world,observer([0,1,-1.5]));
});
test('range inclusive, field-of-view boundary inclusive, out-of-cone separate',()=>{
  const world=createSightWorld({blockers:[],targets:[
    target('edge',[1,0,-1]),target('outside',[1.02,0,-1]),target('far',[0,0,-11])]});
  const s=querySight(world,observer([0,0,0]),{range:2,fov:Math.PI/2});
  assert.equal(find(s,'edge').reason,'visible');
  assert.equal(find(s,'outside').reason,'out-of-cone');
  assert.equal(find(s,'far').reason,'out-of-range');
  assert.ok(querySight(world,observer([0,0,0]),{range:0}).every(r=>r.reason==='out-of-range'));
  same(world,observer([0,0,0]),{range:2,fov:Math.PI/2});
});
test('targets sort by distance then stable ASCII ID; results detached and frozen',()=>{
  const world=createSightWorld({blockers:[],targets:[
    target('zulu',[1,0,0]),target('alpha',[-1,0,0]),target('near',[0,0,0])]});
  const s=querySight(world,observer([0,0,0]),{range:10,fov:Math.PI*2});
  assert.deepEqual(s.map(r=>r.id),['near','alpha','zulu']);
  assert.ok(Object.isFrozen(s)&&Object.isFrozen(s[0])&&Object.isFrozen(s[0].position));
  assert.deepEqual(querySight(world,observer([0,0,0]),{range:10,fov:Math.PI*2}),s);
  same(world,observer([0,0,0]),{range:10,fov:Math.PI*2});
});
test('static world owns copies; external edits cannot rewrite perception',()=>{
  const source={blockers:[block('wall',[-1,0,-1],[1,3,1])],targets:[target('a',[0,1,-8])]};
  const world=createSightWorld(source),first=querySight(world,observer());
  source.blockers[0].box.min[0]=999;
  source.targets[0].position[0]=900;
  assert.deepEqual(querySight(world,observer()),first);
  assert.ok(Object.isFrozen(world));
});
test('reject missing, accessor, duplicate, sparse and nonfinite input before reading getters',()=>{
  let reads=0;
  const targetGetter={id:'no'};Object.defineProperty(targetGetter,'position',{enumerable:true,get(){reads++;return [1,1,1];}});
  assert.throws(()=>createSightWorld({blockers:[],targets:[targetGetter]}));
  assert.equal(reads,0);
  assert.throws(()=>createSightWorld({blockers:[],targets:[target('dupe',[1,2,3]),target('dupe',[2,2,3])]}));
  assert.throws(()=>createSightWorld({blockers:[block('dupe',[0,0,0],[1,1,1])],targets:[target('dupe',[0,0,0])]}));
  assert.throws(()=>createSightWorld({blockers:[],targets:[,target('a',[0,1,0])]}));
  assert.throws(()=>createSightWorld({blockers:[],targets:[target('a',[0,Infinity,0])]}));
  assert.throws(()=>createSightWorld({blockers:[],targets:[target('a',[10001,0,0])]}));
  assert.throws(()=>createSightWorld({blockers:[block('bad',[0,0,0],[0,1,1])],targets:[]}));
  assert.throws(()=>createSightWorld({blockers:[],targets:[],surprise:true}));
  const world=basic();
  assert.throws(()=>querySight(world,observer([0,0,0],[0,0,0])));
  assert.throws(()=>querySight(world,observer(),{range:Infinity}));
  assert.throws(()=>querySight(world,observer(),{backend:'gpu'}));
  assert.throws(()=>querySight(world,observer(),{fov:2*Math.PI+1e-8}));
  assert.throws(()=>querySight({},observer()));
  const invalid={position:[0,0,0],direction:[0,0,-1]};
  Object.defineProperty(invalid,'position',{get(){reads++;return [0,0,0]},enumerable:true});
  assert.throws(()=>querySight(world,invalid));assert.equal(reads,0);
});
test('bounded 64 targets and 256 blockers, reject larger arrays',()=>{
  const blockers=Array.from({length:SIGHT_LIMITS.blockers},(_,i)=>block('wall-'+i,[i*2,0,0],[i*2+1,1,1]));
  const targets=Array.from({length:SIGHT_LIMITS.targets},(_,i)=>target('point-'+i,[i,0,-i]));
  const world=createSightWorld({blockers,targets});
  assert.equal(querySight(world,observer()).length,SIGHT_LIMITS.targets);
  assert.throws(()=>createSightWorld({blockers:[...blockers,block('extra',[0,0,0],[1,1,1])],targets:[]}));
  assert.throws(()=>createSightWorld({blockers:[],targets:[...targets,target('extra',[1,1,1])]}));
});
test('seeded independent slab oracle agrees with indexed and serial nearest blockers',()=>{
  // Independent closed-slab oracle, not calling the engine cast or static index.
  function reference(origin,target,boxes){
    const d=target.map((v,i)=>v-origin[i]);
    let nearest=null;
    for(const b of boxes){
      let low=0,high=1,hit=true;
      for(let i=0;i<3;i++){
        if(d[i]===0){if(origin[i]<b.box.min[i]||origin[i]>b.box.max[i]){hit=false;break;}}
        else{
          let a=(b.box.min[i]-origin[i])/d[i],z=(b.box.max[i]-origin[i])/d[i];
          if(a>z)[a,z]=[z,a];
          low=Math.max(low,a);high=Math.min(high,z);
          if(low>high){hit=false;break;}
        }
      }
      if(hit&&high>=0&&low<=1&&(!nearest||low<nearest.time||low===nearest.time&&b.id<nearest.id))
        nearest={id:b.id,time:low};
    }
    return nearest?.id??null;
  }
  let seed=1998;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let trial=0;trial<150;trial++){
    const boxes=Array.from({length:16},(_,i)=>{
      const x=(random()-.5)*30,z=(random()-.5)*30;
      return block('b-'+i,[x,-2,z],[x+.3+random()*3,3,z+.3+random()*3]);
    });
    const point=[(random()-.5)*25,1,(random()-.5)*25],from=observer([0,1,18]);
    const world=createSightWorld({blockers:boxes,targets:[target('subject',point)]});
    const opts={range:200,fov:Math.PI*2};
    same(world,from,opts);
    const result=querySight(world,from,opts)[0];
    const hit=reference(from.position,point,boxes);
    assert.equal(result.occluderId,hit,'independent slab disagreement trial '+trial);
    assert.equal(result.reason,hit?'occluded':'visible');
  }
});
