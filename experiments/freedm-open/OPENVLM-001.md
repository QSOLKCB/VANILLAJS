# OPENVLM-001 — FreeDM paired replay failure analysis

**Status:** original evidence preserved; 48 real local inference responses were completed.
This is an observed, source-backed diagnostic record, **not a successful
four-model action-readiness claim** and not a live Doom-engine match.

## Owner run and retained byte identities

- GitHub Actions: https://github.com/QSOLKCB/VANILLAJS/actions/runs/42379184873
- Exact evaluated main: `8bda2c01ca461c424e2ed0b253fd85c9bf6a1b1b`
- Referenced Terra run: `42374695320`, original match SHA-256:
  `4add0e7c1b2db8a5b72618d661a6420ce4d4b0af59bacff6aacdd2080e3cf50a`
- Original uploaded open-VLM ZIP artifact ID: `13577180982`
- GitHub artifact ZIP SHA-256:
  `b54e0cfb9b384668a7e345c3a3fabb09a87cf3f940af6fdea644f9ae4b2a25e4`
- `replay/REPLAY.json` SHA-256:
  `96b89dcad9bddbfb0fd4d14d8c5c00a2cc298f8415ec69420f4c6039581f92e9`
- `replay/SHA256SUMS` SHA-256:
  `3c4df5c99480eff647bee35d255dd190fd5c55cf359bf3ff4c4dd09d6bd5f275`
- Source screenshots, Terra controller, WAD and all 49 original input members
  were verified before any local inference. All four locally installed
  models and their hashes were recorded in the original `REPLAY.json`.

## Actual result — protocol v1 (no model substitutions)

| Local model | Valid / attempted | Observed invalid outcome |
|---|---:|---|
| qwen3-vl:2b | **0/12** | 12 JSON-decode failures; every raw action text SHA is the SHA-256 of empty bytes; each generated exactly 192 tokens |
| qwen3-vl:4b-instruct | **12/12** | None |
| qwen2.5vl:3b | **8/12** | Four rejected by six-field action schema |
| moondream:1.8b | **0/12** | Eleven rejected by schema and one failed JSON decoding |
| **Total** | **20/48** | **28/48** |

The local inference transport and installed-model admission both worked.
The first owner workflow showed `FreeDM open-model replay: PARTIAL completed
48 samples` then exited with code 1: **a complete experiment was conflated
with all-model action-readiness**. It was appropriate to block actual
four-player gameplay, but inappropriate to treat 28 invalid model actions
as the absence of any research data.

Qwen3-VL 2B's exact empty-content hash in all 12 responses is evidence of
empty final action text; default thinking/token exhaustion is a plausible
explanation, **not a proven root cause**, because the v1 receipt did not
preserve Ollama's `message.thinking` or `done_reason`. Moondream and
Qwen2.5-VL failures similarly lacked the original invalid action text, so
we cannot retroactively classify their complete contents.

No OpenAI API requests or credits were consumed by this owner run.
Reported local request timings include host/model-load overhead;
do not claim universal inference throughput or game success.

## Corrective research protocol v2

1. Preserve the historical ZIP, `REPLAY.json`, `SHA256SUMS`, and
   all original Terra screenshots **unchanged**.
2. Change **new experiments only** to Ollama's documented six-field JSON
   schema rather than generic `format: "json"`. Record the protocol
   identifier, schema and model-specific settings in the new receipt.
3. Target the observed Qwen3-VL 2B empty-final-text case with an explicit
   `think: false` request and 384 max generated tokens. Other models
   retain their prior default thinking settings and 192 token cap.
4. Preserve every invalid action's actual bounded raw text, failure
   category, exact hash, `done_reason`, generation counters and thinking
   digest/character count if available. No text rewriting, model swapping,
   auto-retries or hidden action-fallback is permitted. Model reasoning
   content itself is **not** retained.
5. A replay with the exact expected sample count **and a completed model
   response for every attempted inference** can be marked `PARTIAL`
   while successfully collecting research data. A local transport/model
   error produces a `LOCAL_ERROR` sample and status `INCOMPLETE`,
   with nonzero exit, even when all 48 fixture attempts were scheduled.
   This preserves partial diagnostics without falsely counting missing
   provider responses as completed inferences.
   **The optional live stage remains fail-closed** unless all four
   models produce valid six-field controls in every selected replay
   fixture. Real engine action validation is independent.
6. Any before/after improvement in output validity represents a
   **changed protocol and model generation profile**, not evidence
   of higher intrinsic FPS skill or improved perception.

Ollama sources for the documented controls:

- https://github.com/ollama/ollama/blob/main/docs/capabilities/structured-outputs.mdx
- https://github.com/ollama/ollama/blob/main/docs/capabilities/thinking.mdx

The correction is tested offline using synthetic model responses and a
deliberately `PARTIAL` full-length replay, with no paid provider,
model download or owner-run GPU execution.
