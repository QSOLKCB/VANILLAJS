// SPDX-License-Identifier: Apache-2.0
// Packaged WebGL1 parity: ARCADE-style skipped presentations must keep the
// final composited scene equivalent to an always-redrawn control.
import assert from 'node:assert/strict';

export async function verifyFrameGate(browser,baseURL){
  const page=await browser.newPage({viewport:{width:900,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(baseURL);
    const result=await page.evaluate(async url=>{
      const {FrameGate}=await import(url+'modules/frame-gate/index.js');
      const {WebGLAPI}=await import(url+'api/webgl/index.js');
      const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
      document.body.append(canvas);
      const api=new WebGLAPI(canvas),gate=new FrameGate();
      const mesh=api.createMesh(new Float32Array([
        -.7,-.7,0,.95,.1,.2, .7,-.7,0,.1,.9,.4, 0,.7,0,.2,.3,.95
      ]));
      const digest=()=>{
        const gl=api.gl;gl.finish();
        const pixels=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let sum=2166136261,bright=0;
        for(let i=0;i<pixels.length;i++){
          sum=Math.imul(sum^pixels[i],16777619);
          if(i%4===0&&pixels[i]+pixels[i+1]+pixels[i+2]>120)bright++;
        }
        return {sum,bright};
      };
      const draw=()=>{api.beginFrame();api.draw(mesh);api.endFrame();};
      // At each explicit checkpoint, force a draw of the same scene after
      // gated reuse and compare the rendered pixels without touching the mesh.
      const checkpoints=[],events=[
        {key:'still',w:96,h:96},{key:'still',w:96,h:96},
        {key:'still',w:96,h:96},{key:'moved',w:96,h:96},
        {key:'moved',w:96,h:96},{key:'moved',w:96,h:96},
        {key:'moved',w:96,h:96,epoch:1}
      ];
      for(const [i,event] of events.entries()){
        if(event.key==='moved'&&i===3){
          api.updateMesh(mesh,new Float32Array([
            -.45,-.7,0,.95,.1,.2, .85,-.7,0,.1,.9,.4, .15,.7,0,.2,.3,.95
          ]));
        }
        const drawn=gate.present({
          key:event.key,width:event.w,height:event.h,contextEpoch:event.epoch??0
        },draw);
        let observed=null;
        if(drawn){
          observed=digest();
          draw();
          const forced=digest();
          checkpoints.push({i,observed,forced});
        }
      }
      const stats=gate.stats(),gpu=api.stats();
      api.dispose();canvas.remove();
      return {checkpoints,stats,gpu};
    },baseURL);
    assert.deepEqual(errors,[]);
    assert.equal(result.stats.drawn,3);
    assert.equal(result.stats.skipped,4);
    assert.equal(result.gpu.drawCalls,6,'each actual gate draw has one forced reference');
    for(const point of result.checkpoints){
      assert.ok(point.observed.bright>50);
      assert.deepEqual(point.observed,point.forced);
    }
    console.log('Frame gate: packaged WebGL1 pixels, idle skip, mesh change and context epoch passed.');
  }finally{await page.close();}
}
