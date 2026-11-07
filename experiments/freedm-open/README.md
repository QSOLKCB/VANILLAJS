# FreeDM — four open-weight vision models vs Terra

**Status: first owner-run paired replay completed; live open-model
gameplay has NOT run.** The original zero-API [OPENVLM-001 diagnostic
receipt](OPENVLM-001.md) contains 48 completed local inferences, of which
20 generated valid six-field actions and 28 did not. The original evidence
and Terra match input bytes are preserved; the new v2 protocol is a proposed
corrective experiment, not a retroactive amendment to the first run.

## Two distinct comparisons

**Stage A: paired screenshot replay** (recommended first). Four locally
installed vision models receive the exact historical Terra screenshots,
in-game counters, previous Terra actions and original Terra role prompts.
Only the model decisions differ. The result measures action agreement,
valid JSON, prompt/image identity and local inference latency. It is NOT
a new game: open-model decisions do not change the historical world.
Agreement with Terra is not optimal gameplay.

**Stage B: real four-player open-model match** (optional). Each local model
controls one genuine FreeDM/ViZDoom ASYNC_PLAYER client. Open-model inference
is sequential on the same physical GPU with starting priority rotated each
round. Live frags, deaths and movement are genuine engine observations,
but inference latency, spawn conditions and tactic prompts differ from
the Terra match. Treat this as an exploratory pilot, NOT a causal head-to-head.

## Candidates

| Open-weight model | Local Ollama tag | Approximate published disk size |
|---|---|---|
| Qwen3-VL 2B | qwen3-vl:2b | 1.9 GB |
| Qwen3-VL 4B Instruct | qwen3-vl:4b-instruct | 3.3 GB |
| Qwen2.5-VL 3B | qwen2.5vl:3b | 3.2 GB |
| Moondream 2 | moondream:1.8b | 1.7 GB |

Review each model's own terms before redistribution or commercial use.
Open-weight does not necessarily imply an OSI-approved software licence.
The workflow pins and records the exact installed 64-digit model digest,
not merely the mutable tag. Qwen3-VL needs Ollama 0.12.7 or later.

Sources: https://ollama.com/library/qwen3-vl,
https://ollama.com/library/qwen2.5vl,
https://ollama.com/library/moondream and
https://github.com/ollama/ollama/blob/main/docs/api.md.

## Output quality versus execution success

The initial owner run [42379184873](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42379184873)
completed 48/48 inferences, but returned **28 invalid model action
outputs**. That is a complete `PARTIAL` research result, not a valid
four-model live-play readiness gate. The new protocol requests an
explicit six-field Ollama JSON schema; only the Qwen3-VL 2B candidate
also receives `think: false` and a 384-token cap to probe its previously
empty final responses. Other models retain their default thinking and
192-token caps. All differences are recorded as changed experimental
settings, not concealed in a supposedly identical baseline.

Invalid text is preserved in the new sealed JSON (at most 4096 characters
per response), along with error category, original response text hash,
`done_reason`, token/timing fields and thinking length/hash when present.
Only opt-in evidence publication can expose these untrusted model outputs.

A replay with **every expected provider response completed** now writes a
valid research receipt whether its `status` is `PASS` or `PARTIAL`.
Completed replies with malformed control JSON are counted as
`INVALID_ACTION`; failed Ollama HTTP/transport/model requests are
`LOCAL_ERROR`, producing `INCOMPLETE` and a failing workflow instead.
**Live-mode execution refuses both `PARTIAL` and `INCOMPLETE`**, and
requires all four candidates to emit valid actions for every paired
frame before starting the FreeDM smoke and real match.

## Owner-controlled preparation (one time)

The existing owner runner still has the immutable original match:

    ~/.local/state/qsol/vanillajs/freedm-terra/run-42374695320-1/match/

It must retain the original MATCH.json, SHA256SUMS and 48 PNG files.
The replay checks their SHA-256 identities before any model inference.

The owner may choose to download the four models manually:

~~~sh
ollama pull qwen3-vl:2b
ollama pull qwen3-vl:4b-instruct
ollama pull qwen2.5vl:3b
ollama pull moondream:1.8b
ollama list
~~~

These commands download approximately 10 GB of model weights. **Neither
CI nor this experiment downloads models automatically.** The owner must
start a loopback-only Ollama server at 127.0.0.1:11434. The code uses
hardcoded HTTP loopback endpoints with proxies explicitly disabled, and
rejects absent models, cloud-only entries, small placeholders or invalid
installed digests. No keys, paid API, root, Docker, Node/npm or hosted
inference are needed.

## Run from GitHub Actions, only after review and merge

Actions → FreeDM open-VLM comparison (owner local, zero API credits).
Select reviewed main; authorize local execution.

- Mode **replay** (default): three screenshots per Terra role at rounds
  0, 5 and 11; 12 images per open model = **48 total local requests**.
  Selecting 12 frames per role uses the complete 48 Terra screenshots
  for *each* model = **192 local requests**.
- Mode **replay-and-live**: first requires successful paired replay, then
  verifies the four-peer FreeDM engine with a local smoke run and finally
  executes **six actual multiplayer decision rounds** using four open
  models (24 additional local inferences). The local FreeDM WAD must
  match the original Terra-run WAD SHA-256. ViZDoom 1.3.2 is loaded via
  uv from the owner's existing cache, without network/package installation.
- Publication is independently opt-in. Uploaded JSON/PNG and checksum
  evidence expires after 14 days. Original Terra evidence is never
  repacked, reencoded or uploaded again.

The job is restricted to owner GitHub account EmergentMonk, branch main,
manual workflow_dispatch and the qsol-rtx5060ti self-hosted runner. It
cannot run on pushes or PRs. This is **zero OpenAI API spending** but uses
local electricity, compute and any owner-approved model download.

## Immutable reference identities

- Original Terra run: 42374695320.
- Source commit: afef132d8fd0a9acfc874ed760ea3dc5a175d906.
- Original MATCH.json SHA-256:
  4add0e7c1b2db8a5b72618d661a6420ce4d4b0af59bacff6aacdd2080e3cf50a.
- Original SHA256SUMS SHA-256:
  54fd28f5979c99f23721f6248fd94e054df1f3d73d3551932b47a9aa19e5844d.
- Identical FreeDM IWAD SHA-256 for live comparisons:
  d9adc4d792627e7fc47b09067b15486da724010c71dd12831e1cf8e0755b68ad.

The replay validates exactly 49 original entries (MATCH.json and 48
frames), correct role, round, engine action acknowledgement, matching
PNG hash and game asset identity.

## Evidence and interpretation

All new evidence remains OUTSIDE the source checkout in a fresh:

    ~/.local/state/qsol/vanillajs/freedm-open/run-RUNID-ATTEMPT/

Paired REPLAY.json records the exact source identities, installed model
digests, image SHA-256, prompt SHA-256, selected model action, Terra
reference action, comparison fields, failures and model/host latency.
The source-based prompt is the same Terra role-specific instruction.
The open model receives the unchanged full PNG; Terra originally used
OpenAI low-detail image processing. Do not infer identical vision
preprocessing, bit-identical GPU outputs or superior FPS skill.

Optional live MATCH.json records all four real players, every original
game screenshot (with SHA-256), model decisions, rotating inference order,
measured local request times and game-engine acknowledgements. Failed
runs preserve partial evidence with an ABORTED receipt; unacknowledged
engine actions are never asserted as successful. SHA256SUMS seals all
new file bytes and no previous measurements are overwritten.

## Zero-network offline CI

~~~sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s tests -p 'test_freedm_open_replay.py' -v
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s tests -p 'test_freedm_open_live.py' -v
~~~

Hosted CI uses entirely mocked local Ollama/ViZDoom interfaces, never
the actual GPU, API or real opponent actions. The owner-only run is
the first source of actual open-weight model performance and behavior.
