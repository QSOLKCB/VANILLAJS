// SPDX-License-Identifier: Apache-2.0
// Tutorial-owned composition, not a new public engine API.
import {createStarterScene,inspectCreatorScene} from '../editor/creator-workflow.js';
import {setEntityComponent} from '../editor/model.js';
import {createPreview,stepPreview} from '../editor/preview.js';
import {createAssetLibrary,serializeProject} from '../editor/asset-foundry.js';
export const starter=()=>createStarterScene('playground');
export const player=scene=>scene.objects.find(e=>e.components.controller.enabled);
export function withSpeed(scene,speed){
  if(!Number.isFinite(speed)||speed<0||speed>8)throw new RangeError('Choose a speed from 0 to 8 m/s.');
  return setEntityComponent(scene,player(scene).id,'controller',{speed});
}
export const inspect=inspectCreatorScene;
export function walk(scene){
  const issues=inspect(scene).issues;
  if(issues.length)throw new Error(issues.map(i=>i.message).join(' '));
  let state=createPreview(scene);
  const start=state.bodies[player(scene).id].position[0];
  for(let i=0;i<60;i++)state=stepPreview(scene,state,{x:1,z:0,jump:false});
  return {state,distance:state.bodies[player(scene).id].position[0]-start};
}
export const project=scene=>serializeProject(scene,createAssetLibrary());
