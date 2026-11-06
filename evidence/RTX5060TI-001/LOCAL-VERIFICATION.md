# RTX5060TI-001 — independent owner-side local verification

**Date:** 2026-11-07 (Australia/Adelaide, owner terminal; approximately 01:36 local time)  
**Scope:** offline verification of the preserved receipt already committed to VANILLAJS. This is an owner-provided execution transcript, **not** a second GPU benchmark or a remotely witnessed command execution.

## Source pins

- Receipt: `VANILLAJS RTX5060TI-001`
- Candidate hardware validation source: `240617e8bc1a935f05eaf75a10531f194f72a173`
- Baseline: `1f965f4e5b6669de0f954e3a39b11aa679e56720`
- Original archive: `vanillajs-rtx5060ti-42203888152.zip`
- SHA-256: `1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8`
- Origin run: https://github.com/QSOLKCB/VANILLAJS/actions/runs/42203888152
- Preservation PR: #20 (merged into main)

## Commands and reported output

The owner supplied the following terminal output from a local `main` checkout. The block is reproduced as supplied and the archived bytes are **not** modified or rebuilt:

```console
$ python3 scripts/verify-rtx-receipt.py
$ (cd evidence/RTX5060TI-001 && sha256sum -c SHA256SUMS)
PASS RTX5060TI-001: outer SHA256 1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8
PASS: 3 ZIP members, 2 internal checksums, 7 paired kernels, 14 complete frame trials
Source: 240617e8bc1a935f05eaf75a10531f194f72a173; baseline: 1f965f4e5b6669de0f954e3a39b11aa679e56720
vanillajs-rtx5060ti-42203888152.zip: OK
```

The supplied transcript also displayed the archive directory listing (`README.md`, `SHA256SUMS`, and the ZIP). The two verification commands agree on the outer archive's expected digest.

## Conclusion and trust boundary

**Owner-reported local validation: PASS.** The standard-library verifier checked the outer archive, internal members/checksums, source pins and recorded structural measurements. Separately, `sha256sum -c` returned `OK` against the tracked checksum manifest. This is repeatable, offline evidence inspection and confirms the owner's reported local copy against the frozen digest.

**It does not** rerun GPU timings, prove independent live device identity, independently attest the owner's execution environment, or change the original receipt. The original owner's physical RTX run remains the separate, successful Actions record. The local-verification note is an **addendum** and must not be inserted into or overwrite the original ZIP. Subsequent measurement sessions require a new numbered receipt.
