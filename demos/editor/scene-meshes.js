// SPDX-License-Identifier: Apache-2.0
import {MAX_VERTICES} from '../../modules/render-optional/index.js';
// Preserve whole XYZ/RGB triangles at every batch boundary. Shared by the
// editor preview and exported player; the Asset Foundry budget remains intact.
export const SCENE_BATCH_VERTICES=Math.floor(MAX_VERTICES/3)*3;
export class SceneMeshes{
  constructor(renderer){this.renderer=renderer;this.handles=[];}
  update(vertices){
    if(!(vertices instanceof Float32Array)||vertices.length%18||!vertices.every(Number.isFinite))
      throw new TypeError('finite whole triangle stream required');
    const stride=SCENE_BATCH_VERTICES*6,count=Math.ceil(vertices.length/stride);
    for(let i=0;i<count;i++){
      const chunk=vertices.subarray(i*stride,Math.min(vertices.length,(i+1)*stride));
      if(i<this.handles.length)this.renderer.updateMesh(this.handles[i],chunk);
      else this.handles.push(this.renderer.createMesh(chunk,'triangles'));
    }
    while(this.handles.length>count)this.renderer.deleteMesh(this.handles.pop());
  }
  draw(){for(const handle of this.handles)this.renderer.draw(handle);}
  dispose(){while(this.handles.length)this.renderer.deleteMesh(this.handles.pop());}
}
