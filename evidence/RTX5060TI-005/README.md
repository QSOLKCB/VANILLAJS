# RTX5060TI-005 — owner-run donor-upgrade hardware + CPU evidence

**Original artifact, byte-for-byte preserved.** Do not unpack/repack,
regenerate, rewrite or replace the original GitHub Actions ZIP. It was
produced by the explicitly owner-dispatched
[run 42353698285](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42353698285),
attempt 1, which concluded **success** on reviewed `main`. GitHub Actions
attachments expire; the Git blob in this directory preserves the exact
downloaded ZIP independently of that retention window.

## Source and artifact identity

| Field | Pinned value |
| --- | --- |
| Workflow | `RTX 5060 Ti donor upgrade validation` |
| Owner-dispatched run / attempt | `42353698285` / `1` |
| Hardware job | [`128347067900`](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42353698285/job/128347067900) |
| GitHub artifact ID | `13566512866` |
| GitHub artifact name | `vanillajs-rtx5060ti-donor-42353698285-1` |
| ZIP filename | `vanillajs-rtx5060ti-donor-42353698285-1.zip` |
| Original ZIP size | **13,814 bytes** |
| Original ZIP SHA-256 | `4589d1f93e08ad5b7a06a67b2565ceaf7ae1c52172c6c6e136740242d380f48d` |
| Original ZIP Git blob SHA-1 | `f0227c9c08f26826b8eafe00c03384cbffff78df` |
| ZIP members | **7**, exact allowlist, 6-entry outer SHA256SUMS plus 2-entry nested manifest |
| Comparison baseline | `e82d51be222d99951d70509468eaae8f3efc9fcd` |
| Tested reviewed `main` | `90b2fe1f3428710eade90cc328c9e6bf7e18f457` |
| GPU | NVIDIA GeForce RTX 5060 Ti, driver **595.99.02**, native ANGLE WebGL1 |
| Machine / browser | Ryzen 9 5950X, Google Chrome 156.0.8078.79 |
| Hardware execution | **Completed**, not simulated in hosted CI |

The ZIP's complete seven-member inventory is:

```text
EXPERIMENT.json
donor-upgrade-workload.json
SUMMARY.md
SHA256SUMS
fullpath/report.json
fullpath/SUMMARY.md
fullpath/SHA256SUMS
```

The receipt binds both source hashes, both exact Git revisions, the
owner-run ID/attempt and the SHA-256 values of all four previously preserved
RTX5060TI-001/002/003/004 archives. None of those archives are rewritten.

## Observed results (not generalized performance claims)

The existing **native WebGL full-path comparison** was rerun for the frozen
pre-upgrade source and the reviewed candidate with two warm-up pairs,
seven measurement pairs and 240 FPS Lab frames per trial.

| Recorded trial metric | Baseline median | Candidate median |
| --- | ---: | ---: |
| CPU static geometry preparation | 57.1 ms | 13.1 ms |
| CPU static collision query workload (including index construction) | 74.5 ms | 2.2 ms |
| FPS Lab JS callback | 0.3 ms | 0.2 ms |
| Actual FPS Lab frame interval p95 | 16.8 ms | 16.8 ms |
| FPS Lab GPU upload submissions | 1,486,080 bytes | 1,486,080 bytes |
| FPS Lab draw calls | 960 | 960 |

Three same-device WebGL pixel-parity frames match exactly. The raw report
also records CDP statistical sampled-allocation observations, **not** precise
heap allocation or resident GPU memory. This is a source-pinned, environment-
specific workload; the recorded CPU improvements **cannot be attributed solely
to the latest donor-upgrade patch**, nor treated as native game FPS changes.
The frame interval is unchanged. Native `gl.finish()` measurements include
driver/CPU/compositor overhead and are **not** GPU timer-query results.

A **separate CPU-only** serial workload, which did **not run on CUDA/RTX compute**,
has two independent 7-sample experiments after two warmups:

- **Frame pacing:** exact 7 refresh-rate sequences at 30/59/60/61/75/120/144 Hz,
  each recorded at 7,200 logical 120 Hz ticks, plus 3,600 ticks for the
  rounded-60 Hz presentation sequence.
- **Moving-target interception:** 4,000 scenarios, **3,200** finite
  intercept solutions and **800** abstentions; observed maximum relative
  intercept-position residual `4.4077009925825543e-16`.

All samples, hashes, raw per-frame observations, device details and limitations
remain in the original ZIP. This evidence does **not** claim general frame-rate
improvement, quantum hardware, GPU physics acceleration, or independent
cryptographic attestation of the workstation.

## Independent offline verification

```sh
python3 scripts/verify-rtx005-receipt.py
python3 -m unittest discover -s tests -p 'test_rtx005_receipt.py' -v
(cd evidence/RTX5060TI-005 && sha256sum -c SHA256SUMS)
```

The verifier enforces the ZIP SHA-256 and exact Git blob identity, membership,
CRC, nested checksum chain, independently pinned original module hashes, run
and source identity, native non-software RTX renderer, seven paired trials,
three pixel frames and separate CPU scenario contracts. It **never hashes
current module working-tree content**: future module edits must not invalidate
the byte-identical historical artifact.

Hosted PR checks replay *existing* evidence and source contracts. They do not
rerun the physical GPU. A new owner-only workflow would be a separate
explicitly authorized experiment with a separate receipt and preservation PR.

**Governance:** this preservation PR must remain separate from open,
unmerged DEMO//SYNTH planning PR #36. No auto-merge, release, evidence rewrite
or hardware dispatch is implied.
