// SPDX-License-Identifier: Apache-2.0
// Original miniature scene. Narrative events are mapped by this application,
// never by imported executable content. The renderer owns its native resources.
import {Renderer,boxVertices} from '../../modules/render-webgl/index.js';
import {quatMultiply} from '../../modules/math/index.js';
import {createSceneGraph,sceneNode,SceneGraph,transformPoint} from '../../modules/scene-graph/index.js';
export const SCENE_CUES=Object.freeze(['lantern-lit','harbor-safe','courier-left','dark-route']);
export function lanternScene(cues=[]){
  const graph=createSceneGraph('The Last Lantern / original diorama');
  const state={lit:false,ending:'unlit'};
  // Only these application-owned IDs can affect the scene. Unknown declared
  // narrative events remain inert and are reported by the UI.
  for(const cue of cues){
    if(cue==='lantern-lit')state.lit=true;
    else if(cue==='harbor-safe'){state.lit=true;state.ending='harbor';}
    else if(cue==='courier-left'){state.lit=true;state.ending='courier';}
    else if(cue==='dark-route'){state.lit=false;state.ending='dark';}
  }
  const add=(id,position,scale,color,options={})=>graph.nodes.push(sceneNode(id,{position,scale,color,...options}));
  const stone=[.29,.41,.42],wood=[.48,.34,.25],cream=[.88,.78,.54],light=state.lit?[1,.82,.33]:[.26,.47,.48];
  add('sea',[0,-1.1,0],[20,.2,14],[.08,.29,.34]);
  add('island',[0,-.58,0],[11,.8,8],[.24,.35,.33]);add('grass',[0,-.12,0],[10.6,.14,7.6],[.42,.53,.39]);
  add('path',[0,-.02,1.8],[1.3,.08,3.5],[.69,.65,.51]);add('pier',[0,-.2,5],[1.5,.3,3],wood);
  for(const x of [-.58,.58])for(const z of [4.5,5.7])add('pier-'+(x<0?'l':'r')+'-'+String(z).replace('.','-'),[x,-.7,z],[.13,1.4,.13],wood);
  graph.nodes.push(sceneNode('tower',{position:[0,0,-.8],mesh:false}));
  add('tower-base',[0,.27,0],[3,.54,3],stone,{parent:'tower'});add('tower-body',[0,2.4,0],[1.75,4.1,1.75],cream,{parent:'tower'});
  add('tower-belt',[0,1.1,0],[1.82,.22,1.82],[.69,.37,.26],{parent:'tower'});add('door',[0,.8,.9],[.57,1.25,.08],wood,{parent:'tower'});
  add('gallery',[0,4.5,0],[2.7,.25,2.7],stone,{parent:'tower'});add('lantern',[0,5.2,0],[1.65,1.2,1.65],light,{parent:'tower'});
  for(const x of [-.92,.92])for(const z of [-.92,.92])add('strut-'+(x<0?'l':'r')+(z<0?'b':'f'),[x,5.2,z],[.12,1.4,.12],stone,{parent:'tower'});
  add('roof',[0,5.95,0],[2.5,.22,2.5],[.64,.31,.22],{parent:'tower'});add('cap',[0,6.15,0],[1.6,.2,1.6],[.72,.39,.25],{parent:'tower'});add('finial',[0,6.48,0],[.14,.5,.14],cream,{parent:'tower'});
  add('beam',[0,5.2,2.4],[.4,.25,3.2],[1,.87,.46],{parent:'tower',visible:state.lit});
  add('workshop',[-3,.8,-1],[2.2,1.6,2.1],wood);add('workshop-roof',[-3,1.72,-1],[2.6,.3,2.5],[.36,.48,.44]);
  add('workshop-window',[-3,.98,.08],[.8,.55,.05],state.ending==='harbor'?light:[.3,.46,.42]);
  add('chimney',[-3.7,2,-1.5],[.35,.7,.35],stone);
  for(const [i,p]of [[0,[-4,0,2.2]],[1,[3.4,0,-2.3]],[2,[4,0,.4]]]){
    add('trunk-'+i,[p[0],.55,p[2]],[.22,1.1,.22],wood);add('tree-'+i,[p[0],1.55,p[2]],[1.1,1.5,1.1],[.27,.43,.34]);add('tree-top-'+i,[p[0],2.4,p[2]],[.7,.5,.7],[.36,.5,.35]);
  }
  add('courier',[state.ending==='courier'?4:2.5,.46,3],[.42,.92,.42],[.8,.49,.31]);add('courier-head',[state.ending==='courier'?4:2.5,1.1,3],[.42,.36,.42],cream);
  for(let i=0;i<5;i++)add('wave-'+i,[-6+i*3,-.95,6.1+(i%2)*.6],[1,.03,.06],[.38,.59,.58]);
  return {graph,state};
}
export class LanternView{
  constructor(canvas){this.renderer=new Renderer(canvas);try{this.mesh=this.renderer.mesh([]);}catch(error){this.renderer.dispose();throw error;}this.disposed=false;this.key='';this.stats={uploads:0,draws:0};}
  load(cues){
    if(this.disposed)throw Error('Scene resources disposed');
    const key=JSON.stringify(cues);if(key===this.key)return this.draw();
    const accepted=lanternScene(cues),scene=new SceneGraph(accepted.graph),vertices=[];
    for(const node of scene.sample(0))if(node.visible&&node.components.mesh.enabled){
      const local=boxVertices([0,0,0],[1,1,1],node.components.appearance.color);
      for(let i=0;i<local.length;i+=6)vertices.push(...transformPoint(node.matrix,local.slice(i,i+3)),...local.slice(i+3,i+6));
    }
    this.renderer.update(this.mesh,vertices);this.key=key;this.scene=scene;this.state=accepted.state;this.stats.uploads++;this.draw();
  }
  draw(){if(this.disposed)return;const yaw=.58,pitch=-.36,q=quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);this.renderer.begin([12,10,18],q,{fov:.79,fog:.009});this.renderer.draw(this.mesh);this.stats.draws++;}
  dispose(){if(this.disposed)return;this.renderer.dispose();this.scene=null;this.disposed=true;}
}
