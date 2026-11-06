// SPDX-License-Identifier: Apache-2.0
// Packaged, actual WebGL1 browser check: byte-exact reuse must preserve pixels.
import assert from 'node:assert/strict';

export async function verifyWebGLAPI(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1000,height:760}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(baseURL);
    const result=await page.evaluate(async url=>{
      const {WebGLAPI}=await import(url);
      const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
      canvas.style.cssText='width:96px;height:96px;display:block';
      document.body.append(canvas);
      const api=new WebGLAPI(canvas);
      const data=new Float32Array([
        -.8,-.8,0,1,0,0, .8,-.8,0,0,1,0, 0,.8,0,0,0,1
      ]);
      const mesh=api.createMesh(data);
      const rgba=()=>{
        api.gl.finish();
        const pixels=new Uint8Array(canvas.width*canvas.height*4);
        api.gl.readPixels(0,0,canvas.width,canvas.height,api.gl.RGBA,
          api.gl.UNSIGNED_BYTE,pixels);
        let hash=2166136261,bright=0;
        for(let i=0;i<pixels.length;i++){
          hash=Math.imul(hash^pixels[i],16777619);
          if(i%4===0&&pixels[i]+pixels[i+1]+pixels[i+2]>115)bright++;
        }
        return {hash,bright};
      };
      const frame=()=>{api.beginFrame();api.draw(mesh);api.endFrame();return rgba();};
      const first=frame(),skipped=api.updateMesh(mesh,data),second=frame();
      data[0]=-.15; // visible shape change invalidates byte snapshot
      const written=api.updateMesh(mesh,data),third=frame();
      const beforeDispose=api.stats();
      api.deleteMesh(mesh);
      let staleRejected=false;
      try{api.draw(mesh);}catch(e){staleRejected=/unknown|deleted|foreign/.test(e.message);}
      api.dispose();
      return {first,second,third,skipped,written,beforeDispose,staleRejected};
    },baseURL+'api/webgl/index.js');
    assert.ok(result.first.bright>75,'WebGL API must render nonblank triangle');
    assert.deepEqual(result.second,result.first,'unchanged upload keeps native pixel parity');
    assert.notEqual(result.third.hash,result.first.hash,'changed coordinates must alter rendered pixels');
    assert.equal(result.skipped,false,'identical update should be skipped');
    assert.equal(result.written,true,'changed input should upload');
    assert.equal(result.beforeDispose.bufferData,1,'retained storage allocation');
    assert.equal(result.beforeDispose.bufferSubData,1,'only changed bytes uploaded');
    assert.equal(result.beforeDispose.skippedIdentical,1,'explicit no-change evidence');
    assert.equal(result.staleRejected,true,'deleted GPU handles must fail closed');
    assert.deepEqual(errors,[],'no browser JavaScript errors');
    console.log('WebGL API: 96x96 native WebGL1 pixel parity, exact no-op reuse, changed upload and stale-handle rejection passed.');
  }finally{await page.close();}
}
