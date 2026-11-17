// SPDX-License-Identifier: Apache-2.0
// Owner-local, paired packaged-renderer comparison. No installs or network fetches.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {captureRaceFrames} from './horizon-frame-workload.mjs';

const base = '6e4831d61f284ba6b92c33ecf598897c46eb1204';
const [candidate, destination, mode = 'hardware', ...extra] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/.test(candidate) || !destination || !['hardware','diagnostic'].includes(mode) || extra.length)
  throw Error('Usage: node scripts/compare-horizon-frames.mjs CANDIDATE_SHA NEW_OUTPUT_DIR [hardware|diagnostic]');
assert.notEqual(candidate, base, 'candidate must differ from baseline');
const out = resolve(destination);
const root = resolve(import.meta.dirname, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['-C',root,...args], {encoding:'utf8'}).trim();
const origin = 'http://127.0.0.1';
const viewport = {width:1280, height:720};
const frames = mode === 'hardware' ? 120 : 3;
const report = {schema:'qsol.horizon.frame-comparison.v1',mode,base,candidate,viewport,deviceScaleFactor:1,
  frames, node:process.version, frameBudgetMs:16.67, runs:{}, comparison:[]};
const {chromium} = createRequire(import.meta.url)('playwright');

async function measure(browser, label, sha) {
  assert.equal(git('rev-parse',sha+'^{commit}'), sha);
  const temp = await mkdtemp(join(tmpdir(),'horizon-frames-'));
  const checkout = join(temp,'tree');
  try {
    git('worktree','add','--quiet','--detach',checkout,sha);
    for (const script of ['build.js','verify-offline.js'])
      execFileSync(process.execPath,['scripts/'+script],{cwd:checkout,stdio:'inherit'});
    const dist = join(checkout,'dist');
    const manifest = await readFile(join(dist,'manifest.json'));
    const paths = new Set(JSON.parse(manifest).files.map(row=>row.path));
    const html = await readFile(join(dist,'demos/horizon-lab/index.html'),'utf8');
    const [,entry] = html.match(/src="\.\/(runtime-[a-f0-9]{64}\/demos\/horizon-lab\/)race-start\.js"/) || [];
    assert.ok(entry, 'expected versioned race entry in packaged index');
    const runtime = origin+'/demos/horizon-lab/'+entry;
    const result = {sha,manifestSHA256:hash(manifest),runtime:entry,profiles:{}};
    report.runs[label] = result;
    for (const profile of ['low','high']) {
      const context = await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block'});
      try {
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== origin) return route.abort();
          if (url.pathname === '/fixture') return route.fulfill({contentType:'text/html',
            body:'<!doctype html><style>*{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>'});
          const path = url.pathname.slice(1);
          if (!paths.has(path) || !path.endsWith('.js')) return route.abort();
          return route.fulfill({path:join(dist,path),contentType:'text/javascript'});
        });
        const page = await context.newPage();
        await page.goto(origin+'/fixture');
        let timer;
        let data;
        try {
          data = await Promise.race([
            page.evaluate(captureRaceFrames,{runtime,profile,frames}),
            new Promise((_,reject) => {
              timer = setTimeout(() => reject(Error('Visible frame workload timed out')), 180_000);
            })
          ]);
        } finally { clearTimeout(timer); }
        if (mode === 'hardware') {
          assert.ok(data.renderer && /nvidia|radeon|intel|apple|adreno|mali/i.test(data.renderer)
            && !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(data.renderer),
          'Physical WebGL renderer required. Reported renderer: '+data.renderer);
        }
        result.profiles[profile] = data;
        for (const [scene,row] of Object.entries(data.scenes)) {
          const bytes = Buffer.from(row.image.split(',')[1],'base64');
          delete row.image;
          row.file = [label,profile,scene].join('-')+'.png';
          row.imageSHA256 = hash(bytes);
          await writeFile(join(out,row.file),bytes,{flag:'wx'});
          for (const key of ['workMs','intervalMs']) {
            const samples = row[key];
            assert.ok(samples.length === frames && samples.every(x=>Number.isFinite(x) && x>0));
            const sorted = samples.toSorted((a,b)=>a-b);
            row[key+'Percentiles'] = Object.fromEntries([1,50,95].map(p=>['p'+p,sorted[Math.ceil(p*frames/100)-1]]));
          }
        }
      } finally { await context.close(); }
    }
  } finally {
    // Only remove the disposable checkout that this invocation created.
    if (git('worktree','list','--porcelain').split('\n').includes('worktree '+checkout))
      git('worktree','remove','--force',checkout);
    await rm(temp,{recursive:true,force:true});
  }
}

await mkdir(out);
let browser;
try {
  report.toolSHA256 = {};
  for (const file of ['compare-horizon-frames.mjs','horizon-frame-workload.mjs'])
    report.toolSHA256[file] = hash(await readFile(join(import.meta.dirname,file)));
  browser = await chromium.launch({headless:mode === 'diagnostic',
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args:mode === 'diagnostic' ? ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] : []});
  report.browser = browser.version();
  const cdp = await browser.newBrowserCDPSession();
  const {gpu} = await cdp.send('SystemInfo.getInfo');
  report.devices = gpu.devices;
  if (mode === 'hardware') assert.ok(gpu.devices.some(d=>d.driverVersion), 'GPU driver identity required');
  await measure(browser,'baseline',base);
  await measure(browser,'candidate',candidate);
  for (const profile of ['low','high']) {
    const a = report.runs.baseline.profiles[profile], b = report.runs.candidate.profiles[profile];
    assert.deepEqual(a.project,b.project,'matched race recipe');
    assert.equal(a.renderer,b.renderer,'matched WebGL renderer');
    for (const [scene,before] of Object.entries(a.scenes)) {
      const after = b.scenes[scene];
      for (const key of ['start','end','camera','resolution']) assert.deepEqual(before[key],after[key],profile+' '+scene+' '+key);
      report.comparison.push({profile,scene,baselineP95Ms:before.workMsPercentiles.p95,
        candidateP95Ms:after.workMsPercentiles.p95,deltaMs:after.workMsPercentiles.p95-before.workMsPercentiles.p95,
        withinWorkBudget:after.workMsPercentiles.p95 <= report.frameBudgetMs});
    }
  }
  report.status = mode === 'diagnostic' ? 'DIAGNOSTIC' :
    report.comparison.every(row=>row.withinWorkBudget) ? 'MEASURED_REVIEW_REQUIRED' : 'OVER_BUDGET';
  if (report.status === 'OVER_BUDGET') process.exitCode = 1;
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  throw error;
} finally {
  await writeFile(join(out,'comparison.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  await browser?.close();
}
console.log(report.status, join(out,'comparison.json'));
