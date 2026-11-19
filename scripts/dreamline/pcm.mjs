// SPDX-License-Identifier: Apache-2.0
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {synthesize,fixture,RATE} from '../../demos/dreamline/music.js';
const [source,output]=process.argv.slice(2);
const score=source==='--fixture'?fixture():JSON.parse(await readFile(source,'utf8'));
const pcm=synthesize(score,RATE*600),wav=Buffer.alloc(44+pcm.length*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(RATE,24);wav.writeUInt32LE(RATE*4,28);
wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length*2,40);
for(let i=0;i<pcm.length;i++)wav.writeInt16LE(pcm[i],44+2*i);
await writeFile(output,wav,{flag:'wx'});
const hash=data=>createHash('sha256').update(data).digest('hex');
console.log(JSON.stringify({node:process.version,frames:score.frames,source:score.source,pcm16le:hash(wav.subarray(44)),wav:hash(wav)}));
