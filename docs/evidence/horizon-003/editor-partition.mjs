// SPDX-License-Identifier: Apache-2.0
// Reproduction of the executed /tmp launcher with machine paths parameterized.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const checkout=process.cwd(),root=resolve(checkout,'dist');
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!path.startsWith('/VANILLAJS/'))throw Error('prefix');const file=resolve(root,path.slice('/VANILLAJS/'.length)||'index.html');if(!file.startsWith(root+sep))throw Error('path');const bytes=await readFile(file);res.writeHead(200,{'content-type':({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'})[extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const base=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
const source=await readFile(resolve(checkout,'scripts/browser-check.js'),'utf8');
const all=[...source.matchAll(/runSuite\('editor','([^']+)','([^']+)'\)/g)].map(m=>({file:m[1],name:m[2]}));
const mode=process.argv[2];if(!['new','legacy'].includes(mode))throw Error('new or legacy required');
const fresh=new Set(['checkHorizonRace','checkHorizonExport','checkHorizonRaceStartup']);
const selected=all.filter(row=>fresh.has(row.name)===(mode==='new'));
if(all.length!==19||selected.length!==(mode==='new'?3:16))throw Error('Review changed editor suite inventory '+all.length);
for(const {file,name} of selected){console.log('EXECUTE '+name);const fn=(await import(resolve(checkout,'scripts',file.slice(2))))[name];await fn(browser,base);}
console.log('Editor partition passed: '+mode+'; '+selected.map(r=>r.name).join(','));}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
