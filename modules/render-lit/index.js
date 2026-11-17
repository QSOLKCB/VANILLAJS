// SPDX-License-Identifier: Apache-2.0
// HORIZON-004: optional native WebGL1 materials. Existing Renderer is unchanged.
import {perspective,viewMatrix,multiplyMatrices,rotate} from '../math/index.js';

export const LIT_VERTEX_FLOATS=11;
export const LIT_PROFILES=Object.freeze({
  low:Object.freeze({resolution:.7,maxPixels:1048576,maxVertices:180000,maxMeshes:128,maxDraws:128}),
  high:Object.freeze({resolution:1,maxPixels:2073600,maxVertices:600000,maxMeshes:256,maxDraws:256})
});
const IDENTITY=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const PATTERNS=Object.freeze(['none','asphalt','stone','grass','glass','shadow']);
const own=(v,k)=>Object.hasOwn(v,k);
const typedLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Float32Array.prototype),'length').get;
function record(value,keys,label){
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError(label+' must be a plain record');
  for(const k of Reflect.ownKeys(value))if(typeof k!=='string'||!keys.includes(k)||!own(Object.getOwnPropertyDescriptor(value,k),'value'))throw TypeError(label+' has an unknown or accessor field');
  return value;
}
function number(v,min,max,label){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw RangeError(label+' out of bounds');return v===0?0:v;}
function vector(value,length,min,max,label){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length!==length||Reflect.ownKeys(value).length!==length+1)throw TypeError(label+' must be a dense ordinary array');
  const out=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!own(d,'value'))throw TypeError(label+' has holes/accessors');out.push(number(d.value,min,max,label));}return out;
}
function option(value,key,fallback){return own(value,key)?value[key]:fallback;}
export function validateLitMaterial(value={}){
  record(value,['color','roughness','metalness','opacity','emission','pattern','patternScale'],'material');
  const pattern=option(value,'pattern','none');if(!PATTERNS.includes(pattern))throw RangeError('unsupported material pattern');
  return Object.freeze({color:Object.freeze(vector(option(value,'color',[1,1,1]),3,0,1,'material color')),
    roughness:number(option(value,'roughness',.7),.04,1,'roughness'),metalness:number(option(value,'metalness',0),0,1,'metalness'),
    opacity:number(option(value,'opacity',1),0,1,'opacity'),emission:number(option(value,'emission',0),0,4,'emission'),pattern,
    patternScale:number(option(value,'patternScale',1),.01,256,'patternScale')});
}
function transform(value){
  const typed=(value instanceof Float32Array&&Object.getPrototypeOf(value)===Float32Array.prototype)||(value instanceof Float64Array&&Object.getPrototypeOf(value)===Float64Array.prototype);
  if(typed&&(typedLength.call(value)!==16||Reflect.ownKeys(value).length!==16))throw TypeError('model matrix requires exactly 16 data components');
  const m=vector(typed?Array.from({length:16},(_,i)=>value[i]):value,16,-10000,10000,'model matrix');
  if(m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)throw RangeError('model matrix must be affine');
  const a=m.slice(0,3),b=m.slice(4,7),c=m.slice(8,11);
  const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const bc=cross(b,c),ca=cross(c,a),ab=cross(a,b),det=a.reduce((sum,x,i)=>sum+x*bc[i],0);
  if(!Number.isFinite(det)||Math.abs(det)<1e-10)throw RangeError('model transform is singular');
  const normals=[...bc,...ca,...ab].map(x=>number(x/det,-1e5,1e5,'inverse transpose'));
  return {matrix:m,normals};
}
export function litNormalMatrix(matrix){return Object.freeze(transform(matrix).normals);}
function vertices(source,max){
  const typed=source instanceof Float32Array&&Object.getPrototypeOf(source)===Float32Array.prototype;
  if(!typed&&(!Array.isArray(source)||Object.getPrototypeOf(source)!==Array.prototype))throw TypeError('vertices must be an ordinary array or Float32Array');
  const length=typed?typedLength.call(source):source.length;
  if(length%33!==0||length/11>max)throw RangeError('vertices require bounded complete XYZ/normal/RGB/UV triangles');
  if(Reflect.ownKeys(source).length!==length+(typed?0:1))throw TypeError('vertices have extra properties or holes');
  const out=new Float32Array(length);
  for(let i=0;i<length;i++){
    const field=typed?null:Object.getOwnPropertyDescriptor(source,String(i));if(!typed&&(!field||!own(field,'value')))throw TypeError('vertices have accessors or holes');
    const slot=i%11;out[i]=number(typed?source[i]:field.value,slot>=6&&slot<=8?0:-10000,slot>=6&&slot<=8?1:10000,'vertex');
    if(slot===5){const length=Math.hypot(out[i-2],out[i-1],out[i]);if(length<.5||length>1.5)throw RangeError('normal must have near-unit nonzero length');}
  }
  return out;
}
const vertex=`attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute vec2 uv;
uniform mat4 vp;uniform mat4 model;uniform mat3 normalMatrix;
varying vec3 world;varying vec3 surfaceNormal;varying vec3 tint;varying vec2 texcoord;
void main(){vec4 p=model*vec4(position,1.0);world=p.xyz;surfaceNormal=normalize(normalMatrix*normal);tint=color;texcoord=uv;gl_Position=vp*p;}`;
const precision=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
const fragment=precision+`varying vec3 world;varying vec3 surfaceNormal;varying vec3 tint;varying vec2 texcoord;
uniform vec3 eye;uniform vec3 sunDirection;uniform vec3 sunColor;uniform vec3 skyTop;uniform vec3 skyBottom;uniform vec3 fogColor;
uniform vec3 baseColor;uniform float ambient;uniform float roughness;uniform float metalness;uniform float opacity;uniform float emission;uniform float pattern;uniform float patternScale;uniform float fogDensity;uniform float exposure;uniform float detail;
// Bounded arithmetic, including mediump fallback: no large sine hash products.
float grain(vec2 p){vec2 q=fract(mod(p,127.0)*vec2(0.173,0.237));float h=fract((q.x+0.37)*(q.y+0.61)*31.7);return fract(h*17.3);}
// Four corners share the same two lattice coordinates on each axis.
float softNoise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);vec4 q=fract(mod(vec4(a,a+1.0),127.0)*vec4(0.173,0.237,0.173,0.237));vec4 h=fract((q.xzxz+0.37)*(q.yyww+0.61)*31.7);vec4 g=fract(h*17.3);return mix(mix(g.x,g.y,f.x),mix(g.z,g.w,f.x),f.y);}
vec3 reflectedEnvironment(vec3 direction,float finish){
  float height=direction.y;vec3 sky=mix(skyBottom,skyTop,smoothstep(0.03,0.85,height));
  vec3 ground=skyBottom*vec3(0.22,0.25,0.23);
  vec3 environment=mix(ground,sky,smoothstep(-0.18,0.06,height));
  // A broad analytic horizon reflection reveals curvature without scene textures.
  float horizon=1.0-smoothstep(0.0,0.22,abs(height));
  return environment+skyBottom*horizon*0.16*finish;
}
void main(){
  vec3 n=normalize(surfaceNormal);vec3 delta=eye-world;float distanceToEye=length(delta);vec3 v=normalize(delta+vec3(0.00001));
  vec3 light=normalize(sunDirection);float diffuse=max(dot(n,light),0.0);vec3 base=tint*baseColor;
  vec2 tex=texcoord*patternScale;float variation=1.0;
  if(pattern>0.5&&pattern<1.5){
    variation=0.92+0.08*softNoise(tex*2.7);
    if(detail>0.5)variation+=(grain(floor(tex*113.0))-0.5)*0.035*(1.0-smoothstep(8.0,55.0,distanceToEye));
  }
  if(pattern>1.5&&pattern<2.5){
    vec2 brick=tex;brick.x+=floor(brick.y)*0.5;vec2 edge=min(fract(brick),1.0-fract(brick));
    float mortar=smoothstep(0.015,0.055,min(edge.x,edge.y));variation=mix(0.72,0.92+0.08*softNoise(tex*3.0),mortar);
  }
  if(pattern>2.5&&pattern<3.5){
    float field=softNoise(tex*0.55);variation=0.86+0.20*field;
    if(detail>0.5)variation+=(softNoise(tex*3.7+vec2(17.2,9.4))-0.5)*0.055;
    // Continuous earth/vegetation tones, with a subtle dry tint on steep slopes.
    base*=mix(vec3(0.91,0.97,0.88),vec3(1.07,1.025,0.94),field);
    base=mix(base,base*vec3(1.11,0.91,0.82),smoothstep(0.35,0.8,1.0-abs(n.y))*0.28);
  }
  base*=variation;
  vec3 halfDirection=normalize(light+v+vec3(0.00001));float power=mix(160.0,4.0,roughness*roughness);
  float spec=pow(max(dot(n,halfDirection),0.0),power)*diffuse*(1.0-roughness*0.65);
  float fresnel=pow(1.0-max(dot(n,v),0.0),5.0);
  vec3 reflected=reflect(-v,n);vec3 environment=reflectedEnvironment(reflected,1.0-roughness);
  vec3 finish=mix(vec3(0.04),base,metalness);finish=mix(finish,vec3(1.0),fresnel);
  vec3 ambientLight=ambient*mix(vec3(0.72,0.70,0.66),vec3(1.02,1.04,1.08),n.y*0.5+0.5);
  vec3 rgb=base*(ambientLight+diffuse*sunColor*(1.0-metalness*0.50))+spec*sunColor*mix(vec3(0.4),base,metalness);
  rgb+=environment*finish*(0.25+(1.0-roughness)*0.42);
  if(roughness<0.6&&pattern<0.5){
    float coat=(1.0-roughness)*(1.0-roughness);
    rgb+=environment*(0.025+0.18*fresnel)*coat;
    if(detail>0.5)rgb+=sunColor*pow(max(dot(n,halfDirection),0.0),192.0)*diffuse*coat*0.15;
  }
  rgb+=base*emission;
  float alpha=opacity;
  if(pattern>3.5&&pattern<4.5){rgb=mix(base*(ambientLight+diffuse*0.25),environment,0.46+0.48*fresnel)+spec*sunColor;alpha=opacity+(1.0-opacity)*fresnel*0.45;}
  if(pattern>4.5){float radius=length((texcoord-vec2(0.5))*2.0);alpha*=1.0-smoothstep(0.15,1.0,radius);rgb=base;}
  float fogAmount=1.0-exp(-distanceToEye*fogDensity);rgb=mix(rgb,fogColor,fogAmount);
  gl_FragColor=vec4(clamp(rgb*exposure,0.0,1.0),alpha);
}`;
const skyVertex=`attribute vec2 position;varying vec2 screen;void main(){screen=position;gl_Position=vec4(position,0.999,1.0);}`;
const skyFragment=precision+`varying vec2 screen;uniform vec3 right;uniform vec3 up;uniform vec3 back;uniform float aspect;uniform float tangent;uniform vec3 skyTop;uniform vec3 skyBottom;uniform vec3 sunDirection;uniform vec3 sunColor;uniform float exposure;
void main(){vec3 direction=normalize(right*screen.x*aspect*tangent+up*screen.y*tangent-back);float height=smoothstep(-0.08,0.78,direction.y);vec3 sky=mix(skyBottom,skyTop,height);float sun=max(dot(direction,normalize(sunDirection)),0.0);float haze=pow(sun,12.0)*0.045*(1.0-height);sky+=sunColor*(haze+pow(sun,64.0)*0.10+smoothstep(0.9992,0.9997,sun)*0.9);gl_FragColor=vec4(clamp(sky*exposure,0.0,1.0),1.0);}`;
function program(gl,vsSource,fsSource){
  let vs=null,fs=null,p=null;
  const shader=(type,source)=>{const s=gl.createShader(type);if(!s)throw Error('Shader allocation failed');try{gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader compile failed: '+gl.getShaderInfoLog(s));return s;}catch(error){gl.deleteShader(s);throw error;}};
  try{vs=shader(gl.VERTEX_SHADER,vsSource);fs=shader(gl.FRAGMENT_SHADER,fsSource);p=gl.createProgram();if(!p)throw Error('Program allocation failed');gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Program link failed: '+gl.getProgramInfoLog(p));return p;}
  catch(error){if(p)gl.deleteProgram(p);throw error;}finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
}
function upload(gl,data){
  const b=gl.createBuffer();if(!b)throw Error('Buffer allocation failed');
  try{gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('GPU buffer upload failed ('+error+')');return b;}catch(error){gl.deleteBuffer(b);throw error;}
}
function frame(position,orientation,settings){
  record(settings,['fov','near','far','ambient','sunDirection','sunColor','skyTop','skyBottom','fogColor','fogDensity','exposure'],'frame');
  const eye=vector(position,3,-10000,10000,'camera position'),q=vector(orientation,4,-1,1,'camera orientation');
  if(Math.abs(Math.hypot(...q)-1)>1e-5)throw RangeError('camera orientation must be a unit quaternion');
  const dir=vector(option(settings,'sunDirection',[.4,.8,.25]),3,-1,1,'sun direction'),length=Math.hypot(...dir);if(length<1e-6)throw RangeError('sun direction cannot be zero');
  const near=number(option(settings,'near',.1),.01,100,'near'),far=number(option(settings,'far',2000),1,5000,'far');if(far<=near)throw RangeError('far must exceed near');
  return {eye,q,near,far,fov:number(option(settings,'fov',1),.2,2.5,'field of view'),ambient:number(option(settings,'ambient',.32),0,2,'ambient'),
    sunDirection:dir.map(v=>v/length),sunColor:vector(option(settings,'sunColor',[1,.92,.78]),3,0,2,'sun color'),
    skyTop:vector(option(settings,'skyTop',[.12,.32,.52]),3,0,1,'sky top'),skyBottom:vector(option(settings,'skyBottom',[.68,.79,.79]),3,0,1,'sky bottom'),
    fogColor:vector(option(settings,'fogColor',[.66,.75,.76]),3,0,1,'fog color'),fogDensity:number(option(settings,'fogDensity',.003),0,.1,'fog density'),exposure:number(option(settings,'exposure',1),.1,3,'exposure')};
}

export class LitRenderer {
  #meshes=new Map();#profile;#pixelRatio;#program=null;#sky=null;#skyBuffer=null;#locations;#skyLocations;#lost=false;#disposed=false;#onLost;#begun=false;#stats={frames:0,frameDraws:0,totalDraws:0,uploads:0,skippedIdentical:0,vertices:0,bytes:0};
  constructor(canvas,options={}){
    record(options,['profile','pixelRatio'],'renderer options');const profile=option(options,'profile','high');if(typeof profile!=='string'||!own(LIT_PROFILES,profile))throw RangeError('unknown rendering profile');this.#profile=profile;this.#pixelRatio=number(option(options,'pixelRatio',1),.5,2,'pixel ratio');
    if(!canvas||typeof canvas.getContext!=='function'||typeof canvas.getBoundingClientRect!=='function'||typeof canvas.addEventListener!=='function'||typeof canvas.removeEventListener!=='function')throw TypeError('owned HTML canvas required');
    this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});if(!gl)throw Error('WebGL is unavailable');this.gl=gl;
    try{
      this.#program=program(gl,vertex,fragment);this.#sky=program(gl,skyVertex,skyFragment);this.#skyBuffer=upload(gl,new Float32Array([-1,-1,3,-1,-1,3]));
      this.#locations={};for(const name of ['position','normal','color','uv'])this.#locations[name]=gl.getAttribLocation(this.#program,name);
      for(const name of ['vp','model','normalMatrix','eye','sunDirection','sunColor','skyTop','skyBottom','fogColor','baseColor','ambient','roughness','metalness','opacity','emission','pattern','patternScale','fogDensity','exposure','detail'])this.#locations[name]=gl.getUniformLocation(this.#program,name);
      this.#skyLocations={position:gl.getAttribLocation(this.#sky,'position')};for(const name of ['right','up','back','aspect','tangent','skyTop','skyBottom','sunDirection','sunColor','exposure'])this.#skyLocations[name]=gl.getUniformLocation(this.#sky,name);
      this.#onLost=event=>{event.preventDefault();this.#lost=true;this.#begun=false;};canvas.addEventListener('webglcontextlost',this.#onLost);
    }catch(error){if(this.#skyBuffer)gl.deleteBuffer(this.#skyBuffer);if(this.#sky)gl.deleteProgram(this.#sky);if(this.#program)gl.deleteProgram(this.#program);throw error;}
  }
  get lost(){return this.#lost||this.gl.isContextLost();}
  #ready(){if(this.#disposed)throw Error('Renderer is disposed');if(this.lost)throw Error('WebGL context lost; recreate the renderer after restoration');}
  #owned(handle){const mesh=this.#meshes.get(handle);if(!mesh)throw TypeError('unknown, deleted or foreign mesh');return mesh;}
  mesh(source){
    this.#ready();const limits=LIT_PROFILES[this.#profile];if(this.#meshes.size>=limits.maxMeshes)throw RangeError('mesh budget exceeded');
    const data=vertices(source,limits.maxVertices-this.#stats.vertices),buffer=upload(this.gl,data),handle=Object.freeze({});this.#meshes.set(handle,{buffer,data,count:data.length/11});this.#stats.vertices+=data.length/11;this.#stats.bytes+=data.byteLength;this.#stats.uploads++;return handle;
  }
  update(handle,source){
    this.#ready();const mesh=this.#owned(handle),data=vertices(source,LIT_PROFILES[this.#profile].maxVertices-this.#stats.vertices+mesh.count);
    if(data.length===mesh.data.length&&data.every((v,i)=>Object.is(v,mesh.data[i]))){this.#stats.skippedIdentical++;return false;}
    const buffer=upload(this.gl,data);this.gl.deleteBuffer(mesh.buffer);this.#stats.vertices+=data.length/11-mesh.count;this.#stats.bytes+=data.byteLength-mesh.data.byteLength;this.#meshes.set(handle,{buffer,data,count:data.length/11});this.#stats.uploads++;return true;
  }
  deleteMesh(handle){if(this.#disposed)throw Error('Renderer is disposed');const mesh=this.#owned(handle);if(!this.lost)this.gl.deleteBuffer(mesh.buffer);this.#meshes.delete(handle);this.#stats.vertices-=mesh.count;this.#stats.bytes-=mesh.data.byteLength;}
  begin(position,orientation,settings={}){
    this.#ready();const f=frame(position,orientation,settings),rect=this.canvas.getBoundingClientRect(),limits=LIT_PROFILES[this.#profile];
    const cssWidth=number(rect.width,0,10000,'canvas width'),cssHeight=number(rect.height,0,10000,'canvas height');
    let width=Math.max(1,Math.floor(cssWidth*this.#pixelRatio*limits.resolution)),height=Math.max(1,Math.floor(cssHeight*this.#pixelRatio*limits.resolution));
    const reduction=Math.min(1,Math.sqrt(limits.maxPixels/(width*height)));width=Math.max(1,Math.floor(width*reduction));height=Math.max(1,Math.floor(height*reduction));
    const aspect=width/height,vp=multiplyMatrices(perspective(f.fov,aspect,f.near,f.far),viewMatrix(f.eye,f.q));
    const gl=this.gl;if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;
    gl.viewport(0,0,width,height);gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true);gl.depthMask(true);gl.clearDepth(1);gl.clearColor(...f.skyBottom,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.depthMask(false);gl.useProgram(this.#sky);const s=this.#skyLocations;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.#skyBuffer);gl.enableVertexAttribArray(s.position);gl.vertexAttribPointer(s.position,2,gl.FLOAT,false,8,0);
    for(const [name,value] of [['right',rotate(f.q,[1,0,0])],['up',rotate(f.q,[0,1,0])],['back',rotate(f.q,[0,0,1])],['skyTop',f.skyTop],['skyBottom',f.skyBottom],['sunDirection',f.sunDirection],['sunColor',f.sunColor]])gl.uniform3fv(s[name],value);
    gl.uniform1f(s.aspect,aspect);gl.uniform1f(s.tangent,Math.tan(f.fov/2));gl.uniform1f(s.exposure,f.exposure);gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(s.position);
    gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(this.#program);const u=this.#locations;gl.uniformMatrix4fv(u.vp,false,vp);
    for(const name of ['sunDirection','sunColor','skyTop','skyBottom','fogColor'])gl.uniform3fv(u[name],f[name]);gl.uniform3fv(u.eye,f.eye);
    for(const name of ['ambient','fogDensity','exposure'])gl.uniform1f(u[name],f[name]);gl.uniform1f(u.detail,this.#profile==='high'?1:0);
    this.#begun=true;this.#stats.frames++;this.#stats.frameDraws=0;
  }
  draw(handle,options={}){
    this.#ready();const mesh=this.#owned(handle);if(!this.#begun)throw Error('begin must precede draw');record(options,['matrix','material'],'draw options');
    const t=transform(option(options,'matrix',IDENTITY)),m=validateLitMaterial(option(options,'material',{}));
    if(this.#stats.frameDraws>=LIT_PROFILES[this.#profile].maxDraws)throw RangeError('frame draw budget exceeded');
    const gl=this.gl,u=this.#locations;gl.useProgram(this.#program);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    for(const [name,count,offset]of [['position',3,0],['normal',3,12],['color',3,24],['uv',2,36]]){gl.enableVertexAttribArray(u[name]);gl.vertexAttribPointer(u[name],count,gl.FLOAT,false,44,offset);}
    gl.uniformMatrix4fv(u.model,false,t.matrix);gl.uniformMatrix3fv(u.normalMatrix,false,t.normals);gl.uniform3fv(u.baseColor,m.color);
    for(const name of ['roughness','metalness','opacity','emission','patternScale'])gl.uniform1f(u[name],m[name]);gl.uniform1f(u.pattern,PATTERNS.indexOf(m.pattern));
    const translucent=m.opacity<1||m.pattern==='glass'||m.pattern==='shadow';
    if(translucent){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else{gl.disable(gl.BLEND);gl.depthMask(true);}
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);this.#stats.frameDraws++;this.#stats.totalDraws++;
    for(const name of ['position','normal','color','uv'])gl.disableVertexAttribArray(u[name]);gl.depthMask(true);
  }
  stats(){return Object.freeze({...this.#stats,meshes:this.#meshes.size,profile:this.#profile,lost:this.lost,disposed:this.#disposed});}
  dispose(){
    if(this.#disposed)return;this.canvas.removeEventListener('webglcontextlost',this.#onLost);if(!this.lost){for(const mesh of this.#meshes.values())this.gl.deleteBuffer(mesh.buffer);this.gl.deleteBuffer(this.#skyBuffer);this.gl.deleteProgram(this.#sky);this.gl.deleteProgram(this.#program);}this.#meshes.clear();this.#stats.vertices=0;this.#stats.bytes=0;this.#begun=false;this.#disposed=true;
  }
}
