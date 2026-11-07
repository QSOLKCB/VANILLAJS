# Final original-PNG import via GitHub base64 blobs

PR #31 archived the RTX5060TI-003 ZIP and documented the two COMMENT-001 PNG digests, but did **not** commit the original screenshot or its derived excerpt. This corrective branch strictly requires both raw PNGs; metadata-only checks are no longer sufficient for hosted CI.

## One owner-run command (no image conversion)

Download the previously supplied `VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip` from the conversation. It must be **392,055 bytes** and SHA-256:

`29c52bc6f6969bb9845f60e10afa3b9119a460dedba394cb18cc82a0665eef3f`

From a clone of this branch, with `gh auth login` already completed (or `GH_TOKEN`/`GITHUB_TOKEN` exported), run:

```sh
python3 scripts/upload-comment001-blobs.py \
  /path/to/VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip --dry-run
python3 scripts/upload-comment001-blobs.py \
  /path/to/VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip
```

The Python standard-library uploader checks the ZIP archive and the exact original PNG bytes, Git blob SHA-1 and SHA-256 before any GitHub writes. It calls GitHub's Git Data API `POST /git/blobs` with `encoding: base64`, verifies both returned blob SHAs, builds one tree and commit, then fast-forwards the dedicated branch. It never re-encodes a PNG or overwrites the already preserved RTX003 artifact. GitHub permissions must allow contents writing to this branch.

Expected image blobs:

- `2026-11-07_original-screenshot.png`: `d3cb1bbad91c316ec5e4e3607fff68d1b7c48320`
- `2026-11-07_x-post_excerpt.png`: `0c970a6f7ed71092ed2b0c18cbcb05d2b4ef8b5c`

After committing, the branch's CI will run `python3 scripts/verify-rtx003-comment001.py --require-binaries` against the three committed raw files and both SHA256SUMS manifests. **Do not merge until this CI is green**. Screenshot exhibits preserve allegations as screenshots, not adjudicated findings.

## Alternative: regular Git transport

On the same branch, `unzip -n` the transfer archive into the repository, run the full verifier with all three explicit paths, then `git add` only the two PNGs, `git commit` and `git push`. Use the original transfer ZIP without modifying or regenerating it.

## Original historical instructions

# Binary evidence staging — remaining owner step

The RTX5060TI-003 ZIP has now been committed to Git **byte-for-byte** (Git blob `4b35e831027783618b6508a898883456c17b6aef`). This PR remains **not complete** until the two screenshot PNGs (original and derived excerpt) are also committed and verified. A GitHub Actions artifact URL alone is temporary and **not** permanent archival. The original source screenshot was supplied in the conversation; its byte-for-byte copy must be committed, not merely its crop or checksum manifest.

The assistant created `VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip` outside this repository. It contains these repo-relative files. The first file is **already in Git** and will be skipped by `unzip -n`:

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

**Trust boundary:** `--manifest-only` verifies metadata structure only and is never a substitute for raw-file verification. Hosted CI already verifies the exact committed RTX003 ZIP, but not the screenshot pixels. Once both PNGs are present, hosted CI can be changed to invoke the full checker and require all raw files on every run. Until then, this PR should remain draft/unmerged.
