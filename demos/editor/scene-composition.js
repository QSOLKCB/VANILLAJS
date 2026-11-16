// SPDX-License-Identifier: Apache-2.0
// Explicit Workbench v1/v2 -> separate scene-graph sidecar conversion.
import {validateScene} from './model.js';
import {createSceneGraph,sceneNode,validateSceneGraph,sampleSceneGraph} from '../../modules/scene-graph/index.js';
const clone=x=>JSON.parse(JSON.stringify(x));
export function captureComposition(input){
  const scene=validateScene(input),graph=createSceneGraph(scene.name);
  graph.nodes=scene.objects.map(n=>{const angle=n.rotationY*Math.PI/360;return sceneNode(n.id,{name:n.name,parent:n.parent,position:n.position,rotation:[0,Math.sin(angle),0,Math.cos(angle)],scale:n.scale,color:n.color,visible:n.visible,mesh:n.components?.mesh.enabled??true,camera:n.components?.camera.enabled?{fov:n.components.camera.fov*Math.PI/180,near:.05,far:1000}:null});});
  return validateSceneGraph(graph);
}
export function compositionHistory(graph){return {past:[],present:validateSceneGraph(graph),future:[]};}
export function commitComposition(history,graph){const next=validateSceneGraph(graph);return {past:[...history.past,history.present].slice(-20),present:next,future:[]};}
export function travelComposition(history,direction){
  if(direction==='undo'&&history.past.length)return {past:history.past.slice(0,-1),present:history.past.at(-1),future:[history.present,...history.future].slice(0,20)};
  if(direction==='redo'&&history.future.length)return {past:[...history.past,history.present].slice(-20),present:history.future[0],future:history.future.slice(1)};
  if(!['undo','redo'].includes(direction))throw new TypeError('history direction');return history;
}
export function editCompositionNode(graph,id,patch){
  const next=validateSceneGraph(graph),n=next.nodes.find(n=>n.id===id);if(!n)throw new TypeError('Select a directly authored node');
  // Admission is delegated to the public strict graph validator, including
  // nested patches. UI code calls this with owned inert values only.
  Object.assign(n,clone(patch));return validateSceneGraph(next);
}
export function captureCompositionKey(graph,nodeId,scene,selected,time){
  const next=validateSceneGraph(graph),source=captureComposition(scene).nodes.find(n=>n.id===selected);
  if(!source)throw new TypeError('Select an inspector object first');
  if(!sampleSceneGraph(next).some(n=>n.id===nodeId))throw new TypeError('Unknown composition node');
  let track=next.tracks.find(t=>t.node===nodeId);if(!track){track={node:nodeId,keys:[]};next.tracks.push(track);}
  track.keys=track.keys.filter(k=>k.time!==time);track.keys.push({time,transform:source.transform});track.keys.sort((a,b)=>a.time-b.time);
  return validateSceneGraph(next);
}
export function saveCompositionPrefab(graph,nodeId,prefabId){
  const next=validateSceneGraph(graph),ids=new Set([nodeId]);if(!next.nodes.some(n=>n.id===nodeId))throw new TypeError('Select a directly authored node');
  let change=true;while(change){change=false;for(const n of next.nodes)if(ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);change=true;}}
  if(next.instances.some(i=>ids.has(i.parent)))throw new TypeError('Capture direct nodes before adding nested prefab instances');
  const nodes=next.nodes.filter(n=>ids.has(n.id)).map(n=>({...n,parent:n.id===nodeId?null:n.parent}));
  const prefab={id:prefabId,nodes,instances:[]};next.prefabs.push(prefab);return validateSceneGraph(next);
}
export function addCompositionInstance(graph,{id,prefab,parent=null,position=[0,0,0],container=null}){
  const next=validateSceneGraph(graph),target=container===null?next:next.prefabs.find(p=>p.id===container);
  if(!target)throw new TypeError('Unknown prefab container');
  target.instances.push({id,prefab,parent,transform:{position,rotation:[0,0,0,1],scale:[1,1,1]}});return validateSceneGraph(next);
}
export function compositionExample(){
  const g=createSceneGraph('The Lantern Assembly');g.duration=6;
  g.nodes=[sceneNode('plinth',{position:[0,-.25,0],scale:[7,.5,6],color:[.19,.29,.38]}),sceneNode('arm',{position:[0,1,0],scale:[1,1,1],mesh:false}),sceneNode('lantern',{parent:'arm',position:[2,1,0],scale:[.6,1.3,.6],color:[1,.65,.24]}),sceneNode('mast',{position:[0,1,0],scale:[.25,2,.25],color:[.35,.65,.68]})];
  g.tracks=[{node:'arm',keys:[{time:0,transform:clone(g.nodes[1].transform)},{time:3,transform:{position:[0,1,0],rotation:[0,1,0,0],scale:[1,1,1]}},{time:6,transform:{position:[0,1,0],rotation:[0,0,0,1],scale:[1,1,1]}}]}];
  return validateSceneGraph(g);
}
