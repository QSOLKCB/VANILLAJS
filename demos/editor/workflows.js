// SPDX-License-Identifier: Apache-2.0
// Demo-owned, data-only authoring helpers; no plugin evaluation or runtime changes.
export function hierarchyRows(objects, query=''){
  const byId=new Map(objects.map(object=>[object.id,object])),children=new Map();
  for(const object of objects){
    if(!children.has(object.parent))children.set(object.parent,[]);
    children.get(object.parent).push(object);
  }
  const term=query.trim().toLowerCase(),included=new Set();
  for(const object of objects)if(!term||[object.name,object.id,object.body].some(value=>value.toLowerCase().includes(term))){
    let current=object;
    while(current&&!included.has(current.id)){included.add(current.id);current=byId.get(current.parent);}
  }
  const rows=[];
  function visit(parent,depth){for(const object of children.get(parent)??[]){
    if(included.has(object.id))rows.push({object,depth});
    visit(object.id,depth+1);
  }}
  visit(null,0);return rows;
}
export function eligibleParents(objects,selected){
  const excluded=new Set([selected]);
  // At most 128 objects; grow once per depth and never offer a cycle.
  for(let changed=true;changed;){changed=false;for(const object of objects)
    if(excluded.has(object.parent)&&!excluded.has(object.id)){excluded.add(object.id);changed=true;}}
  return objects.filter(object=>!excluded.has(object.id));
}
export function matchesAsset(asset,query){
  const term=query.trim().toLowerCase();
  return !term||[asset.name,asset.kind,asset.id].some(value=>value.toLowerCase().includes(term));
}
