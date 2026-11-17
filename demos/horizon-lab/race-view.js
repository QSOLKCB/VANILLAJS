// SPDX-License-Identifier: Apache-2.0
import {LitRenderer,LIT_PROFILES,litNormalMatrix} from '../../modules/render-lit/index.js';
import {buildVehicleVisual,vehicleDraws} from '../../modules/scenic3d/index.js';
import {rotate,quatMultiply} from '../../modules/math/index.js';
import {partitionRaceWorld,raceTileVisible} from './race-visibility.js';
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const add=(a,b,s=1)=>a.map((x,i)=>x+b[i]*s);
const center=values=>{const c=[0,0,0],n=values.length/11;for(let i=0;i<values.length;i+=11)for(let j=0;j<3;j++)c[j]+=values[i+j]/n;return c;};
export function raceMatrix(position,q,scale=[1,1,1]){const x=rotate(q,[scale[0],0,0]),y=rotate(q,[0,scale[1],0]),z=rotate(q,[0,0,scale[2]]);return new Float32Array([...x,0,...y,0,...z,0,...position,1]);}
export function raceCamera(state,settings,mode=settings.mode){
  const f=rotate(state.orientation,[0,0,-1]),n=Math.hypot(f[0],f[2]),flat=n>1e-8?[f[0]/n,0,f[2]/n]:[0,0,-1],base=state.position;
  if(mode==='bonnet')return {position:add(add(base,[0,.46,0]),flat,1.05),target:add(add(base,[0,.35,0]),flat,45)};
  if(mode==='cockpit')return {position:add(base,rotate(state.orientation,[-.33,.59,.18])),target:add(add(base,[0,.46,0]),flat,40)};
  const speed=Math.min(45,Math.hypot(...state.velocity)),right=[-flat[2],0,flat[0]],distance=settings.chaseDistance+Math.min(1.2,speed*.035);
  return {position:add(add(add(base,flat,-distance),right,.28),[0,settings.chaseHeight,0]),target:add(add(base,flat,6+Math.min(3,speed*.12)),[0,.65,0])};
}
/** Presentation-only damping, advanced by supplied simulation ticks, never wall time.
 * Repainting a paused frame cannot move the camera. Recovery/mode/reset snap cleanly. */
export class RaceCameraFilter{
  reset(){this.previous=null;}
  sample(state,settings,mode=settings.mode){
    const desired=raceCamera(state,settings,mode),prior=this.previous,key=JSON.stringify([settings,mode]),position=[...state.position];
    const reset=!prior||prior.key!==key||state.tick<prior.tick||Math.hypot(...position.map((v,i)=>v-prior.position[i]))>5;
    let camera=desired;
    if(!reset&&mode==='chase'){
      const dt=Math.min(.1,Math.max(0,(state.tick-prior.tick)/240)),a=-Math.expm1(-dt*10),translation=position.map((v,i)=>i===1?0:v-prior.position[i]);
      camera={};for(const field of ['position','target'])camera[field]=desired[field].map((v,i)=>{const old=prior.camera[field][i]+translation[i];return old+(v-old)*a;});
    }
    this.previous={key,tick:state.tick,position,camera};return {position:[...camera.position],target:[...camera.target]};
  }
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
// Unit cube source is baked into retained gate batches; never contact physics.
function cube(){const out=[],vertices=[];for(let i=0;i<8;i++)vertices.push([0,1,2].map(k=>(i>>k&1)-.5));for(const [face,normal] of [[[0,4,6,2],[-1,0,0]],[[1,3,7,5],[1,0,0]],[[0,1,5,4],[0,-1,0]],[[2,6,7,3],[0,1,0]],[[0,2,3,1],[0,0,-1]],[[4,5,7,6],[0,0,1]]])for(const index of [0,1,2,0,2,3])out.push(...vertices[face[index]],...normal,1,1,1,0,0);return new Float32Array(out);}
/** One retained mesh per gate, including the unchanged three structural boxes.
 * Coloured bands and suspended chevrons are decorative, never contact surfaces. */
export function raceGateMesh(gate){
  const data=[],source=cube();
  for(const matrix of raceGateTransforms(gate)){
    const normal=litNormalMatrix(matrix);
    for(let i=0;i<source.length;i+=11){const p=Array.from(source.slice(i,i+3)),n=Array.from(source.slice(i+3,i+6)),position=[0,1,2].map(k=>matrix[k]*p[0]+matrix[k+4]*p[1]+matrix[k+8]*p[2]+matrix[k+12]),direction=[0,1,2].map(k=>normal[k]*n[0]+normal[k+3]*n[1]+normal[k+6]*n[2]),length=Math.hypot(...direction);data.push(...position,...direction.map(v=>v/length),...source.slice(i+6,i+11));}
  }
  const up=gate.normal,right=[gate.right[0],-(up[0]*gate.right[0]+up[2]*gate.right[2])/up[1],gate.right[2]],face=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]],normal=face.map(v=>v/Math.hypot(...face));
  const point=(x,y)=>add(add(add(gate.position,right,x),up,y),normal,.12);
  const triangle=(points,color)=>{for(const p of points)data.push(...p,...normal,...color,0,0);};
  const segments=gate.finish?24:12;
  for(let i=0;i<segments;i++){const x=-gate.halfWidth+2*gate.halfWidth*i/segments,X=-gate.halfWidth+2*gate.halfWidth*(i+1)/segments,color=i%2?[.12,.16,.18]:[1,1,1],a=point(x,4.35),b=point(X,4.35),c=point(X,4.65),d=point(x,4.65);triangle([a,b,c],color);triangle([a,c,d],color);}
  if(!gate.finish)for(const x of [-2,0,2]){triangle([point(x-.48,4.0),point(x,3.5),point(x+.48,4.0)],[1,1,1]);}
  return new Float32Array(data);
}
const palettes={coast:{top:[.12,.36,.57],bottom:[.84,.85,.73],fog:[.65,.78,.76]},alpine:{top:[.14,.29,.47],bottom:[.81,.85,.90],fog:[.62,.71,.78]},dusk:{top:[.13,.10,.25],bottom:[.91,.50,.32],fog:[.48,.34,.43]}};
export class RaceView{
  constructor(canvas,project,world,checkpoints){this.canvas=canvas;this.renderer=null;this.rows=[];this.carRows=[];this.gateRows=[];this.cameraFilter=new RaceCameraFilter();this.frames=0;this.visibilityEnabled=true;this.replace(project,world,checkpoints);}
  replace(project,world,checkpoints){
    const worldKey=JSON.stringify(project.scenery),carKey=JSON.stringify([project.appearance,project.scenery.profile]),gateKey=JSON.stringify(checkpoints),changed=worldKey!==this.worldKey,carsChanged=carKey!==this.carKey,gatesChanged=gateKey!==this.gateKey;let renew=!this.renderer||this.project?.scenery.profile!==project.scenery.profile;
    const visual=renew||carsChanged?buildVehicleVisual(project.appearance.classId,{profile:project.scenery.profile,paint:project.appearance.paint}):this.visual,gateBatches=renew||gatesChanged?checkpoints.map(gate=>({id:gate.id,vertices:raceGateMesh(gate)})):this.gateRows;
    // Tile only static opaque presentation meshes, never the contact world.
    let preparedWorld=renew||changed?partitionRaceWorld(world.batches):null;
    if(!renew){const staged=[...(changed?preparedWorld:[]),...(carsChanged?visual.parts:[]),...(gatesChanged?gateBatches:[])],held=this.renderer.stats(),limits=LIT_PROFILES[project.scenery.profile];renew=held.vertices+staged.reduce((n,row)=>n+row.vertices.length/11,0)>limits.maxVertices||held.meshes+staged.length>limits.maxMeshes;}
    if(renew&&!preparedWorld)preparedWorld=partitionRaceWorld(world.batches);
    let renderer=this.renderer,rows=this.rows,carRows=this.carRows,gateRows=this.gateRows;const created=[];
    const mesh=batch=>{const row={...batch,handle:renderer.mesh(batch.vertices),center:center(batch.vertices)};created.push(row);return row;};
    try{if(renew)renderer=new LitRenderer(this.canvas,{profile:project.scenery.profile,pixelRatio:Math.min(globalThis.devicePixelRatio||1,2)});if(renew||changed)rows=preparedWorld.map(mesh);if(renew||carsChanged)carRows=visual.parts.map(mesh);if(renew||gatesChanged)gateRows=gateBatches.map(mesh);}
    catch(error){for(const row of created)renderer?.deleteMesh(row.handle);if(renew&&renderer!==this.renderer)renderer?.dispose();throw error;}
    if(renew)this.renderer?.dispose();else{if(changed)for(const row of this.rows)renderer.deleteMesh(row.handle);if(carsChanged)for(const row of this.carRows)renderer.deleteMesh(row.handle);if(gatesChanged)for(const row of this.gateRows)renderer.deleteMesh(row.handle);}
    this.cameraFilter.reset();this.recoveries=null;this.lastVisibility=null;Object.assign(this,{renderer,rows,carRows,gateRows,visual,world,project,checkpoints,worldKey,carKey,gateKey,carMap:new Map(carRows.map(row=>[row.id,row])),mode:project.camera.mode});
  }
  draw(session){
    if(!this.renderer||this.renderer.lost)return;if(this.recoveries!==session.progress.recoveries){this.cameraFilter.reset();this.recoveries=session.progress.recoveries;}const p=this.project,palette=palettes[p.scenery.environment],camera=this.cameraFilter.sample(session.player,p.camera,this.mode),transparent=[];
    this.renderer.begin(camera.position,orientation(camera.position,camera.target),{fov:p.camera.fov,near:.08,far:2000,ambient:.4,sunDirection:[-.4,.8,.35],sunColor:[1,.94,.81],skyTop:palette.top,skyBottom:palette.bottom,fogColor:palette.fog,fogDensity:.0016,exposure:1});
    const draw=(row,transform,material,at=row.center)=>{if((material.opacity??1)<1)transparent.push({row,transform,material,at});else this.renderer.draw(row.handle,{matrix:transform,material});};
    let totalTiles=0,visibleTiles=0,culledVertices=0;
    const aspect=this.canvas?.width>0&&this.canvas?.height>0?this.canvas.width/this.canvas.height:1;
    for(const row of this.rows){
      if(row.visibilityBounds){
        totalTiles++;
        if(this.visibilityEnabled&&!raceTileVisible(row.visibilityBounds,camera,p.camera.fov,aspect)){
          culledVertices+=row.vertices.length/11;continue;
        }
        visibleTiles++;
      }
      draw(row,identity,row.material);
    }
    this.lastVisibility={enabled:this.visibilityEnabled,totalTiles,visibleTiles,culledTiles:totalTiles-visibleTiles,culledVertices};
    for(const [state,rival] of [[session.player,false],[session.rival,true]]){
      const rig=raceRig(state,p.vehicle,this.visual.dimensions);
      for(const part of vehicleDraws(this.visual,{brake:state.brake??0})){
        if(!rival&&this.mode==='cockpit')continue;
        let material=part.material;if(part.part.id==='body')material={...material,color:rival?[.08,.72,.77]:p.appearance.paint,roughness:p.appearance.roughness,metalness:p.appearance.metalness};
        draw(this.carMap.get(part.part.id),part.part.wheel===null?rig.body:rig.wheels[part.part.wheel],material,state.position);
      }
    }
    // A completed gate was still drawn behind the car, where its overhead
    // checkerboard crossbar could intersect the chase camera and appear to be
    // a solid wall. Retain the mesh; draw only unfinished checkpoint gates.
    const next=session.progress.checkpointIndex;
    if(!Number.isSafeInteger(next)||next<0||next>this.checkpoints.length)
      throw RangeError('Invalid checkpoint render progress');
    this.visibleGates=this.checkpoints.length-next;
    for(let i=next;i<this.checkpoints.length;i++){
      const gate=this.checkpoints[i],color=i===next?[1,.52,.12]:[.76,.83,.76],
        material={color,roughness:.4,metalness:.2,emission:i===next?.28:0};
      draw(this.gateRows[i],identity,material,gate.position);
    }
    transparent.sort((a,b)=>Math.hypot(...b.at.map((x,i)=>x-camera.position[i]))-Math.hypot(...a.at.map((x,i)=>x-camera.position[i])));for(const {row,transform,material} of transparent)this.renderer.draw(row.handle,{matrix:transform,material});this.frames++;this.lastCamera=camera;
  }
  snapshot(){return {frames:this.frames,camera:this.lastCamera,cameraMode:this.mode,visibleGates:this.visibleGates??this.checkpoints.length,graphics:this.renderer?.stats()??null,visibility:this.lastVisibility,world:this.world.stats};}
  dispose(){this.renderer?.dispose();this.renderer=null;}
}
