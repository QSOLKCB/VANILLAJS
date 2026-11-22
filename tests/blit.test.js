// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BitplaneSurface,BLIT_FORMAT,BLIT_LIMITS,BLIT_COPY,BLIT_COOKIE_CUT} from '../modules/blit/index.js';
function checker(w,h,planes){
  const s=new BitplaneSurface(w,h,planes);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)s.setPixel(x,y,(x*7+y*13+x*y)%(1<<planes));
  return s;
}
function oracle(c,src,mask,info){
  const {sx,sy,dx,dy,width,height,minterm}=info,before=c.indices(),from=src.indices(),ma=mask?.indices();
  const expected=before.slice();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const tx=dx+x,ty=dy+y;if(tx<0||ty<0||tx>=c.width||ty>=c.height)continue;
    const b=from[(sy+y)*src.width+(sx+x)],a=ma?ma[(sy+y)*mask.width+(sx+x)]:1;
    const old=before[ty*c.width+tx];let value=0;
    for(let bit=0;bit<c.planes;bit++)value|=((minterm>>((a<<2)|(((b>>bit)&1)<<1)|((old>>bit)&1)))&1)<<bit;
    expected[ty*c.width+tx]=value;
  }
  return expected;
}
test('physical bit packing, copied words, palette RGBA and exact declared limits',()=>{
  assert.equal(BLIT_FORMAT,'qsol.vanillajs.blit.v1');
  assert.deepEqual(BLIT_LIMITS,{width:512,height:384,planes:4,pixels:512*384});
  const s=new BitplaneSurface(32,2,4);
  assert.equal(s.retainedBytes,32/16*2*4*2);
  s.setPixel(0,0,1).setPixel(15,0,2).setPixel(16,0,4).setPixel(31,0,8);
  assert.equal(s.words()[0],0x8000);assert.equal(s.words()[4],1);
  assert.equal(s.words()[9],0x8000);assert.equal(s.words()[13],1);
  const copy=s.words();copy.fill(0);assert.equal(s.getPixel(0,0),1);
  const palette=Array.from({length:16},(_,i)=>[i,255-i,i*12,255]);
  const rgba=s.rgba(palette);assert.deepEqual([...rgba.slice(0,4)],palette[1]);
  assert.deepEqual([...rgba.slice(4,8)],palette[0]);
});
test('bounds and malformed admission do not modify published words',()=>{
  for(const bad of [[15,8,4],[32,0,4],[16,385,4],[16,8,0],[16,8,5],[-16,8,4],['16',8,4]])
    assert.throws(()=>new BitplaneSurface(...bad));
  const s=checker(32,20,4),base=s.words();
  const invalid=[
    ()=>s.setPixel(32,0,2),()=>s.setPixel(0,0,16),()=>s.fillRect(0,0,33,1,2),
    ()=>s.fillRect(0,0,3,2,256),()=>s.line(0,0,0,21,2),()=>s.line(0,0,2,2,NaN),
    ()=>s.blit(s,{sx:0,sy:0,dx:0,dy:0,width:33,height:1}),
    ()=>s.blit(s,{width:1,height:1,unexpected:2}),
    ()=>s.blit(s,null),
    ()=>s.blit(s,Object.defineProperty({width:1,height:1},'dx',{
      enumerable:true,get(){throw Error('getter must not run');}})),
    ()=>s.blit(s,{sx:0,sy:0,dx:0,dy:0,width:1,height:1,minterm:-1}),
    ()=>s.blit(new BitplaneSurface(16,8,1),{width:1,height:1}),
    ()=>s.blit(s,{width:1,height:1,mask:new BitplaneSurface(32,20,2)}),()=>s.rgba([])
  ];
  for(const fn of invalid){assert.throws(fn);assert.deepEqual(s.words(),base);}
});
test('all 256 three-input Boolean minterms match independent pixel oracle',()=>{
  const src=checker(32,16,4),dest=checker(32,16,4),mask=checker(32,16,1);
  for(let minterm=0;minterm<256;minterm++){
    const d=new BitplaneSurface(32,16,4);
    d.blit(dest,{sx:0,sy:0,dx:0,dy:0,width:32,height:16});
    const args={sx:1,sy:2,dx:5,dy:3,width:27,height:11,minterm,mask};
    const expected=oracle(d,src,mask,args);d.blit(src,args);
    assert.deepEqual(d.indices(),expected,'minterm '+minterm);
  }
});
test('0xCA cookie-cut mask crosses 16-bit word boundaries without opaque pixels',()=>{
  const d=new BitplaneSurface(48,6,4).clear(4),b=new BitplaneSurface(48,6,4).clear(9);
  const mask=new BitplaneSurface(48,6,1).clear(0);mask.fillRect(11,1,25,3,1);
  assert.equal(d.blit(b,{sx:0,sy:0,dx:0,dy:0,width:48,height:6,mask,minterm:BLIT_COOKIE_CUT}),75);
  for(let y=0;y<6;y++)for(let x=0;x<48;x++)
    assert.equal(d.getPixel(x,y),x>=11&&x<36&&y>=1&&y<4?9:4);
});
test('self-overlap, aligned/unaligned shifts and clipping preserve an independent snapshot',()=>{
  for(const args of [
    {sx:0,sy:0,dx:7,dy:1,width:29,height:12,minterm:BLIT_COPY},
    {sx:3,sy:2,dx:-7,dy:4,width:34,height:14,minterm:BLIT_COPY},
    {sx:0,sy:3,dx:1,dy:-4,width:44,height:14,minterm:BLIT_COOKIE_CUT},
    {sx:1,sy:1,dx:16,dy:8,width:30,height:12,minterm:0x96},
    {sx:0,sy:0,dx:48,dy:0,width:10,height:3,minterm:BLIT_COPY}
  ]){
    const s=checker(48,20,4),expected=oracle(s,s,null,args);
    s.blit(s,args);assert.deepEqual(s.indices(),expected,JSON.stringify(args));
  }
});
test('fill/line/clear endpoints and no unintentional neighbouring damage',()=>{
  const s=new BitplaneSurface(32,16,4);
  s.fillRect(2,3,5,4,11).line(0,0,31,15,6).line(0,15,31,0,2);
  assert.equal(s.getPixel(0,0),6);assert.equal(s.getPixel(31,15),6);
  assert.equal(s.getPixel(0,15),2);assert.equal(s.getPixel(31,0),2);
  assert.equal(s.getPixel(4,5),11);assert.equal(s.getPixel(1,4),0);
  s.clear(15);assert.equal(s.getPixel(31,15),15);assert.ok(s.words().every(x=>x===0xffff));
});
test('seeded overlapping geometry, palette conversion and memory outputs reproduce',()=>{
  const make=()=>{
    const screen=new BitplaneSurface(128,64,4).clear(2),src=checker(48,16,4);
    const mask=new BitplaneSurface(48,16,1).clear(0);mask.fillRect(2,0,40,14,1);
    for(let x=0;x<75;x+=17)screen.blit(src,{sx:0,sy:0,dx:x,dy:22,width:48,height:16,mask,minterm:0xca});
    screen.fillRect(2,2,76,5,7).line(0,0,127,63,12);return screen;
  };
  const a=make(),b=make(),palette=Array.from({length:16},(_,i)=>[i*15,20,255-i*15,255]);
  assert.deepEqual(a.words(),b.words());assert.deepEqual(a.indices(),b.indices());
  assert.deepEqual(a.rgba(palette),b.rgba(palette));
});
