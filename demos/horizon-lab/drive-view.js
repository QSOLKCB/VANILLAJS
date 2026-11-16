// SPDX-License-Identifier: Apache-2.0
import {LitRenderer} from '../../modules/render-lit/index.js';
import {buildVehicleVisual,vehicleDraws} from '../../modules/scenic3d/index.js';
import {rotate,quatMultiply} from '../../modules/math/index.js';
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const add=(a,b,s=1)=>a.map((x,i)=>x+b[i]*s);
const center=values=>{const c=[0,0,0],n=values.length/11;for(let i=0;i<values.length;i+=11)for(let j=0;j<3;j++)c[j]+=values[i+j]/n;return c;};
function matrix(position,q,scale=[1,1,1]){const x=rotate(q,[scale[0],0,0]),y=rotate(q,[0,scale[1],0]),z=rotate(q,[0,0,scale[2]]);return new Float32Array([...x,0,...y,0,...z,0,...position,1]);}
function orientation(position,target){const d=target.map((x,i)=>x-position[i]),length=Math.hypot(...d),yaw=Math.atan2(-d[0],-d[2]),pitch=Math.asin(Math.max(-1,Math.min(1,d[1]/length)));return quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);}
const palettes={coast:{top:[.16,.40,.57],bottom:[.80,.85,.75],fog:[.64,.76,.75]},alpine:{top:[.16,.30,.48],bottom:[.79,.84,.89],fog:[.61,.70,.77]},dusk:{top:[.16,.12,.29],bottom:[.87,.53,.40],fog:[.44,.35,.48]}};
export class DriveView{
  constructor(canvas,project,world){this.canvas=canvas;this.renderer=null;this.rows=[];this.carRows=[];this.mode='chase';this.frames=0;this.replace(project,world);}
  replace(project,world){
    const worldKey=JSON.stringify([project.scenery,project.course]),changed=worldKey!==this.worldKey,renew=!this.renderer||this.project?.scenery.profile!==project.scenery.profile;
    let renderer=this.renderer,rows=this.rows,carRows=this.carRows,visual=this.visual;const created=[];
    const mesh=batch=>{const row={...batch,handle:renderer.mesh(batch.vertices),center:center(batch.vertices)};created.push(row);return row;};
    try{
      if(renew)renderer=new LitRenderer(this.canvas,{profile:project.scenery.profile,pixelRatio:Math.min(globalThis.devicePixelRatio||1,2)});
      if(renew||changed)rows=world.batches.map(mesh);
      if(renew){visual=buildVehicleVisual('sport',{profile:project.scenery.profile,paint:[.88,.33,.13]});carRows=visual.parts.map(mesh);}
    }catch(error){for(const row of created)renderer?.deleteMesh(row.handle);if(renew&&renderer!==this.renderer)renderer?.dispose();throw error;}
    if(renew)this.renderer?.dispose();else if(changed)for(const row of this.rows)renderer.deleteMesh(row.handle);
    Object.assign(this,{renderer,rows,carRows,visual,world,project,worldKey,carMap:new Map(carRows.map(row=>[row.id,row]))});
  }
  camera(state){
    const f=rotate(state.orientation,[0,0,-1]),flatLength=Math.hypot(f[0],f[2]),flat=flatLength>1e-8?[f[0]/flatLength,0,f[2]/flatLength]:[0,0,-1],base=state.position;
    if(this.mode==='overlook')return {position:add(base,[25,42,30]),target:base};
    if(this.mode==='bonnet')return {position:add(add(base,[0,.45,0]),flat,.9),target:add(add(base,[0,.3,0]),flat,40)};
    return {position:add(add(base,flat,-9),[0,4,0]),target:add(add(base,flat,5),[0,.3,0])};
  }
  draw(state){
    if(!this.renderer||this.renderer.lost)return;const p=this.project,r=p.vehicle,palette=palettes[p.scenery.environment],camera=this.camera(state);
    this.renderer.begin(camera.position,orientation(camera.position,camera.target),{fov:.92,near:.1,far:2000,ambient:.38,sunDirection:[-.4,.8,.35],sunColor:[1,.94,.81],skyTop:palette.top,skyBottom:palette.bottom,fogColor:palette.fog,fogDensity:.0022,exposure:1});
    const transparent=[];
    const draw=(row,transform,material,at=row.center)=>{if((material.opacity??1)<1)transparent.push({row,transform,material,at});else this.renderer.draw(row.handle,{matrix:transform,material});};
    for(const row of this.rows)draw(row,identity,row.material);
    // Core hub positions are authoritative. The older visual rig's 0.25 m clamp
    // does not constrain these wheel transforms or feed back into simulation.
    const base=add(state.position,rotate(state.orientation,[0,r.wheel.radius+r.suspension.restLength,0]),-1),d=this.visual.dimensions;
    const body=matrix(base,state.orientation,[r.chassis.width/d.width,r.chassis.height/d.height,r.chassis.length/d.length]);
    for(const part of vehicleDraws(this.visual,{brake:state.brake??0})){
      const row=this.carMap.get(part.part.id);let transform=body;
      if(part.part.wheel!==null){
        const i=part.part.wheel,steer=i<2?-state.steering:0,q=quatMultiply(quatMultiply(state.orientation,[0,Math.sin(steer/2),0,Math.cos(steer/2)]),[Math.sin(state.wheelSpin/2),0,0,Math.cos(state.wheelSpin/2)]);
        transform=matrix(state.wheels[i].position,q,[1,r.wheel.radius/d.wheelRadius,r.wheel.radius/d.wheelRadius]);
      }
      draw(row,transform,part.material,state.position);
    }
    transparent.sort((a,b)=>Math.hypot(...b.at.map((x,i)=>x-camera.position[i]))-Math.hypot(...a.at.map((x,i)=>x-camera.position[i])));
    for(const {row,transform,material} of transparent)this.renderer.draw(row.handle,{matrix:transform,material});
    this.frames++;this.lastCamera=camera;
  }
  snapshot(){return {frames:this.frames,camera:this.lastCamera,cameraMode:this.mode,graphics:this.renderer?.stats()??null,world:this.world.stats};}
  dispose(){this.renderer?.dispose();this.renderer=null;}
}
