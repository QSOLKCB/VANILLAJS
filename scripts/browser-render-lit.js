// SPDX-License-Identifier: Apache-2.0
// Real WebGL1 pixels and native context lifecycle; software GPU is not hardware evidence.
import assert from 'node:assert/strict';
export async function checkRenderLit(browser,base){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(base);
    const result=await page.evaluate(async()=>{
      const {LitRenderer,LIT_PROFILES}=await import('/VANILLAJS/modules/render-lit/index.js');
      const {SCENIC_FORMAT,buildScenicWorld}=await import('/VANILLAJS/modules/scenic3d/index.js');
      const canvas=document.createElement('canvas');canvas.style.cssText='width:128px;height:128px';document.body.append(canvas);
      const r=new LitRenderer(canvas,{profile:'high'}),data=new Float32Array([
        -1.5,-1.5,0,0,0,1,1,1,1,0,0, 1.5,-1.5,0,0,0,1,1,1,1,1,0, 1.5,1.5,0,0,0,1,1,1,1,1,1,
        -1.5,-1.5,0,0,0,1,1,1,1,0,0, 1.5,1.5,0,0,0,1,1,1,1,1,1, -1.5,1.5,0,0,0,1,1,1,1,0,1]);
      const mesh=r.mesh(data),gl=r.gl;
      const pixels=()=>{gl.finish();const bytes=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619);const i=((canvas.height>>1)*canvas.width+(canvas.width>>1))*4;return {hash,center:[...bytes.slice(i,i+4)],error:gl.getError()};};
      const frame=(material={},settings={},matrix)=>{r.begin([0,0,4],[0,0,0,1],{ambient:.12,sunDirection:[0,0,1],fogDensity:0,...settings});r.draw(mesh,{material:{color:[.2,.4,.8],roughness:.65,...material},...(matrix?{matrix}:{})});return pixels();};
      const first=frame(),again=frame();const uploads=r.stats().uploads;r.update(mesh,data);const repeated=frame();
      const dark=frame({},{sunDirection:[0,0,-1]}),smooth=frame({roughness:.05,metalness:.7},{sunDirection:[.2,0,1]}),rough=frame({roughness:1,metalness:.7},{sunDirection:[.2,0,1]});
      const patterns=Object.fromEntries(['none','asphalt','stone','grass'].map(pattern=>[pattern,frame({pattern,patternScale:4}).hash]));
      const fog=frame({},{fogDensity:.1,fogColor:[1,0,0]}),glass=frame({pattern:'glass',opacity:.35,roughness:.08});
      const before=r.stats();let rejected=false;try{r.update(mesh,new Float32Array([NaN]));}catch{rejected=true;}const afterRejected=frame();
      const shadow=()=>{r.begin([0,0,4],[0,0,0,1],{ambient:1,sunColor:[0,0,0],fogDensity:0});r.draw(mesh,{material:{color:[1,1,1]}});r.draw(mesh,{matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,.01,1],material:{color:[0,0,0],pattern:'shadow',opacity:.65}});return pixels();};
      const shadowed=shadow();
      // The same visible plane supplies two independently oriented normals: a
      // curved metallic finish must distinguish reflected sky from dark ground.
      // No geometry position or light changes between these two measurements.
      const probeData=new Float32Array(data),probe=r.mesh(probeData);
      const probeFrame=(normal,uv,material,settings)=>{
        for(let i=0;i<probeData.length;i+=11){probeData.set(normal,i+3);probeData.set(uv,i+9);}
        r.update(probe,probeData);r.begin([0,0,4],[0,0,0,1],{ambient:0,sunColor:[0,0,0],fogDensity:0,...settings});r.draw(probe,{material});return pixels();
      };
      const reflective={color:[.45,.45,.45],metalness:1,roughness:.1},environment={skyTop:[.8,.9,1],skyBottom:[.8,.8,.8]};
      const reflectedSky=probeFrame([0,Math.SQRT1_2,Math.SQRT1_2],[0,0],reflective,environment);
      const reflectedGround=probeFrame([0,-Math.SQRT1_2,Math.SQRT1_2],[0,0],reflective,environment);
      // Crossing each former grass hash-cell boundary by a tiny UV amount must
      // no longer cause a visible color step. These are native pixel reads, not
      // a duplicate CPU implementation of the new smooth material field.
      const grassContinuity=[];
      for(let i=1;i<=8;i++){
        const material={color:[.4,.5,.3],roughness:1,pattern:'grass'},settings={ambient:1,skyTop:[0,0,0],skyBottom:[0,0,0]};
        const left=probeFrame([0,0,1],[i/25-.00001,.12],material,settings),right=probeFrame([0,0,1],[i/25+.00001,.12],material,settings);
        grassContinuity.push({left:left.center,right:right.center,error:left.error||right.error});
      }
      r.deleteMesh(probe);r.deleteMesh(mesh);let stale=false;try{r.draw(mesh);}catch{stale=true;}r.dispose();
      // OPT control: compile the actual material shader with only softNoise
      // replaced by its scalar, four-corner reference. Compare complete native
      // pixel buffers in both profiles, including negative and wrapping UVs.
      // A wrong corner must change pixels: the comparison cannot be vacuous.
      const scalarNoise='float softNoise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(grain(a),grain(a+vec2(1.0,0.0)),f.x),mix(grain(a+vec2(0.0,1.0)),grain(a+vec2(1.0,1.0)),f.x),f.y);}';
      const noiseSweeps=[{pattern:'grass',min:[-256,-128],max:[256,128],scale:1},{pattern:'grass',min:[-2,-.2],max:[2,.2],scale:256},{pattern:'asphalt',min:[-64,-128],max:[64,128],scale:2},{pattern:'stone',min:[-130,-130],max:[130,130],scale:.1}],noiseParity=[];
      for(const profile of ['low','high']){
        let expected;const record={profile,cases:noiseSweeps.length,equal:true,mutantChanged:false,errors:[]};
        for(const mode of ['actual','scalar','mutant']){
          const c=document.createElement('canvas');c.style.cssText='width:128px;height:128px';document.body.append(c);const g=c.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false}),shaderSource=g.shaderSource.bind(g);let replaced=0;
          g.shaderSource=(shader,source)=>{
            const start=source.indexOf('float softNoise('),end=source.indexOf('\nvec3 reflectedEnvironment',start);
            if(start>=0){if(end<start)throw Error('Material noise reference boundary missing');replaced++;if(mode!=='actual')source=source.slice(0,start)+(mode==='scalar'?scalarNoise:scalarNoise.replace('grain(a+vec2(1.0,1.0))','grain(a+vec2(3.0,1.0))'))+source.slice(end);}
            shaderSource(shader,source);
          };
          const renderer=new LitRenderer(c,{profile}),handle=renderer.mesh(data),frames=[];g.shaderSource=shaderSource;
          if(replaced!==1)throw Error('Expected exactly one actual material shader');
          for(const sweep of noiseSweeps){
            const vertices=new Float32Array(data);for(let i=0;i<vertices.length;i+=11)for(let axis=0;axis<2;axis++)vertices[i+9+axis]=sweep.min[axis]+data[i+9+axis]*(sweep.max[axis]-sweep.min[axis]);
            renderer.update(handle,vertices);renderer.begin([0,0,4],[0,0,0,1],{ambient:1,sunColor:[0,0,0],skyTop:[0,0,0],skyBottom:[0,0,0],fogDensity:0});renderer.draw(handle,{material:{color:[.4,.5,.3],roughness:1,pattern:sweep.pattern,patternScale:sweep.scale}});
            const bytes=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,bytes);frames.push(bytes);record.errors.push(g.getError());
          }
          if(mode==='actual')expected=frames;else for(let i=0;i<frames.length;i++){const equal=frames[i].every((value,j)=>value===expected[i][j]);if(mode==='scalar')record.equal&&=equal;else record.mutantChanged||=!equal;}
          renderer.dispose();c.remove();
        }
        noiseParity.push(record);
      }
      // Real generated embankment faces under an overhead light. A below-surface
      // light is the negative control; inverted normals reverse these results.
      const world=buildScenicWorld({format:SCENIC_FORMAT,version:1,name:'Bank lighting reference',seed:1,profile:'low',environment:'alpine',road:[0,1,2,3].map(i=>({id:'bank-'+i,x:0,y:4,z:-30*i,width:9,bank:0,structure:'ground',surface:'asphalt'}))});
      const terrain=world.batches.find(batch=>batch.id==='terrain').vertices,bankCanvas=document.createElement('canvas');bankCanvas.style.cssText='width:128px;height:128px';document.body.append(bankCanvas);
      const bankRenderer=new LitRenderer(bankCanvas),bankGL=bankRenderer.gl,bankLighting=[];
      for(let face=0;face<4;face++){
        const start=56*56*6*11+face*33,vertices=terrain.slice(start,start+33),handle=bankRenderer.mesh(vertices),center=[0,1,2].map(axis=>(vertices[axis]+vertices[11+axis]+vertices[22+axis])/3);
        const light=direction=>{
          bankRenderer.begin([center[0],center[1]+10,center[2]],[-Math.SQRT1_2,0,0,Math.SQRT1_2],{fov:.6,ambient:0,sunDirection:direction,sunColor:[1,1,1],skyTop:[0,0,0],skyBottom:[0,0,0],fogDensity:0});
          bankRenderer.draw(handle,{material:{color:[.8,.8,.8],roughness:1}});bankGL.finish();const pixel=new Uint8Array(4);bankGL.readPixels(64,64,1,1,bankGL.RGBA,bankGL.UNSIGNED_BYTE,pixel);return [...pixel];
        };
        bankLighting.push({above:light([0,1,0]),below:light([0,-1,0]),error:bankGL.getError()});bankRenderer.deleteMesh(handle);
      }
      bankRenderer.dispose();
      const lowCanvas=document.createElement('canvas');lowCanvas.style.cssText='width:3000px;height:2000px';document.body.append(lowCanvas);const low=new LitRenderer(lowCanvas,{profile:'low',pixelRatio:2});low.begin([0,0,4],[0,0,0,1]);const lowPixels=lowCanvas.width*lowCanvas.height;low.dispose();
      // Native WEBGL_lose_context invalidates all old handles. Recovery uses a new
      // explicitly owned renderer, with source geometry supplied again by the app.
      const c=document.createElement('canvas');c.style.cssText='width:96px;height:96px';document.body.append(c);const original=new LitRenderer(c),oldMesh=original.mesh(data),extension=original.gl.getExtension('WEBGL_lose_context');
      if(!extension)throw Error('Native WebGL context-loss extension unavailable in this verification browser');
      const nativeEvent=type=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(type+' timed out')),15000);c.addEventListener(type,()=>{clearTimeout(timer);resolve();},{once:true});});
      const lost=nativeEvent('webglcontextlost');extension.loseContext();await lost;
      let lostRejected=false;try{original.begin([0,0,4],[0,0,0,1]);}catch{lostRejected=true;}
      const restored=nativeEvent('webglcontextrestored');await new Promise(resolve=>setTimeout(resolve,100));extension.restoreContext();await restored;original.dispose();
      const recovered=new LitRenderer(c),newMesh=recovered.mesh(data);recovered.begin([0,0,4],[0,0,0,1]);recovered.draw(newMesh);let foreign=false;try{recovered.draw(oldMesh);}catch{foreign=true;}const recoveredError=recovered.gl.getError();recovered.dispose();
      return {first,again,repeated,uploads,afterUploads:before.uploads,dark,smooth,rough,patterns,fog,glass,rejected,afterRejected,shadowed,reflectedSky,reflectedGround,grassContinuity,noiseParity,bankLighting,stale,disposed:r.stats().disposed,lowPixels,lowBudget:LIT_PROFILES.low.maxPixels,lostRejected,foreign,recoveredError};
    });
    assert.equal(result.first.error,0,'native WebGL1 frame has no GL error');assert.deepEqual(result.first,result.again);assert.deepEqual(result.first,result.repeated);assert.equal(result.afterUploads,result.uploads,'retained draws and identical updates do not reupload');
    assert.ok(result.first.center[2]>result.dark.center[2]+50,'directional light changes actual surface pixels');assert.notEqual(result.smooth.hash,result.rough.hash,'roughness controls actual finish');assert.equal(new Set(Object.values(result.patterns)).size,4,'procedural material textures differ');
    assert.ok(result.fog.center[0]>result.first.center[0]+30,'distance fog blends toward its specified color');assert.notEqual(result.glass.hash,result.first.hash,'glass changes the rendered finish/transmission');
    assert.equal(result.rejected,true);assert.deepEqual(result.afterRejected,result.first,'rejected mesh retains accepted native pixels');assert.ok(result.shadowed.center[0]<150,'contact patch darkens real receiving geometry');assert.equal(result.shadowed.error,0);
    assert.equal(result.reflectedSky.error,0);assert.equal(result.reflectedGround.error,0);
    assert.ok(result.reflectedSky.center[2]>result.reflectedGround.center[2]+30,'smooth metallic normals must distinguish analytic sky and ground reflections');
    for(const pair of result.grassContinuity){assert.equal(pair.error,0);assert.ok(pair.left.slice(0,3).every((value,i)=>Math.abs(value-pair.right[i])<=2),'tiny terrain UV changes must not cross visible hard noise cells');}
    for(const probe of result.noiseParity){assert.ok(probe.errors.every(error=>error===0),'native noise reference draws have no GL error');assert.equal(probe.equal,true,probe.profile+' vectorized noise must preserve scalar-reference pixels');assert.equal(probe.mutantChanged,true,probe.profile+' wrong noise corner must fail native pixel parity');}
    for(const [face,lighting] of result.bankLighting.entries()){
      assert.equal(lighting.error,0);assert.ok(lighting.above[0]>40&&lighting.above[0]>lighting.below[0]+40,`embankment face ${face} must receive overhead light in actual native pixels: ${JSON.stringify(lighting)}`);assert.ok(lighting.below[0]<5,'below-surface light must not illuminate an outward bank');
    }
    assert.equal(result.stale,true);assert.equal(result.disposed,true);assert.ok(result.lowPixels<=result.lowBudget);assert.equal(result.lostRejected,true);assert.equal(result.foreign,true);assert.equal(result.recoveredError,0);assert.deepEqual(errors,[]);
    console.log('Lit WebGL1: actual directional/roughness/procedural texture/glass/fog/contact-shadow, curved sky/ground reflections, continuous terrain color, scalar/vector noise pixel parity with negative control and outward-embankment pixels, retained geometry, rejected upload, low-profile budget, disposal and native context-loss/recreation PASS');
  }finally{await context.close();}
}
