// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COPPER_FORMAT,COPPER_LIMITS,createCopperProgram,CopperDisplay} from '../modules/copper/index.js';
function palette(){return Array.from({length:16},(_,i)=>[(i*17)&255,(i*29)&255,(255-i*13)&255,255]);}
function source(w,h){const p=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)p[y*w+x]=(x*3+y*7)%16;return p;}
function reference(input,width,height,colors,commands){
  const p=colors.map(x=>[...x]),out=new Uint8ClampedArray(input.length*4);let cursor=0,scroll=0;
  for(let y=0;y<height;y++){
    while(cursor<commands.length&&commands[cursor].line===y){
      const c=commands[cursor++];if(c.op==='palette')p[c.index]=[...c.color];else scroll=c.x;
    }
    for(let x=0;x<width;x++){
      const realX=((x+scroll)%width+width)%width,color=p[input[y*width+realX]];
      for(let k=0;k<4;k++)out[(y*width+x)*4+k]=color[k];
    }
  }
  return out;
}
test('bounds, owner handle, and retained RGBA',()=>{
  assert.equal(COPPER_FORMAT,'qsol.vanillajs.copper.v1');assert.equal(COPPER_LIMITS.commands,512);
  const p=createCopperProgram({height:4,palette:palette(),commands:[]});
  assert.deepEqual(p,{format:COPPER_FORMAT,height:4,commandCount:0});assert.ok(Object.isFrozen(p));
  const d=new CopperDisplay(32,4);assert.equal(d.retainedBytes,512);
  assert.equal(d.render(source(32,4),p),d.view());
  for(const [w,h] of [[0,4],[513,4],[8,0],[8,385],[NaN,4]])
    assert.throws(()=>new CopperDisplay(w,h));
});
test('scanline commands: repeated palette writes, persistence and scroll agree with independent reference',()=>{
  const width=32,height=8,p=palette(),src=source(width,height);
  const commands=[
    {line:0,op:'scroll',x:3},
    {line:2,op:'palette',index:4,color:[0,0,0,255]},
    {line:2,op:'palette',index:4,color:[200,12,211,255]},
    {line:4,op:'scroll',x:-5},
    {line:6,op:'palette',index:1,color:[18,36,54,111]},
    {line:6,op:'scroll',x:0}
  ];
  const d=new CopperDisplay(width,height),program=createCopperProgram({height,palette:p,commands});
  assert.deepEqual(d.render(src,program),reference(src,width,height,p,commands));
  assert.deepEqual(d.render(src,program),reference(src,width,height,p,commands),'reset registers each frame');
});
test('negative, positive, wrapped, and extreme scroll offsets agree with oracle',()=>{
  const width=19,height=7,src=source(width,height),p=palette(),d=new CopperDisplay(width,height);
  for(const x of [-511,-256,-20,-19,-18,-1,0,1,18,19,20,256,511]){
    const commands=[{line:0,op:'scroll',x},{line:height-1,op:'scroll',x:-x}];
    assert.deepEqual(d.render(src,createCopperProgram({height,palette:p,commands})),
      reference(src,width,height,p,commands),'scroll '+x);
  }
});
test('malformed programs, indices and foreign handles fail before display mutation',()=>{
  const colors=palette(),src=source(32,8),d=new CopperDisplay(32,8);
  const accepted=createCopperProgram({height:8,palette:colors,commands:[]});
  d.render(src,accepted);const baseline=d.view().slice();
  const malformed=[
    {height:0,palette:colors,commands:[]},
    {height:385,palette:colors,commands:[]},
    {height:8,palette:colors.slice(0,15),commands:[]},
    {height:8,palette:colors,commands:[{line:1,op:'scroll',x:512}]},
    {height:8,palette:colors,commands:[{line:9,op:'scroll',x:1}]},
    {height:8,palette:colors,commands:[{line:2,op:'scroll',x:1},{line:1,op:'scroll',x:2}]},
    {height:8,palette:colors,commands:[{line:0,op:'unknown',x:0}]},
    {height:8,palette:colors,commands:[{line:0,op:'palette',index:16,color:[0,0,0,0]}]},
    {height:8,palette:colors,commands:[{line:0,op:'palette',index:0,color:[256,0,0,0]}]},
    {height:8,palette:colors,commands:[{line:0,op:'palette',index:0,color:[0,0,0,0],extra:1}]},
    {height:8,palette:colors,commands:Array(513).fill({line:0,op:'scroll',x:1})}
  ];
  for(const obj of malformed){assert.throws(()=>createCopperProgram(obj));assert.deepEqual(d.view(),baseline);}
  const bad=new Uint8Array(src);bad[bad.length-1]=16;
  assert.throws(()=>d.render(bad,accepted));
  assert.throws(()=>d.render(src,{format:COPPER_FORMAT,height:8,commandCount:0}));
  assert.throws(()=>d.render(new Uint8Array(d.view().buffer,0,32*8),accepted),TypeError);

  assert.throws(()=>new CopperDisplay(31,9).render(new Uint8Array(31*9),accepted));
  assert.deepEqual(d.view(),baseline);
  const accessor={height:8,palette:colors,commands:[]};
  Object.defineProperty(accessor,'height',{get(){throw Error('must not invoke getter');},enumerable:true});
  assert.throws(()=>createCopperProgram(accessor),TypeError);
});
test('accepted program copies source palette and commands, preventing external mutation',()=>{
  const colors=palette(),rgb=[44,55,66,77],commands=[
    {line:2,op:'palette',index:7,color:rgb},{line:3,op:'scroll',x:5}];
  const p=createCopperProgram({height:4,palette:colors,commands}),d=new CopperDisplay(32,4),input=source(32,4);
  const expected=d.render(input,p).slice();
  colors[0].fill(200);rgb.fill(9);commands[1].x=-5;commands.push({line:3,op:'scroll',x:-99});
  assert.deepEqual(d.render(input,p),expected);
});
test('real BLIT-001 bitplane index output feeds COPPER without source or gameplay mutation',async()=>{
  const {BitplaneSurface}=await import('../modules/blit/index.js');
  const bmp=new BitplaneSurface(64,32,4).clear(3);
  bmp.fillRect(5,5,30,9,6).line(0,0,63,31,14);
  const index=bmp.indices(),p=palette();
  const commands=[
    {line:8,op:'palette',index:6,color:[255,255,15,255]},
    {line:14,op:'scroll',x:8},{line:24,op:'scroll',x:0}];
  const program=createCopperProgram({height:32,palette:p,commands});
  assert.deepEqual(new CopperDisplay(64,32).render(index,program),
    reference(index,64,32,p,commands));
  assert.deepEqual(bmp.indices(),index,'scanline presentation cannot mutate source bitplanes');
});
test('maximum command budget, alpha channel and transparent palette entry',()=>{
  const p=palette();p[0]=[0,0,0,0];
  const commands=Array.from({length:512},(_,i)=>({line:Math.floor(i/2)%384,op:'scroll',x:i%511}));
  const program=createCopperProgram({height:384,palette:p,commands});
  const d=new CopperDisplay(16,384),input=new Uint8Array(16*384);
  const actual=d.render(input,program);assert.equal(actual.length,16*384*4);
  for(let i=0;i<actual.length;i+=4)assert.equal(actual[i+3],0);
});
