// SPDX-License-Identifier: Apache-2.0
// Hosted-CI invariant: reuse only pinned Playwright tooling. Source-bound
// PASS witness reuse is controlled *separately* by browser-suite-cache.mjs,
// and only for identical closures from reviewed main. This preflight always
// launches real Chromium; all stale or unknown suites always execute.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const PIN='1.64.0';
const within=(parent,child)=>{
  const rel=relative(parent,child);
  return rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel));
};

export function loadPinnedTooling({runnerTemp,browsersPath}={}){
  if(!runnerTemp||!browsersPath||!isAbsolute(runnerTemp)||!isAbsolute(browsersPath))
    throw Error('RUNNER_TEMP and PLAYWRIGHT_BROWSERS_PATH must both be absolute paths');
  const root=resolve(runnerTemp,'flight-browser');
  if(resolve(browsersPath)!==join(root,'browsers'))
    throw Error('Expected dedicated isolated browser path inside RUNNER_TEMP/flight-browser');
  const pkgDir=realpathSync(join(root,'node_modules','playwright'));
  if(!within(root,pkgDir))throw Error('Playwright module escapes the isolated tooling directory');
  const metadata=JSON.parse(readFileSync(join(pkgDir,'package.json'),'utf8'));
  assert.equal(metadata.name,'playwright','Package must be genuine playwright');
  assert.equal(metadata.version,PIN,'Playwright version mismatch: do not reuse stale cache');
  const coreDir=realpathSync(join(root,'node_modules','playwright-core'));
  if(!within(root,coreDir))throw Error('Playwright core module escapes the isolated tooling directory');
  const core=JSON.parse(readFileSync(join(coreDir,'package.json'),'utf8'));
  assert.equal(core.name,'playwright-core');
  assert.equal(core.version,PIN,'Playwright core must match pinned Playwright');
  const {chromium}=require(pkgDir);
  if(typeof chromium?.launch!=='function')throw Error('Pinned Playwright missing Chromium launcher');
  return {chromium,version:metadata.version};
}

async function main(){
  const {chromium,version}=loadPinnedTooling({
    runnerTemp:process.env.RUNNER_TEMP,
    browsersPath:process.env.PLAYWRIGHT_BROWSERS_PATH
  });
  // BrowserType.executablePath() points at the headed binary, which --only-shell
  // intentionally does not download. Launching headless proves the actual shell.
  const browser=await chromium.launch({headless:true,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const binaryVersion=await browser.version();
    const browserManifest=readFileSync(join(process.env.RUNNER_TEMP,'flight-browser/node_modules/playwright-core/browsers.json'));
    const environment={node:process.version,platform:process.platform,arch:process.arch,
      imageVersion:process.env.ImageVersion??'local-untrusted',playwright:version,chromium:binaryVersion,
      browserManifestSHA256:createHash('sha256').update(browserManifest).digest('hex'),
      renderer:'headless-swiftshader',locale:'default',timezone:process.env.TZ??'system'};
    writeFileSync(join(process.env.RUNNER_TEMP,'flight-browser-environment.json'),JSON.stringify(environment)+'\n');
    console.log('PASS: pinned Playwright '+version+' headless Chromium '+binaryVersion+
      ' launches from cached/isolated tooling; full browser suite still required.');
  }finally{await browser.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(err=>{console.error('FLIGHT LAB TOOLING PREFLIGHT FAILED: '+err.stack);process.exitCode=1;});
}
