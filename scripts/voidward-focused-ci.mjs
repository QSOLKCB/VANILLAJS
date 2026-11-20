// SPDX-License-Identifier: Apache-2.0
// Focused packaged VOIDWARD witness; real Chromium, service worker and offline
// network emulation. Uses the same authoritative browser-voidward.js regression.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {verifyVoidwardLab} from './browser-voidward.js';

const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'../dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css',
 '.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(!pathname.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
  const file=resolve(root,pathname.slice('/VANILLAJS/'.length)||'index.html');
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(file);
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(data);
 }catch(e){res.writeHead(404);res.end(String(e.message));}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const base='http://127.0.0.1:'+server.address().port+'/VANILLAJS/';
 const receipt=await verifyVoidwardLab(browser,base,{out:'browser-artifacts/voidward-focused'});
 if(receipt.status!=='PASS')throw Error('VOIDWARD source-packaged acceptance did not pass');
 console.log(JSON.stringify({kind:'qsol.voidward.focused.v1',status:'PASS',sourceSHA:process.env.GITHUB_SHA??null,
  browser:browser.version(),checks:Object.keys(receipt.checks),offline:receipt.checks.offline}));
}finally{
 await browser?.close();await new Promise(ok=>server.close(ok));
}
