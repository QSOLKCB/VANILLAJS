// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {packageGame} from '../scripts/export-game.js';
import {createForgeScene} from '../demos/editor/model.js';
import {createAssetLibrary,serializeProject} from '../demos/editor/asset-foundry.js';
import {buildLoopPack,firstGateSweep} from '../demos/circuit-mod-lab/builder.js';
import {compileCircuitQ16,newCircuitProgress,advanceCircuitQ16} from '../modules/exact-circuit/index.js';

test('complete game packages are repeatable, local, dependency-closed and content-bound',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'creator-package-'));
  try{
    const input=join(dir,'input.json'),scene=createForgeScene();scene.name='</script><script>alert(1)</script>';
    await writeFile(input,serializeProject(scene,createAssetLibrary(),{optionalGPU:true}));
    const out=join(dir,'game'),second=join(dir,'repeat');
    await packageGame(input,out);await packageGame(input,second);
    const manifest=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
    assert.equal(await readFile(join(out,'manifest.json'),'utf8'),await readFile(join(second,'manifest.json'),'utf8'));
    const paths=new Set(manifest.files.map(f=>f.path));
    for(const required of ['index.html','LICENSE','NOTICE','offline/register.js','service-worker.js','modules/render-optional/webgpu.js','modules/render-optional/wasm-bytes.js'])assert.ok(paths.has(required),required);
    assert.ok(![...paths].some(p=>/vendor|node_modules|\/app.js|4x-game-lab|scripts\//.test(p)));
    for(const entry of manifest.files){
      const bytes=await readFile(join(out,entry.path));
      assert.equal(bytes.length,entry.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
      if(!entry.path.endsWith('.js')||entry.path==='service-worker.js')continue;
      for(const m of bytes.toString().matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)){
        assert.ok(m[1].startsWith('.'));assert.ok(paths.has(posix.normalize(posix.join(dirname(entry.path),m[1]))),m[1]);
      }
    }
    const html=await readFile(join(out,'index.html'),'utf8');
    assert.ok(!html.includes('<script>alert(1)</script>'));assert.match(html,/id="restart"/);
    await assert.rejects(()=>packageGame(input,out),/EEXIST/);
    assert.equal(await readFile(join(out,'manifest.json'),'utf8'),await readFile(join(second,'manifest.json'),'utf8'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('invalid and oversized projects never create output',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'creator-reject-'));
  try{for(const bytes of ['{}','x'.repeat(256*1024+1)]){
    const file=join(dir,'bad.json'),out=join(dir,'output');await writeFile(file,bytes);
    await assert.rejects(()=>packageGame(file,out));await assert.rejects(()=>access(out));
  }}finally{await rm(dir,{recursive:true,force:true});}
});
test('loop form compiles cardinal geometry and its synthetic first crossing matches each course',()=>{
  for(const width of [40,81,400])for(const depth of [40,79,400]){
    const pack=buildLoopPack({width,depth,laps:9,aperture:4});
    const course=compileCircuitQ16(pack.entries[0].data.course),{from,to}=firstGateSweep(course);
    const result=advanceCircuitQ16(course,newCircuitProgress(course),from,to);
    assert.equal(result.crossed,1);assert.equal(result.nextGate,1);assert.equal(result.completedLaps,0);
    assert.equal(advanceCircuitQ16(course,newCircuitProgress(course),to,from).crossed,0);
    assert.equal(advanceCircuitQ16(course,newCircuitProgress(course),from,to,{contact:true}).crossed,0);
  }
  for(const spec of [{width:NaN},{depth:0},{laps:1.5},{aperture:31},{width:'80'}])assert.throws(()=>buildLoopPack(spec));
});
