// SPDX-License-Identifier: Apache-2.0
import {BitplaneSurface,BLIT_COOKIE_CUT,BLIT_FORMAT} from '../../modules/blit/index.js';
const W=320,H=192;
const palette=[
 [7,20,35,255],[12,31,52,255],[23,47,66,255],[42,64,82,255],
 [63,86,102,255],[110,119,123,255],[175,139,107,255],[235,165,107,255],
 [250,204,127,255],[234,232,191,255],[69,117,113,255],[54,89,89,255],
 [31,67,69,255],[19,45,52,255],[11,29,38,255],[249,238,207,255]
];
const base=new BitplaneSurface(W,H,4),frame=new BitplaneSurface(W,H,4);
const sprite=new BitplaneSurface(48,32,4),mask=new BitplaneSurface(48,32,1);
const canvas=document.getElementById('screen'),ctx=canvas.getContext('2d',{alpha:false});
const report=document.getElementById('report');let dx=112,moves=0,mode='start';
function makeSprite(){
 sprite.clear(0);mask.clear(0);
 sprite.fillRect(4,13,40,7,9).fillRect(17,8,16,18,8)
   .fillRect(20,5,10,6,7).fillRect(1,15,47,3,15)
   .line(3,21,45,21,7).line(21,8,27,8,15);
 for(let y=2;y<29;y++)for(let x=1;x<47;x++)if(sprite.getPixel(x,y)!==0)mask.setPixel(x,y,1);
}
function draw(){
 frame.blit(base,{sx:0,sy:0,dx:0,dy:0,width:W,height:H});
 frame.blit(sprite,{sx:0,sy:0,dx,dy:82,width:48,height:32,mask,minterm:BLIT_COOKIE_CUT});
 const rgba=frame.rgba(palette);
 ctx.putImageData(new ImageData(rgba,W,H),0,0);
 const checksum=rgba.reduce((n,v)=>Math.imul(n^v,16777619)>>>0,2166136261);
 const state={kind:BLIT_FORMAT,width:W,height:H,planes:4,maskMinterm:'0xCA',
   spriteX:dx,mode,moves,checksum,retainedBytes:base.retainedBytes+frame.retainedBytes+sprite.retainedBytes+mask.retainedBytes};
 report.textContent='FRAME '+W+'x'+H+' / FOUR BITPLANES / MINTERM 0xCA\nSPRITE X '+dx+
   ' / STATE '+mode.toUpperCase()+' / HASH '+checksum.toString(16).padStart(8,'0')+
   '\nBITPLANE STORAGE '+state.retainedBytes+' BYTES';
 window.__blitReport=state;
}
function reset(){
 base.clear(0);
 for(let y=0;y<H;y++){
   const tone=y<92?Math.min(4,(y/23)|0):y<132?6:11;
   base.fillRect(0,y,W,1,tone);
 }
 for(let x=0;x<W;x++){
   const far=85+Math.round(10*Math.sin(x/17)+8*Math.cos(x/39));
   base.fillRect(x,far,1,H-far,10);
   const near=124+Math.round(11*Math.sin(x/23)+6*Math.cos(x/11));
   base.fillRect(x,near,1,H-near,12);
 }
 for(let i=0;i<13;i++)base.line(0,110+i*6,W-1,110+i*6,13);
 base.line(0,155,319,155,8);base.fillRect(4,6,110,12,14).fillRect(5,7,108,10,1);
 dx=112;moves=0;mode='start';draw();
}
makeSprite();reset();
document.getElementById('move').addEventListener('click',()=>{
 dx=dx>=265?8:dx+19;moves++;mode='moving';draw();
});
document.getElementById('copy').addEventListener('click',()=>{
 base.blit(base,{sx:28,sy:134,dx:44,dy:146,width:210,height:32});
 mode='overlap';draw();
});
document.getElementById('reset').addEventListener('click',reset);
