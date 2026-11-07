// SPDX-License-Identifier: Apache-2.0
// SI Newtonian point-mass orbit solver, independently authored.
// Numerical constant and model definition: QSOLKCB/UFF
// @596cd732df61587aa1a9801cad1ec13483b1347f,
// uff/constants.py (G_SI = 6.67430e-11) and docs/MODELS.md, section 3.
// UFF empirical extra-field velocity is NOT treated as an established force.
// No game collision, GPU, relativity, multi-body gravity or atmospheric effects.
export const GRAVITATIONAL_CONSTANT_SI = 6.67430e-11;
const scalar=(x,label,positive=false)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e100||
     (positive?x<=0:false))
    throw new RangeError(label+' must be a finite '+(positive?'positive ':'')+'SI value <= 1e100');
  return x;
};
function xyz(x,label){
  if(!Array.isArray(x)||x.length!==3||
     ![0,1,2].every(i=>Object.hasOwn(x,i)&&typeof x[i]==='number'&&
       Number.isFinite(x[i])&&Math.abs(x[i])<=1e100))
    throw new TypeError(label+' must be three finite SI coordinates');
  return x.slice();
}
const norm3=p=>Math.hypot(...p);
/** Classical Newtonian acceleration at a point relative to a stationary
 * central mass. No softening is silently introduced. */
export function centralAccelerationSI(position,mass,{center=[0,0,0],minimumRadius=0}={}){
  const p=xyz(position,'position'),c=xyz(center,'center');
  scalar(mass,'mass',true);scalar(minimumRadius,'minimumRadius');
  if(minimumRadius<0)throw new RangeError('minimumRadius must be nonnegative');
  const d=p.map((v,i)=>v-c[i]),radius=norm3(d);
  if(!(radius>minimumRadius))throw new RangeError('orbit reaches the excluded central radius');
  const factor=-GRAVITATIONAL_CONSTANT_SI*mass/radius**3;
  const a=d.map(v=>v*factor);
  if(!a.every(Number.isFinite))throw new RangeError('gravity acceleration overflow');
  return a;
}
/** Circular speed of a negligible-mass test particle at radius r,
 * v = sqrt(GM/r). Outside the strong-field/extended-body regimes only. */
export function circularSpeedSI(mass,radius){
  scalar(mass,'mass',true);scalar(radius,'radius',true);
  const v=Math.sqrt(GRAVITATIONAL_CONSTANT_SI*mass/radius);
  if(!Number.isFinite(v))throw new RangeError('circular speed overflow');
  return v;
}
/** Specific Newtonian Kepler energy, J/kg, with explicit central location. */
export function specificOrbitalEnergySI({position,velocity,mass,center=[0,0,0]}){
  const p=xyz(position,'position'),v=xyz(velocity,'velocity'),c=xyz(center,'center');
  scalar(mass,'mass',true);
  const r=norm3(p.map((x,i)=>x-c[i]));
  if(!(r>0))throw new RangeError('undefined orbital potential at center');
  const energy=.5*v.reduce((s,x)=>s+x*x,0)-GRAVITATIONAL_CONSTANT_SI*mass/r;
  if(!Number.isFinite(energy))throw new RangeError('orbital energy overflow');
  return energy;
}
/** One test-particle in a fixed Newtonian central potential.
 * Velocity-Verlet: a half-kick, full drift, and another half-kick.
 * Symplectic for this separable time-independent potential.
 * Does NOT imply exact energy conservation or general relativistic dynamics. */
export class KeplerOrbit{
  #mass;#center;#minimumRadius;#position;#velocity;#elapsed=0;#steps=0;
  constructor({mass,position,velocity,center=[0,0,0],minimumRadius=0}={}){
    this.#mass=scalar(mass,'mass',true);
    this.#position=xyz(position,'position');
    this.#velocity=xyz(velocity,'velocity');
    this.#center=xyz(center,'center');
    this.#minimumRadius=scalar(minimumRadius,'minimumRadius');
    if(this.#minimumRadius<0)throw new RangeError('minimumRadius must be nonnegative');
    centralAccelerationSI(this.#position,this.#mass,{
      center:this.#center,minimumRadius:this.#minimumRadius});
  }
  get mass(){return this.#mass;}
  get elapsedSeconds(){return this.#elapsed;}
  get steps(){return this.#steps;}
  snapshot(){
    return {position:[...this.#position],velocity:[...this.#velocity],
      center:[...this.#center],mass:this.#mass,
      minimumRadius:this.#minimumRadius,elapsedSeconds:this.#elapsed,steps:this.#steps};
  }
  energy(){return specificOrbitalEnergySI({
    mass:this.#mass,center:this.#center,position:this.#position,velocity:this.#velocity});}
  /** Signed dt permits a numerical reversibility test. Abs(dt)<=86400 s.
   * All candidate state is staged; rejected integrations preserve the state. */
  step(seconds){
    scalar(seconds,'seconds');
    if(Math.abs(seconds)>86400)throw new RangeError('step exceeds 86400 seconds');
    if(seconds===0)return this.snapshot();
    const a0=centralAccelerationSI(this.#position,this.#mass,{
      center:this.#center,minimumRadius:this.#minimumRadius});
    const nextPosition=this.#position.map((x,i)=>
      x+this.#velocity[i]*seconds+.5*a0[i]*seconds*seconds);
    const a1=centralAccelerationSI(nextPosition,this.#mass,{
      center:this.#center,minimumRadius:this.#minimumRadius});
    const nextVelocity=this.#velocity.map((x,i)=>x+.5*(a0[i]+a1[i])*seconds);
    if(![...nextPosition,...nextVelocity].every(x=>Number.isFinite(x)&&Math.abs(x)<=1e100))
      throw new RangeError('orbital state overflow');
    const elapsed=this.#elapsed+seconds;
    if(!Number.isFinite(elapsed)||Math.abs(elapsed)>1e100||this.#steps>=0x7fffffff)
      throw new RangeError('orbit counter exhausted');
    this.#position=nextPosition;this.#velocity=nextVelocity;
    this.#elapsed=elapsed;this.#steps++;
    return this.snapshot();
  }
}
