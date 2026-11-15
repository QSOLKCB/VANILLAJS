// SPDX-License-Identifier: Apache-2.0
// Road projection and procedural car construction adapted from Outruin.
// Original pursuit art; no ROMs, sprites or other commercial game assets.
import {clamp} from '../../../modules/math/index.js';
import {ROADS} from './sim.js';
import {CASES} from './cases.js';
export const W=1280,H=720,VIEW=850,HORIZON=230,BASE=660;
const CAMERA=85,FAR=CAMERA/(CAMERA+VIEW);
const poly=(c,p,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(...p[0]);for(const v of p.slice(1))c.lineTo(...v);c.closePath();c.fill();};
const line=(c,p,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...p[0]);for(const v of p.slice(1))c.lineTo(...v);c.stroke();};
const text=(c,t,x,y,size=16,color='#fff0d6',align='left')=>{c.fillStyle=color;c.font=`700 ${size}px monospace`;c.textAlign=align;c.fillText(t,x,y);};
const shade=(color,n)=>'#'+[1,3,5].map(i=>Math.round(clamp(parseInt(color.slice(i,i+2),16)+n,0,255)).toString(16).padStart(2,'0')).join('');
function ahead(s,z){let offset=0;for(let n=0;n<z;n+=40){const length=Math.min(40,z-n);offset+=ROADS[s.caseIndex].sample(s.distance+n+length/2)*length*(z-n-length/2)*.1;}return offset;}
export function project(s,z,lane=0){
  z=clamp(z,-5,VIEW);const f=(CAMERA/(CAMERA+z)-FAR)/(1-FAR),w=700*f;
  return {x:W/2+(ahead(s,Math.max(z,0))+lane-s.car.offset*.6)/6*w,y:HORIZON+(BASE-HORIZON)*f,w,f};
}
function sky(c,p){
  const g=c.createLinearGradient(0,0,0,HORIZON);g.addColorStop(0,p.sky);g.addColorStop(1,p.haze);c.fillStyle=g;c.fillRect(0,0,W,H);
  c.fillStyle=p.accent;c.beginPath();c.arc(1000,127,48,0,Math.PI*2);c.fill();
  for(let layer=0;layer<3;layer++){const points=[[0,HORIZON]];for(let x=0;x<=W+20;x+=20)points.push([x,HORIZON-25+layer*12-Math.sin(x*.006+layer*2)*32-Math.cos(x*.016+layer)*15]);points.push([W,HORIZON]);poly(c,points,shade(p.land,layer*12-20));}
  if(['city','rain'].includes(p.kind))for(let i=0;i<44;i++){const x=i*31,h=20+(i*47)%110;c.fillStyle='#192c43';c.fillRect(x,HORIZON-h,23,h);for(let j=10;j<h;j+=13){c.fillStyle=(i+j)%3?'#96b3ad':'#da8b8c';c.fillRect(x+5,HORIZON-j,3,4);c.fillRect(x+14,HORIZON-j,3,4);}}
}
function road(c,s,p){
  c.fillStyle=p.land;c.fillRect(0,HORIZON,W,H-HORIZON);
  for(let i=0;i<100;i++){
    const z0=VIEW*(1-i/100)**2,z1=VIEW*(1-(i+1)/100)**2,a=project(s,z0),b=project(s,z1),stripe=Math.floor((s.distance+z0)/18)%2;
    a.y=Math.floor(a.y);b.y=Math.ceil(b.y);
    c.fillStyle=shade(p.land,stripe?0:4);c.fillRect(0,a.y,W,b.y-a.y+1);
    const quad=(l,r,color)=>poly(c,[[a.x+a.w*l,a.y],[a.x+a.w*r,a.y],[b.x+b.w*r,b.y],[b.x+b.w*l,b.y]],color);
    quad(-1.3,1.3,p.verge);quad(-1.07,1.07,stripe?'#d7c6a0':'#ae6359');quad(-1,1,stripe?'#35434d':'#374650');
    quad(-1,-.983,'#e9dab4');quad(.983,1,'#e9dab4');
    if(stripe){quad(-.341,-.326,'#d2cebd');quad(.326,.341,'#d2cebd');}
    quad(-.68,-.676,'#293c47');quad(.68,.684,'#293c47');
    if(z0>250){c.globalAlpha=clamp((z0-250)/900,0,.7);quad(-1.3,1.3,p.haze);c.globalAlpha=1;}
  }
  const a=project(s,0);poly(c,[[a.x-a.w,a.y],[a.x+a.w,a.y],[a.x+a.w*1.2,H],[a.x-a.w*1.2,H]],'#35434d');
}
function scenery(c,s,p){
  const start=Math.floor(s.distance/45)*45;
  for(let d=start+810;d>start;d-=45){const z=d-s.distance;if(z<4)continue;const a=project(s,z),size=a.w*.18,id=Math.floor(d/45);
    for(const side of [-1,1]){const x=a.x+side*a.w*(1.35+(id%3)*.3),y=a.y;
      if(p.kind==='coast'){
        line(c,[[x,y],[x+size*.12,y-size*2]],'#685c51',size*.13);
        for(let j=0;j<5;j++){const t=j*.9;poly(c,[[x+size*.12,y-size*2],[x+Math.cos(t)*size,y-size*(2+Math.sin(t)*.7)],[x+Math.cos(t)*size*.9,y-size*1.7]],'#315b59');}
      }else if(p.kind==='forest'){
        c.fillStyle='#5b6252';c.fillRect(x-size*.05,y-size,size*.1,size);for(let j=0;j<3;j++)poly(c,[[x-size*(.8-j*.16),y-size*j*.6],[x,y-size*(1.7+j*.5)],[x+size*(.8-j*.16),y-size*j*.6]],shade(p.land,-15+j*5));
      }else if(p.kind==='desert'){
        poly(c,[[x-size,y],[x-size*.4,y-size*1.3],[x+size*.3,y-size*1.2],[x+size,y]],shade(p.land,12));
        poly(c,[[x-size*.4,y-size*1.3],[x+size*.3,y-size*1.2],[x+size,y],[x,y]],shade(p.land,-10));
      }else{
        line(c,[[x,y],[x,y-size*2.8],[x-side*size*.7,y-size*2.9]],'#8397a0',Math.max(1,size*.045));
        line(c,[[x-side*size*.7,y-size*2.9],[x-side*size,y-size*2.9]],p.accent,Math.max(1,size*.08));
      }
      if(id%7===0&&size>8){c.fillStyle='#1a4c58';c.fillRect(x-size*.65,y-size*1.4,size*1.3,size*.5);if(size>25)text(c,side<0?'UNIT 07':'INTERCEPT →',x,y-size*1.1,size*.13,'#fff1cc','center');}
    }
  }
  for(let d=Math.ceil(s.distance/12)*12;d<s.distance+260;d+=12){const a=project(s,d-s.distance);for(const side of [-1,1]){c.fillStyle='#c8d9cb';c.fillRect(a.x+side*a.w*1.1,a.y-a.w*.045,Math.max(1,a.w*.006),a.w*.045);}}
}
export function car(c,x,y,w,color,{police=false,truck=false,flash=false,yaw=0,brake=false,boost=false,tick=0}={}){
  const h=w*(truck?.86:.57),paint=flash?'#fff0b8':color;c.save();c.translate(x,y);c.transform(1,0,yaw,1,0,0);
  c.fillStyle='#071b2499';c.beginPath();c.ellipse(0,3,w*.62,h*.16,0,0,Math.PI*2);c.fill();
  if(boost)for(const side of [-1,1])poly(c,[[side*w*.3,-h*.02],[side*w*.38,h*.35+(tick%3)*4],[side*w*.2,h*.08]],'#74e7ff');
  c.fillStyle='#11232c';for(const side of [-1,1])c.fillRect(side<0?-w*.53:w*.34,-h*.71,w*.19,h*.76);
  poly(c,[[-w*.48,0],[-w*.5,-h*.42],[-w*.36,-h*1.02],[w*.36,-h*1.02],[w*.5,-h*.42],[w*.48,0]],shade(paint,-35));
  poly(c,[[-w*.45,-h*.12],[-w*.4,-h*.65],[-w*.27,-h*1.08],[w*.27,-h*1.08],[w*.4,-h*.65],[w*.45,-h*.12]],paint);
  poly(c,[[-w*.32,-h*.64],[-w*.24,-h*.98],[w*.24,-h*.98],[w*.32,-h*.64]],'#183d50');
  poly(c,[[-w*.29,-h*.67],[-w*.22,-h*.95],[w*.05,-h*.95],[w*.16,-h*.67]],'#789ca7');
  c.fillStyle=police?'#18313d':shade(paint,-22);c.fillRect(-w*.42,-h*.49,w*.84,h*.16);
  c.fillStyle='#172c36';c.fillRect(-w*.45,-h*.22,w*.9,h*.13);c.fillStyle='#dfd8bb';c.fillRect(-w*.1,-h*.22,w*.2,h*.1);
  c.fillStyle='#839899';c.fillRect(-w*.49,-h*.08,w*.98,h*.065);
  for(const side of [-1,1]){c.fillStyle=brake?'#fff3b3':'#ff7565';c.fillRect(side<0?-w*.4:w*.23,-h*.32,w*.17,h*.1);}
  if(police){c.fillStyle='#142831';c.fillRect(-w*.23,-h*1.12,w*.46,h*.10);c.fillStyle=tick%24<12?'#ff786e':'#793d4b';c.fillRect(-w*.21,-h*1.14,w*.19,h*.085);c.fillStyle=tick%24>=12?'#7fe7ff':'#31577b';c.fillRect(w*.02,-h*1.14,w*.19,h*.085);}
  if(truck){c.fillStyle=shade(paint,-15);c.fillRect(-w*.3,-h*1.13,w*.6,h*.42);for(let i=0;i<4;i++){c.fillStyle=shade(paint,15);c.fillRect(-w*.25+i*w*.13,-h*1.09,w*.08,h*.31);}}
  c.restore();
}
function actors(c,s){
  const target={...s.target,color:CASES[s.caseIndex].color,isTarget:true,truck:s.caseIndex===1},all=[...s.traffic,target].sort((a,b)=>b.distance-a.distance);
  for(const e of all){const z=e.distance-s.distance;if(z< -4||z>VIEW)continue;const a=project(s,z,e.offset),w=Math.max(2,a.w*.27);
    car(c,a.x,a.y,w,e.color,{truck:e.truck,flash:e.flash>0,tick:s.tick});
    if(e.isTarget){const top=a.y-w*(e.truck?1.3:1);line(c,[[a.x-w*.7,a.y+7],[a.x-w*.7,top],[a.x-w*.4,top]],'#ffdd8d');line(c,[[a.x+w*.7,a.y+7],[a.x+w*.7,top],[a.x+w*.4,top]],'#ffdd8d');text(c,'TARGET',a.x,top-10,Math.max(11,w*.13),'#ffdd8d','center');}
  }
}
export class Renderer{
  constructor(canvas){this.canvas=canvas;canvas.width=W;canvas.height=H;this.c=canvas.getContext('2d',{alpha:false});this.backgrounds=new Map();this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;}
  draw(state,alpha=1,previous=null){
    const s={...state,car:{...state.car}};if(previous&&previous.caseIndex===s.caseIndex&&previous.mode===s.mode){s.distance=previous.distance+(s.distance-previous.distance)*alpha;for(const k of ['offset','steering'])s.car[k]=previous.car[k]+(s.car[k]-previous.car[k])*alpha;}
    const c=this.c,p=CASES[s.caseIndex];if(!this.backgrounds.has(s.caseIndex)){const b=document.createElement('canvas');b.width=W;b.height=H;sky(b.getContext('2d'),p);this.backgrounds.set(s.caseIndex,b);}c.drawImage(this.backgrounds.get(s.caseIndex),0,0);
    c.save();if(!this.reducedMotion&&s.tick-s.hitTick<12)c.translate(Math.sin(s.tick*2)*(12-s.tick+s.hitTick)*.35,0);
    road(c,s,p);scenery(c,s,p);actors(c,s);
    const player=project(s,0,s.car.offset);
    if(s.car.speed>15&&Math.abs(s.car.offset)>6){c.fillStyle=p.verge+'80';for(let i=0;i<8;i++){const life=((s.tick*2+i*11)%48)/48;c.beginPath();c.ellipse(player.x+(i%2?1:-1)*(72+life*100),BASE+life*25,10+life*20,6+life*8,0,0,Math.PI*2);c.fill();}}
    car(c,player.x,BASE,188,'#dfdfcc',{police:true,yaw:-s.car.steering*.1,boost:s.turbo>0,brake:!!(s.lastMask&8),tick:s.tick,flash:s.invulnerable>0&&s.tick%8<4});
    if(s.tick-s.hitTick<18)for(let i=0;i<12;i++){const life=s.tick-s.hitTick,x=player.x+Math.cos(i*2.4)*life*5,y=BASE-100+Math.sin(i*2.4)*life*3;line(c,[[x,y],[x+Math.cos(i*2.4)*9,y+Math.sin(i*2.4)*9]],'#ffd88c',3);}
    if(p.kind==='rain'&&!this.reducedMotion){c.strokeStyle='#d1e7eb45';c.lineWidth=1;for(let i=0;i<75;i++){const x=(i*79+s.tick*4)%W,y=(i*131+s.tick*13)%H;line(c,[[x,y],[x-8,y+23]],'#d1e7eb45');}}
    c.restore();
    const shade=c.createLinearGradient(0,450,0,H);shade.addColorStop(0,'#07182500');shade.addColorStop(1,'#071825ab');c.fillStyle=shade;c.fillRect(0,450,W,H-450);
    text(c,p.route.toUpperCase(),30,39,16,p.accent);text(c,'UNIT 07 / HIGHWAY INTERCEPT',30,61,11,'#e4e6d9');
    const gap=Math.round(s.target.distance-s.distance);text(c,gap<0?'TARGET BEHIND':`${Math.max(0,gap)} M TO TARGET`,W-30,39,19,'#ffdf9b','right');
    if(s.tick<s.noticeUntil){text(c,s.notice,W/2,99,17,'#fff1cd','center');}
    if(s.car.speed<3&&s.tick<240)text(c,'HOLD W / ↑ TO ACCELERATE',W/2,420,24,'#fff1cd','center');
    if(Math.abs(s.car.offset)>6)text(c,'LOOSE SHOULDER · STEER BACK ON',W/2,137,17,'#ffc69c','center');
    text(c,String(Math.round(s.car.speed*3.6)).padStart(3,'0'),W-34,H-51,62,'#fff0d6','right');text(c,'KM/H · AUTO',W-38,H-28,13,p.accent,'right');
    text(c,s.turbo?'TURBO ENGAGED':'TURBO  '+('◆ '.repeat(s.boosts)||'EMPTY'),30,H-43,21,s.turbo?'#84e7f3':'#ffda92');
    const hits=CASES[s.caseIndex].hits;for(let i=0;i<hits;i++){c.fillStyle=i<s.target.hits?'#79ddc1':'#304e5d';c.fillRect(W/2-hits*14+i*28,24,20,6);}
  }
}
