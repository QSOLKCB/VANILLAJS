// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppearance,seedAppearance,emitAppearance,emitAppearanceToStream}
  from '../modules/appearance/index.js';
import {CuboidStream} from '../modules/cuboid-stream/index.js';
import {readFileSync} from 'node:fs';

const palette=[[.2,.3,.4],[.4,.5,.6],[.6,.7,.8],[1,0,0],[.9,.6,.4]];
const input=()=>({
  palette:palette.map(x=>[...x]),
  slots:['cloth','accent','skin'],
  colours:[0,3,4],
  variants:{cloth:[0,1,2]},
  bounds:{height:1.9,halfWidth:.5,minZ:-.7,maxZ:.7,headBand:.82},
  parts:[
    {x:0,y:.8,z:0,w:.4,h:.8,d:.3,slot:'cloth',gaitZ:.15},
    {x:0,y:1.64,z:0,w:.24,h:.3,d:.25,slot:'skin',head:true},
    {x:0,y:1.64,z:-.14,w:.2,h:.03,d:.02,slot:'accent',detail:'high',glow:.8}
  ],
  fallen:[
    {x:0,y:.12,z:.1,w:.4,h:.2,d:.42,slot:'cloth'}
  ]
});
const make=()=>createAppearance(input());
const collect=(m,pose)=>{const parts=[];const n=emitAppearance(m,(...args)=>parts.push(args),pose);assert.equal(parts.length,n);return parts;};
const approximate=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,'expected '+a+' ≈ '+b);

test('copy-owned LUT and descriptors cannot be altered by game source arrays',()=>{
  const src=input(),model=createAppearance(src),raw=collect(model,{id:42});
  src.palette[0][0]=999;src.parts[0].w=999;src.colours[0]=3;src.variants.cloth[0]=3;
  assert.deepEqual(collect(model,{id:42}),raw);
  assert.ok(Object.isFrozen(model)&&Object.isFrozen(model.palette));
  assert.ok(Object.isFrozen(model.palette[0]));
  assert.ok(Object.isFrozen(model.parts[0]));
  assert.throws(()=>{model.palette[0][0]=.123},TypeError);
  assert.equal(model.palette.length,5);
  assert.equal(model.slots.length,3);
});

test('palette byte-index selections are deterministic for identical actor IDs',()=>{
  const model=make(),baseline=collect(model,{id:712});
  assert.deepEqual(baseline,collect(model,{id:712}));
  assert.deepEqual(seedAppearance(712),seedAppearance(712));
  assert.ok(seedAppearance(712).every(w=>Number.isInteger(w)&&w>=0&&w<=65535));
  const looks=new Set();
  for(let i=1;i<=90;i++)looks.add(collect(model,{id:i})[0][6].join(','));
  assert.equal(looks.size,3,'all 3 cloth variants should occur');
  for(let id=1;id<=90;id++){
    const parts=collect(model,{id}),colors=parts.map(x=>x[6]);
    assert.equal(colors[2],model.palette[3],'accent must remain invariant');
    assert.equal(colors[1],model.palette[4],'head colour remains invariant');
  }
});

test('low/high LOD and flash modify only renderer output, not simulation state',()=>{
  const m=make(),state={id:712,position:[0,0,0],yaw:0,gait:1,lod:'high',flash:false,dead:false};
  const high=collect(m,state),low=collect(m,{...state,lod:'low'});
  assert.equal(high.length,3);assert.equal(low.length,2);
  assert.deepEqual(low,high.slice(0,2));
  assert.equal(collect(m,{...state,flash:true}).every(p=>p[7]===1),true);
  const fallen=collect(m,{...state,dead:true});
  assert.equal(fallen.length,1);
  assert.ok(fallen[0][1]+fallen[0][4]/2<.4);
  assert.deepEqual(state,{id:712,position:[0,0,0],yaw:0,gait:1,lod:'high',flash:false,dead:false});
});

test('gait extremes remain inside the advertised hit volume',()=>{
  const model=make(),bounds=model.bounds;
  for(const id of [0,3,11,702])for(const gait of [-1,0,1]){
    const parts=collect(model,{id,gait});
    for(const [x,y,z,w,h,d,color,glow] of parts){
      assert.ok(Math.abs(x)+w/2<=bounds.halfWidth+1e-9);
      assert.ok(y-h/2>=-1e-9&&y+h/2<=bounds.height+1e-9);
      assert.ok(z-d/2>=bounds.minZ-1e-9&&z+d/2<=bounds.maxZ+1e-9);
      assert.ok(color.every(c=>c>=0&&c<=1));
      assert.ok(glow>=0&&glow<=1);
    }
  }
  const head=model.parts.find(p=>p.head);
  assert.ok(head.y+head.h/2>=bounds.headBand*bounds.height);
});

test('world-space yaw transform matches a separate direct mathematical reference',()=>{
  const m=make(),pose={id:7,position:[3,2,-4],yaw:Math.PI/3,gait:.25};
  const result=collect(m,pose),c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
  m.parts.forEach((p,i)=>{
    const z=p.z+p.gaitZ*pose.gait;
    approximate(result[i][0],pose.position[0]+p.x*c+z*s);
    approximate(result[i][1],pose.position[1]+p.y);
    approximate(result[i][2],pose.position[2]-p.x*s+z*c);
    assert.equal(result[i][8],pose.yaw);
  });
});

test('stream adapter produces exact Float32 records and retains existing prefix',()=>{
  const m=make(),stream=new CuboidStream({capacity:0});
  stream.box(-1,0,0,1,1,1,[.3,.2,.1],0,0);
  const prior=stream.snapshot();
  const n=emitAppearanceToStream(m,stream,{id:10,lod:'high',position:[2,1,-2],yaw:.4});
  assert.equal(n,3);assert.equal(stream.count,4);
  assert.deepEqual(stream.snapshot().slice(0,12),prior);
  const ref=new CuboidStream();
  for(const part of collect(m,{id:10,lod:'high',position:[2,1,-2],yaw:.4}))
    ref.box(...part);
  assert.deepEqual(stream.snapshot().slice(12),ref.snapshot());
  stream.clear();
  assert.equal(emitAppearanceToStream(m,stream,{dead:true}),1);
});

test('malformed geometry, palettes, variants and hitbox escapes fail closed',()=>{
  for(const bad of [
    {palette:[[NaN,0,0]]},
    {palette:[[1.1,0,0]]},
    {slots:['cloth','cloth']},
    {colours:[99,3,4]},
    {colours:[0,,4]},
    {palette:[palette[0],,palette[2]]},
    {slots:['cloth',,'skin']},
    {parts:[{x:0,y:.8,z:0,w:.4,h:.8,d:.3,slot:'cloth'},,]},
    {variants:{cloth:[0,,2]}},
    {parts:[{x:0,y:.1,z:0,w:1,h:1,d:1,slot:'cloth'}]},
    {parts:[{x:0,y:.8,z:0,w:.4,h:.8,d:.3,slot:'unknown'}]},
    {parts:[{x:0,y:.8,z:0,w:.4,h:.8,d:.3,slot:'cloth',detail:'medium'}]},
    {parts:[{x:0,y:1.0,z:0,w:.4,h:.8,d:.3,slot:'skin',head:true}]},
    {variants:{missing:[0,1]}},
    {variants:{cloth:[-1]}},
    {bounds:{height:0,halfWidth:.5,minZ:-.7,maxZ:.7}},
    {parts:[]},
  ]){
    assert.throws(()=>createAppearance({...input(),...bad}));
  }
  const model=make();
  for(const pose of [
    {id:-1}, {id:2**32},{yaw:Infinity},{position:[0,0]},
    {position:[0,0,NaN]},{position:[0,,0]},{gait:1.1},
    {lod:'ultra'},{flash:1},{dead:1}
  ])assert.throws(()=>emitAppearance(model,()=>{},pose));
  assert.throws(()=>emitAppearance(model,null));
  assert.throws(()=>emitAppearanceToStream(model,{}),TypeError);
});

test('input failure does not append partial streams, no per-frame ambient state',()=>{
  const model=make(),stream=new CuboidStream({capacity:1});
  stream.box(0,0,0,1,1,1,[0,0,0]);
  const prior=stream.snapshot();
  assert.throws(()=>emitAppearanceToStream(model,stream,{id:-1}),RangeError);
  assert.deepEqual(stream.snapshot(),prior);
  assert.equal(stream.count,1);
  const source=readFileSync(new URL('../modules/appearance/index.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(document|window|navigator|Math\.random|Date\.now|performance\.now)\b/);
});
