// SPDX-License-Identifier: Apache-2.0
// Demo-owned beginner authoring recipes. All output uses the existing v2 schema.
import {createForgeScene,upgradeScene,validateScene,sceneWorld,addEntity,updateEntity,setEntityComponent} from './model.js';
import {defaultComponents} from './components.js';

export const STARTER_SCENES=Object.freeze([
  Object.freeze({id:'playground',name:'Playground',description:'A player, floor and platform. Learn selection, movement and Play.'}),
  Object.freeze({id:'jumping-course',name:'Jumping course',description:'Climb four steps and reach the checkpoint. WASD moves; Space jumps.'}),
  Object.freeze({id:'trigger-trail',name:'Trigger trail',description:'Walk through three coloured zones and watch checkpoint events in the status bar.'})
]);
export const GAMEPLAY_PIECES=Object.freeze([
  Object.freeze({id:'platform',name:'Platform'}),Object.freeze({id:'player',name:'Player'}),
  Object.freeze({id:'trigger',name:'Trigger zone'}),Object.freeze({id:'decoration',name:'Decoration'})
]);

function box(name,position,scale,color,body='static',tag=null){
  const components=defaultComponents(body);
  if(tag){components.collider.enabled=false;components.trigger={enabled:true,tag};}
  return {name,position,scale,color,body,components,parent:null,rotationY:0,visible:true};
}
export function createStarterScene(id,{firstId=1}={}){
  const recipe=STARTER_SCENES.find(s=>s.id===id);
  if(!recipe)throw new TypeError('Choose an available starter scene');
  if(!Number.isSafeInteger(firstId)||firstId<1)throw new RangeError('Invalid starter entity ID');
  let objects;
  if(id==='playground')objects=createForgeScene().objects;
  else{
    objects=[box('Ground',[0,-.35,0],[16,.7,22],[.22,.32,.40]),
      box('Player',[0,.65,7],[.75,1.2,.75],[.98,.70,.36],'player')];
    if(id==='jumping-course'){
      for(let i=0;i<4;i++)objects.push(box('Step '+(i+1),[0,.2+i*.4,4-i*2.5],
        [3,.4+i*.8,2],[.3,.55+i*.08,.64]));
      objects.push(box('Finish checkpoint',[0,3.5,-3.5],[2,1.5,1.5],[.85,.45,.7],'static','finish'));
    }else{
      for(const [i,position]of [[0,[0,1,3]],[1,[3,1,-1]],[2,[0,1,-5]]])
        objects.push(box('Checkpoint '+(i+1),position,[2,2,2],
          [[.3,.8,.7],[.8,.6,.3],[.8,.4,.7]][i],'static','checkpoint-'+(i+1)));
      objects.push(box('Turn marker',[-3,1,-1],[.5,2,.5],[.45,.65,.9]));
    }
  }
  const ids=new Map(objects.map((e,i)=>[e.id,'entity-'+(firstId+i)]));
  return validateScene({schemaVersion:2,name:recipe.name,nextId:firstId+objects.length,
    objects:objects.map((e,i)=>({...e,id:'entity-'+(firstId+i),parent:e.parent?ids.get(e.parent):null}))});
}

export function addGameplayPiece(scene,kind){
  if(!GAMEPLAY_PIECES.some(piece=>piece.id===kind))throw new TypeError('Choose an available gameplay piece');
  const original=upgradeScene(scene);
  if(kind==='player'&&original.objects.some(e=>e.components.controller.enabled))
    throw new TypeError('A player already exists. Select it in the hierarchy, or remove it before adding another.');
  const selected='entity-'+original.nextId;
  let next=addEntity(original,{name:GAMEPLAY_PIECES.find(piece=>piece.id===kind).name});
  const patches={
    platform:{position:[3,.25,0],scale:[3,.5,3],color:[.3,.68,.64]},
    player:{position:[0,.65,3],scale:[.75,1.2,.75],body:'player',color:[.98,.70,.36]},
    trigger:{position:[3,1,3],scale:[2,2,2],color:[.86,.35,.53]},
    decoration:{position:[-3,1,3],scale:[1,2,1],color:[.45,.65,.9]}
  };
  next=updateEntity(next,selected,patches[kind]);
  if(kind==='trigger'||kind==='decoration')next=setEntityComponent(next,selected,'collider',{enabled:false});
  if(kind==='trigger')next=setEntityComponent(next,selected,'trigger',{enabled:true,tag:'checkpoint-'+original.nextId});
  return {scene:next,selected};
}

// Advisory checks describe the actual Forge preview, not a general physics validator.
export function inspectCreatorScene(scene){
  const world=sceneWorld(upgradeScene(scene)),issues=[];
  const add=(code,message,entityId=null)=>issues.push({code,message,entityId});
  const visible=world.filter(e=>e.visible),players=visible.filter(e=>e.components.controller.enabled);
  const solids=visible.filter(e=>e.components.collider.enabled&&e.components.rigidbody.mode==='static'&&e.rotationY%180===0);
  if(!players.length)add('missing-player','Add a Player to move with WASD. Hidden players do not run in Play.');
  if(!solids.length)add('missing-ground','Add a Platform beneath the player. The preview has no invisible ground.');
  for(const e of visible){
    if(e.rotationY%180!==0){
      if(e.components.collider.enabled&&e.components.rigidbody.mode==='static')
        add('rotated-collider',e.name+': rotated static collisions are ignored. Set Y rotation to 0 or 180, or disable Collider.',e.id);
      if(e.components.trigger.enabled)add('rotated-trigger',e.name+': rotated triggers are ignored. Set Y rotation to 0 or 180.',e.id);
    }
    if(e.components.trigger.enabled&&e.components.collider.enabled&&e.components.rigidbody.mode==='static')
      add('solid-trigger',e.name+': Collider makes this trigger solid. Disable Collider for a walk-through zone.',e.id);
    if(e.components.controller.enabled&&e.components.controller.speed===0)
      add('zero-speed',e.name+': movement speed is zero. Increase Player Controller speed to enable movement.',e.id);
    if(e.components.camera.enabled)add('camera-metadata',e.name+': Camera is saved as metadata; the preview still uses the editor camera.',e.id);
  }
  for(const player of players){
    const overlapping=solids.find(e=>e.id!==player.id&&[0,1,2].every(i=>
      Math.abs(e.position[i]-player.position[i])<(e.scale[i]+player.scale[i])*.5-1e-8));
    if(overlapping)add('spawn-overlap',player.name+' starts inside '+overlapping.name+'. Move the player above or beside it before Play.',player.id);
    const supported=solids.some(e=>e.position[1]+e.scale[1]*.5<=player.position[1]-player.scale[1]*.5+1e-8&&
      [0,2].every(i=>Math.abs(e.position[i]-player.position[i])<(e.scale[i]+player.scale[i])*.5));
    if(solids.length&&!supported)add('no-floor-below',player.name+' has no axis-aligned floor below its starting position. Move it above a platform.',player.id);
  }
  if(visible.filter(e=>e.components.rigidbody.mode==='dynamic').length>1)
    add('dynamic-contacts','Dynamic bodies do not collide with each other in this preview. Use static platforms for obstacles.');
  return {issues,playerId:players[0]?.id??null,objectCount:world.length};
}
