// SPDX-License-Identifier: Apache-2.0
import {Renderer,boxVertices} from '../../modules/render-webgl/index.js';
import {rotate,quatMultiply} from '../../modules/math/index.js';
import {RANGE_SOLIDS} from './world.js';
const colors=[[.3,.91,.84],[1,.64,.25],[.78,.58,1]];
export class FeelView{
  constructor(canvas){
    this.renderer=new Renderer(canvas);const data=[];
    for(const s of RANGE_SOLIDS){const center=s.box.min.map((v,i)=>(v+s.box.max[i])/2),size=s.box.min.map((v,i)=>s.box.max[i]-v);boxVertices(center,size,s.id==='floor'?[.12,.18,.21]:[.16,.25,.29],data);}
    for(let z=4;z>-24;z-=2){boxVertices([0,.008,z],[.07,.015,.9],[.4,.65,.66],data);for(const x of [-7.5,7.5])boxVertices([x,.025,z],[.08,.05,1.4],[.2,.8,.7],data);}
    for(const x of [-8.55,8.55])for(let z=0;z>-24;z-=6){boxVertices([x,2.8,z],[.1,.15,3],[.45,.88,.91],data);boxVertices([x,1.3,z-2],[.16,2.6,.18],[.25,.38,.4],data);}
    for(const x of [-5,0,5]){boxVertices([x,2,-24.4],[.08,4,.08],[.4,.6,.65],data);boxVertices([x,3.9,-24.4],[3,.1,.08],[.8,.68,.32],data);}
    this.staticMesh=this.renderer.mesh(data);this.dynamic=this.renderer.mesh([]);this.lines=this.renderer.mesh([],'lines');this.stats={staticUploads:1,frames:0};
  }
  draw(world){
    const body=[],lines=[],r=this.renderer,s=world.combat.snapshot(),pose=world.feel.aim(),p=world.feel.presentation(),origin=world.origin();
    for(const [i,a]of s.actors.filter(a=>a.id!=='player').entries()){
      if(a.health<=0)continue;const c=colors[i],x=a.position[0],z=a.position[2];
      boxVertices([x,.65,z],[.75,1.3,.32],c,body);boxVertices([x,1.6,z],[.48,.4,.48],c,body);
      boxVertices([x,1.62,z+.25],[.3,.09,.035],[.03,.08,.12],body);
      boxVertices([x,.95,z+.18],[.25,.25,.04],[.98,.97,.8],body);
      boxVertices([x,.045,z],[1.2,.09,1.2],[.2,.3,.35],body);
      boxVertices([x,2.08,z],[1,.05,.06],[.1,.13,.16],body);boxVertices([x-(1-a.health/a.maxHealth)/2,2.08,z+.03],[a.health/a.maxHealth,.07,.06],c,body);
    }
    for(const shot of s.projectiles)boxVertices(shot.position,[.12,.12,.3],colors[2],body);
    if(world.feel.profile().view.effects)for(const e of world.effects){if(e.type==='trace')lines.push(...e.from,1,.85,.42,...e.to,1,.85,.42);else boxVertices(e.point,[.1,.1,.1],[1,.92,.62],body);}
    const weapon=[],c=colors[p.selected],x=.27*(1-p.ads),y=-.27-.18*(world.timer().reloadRemaining>0?Math.sin(Math.min(1,world.timer().reloadRemaining)*Math.PI):0)-Math.min(.18,p.switchRemaining),z=-.62+p.recoil;
    // Original three weapon silhouettes; recoil rotates this local model only.
    const q=quatMultiply(pose.orientation,[Math.sin(p.recoil/2),0,0,Math.cos(p.recoil/2)]);
    if(p.selected===0){boxVertices([x,y,z],[.18,.15,.68],c,weapon);boxVertices([x,y+.11,z-.11],[.065,.06,.22],[.9,.92,.75],weapon);}
    if(p.selected===1){boxVertices([x,y,z],[.24,.19,.43],c,weapon);boxVertices([x,y-.15,z+.05],[.13,.22,.16],[.13,.18,.23],weapon);for(const side of [-1,1])boxVertices([x+side*.09,y,z-.34],[.055,.07,.3],[.42,.5,.55],weapon);}
    if(p.selected===2){boxVertices([x,y,z],[.32,.25,.52],c,weapon);boxVertices([x,y,z-.31],[.22,.2,.15],[.08,.12,.17],weapon);boxVertices([x,y+.17,z],[.1,.06,.24],[.8,.85,.95],weapon);}
    boxVertices([x,y-.15,z+.18],[.13,.23,.17],[.12,.18,.23],weapon);
    if(p.flash>0)boxVertices([x,y,z-.49],[.12+p.flash,.12+p.flash,.17],[1,.91,.5],weapon);
    for(let i=0;i<weapon.length;i+=6){const v=rotate(q,weapon.slice(i,i+3));body.push(...v.map((n,k)=>n+origin[k]),...weapon.slice(i+3,i+6));}
    r.update(this.dynamic,body);r.update(this.lines,lines);r.begin(origin,pose.orientation,{fog:.017,fov:p.fov});r.draw(this.staticMesh);r.draw(this.dynamic);r.draw(this.lines);this.stats.frames++;
  }
  dispose(){this.renderer.dispose();}
}
