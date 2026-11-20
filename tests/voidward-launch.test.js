// SPDX-License-Identifier: Apache-2.0
// Source-only launch-boundary verification: no owner hardware is accessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {voidwardLaunchOptions,verifyVoidwardLab} from '../scripts/browser-voidward.js';

test('CI isolated Chromium retains headless SwiftShader without owner override',()=>{
 const options=voidwardLaunchOptions();
 assert.equal(options.headless,true);
 assert.deepEqual(options.args,['--use-angle=swiftshader','--enable-unsafe-swiftshader']);
 assert.equal(options.executablePath,process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined);
});

test('owner Chrome launches isolated process with exact headed native GPU flags',async()=>{
 const custom={headless:false,executablePath:'/usr/bin/google-chrome',
  args:['--no-sandbox','--enable-gpu-rasterization'],timeout:30000};
 const sentinel=Error('intercepted before browser launch');
 let observed=null,launches=0;
 const caller={browserType:()=>({launch:async options=>{
   launches++;observed=options;throw sentinel;
 }})};
 await assert.rejects(verifyVoidwardLab(caller,'http://127.0.0.1:8765/VANILLAJS/',{
  launchOptions:custom,traceGPU:true
 }),error=>error===sentinel);
 assert.equal(launches,1);
 assert.equal(observed,custom,'isolated browser must inherit the exact trusted owner settings');
 assert.equal(observed.headless,false);
 assert.equal(observed.executablePath,'/usr/bin/google-chrome');
 assert.ok(!observed.args.some(arg=>arg.includes('swiftshader')));
});
