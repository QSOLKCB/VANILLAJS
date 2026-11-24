// SPDX-License-Identifier: Apache-2.0
// Playwright is isolated CI tooling. Each scenario gets its original packaged HTTP origin.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {performance} from 'node:perf_hooks';
import {SUITES,selectedChecks} from './browser-shards.mjs';

const args=process.argv.slice(2);
if(args.length>2||args.some(arg=>!/^--(suites|shard)=.+$/.test(arg))||
    new Set(args.map(arg=>arg.split('=')[0])).size!==args.length)
  throw Error('usage: browser-check.js [--suites=home,render,...] [--shard=NAME]');
const suites=args.find(arg=>arg.startsWith('--suites='))?.slice(9).split(',')??SUITES;
const shard=args.find(arg=>arg.startsWith('--shard='))?.slice(8);
const checks=selectedChecks(suites,shard);
if(!checks.length)throw Error('empty browser assignment');
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=resolve(import.meta.dirname,'../dist');
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const path=resolve(root,pathname.slice('/VANILLAJS/'.length)||'index.html');
    if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'text/plain');res.end(data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
await mkdir('browser-artifacts',{recursive:true});
const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const passed=[];
try{
  for(const {id,file,name} of checks){
    const started=performance.now();
    console.log('Browser START '+id);
    try{
      const scenario=(await import(file))[name];
      await scenario(browser,base);
      const ms=Math.round(performance.now()-started);
      passed.push({id,ms});
      console.log('Browser PASS '+id+' ('+(ms/1000).toFixed(2)+'s)');
    }catch(error){
      console.error('Browser FAIL '+id);
      throw error;
    }
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
if(process.env.FLIGHT_CHECK_REPORT)
  await writeFile(process.env.FLIGHT_CHECK_REPORT,JSON.stringify(passed)+'\n',{flag:'wx'});
console.log('Browser verification finished for '+passed.length+' checks.');
