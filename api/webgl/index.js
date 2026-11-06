// SPDX-License-Identifier: Apache-2.0
// QSOL explicit WebGL1 API: XYZ/RGB, retained meshes, exact upload reuse.
// Owns one WebGL context. No scene graph, global cache, runtime dependency,
// clock, ambient random number generator or automatic GPU/browser fallback.
const VS = `attribute vec3 position;attribute vec3 color;uniform mat4 vp;
uniform float pointSize;varying vec3 tint;varying float cameraDistance;
void main(){gl_Position=vp*vec4(position,1.0);tint=color;
cameraDistance=gl_Position.w;gl_PointSize=pointSize;}`;
const FS = `precision mediump float;varying vec3 tint;varying float cameraDistance;
uniform float fog;void main(){float f=exp(-max(0.0,cameraDistance)*fog);
gl_FragColor=vec4(mix(vec3(0.018,0.03,0.05),tint,f),1.0);}`;
const IDENTITY = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const STRIDE = 24;

function vertices(data){
  if(!Array.isArray(data)&&!(data instanceof Float32Array))
    throw new TypeError('vertices must be an array or Float32Array');
  if(data.length%6!==0)throw new RangeError('vertices must contain whole XYZ/RGB sextets');
  for(let i=0;i<data.length;i++){
    if(typeof data[i]!=='number'||!Number.isFinite(data[i]))
      throw new RangeError('nonfinite or nonnumeric vertex '+i);
  }
  const packed=data instanceof Float32Array?data:Float32Array.from(data);
  if(!packed.every(Number.isFinite))throw new RangeError('Float32 conversion overflow');
  return packed;
}
function matrix(data){
  if(!Array.isArray(data)&&!(data instanceof Float32Array))
    throw new TypeError('vp must be an array or Float32Array');
  if(data.length!==16)throw new RangeError('vp must have 16 matrix floats');
  for(let i=0;i<16;i++)if(typeof data[i]!=='number'||!Number.isFinite(data[i]))
    throw new RangeError('nonfinite or nonnumeric vp coefficient');
  const packed=data instanceof Float32Array?data:Float32Array.from(data);
  if(!packed.every(Number.isFinite))throw new RangeError('Float32 vp conversion overflow');
  return packed;
}
const equalBytes=(a,b)=>{
  if(!a||a.length!==b.length)return false;
  const A=new Uint32Array(a.buffer,a.byteOffset,a.length);
  const B=new Uint32Array(b.buffer,b.byteOffset,b.length);
  for(let i=0;i<A.length;i++)if(A[i]!==B[i])return false;
  return true;
};
function shader(gl,type,source){
  const obj=gl.createShader(type);
  if(!obj)throw Error('WebGL shader allocation failed');
  try{
    gl.shaderSource(obj,source);gl.compileShader(obj);
    if(!gl.getShaderParameter(obj,gl.COMPILE_STATUS))
      throw Error('WebGL shader compilation failed: '+gl.getShaderInfoLog(obj));
    return obj;
  }catch(err){gl.deleteShader(obj);throw err;}
}
const snapshot=values=>new Float32Array(values);

/** Explicit, WebGL1-only retained XYZ/RGB GPU command layer.
 * Public gl is for inspection; call invalidateState() after ANY external
 * context state mutation. Never share this context with another renderer.
 * A WebGL context loss requires discarding/rebuilding the entire API object. */
export class WebGLAPI {
  #meshes=new Map();#bound=null;#programBound=false;#viewport=null;#vp=null;
  #fog=null;#pointSize=null;#active=false;#disposed=false;
  #calls={bufferData:0,bufferSubData:0,bindBuffer:0,uploadedBytes:0,
    skippedIdentical:0,drawCalls:0,drawnVertices:0,uniformUploads:0,
    programBinds:0,viewportCalls:0,clearCalls:0};
  constructor(canvas){
    if(!canvas||typeof canvas.getContext!=='function')
      throw new TypeError('canvas with getContext required');
    const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
    if(!gl)throw Error('WebGL1 unavailable; no automatic software or WebGL2 substitution');
    this.canvas=canvas;this.gl=gl; // Context is deliberately explicit.
    let vertex,fragment,program;
    try{
      vertex=shader(gl,gl.VERTEX_SHADER,VS);fragment=shader(gl,gl.FRAGMENT_SHADER,FS);
      program=gl.createProgram();
      if(!program)throw Error('WebGL program allocation failed');
      gl.attachShader(program,vertex);gl.attachShader(program,fragment);
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('WebGL program link failed: '+gl.getProgramInfoLog(program));
      this.program=program;
      this.position=gl.getAttribLocation(program,'position');
      this.color=gl.getAttribLocation(program,'color');
      this.uniformVP=gl.getUniformLocation(program,'vp');
      this.uniformFog=gl.getUniformLocation(program,'fog');
      this.uniformPoint=gl.getUniformLocation(program,'pointSize');
      if(this.position<0||this.color<0||this.uniformVP===null||
         this.uniformFog===null||this.uniformPoint===null)
        throw Error('missing required WebGL shader bindings');
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(.018,.03,.05,1);
    }catch(err){
      if(program)gl.deleteProgram(program);
      throw err;
    }finally{
      if(vertex)gl.deleteShader(vertex);
      if(fragment)gl.deleteShader(fragment);
    }
  }
  #available(){
    if(this.#disposed)throw Error('WebGLAPI already disposed');
    if(this.gl.isContextLost?.())throw Error('WebGL context lost; rebuild explicitly');
  }
  #owned(handle){
    this.#available();
    const info=this.#meshes.get(handle);
    if(!info)throw new TypeError('unknown, deleted or foreign mesh handle');
    return info;
  }
  #bind(buffer){
    if(this.#bound!==buffer){
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);
      this.#bound=buffer;this.#calls.bindBuffer++;
    }
  }
  #alloc(info,values){
    this.#bind(info.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER,values,this.gl.DYNAMIC_DRAW);
    this.#calls.bufferData++;this.#calls.uploadedBytes+=values.byteLength;
    info.capacity=values.byteLength;
  }
  createMesh(data,primitive='triangles'){
    this.#available();
    const values=vertices(data);
    const modes={triangles:this.gl.TRIANGLES,lines:this.gl.LINES,points:this.gl.POINTS};
    if(!Object.hasOwn(modes,primitive))throw new RangeError('invalid primitive');
    const buffer=this.gl.createBuffer();
    if(!buffer)throw Error('WebGL buffer allocation failed');
    const info={buffer,mode:modes[primitive],capacity:0,count:0,mirror:null,dirty:false};
    try{
      this.#alloc(info,values);
      info.mirror=snapshot(values);info.count=values.length/6;
    }catch(err){
      info.dirty=true;this.#bound=null;this.gl.deleteBuffer(buffer);
      throw err;
    }
    const handle=Object.freeze({});
    this.#meshes.set(handle,info);
    return handle;
  }
  /** Full update: exact float32-byte comparison, one retained storage slot.
   * Never cache by object identity: a mutable typed view can change in place.
   * Failed GPU writes do not publish new CPU mirrors or counts. */
  updateMesh(handle,data){
    const info=this.#owned(handle),values=vertices(data);
    if(!info.dirty&&equalBytes(info.mirror,values)){
      this.#calls.skippedIdentical++;return false;
    }
    try{
      if(info.dirty||values.byteLength>info.capacity){
        this.#alloc(info,values);
      }else if(values.length){
        this.#bind(info.buffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,values);
        this.#calls.bufferSubData++;this.#calls.uploadedBytes+=values.byteLength;
      }
      info.mirror=snapshot(values);info.count=values.length/6;info.dirty=false;
      return true;
    }catch(err){
      info.dirty=true;this.#bound=null;
      throw err;
    }
  }
  /** Dirty ranges are given in *vertices*, never bytes. */
  updateRange(handle,firstVertex,data){
    const info=this.#owned(handle),values=vertices(data);
    if(!Number.isSafeInteger(firstVertex)||firstVertex<0||
       firstVertex>info.count||values.length/6>info.count-firstVertex)
      throw new RangeError('range exceeds live vertex count');
    const old=info.mirror.subarray(firstVertex*6,firstVertex*6+values.length);
    if(!info.dirty&&equalBytes(old,values)){this.#calls.skippedIdentical++;return false;}
    try{
      if(info.dirty){
        // Restore the last *committed* full image before applying a new patch.
        this.#alloc(info,info.mirror);info.dirty=false;
      }
      if(values.length){
        this.#bind(info.buffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER,firstVertex*STRIDE,values);
        this.#calls.bufferSubData++;this.#calls.uploadedBytes+=values.byteLength;
        info.mirror.set(values,firstVertex*6);
      }
      return true;
    }catch(err){info.dirty=true;this.#bound=null;throw err;}
  }
  /** Matrices are supplied by the caller; no per-frame scene traversal or
   * implicit camera, layout, input or simulation updates are performed. */
  beginFrame({vp=IDENTITY,fog=0,pointSize=1}={}){
    this.#available();
    if(this.#active)throw Error('frame already active');
    const values=matrix(vp);
    if(typeof fog!=='number'||!Number.isFinite(fog)||fog<0)
      throw new RangeError('invalid fog');
    if(typeof pointSize!=='number'||!Number.isFinite(pointSize)||pointSize<=0)
      throw new RangeError('invalid pointSize');
    const width=this.canvas.width,height=this.canvas.height;
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)
      throw new RangeError('invalid canvas pixel dimensions');
    try{
      const gl=this.gl;
      if(!this.#programBound){
        gl.useProgram(this.program);this.#calls.programBinds++;
        gl.enableVertexAttribArray(this.position);
        gl.enableVertexAttribArray(this.color);
        this.#programBound=true;this.#bound=null;
      }
      if(!this.#viewport||this.#viewport[0]!==width||this.#viewport[1]!==height){
        gl.viewport(0,0,width,height);this.#viewport=[width,height];this.#calls.viewportCalls++;
      }
      if(!equalBytes(this.#vp,values)){
        gl.uniformMatrix4fv(this.uniformVP,false,values);
        this.#vp=snapshot(values);this.#calls.uniformUploads++;
      }
      if(!Object.is(this.#fog,fog)){
        gl.uniform1f(this.uniformFog,fog);this.#fog=fog;this.#calls.uniformUploads++;
      }
      if(!Object.is(this.#pointSize,pointSize)){
        gl.uniform1f(this.uniformPoint,pointSize);this.#pointSize=pointSize;
        this.#calls.uniformUploads++;
      }
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.#calls.clearCalls++;
      this.#active=true;
    }catch(err){
      this.invalidateState();throw err;
    }
  }
  draw(handle){
    const info=this.#owned(handle);
    if(!this.#active)throw Error('beginFrame required before draw');
    if(info.dirty)throw Error('mesh upload failed; recover before drawing');
    if(info.count===0)return false;
    const gl=this.gl;
    if(this.#bound!==info.buffer){
      this.#bind(info.buffer);
      gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,STRIDE,0);
      gl.vertexAttribPointer(this.color,3,gl.FLOAT,false,STRIDE,12);
    }
    gl.drawArrays(info.mode,0,info.count);
    this.#calls.drawCalls++;this.#calls.drawnVertices+=info.count;
    return true;
  }
  endFrame(){
    this.#available();
    if(!this.#active)throw Error('no active frame');
    this.#active=false;
  }
  /** Driver-call counters: no GPU timings, VRAM or PCIe measurements. */
  stats(){return Object.freeze({...this.#calls,liveMeshes:this.#meshes.size});}
  /** Call after changing GL state outside this API, e.g. a separate shader. */
  invalidateState(){
    this.#available();
    this.#bound=null;this.#programBound=false;this.#viewport=null;
    this.#vp=null;this.#fog=null;this.#pointSize=null;
  }
  deleteMesh(handle){
    const info=this.#owned(handle);
    this.gl.deleteBuffer(info.buffer);
    if(this.#bound===info.buffer)this.#bound=null;
    this.#meshes.delete(handle);
  }
  dispose(){
    if(this.#disposed)return;
    for(const info of this.#meshes.values())this.gl.deleteBuffer(info.buffer);
    this.#meshes.clear();
    this.gl.deleteProgram(this.program);
    this.#disposed=true;this.#active=false;this.#bound=null;
  }
}
