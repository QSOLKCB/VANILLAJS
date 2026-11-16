// SPDX-License-Identifier: Apache-2.0
// Thin owned adapter over the existing WebGLAPI. No animation loop or physics.
import {WebGLAPI} from '../../api/webgl/index.js';
import {boxVertices} from '../../modules/render-webgl/index.js';
import {perspective,multiplyMatrices} from '../../modules/math/index.js';
import {SceneGraph,transformPoint,inverseSceneMatrix} from '../../modules/scene-graph/index.js';
import {cameraMatrix} from './viewport.js';
export function compositionVertices(world){
  const vertices=[];
  // Light records are portable metadata. This preview deliberately applies only
  // ambient exposure/tint; directional lights and roughness are not a new shader.
  const ambient=world.filter(n=>n.visible&&n.components.light?.kind==='ambient');
  for(const n of world)if(n.visible&&n.components.mesh.enabled){
    const colour=n.components.appearance.color.map((c,i)=>Math.min(1,c*(ambient.length?ambient.reduce((sum,l)=>sum+l.components.light.color[i]*l.components.light.intensity,0):1)));
    const box=boxVertices([0,0,0],[1,1,1],colour);
    for(let i=0;i<box.length;i+=6)vertices.push(...transformPoint(n.matrix,box.slice(i,i+3)),...box.slice(i+3,i+6));
  }
  return new Float32Array(vertices);
}
export class SceneCompositionPreview{
  #scene;#api;#mesh;#disposed=false;
  constructor(canvas,graph,{rendererFactory=c=>new WebGLAPI(c)}={}){
    const scene=new SceneGraph(graph),api=rendererFactory(canvas);
    try{this.#mesh=api.createMesh([],'triangles');}catch(error){api.dispose();throw error;}
    this.canvas=canvas;this.#scene=scene;this.#api=api;
  }
  #available(){if(this.#disposed)throw new Error('Composition preview disposed');}
  load(graph){this.#available();const next=new SceneGraph(graph);this.#scene=next;}
  draw(time=0){
    this.#available();const world=this.#scene.sample(time),rect=this.canvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio??1,2);
    const width=Math.max(1,Math.min(4096,Math.round(rect.width*ratio))),height=Math.max(1,Math.min(4096,Math.round(rect.height*ratio)));if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;
    this.#api.updateMesh(this.#mesh,compositionVertices(world));
    const camera=world.find(n=>n.visible&&n.components.camera),c=camera?.components.camera;
    const vp=camera?multiplyMatrices(perspective(c.fov,this.canvas.width/this.canvas.height,c.near,c.far),inverseSceneMatrix(camera.matrix)):cameraMatrix({yaw:38,pitch:23,distance:15,target:[0,1,0]},this.canvas.width,this.canvas.height);
    this.#api.beginFrame({vp,fog:.003});this.#api.draw(this.#mesh);this.#api.endFrame();
    return {time,nodes:world.length,camera:camera?.id??'orbit preview',world};
  }
  stats(){this.#available();return this.#api.stats();}
  snapshot(){this.#available();return this.#scene.snapshot();}
  dispose(){if(this.#disposed)return;this.#disposed=true;this.#api.dispose();}
}
