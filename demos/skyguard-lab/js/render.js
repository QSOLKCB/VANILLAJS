// SPDX-License-Identifier: Apache-2.0
// Original Canvas naval scene. Rendering never consumes the simulation RNG.
import {WIDTH,HEIGHT,MUZZLE,AIRCRAFT,stationForRound} from './content.js';
import {targetAt,leadPoint,stats} from './sim.js';
import {seededRandom} from '../../../modules/math/index.js';
const PALETTES=[['#071a30','#355b71','#dbac83','#102f43'],['#101c34','#484e73','#ba849a','#162e43'],['#091b26','#366772','#a0c9be','#123b48'],['#131d34','#395b82','#c9a680','#142d46']];
export function createRenderer(canvas){
  const c=canvas.getContext('2d',{alpha:false});canvas.width=WIDTH;canvas.height=HEIGHT;
  const scenery=document.createElement('canvas');scenery.width=WIDTH;scenery.height=HEIGHT;const bg=scenery.getContext('2d');let sector=-1;
  function poly(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function line(ctx,x,y,xx,yy,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();}
  function circle(ctx,x,y,r,color,stroke=false,width=1){ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,Math.PI*2);if(stroke){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}else{ctx.fillStyle=color;ctx.fill();}}
  function label(text,x,y,color='#afd1d8',size=10,align='left'){c.fillStyle=color;c.font=size+'px ui-monospace, monospace';c.textAlign=align;c.fillText(text,x,y);c.textAlign='left';}
  function background(round){
    sector=Math.floor((round-1)/4)%4;const [top,middle,horizon,water]=PALETTES[sector],random=seededRandom(401+sector);
    const sky=bg.createLinearGradient(0,0,0,440);sky.addColorStop(0,top);sky.addColorStop(.62,middle);sky.addColorStop(1,horizon);bg.fillStyle=sky;bg.fillRect(0,0,WIDTH,HEIGHT);
    const glow=bg.createRadialGradient(810,348,3,810,348,190);glow.addColorStop(0,'#ffd7a54d');glow.addColorStop(1,'#ffd7a500');bg.fillStyle=glow;bg.fillRect(600,140,420,300);circle(bg,810,348,30,'#f8c79c');
    for(let i=0;i<26;i++){const x=random()*1300-80,y=30+random()*300,w=80+random()*240;bg.globalAlpha=.13+random()*.15;poly(bg,[[x,y],[x+w*.17,y-10],[x+w*.58,y-5],[x+w*.77,y+7],[x+w,y+12],[x+w*.08,y+12]],i%2?'#c0cfdd':'#15283e');}bg.globalAlpha=1;
    poly(bg,[[0,407],[90,389],[154,400],[228,390],[310,414],[420,409],[550,420],[0,432]],'#294554');
    bg.fillStyle=water;bg.fillRect(0,420,WIDTH,300);const sea=bg.createLinearGradient(0,420,0,720);sea.addColorStop(0,'#91b2ba55');sea.addColorStop(.14,'#234c6155');sea.addColorStop(1,'#061721');bg.fillStyle=sea;bg.fillRect(0,420,WIDTH,300);
    for(let i=0;i<180;i++){const y=424+random()*295;line(bg,random()*WIDTH,y,random()*WIDTH,y,i%3?'#bfdde70a':'#99cbd016',.5+Math.pow((y-420)/300,2)*2);}
    for(const [x,scale] of [[135,.8],[990,.55]]){bg.save();bg.translate(x,426);bg.scale(scale,scale);poly(bg,[[-65,0],[60,0],[39,10],[-52,9]],'#152d3a');poly(bg,[[-25,0],[-21,-16],[10,-16],[19,-3]],'#253c48');bg.fillStyle='#203640';bg.fillRect(-4,-35,3,24);line(bg,-15,-28,15,-28,'#314b56',2);bg.restore();}
  }
  function ship(s){
    // The bow, rails, vertical launch cells and forward gun establish the ship.
    poly(c,[[576,441],[278,720],[890,720]],'#132b38');poly(c,[[576,445],[318,720],[842,720]],'#354a55');poly(c,[[576,454],[350,720],[810,720]],'#3d515a');
    poly(c,[[576,454],[560,490],[565,720],[592,720],[590,490]],'#4b5d63');
    line(c,576,457,337,716,'#9caaa6',2);line(c,576,457,827,716,'#9caaa6',2);
    for(let i=0;i<7;i++){const t=i/7,y=478+t*230,left=576-239*(y-457)/259,right=576+251*(y-457)/259;line(c,left,y,left,y-12-12*t,'#b6c0b9',1.5);line(c,right,y,right,y-12-12*t,'#b6c0b9',1.5);}
    line(c,572,450,328,692,'#8ca7b2',1);line(c,580,450,837,692,'#8ca7b2',1);
    for(let row=0;row<4;row++)for(let col=0;col<3;col++){const x=639+col*24+row*11,y=565+row*24;poly(c,[[x,y],[x+20,y],[x+26,y+17],[x+3,y+17]],'#172f3a');line(c,x+2,y+3,x+19,y+3,'#6e858c',2);}
    poly(c,[[0,550],[107,518],[170,565],[193,720],[0,720]],'#152c38');poly(c,[[0,550],[107,518],[105,607],[0,639]],'#36545f');poly(c,[[107,518],[170,565],[167,647],[105,607]],'#263e4b');
    poly(c,[[0,567],[94,536],[94,560],[0,590]],'#72afb4');poly(c,[[116,539],[157,572],[157,590],[116,562]],'#4b8495');
    for(let i=0;i<5;i++)line(c,18+i*20,560-i*6,18+i*20,582-i*6,'#1b3642',3);
    c.fillStyle='#1a303d';c.fillRect(68,424,7,99);line(c,35,456,103,456,'#6a919b',4);circle(c,72,438,4,s.tick%100<50?'#8af3d5':'#39626d');
    label('DDG · 047',24,678,'#7796a1',17);label('RESOLUTE',24,700,'#5f8190',10);
    // A different physical weapon assembly occupies the forward battery each round.
    c.save();c.translate(576,687);const aim=Math.atan2(s.aim.x-576,Math.max(20,687-s.aim.y));c.rotate(aim*.32);
    circle(c,0,23,84,'#152b35');poly(c,[[-74,8],[-52,-30],[48,-30],[72,8],[58,44],[-60,44]],'#526d76');poly(c,[[-74,8],[0,24],[72,8],[58,44],[-60,44]],'#314e5a');
    if(s.station==='cannon')for(const x of [-19,19]){c.fillStyle='#132b35';c.fillRect(x-7,-93,14,100);c.fillStyle='#77929c';c.fillRect(x-4,-83,4,80);for(let j=0;j<4;j++){c.fillStyle='#3b5a65';c.fillRect(x-10,-79+j*13,20,5);}}
    if(s.station==='flak'){poly(c,[[-16,-101],[13,-101],[20,13],[-24,13]],'#1a3542');c.fillStyle='#8198a0';c.fillRect(-12,-99,6,101);c.fillStyle='#213e4b';c.fillRect(-23,-106,44,18);}
    if(s.station==='missile'){for(let x=-42;x<=42;x+=28){c.fillStyle='#183742';c.fillRect(x-10,-56,22,72);c.fillStyle='#80a9b0';c.fillRect(x-7,-55,16,9);}label('VLS',-16,-14,'#8af3d5',11);}
    if(s.station==='rail'){for(const x of [-21,21]){poly(c,[[x-8,-111],[x+7,-111],[x+14,10],[x-13,10]],'#213e51');line(c,x,-106,x,4,'#75cce9',3);for(let j=0;j<4;j++){c.fillStyle='#557e90';c.fillRect(x-12,-88+j*22,24,7);}}if(s.charge)circle(c,0,-86,3+15*s.charge/stats(s).charge,'#bcefff');}
    c.restore();
  }
  function aircraft(e,s){
    const scale=(.65+e.y/900)*(e.kind==='bomber'?1.1:1),bank=Math.max(-.3,Math.min(.3,e.vx*.3));c.save();c.translate(e.x,e.y);c.scale(scale,scale);c.rotate(bank);
    const body=e.flash?'#f7f5d0':e.kind==='bomber'?'#a4b3b8':'#bfd3d6',shadow='#3c626f',accent=e.kind==='skimmer'?'#f69b79':'#eec185';
    if(e.kind==='drone'){
      for(const x of [-16,16])for(const y of [-9,9]){line(c,0,0,x,y,shadow,5);circle(c,x,y,7,'#9ebdc7',true,2);line(c,x-7,y+Math.sin(s.tick*.7)*3,x+7,y-Math.sin(s.tick*.7)*3,'#c8e6e6',1);}
      poly(c,[[-8,-13],[8,-13],[11,11],[0,16],[-11,11]],body);circle(c,0,5,3,accent);
    }else if(e.kind==='skimmer'){
      poly(c,[[-4,-16],[4,-16],[5,9],[0,20],[-5,9]],body);poly(c,[[0,-2],[-14,8],[-14,11],[14,11],[14,8]],shadow);circle(c,0,-18,4,'#ffd2a0');
    }else{
      const wing=e.kind==='bomber'?42:30;
      poly(c,[[-wing,2],[-5,-9],[0,-24],[5,-9],[wing,2],[wing,10],[6,4],[5,22],[0,29],[-5,22],[-6,4],[-wing,10]],body);
      poly(c,[[-wing,7],[-6,1],[0,7],[6,1],[wing,7],[wing,10],[6,6],[0,13],[-6,6],[-wing,10]],shadow);
      poly(c,[[-4,-12],[4,-12],[3,6],[-3,6]],'#2c5266');poly(c,[[-4,-15],[-12,-23],[-12,-28],[0,-22],[12,-28],[12,-23],[4,-15]],shadow);
      for(const x of e.kind==='bomber'?[-17,17]:[-4,4]){c.fillStyle=shadow;c.fillRect(x-3,-8,6,20);circle(c,x,-11,2,accent);}
    }
    c.restore();
    if(e.hp<AIRCRAFT[e.kind].hp){c.fillStyle='#143039';c.fillRect(e.x-16,e.y+e.size*.8+9,32,3);c.fillStyle='#f3ad7c';c.fillRect(e.x-16,e.y+e.size*.8+9,32*Math.max(0,e.hp)/(AIRCRAFT[e.kind].hp*(1+(s.round-1)*.06)),3);}
  }
  function effects(s,reduced){
    for(const p of s.projectiles){
      if(p.kind==='cannon'){line(c,p.oldX,p.oldY,p.x,p.y,'#ffe8ae',2);circle(c,p.x,p.y,2,'#fff8d9');}
      else if(p.kind==='flak'){circle(c,p.tx,p.ty,p.radius,'#ffcf8044',true);line(c,p.oldX,p.oldY,p.x,p.y,'#ffd39d',3);circle(c,p.x,p.y,4,'#fff3d0');}
      else{line(c,p.x-Math.cos(p.angle)*46,p.y-Math.sin(p.angle)*46,p.x,p.y,'#9abbce66',5);c.save();c.translate(p.x,p.y);c.rotate(p.angle);poly(c,[[-14,-3],[9,-3],[15,0],[9,3],[-14,3]],'#dae5d8');poly(c,[[-13,-4],[-26,0],[-13,4]],'#ffc07a');c.restore();}
    }
    for(const e of s.effects){const t=e.age/e.life,a=1-t;
      if(e.type==='beam'){line(c,e.x,e.y,e.endX,e.endY,'#68cde8'+Math.round(a*100).toString(16).padStart(2,'0'),12*a+1);line(c,e.x,e.y,e.endX,e.endY,'#e3fbff',2*a+.5);continue;}
      if(e.type==='splash'){c.save();c.translate(e.x,e.y);c.scale(1,.35);circle(c,0,0,e.radius*(.3+t),'#b7e7e8',true,2*a);c.restore();continue;}
      if(e.type==='spark'){circle(c,e.x,e.y,e.radius*a,'#ffefc0');continue;}
      c.save();c.globalAlpha=a;
      if(!reduced){const g=c.createRadialGradient(e.x,e.y,1,e.x,e.y,e.radius*(.5+t));g.addColorStop(0,'#ffc57b55');g.addColorStop(1,'#ffba6900');c.fillStyle=g;c.fillRect(e.x-e.radius*1.5,e.y-e.radius*1.5,e.radius*3,e.radius*3);}
      circle(c,e.x,e.y,e.radius*(.3+t),'#ffce9b',true,2*a);
      for(let i=0;i<7;i++){const theta=i*2.4+e.id;circle(c,e.x+Math.sin(theta)*e.radius*t*.55,e.y+Math.cos(theta)*e.radius*t*.55-e.age*.3,e.radius*(.22+t*.15),t<.25?'#ffe1ac':t<.5?'#c48c65':'#394957');}
      if(t<.3&&!reduced)circle(c,e.x,e.y,e.radius*(.32-t),'#fff7de');c.restore();
    }
    for(const b of s.debris){c.save();c.translate(b.x,b.y);c.rotate(b.spin+b.age*.1);c.fillStyle=b.age<18?'#ffd49a':'#6f8993';c.fillRect(-b.size/2,-b.size/2,b.size,b.size*.55);c.restore();}
  }
  function radar(s){
    const x=1031,y=110,r=69;c.fillStyle='#061c2cbb';c.fillRect(x-87,y-91,174,184);
    for(const rr of [23,46,69])circle(c,x,y,rr,'#55829055',true);
    line(c,x-r,y,x+r,y,'#55829044');line(c,x,y-r,x,y+r,'#55829044');
    const a=s.tick*.026;line(c,x,y,x+Math.sin(a)*r,y-Math.cos(a)*r,'#8bf1d9',1.5);
    for(const e of s.enemies){const px=x+(e.x-576)/576*r,py=y+(e.y-560)/500*r;circle(c,px,py,e.kind==='bomber'?3:2,e.id===s.lockId?'#ffd090':'#8bedda');}
    poly(c,[[x,y+4],[x-4,y+12],[x+4,y+12]],'#e6f8ec');label('AIR SEARCH / 360',x,y-77,'#a2c6ce',9,'center');label(String(s.enemies.length).padStart(2,'0')+' ACTIVE',x,y+84,'#8bedda',9,'center');
  }
  function reticle(s){const {x,y}=s.aim,p=stats(s),target=targetAt(s),locked=s.station==='missile'&&s.lockTicks>=p.lock,color=locked?'#ffca80':'#a7eee4';
    if(target){circle(c,target.x,target.y,target.size+13,'#c0e7e266',true);if(s.station==='cannon'){const lead=leadPoint(target);poly(c,[[lead.x,lead.y-5],[lead.x+5,lead.y],[lead.x,lead.y+5],[lead.x-5,lead.y]],'#c5f7e3');}}
    if(s.station==='flak')circle(c,x,y,p.radius,'#b9e0d338',true);
    if(s.station==='missile'){circle(c,x,y,27,'#afd5d044',true);c.beginPath();c.arc(x,y,27,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,s.lockTicks/p.lock));c.strokeStyle=color;c.lineWidth=3;c.stroke();label(locked?'LOCKED':target?'ACQUIRING':'SEEK TARGET',x,y+47,color,9,'center');}
    if(s.station==='rail'){circle(c,x,y,22,'#a3ddef66',true);c.beginPath();c.arc(x,y,22,-Math.PI/2,-Math.PI/2+Math.PI*2*s.charge/p.charge);c.strokeStyle='#b9f0ff';c.lineWidth=4;c.stroke();label(s.charge>=p.charge?'RELEASE TO FIRE':'HOLD TO CHARGE',x,y+40,'#b9e0ef',9,'center');}
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])line(c,x+dx*9,y+dy*9,x+dx*18,y+dy*18,color,1);circle(c,x,y,1.5,'#fff1cb');
  }
  return {draw(s,{reducedMotion=false,aim=true}={}){
    if(sector!==Math.floor((s.round-1)/4)%4)background(s.round);c.drawImage(scenery,0,0);
    for(let i=0;i<12;i++){const y=440+i*19,x=(i*173+s.tick*(.2+i*.035))%WIDTH;line(c,x,y,x+30+i*5,y,'#88b5bd20',1+i*.15);}
    [...s.enemies].sort((a,b)=>a.y-b.y).forEach(e=>aircraft(e,s));effects(s,reducedMotion);ship(s);radar(s);
    // Grid references and deck HUD remain readable above all weather palettes.
    for(const x of [24,1128]){line(c,x,24,x+(x===24?24:-24),24,'#9bc8cf88');line(c,x,24,x,48,'#9bc8cf88');line(c,x,690,x+(x===24?24:-24),690,'#9bc8cf88');line(c,x,690,x,666,'#9bc8cf88');}
    label('BLUEWATER / SECTOR '+String(Math.floor((s.round-1)/4)+1).padStart(2,'0'),42,46,'#d4e7e5',11);label('N 34° 12′ / E 141° 08′',42,64,'#92b7c4',9);
    label(stationForRound(s.round).weapon+'  /  DDG RESOLUTE',215,687,'#afc6cc',10);label('HULL '+Math.ceil(s.hp)+'%',1111,687,s.hp<30?'#ffaf84':'#8cebd5',10,'right');
    if(aim)reticle(s);
  }};
}
