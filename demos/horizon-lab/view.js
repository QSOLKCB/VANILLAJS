// SPDX-License-Identifier: Apache-2.0
import {LitRenderer} from '../../modules/render-lit/index.js';
import {buildScenicWorld,buildVehicleVisual,vehicleDraws,createRoadShadow} from '../../modules/scenic3d/index.js';
import {quatMultiply} from '../../modules/math/index.js';
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const forward=yaw=>[-Math.sin(yaw),0,-Math.cos(yaw)],right=yaw=>[Math.cos(yaw),0,-Math.sin(yaw)];
const add=(p,a,b=1)=>p.map((x,i)=>x+a[i]*b);
// Keep the complete six-metre contact patch on even the shortest admitted road.
const carDistance=road=>Math.max(3.1,Math.min(road.length-3.1,road.length*.1));
function orientation(position,target){const d=target.map((x,i)=>x-position[i]),length=Math.hypot(...d);if(length<1e-8)throw Error('Camera target coincides with position');const yaw=Math.atan2(-d[0],-d[2]),pitch=Math.asin(Math.max(-1,Math.min(1,d[1]/length)));return quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);}
const center=values=>{const c=[0,0,0],n=values.length/11;for(let i=0;i<values.length;i+=11)for(let j=0;j<3;j++)c[j]+=values[i+j]/n;return c;};
const palettes={coast:{top:[.16,.40,.57],bottom:[.80,.85,.75],fog:[.64,.76,.75],sun:[1,.91,.72],ambient:.34},alpine:{top:[.16,.30,.48],bottom:[.79,.84,.89],fog:[.61,.70,.77],sun:[1,.96,.88],ambient:.33},dusk:{top:[.16,.12,.29],bottom:[.87,.53,.40],fog:[.44,.35,.48],sun:[1,.60,.35],ambient:.30}};
export class HorizonView{
  constructor(canvas,project){this.canvas=canvas;this.renderer=null;this.worldRows=[];this.carRows=[];this.shadow=null;this.world=null;this.vehicle=null;this.project=null;this.frames=0;this.preparations=0;this.mode='hero';this.orbit=0;this.tilt=0;this.zoom=1;this.replace(project);}
  replace(project){
    const sceneryKey=JSON.stringify(project.scenery),vehicleKey=JSON.stringify([project.vehicle.classId,project.vehicle.paint,project.scenery.profile]);
    const newWorld=sceneryKey!==this.sceneryKey,newCar=vehicleKey!==this.vehicleKey,newRenderer=!this.renderer||this.project?.scenery.profile!==project.scenery.profile;
    const world=newWorld?buildScenicWorld(project.scenery):this.world,vehicle=newCar?buildVehicleVisual(project.vehicle.classId,{paint:project.vehicle.paint,profile:project.scenery.profile}):this.vehicle;
    let renderer=this.renderer,worldRows=this.worldRows,carRows=this.carRows,shadow=this.shadow;const created=[];
    const mesh=batch=>{const row={...batch,handle:renderer.mesh(batch.vertices),center:center(batch.vertices)};created.push(row);return row;};
    try{
      if(newRenderer)renderer=new LitRenderer(this.canvas,{profile:project.scenery.profile,pixelRatio:Math.min(globalThis.devicePixelRatio||1,2)});
      if(newWorld||newRenderer){
        worldRows=world.batches.map(mesh);const sample=world.road.sample(carDistance(world.road));
        shadow=mesh({id:'vehicle-contact-shadow',material:{color:[.035,.045,.05],roughness:1,metalness:0,opacity:.55,emission:0,pattern:'shadow',patternScale:1},vertices:createRoadShadow(world.road,{distance:sample.distance,width:3.4,length:6,offset:.035})});
      }
      if(newCar||newRenderer)carRows=vehicle.parts.map(mesh);
    }catch(error){for(const row of created)renderer?.deleteMesh(row.handle);if(newRenderer&&renderer!==this.renderer)renderer?.dispose();throw error;}
    if(newRenderer)this.renderer?.dispose();
    else{if(newWorld){for(const row of this.worldRows)renderer.deleteMesh(row.handle);if(this.shadow)renderer.deleteMesh(this.shadow.handle);}if(newCar)for(const row of this.carRows)renderer.deleteMesh(row.handle);}
    Object.assign(this,{renderer,world,vehicle,worldRows,carRows,shadow,project,sceneryKey,vehicleKey,carRowsById:new Map(carRows.map(row=>[row.id,row]))});if(newWorld||newCar||newRenderer)this.preparations++;
  }
  resetCamera(mode='hero'){this.mode=mode;this.orbit=0;this.tilt=0;this.zoom=1;}
  orbitBy(x,y){this.orbit+=x;this.tilt=Math.max(-.35,Math.min(.55,this.tilt+y));}
  zoomBy(factor){this.zoom=Math.max(.6,Math.min(2.2,this.zoom*factor));}
  camera(time=0){
    const sample=this.world.road.sample(carDistance(this.world.road)),base=sample.position,f=forward(sample.yaw),r=right(sample.yaw);
    if(this.mode==='road'){
      const road=this.world.road.sample(this.world.road.length*.60),ahead=this.world.road.sample(Math.min(this.world.road.length,this.world.road.length*.60+55));
      return {position:add(add(road.position,right(road.yaw),-2.3),[0,1,0],3.2),target:add(ahead.position,[0,1,0],1.5)};
    }
    if(this.mode==='orbit'){
      const middle=this.world.road.sample(this.world.road.length*.48).position,angle=.8+this.orbit+time*.16,distance=150*this.zoom,height=95+Math.sin(this.tilt)*90;
      return {position:add(middle,[Math.cos(angle)*distance,height,Math.sin(angle)*distance]),target:middle};
    }
    if(this.mode==='bonnet')return {position:add(add(base,f,1),[0,1,0],1.05),target:add(add(base,f,45),[0,1,0],4)};
    const angle=.85+this.orbit+time*.16,distance=8.6*this.zoom,height=3.5+Math.sin(this.tilt)*10;
    return {position:add(add(add(base,f,Math.cos(angle)*distance),r,Math.sin(angle)*distance),[0,1,0],Math.max(1.4,height)),target:add(base,[0,1,0],.85)};
  }
  draw(time=0){
    const renderer=this.renderer;if(!renderer||renderer.lost)return;
    const p=this.project,lighting=p.lighting,palette=palettes[p.scenery.environment],camera=this.camera(time),sun=[Math.cos(lighting.elevation)*Math.sin(lighting.azimuth),Math.sin(lighting.elevation),Math.cos(lighting.elevation)*Math.cos(lighting.azimuth)];
    renderer.begin(camera.position,orientation(camera.position,camera.target),{fov:this.mode==='bonnet'?.95:.85,near:.1,far:2400,ambient:palette.ambient,sunDirection:sun,sunColor:palette.sun,skyTop:palette.top,skyBottom:palette.bottom,fogColor:palette.fog,fogDensity:lighting.fogDensity,exposure:1});
    const sample=this.world.road.sample(carDistance(this.world.road)),rig=vehicleDraws(this.vehicle,{position:sample.position,yaw:sample.yaw,pitch:(sample.pitch??0)+p.vehicle.pitch,roll:(sample.roll??0)+p.vehicle.roll,wheelSpin:p.vehicle.wheelSpin,steer:p.vehicle.steer,compression:p.vehicle.compression,brake:p.vehicle.brake});
    const transparent=[];
    const draw=(row,matrix,material,at=row.center)=>{const entry={row,matrix,material,center:at};if((material.opacity??1)<1)transparent.push(entry);else renderer.draw(row.handle,{matrix,material});};
    for(const row of this.worldRows)draw(row,identity,row.material);
    draw(this.shadow,identity,this.shadow.material);
    for(const entry of rig){const row=this.carRowsById.get(entry.part.id),material=entry.part.group==='body'?{...entry.material,roughness:p.vehicle.roughness,metalness:p.vehicle.metalness}:entry.material;draw(row,entry.matrix,material,sample.position);}
    transparent.sort((a,b)=>Math.hypot(...b.center.map((v,i)=>v-camera.position[i]))-Math.hypot(...a.center.map((v,i)=>v-camera.position[i])));
    for(const entry of transparent)renderer.draw(entry.row.handle,{matrix:entry.matrix,material:entry.material});
    this.frames++;this.lastCamera=camera;this.lastSample=sample;
  }
  snapshot(){return {frames:this.frames,preparations:this.preparations,cameraMode:this.mode,camera:this.lastCamera,road:this.lastSample,world:this.world.stats,vehicle:this.vehicle.stats,graphics:this.renderer?.stats()??null};}
  dispose(){this.renderer?.dispose();this.renderer=null;}
}
