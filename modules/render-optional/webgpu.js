// SPDX-License-Identifier: Apache-2.0
// WASM projection adapted from QSOLKCB/OFFLINE-GAMES. No runtime downloads.
import bytes from './wasm-bytes.js';
const shader=`struct Out{@builtin(position) p:vec4f,@location(0) c:vec3f};
@vertex fn vs(@location(0) p:vec4f,@location(1) c:vec3f)->Out{
var o:Out;o.p=vec4f(p.xy,(p.z+p.w)*0.5,p.w);o.c=c;return o;}
@fragment fn fs(i:Out)->@location(0) vec4f{return vec4f(i.c,1);}`;
export class Backend{
  static async create(canvas,adapter,onLost){
    const device=await adapter.requestDevice();let backend;
    try{device.pushErrorScope('validation');const {instance}=await WebAssembly.instantiate(bytes);
      backend=new Backend(canvas,device,instance.exports,onLost);
      const error=await device.popErrorScope();if(error)throw new Error(error.message);if(backend.lost)throw new Error('GPU lost during initialization');return backend;
    }catch(error){backend?.dispose();device.destroy();throw error;}
  }
  constructor(source,device,wasm,onLost){
    this.source=source;this.device=device;this.wasm=wasm;this.buffers=new Map();this.disposed=false;
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');
    this.canvas.style.cssText='position:absolute;pointer-events:none;inset:0;width:100%;height:100%';
    source.after(this.canvas);this.context=this.canvas.getContext('webgpu');
    if(!this.context){this.canvas.remove();throw new Error('WebGPU canvas unavailable');}
    try{
    this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device,format:this.format,alphaMode:'opaque'});
    const module=device.createShaderModule({code:shader});this.pipelines={};
    for(const [mode,topology] of Object.entries({triangles:'triangle-list',lines:'line-list',points:'point-list'}))
      this.pipelines[mode]=device.createRenderPipeline({layout:'auto',
        vertex:{module,entryPoint:'vs',buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:'float32x4'},{shaderLocation:1,offset:16,format:'float32x3'}]}]},
        fragment:{module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology},
        depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less-equal'}});
    device.lost.then(()=>{this.lost=true;if(!this.disposed)onLost();});device.addEventListener('uncapturederror',()=>{if(!this.disposed)onLost();});
    }catch(error){this.context.unconfigure();this.canvas.remove();throw error;}
  }
  render(meshes,vp,fog){
    const w=this.source.width,h=this.source.height;
    if(!this.depth||this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;this.canvas.height=h;this.depth?.destroy();
      this.depth=this.device.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});
    }
    const encoder=this.device.createCommandEncoder(),pass=encoder.beginRenderPass({
      colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:[5/255,10/255,20/255,1],loadOp:'clear',storeOp:'store'}],
      depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
    new Float32Array(this.wasm.memory.buffer,0,16).set(vp);
    for(const mesh of meshes){
      const count=mesh.data.length/6;if(!count)continue;
      let slot=this.buffers.get(mesh);
      // A complete key: owned vertex revision, exact matrix bytes and fog.
      const key=Array.from(new Uint32Array(vp.buffer,vp.byteOffset,16)).join(',')+':'+fog;
      if(!slot||slot.size<count*28){slot?.buffer.destroy();slot={size:count*28,buffer:this.device.createBuffer({size:count*28,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})};this.buffers.set(mesh,slot);}
      if(slot.revision!==mesh.revision||slot.key!==key){
        new Float32Array(this.wasm.memory.buffer,64,mesh.data.length).set(mesh.data);
        this.wasm.project(64,4194304,0,count);
        const data=new Float32Array(this.wasm.memory.buffer,4194304,count*7);
        for(let i=0;i<data.length;i+=7){const k=Math.exp(-Math.max(0,data[i+3])*fog);for(let j=4;j<7;j++)data[i+j]*=k;}
        this.device.queue.writeBuffer(slot.buffer,0,data);slot.revision=mesh.revision;slot.key=key;
      }
      pass.setPipeline(this.pipelines[mesh.mode]);pass.setVertexBuffer(0,slot.buffer);pass.draw(count);
    }
    pass.end();this.device.queue.submit([encoder.finish()]);
  }
  release(mesh){this.buffers.get(mesh)?.buffer.destroy();this.buffers.delete(mesh);}
  dispose(){this.disposed=true;for(const s of this.buffers.values())s.buffer.destroy();this.buffers.clear();this.depth?.destroy();this.context.unconfigure();this.canvas.remove();this.device.destroy();}
}
