// SPDX-License-Identifier: Apache-2.0
// CPU-first retained XYZ/RGB renderer. GPU consent is never persisted.
export const MAX_VERTICES=65536,MAX_MESHES=128;
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const sizes={triangles:3,lines:2,points:1};
export function packedVertices(data,mode='triangles'){
  if(!Object.hasOwn(sizes,mode)||!(Array.isArray(data)||data instanceof Float32Array)||
    data.length%(6*sizes[mode])||data.length>MAX_VERTICES*6)
    throw new RangeError('bounded whole primitives required');
  if(!Array.from(data).every(x=>typeof x==='number'&&Number.isFinite(x)))throw new TypeError('numeric vertices required');
  const result=Float32Array.from(data);
  if(!result.every(Number.isFinite))throw new RangeError('finite Float32 vertices required');
  return result;
}
export function projectVertices(data,matrix,out=new Float32Array(data.length/6*7)){
  const f=Math.fround;
  for(let i=0,j=0;i<data.length;i+=6,j+=7){
    for(let k=0;k<4;k++)out[j+k]=f(f(f(f(data[i]*matrix[k])+f(data[i+1]*matrix[k+4]))+f(data[i+2]*matrix[k+8]))+matrix[k+12]);
    out[j+4]=data[i+3];out[j+5]=data[i+4];out[j+6]=data[i+5];
  }
  return out;
}
// Homogeneous clipping includes near/far and viewport planes, including spheres
// whose centers lie behind the camera. Input is presentation geometry only.
export function clipPolygon(vertices){
  let poly=vertices;
  for(const [axis,sign] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){
    const next=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=a[3]+sign*a[axis],db=b[3]+sign*b[axis];
      if(da>=0)next.push(a);
      if((da<0)!==(db<0)){const t=da/(da-db);next.push(a.map((v,k)=>v+(b[k]-v)*t));}
    }
    poly=next;if(!poly.length)break;
  }
  return poly.filter(v=>v[3]>1e-7);
}
export function clipLine(a,b){
  let lo=0,hi=1;
  for(const [axis,sign] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){
    const da=a[3]+sign*a[axis],db=b[3]+sign*b[axis];
    if(da<0&&db<0)return [];
    if((da<0)!==(db<0)){const t=da/(da-db);if(da<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}
  }
  if(lo>hi)return [];
  return [lo,hi].map(t=>a.map((x,i)=>x+(b[i]-x)*t)).filter(v=>v[3]>1e-7);
}
export async function detectGPU(){
  if(typeof navigator==='undefined'||!navigator.gpu||typeof WebAssembly==='undefined')return null;
  try{const a=await navigator.gpu.requestAdapter({powerPreference:'low-power'});
    return a&&!a.isFallbackAdapter&&!a.info?.isFallbackAdapter?a:null;
  }catch{return null;}
}
export class OptionalRenderer{
  constructor(canvas,{onMode=()=>{}}={}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    if(!this.ctx)throw new Error('Canvas 2D unavailable');
    this.onMode=onMode;this.meshes=new Map();this.gpu=null;this.generation=0;
    this.active=false;this.disposed=false;this.calls={drawCalls:0,uploadedBytes:0,skippedIdentical:0,frames:0};
  }
  get mode(){return this.gpu?'webgpu-wasm':'cpu';}
  available(){if(this.disposed)throw new Error('renderer disposed');}
  async enableGPU(){
    this.available();const token=++this.generation;
    let candidate;
    try{
      const adapter=await detectGPU();if(!adapter)throw new Error('No compatible physical GPU');
      const {Backend}=await import('./webgpu.js');
      candidate=await Backend.create(this.canvas,adapter,()=>{if(this.gpu===candidate)this.useCPU();});
      if(this.disposed||token!==this.generation){candidate.dispose();return false;}
      this.gpu?.dispose();this.gpu=candidate;this.onMode(this.mode);return true;
    }catch(error){candidate?.dispose();if(token===this.generation)this.useCPU();throw error;}
  }
  useCPU(){++this.generation;this.gpu?.dispose();this.gpu=null;this.active=false;this.onMode(this.mode);}
  createMesh(data,mode='triangles'){
    this.available();if(this.meshes.size>=MAX_MESHES)throw new RangeError('mesh budget exceeded');
    const values=packedVertices(data,mode),handle=Object.freeze({});
    this.meshes.set(handle,{data:values,mode,revision:1,projected:new Float32Array(values.length/6*7)});return handle;
  }
  updateMesh(handle,data){
    this.available();const mesh=this.meshes.get(handle);if(!mesh)throw new TypeError('foreign mesh');
    const values=packedVertices(data,mesh.mode),a=new Uint32Array(values.buffer),b=new Uint32Array(mesh.data.buffer);
    if(a.length===b.length&&a.every((x,i)=>x===b[i])){this.calls.skippedIdentical++;return false;}
    mesh.data=values;mesh.revision++;mesh.projected=new Float32Array(values.length/6*7);return true;
  }
  deleteMesh(handle){const m=this.meshes.get(handle);if(m)this.gpu?.release(m);this.meshes.delete(handle);}
  beginFrame({vp=identity(),fog=0}={}){
    this.available();if(this.active)throw new Error('endFrame required');
    if(vp.length!==16||!Array.from(vp).every(Number.isFinite)||!Number.isFinite(fog)||fog<0)throw new RangeError('invalid camera');
    this.vp=Float32Array.from(vp);if(!this.vp.every(Number.isFinite))throw new RangeError('camera overflow');
    this.fog=fog;this.primitives=[];this.active=true;
    this.ctx.fillStyle='#050a14';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
  }
  draw(handle){
    if(!this.active)throw new Error('beginFrame required');
    const mesh=this.meshes.get(handle);if(!mesh)throw new TypeError('foreign mesh');
    this.primitives.push(mesh);this.calls.drawCalls++;
  }
  endFrame(){
    if(!this.active)throw new Error('beginFrame required');this.active=false;
    if(this.gpu){try{this.gpu.render(this.primitives,this.vp,this.fog);this.calls.frames++;return;}
      catch{this.useCPU();}}
    const draw=[],w=this.canvas.width,h=this.canvas.height,ctx=this.ctx;
    for(const m of this.primitives){
      const p=projectVertices(m.data,this.vp,m.projected),size=sizes[m.mode];
      for(let i=0;i<p.length;i+=size*7){
        const original=Array.from({length:size},(_,j)=>Array.from(p.subarray(i+j*7,i+j*7+7)));
        let poly=size===2?clipLine(...original):clipPolygon(original);if(poly.length<size)continue;
        // A clipped line polygon may include the same intersection twice.
        if(size===2)poly=[poly[0],poly[poly.length-1]];
        const depth=poly.reduce((s,v)=>s+v[2]/v[3],0)/poly.length;
        draw.push({poly,size,depth});
      }
    }
    draw.sort((a,b)=>b.depth-a.depth);
    for(const {poly,size} of draw){
      const c=poly[0],k=Math.exp(-Math.max(0,c[3])*this.fog);
      ctx.fillStyle=ctx.strokeStyle=`rgb(${c.slice(4).map(v=>Math.round(Math.max(0,Math.min(1,v*k))*255)).join(',')})`;
      const xy=v=>[(v[0]/v[3]+1)*w/2,(1-v[1]/v[3])*h/2];
      if(size===1){const [x,y]=xy(c);ctx.fillRect(x,y,2,2);continue;}
      ctx.beginPath();ctx.moveTo(...xy(c));for(const v of poly.slice(1))ctx.lineTo(...xy(v));
      if(size===2)ctx.stroke();else{ctx.closePath();ctx.fill();}
    }
    this.calls.frames++;
  }
  stats(){return {...this.calls,mode:this.mode,meshes:this.meshes.size};}
  dispose(){if(this.disposed)return;this.useCPU();this.meshes.clear();this.disposed=true;}
}
