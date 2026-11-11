// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('FINAL capsule determinism, independent source binding and adversarial archive controls',()=>{
  const result=spawnSync('python3',['-m','unittest','discover','-s','tests','-p','test_alien_math_bundle.py','-v'],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.status,0,result.stdout+result.stderr);
});
test('FINAL drafts cannot silently claim release publication or completed JS refinement',()=>{
  const metadata=JSON.parse(readFileSync('research/alien-math-final/zenodo.draft.json','utf8'));
  assert.equal(metadata.status,'DRAFT_NOT_SUBMITTED');
  assert.equal(metadata.metadata.license,'Apache-2.0');
  for(const field of ['doi','publication_date','version'])assert.equal(field in metadata.metadata,false);
  const audit=JSON.parse(readFileSync('research/alien-math-final/audit.json','utf8'));
  assert.equal(audit.status,'REVIEW_CANDIDATE');assert.equal(audit.phases.length,6);
  assert.equal(audit.javascriptRefinement,'OPEN');assert.equal(audit.newHardwareVerification,false);
  for(const phase of audit.phases)for(const [path,digest] of Object.entries(phase.fixtures))
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),digest,path);
});
