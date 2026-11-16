// SPDX-License-Identifier: Apache-2.0
import {LitRenderer} from '../../modules/render-lit/index.js';
import {buildVehicleVisual,vehicleDraws} from '../../modules/scenic3d/index.js';
import {rotate,quatMultiply} from '../../modules/math/index.js';
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const add=(a,b,s=1)=>a.map((x,i)=>x+b[i]*s);
const center=values=>{const c=[0,0,0],n=values.length/11;for(let i=0;i<values.length;i+=11)for(let j=0;j<3;j++)c[j]+=values[i+j]/n;return c;};
export function raceMatrix(position,q,scale=[1,1,1]){const x=rotate(q,[scale[0],0,0]),y=rotate(q,[0,scale[1],0]),z=rotate(q,[0,0,scale[2]]);return new Float32Array([...x,0,...y,0,...z,0,...position,1]);}
export function raceCamera(state,settings,mode=settings.mode){
  const f=rotate(state.orientation,[0,0,-1]),n=Math.hypot(f[0],f[2]),flat=n>1e-8?[f[0]/n,0,f[2]/n]:[0,0,-1],base=state.position;
  if(mode==='bonnet')return {position:add(add(base,[0,.46,0]),flat,1.05),target:add(add(base,[0,.35,0]),flat,45)};
  if(mode==='cockpit')return {position:add(base,rotate(state.orientation,[-.33,.59,.18])),target:add(add(base,[0,.46,0]),flat,40)};
  return {position:add(add(base,flat,-settings.chaseDistance),[0,settings.chaseHeight,0]),target:add(add(base,flat,5),[0,.3,0])};
}
export function raceRig(state,recipe,dimensions){
  const base=add(state.position,rotate(state.orientation,[0,recipe.wheel.radius+recipe.suspension.restLength,0]),-1);
  const body=raceMatrix(base,state.orientation,[recipe.chassis.width/dimensions.width,recipe.chassis.height/dimensions.height,recipe.chassis.length/dimensions.length]);
  const wheels=state.wheels.map((wheel,i)=>{const steer=i<2?-state.steering:0,q=quatMultiply(quatMultiply(state.orientation,[0,Math.sin(steer/2),0,Math.cos(steer/2)]),[Math.sin(state.wheelSpin/2),0,0,Math.cos(state.wheelSpin/2)]);return raceMatrix(wheel.position,q,[1,recipe.wheel.radius/dimensions.wheelRadius,recipe.wheel.radius/dimensions.wheelRadius]);});
  return {body,wheels};
}
export function raceGateTransforms(gate){
  // Lift the gate's horizontal lateral metric onto its accepted road plane.
  const up=gate.normal,right=[gate.right[0],-(up[0]*gate.right[0]+up[2]*gate.right[2])/up[1],gate.right[2]],back=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]],n=Math.hypot(...back),z=back.map(v=>v/n);
  const transform=(position,size)=>new Float32Array([...right.map(v=>v*size[0]),0,...up.map(v=>v*size[1]),0,...z.map(v=>v*size[2]),0,...position,1]);
  return [-1,1].map(side=>transform(add(add(gate.position,right,side*gate.halfWidth),up,2.2),[.16,4.4,.16])).concat([transform(add(gate.position,up,4.4),[gate.halfWidth*2+.16,.2,.2])]);
}
function orientation(position,target){const d=target.map((x,i)=>x-position[i]),n=Math.hypot(...d),yaw=Math.atan2(-d[0],-d[2]),pitch=Math.asin(Math.max(-1,Math.min(1,d[1]/n)));return quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);}
// One retained unit cube supports gate posts/crossbars. Decoration never enters contact physics.
function cube(){const out=[],vertices=[];for(let i=0;i<8;i++)vertices.push([0,1,2].map(k=>(i>>k&1)-.5));for(const [face,normal] of [[[0,4,6,2],[-1,0,0]],[[1,3,7,5],[1,0,0]],[[0,1,5,4],[0,-1,0]],[[2,6,7,3],[0,1,0]],[[0,2,3,1],[0,0,-1]],[[4,5,7,6],[0,0,1]]])for(const index of [0,1,2,0,2,3])out.push(...vertices[face[index]],...normal,1,1,1,0,0);return new Float32Array(out);}
const palettes={coast:{top:[.12,.36,.57],bottom:[.84,.85,.73],fog:[.65,.78,.76]},alpine:{top:[.14,.29,.47],bottom:[.81,.85,.90],fog:[.62,.71,.78]},dusk:{top:[.13,.10,.25],bottom:[.91,.50,.32],fog:[.48,.34,.43]}};
export class RaceView{
  constructor(canvas,project,world,checkpoints){this.canvas=canvas;this.renderer=null;this.rows=[];this.carRows=[];this.frames=0;this.replace(project,world,checkpoints);}
  replace(project,world,checkpoints){
    const worldKey=JSON.stringify(project.scenery),carKey=JSON.stringify([project.appearance,project.scenery.profile]),renew=!this.renderer||this.project?.scenery.profile!==project.scenery.profile,changed=worldKey!==this.worldKey,carsChanged=carKey!==this.carKey;let renderer=this.renderer,rows=this.rows,carRows=this.carRows,visual=this.visual,marker=this.marker;const created=[];
    const mesh=batch=>{const row={...batch,handle:renderer.mesh(batch.vertices),center:center(batch.vertices)};created.push(row);return row;};
    try{if(renew)renderer=new LitRenderer(this.canvas,{profile:project.scenery.profile,pixelRatio:Math.min(globalThis.devicePixelRatio||1,2)});if(renew||changed)rows=world.batches.map(mesh);if(renew||carsChanged){visual=buildVehicleVisual(project.appearance.classId,{profile:project.scenery.profile,paint:project.appearance.paint});carRows=visual.parts.map(mesh);}if(renew)marker=mesh({id:'checkpoint-marker',vertices:cube()});}
    catch(error){for(const row of created)renderer?.deleteMesh(row.handle);if(renew&&renderer!==this.renderer)renderer?.dispose();throw error;}
    if(renew)this.renderer?.dispose();else{if(changed)for(const row of this.rows)renderer.deleteMesh(row.handle);if(carsChanged)for(const row of this.carRows)renderer.deleteMesh(row.handle);}
    Object.assign(this,{renderer,rows,carRows,visual,marker,world,project,checkpoints,worldKey,carKey,carMap:new Map(carRows.map(row=>[row.id,row])),mode:project.camera.mode});
  }
  draw(session){
    if(!this.renderer||this.renderer.lost)return;const p=this.project,palette=palettes[p.scenery.environment],camera=raceCamera(session.player,p.camera,this.mode),transparent=[];
    this.renderer.begin(camera.position,orientation(camera.position,camera.target),{fov:p.camera.fov,near:.08,far:2000,ambient:.4,sunDirection:[-.4,.8,.35],sunColor:[1,.94,.81],skyTop:palette.top,skyBottom:palette.bottom,fogColor:palette.fog,fogDensity:.0016,exposure:1});
    const draw=(row,transform,material,at=row.center)=>{if((material.opacity??1)<1)transparent.push({row,transform,material,at});else this.renderer.draw(row.handle,{matrix:transform,material});};
    for(const row of this.rows)draw(row,identity,row.material);
    for(const [state,rival] of [[session.player,false],[session.rival,true]]){
      const rig=raceRig(state,p.vehicle,this.visual.dimensions);
      for(const part of vehicleDraws(this.visual,{brake:state.brake??0})){
        if(!rival&&this.mode==='cockpit')continue;
        let material=part.material;if(part.part.id==='body')material={...material,color:rival?[.08,.72,.77]:p.appearance.paint,roughness:p.appearance.roughness,metalness:p.appearance.metalness};
        draw(this.carMap.get(part.part.id),part.part.wheel===null?rig.body:rig.wheels[part.part.wheel],material,state.position);
      }
    }
    for(let i=0;i<this.checkpoints.length;i++){
      const gate=this.checkpoints[i],next=session.progress.checkpointIndex,color=i<next?[.25,.45,.36]:i===next?[1,.52,.12]:[.76,.83,.76],material={color,roughness:.4,metalness:.2,emission:i===next?.28:0};
      for(const transform of raceGateTransforms(gate))draw(this.marker,transform,material,gate.position);
    }
    transparent.sort((a,b)=>Math.hypot(...b.at.map((x,i)=>x-camera.position[i]))-Math.hypot(...a.at.map((x,i)=>x-camera.position[i])));for(const {row,transform,material} of transparent)this.renderer.draw(row.handle,{matrix:transform,material});this.frames++;this.lastCamera=camera;
  }
  snapshot(){return {frames:this.frames,camera:this.lastCamera,cameraMode:this.mode,graphics:this.renderer?.stats()??null,world:this.world.stats};}
  dispose(){this.renderer?.dispose();this.renderer=null;}
}
