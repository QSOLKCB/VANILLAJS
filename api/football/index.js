// SPDX-License-Identifier: Apache-2.0
// SOCCERWEB v3.1.1; see docs/FOOTBALL_SDK.md and football PROVENANCE.json.
// Compatibility frame: Q8 pixels, +Y down, 60 Hz; not engine SI coordinates.
import {Q, clamp, attack, goalGeometry} from '../../modules/football/index.js';
// Adapted source: render/camera.mjs
// Camera coordinates are cosmetic pixels. Never pass them back into the simulation.
export function cameraFrame(s, width, height, options = {}, prior = null, dt = 1 / 60) {
  const pw = s.w / Q, ph = s.h / Q;
  const zoom = options.zoom === 'wide' ? .82 : options.zoom === 'close' ? 1.12 : 1;
  let scale = Math.max(.2, Math.min(1.32, width / (options.demo ? 850 : 800), height / 620) * zoom);
  let vw = width / scale, vh = height / scale;
  const ballX = s.ball.x / Q, ballY = (s.ball.y - s.ball.z) / Q;
  const anticipation = options.reduced ? 0 : 9;
  const selected = s.players[s.selected[0]];
  let x = ballX * .86 + selected.x / Q * .14 + s.ball.vx / Q * anticipation;
  let y = ballY * .86 + selected.y / Q * .14 + s.ball.vy / Q * anticipation;
  const bounds = (n, size, view) => view >= size + 110 ? size / 2 : clamp(n, view / 2 - 65, size - view / 2 + 65);
  x = bounds(x, pw, vw); y = bounds(y, ph, vh);
  const blend = options.reduced ? 1 : 1 - Math.exp(-Math.min(.1, Math.max(0, dt)) * 9);
  if (prior) { x = prior.x + (x - prior.x) * blend; y = prior.y + (y - prior.y) * blend; }
  // Hard visibility guard: a fast shot or aerial ball may outrun the smoothed target.
  x = clamp(x, ballX - vw / 2 + 45, ballX + vw / 2 - 45);
  y = clamp(y, ballY - vh / 2 + 55, ballY + vh / 2 - 55);
  if(s.goalposts){
    const g=goalGeometry(s,0),left=Math.min(g.left/Q,ballX),right=Math.max(g.right/Q,ballX),top=Math.min(-65,ballY),bottom=Math.max(30,ballY);
    scale=Math.min(scale,width/(right-left+130),height/(bottom-top+130));vw=width/scale;vh=height/scale;
    x=clamp(x,right-vw/2+60,left+vw/2-60);y=clamp(y,bottom-vh/2+60,top+vh/2-60);
  }
  return { x, y, scale, vw, vh };
}

// Adapted source: render/players.mjs
// Pose selection is a pure observation of authoritative state, not an animation state machine in physics.
export function playerPose(s, p, previous = p, reduced = false) {
  const speed = Math.hypot(p.vx, p.vy) / Q;
  const celebrating = s.phase === 'goal' && p.team === 1 - s.restartTeam;
  let state = 'idle';
  if (celebrating) state = 'celebrate';
  else if (p.slip) state = 'fall';
  else if (p.slide) state = 'slide';
  else if (p.dive) state = 'dive';
  else if (p.keeper && s.ball.owner === p.id) state = 'catch';
  else if (p.charge) state = 'windup';
  else if (s.ball.kicker === p.id && p.cooldown > 0 && p.cooldown <= 18) state = s.ball.kind === 'pass' ? 'pass' : 'kick';
  else if (Math.abs(p.fx - previous.fx) + Math.abs(p.fy - previous.fy) > 100 && speed > .5) state = 'turn';
  else if (speed > 2.8 && s.ball.owner !== p.id) state = 'sprint';
  else if (speed > .3) state = 'run';
  const moving = ['run','sprint','turn','windup'].includes(state) && speed > .3;
  const phase = (s.tick * (state === 'sprint' ? .42 : .32) + p.id * 1.7);
  return { state, speed, facingX:p.fx/Q, facingY:p.fy/Q,
    stride: moving && !reduced ? Math.sin(phase) : 0,
    bounce: reduced ? 0 : celebrating ? Math.abs(Math.sin(s.tick*.2+p.id))*4 : moving ? Math.abs(Math.sin(phase))*1.2 : 0,
    strike:['kick','pass'].includes(state) ? Math.sin((18-p.cooldown)/18*Math.PI) : 0 };
}
function limb(c, x1,y1,x2,y2,x3,y3,skin,cloth,boot=false) {
  c.lineCap='round';c.lineJoin='round';
  c.strokeStyle='#10252c';c.lineWidth=5;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.stroke();
  c.strokeStyle=cloth;c.lineWidth=3;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  c.strokeStyle=skin;c.lineWidth=2.6;c.beginPath();c.moveTo(x2,y2);c.lineTo(x3,y3);c.stroke();
  if(boot){c.fillStyle='#14232b';c.fillRect(x3-2,y3-1,5,3);c.fillStyle='#f1f0d9';c.fillRect(x3+1,y3-1,2,1);}
}
export function drawPlayer(c,s,p,old,x,y,{demo=false,reduced=false,effects=true}={}) {
  const pose=playerPose(s,p,old,reduced),kit=s.clubs[p.team];
  const shirt=p.keeper?(p.team===0?'#76dfcb':'#b9a2ff'):kit.color;
  const dark=p.keeper?'#233b45':kit.dark;
  const skin=['#e7b68a','#c88e68','#92583e','#ddab83'][p.id%4];
  c.fillStyle='#0a292c55';c.beginPath();c.ellipse(x+5,y+4,pose.state==='dive'?17:11,4,0,0,Math.PI*2);c.fill();
  if(s.ball.owner===p.id){c.strokeStyle='#f9f3c480';c.lineWidth=1.2;c.beginPath();c.ellipse(x,y+2,11,5,0,0,Math.PI*2);c.stroke();}
  const selected=!demo&&s.config.humans[p.team]&&s.selected[p.team]===p.id;
  if(selected){
    c.strokeStyle=p.team===0?'#ffda65':'#85e8ff';c.lineWidth=2;c.beginPath();c.ellipse(x,y+3,16,7,0,0,Math.PI*2);c.stroke();
    c.fillStyle='#132b36';c.fillRect(x-11,y-47,22,12);c.fillStyle=c.strokeStyle;
    c.font='bold 9px monospace';c.textAlign='center';c.fillText(`P${p.team+1}`,x,y-38);
    c.beginPath();c.moveTo(x-4,y-32);c.lineTo(x+4,y-32);c.lineTo(x,y-27);c.fill();
    if(s.ball.owner===p.id){c.strokeStyle='#fff5b480';c.lineWidth=1;c.beginPath();c.moveTo(x+p.fx/Q*18,y+p.fy/Q*18);c.lineTo(x+p.fx/Q*26,y+p.fy/Q*26);c.stroke();}
  }
  c.save();c.translate(x,y-pose.bounce);c.scale(1.12,1.12);
  const lying=['slide','fall','dive'].includes(pose.state);
  if(lying){c.translate(0,-3);c.rotate(pose.facingX>=0?1.05:-1.05);}
  const lean=pose.state==='turn'?pose.facingX*2:pose.facingX*.8;
  const step=pose.stride*4, strike=pose.strike*8;
  limb(c,-3,-5,-4,-1+step*.35,-4-pose.facingX*strike,4+step-pose.facingY*strike,shirt,dark,true);
  limb(c,3,-5,4,-1-step*.35,4,4-step,shirt,dark,true);
  const armsUp=['celebrate','catch','dive'].includes(pose.state);
  const armSwing=pose.stride*3;
  limb(c,-6+lean,-16,-9,-11+armSwing,-9-(armsUp?3:0),armsUp?-25:-6+armSwing,p.keeper?'#e7f8ed':skin,shirt);
  limb(c,6+lean,-16,9,-11-armSwing,9+(armsUp?3:0),armsUp?-25:-6-armSwing,p.keeper?'#e7f8ed':skin,shirt);
  c.fillStyle='#102630';c.beginPath();c.moveTo(-6+lean,-18);c.lineTo(6+lean,-18);c.lineTo(5,-6);c.lineTo(-5,-6);c.closePath();c.fill();
  c.fillStyle=shirt;c.beginPath();c.moveTo(-5+lean,-17);c.lineTo(5+lean,-17);c.lineTo(4,-7);c.lineTo(-4,-7);c.closePath();c.fill();
  c.fillStyle=kit.accent;c.fillRect(-5+lean,-16,2,8);c.fillStyle='#ffffff35';c.fillRect(-2+lean,-17,5,2);
  c.fillStyle=dark;c.fillRect(-4,-7,8,4);c.fillStyle=skin;c.fillRect(-2+lean,-21,4,4);
  c.fillStyle='#13262c';c.beginPath();c.ellipse(lean,-24,5,5.6,0,0,Math.PI*2);c.fill();
  c.fillStyle=skin;c.beginPath();c.ellipse(lean,-23.6,4,4.6,0,0,Math.PI*2);c.fill();
  c.fillStyle=p.id%3===0?'#302b29':'#62452f';c.beginPath();c.ellipse(lean,-26,4.4,2.7,0,Math.PI,Math.PI*2);c.fill();c.fillRect(lean-4,-26,8,2);
  if(pose.facingY>=0){c.fillStyle='#233035';c.fillRect(lean-2+pose.facingX,-24,1,1);c.fillRect(lean+1+pose.facingX,-24,1,1);c.fillStyle='#efc5a0';c.fillRect(lean+pose.facingX,-22,1,2);}
  else{c.fillStyle=kit.accent;c.font='bold 7px monospace';c.textAlign='center';c.fillText(String(p.number),lean,-9);}
  if(pose.state==='windup'){c.strokeStyle='#fff1b8';c.lineWidth=1;c.beginPath();c.arc(0,-2,10,Math.PI*.2,Math.PI*.8);c.stroke();}
  c.restore();
  if(effects&&lying&&s.config.weather!=='rain'){c.fillStyle='#e0d9a64a';for(let i=0;i<3;i++)c.fillRect(x-p.vx/Q*(i+2)+i*3,y-p.vy/Q*(i+2),3,2);}
  if(p.charge){c.fillStyle='#10252d';c.fillRect(x-19,y+13,38,7);c.fillStyle=p.charge>42?'#ff9576':'#f6d26b';c.fillRect(x-18,y+14,36*p.charge/60,5);c.fillStyle='#ffffff66';c.fillRect(x-18+36*12/60,y+14,1,5);}
}

// Adapted source: render/stadium.mjs
// Static world layer is drawn once per ground/weather/palette change, not once per frame.
export function drawStadium(c,s,palette='classic') {
  const w=s.w/256,h=s.h/256,indoor=s.config.indoor,wet=s.config.weather==='rain'&&!indoor;
  c.fillStyle=indoor?'#101f37':'#112b31';c.fillRect(-180,-180,w+360,h+360);
  const crowd=['#dbb175','#7398b2','#bf6b7f','#b8cbb5','#577c7b','#d0cfb8'];
  for(let side=0;side<2;side++)for(let row=0;row<6;row++){
    c.fillStyle=row%2?'#182f39':'#1b333d';c.fillRect(side?w+59+row*13:-72-row*13,-150,13,h+300);
    for(let seat=-6;seat<Math.ceil(h/12)+6;seat++){
      const x=side?w+63+row*13:-68-row*13,y=seat*12+(row%2)*5;
      c.fillStyle='#0b1c29';c.fillRect(x-2,y+4,9,6);
      c.fillStyle=crowd[((seat*7+row*5+side+999)%crowd.length)];c.fillRect(x,y,5,6);
      c.fillStyle='#cfaa80';c.fillRect(x+1,y-2,3,3);
    }
  }
  for(const top of [true,false])for(let row=0;row<6;row++)for(let seat=-7;seat<w/12+7;seat++){
    const x=seat*12+row%2*5,y=top?-70-row*13:h+64+row*13;
    c.fillStyle=crowd[(seat*7+row*5+999)%crowd.length];c.fillRect(x,y,6,6);c.fillStyle='#cdab86';c.fillRect(x+1,y-3,4,3);
  }
  c.fillStyle='#071a23';c.fillRect(-49,-47,w+98,h+94);
  c.fillStyle=indoor?'#5a7e93':'#d1c9a2';c.fillRect(-35,-29,w+70,h+58);
  c.fillStyle=indoor?'#183b55':'#264838';c.fillRect(-28,-23,w+56,h+46);
  const colors=indoor?['#2c6e83','#30758a']:palette==='mint'?['#408d6c','#459573']:wet?['#2d6e5d','#327763']:['#32764e','#398254'];
  for(let i=0;i<16;i++){c.fillStyle=colors[i%2];c.fillRect(0,i*h/16,w,h/16+1);}
  // Original deterministic grass blades / arena floor grain, independent of match RNG.
  for(let i=0;i<(indoor?1800:6500);i++){
    c.fillStyle=i%3===0?'#c3da8c12':'#0c332a12';c.fillRect((i*137)%w,(i*211+Math.floor(i/7)*17)%h,indoor?5:1,indoor?1:2);
  }
  if(indoor){c.strokeStyle='#77b0bc18';c.lineWidth=1;for(let x=0;x<w;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}}
  if(wet){c.fillStyle='#c5e6e810';for(let i=0;i<22;i++){c.beginPath();c.ellipse((i*137+35)%w,(i*251+19)%h,18+i%4*9,4,0,0,Math.PI*2);c.fill();}}
  c.strokeStyle=indoor?'#cce4e3ba':'#e2edc5bd';c.lineWidth=2;
  c.strokeRect(2,2,w-4,h-4);c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
  c.beginPath();c.arc(w/2,h/2,indoor?63:82,0,Math.PI*2);c.stroke();c.fillStyle='#f0edd3';c.fillRect(w/2-2,h/2-2,4,4);
  for(const top of [true,false]){
    const d=indoor?112:166,bw=indoor?280:360;
    c.strokeRect((w-bw)/2,top?0:h-d,bw,d);c.strokeRect(w/2-99,top?0:h-56,198,56);
    c.beginPath();c.arc(w/2,top?114:h-114,64,top?.3:Math.PI+.3,top?Math.PI-.3:2*Math.PI-.3);c.stroke();
    c.fillRect(w/2-2,top?113:h-115,4,4);
    if(s.goalposts)continue; // Moving mode draws both frames outside the cached layer.
    const gy=top?-31:h,gw=s.goal/256;
    c.fillStyle='#061a2a75';c.fillRect(w/2-gw/2+6,gy+4,gw,30);
    c.fillStyle='#cce9e91b';c.fillRect(w/2-gw/2,gy,gw,31);
    c.strokeStyle='#d5eaeb70';c.lineWidth=.8;
    for(let x=w/2-gw/2;x<=w/2+gw/2;x+=8){c.beginPath();c.moveTo(x,gy);c.lineTo(x+4,gy+31);c.stroke();}
    for(let y=gy;y<=gy+31;y+=6){c.beginPath();c.moveTo(w/2-gw/2,y);c.lineTo(w/2+gw/2,y);c.stroke();}
    c.strokeStyle='#f2f0de';c.lineWidth=4;c.strokeRect(w/2-gw/2,gy,gw,31);c.strokeStyle='#d8e9caaf';c.lineWidth=2;
  }
  if(indoor){
    c.strokeStyle='#0b1e34';c.lineWidth=14;c.strokeRect(-7,-7,w+14,h+14);
    c.strokeStyle='#a1dce1';c.lineWidth=6;c.strokeRect(-5,-5,w+10,h+10);
    c.strokeStyle='#3da3c2';c.lineWidth=2;c.strokeRect(-11,-11,w+22,h+22);
    for(let y=20;y<h;y+=65){c.fillStyle='#b6e0e34a';c.fillRect(-24,y,12,38);c.fillRect(w+12,y,12,38);}
  }else for(const [x,y]of[[0,0],[w,0],[0,h],[w,h]]){
    c.fillStyle='#eff1d3';c.fillRect(x-1,y-16,2,16);c.fillStyle='#edbe55';c.beginPath();c.moveTo(x+1,y-16);c.lineTo(x+11,y-13);c.lineTo(x+1,y-10);c.fill();
    c.strokeStyle='#e1eac4';c.lineWidth=1;c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.stroke();
  }
  c.font='bold 10px monospace';c.textAlign='center';
  for(let y=80;y<h;y+=205)for(const side of [false,true]){
    c.save();c.translate(side?w+22:-17,y);c.rotate(side?Math.PI/2:-Math.PI/2);
    c.fillStyle=indoor?'#8de6e8':'#ebca69';c.fillText(indoor?'NIGHT COURT · SIX A SIDE':'SOCCERWEB · THE BEAUTIFUL GAME',0,0);c.restore();
  }
  const light=c.createLinearGradient(0,0,w,h);light.addColorStop(0,'#e7efbf0b');light.addColorStop(.45,'#ffffff00');light.addColorStop(1,'#031a2924');c.fillStyle=light;c.fillRect(0,0,w,h);
}
export function drawStadiumMotion(c,s,reduced,effects) {
  const w=s.w/256,h=s.h/256;
  if(!effects)return;
  if(s.phase==='goal'&&!reduced){
    const t=150-s.timer,atTop=s.ball.y<s.h/2,gy=atTop?-25:h+5;
    c.strokeStyle='#eefcff99';c.lineWidth=1;
    for(let i=0;i<(s.goalposts?0:8);i++){const x=w/2-70+i*20;const sway=Math.sin(t*.6+i)*Math.max(0,1-t/100)*6;c.beginPath();c.moveTo(x,gy);c.quadraticCurveTo(x+sway,gy+15,x,gy+28);c.stroke();}
    for(let i=0;i<65;i++){const x=(i*83+t*(i%3-1))%(w+60)-30,y=(i*79+t*3)%(h+60)-30;c.fillStyle=['#f0ca58','#f6f2d9','#91ddcb','#ef839a'][i%4];c.fillRect(x,y,3,5);}
    for(let i=0;i<35;i++){const x=(i*23)%w,hop=Math.sin(t*.4+i)*3;c.fillStyle='#f0c58c';c.fillRect(x,atTop?-70+hop:h+64+hop,3,6);}
  }
  if(s.config.weather==='rain'&&!s.config.indoor){
    c.strokeStyle='#c1e0de35';c.lineWidth=1;
    for(let i=0;i<18;i++){const x=(i*131+27)%w,y=(i*239+71)%h;c.beginPath();c.ellipse(x,y,reduced?4:((s.tick+i*3)%28)/4,2,0,0,Math.PI*2);c.stroke();}
  }
}

// Actual frame geometry remains visible even with minimal effects / reduced motion.
export function standardSign(g,scale=1){
 const unit=Math.max(1,1/Math.max(.1,scale)),font=11*unit,width=128*unit,height=19*unit;
 const center=g.center/256,bottom=g.plane/256-g.height/256-5*unit;
 return {text:'CURRENT STANDARD',center,left:center-width/2,right:center+width/2,top:bottom-height,bottom,width,height,font,baseline:bottom-5*unit};
}
export function drawGoalposts(c,s,{scale=1,numerator=1,denominator=1}={}){
 if(!s.goalposts)return;
 for(const end of [0,s.h]){
  const g=goalGeometry(s,end,numerator,denominator),l=g.left/256,r=g.right/256,y=end/256,h=g.height/256,depth=end===0?-22:22;
  c.fillStyle='#b9eee426';c.strokeStyle='#a7e5dc88';c.lineWidth=1;
  c.beginPath();c.moveTo(l,y);c.lineTo(l,y-h);c.lineTo(r,y-h);c.lineTo(r,y);c.closePath();c.fill();
  for(let x=l;x<=r;x+=10){c.beginPath();c.moveTo(x,y);c.lineTo(x,y-h);c.lineTo(x,y-h+depth);c.stroke();}
  for(let z=0;z<=h;z+=8){c.beginPath();c.moveTo(l,y-z);c.lineTo(r,y-z);c.stroke();}
  c.strokeStyle=end===0?'#ffe074':'#f4f1df';c.lineWidth=4;
  c.beginPath();c.moveTo(l,y);c.lineTo(l,y-h);c.lineTo(r,y-h);c.lineTo(r,y);c.stroke();
  c.lineWidth=2;c.strokeStyle='#f4ce6577';c.beginPath();c.moveTo(l,y);c.lineTo(r,y);c.stroke();
  if(end===0){
   const sign=standardSign(g,scale);c.fillStyle='#162b25f5';c.fillRect(sign.left,sign.top,sign.width,sign.height);
   c.strokeStyle='#efd390';c.lineWidth=1/Math.max(.1,scale);c.strokeRect(sign.left,sign.top,sign.width,sign.height);
   c.beginPath();c.moveTo(sign.center,sign.bottom);c.lineTo(sign.center,y-h-2);c.stroke();
   c.fillStyle='#ffe7aa';c.font=`bold ${sign.font}px monospace`;c.textAlign='center';c.fillText(sign.text,sign.center,sign.baseline);
  }
 }
}

// Adapted source: render/canvas.mjs
const lerp=(a,b,t)=>a+(b-a)*t;
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.retro=false;this.palette='classic';this.zoom='follow';this.effects='balanced';this.pixelated=false;
    this.motionQuery=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.layer=null;this.layerKey='';this.order=[];this.trail=Array.from({length:8},()=>({x:0,y:0,z:0}));this.reset();
  }
  reset(){this.camera=null;this.lastTick=-1;this.trailCount=0;}
  ground(s){
    const key=[s.w,s.h,s.config.indoor,s.config.weather,!!s.goalposts,this.palette].join(':');
    if(key!==this.layerKey){
      const layer=document.createElement('canvas');layer.width=s.w/Q+360;layer.height=s.h/Q+360;
      const c=layer.getContext('2d');c.translate(180,180);drawStadium(c,s,this.palette);
      this.layer=layer;this.layerKey=key;
    }
    this.ctx.drawImage(this.layer,-180,-180);
  }
  draw(s,previous=s,alpha=1,demo=false,dt=1/60){
    const canvas=this.canvas,c=this.ctx,w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    const ratio=this.pixelated?.65:Math.min(globalThis.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    canvas.style.imageRendering=this.pixelated?'pixelated':'auto';c.setTransform(ratio,0,0,ratio,0,0);c.imageSmoothingEnabled=false;
    const reduced=!!this.motionQuery?.matches||this.effects==='minimal',effects=this.effects!=='minimal';
    if(s.tick<this.lastTick)this.reset();
    this.camera=cameraFrame(s,w,h,{zoom:this.zoom,reduced,demo},this.camera,dt);
    const view=this.camera;
    c.fillStyle='#0f2330';c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(view.scale,view.scale);c.translate(-view.x,-view.y);
    this.ground(s);if(s.training?.drill==='move'){const t=s.training.target;c.strokeStyle='#ffdc68';c.lineWidth=3;c.beginPath();c.ellipse(t.x/Q,t.y/Q,35,22,0,0,Math.PI*2);c.stroke();c.font='bold 12px monospace';c.textAlign='center';c.fillStyle='#fff3bf';c.fillText('DRIBBLE HERE',t.x/Q,t.y/Q-30);}drawStadiumMotion(c,s,reduced,effects);
    if(s.goalposts){
      const interpolateGoal=previous.goalposts?.stage===s.goalposts.stage&&s.phase==='play'&&previous.goalposts.clock===s.goalposts.previousClock&&s.goalposts.clock>previous.goalposts.clock;
      drawGoalposts(c,s,{scale:view.scale,numerator:interpolateGoal?Math.round(Math.max(0,Math.min(1,alpha))*65536):1,denominator:interpolateGoal?65536:1});
    }
    if(this.order.length!==s.players.length)this.order=s.players.map(p=>p.id);
    this.order.sort((a,b)=>s.players[a].y-s.players[b].y||a-b);
    for(const id of this.order){
      const p=s.players[id],old=previous.players[id]||p;
      const x=lerp(old.x,p.x,alpha)/Q,y=lerp(old.y,p.y,alpha)/Q;
      drawPlayer(c,s,p,old,x,y,{demo,reduced,effects});
    }
    this.ball(s,previous,alpha,effects&&!reduced);
    c.restore();
    if(s.config.weather==='rain'&&!s.config.indoor&&effects){
      c.strokeStyle='#c5edf244';c.lineWidth=1;
      for(let i=0;i<65;i++){const x=(i*139+(reduced?0:s.tick*3))%w,y=(i*199+(reduced?0:s.tick*8))%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+10);c.stroke();}
    }
    if(!demo)this.minimap(s,w,h);
    if(this.retro){c.fillStyle='#05111921';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);}
    this.lastTick=s.tick;
  }
  ball(s,previous,alpha,streaks){
    const c=this.ctx,b=s.ball,old=previous.ball;
    const x=lerp(old.x,b.x,alpha)/Q,y=lerp(old.y,b.y,alpha)/Q,z=lerp(old.z,b.z,alpha)/Q;
    if(s.tick!==this.lastTick){
      for(let i=this.trail.length-1;i>0;i--)Object.assign(this.trail[i],this.trail[i-1]);
      Object.assign(this.trail[0],{x,y,z});this.trailCount=Math.min(this.trail.length,this.trailCount+1);
    }
    const speed=Math.hypot(b.vx,b.vy)/Q;
    if(streaks&&speed>6){
      for(let i=this.trailCount-1;i>0;i--){const a=this.trail[i],v=this.trail[i-1];c.strokeStyle=`rgba(255,243,183,${.32*(1-i/this.trail.length)})`;c.lineWidth=4*(1-i/this.trail.length)+1;c.beginPath();c.moveTo(a.x,a.y-a.z);c.lineTo(v.x,v.y-v.z);c.stroke();}
    }
    c.fillStyle=`rgba(7,24,30,${Math.max(.16,.4-z/300)})`;c.beginPath();c.ellipse(x+4+z*.05,y+4,6+z/24,3+z/60,0,0,Math.PI*2);c.fill();
    if(z>12){c.strokeStyle='#e5f5d665';c.lineWidth=1;c.beginPath();c.ellipse(x,y+1,7,3,0,0,Math.PI*2);c.stroke();}
    c.save();c.translate(x,y-z-3);c.rotate(s.tick*.09*(Math.sign(b.vx)||1)+speed*.1);
    const shine=c.createRadialGradient(-2,-2,1,0,0,6);shine.addColorStop(0,'#ffffff');shine.addColorStop(.65,'#f2f1de');shine.addColorStop(1,'#91a6ac');
    c.fillStyle=shine;c.strokeStyle='#122e38';c.lineWidth=1.3;c.beginPath();c.arc(0,0,5.6,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#203744';c.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;const px=Math.cos(a)*2.2,py=Math.sin(a)*2.2;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.fill();
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;c.fillRect(Math.cos(a)*4-1,Math.sin(a)*4-1,2,2);}c.restore();
    if(b.immunity>9&&streaks){c.strokeStyle='#fff2c780';c.lineWidth=1;c.beginPath();c.arc(x,y-z-3,8+(14-b.immunity)*1.2,0,Math.PI*2);c.stroke();}
  }
  minimap(s,w,h){
    const c=this.ctx,mw=w<500?60:78,mh=mw*s.h/s.w,x=w-mw-18,y=h-mh-18;
    c.fillStyle='#0b202be8';c.fillRect(x-7,y-20,mw+14,mh+27);c.strokeStyle='#b9d4c966';c.lineWidth=1;c.strokeRect(x,y,mw,mh);
    c.beginPath();c.moveTo(x,y+mh/2);c.lineTo(x+mw,y+mh/2);c.stroke();
    const view=this.camera;c.save();c.beginPath();c.rect(x,y,mw,mh);c.clip();c.strokeStyle='#c3e4df33';c.strokeRect(x+(view.x-view.vw/2)/ (s.w/Q)*mw,y+(view.y-view.vh/2)/(s.h/Q)*mh,view.vw/(s.w/Q)*mw,view.vh/(s.h/Q)*mh);c.restore();
    for(const p of s.players){c.fillStyle=s.clubs[p.team].color;const px=x+p.x/s.w*mw,py=y+p.y/s.h*mh;c.fillRect(px-1,py-1,3,3);if(s.config.humans[p.team]&&s.selected[p.team]===p.id){c.strokeStyle=c.fillStyle;c.beginPath();c.arc(px,py,3.5,0,Math.PI*2);c.stroke();}}
    c.fillStyle='#fff8d8';c.beginPath();c.arc(x+s.ball.x/s.w*mw,y+s.ball.y/s.h*mh,2.5,0,Math.PI*2);c.fill();
    c.font='bold 9px monospace';c.textAlign='center';c.fillStyle='#d7e2d7';c.fillText(attack(s,0)<0?'HOME ↑ ATTACK':'HOME ↓ ATTACK',x+mw/2,y-7);
  }
}
