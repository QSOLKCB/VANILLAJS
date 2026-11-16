// SPDX-License-Identifier: Apache-2.0
import {Renderer} from '../../modules/render-webgl/index.js';
import {quatMultiply} from '../../modules/math/index.js';
import {FrameGate} from '../../modules/frame-gate/index.js';
import {validateDemo} from '../../modules/mod-demo/index.js';
import {SampleAudioTransport} from '../../api/demoscene/transport.js';
import {DemoWorld} from './world.js';
export class DemoPlayer {
  constructor(canvas,source){this.canvas=canvas;this.renderer=new Renderer(canvas);this.gate=new FrameGate();this.quality='standard';this.epoch=0;this.load(source);this.makeMeshes();}
  makeMeshes(){this.meshes=Object.fromEntries(['triangles','lines','points'].map(k=>[k,this.renderer.mesh([],k)]));this.renderer.gl.clearColor(0,0,0,1);}
  load(source){
    const project=validateDemo(source),world=new DemoWorld(project),transport=new SampleAudioTransport(project.audio);
    // Validate/allocate before stopping the old production. Invalid imports are inert.
    const old=this.transport;transport.mute(old?.muted??false);this.project=project;this.world=world;this.transport=transport;this.gate.invalidate();if(old)void old.dispose();
  }
  draw(sample=this.transport.sample,{forceFresh=false}={}){
    const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio||1,2)*(this.quality==='low'?.65:1),width=Math.max(1,Math.floor(rect.width*dpr)),height=Math.max(1,Math.floor(rect.height*dpr));
    if(forceFresh)this.gate.invalidate();
    this.gate.present({key:sample+':'+this.quality,width,height,contextEpoch:this.epoch},()=>{
      const result=this.world.geometry(sample,this.quality,{forceFresh}),c=result.commands.camera,back=c.position.map((v,i)=>v-c.target[i]),yaw=Math.atan2(back[0],back[2]),pitch=-Math.atan2(back[1],Math.hypot(back[0],back[2])),q=quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);
      this.renderer.begin(c.position,q,{fov:c.fov,fog:0,resolution:this.quality==='low'?.65:1});
      for(const k of ['triangles','lines','points']){this.renderer.update(this.meshes[k],result.geometry.view(k));this.renderer.draw(this.meshes[k]);}
      this.frame=result;
    });return this.frame;
  }
  restore(){this.renderer.dispose();this.renderer=new Renderer(this.canvas);this.makeMeshes();this.epoch++;this.gate.invalidate();}
  async dispose(){await this.transport.dispose();this.renderer.dispose();}
}
