/* SPDX-License-Identifier: Apache-2.0 */
import {SubHunt} from './sim.js';
  const { WIDTH: W, HEIGHT: H, SURFACE, FLOOR } = SubHunt;
  const C = {ink:'#173d40', paper:'#f5efda', orange:'#ff7751', mint:'#bbdfce', yellow:'#f6ca57'};
  function renderer(canvas) {
    const c = canvas.getContext('2d');
    const particles = [], rings = [];
    let previous = null, shake = 0, recoil = 0;
    function path(points, fill, stroke, line = 2) {
      c.beginPath(); points.forEach((p,i)=>i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
      if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
    }
    function ellipse(x,y,rx,ry,fill,stroke) {c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
    function line(x,y,x2,y2,color,width=2){c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
    function text(str,x,y,size=10,color=C.ink,align='left'){c.fillStyle=color;c.font=`bold ${size}px "Courier New",monospace`;c.textAlign=align;c.fillText(str,x,y);}
    function boat(x,y,enemy=false,dir=1,t=0) {
      c.save();c.translate(x,y+Math.sin(t*2+x)*2);c.scale(dir,1);
      ellipse(0,17,49,6,'#254d4930');
      path([[-44,-3],[46,-3],[31,18],[-31,18]],enemy?'#e7d6a4':C.orange,C.ink,2);
      path([[-29,-3],[-23,-24],[9,-24],[20,-3]],C.paper,C.ink);
      c.fillStyle=C.ink;c.fillRect(-17,-19,12,10);c.fillRect(1,-19,8,10);
      line(4,-25,4,-51,C.ink,3);path([[6,-49],[28,-42],[6,-36]],enemy?C.orange:C.mint,C.ink,1.5);
      line(-43,4,37,4,C.paper,3);ellipse(22,6,4,4,C.ink);ellipse(-24,6,4,4,C.ink);
      c.restore();
    }
    function sub(x,y,enemy=false,dir=1,t=0,alpha=1) {
      c.save();c.globalAlpha*=alpha;c.translate(x,y);c.scale(dir,1);
      ellipse(0,27,43,5,'#17484017');
      path([[-35,-8],[-49,-17],[-49,17],[-35,8]],enemy?C.orange:C.mint,C.ink);
      ellipse(0,0,39,17,enemy?C.ink:C.yellow,C.ink);
      path([[-12,-14],[-12,-26],[9,-26],[16,-13]],enemy?C.orange:C.paper,C.ink);
      line(0,-26,0,-39,C.ink,4);line(-1,-39,10,-39,C.ink,4);
      for(let i=-15;i<=21;i+=18)ellipse(i,0,5,5,enemy?'#a1cec2':'#2b716c',C.ink);
      line(-43,-8,-43,8,C.paper,2);
      c.save();c.translate(-45,0);c.rotate(t*11);line(0,-9,0,9,C.ink,3);c.restore();
      c.restore();
    }
    function duck(x,y,scale=1,t=0) {
      c.save();c.translate(x,y+Math.sin(t*1.8+x)*3);c.scale(scale,scale);
      ellipse(-2,9,27,6,'#23565022');ellipse(0,-5,25,15,C.yellow,C.ink);
      path([[-18,-11],[-33,-20],[-25,-1]],C.yellow,C.ink);ellipse(15,-23,13,15,C.yellow,C.ink);
      path([[25,-23],[40,-17],[25,-14]],C.orange,C.ink,1.5);ellipse(19,-27,2,2,C.ink);
      c.beginPath();c.arc(-4,-9,12,.3,2.5);c.strokeStyle='#c69838';c.lineWidth=2;c.stroke();c.restore();
    }
    function livingToy(target,t) {
      const dir=target.vx<0?-1:1;
      c.save();c.translate(target.x,target.y);c.scale(dir,1);
      if(target.kind==='duck') {
        duck(0,0,.85,t);
        // Deterministic position, decorative paddling, and a wake distinguish living ducks.
        line(-20,10,-39,10,'#f4f2ca',2);line(-15,15,-31,15,'#f4f2ca',1);
        line(3,10,9+Math.sin(t*9)*5,15,C.orange,3);
        ellipse(17,-23,4,4,C.paper);ellipse(19,-23,2,2,C.ink);
      } else {
        const tail=Math.sin(t*8+target.id)*5;
        path([[-17,0],[-36,-14+tail],[-32,14+tail]],'#ef9270',C.ink);
        ellipse(0,0,27,14,target.id%2?'#ef9270':'#c6db79',C.ink);
        path([[-7,-11],[2,-22],[12,-11]],'#f5c984',C.ink);
        path([[-5,2],[7,8],[-2,11]],'#f5c984',C.ink,1);
        ellipse(15,-4,6,6,C.paper,C.ink);ellipse(17,-3,2.5,2.5,C.ink);
        line(21,5,26,4,C.ink,1);line(-8,-6,-10,6,'#173d4060',2);
        ellipse(35+Math.sin(t*2)*4,-4,2,2,null,'#eaffdf90');
      }
      c.restore();
    }
    function background(s,t) {
      c.fillStyle='#dce6d7';c.fillRect(0,0,W,H);
      // Bathroom tiles and grout, above the porcelain rim.
      for(let x=0;x<W;x+=100)for(let y=0;y<125;y+=62){c.strokeStyle='#afc9bb';c.lineWidth=1;c.strokeRect(x+3,y+3,94,56);}
      c.fillStyle='#a8c0af';c.fillRect(0,109,W,23);
      // A vast tap, soap dish and bath rim establish the miniature scale.
      c.save();c.strokeStyle='#527b75';c.lineWidth=19;c.lineCap='round';c.beginPath();c.moveTo(861,112);c.lineTo(861,70);c.quadraticCurveTo(861,43,830,43);c.lineTo(801,43);c.stroke();c.strokeStyle='#cce0d2';c.lineWidth=11;c.stroke();c.restore();
      ellipse(904,107,27,7,'#486d65');c.fillStyle='#74938a';c.fillRect(897,80,14,27);line(880,82,925,82,'#e6ebdb',8);
      c.fillStyle='#f7f2de';c.fillRect(76,97,135,13);c.fillStyle='#f4a389';c.beginPath();c.roundRect(96,68,95,30,12);c.fill();text('SOAP',144,88,10,'#b9624b','center');
      c.fillStyle=C.paper;c.fillRect(0,116,W,23);line(0,117,W,117,'#fff9e9',4);
      const g=c.createLinearGradient(0,SURFACE,0,FLOOR);g.addColorStop(0,'#a7dcca');g.addColorStop(.35,s.mission===1?'#70b6bd':s.mission===2?'#67aca6':'#70bbae');g.addColorStop(1,'#367d78');c.fillStyle=g;c.fillRect(22,SURFACE,956,FLOOR-SURFACE+8);
      // Underwater light shafts and depth lines.
      for(let i=0;i<7;i++){const x=55+i*160+Math.sin(t*.3+i)*18;path([[x,SURFACE],[x+48,SURFACE],[x-70,FLOOR],[x-150,FLOOR]],'#eaffdf09');}
      for(let i=0;i<12;i++){const x=80+(i*137)%850,y=190+(i*73)%280;c.beginPath();c.ellipse(x+Math.sin(t*.7+i)*9,y,28+i%4*9,5,Math.sin(i),0,Math.PI*1.4);c.strokeStyle='#e0f5d612';c.lineWidth=2;c.stroke();}
      for(let y=210;y<FLOOR;y+=76){line(40,y,958,y,'#cee9d71b',1);text(String(Math.round((y-SURFACE)/7)).padStart(2,'0')+' CM',46,y-7,8,'#d4ebd05c');}
      // Porcelain cross-section with round inner corners.
      c.beginPath();c.moveTo(8,132);c.lineTo(8,447);c.quadraticCurveTo(8,548,116,548);c.lineTo(884,548);c.quadraticCurveTo(992,548,992,447);c.lineTo(992,132);c.strokeStyle='#e8ebd9';c.lineWidth=30;c.stroke();
      c.beginPath();c.moveTo(27,142);c.lineTo(27,440);c.quadraticCurveTo(27,516,115,516);c.lineTo(885,516);c.quadraticCurveTo(973,516,973,440);c.lineTo(973,142);c.strokeStyle='#c2d7c4';c.lineWidth=7;c.stroke();
      c.fillStyle='#c9d0bb';c.fillRect(0,564,W,16);line(0,565,W,565,'#fff8e7',2);
      // Drain and chain.
      ellipse(875,509,38,9,'#254e4b');ellipse(875,507,32,6,'#8daf9f');for(let i=-2;i<=2;i++)line(875+i*9,503,875+i*9,511,'#365b55',3);
      c.save();c.strokeStyle='#bbd0b6';c.lineWidth=2;for(let i=0;i<20;i++){const y=160+i*16,x=942-Math.sin(i/19*Math.PI)*29;c.beginPath();c.ellipse(x,y,3,7,-.3,0,Math.PI*2);c.stroke();}c.restore();
      ellipse(937,152,14,5,'#31534e');
      // Sponge reef, a forgotten toy star and rising bubbles.
      c.save();c.translate(174,495);c.rotate(-.09);c.fillStyle='#e5c16c';c.beginPath();c.roundRect(-56,-15,112,32,10);c.fill();for(let i=0;i<11;i++)ellipse(-43+(i*31)%89,-7+(i*13)%21,3,2,'#b08d43');c.restore();
      path([[372,489],[379,505],[398,506],[385,518],[388,536],[372,526],[356,536],[359,518],[346,506],[365,505]],'#ef9270','#c2775e',1);
      for(let i=0;i<30;i++){let x=65+(i*173)%875+Math.sin(t+i)*4,y=FLOOR-((t*(11+i%7)+i*47)%(FLOOR-SURFACE));ellipse(x,y,2+i%3,3+i%3,null,'#d4f3da38');}
      if(s.mission===2){for(let i=0;i<5;i++){c.beginPath();c.ellipse(870,460-i*17,15+i*14,4+i*2,t+i,0,Math.PI*1.4);c.strokeStyle='#cbe6c75a';c.lineWidth=2;c.stroke();}text('DRAIN CURRENT',868,552,8,C.ink,'center');}
      // Surface is drawn over the rim to keep vessels grounded.
      c.beginPath();for(let x=22;x<980;x+=5){const y=SURFACE+Math.sin(x*.035+t*2)*2+(Math.sin(x*.015-t)*1.5);x===22?c.moveTo(x,y):c.lineTo(x,y);}c.strokeStyle='#e4f4d5';c.lineWidth=3;c.stroke();
      for(let i=0;i<18;i++){const x=48+(i*53)%900;if(i%3===0||s.mission===1){ellipse(x,SURFACE-2+Math.sin(t+i),9+i%3*3,3,'#e8f3d770');ellipse(x+8,SURFACE-6,4,4,'#f4fae3a0');}}
    }
    function ingest(events, {effects=true}={}) {
      for(const e of events) {
        if(e.type==='damage'&&effects)shake=.28;
        if(e.type==='fire'&&effects)recoil=.16;
        if(effects&&['sink','hit','damage','splash','duck','toy','rivalToy'].includes(e.type))rings.push({x:e.x,y:e.y,age:0,kind:e.type});
        if(effects&&['sink','hit','damage','splash','duck','toy','rivalToy','fire','enemyFire'].includes(e.type)){
          const n=e.type==='sink'?24:e.type==='damage'?18:7;
          for(let i=0;i<n;i++) particles.push({x:e.x,y:e.y,vx:Math.cos(i*2.4)* (18+i*3),vy:Math.sin(i*2.4)*38-18,life:1,kind:e.type});
        }
        if(e.text&&['sink','duck','damage','pickup','block','toy','rivalToy'].includes(e.type))particles.push({x:e.x,y:e.y-22,vx:0,vy:-20,life:1.6,text:e.text});
      }
      if(particles.length>320)particles.splice(0,particles.length-320);
    }
    function draw(s,t,dt=0,{effects=true}={}) {
      const artTime=effects?t:0, p=s.player;
      shake=Math.max(0,shake-dt);recoil=Math.max(0,recoil-dt);
      c.clearRect(0,0,W,H);c.fillStyle=C.paper;c.fillRect(0,0,W,H);c.save();
      if(effects&&shake>0)c.translate(Math.sin(t*90)*shake*12,Math.cos(t*75)*shake*7);
      background(s,artTime);
      for(const item of s.pickups) {
        const spec=SubHunt.POWERUPS[item.kind], y=item.y+(effects?Math.sin(artTime*3+item.id)*3:0);
        c.save();
        ellipse(item.x,y,24,24,'#173d40',spec.color,2);
        text(spec.glyph,item.x,y+6,22,spec.color,'center');
        text(spec.label,item.x,y-34,9,C.ink,'center');
        c.beginPath();c.arc(item.x,y,29,-Math.PI/2,-Math.PI/2+Math.PI*2*item.remaining/720);c.strokeStyle=spec.color;c.lineWidth=3;c.stroke();
        c.restore();
      }
      if(previous&&previous.mission===s.mission&&s.tick>previous.tick&&dt>0&&effects&&Math.hypot(p.x-previous.x,p.y-previous.y)>.5){
        particles.push({x:p.x-p.facing*43,y:p.y+(s.role==='boat'?7:2),vx:-p.facing*25,vy:s.role==='boat'?0:-10,life:.7,kind:s.role==='boat'?'wake':'bubble'});
      }
      previous={x:p.x,y:p.y,tick:s.tick,mission:s.mission};
      for(const e of s.enemies){
        const alpha=s.role==='boat'?(e.reveal>0?1:.14):1;
        if(s.role==='boat')sub(e.x,e.y,true,e.vx>0?1:-1,artTime,alpha);else boat(e.x,e.y,true,e.vx>0?1:-1,artTime);
        if(e.reveal>0){line(e.x-43,e.y-49,e.x-35,e.y-49,'#e1efc3',1);line(e.x+35,e.y-49,e.x+43,e.y-49,'#e1efc3',1);text(e.maxHp===2?(e.hp===2?'ARMOUR ●●':'ARMOUR ●○'):'CONTACT',e.x,e.y+40,8,'#e7f3d4','center');}
        if(e.flash>0)ellipse(e.x,e.y,43,26,effects?'#fff8d199':null,effects?null:C.paper);
        if(e.warned&&e.cooldown>0&&e.cooldown<=.75){
          c.save();c.setLineDash([4,7]);line(e.x,s.role==='boat'?e.y-30:SURFACE+24,e.x,s.role==='boat'?SURFACE+20:FLOOR-12,'#fcaa7970',2);c.restore();
          ellipse(e.x,e.y-62,11,11,C.orange,C.ink);text('!',e.x,e.y-57,15,C.ink,'center');
          line(e.x-28,e.y+25,e.x+28,e.y+25,C.orange,3);
        }
      }
      c.save();if(effects&&p.invincible>0&&Math.floor(t*12)%2)c.globalAlpha=.6;
      const kick=effects?Math.sin(recoil/.16*Math.PI)*3:0;
      if(s.role==='boat')boat(p.x,p.y-kick,false,p.facing,artTime);else sub(p.x,p.y+kick,false,p.facing,artTime);
      c.restore();text('YOU',p.x,p.y+(s.role==='boat'?-64:43),9,C.paper,'center');
      if(p.invincible>0)ellipse(p.x,p.y,49,27,null,'#e5f6cba0');
      if(p.powers.shield>0) {ellipse(p.x,p.y,55,34,null,'#b8f4ef');ellipse(p.x,p.y,59,38,null,'#b8f4ef70');}
      for(const q of s.projectiles){
        const color=q.friendly?C.paper:C.orange;
        if(q.down){c.fillStyle=color;c.fillRect(q.x-5,q.y-7,10,14);line(q.x-7,q.y-6,q.x+7,q.y-6,C.ink,2);}
        else{ellipse(q.x,q.y,4,10,color,C.ink);line(q.x,q.y+13,q.x,q.y+26,color,2);}
        ellipse(q.x+Math.sin(artTime*15)*3,q.y+(q.down?-18:23),2,3,null,'#d5eec8a0');
      }
      s.ducks.forEach(d=>duck(d.x,d.y,d.r/25,artTime));
      s.targets.forEach(target=>livingToy(target,artTime));
      if(s.pulse){c.beginPath();c.arc(s.pulse.x,s.pulse.y,s.pulse.age*290,0,Math.PI*2);c.strokeStyle=`rgba(231,255,202,${1-s.pulse.age/1.2})`;c.lineWidth=3;c.stroke();}
      for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.age+=dt;if(r.age>.6){rings.splice(i,1);continue;}c.save();c.globalAlpha=1-r.age/.6;ellipse(r.x,r.y,10+r.age*65,6+r.age*38,null,r.kind==='sink'||r.kind==='damage'?C.orange:C.paper);c.restore();}
      for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.life-=dt;if(effects){p.x+=p.vx*dt;p.y+=p.vy*dt;}if(p.life<=0){particles.splice(i,1);continue;}c.save();c.globalAlpha=Math.min(1,p.life);if(p.text)text(p.text,p.x,p.y,12,C.paper,'center');else if(p.kind==='wake')ellipse(p.x,p.y,13,2,null,C.paper);else ellipse(p.x,p.y,3,3,p.kind==='damage'||p.kind==='sink'?C.orange:null,C.paper);c.restore();}
      c.restore();
      // Dedicated sonar instrument, deliberately part of the playfield.
      const rx=88,ry=426,rr=43;
      ellipse(rx,ry,rr+7,rr+7,'#173d40b8','#80b6a0');
      for(let r=14;r<=rr;r+=14)ellipse(rx,ry,r,r,null,'#90c9a83f');line(rx-rr,ry,rx+rr,ry,'#90c9a83f',1);line(rx,ry-rr,rx,ry+rr,'#90c9a83f',1);
      line(rx,ry,rx+Math.cos(artTime*1.5)*rr,ry+Math.sin(artTime*1.5)*rr,'#c1e9a6',1.5);
      for(const e of s.enemies){if(e.reveal>0||s.role==='sub')ellipse(rx+(e.x-500)/500*34,ry+(e.y-320)/220*33,2.5,2.5,C.orange);}
      text('SONAR',rx,ry+65,9,C.paper,'center');
      text(p.sonar>0?Math.ceil(p.sonar)+'s TO PING':'[ E ] PING READY',rx,ry+79,8,p.sonar>0?'#b0d3bc':C.paper,'center');
      text('CONTACTS  '+s.enemies.length,944,476,10,C.paper,'right');
      const progress=1-p.sonar/7;line(803,489,944,489,'#194e4d',4);line(803,489,803+141*progress,489,C.mint,4);
    }
    return {draw,ingest,reset:()=>{particles.length=0;rings.length=0;previous=null;shake=0;recoil=0;}};
  }
export const SubHuntRenderer=renderer;
