// SPDX-License-Identifier: Apache-2.0
import {hitbox2D} from '../../modules/combat2d/index.js';
import {SceneryCache} from './scenery.js';
const W=960,H=540;
export class FoundryView {
  cache=new SceneryCache();sparks=[];flashes=new Map();shakeUntil=0;
  constructor(canvas,{reducedMotion=false}={}) {this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reducedMotion=reducedMotion;if(!this.ctx)throw new Error('Canvas2D is unavailable');}
  clear(){this.sparks=[];this.flashes.clear();this.shakeUntil=0;}
  feedback(events,tick) {
    for(const e of events)if(e.type==='hit'&&e.damage) {
      this.flashes.set(e.target,tick+5);this.shakeUntil=tick+5;
      for(let i=0;i<9;i++)this.sparks.push({x:e.x,y:e.y+256,dx:(i*53%17-8)*14,dy:(i*71%17-3)*14,born:tick});
    }
    this.sparks=this.sparks.slice(-128);
  }
  draw(s,paused=false) {
    const ctx=this.ctx,stage=s.pack[s.mode],scenery=this.cache.get(s.pack,s.mode),p=scenery.palette;
    const player=s.combat.actors[0];
    const camera=Math.max(0,Math.min(stage.width-9600,player.x-(s.mode==='run'?3000:4800)));
    const cameraY=Math.max(0,Math.min(stage.height-5400,player.y-2400));
    const X=x=>(x-camera)*.1,Y=y=>H-(y-cameraY)*.1,t=s.tick;
    ctx.fillStyle=p.sky;ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(690,130,10,690,130,650);glow.addColorStop(0,p.steel);glow.addColorStop(1,p.ink);ctx.fillStyle=glow;ctx.globalAlpha=.6;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
    if(s.mode==='run')this.skyline(scenery,camera,t);
    else this.arena(p,t);
    ctx.save();
    if(!paused&&!this.reducedMotion&&t<this.shakeUntil)ctx.translate([2,-3,1,-1,2][t%5],[1,-2,2,0,-1][t%5]);
    if(s.mode==='run') {
      ctx.fillStyle=p.ink;ctx.fillRect(0,Y(stage.ground),W,80);
      ctx.fillStyle=p.steel;ctx.fillRect(0,Y(stage.ground),W,5);
      for(let x=-camera*.1%80;x<W;x+=80) {ctx.strokeStyle='#34414a';ctx.strokeRect(x,Y(stage.ground)+8,74,28);ctx.fillStyle=p.accent;ctx.fillRect(x+4,Y(stage.ground)+12,18,3);}
      for(const pl of stage.platforms){const x=X(pl.x1),y=Y(pl.y),w=(pl.x2-pl.x1)*.1;
        ctx.fillStyle='#263640';ctx.fillRect(x,y,w,16);ctx.fillStyle=p.accent;ctx.fillRect(x,y,w,3);
        ctx.strokeStyle=p.steel;ctx.lineWidth=2;
        for(let i=0;i<w;i+=25){ctx.beginPath();ctx.moveTo(x+i,y+4);ctx.lineTo(x+i+20,y+14);ctx.stroke();}
        ctx.fillStyle='#1d2932';ctx.fillRect(x+8,y+16,9,H-y);ctx.fillRect(x+w-17,y+16,9,H-y);
      }
      const exitX=X(stage.exit.x);
      ctx.fillStyle=s.cleared===stage.encounters.length?p.accent:p.steel;ctx.fillRect(exitX-6,Y(stage.exit.y)-150,6,150);ctx.fillRect(exitX+70,Y(stage.exit.y)-150,6,150);ctx.fillRect(exitX-6,Y(stage.exit.y)-150,82,10);
      ctx.font='bold 10px monospace';ctx.fillText('EXTRACTION',exitX-3,Y(stage.exit.y)-160);
    }
    for(const {box:b} of stage.solids){const x=X(b.minX),y=Y(b.maxY),w=(b.maxX-b.minX)*.1,h=(b.maxY-b.minY)*.1;
      ctx.fillStyle='#0b1118';ctx.fillRect(x+7,y+7,w,h);ctx.fillStyle=p.steel;ctx.fillRect(x,y,w,h);
      ctx.strokeStyle='#9ba495';ctx.lineWidth=2;ctx.strokeRect(x+6,y+6,w-12,h-12);
      ctx.strokeStyle=p.ink;ctx.beginPath();ctx.moveTo(x+7,y+7);ctx.lineTo(x+w-7,y+h-7);ctx.moveTo(x+w-7,y+7);ctx.lineTo(x+7,y+h-7);ctx.stroke();
      ctx.fillStyle=p.accent;for(let i=0;i<w-4;i+=14)ctx.fillRect(x+i+2,y+2,7,4);
    }
    for(const [i,pickup]of stage.pickups.entries())if(!s.picked.includes(i)) {
      const x=X(pickup.x),y=Y(pickup.y)-20+Math.sin(t*.07)*3;ctx.fillStyle='#81e4be';ctx.fillRect(x-10,y-10,20,20);ctx.strokeStyle='#c1ffe1';ctx.strokeRect(x-13,y-13,26,26);
      ctx.fillStyle=p.ink;ctx.fillRect(x-2,y-7,4,14);ctx.fillRect(x-7,y-2,14,4);
    }
    // Depth order is presentation only; collision order remains numeric identity.
    const actors=[...s.combat.actors].sort((a,b)=>b.y-a.y||a.id-b.id);
    for(const a of actors)if(a.health>0) {
      const agent=s.agents.find(g=>g.id===a.id),definition=s.pack.combat.actors.find(d=>d.id===agent.definition);
      const x=X(a.x),y=Y(a.y);if(x<-100||x>W+100)continue;
      const telling=agent.tell>0||(a.attack&&a.attack.age<a.attack.move.windup);
      if(telling){ctx.strokeStyle=p.enemy;ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.ellipse(x,y-3,42,12,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=p.enemy;ctx.font='bold 20px monospace';ctx.fillText('!',x-5,y-65);}
      if(a.attack&&a.attack.age>=a.attack.move.windup&&a.attack.age<a.attack.move.windup+a.attack.move.active) {
        const b=hitbox2D(a);ctx.fillStyle=a.id===1?'#ffe0a680':'#ff6c6c70';ctx.fillRect(X(b.minX),Y(b.maxY),(b.maxX-b.minX)*.1,(b.maxY-b.minY)*.1);
        const angle=Math.atan2(-a.attack.faceY,a.attack.faceX);
        ctx.strokeStyle=a.id===1?'#ffe1a4':p.enemy;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y-a.attack.move.offset*.1,a.attack.move.reach*.09,angle-1.1,angle+1.1);ctx.stroke();
      }
      this.actor(a,agent,definition,x,y,p,t);
    }
    for(const shot of s.combat.projectiles){const x=X(shot.x),y=Y(shot.y);ctx.strokeStyle=shot.team===0?'#ffdc8b':'#ff735c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-shot.vx*.018,y+shot.vy*.018);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff3d7';ctx.fillRect(x-3,y-2,6,4);}
    this.sparks=this.sparks.filter(b=>t-b.born<18);
    for(const b of this.sparks){const age=t-b.born;ctx.fillStyle=age<6?'#fffce5':p.accent;ctx.globalAlpha=1-age/18;ctx.fillRect(X(b.x+b.dx*age*.3),Y(b.y+b.dy*age*.3-age*age*3),age<6?4:2,age<6?4:2);}ctx.globalAlpha=1;
    ctx.restore();
    const vignette=ctx.createRadialGradient(480,270,170,480,270,580);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#00000080');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#b7c7c71a';for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,1);
    ctx.fillStyle=p.accent;ctx.font='bold 10px monospace';ctx.fillText(s.mode==='run'?'SECTOR / MERIDIAN INDUSTRIAL':'SECTOR / ZERO RING',22,28);
    ctx.textAlign='right';ctx.fillStyle='#afbec5';ctx.fillText('QSOL–IMC  /  INDEPENDENT SYSTEMS',938,28);ctx.textAlign='left';
  }
  skyline(g,camera,t) {
    const c=this.ctx,p=g.palette;
    c.fillStyle='#d7b886';c.globalAlpha=.65;c.beginPath();c.arc(753-camera*.008,102,35,0,Math.PI*2);c.fill();c.globalAlpha=1;
    for(const [layer,factor]of [[0,.2],[1,.5]])for(const b of g.buildings){const x=(b.x-camera*factor)*.1,y=470-b.height*.1-(layer?0:70),w=b.width*.1;
      if(x<-w||x>W)continue;c.fillStyle=layer?'#1b2a33':'#24323d';c.fillRect(x,y,w,500-y);
      c.fillRect(x+w*.65,y-22,8,22);c.strokeStyle='#40515b';c.strokeRect(x+4,y+4,w-8,470-y);
      for(let iy=0;iy<5;iy++)for(let ix=0;ix<b.windows;ix++){c.fillStyle=(ix+iy+b.height)%3?'#405763':'#be8c4e';c.globalAlpha=layer?.6:.3;c.fillRect(x+9+ix*12,y+16+iy*27,5,10);}c.globalAlpha=1;
      if(layer&&b.height%2){c.fillStyle='#63707b';c.globalAlpha=.12;for(let j=0;j<4;j++){c.beginPath();c.ellipse(x+w*.7+(t*.1+j*14)%45,y-30-j*20,14+j*7,10+j*6,0,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
    }
    c.strokeStyle='#111b22';c.lineWidth=6;for(let x=-camera*.08%280;x<W;x+=280){c.beginPath();c.moveTo(x,0);c.lineTo(x+180,480);c.stroke();}
    c.strokeStyle='#53606a';c.lineWidth=1;c.beginPath();c.moveTo(0,165);c.bezierCurveTo(220,245,650,120,960,192);c.stroke();
  }
  arena(p,t) {
    const c=this.ctx;c.fillStyle='#18262d';c.fillRect(30,55,900,450);
    c.strokeStyle='#31434c';c.lineWidth=1;
    for(let x=30;x<930;x+=60)for(let y=55;y<505;y+=60)c.strokeRect(x+2,y+2,56,56);
    c.strokeStyle=p.steel;c.lineWidth=6;c.strokeRect(30,55,900,450);
    c.strokeStyle=p.accent;c.globalAlpha=.28;c.lineWidth=2;c.beginPath();c.arc(480,285,170,0,Math.PI*2);c.stroke();c.beginPath();c.arc(480,285,160,0,Math.PI*2);c.stroke();
    c.font='bold 105px monospace';c.textAlign='center';c.fillStyle=p.accent;c.fillText('ZERO',480,318);c.textAlign='left';c.globalAlpha=1;
    for(let x=50;x<920;x+=35){c.fillStyle=p.accent;c.globalAlpha=.5+.2*Math.sin(t*.03+x);c.fillRect(x,56,18,5);c.fillRect(x,499,18,5);}c.globalAlpha=1;
  }
  actor(a,agent,d,x,y,p,t) {
    const c=this.ctx,player=a.id===1,brute=d.behaviour==='brute',sentry=d.behaviour==='sentry';
    const flash=(this.flashes.get(a.id)??0)>t,colour=flash?'#fff9df':player?p.accent:p.enemy;
    const gait=Math.abs(agent.body.vx)+Math.abs(agent.body.vy)>0?Math.sin(t*.4+a.id)*5:0;
    c.save();c.translate(x,y);c.scale(a.faceX<0?-1:1,1);
    c.fillStyle='#050b1280';c.beginPath();c.ellipse(0,0,brute?25:18,6,0,0,Math.PI*2);c.fill();
    c.strokeStyle=flash?'#fff9df':'#25323c';c.lineWidth=brute?12:8;c.lineCap='square';
    c.beginPath();c.moveTo(-7,-22);c.lineTo(-9-gait,-4);c.moveTo(7,-22);c.lineTo(10+gait,-4);c.stroke();
    c.fillStyle=colour;c.fillRect(brute?-19:-13,brute?-48:-42,brute?38:26,brute?30:24);
    c.fillStyle='#13252c';c.fillRect(-7,-36,14,10);c.fillStyle=player?'#97f5e2':'#f5d3ad';c.fillRect(-5,-34,10,3);
    c.fillStyle=colour;c.fillRect(-10,-57,22,16);c.fillStyle='#0c1b23';c.fillRect(-7,-53,20,6);c.fillStyle=player?'#bcffef':'#ffdda3';c.fillRect(1,-52,11,3);
    c.strokeStyle=colour;c.lineWidth=brute?10:7;c.beginPath();c.moveTo(-13,-38);c.lineTo(-17-gait,-22);c.moveTo(13,-37);c.lineTo(a.attack?29:21,-29);c.stroke();
    if(player||sentry){c.fillStyle='#9aa7a5';c.fillRect(15,-34,sentry?28:24,6);c.fillStyle='#25363f';c.fillRect(22,-28,5,9);}
    if(brute){c.fillStyle='#b2a995';c.fillRect(18,-34,20,16);c.fillStyle='#273943';c.fillRect(23,-30,10,8);}
    if(a.invulnerability>0&&t%6<3){c.strokeStyle='#ffffffaa';c.lineWidth=2;c.strokeRect(-21,-62,48,64);}
    c.restore();
    if(!player){c.fillStyle='#050b14';c.fillRect(x-18,y-71,36,3);c.fillStyle=p.enemy;c.fillRect(x-18,y-71,36*a.health/a.maxHealth,3);}
  }
}
