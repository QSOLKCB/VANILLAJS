// SPDX-License-Identifier: Apache-2.0
// Original bounded pixel generators. Integer source pixels, no device resources.
export const SPRITE_FORMAT='qsol.vanillajs.sprite.v1';
export const SPRITE_IMPLEMENTATION=1;
export const SPRITE_MAX_BYTES=256*1024;
export const SPRITE_SIZES=Object.freeze([8,16,32,64]);
export const SPRITE_KINDS=Object.freeze(['character','enemy','weapon','item','terrain','particle','impact']);
const LICENSES=['Apache-2.0','CC0-1.0','CC-BY-4.0','OWNER-LOCAL-ONLY'];
const exact=(value,keys,label)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||
    ![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError(label+' must be a plain record');
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k))||
    keys.some(k=>!Object.hasOwn(value,k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))
    throw new TypeError(label+' has unknown, missing or executable fields');
};
function array(value,min,max,label){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<min||value.length>max)throw new RangeError(label+' exceeds its plain array budget');
  if(Reflect.ownKeys(value).length!==value.length+1)throw new TypeError(label+' must be a dense data array');
  for(let i=0;i<value.length;i++)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,String(i))??{},'value'))throw new TypeError(label+' has an accessor or missing item');
  return value;
}
const integer=(value,min,max,label)=>{
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError('invalid '+label);
  return value;
};
function palette(value){
  const result=array(value,2,16,'palette').map(color=>array(color,4,4,'RGBA').map(n=>integer(n,0,255,'color channel')));
  if(result[0].some(n=>n!==0))throw new TypeError('palette entry zero must be transparent black');
  return result;
}
function label(value){
  if(typeof value!=='string'||!value.length||value.length>64||/[\u0000-\u001f\u007f]/.test(value))throw new TypeError('invalid sprite name');
  return value;
}
export function validateSpriteRecipe(value){
  exact(value,['kind','size','seed','symmetry','frameCount','palette'],'sprite recipe');
  if(!SPRITE_KINDS.includes(value.kind)||!SPRITE_SIZES.includes(value.size))throw new RangeError('unsupported generator or sprite size');
  if(typeof value.symmetry!=='boolean')throw new TypeError('symmetry must be boolean');
  return {kind:value.kind,size:value.size,seed:integer(value.seed,0,0xffffffff,'uint32 seed'),symmetry:value.symmetry,
    frameCount:integer(value.frameCount,1,16,'frame count'),palette:palette(value.palette)};
}
export function validateSpriteProject(value){
  exact(value,['format','implementationVersion','name','license','recipe','frames'],'sprite project');
  if(value.format!==SPRITE_FORMAT||value.implementationVersion!==SPRITE_IMPLEMENTATION)throw new RangeError('unsupported sprite format or implementation version');
  if(!LICENSES.includes(value.license))throw new TypeError('unsupported or missing asset licence');
  const recipe=validateSpriteRecipe(value.recipe),count=recipe.size*recipe.size;
  const frames=array(value.frames,recipe.frameCount,recipe.frameCount,'frames').map(frame=>{
    exact(frame,['durationMs','pixels'],'frame');
    return {durationMs:integer(frame.durationMs,40,2000,'frame duration'),pixels:
      array(frame.pixels,count,count,'pixels').map(n=>integer(n,0,recipe.palette.length-1,'palette index'))};
  });
  return {format:SPRITE_FORMAT,implementationVersion:SPRITE_IMPLEMENTATION,name:label(value.name),license:value.license,recipe,frames};
}
export function parseSpriteProject(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>SPRITE_MAX_BYTES)throw new RangeError('sprite project exceeds 256 KiB');
  return validateSpriteProject(JSON.parse(raw));
}
export function serializeSpriteProject(value){
  const raw=JSON.stringify(validateSpriteProject(value))+'\n';
  if(new TextEncoder().encode(raw).length>SPRITE_MAX_BYTES)throw new RangeError('sprite project exceeds 256 KiB');
  return raw;
}
// LCG calls and row-major order are part of implementation version 1.
function random(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};}
function silhouette(kind,x,y,phase,variant){
  const step=phase%2,wide=variant%2;
  if(kind==='character'){
    if(y>=2&&y<=6&&x>=5&&x<=10&&!(y===2&&(x===5||x===10)))return y===4&&(x===6||x===9)?3:2;
    if(y>=7&&y<=11&&x>=4-wide&&x<=11+wide)return (x===6||x===9)&&y===8?3:1;
    if(y>=8&&y<=10&&((x>=2&&x<=3)||(x>=12&&x<=13)))return 2;
    if(y>=12&&y<=14&&((x>=4+step&&x<=6+step)||(x>=9-step&&x<=11-step)))return y===14?3:1;
  }else if(kind==='enemy'){
    if(y>=1&&y<=3&&((x>=3&&x<=4)||(x>=11&&x<=12)))return 3;
    if((x-8)*(x-8)*2+(y-8)*(y-8)<=48+wide*8)return y===6&&(x===5||x===10)?3:y===10&&x>=6&&x<=9?4:1;
    if(y>=12&&y<=14&&((x>=3+step&&x<=5+step)||(x>=10-step&&x<=12-step)))return 2;
  }else if(kind==='weapon'){
    if(x>=2&&x<=11&&y>=6&&y<=9)return y===6?3:1;
    if(x>=12&&x<=14&&y>=7&&y<=8)return 2;
    if(x>=3&&x<=5&&y>=10&&y<=12)return 2;
    if(x>=8&&x<=10&&y>=10&&y<=13)return 1;
    if(x>=7&&x<=10&&y===5)return 3;
    if(phase%2&&x===15&&y>=5&&y<=10)return 4;
  }else if(kind==='item'){
    if(Math.abs(x-8)+Math.abs(y-8)<=6)return x===8||y===8?3:1;
    if(phase%2&&((x===2&&y===2)||(x===13&&y===3)))return 4;
  }else if(kind==='terrain'){
    if(y>=8&&y<=14&&x>=1&&x<=14)return y===8?3:y<11?1:2;
    if(y>=4&&y<=7&&((x===3)||(x===7+step)||(x===12)))return 3;
    if(y===6&&(x===2||x===4||x===11||x===13))return 1;
  }else if(kind==='particle'){
    const distance=(x-8)*(x-8)+(y-8)*(y-8),radius=3+(phase%4);
    if(distance<=radius*radius)return distance<4?4:distance<radius*radius/2?3:1;
  }else if(kind==='impact'){
    const dx=Math.abs(x-8),dy=Math.abs(y-8),radius=3+phase%5;
    if((dx+dy===radius)||(dx<=1&&dy<=radius)||(dy<=1&&dx<=radius))return dx+dy<3?4:3;
  }
  return 0;
}
export function generateSprite(input,{name='Original sprite',license='Apache-2.0'}={}){
  const recipe=validateSpriteRecipe(input),rng=random(recipe.seed),variant=rng(),size=recipe.size,frames=[];
  for(let frame=0;frame<recipe.frameCount;frame++){
    const pixels=Array(size*size).fill(0);
    for(let y=0;y<size;y++)for(let x=0;x<Math.ceil(size/2);x++){
      // Symmetry consumes the same noise for both halves; asymmetric generators
      // use every source coordinate independently below.
      if(!recipe.symmetry)break;
      const noise=rng(),u=Math.floor(x*16/size),v=Math.floor(y*16/size);
      let color=silhouette(recipe.kind,u,v,frame,variant);
      if(color===1&&((noise>>>24)&15)===0)color=2;
      else if(color===3&&((noise>>>24)&31)===0)color=4;
      const index=color===0?0:1+(color-1)%(recipe.palette.length-1);
      pixels[y*size+x]=pixels[y*size+size-1-x]=index;
    }
    if(!recipe.symmetry)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const noise=rng();let color=silhouette(recipe.kind,Math.floor(x*16/size),Math.floor(y*16/size),frame,variant);
      if(color===1&&((noise>>>24)&15)===0)color=2;
      else if(color===3&&((noise>>>24)&31)===0)color=4;
      pixels[y*size+x]=color===0?0:1+(color-1)%(recipe.palette.length-1);
    }
    frames.push({durationMs:120,pixels});
  }
  return validateSpriteProject({format:SPRITE_FORMAT,implementationVersion:SPRITE_IMPLEMENTATION,name,license,recipe,frames});
}
function frameIndex(project,index){return integer(index,0,project.frames.length-1,'frame index');}
export function rgbaFrame(value,index=0){
  const p=validateSpriteProject(value),frame=p.frames[frameIndex(p,index)],rgba=new Uint8Array(frame.pixels.length*4);
  frame.pixels.forEach((color,i)=>rgba.set(p.recipe.palette[color],i*4));return rgba;
}
/** Validate and copy once per bounded stroke, not once per interpolated pixel.
 * Check all positions before modifying the owned candidate frame. */
export function paintSpriteStroke(value,frame,points,color){
  const p=validateSpriteProject(value),size=p.recipe.size;
  frameIndex(p,frame);integer(color,0,p.recipe.palette.length-1,'palette index');
  const positions=array(points,1,128,'stroke points').map(point=>{
    exact(point,['x','y'],'stroke point');
    return [integer(point.x,0,size-1,'pixel x'),integer(point.y,0,size-1,'pixel y')];
  });
  const pixels=p.frames[frame].pixels;
  for(const [x,y] of positions)pixels[y*size+x]=color;
  return p;
}
export function paintSpritePixel(value,frame,x,y,color){
  const p=validateSpriteProject(value),s=p.recipe.size;
  frameIndex(p,frame);integer(x,0,s-1,'pixel x');integer(y,0,s-1,'pixel y');integer(color,0,p.recipe.palette.length-1,'palette index');
  p.frames[frame].pixels[y*s+x]=color;return p;
}
export function fillSpritePixels(value,frame,x,y,color){
  const p=validateSpriteProject(value),s=p.recipe.size;
  frameIndex(p,frame);integer(x,0,s-1,'pixel x');integer(y,0,s-1,'pixel y');integer(color,0,p.recipe.palette.length-1,'palette index');
  const pixels=p.frames[frame].pixels,start=y*s+x,old=pixels[start];
  if(old===color)return p;
  const queue=[start];pixels[start]=color;
  for(let head=0;head<queue.length;head++){
    const i=queue[head],cx=i%s,cy=Math.floor(i/s);
    for(const next of [cx?i-1:-1,cx<s-1?i+1:-1,cy?i-s:-1,cy<s-1?i+s:-1]){
      if(next>=0&&pixels[next]===old){pixels[next]=color;queue.push(next);}
    }
  }
  return p;
}
export function setSpritePalette(value,colors){const p=validateSpriteProject(value);p.recipe.palette=palette(colors);return validateSpriteProject(p);}
export function duplicateSpriteFrame(value,index){
  const p=validateSpriteProject(value);frameIndex(p,index);
  if(p.frames.length>=16)throw new RangeError('frame capacity is 16');
  p.frames.splice(index+1,0,{durationMs:p.frames[index].durationMs,pixels:[...p.frames[index].pixels]});p.recipe.frameCount=p.frames.length;return p;
}
export function moveSpriteFrame(value,from,to){
  const p=validateSpriteProject(value);frameIndex(p,from);frameIndex(p,to);
  p.frames.splice(to,0,p.frames.splice(from,1)[0]);return p;
}
export function removeSpriteFrame(value,index){
  const p=validateSpriteProject(value);frameIndex(p,index);
  if(p.frames.length===1)throw new RangeError('keep at least one frame');
  p.frames.splice(index,1);p.recipe.frameCount=p.frames.length;return p;
}
export function setSpriteDuration(value,index,durationMs){
  const p=validateSpriteProject(value);frameIndex(p,index);
  p.frames[index].durationMs=integer(durationMs,40,2000,'frame duration');return p;
}
export function spriteFrameAt(value,elapsedMs){
  const p=validateSpriteProject(value);integer(elapsedMs,0,Number.MAX_SAFE_INTEGER,'elapsed milliseconds');
  let time=elapsedMs%p.frames.reduce((sum,f)=>sum+f.durationMs,0);
  for(let i=0;i<p.frames.length;i++){if(time<p.frames[i].durationMs)return i;time-=p.frames[i].durationMs;}
  return 0;
}
export function buildSpriteAtlas(value,{columns=4,padding=1,alphaThreshold=128}={}){
  const p=validateSpriteProject(value),s=p.recipe.size;
  integer(columns,1,16,'atlas columns');integer(padding,0,8,'atlas padding');integer(alphaThreshold,1,255,'mask alpha threshold');
  columns=Math.min(columns,p.frames.length);
  const stride=s+padding*2,width=stride*columns,height=stride*Math.ceil(p.frames.length/columns);
  if(width>1024||height>1024)throw new RangeError('atlas exceeds 1024 pixels per side');
  const rgba=new Uint8Array(width*height*4),frames=p.frames.map((frame,index)=>{
    const x=(index%columns)*stride+padding,y=Math.floor(index/columns)*stride+padding,source=rgbaFrame(p,index),mask=[];
    let minX=s,minY=s,maxX=-1,maxY=-1;
    for(let row=0;row<s;row++)for(let col=0;col<s;col++){
      const pixel=(row*s+col)*4;rgba.set(source.subarray(pixel,pixel+4),((y+row)*width+x+col)*4);
      const solid=source[pixel+3]>=alphaThreshold?1:0;mask.push(solid);
      if(solid){minX=Math.min(minX,col);minY=Math.min(minY,row);maxX=Math.max(maxX,col);maxY=Math.max(maxY,row);}
    }
    return {index,x,y,width:s,height:s,durationMs:frame.durationMs,
      bounds:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1},mask};
  });
  return {rgba,metadata:{format:'qsol.vanillajs.sprite-atlas.v1',implementationVersion:SPRITE_IMPLEMENTATION,
    name:p.name,license:p.license,width,height,columns,padding,alphaThreshold,
    coordinates:'integer pixels; origin top-left; +X right; +Y down',frames}};
}
