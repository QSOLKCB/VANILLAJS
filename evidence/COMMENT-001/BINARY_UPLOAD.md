# COMMENT-001 original PNG transfer — completed

**Status:** both exact screenshot Git blobs committed to the corrective evidence branch at
`489b667138df1e109b043d2a015a513c10b56d0f`.

| Exhibit | Git blob SHA-1 | SHA-256 |
| --- | --- | --- |
| Original full-resolution PNG | `d3cb1bbad91c316ec5e4e3607fff68d1b7c48320` | `7b575405c975030c952d04c12441e2e9b85d0d55acc7dfa472fdcf3e95e06654` |
| Labelled reduced-colour excerpt PNG | `0c970a6f7ed71092ed2b0c18cbcb05d2b4ef8b5c` | `0840808768ddab18fa6faca9df8e92acf67a27817d5a17b6c48845680aaa9d86` |

## Transfer method

The original image and derived excerpt were read from the previously constructed immutable transfer ZIP. Its SHA-256 is `29c52bc6f6969bb9845f60e10afa3b9119a460dedba394cb18cc82a0665eef3f`. Each PNG's original byte size and SHA-256 were checked against `EVIDENCE_MANIFEST.json`, and its byte representation was transported to GitHub using the Git Data API's `create_blob` operation with `encoding: base64`.

GitHub returned the exact expected Git blob SHA-1 for **both** images. One new tree and commit attached the blobs to the original `evidence/COMMENT-001/` paths, using a non-force update of the corrective branch. There was no image decoding, recompression or modification. RTX5060TI-003 remained the identical Git blob `4b35e831027783618b6508a898883456c17b6aef`.

The standard-library `scripts/upload-comment001-blobs.py` remains as a documented alternative transport tool for auditing the method, but intentionally refuses to overwrite already-committed screenshots. **It does not need to be rerun.**

## Release gate

Hosted CI must execute:

```sh
python3 scripts/verify-rtx003-comment001.py --require-binaries \
  --archive evidence/RTX5060TI-003/vanillajs-rtx5060ti-arcade-42329114286-1.zip \
  --screenshot evidence/COMMENT-001/2026-11-07_original-screenshot.png \
  --excerpt evidence/COMMENT-001/2026-11-07_x-post_excerpt.png
(cd evidence/COMMENT-001 && sha256sum -c SHA256SUMS)
(cd evidence/RTX5060TI-003 && sha256sum -c SHA256SUMS)
```

`--manifest-only` and `--rtx-only` are deliberately **not accepted as proof of full archival completion**. The raw PNG bytes, ZIP, nested manifests, dimensions and Git hashes must verify. This is documentation of a disputed public statement, not an adjudication of its accuracy.
