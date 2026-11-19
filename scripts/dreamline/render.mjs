// SPDX-License-Identifier: Apache-2.0
// Optional local Skia canvas host for the same ES-module film shown in the browser.
import {createRequire} from 'node:module';
import {open,readFile,stat} from 'node:fs/promises';
import {once} from 'node:events';
import {createFilm,defaults} from '../../demos/dreamline/film.js';
import {fixture,synthesize,validateScore,FRAMES} from '../../demos/dreamline/music.js';
const require=createRequire(import.meta.url),{createCanvas}=require('@napi-rs/canvas');
const [mode,source,references,first="0",last="2700"]=process.argv.slice(2);
if(!['full','fixture','probes','fixture-probes'].includes(mode))throw Error('Invalid render profile');
const short=mode.startsWith('fixture'),probes=mode.endsWith('probes');
if(short&&source!=='--fixture')throw Error('CI clips require the independent fixture');
if(source!=='--fixture'&&(await stat(source)).size>1000000)throw Error('Score exceeds budget');
const score=source==='--fixture'?fixture():validateScore(JSON.parse(await readFile(source,'utf8')));
if(score.frames!==FRAMES)throw Error('A complete 90-second edit is required');
const width=short?320:1920,height=width*9/16;
const canvas=createCanvas(width,height),road=createCanvas(width,height),thumb=createCanvas(32,18);
const film=createFilm(canvas,road,score,synthesize(score)),ctx=thumb.getContext('2d');
const begin=Number(first),end=Number(last);
if(!Number.isInteger(begin)||!Number.isInteger(end)||begin<0||begin>=end||end>2700)throw Error('Invalid frame interval');
const refs=await open(references,'wx');
const cuts=[240,660,1200,1830,2460],probeOffsets=[0,3,7];
const positions=short?cuts.flatMap(f=>Array.from({length:12},(_,i)=>f+i)):Array.from({length:2700},(_,i)=>i);
try{
  for(const [i,frame] of positions.entries()){
    if(i<begin||i>=end)continue;
    if(probes&&!cuts.some(c=>probeOffsets.includes(frame-c)))continue;
    film.draw(frame*1600,defaults);
    thumb.width=32;ctx.drawImage(canvas,0,0,32,18);
    const bytes=ctx.getImageData(0,0,32,18).data;
    const rgb=Buffer.alloc(32*18*3);
    for(let j=0;j<576;j++)rgb.set(bytes.subarray(j*4,j*4+3),j*3);
    await refs.write(rgb);
    if(!probes){
      const jpg=canvas.toBuffer('image/jpeg',92);
      if(!process.stdout.write(jpg))await once(process.stdout,'drain');
    }
    // Flush each raster display list before constructing another native frame.
    canvas.width=width;
    if(i%300===0)console.error('composition frame',frame);
  }
}finally{await refs.close();film.dispose();}
