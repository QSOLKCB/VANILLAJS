// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInvariantWorkload} from '../scripts/ci-invariant-workload.mjs';
import {SUITES} from '../scripts/browser-suite-cache.mjs';
import {hash,gitBlob} from '../scripts/browser-dependencies.mjs';

// Synthetic sources only: do not change or grant audit status to real files.
function fixture(){
  const roots=['flight-lab','integer-foundry','interaction-lab','rts-lab','omi-lab','gpu-lab','editor'],
    sources={'modules/math/index.js':'export const x=1;',
      'modules/navigation/index.js':'export const x=2;',
      'modules/exact-rational/index.js':'export const exact=1n;',
      'index.html':'<script type="module" src="./demos/flight-lab/app.js"></script>',
      'service-worker.js':'// generated','offline/register.js':'// registration'},suites={};
  for(const [i,group]of SUITES.entries()){
    suites[group]={roots:['demos/'+roots[i]+'/'],
      consumes:['donor','editor'].includes(group)?['donor','editor']:[group],serviceWorker:group!=='worlds'};
    sources['demos/'+roots[i]+'/app.js']=`import {x} from '../../modules/${group==='worlds'?'navigation':'math'}/index.js';`;
  }
  const policy={suites,contracts:{'modules/exact-rational/':['scripts/alien_math_001_oracle.py']},
    auditedRuntime:Object.fromEntries(Object.entries(sources).filter(([path])=>path.endsWith('.js')).map(([path,source])=>[path,hash(source)])),
    opaqueRuntime:{'offline/register.js':{sha256:hash(sources['offline/register.js']),roots:[]}},workerTemplateSHA256:hash('template')};
  const extra={'scripts/alien_math_001_oracle.py':'oracle',
    'scripts/service-worker.template.js':'template',shared:[],issues:[],
    catalogue:{schemaVersion:1,release:'fixture',modules:{}},
    gitBlobs:Object.fromEntries(Object.entries(sources).map(([path,source])=>[path,gitBlob(source)])),
    tests:Object.fromEntries(SUITES.map(g=>[g,[{path:'scripts/browser-'+g+'.js',sha256:hash('fixture '+g)}]])),
    suiteIssues:Object.fromEntries(SUITES.map(g=>[g,[]]))};
  return {files:Object.entries(sources).map(([path,source])=>({path,sha256:hash(source)})),
    sources,policy,extra,environment:{node:'fixture',platform:'fixture'}};
}
function changeSource(input,path,source){
  input.sources[path]=source;input.files.find(f=>f.path===path).sha256=hash(source);
  input.extra.gitBlobs[path]=gitBlob(source);
}
test('reviewed workload fixture retains original closure invalidations and qualification counts',()=>{
  const input=fixture(),saved=structuredClone(input),report=runInvariantWorkload(input);
  assert.deepEqual(report.forcedExecution,[]);
  assert.deepEqual(report.scenarios.map(s=>s.resultExecuted),[0,0,6,7,6,1]);
  assert.deepEqual(report.scenarios.map(s=>s.baselineExecuted),[0,0,7,7,0,1]);
  assert.deepEqual(input,saved,'counterfactuals must not rewrite inputs or audit policy');
});
test('unreviewed editor runtime forces both consumers without aborting the workload',()=>{
  const input=fixture();changeSource(input,'demos/editor/app.js',input.sources['demos/editor/app.js']+'\n// PR edit');
  const report=runInvariantWorkload(input);
  assert.deepEqual(report.forcedExecution,['donor','editor']);
  for(const group of report.forcedExecution)assert.ok(report.initialIssues[group].includes(
    'unreviewed executable closure: demos/editor/app.js'));
  assert.deepEqual(report.scenarios.map(s=>s.resultExecuted),[2,2,6,7,6,3]);
  assert.deepEqual(report.scenarios[5].executed,['worlds','donor','editor']);
});
test('unreviewed harness issues remain force-executed with matching qualification fixtures',()=>{
  const input=fixture();input.extra.suiteIssues.editor.push('unreviewed browser harness closure: scripts/browser-editor.js');
  const report=runInvariantWorkload(input);
  assert.deepEqual(report.forcedExecution,['editor']);
  assert.deepEqual(report.initialIssues.editor,input.extra.suiteIssues.editor);
  assert.ok(report.scenarios.every(s=>s.executed.includes('editor')));
});
test('unknown dependency syntax and shared diagnostics are retained and never reused',()=>{
  const input=fixture();changeSource(input,'demos/rts-lab/app.js',
    input.sources['demos/rts-lab/app.js']+'\nimport(dynamicModuleName);');
  const report=runInvariantWorkload(input);
  assert.deepEqual(report.forcedExecution,['worlds']);
  assert.ok(report.initialIssues.worlds.some(issue=>issue.includes('computed dynamic import')));
  assert.deepEqual(report.scenarios[2].executed,SUITES,'worker invalidations union existing unknown worlds scope');
  input.extra.issues.push('unclassified browser harness: scripts/browser-new.js');
  const shared=runInvariantWorkload(input);
  assert.deepEqual(shared.forcedExecution,SUITES);
  for(const scenario of shared.scenarios){assert.equal(scenario.resultReused,0);assert.deepEqual(scenario.executed,SUITES);}
});
