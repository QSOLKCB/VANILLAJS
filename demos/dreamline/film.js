// SPDX-License-Identifier: Apache-2.0
import {smooth} from '../../modules/demo-timeline/index.js';
import {textVoxels,transformPoint} from '../../modules/demo-scene/index.js';
import {cueAt,FRAMES,RATE} from './music.js';
import {projection,neighbors,walk,support} from './geometry.js';
import {horizonRenderer,physicalTake} from './horizon.js';

export const defaults=Object.freeze({format:'dreamline.project.v1',trace:'#79ffe0',metal:'#d49056',detail:'cinematic',motion:'full'});
export function projectFromText(text) {
  if(typeof text!=='string'||text.length>1024)throw RangeError('Project exceeds 1 KiB');
  const p=JSON.parse(text);
  if(!p||Object.keys(p).sort().join()!==Object.keys(defaults).sort().join()||p.format!==defaults.format||
    ![p.trace,p.metal].every(v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))||
    !['cinematic','reduced'].includes(p.detail)||!['full','reduced'].includes(p.motion))throw TypeError('Invalid Dreamline project');
  return p;
}
const TAU=2*Math.PI,clamp=n=>Math.max(0,Math.min(1,n));
const glyphs=new Map();
function lettering(c,words,x,y,size,color){
  if(!glyphs.has(words))glyphs.set(words,textVoxels(words));
  c.fillStyle=color;
  for(const [gx,gy] of glyphs.get(words))c.fillRect(x+gx*size,y-gy*size,size*.9,size*.9);
}
function line(c,points,color,width=1,close=false){
  c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);
  if(close)c.closePath();c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function polygon(c,points,fill,rim){
  c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);
  c.closePath();c.fillStyle=fill;c.fill();if(rim){c.strokeStyle=rim;c.lineWidth=.8;c.stroke();}
}
function backdrop(c,t,detail){
  const sky=c.createRadialGradient(510,248,8,500,250,565);
  sky.addColorStop(0,'#173138');sky.addColorStop(.52,'#0c1b24');sky.addColorStop(1,'#03080e');
  c.fillStyle=sky;c.fillRect(0,0,960,540);
  c.fillStyle='#608a92';
  for(let i=0;i<(detail?165:55);i++){const x=(i*233.5+t*(i%3+1))%960,y=(i*i*71.3+i*9)%540;c.fillRect(x,y,1+(i%13===0),1);}
}
function trace(c,t,amp,color,y=270){
  const points=[];
  for(let x=0;x<=960;x+=3){
    const u=(x/960-t*.11)%1,env=Math.exp(-65*(u-.26)**2)+.38*Math.exp(-110*(u+.68)**2);
    points.push([x,y+Math.sin(x*.065-t*4)*amp*env+Math.sin(x*.012+t)*amp*.18]);
  }
  c.globalAlpha*=.18;line(c,points,color,8);c.globalAlpha/=.18;line(c,points,color,1.6);
}
function memory(c,t,p,pulse){
  const wake=smooth(t/3);c.globalAlpha=wake;
  backdrop(c,t,p.detail==='cinematic');
  const lattice=smooth((t-2)/8);
  c.globalAlpha=wake*lattice;
  for(let i=-11;i<=11;i++)line(c,[[480+i*13,278],[480+i*108,540]],'#235151');
  for(let i=0;i<11;i++){const f=((i+t*.45)%11)/11;line(c,[[0,278+255*f*f],[960,278+255*f*f]],'#1e4649');}
  const center=[480,245],rot=t*.33;
  for(let layer=1;layer<=4;layer++){
    const r=(23+layer*16)*lattice,verts=Array.from({length:8},(_,i)=>{
      const v=transformPoint([i&1?1:-1,i&2?1:-1,i&4?1:-1],[0,0,0],[.37,rot+layer*.13,.18],[r,r,r]);
      return [center[0]+v[0],center[1]+v[1]*.8+v[2]*.19];
    });
    for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))line(c,[verts[i],verts[i|bit]],layer===4?p.trace:'#377677',1.2);
  }
  c.globalAlpha=wake;trace(c,t,14+pulse*24,p.trace);
  if(t>4){c.globalAlpha*=smooth(t-4)*smooth((15-t)/2);lettering(c,'THE DREAMLINE',480,413,2.6,'#c6ded7');}
  c.globalAlpha=1;
}
function assembly(c,t,p,pulse,reduced){
  backdrop(c,t,true);
  const vx=480+(reduced?0:44*Math.sin(t*.16)),vy=205;
  const project=(x,y,z)=>[vx+430*x/z,vy+430*y/z];
  polygon(c,[[vx,vy],[960,540],[0,540]],'#162124');
  const travel=(t*(reduced?.45:2.3))%5;
  for(let i=p.detail==='reduced'?12:22;i>=1;i--){
    const z=i*5-travel+1,far=z+1.2;
    for(const side of [-1,1]){
      const arch=[[side*6,4],[side*6,-4],[side*2,-8],[0,-9]];
      const wall=arch.map(([x,y])=>project(x,y,z));
      for(let j=0;j<3;j++){
        const [[x,y],[u,v]]=arch.slice(j,j+2);
        polygon(c,[wall[j],wall[j+1],project(u,v,far),project(x,y,far)],'#573e32',p.metal);
        polygon(c,[wall[j],wall[j+1],project(u*.93,v*.94,z),project(x*.93,y*.94,z)],'#26393b','#477171');
      }
      const lamp=project(side*5.8,-3.4,z);
      c.fillStyle=pulse>.45?p.trace:p.metal;c.fillRect(lamp[0],lamp[1],Math.min(12,54/z),Math.min(25,95/z));
      line(c,[project(side*2,4,z),project(side*2,4,far+4)],p.trace,Math.max(.5,8/z));
    }
  }
  trace(c,t+15,5+pulse*12,p.trace,vy+5);
}
function dreamspace(c,t,p,pulse,pcm,sample){
  backdrop(c,t,p.detail==='cinematic');
  const quiet=p.motion==='reduced',phase=quiet?0:t*.09,r=167*(quiet?1:1+.03*pulse),cx=480,cy=249;
  const points=projection.map(([x,y])=>[cx+r*(x*Math.cos(phase)-y*Math.sin(phase)),cy+r*(x*Math.sin(phase)+y*Math.cos(phase))]);
  const n=Math.min(302,Math.floor(t/20*303)),[a,b]=support(n),trail=walk.slice(Math.max(0,n-14),n+2);
  for(let i=0;i<240;i+=(p.detail==='reduced'?3:1)){
    for(let j=0;j<3;j++)line(c,[points[i],points[neighbors[i][(i+j*19)%56]]],'#24434c',.55);
    const [x,y]=points[i];c.fillStyle=i%3?p.trace:p.metal;c.fillRect(x-1,y-1,2,2);
  }
  line(c,trail.map(i=>points[i]),p.metal,2.4);
  const end=points[trail.at(-1)];c.fillStyle='#fff0bb';c.beginPath();c.arc(...end,4,0,TAU);c.fill();
  for(let i=0;i<3;i++){
    const radius=19+i*8;c.beginPath();c.arc(119,260,radius,0,TAU);c.strokeStyle='#497477';c.stroke();
  }
  const angle=TAU*a/101;c.fillStyle=p.trace;c.beginPath();c.arc(119+(19+b*8)*Math.cos(angle),260+(19+b*8)*Math.sin(angle),4,0,TAU);c.fill();
  lettering(c,'CRT 303',119,321,1.25,'#9ebfbb');
  const field=[];
  for(let i=0;i<160;i++){const j=2*Math.max(0,sample-i*4);field.push([847+pcm[j]/175,260+pcm[j+1]/175]);}
  line(c,field,p.trace,1.3);lettering(c,'STEREO',847,321,1.25,'#9ebfbb');
  lettering(c,'E8 / EDGE WALK',480,475,1.65,'#c2d5ce');
}
function finale(c,t,p,pulse){
  backdrop(c,t,false);
  const z=p.motion==='reduced'?1:smooth(t/5),cx=480,cy=168;
  for(let i=0;i<7;i++){
    const r=23+7*i+(1-z)*170,points=[];
    for(let j=0;j<=6;j++){const a=j*TAU/6-Math.PI/2+(1-z)*t*.22;points.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
    line(c,points,i===6?p.metal:i%2?p.trace:'#315657',i===6?2:1);
  }
  trace(c,p.motion==='reduced'?70:70+t,p.motion==='reduced'?3:12+pulse*10,p.trace,cy);
  c.globalAlpha=smooth(t/3);
  lettering(c,'QSOL-IMC',cx,264,2.2,p.trace);
  lettering(c,'THIS IS NOT A PRODUCT.',cx,321,2.6,'#d6e9df');
  lettering(c,'THIS IS INDEPENDENCE.',cx,361,3.4,'#f8e4bc');
  lettering(c,'VANILLAJS V3.0.0',cx,410,1.9,p.trace);
  if(t>5){lettering(c,'TRENT SLADE / QSOL-IMC',cx,465,1.4,'#afc2bf');lettering(c,'HORIZON   E8   EDGEWALK   SONIFICATION',cx,488,1.05,'#afc2bf');}
  c.globalAlpha=1;
}
export function createFilm(canvas,roadCanvas,score,pcm){
  const ctx=canvas.getContext('2d',{alpha:false}),take=physicalTake();
  let road;
  return {draw(sample,p=defaults){
    if(!Number.isSafeInteger(sample)||sample<0||sample>FRAMES)throw RangeError('Invalid composition sample');
    const t=sample/RATE,reduced=p.motion==='reduced',pulse=cueAt(score.notes,sample);
    ctx.setTransform(canvas.width/960,0,0,canvas.height/540,0,0);
    ctx.fillStyle='#000';ctx.fillRect(0,0,960,540);
    if(t===90)return;
    ctx.save();
    try{
      if(t<15)memory(ctx,reduced?Math.min(t,6)+t*.04:t,p,pulse);
      else if(t<30)assembly(ctx,t-15,p,pulse,reduced);
      else if(t<50){
        if(roadCanvas.width!==canvas.width)roadCanvas.width=canvas.width;
        if(roadCanvas.height!==canvas.height)roadCanvas.height=canvas.height;
        road??=horizonRenderer(roadCanvas,take);
        road.draw(sample-1440000,reduced||p.detail==='reduced');
        ctx.drawImage(roadCanvas,0,0,960,540);
        const edge=clamp(1-Math.min(t-30,50-t)/2);
        if(edge){ctx.globalAlpha=edge;trace(ctx,t,20,p.trace);ctx.globalAlpha=1;}
      }else if(t<70)dreamspace(ctx,t-50,p,pulse,pcm,sample);
      else finale(ctx,t-70,p,pulse);
      const fade=Math.min(1,t/.8,(90-t)/2,...[15,30,50,70].map(cut=>.32+.68*clamp(Math.abs(t-cut)/.65)));
      if(fade<1){ctx.globalAlpha=1-fade;ctx.fillStyle='#000';ctx.fillRect(0,0,960,540);}
    }finally{ctx.restore();}
  },dispose(){road?.dispose();}};
}
