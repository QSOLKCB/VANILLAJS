// SPDX-License-Identifier: Apache-2.0
// Source-identical geometry reuse. The full accepted bytes and mode are the key.
// Reference construction stays available for exact work/parity comparisons.
export function buildScenery(pack,mode) {
  const stage=pack[mode];
  const buildings=Array.from({length:Math.ceil(stage.width/700)+14},(_,i)=>Object.freeze({
    x:i*700-3500,width:450+(i*137)%400,height:1000+(i*391)%2300,windows:2+i%4}));
  return Object.freeze({mode,width:stage.width,palette:pack.settings.palette,
    buildings:Object.freeze(buildings),solids:stage.solids,platforms:stage.platforms});
}
export class SceneryCache {
  #key=null;#value=null;builds=0;hits=0;
  get(pack,mode) {
    const key=pack.bytes+'\n'+mode;
    if(key===this.#key){this.hits++;return this.#value;}
    const candidate=buildScenery(pack,mode);this.#key=key;this.#value=candidate;this.builds++;return candidate;
  }
}
