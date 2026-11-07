# Binary evidence staging — remaining owner step

This documentation-only PR is intentionally **not complete** until the three raw binary files are committed to its branch and their content hashes are validated. A GitHub Actions artifact URL alone is temporary and **not** permanent archival. The original source screenshot was supplied in the conversation; its byte-for-byte copy must be committed, not merely its crop or manifest.

The assistant created `VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip` outside this repository. It contains only these repo-relative files:

```text
evidence/RTX5060TI-003/vanillajs-rtx5060ti-arcade-42329114286-1.zip
evidence/COMMENT-001/2026-11-07_original-screenshot.png
evidence/COMMENT-001/2026-11-07_x-post_excerpt.png
```

**Transport ZIP SHA-256:** `29c52bc6f6969bb9845f60e10afa3b9119a460dedba394cb18cc82a0665eef3f` (392,055 bytes). This transfer ZIP is not the canonical RTX benchmark artifact; the nested 25,481-byte RTX ZIP is.

After downloading that transfer archive to a local location, run from a clean checkout:

```bash
git fetch origin
git switch --track origin/evidence/rtx5060ti-003-comment-001-provenance
sha256sum /path/to/VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip
unzip -n /path/to/VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip -d .
python3 scripts/verify-rtx003-comment001.py --require-binaries \
  --archive evidence/RTX5060TI-003/vanillajs-rtx5060ti-arcade-42329114286-1.zip \
  --screenshot evidence/COMMENT-001/2026-11-07_original-screenshot.png \
  --excerpt evidence/COMMENT-001/2026-11-07_x-post_excerpt.png
(cd evidence/COMMENT-001 && sha256sum -c SHA256SUMS)
(cd evidence/RTX5060TI-003 && sha256sum -c SHA256SUMS)
git add evidence/COMMENT-001 evidence/RTX5060TI-003
git commit -m 'evidence: add exact RTX003 and COMMENT001 binary captures'
git push origin HEAD
```

`unzip -n` refuses to overwrite pre-existing file names. Before committing, the full verifier must report `PASS binary evidence bytes...`. Do **not** regenerate or repackage the benchmark ZIP; do not change the screenshot's pixels. Preserve the reduced-colour excerpt as a separately labelled derivative.

**Trust boundary:** `--manifest-only` verifies metadata structure only and is never a substitute for raw-file verification. Once the binaries are present, hosted CI can be changed to invoke the full checker and require the raw files on every run. Until then, this PR should remain draft/unmerged.
