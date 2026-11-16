// SPDX-License-Identifier: Apache-2.0
// Owned, inert scene composition. Metres; right-handed +Y up / -Z forward.
import {quatNormalize,quatInterpolate} from '../math/index.js';
export const SCENE_GRAPH_FORMAT='qsol.vanillajs.scene-graph.v1';
export const SCENE_GRAPH_BYTES=262144;
const ID=/^[a-z][a-z0-9-]{0,31}$/,MAX_NODES=128,MAX_DEPTH=16;
const clone=x=>JSON.parse(JSON.stringify(x));
function record(value,keys,label,optional=false){
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError(label+' requires a plain data record');
  const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(descriptors);
  if(actual.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(descriptors[k],'value')||!descriptors[k].enumerable)||(!optional&&keys.some(k=>!Object.hasOwn(descriptors,k))))throw new TypeError(label+' has missing, unknown or executable fields');
}
function list(value,max,label){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)throw new RangeError(label+' exceeds array budget');
  const keys=Reflect.ownKeys(value);if(keys.length!==value.length+1)throw new TypeError(label+' must be dense plain data');
  for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw new TypeError(label+' contains executable or missing data');}
  return value;
}
function number(v,min,max,label){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new RangeError(label+' out of range');return v;}
function vector(v,n,min,max,label){list(v,n,label);if(v.length!==n)throw new TypeError(label+' length');return v.map(x=>number(x,min,max,label));}
function id(v,label){if(typeof v!=='string'||!ID.test(v))throw new TypeError(label+' invalid ID');return v;}
function text(v,label){if(typeof v!=='string'||!v.trim()||v.length>64||/[\u0000-\u001f\u007f]/.test(v))throw new TypeError(label+' requires bounded plain text');return v;}
function bool(v){if(typeof v!=='boolean')throw new TypeError('boolean required');return v;}
function transform(value){
  record(value,['position','rotation','scale'],'transform');
  const rotation=vector(value.rotation,4,-1,1,'quaternion');
  if(Math.abs(Math.hypot(...rotation)-1)>1e-6)throw new RangeError('unit xyzw quaternion required');
  return {position:vector(value.position,3,-1000,1000,'position'),rotation,scale:vector(value.scale,3,.01,100,'scale')};
}
function components(value){
  record(value,['mesh','appearance','camera','light'],'components');
  record(value.mesh,['enabled'],'mesh');record(value.appearance,['color','roughness'],'appearance');
  let camera=null,light=null;
  if(value.camera!==null){const c=value.camera;record(c,['fov','near','far'],'camera');camera={fov:number(c.fov,.2,2.2,'camera FOV'),near:number(c.near,.001,100,'near'),far:number(c.far,.01,10000,'far')};if(camera.far<=camera.near)throw new RangeError('camera clipping order');}
  if(value.light!==null){const l=value.light;record(l,['kind','color','intensity'],'light');if(!['ambient','directional'].includes(l.kind))throw new TypeError('light kind');light={kind:l.kind,color:vector(l.color,3,0,1,'light colour'),intensity:number(l.intensity,0,4,'light intensity')};}
  return {mesh:{enabled:bool(value.mesh.enabled)},appearance:{color:vector(value.appearance.color,3,0,1,'colour'),roughness:number(value.appearance.roughness,0,1,'roughness')},camera,light};
}
function node(value){record(value,['id','name','parent','transform','components','visible'],'node');return {id:id(value.id,'node'),name:text(value.name,'node name'),parent:value.parent===null?null:id(value.parent,'parent'),transform:transform(value.transform),components:components(value.components),visible:bool(value.visible)};}
function instance(value){record(value,['id','prefab','parent','transform'],'instance');return {id:id(value.id,'instance'),prefab:id(value.prefab,'prefab reference'),parent:value.parent===null?null:id(value.parent,'instance parent'),transform:transform(value.transform)};}
const identity=()=>({position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]});
export function sceneNode(identifier,options={}){
  record(options,['name','parent','position','rotation','scale','color','visible','camera','light','mesh','roughness'],'node options',true);
  return node({id:identifier,name:options.name??identifier,parent:options.parent??null,transform:{position:options.position??[0,0,0],rotation:options.rotation??[0,0,0,1],scale:options.scale??[1,1,1]},components:{mesh:{enabled:options.mesh??true},appearance:{color:options.color??[.4,.8,.7],roughness:options.roughness??.8},camera:options.camera??null,light:options.light??null},visible:options.visible??true});
}
export function createSceneGraph(name='Scene composition'){return validateSceneGraph({format:SCENE_GRAPH_FORMAT,version:1,name,duration:10,nodes:[],tracks:[],prefabs:[],instances:[]});}
function container(nodes,instances){
  const ids=new Map([...nodes,...instances].map(n=>[n.id,n]));if(ids.size!==nodes.length+instances.length)throw new TypeError('duplicate node/instance ID');
  for(const n of ids.values()){
    let p=n,depth=0;const seen=new Set();
    while(p){if(seen.has(p.id))throw new TypeError('parent cycle');seen.add(p.id);if(++depth>MAX_DEPTH)throw new RangeError('hierarchy depth');if(p.parent!==null&&!ids.has(p.parent))throw new TypeError('missing parent');p=ids.get(p.parent);}
  }
}
function expand(graph){
  const prefabs=new Map(graph.prefabs.map(p=>[p.id,p])),output=[];
  function append(nodes,instances,prefix,root,chain){
    const mapped=x=>x===null?root:prefix+x;
    for(const n of nodes){if(output.length>=MAX_NODES)throw new RangeError('expanded scene exceeds 128 nodes');output.push({...n,id:prefix+n.id,parent:mapped(n.parent)});}
    for(const i of instances){
      if(chain.includes(i.prefab)||chain.length>=8)throw new RangeError('prefab cycle or nesting depth');
      const p=prefabs.get(i.prefab);if(!p)throw new TypeError('missing prefab');
      if(output.length>=MAX_NODES)throw new RangeError('expanded scene exceeds 128 nodes');
      output.push({...sceneNode(i.id,{mesh:false}),id:prefix+i.id,parent:mapped(i.parent),transform:i.transform});
      append(p.nodes,p.instances,prefix+i.id+'/',prefix+i.id,[...chain,i.prefab]);
    }
  }
  append(graph.nodes,graph.instances,'',null,[]);
  const byId=new Map(output.map(n=>[n.id,n])),ordered=[],depths=new Map();
  function visit(n){if(depths.has(n.id))return;if(n.parent!==null)visit(byId.get(n.parent));const depth=n.parent===null?1:depths.get(n.parent)+1;if(depth>MAX_DEPTH)throw new RangeError('expanded hierarchy depth');depths.set(n.id,depth);ordered.push(n);}
  for(const n of output)visit(n);
  return ordered;
}
export function validateSceneGraph(input){
  if(typeof input==='string'){if(input.length>SCENE_GRAPH_BYTES||new TextEncoder().encode(input).length>SCENE_GRAPH_BYTES)throw new RangeError('scene graph exceeds 256 KiB');input=JSON.parse(input);}
  record(input,['format','version','name','duration','nodes','tracks','prefabs','instances'],'scene graph');
  if(input.format!==SCENE_GRAPH_FORMAT||input.version!==1)throw new TypeError('unsupported scene graph format/version');
  const graph={format:SCENE_GRAPH_FORMAT,version:1,name:text(input.name,'scene name'),duration:number(input.duration,.1,300,'duration'),nodes:list(input.nodes,128,'nodes').map(node),tracks:[],prefabs:[],instances:list(input.instances,16,'instances').map(instance)};
  graph.prefabs=list(input.prefabs,16,'prefabs').map(p=>{record(p,['id','nodes','instances'],'prefab');return {id:id(p.id,'prefab'),nodes:list(p.nodes,32,'prefab nodes').map(node),instances:list(p.instances,8,'nested instances').map(instance)};});
  if(new Set(graph.prefabs.map(p=>p.id)).size!==graph.prefabs.length)throw new TypeError('duplicate prefab');
  container(graph.nodes,graph.instances);for(const p of graph.prefabs)container(p.nodes,p.instances);
  // Check every definition, including unused prefabs, so dormant bad data cannot
  // become executable expansion work only when later selected in an editor.
  for(const p of graph.prefabs)expand({...graph,nodes:[],instances:[{id:'check',prefab:p.id,parent:null,transform:identity()}]});
  const expanded=expand(graph),ids=new Set(expanded.map(n=>n.id));
  graph.tracks=list(input.tracks,128,'tracks').map(t=>{
    record(t,['node','keys'],'track');if(typeof t.node!=='string'||!ids.has(t.node))throw new TypeError('track target missing');
    const keys=list(t.keys,32,'keys').map(k=>{record(k,['time','transform'],'key');return {time:number(k.time,0,graph.duration,'key time'),transform:transform(k.transform)};});
    if(!keys.length||keys.some((k,i)=>i&&k.time<=keys[i-1].time))throw new TypeError('keys require strictly increasing times');return {node:t.node,keys};
  });
  if(new Set(graph.tracks.map(t=>t.node)).size!==graph.tracks.length)throw new TypeError('duplicate node tracks');
  if(new TextEncoder().encode(JSON.stringify(graph)).length>SCENE_GRAPH_BYTES)throw new RangeError('scene graph exceeds 256 KiB');
  // Validate matrices and their inverses at key endpoints as well as base pose.
  for(const at of new Set([0,...graph.tracks.flatMap(t=>t.keys.map(k=>k.time))]))sample(graph,at);
  return graph;
}
export function serializeSceneGraph(graph){const clean=validateSceneGraph(graph),pretty=JSON.stringify(clean,null,2);return new TextEncoder().encode(pretty).length<=SCENE_GRAPH_BYTES?pretty:JSON.stringify(clean);}
export function transformMatrix(value){
  const t=transform(value),[x,y,z,w]=quatNormalize(t.rotation),[sx,sy,sz]=t.scale;
  return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,...t.position,1];
}
function affine(m){list(m,16,'matrix');if(m.length!==16||m.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e7)||m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)throw new RangeError('bounded affine matrix required');return m;}
export function multiplySceneMatrices(a,b){affine(a);affine(b);const m=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return affine(m);}
export function inverseSceneMatrix(m){
  affine(m);const [a,b,c,,d,e,f,,g,h,i]=m,det=a*(e*i-f*h)-d*(b*i-c*h)+g*(b*f-c*e);
  if(Math.abs(det)<1e-10)throw new RangeError('singular or ill-conditioned scene transform');
  const out=[(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det,0,(f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det,0,(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det,0,0,0,0,1];
  for(let r=0;r<3;r++)out[12+r]=-(out[r]*m[12]+out[4+r]*m[13]+out[8+r]*m[14]);return affine(out);
}
export function transformPoint(matrix,point){affine(matrix);const p=vector(point,3,-1e7,1e7,'point');return [0,1,2].map(r=>number(matrix[r]*p[0]+matrix[4+r]*p[1]+matrix[8+r]*p[2]+matrix[12+r],-1e7,1e7,'transformed point'));}
function sampled(t,time){
  if(time<=t.keys[0].time)return t.keys[0].transform;if(time>=t.keys.at(-1).time)return t.keys.at(-1).transform;
  const end=t.keys.findIndex(k=>k.time>=time),a=t.keys[end-1],b=t.keys[end],f=(time-a.time)/(b.time-a.time),lerp=(x,y)=>x.map((n,i)=>n+(y[i]-n)*f);
  return {position:lerp(a.transform.position,b.transform.position),rotation:quatInterpolate(a.transform.rotation,b.transform.rotation,f),scale:lerp(a.transform.scale,b.transform.scale)};
}
function sample(graph,time){
  const matrices=new Map(),visibility=new Map(),tracks=new Map(graph.tracks.map(t=>[t.node,t]));
  return expand(graph).map(n=>{
    const local=tracks.has(n.id)?sampled(tracks.get(n.id),time):n.transform,base=transformMatrix(local),matrix=n.parent===null?base:multiplySceneMatrices(matrices.get(n.parent),base);
    inverseSceneMatrix(matrix);matrices.set(n.id,matrix);const visible=n.visible&&(n.parent===null||visibility.get(n.parent));visibility.set(n.id,visible);
    return {...clone(n),transform:clone(local),visible,matrix,position:matrix.slice(12,15)};
  });
}
export function sampleSceneGraph(graph,time=0){const clean=validateSceneGraph(graph);number(time,0,clean.duration,'sample time');return sample(clean,time);}
export function localToWorld(graph,nodeId,point,time=0){const n=sampleSceneGraph(graph,time).find(n=>n.id===nodeId);if(!n)throw new TypeError('unknown node');return transformPoint(n.matrix,point);}
export function worldToLocal(graph,nodeId,point,time=0){const n=sampleSceneGraph(graph,time).find(n=>n.id===nodeId);if(!n)throw new TypeError('unknown node');return transformPoint(inverseSceneMatrix(n.matrix),point);}

/** Validated owned snapshot for repeated sampling. Replacements are transactional;
 * no clock, browser resources or external mutation is retained. */
export class SceneGraph {
  #graph;
  constructor(value){this.#graph=validateSceneGraph(value);}
  replace(value){const next=validateSceneGraph(value);this.#graph=next;}
  snapshot(){return clone(this.#graph);}
  sample(time=0){number(time,0,this.#graph.duration,'sample time');return sample(this.#graph,time);}
}
