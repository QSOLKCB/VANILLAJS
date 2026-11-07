# 2D-FOUNDRY-001 — original workflow evidence and offline recovery

This directory preserves three complete evidence archives byte-for-byte. The
two original Actions ZIPs remain available here after their temporary GitHub
artifact attachments expire. The recovered tar.gz and its original checksum
sidecar preserve the separately finalized local evidence.

| Evidence | Run / attempt | Source commit | Historical outcome |
| --- | --- | --- | --- |
| CPU fixture and read-only SOL review | [42362943052 / 1](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42362943052) | `412184efbae8d3ab421a4eee0a4fbd13e488415f` | Review job succeeded |
| Original RTX measurements, recovered offline | [42363350613 / 1](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42363350613) | `412184efbae8d3ab421a4eee0a4fbd13e488415f` | Measurement step succeeded; finalization failed; artifact upload skipped |
| Subsequent successful RTX experiment | [42364527661 / 1](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42364527661) | `4aaa87971068a603b49e72799a6c7ef0615e8305` | Measurement, finalization and artifact upload succeeded |

## Exact archive identities

| Filename | Bytes | SHA-256 |
| --- | ---: | --- |
| `vanillajs-2d-sol-evidence-42362943052-1.zip` | 4,601 | `d8eda5079019ff35118af113d0e86283c68eabf0062dd17e2994fb3c2bf79123` |
| `vanillajs-rtx5060ti-2d-42363350613-1.tar.gz` | 3,419 | `76bb881b9e1a3698f1a915bb3e627e35526d472cfa9fbc4d5aeae686d50c6d9c` |
| `vanillajs-rtx5060ti-2d-42364527661-1.zip` | 4,398 | `e1e59c1ec3070af13d4aa8edf2fbd9a6f9918d6592f1c2f58105587b21db5111` |

The ZIP digests match both the owner's supplied values and the GitHub connector
artifact records: **13570472279** for SOL and **13570488480** for RTX. The local
recovery archive has no GitHub Actions artifact ID. [MANIFEST.json](MANIFEST.json)
records every archive member's size and SHA-256, archive Git blob identities,
job IDs, source commits and offline verification results.

## Original failed run and offline recovery

Run `42363350613` remains historically failed. Its original `lab2d-source.json`
and `rtx2d.json` were recovered from the owner's existing evidence directory and
finalized offline from a clean checkout at `4aaa87971068a603b49e72799a6c7ef0615e8305`,
which contains the correction from [PR #39](https://github.com/QSOLKCB/VANILLAJS/pull/39).
The measured source remains `412184efbae8d3ab421a4eee0a4fbd13e488415f`.

The raw Canvas2D trace contains one zero-millisecond rAF interval. The corrected
finalizer accepts that recorded zero while retaining the count, image, p95,
source identity and paired-pixel checks. Original measurement bytes were checked
before and after recovery and are unchanged:

- `lab2d-source.json`: `90d52218b2eef27030a756ec1ab00234d45af17237b87440e4149b491f16e332`
- `rtx2d.json`: `48b28eb31719701ef3ba0795cdea1b524156a733004809773d1aa23b58d1ccda`

The recovered `EXPERIMENT.json` and `SUMMARY.md` report successful offline
validation of those observations. Their PASS status does not change the failed
Actions conclusion. Recovery used no new GPU capture.

## Contents and verification performed

The SOL ZIP contains `lab2d-source.json` and `lab2d-sol-review.json`, including
both complete reviewer outputs, token usage, reservations and estimated costs.
The review's binding to the exact source JSON and canonical strict identity was
verified. Its suggestions remain untrusted hypotheses; the estimated cost is
not a billing receipt.

Each RTX archive contains exactly `lab2d-source.json`, `rtx2d.json`,
`EXPERIMENT.json`, `SUMMARY.md` and `SHA256SUMS`. Both preserve seven paired
forced-redraw/FrameGate observations and 95 recorded rAF intervals.

Offline preservation checks passed on 2026-11-07:

- All three archive digests, exact inventories, and both ZIP CRC checks.
- Every internal RTX checksum and the original recovery checksum sidecar.
- Source module hashes against each archive's pinned historical Git commit.
- All three canonical strict identities, which match one another.
- Replay of the existing corrected finalizer on temporary copies of both RTX
  reports, reproducing all five archived files byte-for-byte.

The archive checks establish byte integrity and the recorded source bindings.
Physical RTX identity is separate from Canvas2D acceleration; these observations
do not establish GPU compute or universal game-FPS improvements. Audio and
ternary workloads are CPU evidence. Preservation performed offline checks only.

## Verify a checkout

From the repository root:

```sh
(cd evidence/2D-FOUNDRY-001 && sha256sum -c SHA256SUMS)
(cd evidence/2D-FOUNDRY-001 && sha256sum -c vanillajs-rtx5060ti-2d-42363350613-1.tar.gz.sha256sum)
```

To check all archived member bytes against the preserved inventory without
extracting or executing them:

```sh
python3 - <<'PY'
import hashlib, json, tarfile, zipfile
from pathlib import Path
p = Path('evidence/2D-FOUNDRY-001')
for row in json.loads((p / 'MANIFEST.json').read_text())['archives']:
    path = p / row['filename']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']
    if path.suffix == '.zip':
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None
            assert len(archive.namelist()) == len(row['members'])
            data = {n: archive.read(n) for n in archive.namelist()}
    else:
        with tarfile.open(path, 'r:gz') as archive:
            assert len(archive.getmembers()) == len(row['members'])
            assert all(m.isfile() for m in archive.getmembers())
            data = {m.name: archive.extractfile(m).read() for m in archive.getmembers()}
    assert set(data) == set(row['members'])
    for name, raw in data.items():
        assert len(raw) == row['members'][name]['sizeBytes']
        assert hashlib.sha256(raw).hexdigest() == row['members'][name]['sha256']
    print('PASS:', path.name)
PY
```
