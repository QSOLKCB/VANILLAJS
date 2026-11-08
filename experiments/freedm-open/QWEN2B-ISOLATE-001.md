# QWEN2B-ISOLATE-001 — FreeDM text vs image output isolation

**Status:** experimental code and offline tests only; no owner-GPU inference
has been run for this protocol. Nothing in this PR authorizes a live
four-player deathmatch or changes the existing live-readiness gate.

## Motivation — directly observed failure

The owner-run FreeDM OpenVLM replay v2, GitHub Actions run
**42384730140**, completed all 48 local Ollama model requests. Its
Qwen3-VL 2B candidate generated **zero valid six-field controls
from 12 screenshots**. The original, already preserved ZIP has SHA-256:

    da69fa5261302df2faf8321f8a9dfa996511a4c4b5a7c33b87e1d567a3b53c55

The original REPLAY.json byte SHA-256 is:

    564d64e9bf40e463256c6aad8f237790ca2ac5c2d75c76e92ee1c700ddadbc82

Qwen3-VL 2B local model identity recorded in that v2 evidence:

    qwen3-vl:2b
    0635d9d857d497aeadba3d7d27485746c50554446f9f6ec01ef39788221adbe8

In v2, the model returned an empty final content string, often with
nonempty thinking metadata; the completion reason was stop. This
cannot establish whether the cause was the vision path, model
renderer/parser, thinking handling, JSON constraint mode or the
complexity of the six-field action schema.

The original Terra match and the historical v1/v2 output archives
are **never altered** by this diagnostic.

## Controlled minimum probe

All model outputs are requested from the SAME installed weights.
No pulls, tag switching or remote Ollama models are permitted. A
local /api/tags preflight and postflight must match the above exact
digest and a minimum on-disk model size.

Stage A — **text only**, followed by Stage B — **identical text plus
one original FreeDM PNG**.

The fixed prompt is:

> Return only this exact JSON object: {"move":"forward"}. The single
> move field must equal forward. Do not include extra fields, Markdown,
> explanations, or any text outside the JSON object. If an image is
> attached, do not interpret it for this diagnostic task.

The entire prompt is identical across image-on and image-off cases.
The attached PNG comes from the original Terra run 42374695320
(TERRA-ALPHA, round 05), whose 49-member source manifest, MATCH.json
and complete 48-frame inventory are independently validated by
the existing replay loader before *any* model inference. The PNG
is passed unchanged as base64, and no image is invented or sent to
any remote host.

Each modality runs the same 2 × 3 matrix:

| Format parameter | think omitted | think: false | think: true |
|---|---|---|---|
| Strict one-field JSON Schema | Case | Case | Case |
| Generic JSON mode | Case | Case | Case |

This is **12 minimal cases**. A separate final **six-field controller
schema** check in each modality (think false, strict schema) makes
**14 total local requests**. The full-action controls are diagnostic
only; success with a one-field schema does NOT satisfy the existing
game-controller contract.

Other generation settings are fixed across the matrix:
temperature 0, seed 17, num_ctx 2048 and num_predict 384. The
Ollama model's own thinking support/default (if reported) and Ollama
version are captured via **local** /api/show and /api/version. The
requested think values are still recorded even if a model ignores or
rejects one of them.

### How to interpret the result

- Valid text-only JSON but consistently empty final content with an
  image suggests an issue involving image attachment, multimodal
  prompt rendering or vision processing (not automatically a broken
  perception model).
- Valid minimal JSON but failed six-field output suggests that output
  schema complexity or instruction-following deserves further study.
- Differences between omitted, false and true thinking requests
  implicate thinking mode or model template/parser behaviour.
- Differences between JSON mode and schema mode implicate the
  output-format constraint. A single response cannot establish a
  universal defect, so interpretation remains hypothesis-level.
- Local HTTP/API errors are **not** valid model responses. The
  runner records LOCAL_ERROR, marks the run INCOMPLETE and exits
  nonzero without discarding its checksum-sealed partial observations.
- A complete 14-response diagnostic is **COMPLETE** even when some
  answers are empty or malformed. Model output quality is reported
  separately. No automatic repairs, retries, fallback models or
  fabricated successes are permitted.

The receipt distinguishes VALID_EXACT, VALID_DIFFERENT,
SCHEMA_REJECTED, INVALID_JSON, EMPTY_CONTENT and LOCAL_ERROR.
It retains bounded raw final output (max 4,096 characters),
done_reason, token counts, generation timings and thinking length/
SHA-256 when available. It **does not preserve or expose the private
thinking text itself**, nor any API secret.

## One-time requirements

The owner-run FreeDM/Terra evidence from run 42374695320 must still
exist at:

    ~/.local/state/qsol/vanillajs/freedm-terra/run-42374695320-1/match/

Ollama must be reachable locally on 127.0.0.1:11434 with the
**exact** model digest above. The owner-only workflow now checks the
local HTTP /api/version endpoint first. It reuses a healthy service if
one is already present, **otherwise starts an unprivileged temporary
`ollama serve` process bound to 127.0.0.1:11434** and terminates only
that owned process when the probe step exits. It does not install
packages, start a system service, pull model weights, use cloud endpoints
or terminate a preexisting healthy Ollama service.

If the temporary server cannot bind or become ready, the workflow
fails with a specific local-service diagnostic and startup log instead
of the earlier generic URLError. For manual verification on the runner:

~~~sh
python3 experiments/freedm-open/ollama_health.py
ollama list
~~~

The model digest is checked independently before and after inference.
If different, investigate and revise the experiment through another
reviewed PR; never bypass the identity gate.

No model installation is required if the same v2 model is still
installed. The script uses only the Python standard library plus
existing VANILLAJS experiment modules. Its own HTTP calls are
restricted to the pinned local Ollama host and exact allowlisted
endpoints: /api/tags, /api/show, /api/version and /api/chat.

## Execution — owner-only, after a reviewed merge

Open **Actions → FreeDM Qwen3-VL 2B isolation (owner-only, no API
credits)**. Select branch main and check
**acknowledge_local_execution**. Enable **publish_evidence**
separately if you want the JSON and SHA256SUMS in GitHub's Actions
artifact archive (14-day retention).

The workflow requires GitHub actor EmergentMonk, exact clean
reviewed main, the self-hosted qsol-rtx5060ti Linux runner,
and a fresh output path. It has no PR/push trigger, does not run
ViZDoom, does not alter the existing open-model live workflow, does
not download weights, and **never calls the OpenAI paid API**.

The original Terra PNG and source records are *read only*. New
evidence is created outside the checkout in:

    ~/.local/state/qsol/vanillajs/freedm-qwen2b/probe-RUNID-ATTEMPT/

The independently sealed **PROBE.json** and **SHA256SUMS** retain
all 14 attempted conditions, request fingerprints, model identity,
text/image pairs, local response classifications and operator
limitations. PNG bytes and model weights are not republished.

## Free offline regression gate

    PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_freedm_qwen2b_probe.py' -v

This test uses mocked responses, no game engine, no real model,
no GitHub Secrets, no network and no GPU. It validates pairing,
exactly one independent variable per text/image pair, source
identity failures, model digest refusal, empty response
classification, thinking non-disclosure, no retries, output
checksum integrity and incomplete provider failures.

### Separate live-readiness authority

The existing .github/workflows/freedm-open-vision.yml still
requires that the full four-model **source-pinned paired replay**
reports liveReadiness.eligible=true before launching any FreeDM
client. A positive isolation result is evidence for an eventual
future controller fix. **This new probe cannot approve or dispatch
a live deathmatch.**

References:
- Ollama API documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
- Ollama thinking capability controls: https://github.com/ollama/ollama/blob/main/docs/capabilities/thinking.mdx
- Source issue discussing Qwen3-VL thinking renderer behaviour: https://github.com/ollama/ollama/issues/17978
