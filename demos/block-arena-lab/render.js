// SPDX-License-Identifier: Apache-2.0
import {Renderer,boxVertices} from '../../modules/render-webgl/index.js';
import {boxMeshBatch} from '../../modules/geometry/index.js';
import {characterView} from '../../modules/character/index.js';
import {rotate} from '../../modules/math/index.js';
export function arenaVisuals(pack){
  const boxes=pack.solids.map(s=>({center:s.center,size:s.size,color:s.color})),half=pack.settings.size/2;
  // Original tiled floor, boundary lamps and cover stripes, retained with solids.
  for(let x=-half;x<half;x+=2)for(let z=-half;z<half;z+=2)if((x+z)%4===0)boxes.push({center:[x+1,.006,z+1],size:[1.95,.01,1.95],color:pack.settings.palette.floor.map(v=>v*1.18)});
  for(let x=-half+2;x<half;x+=4)for(const z of [-half+.02,half-.02])boxes.push({center:[x,2.7,z],size:[1.5,.15,.06],color:pack.settings.palette.accent});
  for(const s of pack.solids.filter(s=>s.id.startsWith('block-')))boxes.push({center:[s.center[0],s.box.max[1]+.015,s.center[2]],size:[s.size[0],.03,s.size[2]],color:pack.settings.palette.accent});
  return boxes;
}
export class ArenaView {
  constructor(canvas){this.renderer=new Renderer(canvas);this.renderer.gl.clearColor(.055,.10,.18,1);this.pack=null;this.effects=[];this.stats={staticUploads:0,frames:0,drawCalls:0,staticBoxes:0};}
  feedback(events,tick){for(const e of events)if(['impact','explosion','trace'].includes(e.type))this.effects.push({...e,until:tick+(e.type==='explosion'?18:8)});this.effects=this.effects.slice(-64);}
  draw(world){
    const r=this.renderer;if(this.pack!==world.pack){this.pack=world.pack;this.effects=[];r.clearMeshes();const boxes=arenaVisuals(world.pack);this.staticMesh=r.mesh(boxMeshBatch(boxes));this.dynamic=r.mesh([]);this.lines=r.mesh([],'lines');this.stats.staticUploads++;this.stats.staticBoxes=boxes.length;}
    const body=[],lines=[],snapshot=world.combat.snapshot();
    for(const b of world.bots){const actor=snapshot.actors.find(a=>a.id===b.id);if(!actor.health)continue;const p=b.character.position,c=b.profile.color;
      boxVertices([p[0],p[1]+.95,p[2]],[.62,.9,.42],c,body);boxVertices([p[0],p[1]+1.6,p[2]],[.48,.4,.48],c.map(v=>Math.min(1,v*1.2)),body);
      for(const side of [-1,1]){boxVertices([p[0]+side*.19,p[1]+.25,p[2]],[.24,.5,.3],[.14,.2,.3],body);boxVertices([p[0]+side*.43,p[1]+1.05,p[2]],[.2,.6,.24],c,body);}
      const front=rotate([0,Math.sin(b.character.yaw/2),0,Math.cos(b.character.yaw/2)],[0,0,-.27]);
      boxVertices([p[0]+front[0],p[1]+1.62,p[2]+front[2]],[.32,.09,.12],[.3,1,1],body);
    }
    for(const p of world.pickups)if(p.available){const at=[p.position[0],p.position[1]+.35,p.position[2]],c=p.kind==='health'?[.3,1,.65]:[1,.75,.2];boxVertices(at,[.6,.6,.6],c,body);boxVertices([at[0],at[1]+.32,at[2]],[.2,.05,.5],[.95,1,1],body);}
    for(const p of snapshot.projectiles)boxVertices(p.position,[.18,.18,.18],[1,.65,.2],body);
    this.effects=this.effects.filter(e=>world.tick<e.until);
    for(const e of this.effects){if(e.type==='trace')lines.push(...e.from,1,.85,.3,...e.to,1,.85,.3);else{const size=e.type==='explosion'?.3+(e.until-world.tick)/18*1.2:.12;boxVertices(e.point,[size,size,size],e.type==='explosion'?[1,.45,.08]:[1,1,.8],body);}}
    const view=characterView(world.player);
    if(snapshot.actors.find(a=>a.id==='player').health>0&&!world.scope){
      const gun=[],c=world.pack.settings.palette.accent;boxVertices([.28,-.24,-.65],[.2,.2,.65],c,gun);boxVertices([.28,-.38,-.45],[.13,.2,.18],[.12,.17,.24],gun);boxVertices([.28,-.12,-.8],[.07,.06,.18],[.95,.85,.3],gun);
      for(let i=0;i<gun.length;i+=6){const p=rotate(view.orientation,gun.slice(i,i+3));body.push(...p.map((v,k)=>v+view.position[k]),...gun.slice(i+3,i+6));}
    }
    r.update(this.dynamic,body);r.update(this.lines,lines);r.begin(view.position,view.orientation,{fog:.012,fov:world.scope?.5:Math.PI/2.6});r.draw(this.staticMesh);r.draw(this.dynamic);r.draw(this.lines);this.stats.frames++;this.stats.drawCalls+=3;
  }
}
