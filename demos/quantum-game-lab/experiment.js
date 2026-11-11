// SPDX-License-Identifier: Apache-2.0
// Demo composition: exact state -> declared field -> classical SI solver.
import {MOD_PACK_KIND,DataModRegistry} from '../../modules/mod-sdk/index.js';
import {EXPERIMENT_KIND,registerExperimentMod,activeExperiments} from '../../modules/mod-experiment/index.js';
import {transition,syndrome} from '../../modules/gf3/index.js';
import {MAPPING_KIND,transitionEvent} from '../../modules/symbolic-events/index.js';
import {KeplerOrbit,circularSpeedSI} from '../../modules/orbital-physics/index.js';

export function starterPack(dimension=2){
  if(!Number.isInteger(dimension)||dimension<2||dimension>4)throw new RangeError('dimension must be 2..4');
  const identity=()=>Array.from({length:dimension},(_,i)=>Array.from({length:dimension},(_,j)=>Number(i===j)));
  const zero=()=>Array(dimension).fill(0);
  const transforms=Array.from({length:dimension},(_,i)=>({id:'pulse-'+i,matrix:identity(),offset:zero().map((_,j)=>Number(i===j))}));
  const shear=identity();shear[0][1]=1;
  transforms.push({id:'shear',matrix:shear,offset:zero()});
  const swap=identity();[swap[0],swap[1]]=[swap[1],swap[0]];
  transforms.push({id:'swap',matrix:swap,offset:zero()});
  return {kind:MOD_PACK_KIND,id:'ternary-constellation',version:'1.0.0',requires:[],
    entries:[{id:'experiment',kind:'data',data:{kind:EXPERIMENT_KIND,dimension,
      initial:zero(),target:zero().map((_,i)=>(i%2)+1),transforms,parity:[Array(dimension).fill(1)],
      mapping:{kind:MAPPING_KIND,frequencies:[165,220,330],wave:'triangle',gain:3500},
      spatial:'gentle',palette:['#72f6ca','#bb9aff','#ffc572'],maxTicks:32}}]};
}
const freeze=Object.freeze;
const bodySnapshot=orbit=>{
  const s=orbit.snapshot();
  return freeze({position:freeze(s.position),velocity:freeze(s.velocity),mass:s.mass,
    energy:orbit.energy()});
};
const baseMass=preset=>preset==='swift'?5e11:1e11;
function orbitFrom(body,mass){
  return new KeplerOrbit({mass,position:body.position,velocity:body.velocity,minimumRadius:.5});
}
function initialBodies(state,preset){
  const directions=[[1,0],[0,1],[-1,0],[0,-1]];
  return freeze(state.map((trit,i)=>{
    const r=4+2*i,mass=baseMass(preset)*(1+trit),[x,y]=directions[i];
    const v=circularSpeedSI(mass,r);
    return bodySnapshot(orbitFrom({position:[r*x,r*y,0],velocity:[-v*y,v*x,0]},mass));
  }));
}
/** Fixed 8 x 1/32 s steps per event tick. No pair interactions or acceleration lane. */
function spatialStep(bodies,state,preset){
  if(!['gentle','swift'].includes(preset))throw new TypeError('unknown spatial preset');
  // The session owns all inputs. Public mathematical admission is in the reused solver.
  return freeze(bodies.map((body,i)=>{
    const orbit=orbitFrom(body,baseMass(preset)*(1+state[i]));
    for(let substep=0;substep<8;substep++)orbit.step(1/32);
    const next=bodySnapshot(orbit);
    if([...next.position,...next.velocity].some(v=>!Number.isFinite(v)||Math.abs(v)>100))
      throw new RangeError('constellation exceeds 100 m or 100 m/s budget');
    return next;
  }));
}
/** A bounded session, atomically commits state, events and numerical candidates. */
export class Experiment {
  #compiled;#source;#state;#bodies;#history=freeze([]);#events=freeze([]);
  constructor(input){
    const registry=new DataModRegistry();
    const source=registerExperimentMod(registry,input);
    if(source.entries.length!==1||source.requires.length!==0)
      throw new RangeError('this local lab previews one self-contained experiment');
    registry.activate(source.id);
    this.#compiled=activeExperiments(registry)[0].experiment;this.#source=source;
    this.#state=this.#compiled.initial;
    this.#bodies=initialBodies(this.#state,this.#compiled.source.spatial);
  }
  get source(){return this.#source;}
  get compiled(){return this.#compiled;}
  snapshot(){return freeze({tick:this.#history.length,state:this.#state,bodies:this.#bodies,
    history:this.#history,events:this.#events,syndrome:syndrome(this.#compiled.parity,this.#state),
    solved:this.#state.every((v,i)=>v===this.#compiled.target[i])});}
  step(id){
    const tick=this.#history.length+1;
    if(tick>this.#compiled.source.maxTicks)throw new RangeError('tick budget reached; reset to begin another run');
    const op=this.#compiled.operations.find(x=>x.id===id);
    if(!op)throw new TypeError('operation is not in the active pack');
    const t=transition(op,this.#state,tick),event=transitionEvent(this.#compiled.mapping,t);
    const bodies=spatialStep(this.#bodies,t.after,this.#compiled.source.spatial);
    const history=freeze([...this.#history,t]),events=freeze([...this.#events,event]);
    this.#state=t.after;this.#bodies=bodies;this.#history=history;this.#events=events;
    return this.snapshot();
  }
  receipt(){
    return freeze({kind:'qsol.qgame-run.v1',source:this.#source,
      inputs:freeze(this.#history.map(t=>freeze({tick:t.tick,operation:t.operation}))),
      ...this.snapshot(),contracts:freeze({field:'GF(3)',tickHz:4,spatialStepSeconds:1/32,
        spatialSubsteps:8,coordinates:'SI; XY plane; +Y up; right handed; Z=0',
        pcm:'48000 Hz mono PCM16LE; device playback is noncanonical',
        claim:'Classical finite states, declared composition, numerical central potentials; no quantum amplitudes'})});
  }
}
