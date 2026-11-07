# RTX5060TI-004 — BLOAT-OPS / NEXUS / UFF, three-source RTX validation

**Immutable source of record:** the exact GitHub Actions artifact from the owner's
explicitly dispatched, successful [run 42347306980](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42347306980),
attempt 1. The raw ZIP is preserved byte-for-byte; do not extract, repack,
regenerate, rewrite or replace it.

## Identity

| Field | Pinned value |
| --- | --- |
| Workflow | `RTX 5060 Ti BLOAT NEXUS UFF validation` |
| Run / attempt | `42347306980` / `1` |
| Measure job | [`128327736094`](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42347306980/job/128327736094) |
| GitHub artifact ID | `13564365756` |
| Owner | `EmergentMonk` |
| Tested `main` source | `05883459a6ffd355c3336a03f1085bb5d8ac5d5f` |
| Original ZIP | `vanillajs-rtx5060ti-bloat-nexus-uff-42347306980-1.zip` |
| ZIP size | **36,987 bytes** |
| SHA-256 | `60596835ed906393c8315ce4455a40b4eef05764f82de40a5bbe9d2244136814` |
| Git blob SHA-1 | `47ec60d25a8c1817d48f690e7102be1d845122fa` |
| ZIP members / manifest entries | 13 / 12 |
| Hardware | NVIDIA GeForce RTX 5060 Ti; native ANGLE WebGL, no software-renderer fallback |

Historical comparison source pins: RTX001 `240617e8bc1a935f05eaf75a10531f194f72a173`,
RTX002 `b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f`,
and RTX003 `3f5518a168652a003e8db9aa6dc0371ddb4782ea`.
The SHA-256 values of RTX5060TI-001/002/003 are separately pinned inside the
final receipt; their original evidence directories remain unchanged.

## Evidence and interpretation

The preserved ZIP contains three **same-protocol native WebGL comparisons**,
each recording seven paired observations against the reviewed `main` commit.
Their raw reports contain the CPU geometry-preparation, collision, callback,
frame-interval, upload, draw-call, renderer-identity and pixel-parity evidence.

A **separate CPU-only** report contains eight serial scenarios: three
2D range sizes (32, 256, 2048 pairs), integer replay (2048 ticks), three
NEXUS lattice sizes (6, 64, 256 cells; 32 rounds), and a 512-step
Newtonian orbit with 10-second integration steps. There were two warmups and
seven samples per scenario. The observed maximum relative Kepler energy drift
was approximately `2.34e-10`; this is a bounded numerical diagnostic, not
exact energy conservation or verification of UFF's experimental astrophysical
hypotheses.

**Limits:** The new numerical kernels were measured on the owner's CPU, not
accelerated on RTX. Historical WebGL measurements include driver/CPU/compositor
effects and are not a GPU-only timer or a demonstrated game FPS improvement.
No cryptographic hardware attestation is implied. Negative and tied results
remain part of the permanent record. The hosted CI archive verifier does not
repeat the physical GPU run.

## Verification

```sh
python3 scripts/verify-rtx004-receipt.py
python3 -m unittest discover -s tests -p 'test_rtx004_receipt.py' -v
(cd evidence/RTX5060TI-004 && sha256sum -c SHA256SUMS)
```

The Python standard-library verifier checks outer ZIP length, SHA-256 and Git
blob identity; all member allowlists, CRC and checksum chains; run/source and
historical comparison identities; native RTX renderer records; seven-trial
cardinality; the separate CPU workload dimensions and diagnostic contracts;
and exact source module SHA-256 hashes **independently verified and pinned to**
the tested commit `05883459a6ffd355c3336a03f1085bb5d8ac5d5f`, not the live
checkout. Future module development does not invalidate frozen observations.
Adversarial tests cover later checkout edits and a forged source hash with
a recomputed internal checksum.
The artifact was originally obtained from GitHub Actions; this committed exact
byte copy is the durable evidence once Actions' short-lived artifact expires.
