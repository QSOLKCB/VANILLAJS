// SPDX-License-Identifier: Apache-2.0
// Live, reviewable classifications extend (never rewrite) the frozen proof input.
import assert from 'node:assert/strict';
import {hash} from './browser-dependencies.mjs';
export const LIVE_PROFILE='scripts/browser-cache-profile.json';
const pathOK=p=>typeof p==='string'&&/^[a-zA-Z0-9._/-]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').includes('..');
function fields(value,expected,label){
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' object');
  assert.deepEqual(Object.keys(value).sort(),[...expected].sort(),label+' fields');
}
function paths(value,label){assert.ok(Array.isArray(value),label+' array');assert.equal(new Set(value).size,value.length,label+' duplicate');for(const p of value)assert.ok(pathOK(p),label+' unsafe path');}
function digests(value,label){assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' object');for(const [p,d]of Object.entries(value)){assert.ok(pathOK(p),label+' unsafe path');assert.match(d,/^[a-f0-9]{64}$/,label+' digest');}}
function opaque(value,label){
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' object');
  for(const [p,row]of Object.entries(value)){
    assert.ok(pathOK(p),label+' unsafe path');
    fields(row,['sha256','roots','reason',...(Object.hasOwn(row,'imports')?['imports']:[]),...(Object.hasOwn(row,'browserImports')?['browserImports']:[])],p);
    assert.match(row.sha256,/^[a-f0-9]{64}$/);paths(row.roots,p+' roots');
    assert.ok(typeof row.reason==='string'&&row.reason.length>=30,p+' requires a specific review rationale');
    if(row.imports){assert.ok(Array.isArray(row.imports));assert.ok(row.imports.every(s=>typeof s==='string'&&(s.startsWith('.')||s.startsWith('node:'))),p+' local reviewed imports');}
    if(row.browserImports){assert.ok(typeof row.browserImports==='object'&&!Array.isArray(row.browserImports));for(const [from,to]of Object.entries(row.browserImports)){assert.ok(from.startsWith('.')&&pathOK(to),p+' browser import mapping');assert.ok(row.roots.includes(to),p+' browser import root');}}
  }
}
export function applyLiveProfile(baseBytes,live){
  fields(live,['schema','qualification','basePolicySHA256','suites','shared','auditedHarnesses','auditedRuntime','opaqueHarness','opaqueRuntime'],'live profile');
  assert.equal(live.schema,'qsol.browser.live-profile.v2');assert.equal(live.basePolicySHA256,hash(baseBytes),'frozen policy identity');
  const base=JSON.parse(baseBytes),policy=structuredClone(base),groups=Object.keys(base.suites);
  assert.equal(base.qualification,3,'frozen qualification evidence remains unchanged');
  assert.equal(live.qualification,1,'live qualification requires one authenticated main execution');
  policy.qualification=live.qualification;
  fields(live.suites,groups,'suite set');paths(live.shared,'shared');
  for(const group of groups){
    assert.equal(base.suites[group].serviceWorker,true,'live profile requires whole-package worker coverage');
    fields(live.suites[group],['roots','scripts'],group);
    for(const kind of ['roots','scripts']){paths(live.suites[group][kind],group+' '+kind);policy.suites[group][kind]=[...new Set([...base.suites[group][kind],...live.suites[group][kind]])];}
  }
  for(const name of ['auditedHarnesses','auditedRuntime']){digests(live[name],name);policy[name]={...base[name],...live[name]};}
  for(const name of ['opaqueHarness','opaqueRuntime']){opaque(live[name],name);policy[name]={...base[name],...live[name]};}
  for(const [name,audit]of [['opaqueHarness','auditedHarnesses'],['opaqueRuntime','auditedRuntime']])
    for(const [p,row]of Object.entries(live[name]))assert.equal(row.sha256,live[audit][p],p+' opaque record must match its live executable pin');
  policy.shared=[...new Set([...base.shared,LIVE_PROFILE,'scripts/browser-cache-profile.mjs',...live.shared])];
  return policy;
}
