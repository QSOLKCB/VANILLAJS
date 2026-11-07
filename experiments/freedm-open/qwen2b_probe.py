#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Isolation test for Qwen3-VL 2B empty final answers in FreeDM/OpenVLM-001.

An exact-prompt, one-variable-per-pair experiment:
  - text only, then identical text with one pinned original FreeDM PNG
  - generic Ollama JSON vs tiny JSON schema
  - think omitted, false or true
  - a separate full FreeDM action-schema control in each modality

This deliberately DOES NOT launch ViZDoom, alter the original Terra/OpenVLM
archive, install models, call OpenAI, or lift the four-player readiness gate.
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
import sys
import time

import replay
from core import parse_action, sha256

MODEL = "qwen3-vl:2b"
MODEL_DIGEST = "0635d9d857d497aeadba3d7d27485746c50554446f9f6ec01ef39788221adbe8"
MODEL_MIN_BYTES = 1_000_000_000
PROTOCOL = "qsol.freedm.qwen3vl2b.isolation.v1"
V2_SOURCE_RUN = "42384730140"
V2_REPLAY_SHA256 = "564d64e9bf40e463256c6aad8f237790ca2ac5c2d75c76e92ee1c700ddadbc82"
IMAGE_ROLE = "TERRA-ALPHA"
IMAGE_ROUND = 5
MAX_REQUESTS = 14
OUTPUT_MAX_CHARS = 4096
OUTPUT_TOKEN_LIMIT = 384
TINY_PROMPT = (
    'Return only this exact JSON object: {"move":"forward"}. '
    'The single move field must equal forward. Do not include extra fields, '
    'Markdown, explanations, or any text outside the JSON object. '
    'If an image is attached, do not interpret it for this diagnostic task.'
)
FULL_PROMPT = (
    'Return only this exact JSON object: '
    '{"move":"forward","turn":"none","fire":false,"use":false,'
    '"sprint":false,"tactic":"probe"}. '
    'No other fields, Markdown, explanations, or text outside the JSON. '
    'If an image is attached, do not interpret it for this diagnostic task.'
)
TINY_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["move"],
    "properties": {"move": {"type": "string", "enum": ["forward"]}},
}
TINY_EXPECTED = {"move": "forward"}
FULL_EXPECTED = {
    "move": "forward", "turn": "none", "fire": False,
    "use": False, "sprint": False, "tactic": "probe",
}
FORMATS = ("schema", "json")
THINK_MODES = ("omitted", "false", "true")
MODALITIES = ("text", "image")
COMPLETE_OUTCOMES = {
    "VALID_EXACT", "VALID_DIFFERENT", "INVALID_JSON",
    "SCHEMA_REJECTED", "EMPTY_CONTENT",
}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def cases():
    """Text controls precede image controls; paired conditions are identical."""
    out = []
    for modality in MODALITIES:
        for fmt in FORMATS:
            for thinking in THINK_MODES:
                out.append({"id": f"tiny-{modality}-{fmt}-{thinking}",
                            "schema": "tiny", "modality": modality,
                            "formatMode": fmt, "thinkMode": thinking})
        # The full action control is separate from the small-schema comparison.
        out.append({"id": f"full-{modality}-schema-false",
                    "schema": "full", "modality": modality,
                    "formatMode": "schema", "thinkMode": "false"})
    require(len(out) == MAX_REQUESTS and
            len(set(row["id"] for row in out)) == MAX_REQUESTS,
            "probe matrix must have 14 unique conditions")
    return out


def model_inventory(opener=None):
    """Pin same exact Qwen3-VL 2B weights used in the owner's v2 run."""
    found = replay.local_http("/api/tags", opener=opener)
    require(type(found.get("models")) is list, "local model inventory missing")
    rows = [entry for entry in found["models"]
            if type(entry) is dict and entry.get("name") == MODEL]
    require(len(rows) == 1, "exactly one locally installed Qwen3-VL 2B required")
    item = rows[0]
    require(item.get("digest") == MODEL_DIGEST and
            type(item.get("size")) is int and item["size"] >= MODEL_MIN_BYTES and
            not item.get("remote_model") and not item.get("remote_host"),
            "different, absent, or cloud-backed Qwen3-VL 2B; no model pull allowed")
    return {"modelTag": MODEL, "sha256": MODEL_DIGEST,
            "bytes": item["size"]}


def local_metadata(opener=None):
    """The absence of /api/show thinking metadata is itself an observation."""
    version = replay.local_http("/api/version", opener=opener)
    require(type(version.get("version")) is str and
            1 <= len(version["version"]) <= 80,
            "Ollama local version missing or invalid")
    details = replay.local_http("/api/show", {"model": MODEL}, opener=opener)
    raw = details.get("thinking")
    require(raw is None or type(raw) is dict,
            "unexpected thinking metadata from Ollama")
    if raw is None:
        think = None
    else:
        values = raw.get("values")
        default = raw.get("default")
        require(type(values) is list and len(values) <= 12 and
                all(type(v) is bool or (type(v) is str and len(v) <= 64)
                    for v in values) and
                (type(default) is bool or
                 (type(default) is str and len(default) <= 64) or
                 default is None),
                "invalid/oversized thinking capability metadata")
        think = {"values": values, "default": default}
    return {"ollamaVersion": version["version"], "thinking": think}


def request_for(case: dict, image: bytes | None):
    require(case in cases(), "unknown or mutated experiment condition")
    schema_name = case["schema"]
    prompt = TINY_PROMPT if schema_name == "tiny" else FULL_PROMPT
    if case["modality"] == "image":
        require(type(image) is bytes, "pinned image required for image probe")
        replay.checked_png(image)
    else:
        require(image is None, "text-only probe cannot receive image bytes")
    fmt = TINY_SCHEMA if schema_name == "tiny" else replay.ACTION_SCHEMA
    body = {
        "model": MODEL, "stream": False,
        "format": fmt if case["formatMode"] == "schema" else "json",
        "keep_alive": "10m",
        "options": {"temperature": 0, "seed": 17, "num_ctx": 2048,
                    "num_predict": OUTPUT_TOKEN_LIMIT},
        "messages": [{"role": "user", "content": prompt}],
    }
    if image is not None:
        body["messages"][0]["images"] = [base64.b64encode(image).decode("ascii")]
    # Omitting think is semantically different from setting false or true:
    # let Ollama use its default when the experiment says omitted.
    if case["thinkMode"] != "omitted":
        body["think"] = case["thinkMode"] == "true"
    return body, prompt


def check_content(case, content):
    require(type(content) is str and len(content) <= OUTPUT_MAX_CHARS,
            "local model content missing or unbounded")
    if not content.strip():
        return {"status": "EMPTY_CONTENT", "rawContent": content}
    try:
        decoded = json.loads(content)
    except json.JSONDecodeError:
        return {"status": "INVALID_JSON", "rawContent": content}
    if case["schema"] == "tiny":
        valid = (type(decoded) is dict and set(decoded) == {"move"}
                 and decoded["move"] == "forward")
    else:
        try:
            parse_action(content)
            valid = True
        except (ValueError, TypeError, json.JSONDecodeError):
            valid = False
    if not valid:
        return {"status": "SCHEMA_REJECTED", "rawContent": content}
    expected = TINY_EXPECTED if case["schema"] == "tiny" else FULL_EXPECTED
    return {"status": "VALID_EXACT" if decoded == expected else "VALID_DIFFERENT",
            "rawContent": content}


def run_case(case: dict, image: bytes | None, *, opener=None):
    body, prompt = request_for(case, image)
    request_metadata = {
        "formatMode": case["formatMode"],
        "schema": case["schema"], "thinkMode": case["thinkMode"],
        "imageAttached": image is not None, "seed": 17,
        "temperature": 0, "numCtx": 2048, "numPredict": OUTPUT_TOKEN_LIMIT,
        "promptSHA256": sha256(prompt.encode("utf-8")),
        "sourceImageSHA256": sha256(image) if image is not None else None,
    }
    record = {"id": case["id"], "condition": dict(case),
              "request": request_metadata}
    started = time.perf_counter_ns()
    try:
        response = replay.local_http("/api/chat", body, timeout=90, opener=opener)
        duration = time.perf_counter_ns() - started
        msg = response.get("message")
        require(type(msg) is dict and response.get("model") == MODEL and
                response.get("done") is True,
                "incomplete/wrong-model Ollama response")
        output = msg.get("content")
        details = check_content(case, output)
        thinking = msg.get("thinking")
        timing = {"wallNs": duration,
                  "doneReason": response.get("done_reason"),
                  "reportedModel": response.get("model"),
                  "rawActionSHA256": sha256(output.encode("utf-8"))}
        if type(thinking) is str:
            # Do not persist model private reasoning text in the archive.
            timing["thinkingCharacters"] = len(thinking)
            timing["thinkingSHA256"] = sha256(thinking.encode("utf-8"))
        for field in ("prompt_eval_count", "eval_count", "total_duration",
                      "load_duration", "prompt_eval_duration", "eval_duration"):
            if type(response.get(field)) is int and response[field] >= 0:
                timing[field] = response[field]
        record.update(details)
        record["metrics"] = timing
    except (RuntimeError, ValueError, TypeError) as error:
        record["status"] = "LOCAL_ERROR"
        record["errorClass"] = type(error).__name__
        record["errorMessage"] = str(error)[:200]
        record["metrics"] = {"wallNs": time.perf_counter_ns() - started}
    return record


def summarize(records):
    count = {}
    for row in records:
        count[row["status"]] = count.get(row["status"], 0) + 1
    return {
        "total": len(records),
        "providerCompleted": sum(r["status"] in COMPLETE_OUTCOMES for r in records),
        "localErrors": count.get("LOCAL_ERROR", 0),
        "validExact": count.get("VALID_EXACT", 0),
        "validDifferent": count.get("VALID_DIFFERENT", 0),
        "emptyContent": count.get("EMPTY_CONTENT", 0),
        "invalidJSON": count.get("INVALID_JSON", 0),
        "schemaRejected": count.get("SCHEMA_REJECTED", 0),
        "byStatus": count,
        "isDiagnosticNotGameReadiness": True,
    }


def examine_pairs(records):
    by_id = {row["id"]: row for row in records}
    pairs = []
    for fmt in FORMATS:
        for thinking in THINK_MODES:
            text_case = by_id["tiny-text-" + fmt + "-" + thinking]
            image_case = by_id["tiny-image-" + fmt + "-" + thinking]
            require(text_case["request"]["promptSHA256"] ==
                    image_case["request"]["promptSHA256"],
                    "text/image pair has different prompt bytes")
            pairs.append({
                "schema": "tiny", "formatMode": fmt, "thinkMode": thinking,
                "textStatus": text_case["status"],
                "imageStatus": image_case["status"],
                "samePrompt": True,
            })
    return pairs


def execute(args, *, opener=None, source_loader=None, inventory=None):
    root = Path(__file__).resolve().parents[2]
    out = args.output
    require(not out.exists() and not out.is_symlink() and
            root not in out.resolve().parents and
            out.resolve() != args.source.resolve(),
            "refusing to overwrite source or evidence checkout")
    replay.check_checkout(args.head)
    original = (source_loader or replay.load_terra_archive)(args.source)
    image = original["frames"][(IMAGE_ROLE, IMAGE_ROUND)]
    replay.checked_png(image)
    expected_sha = original["source"]["turns"][IMAGE_ROUND]["observations"][0]["imageSHA256"]
    require(sha256(image) == expected_sha, "pinned original FreeDM PNG identity changed")
    inventory_check = inventory or model_inventory
    known = inventory_check(opener=opener)
    capabilities = local_metadata(opener=opener)
    out.mkdir(parents=True, mode=0o700)
    report = {
        "schemaVersion": 1, "kind": PROTOCOL,
        "status": "INCOMPLETE", "sourceSha": args.head,
        "testModel": known, "ollama": capabilities,
        "priorV2": {"runId": V2_SOURCE_RUN, "replaySHA256": V2_REPLAY_SHA256,
                    "historicalQwen2BValidity": "0/12"},
        "historicalTerra": {
            "runId": replay.TERRA_RUN_ID,
            "sourceSha": replay.TERRA_SOURCE_SHA,
            "matchSHA256": original["match"],
            "manifestSHA256": original["sums"],
            "wadSHA256": replay.TERRA_WAD_SHA256,
            "frameRole": IMAGE_ROLE, "frameRound": IMAGE_ROUND,
            "imageSHA256": sha256(image),
        },
        "sourceFilesUnchanged": True,
        "matrix": cases(), "records": [], "pairs": [],
        "summary": {},
        "limitations": [
            "All probes request the same fixed trivial action; no claim of vision comprehension.",
            "Image-on vs image-off comparisons vary screenshot attachment only within each pair.",
            "Generic JSON vs schema format and thinking flags are separate experimental factors.",
            "A single sample per condition does not establish statistical reliability.",
            "Text-only trials precede image trials: warmup/caching may affect latency.",
            "Thinking content is neither requested for archiving nor persisted; only length/hash.",
            "This probe DOES NOT change four-player liveReadiness or trigger a deathmatch.",
            "The original Terra/OpenVLM receipts remain unchanged.",
            "No API credits, GPU benchmark, model pull, code patch or automatic retries.",
        ],
    }
    try:
        for case in cases():
            record = run_case(case, image if case["modality"] == "image" else None,
                              opener=opener)
            report["records"].append(record)
        report["pairs"] = examine_pairs(report["records"])
        report["summary"] = summarize(report["records"])
        # A provider request failure is not a completed model response,
        # even if all 14 attempts were made and recorded.
        report["status"] = (
            "COMPLETE" if (len(report["records"]) == MAX_REQUESTS and
                           report["summary"]["providerCompleted"] == MAX_REQUESTS)
            else "INCOMPLETE"
        )
        # Recheck the same pinned model identity after inference; the
        # injected checker in offline unit tests is still zero-network.
        after = inventory_check(opener=opener)
        if after != known:
            report["status"] = "INCOMPLETE"
            report["modelDrift"] = {"before": known, "after": after}
    except Exception as error:
        # A failed postflight model digest/transport check invalidates the
        # whole protocol receipt even if all prior model replies completed.
        # Preserve the original rows, but never seal contradictory COMPLETE
        # status alongside fatalError.
        report["status"] = "INCOMPLETE"
        report["fatalError"] = {"class": type(error).__name__,
                               "message": str(error)[:200]}
        raise
    finally:
        if not report["summary"]:
            report["summary"] = summarize(report["records"])
        replay.save_file(out / "PROBE.json", (
            json.dumps(report, sort_keys=True, indent=2, allow_nan=False) + "\n"
        ).encode("utf-8"))
        replay.seal(out)
    return report


def main():
    p = argparse.ArgumentParser(description="Qwen3-VL 2B text/image isolation")
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--head", required=True)
    args = p.parse_args()
    try:
        report = execute(args)
        print("Qwen3-VL 2B isolation:", report["status"],
              "provider responses", report["summary"]["providerCompleted"],
              "of", MAX_REQUESTS,
              "; empty text", report["summary"]["emptyContent"],
              "; exact actions", report["summary"]["validExact"])
        if report["status"] != "COMPLETE":
            raise SystemExit(1)
    except (RuntimeError, ValueError, TypeError, OSError, KeyError) as error:
        print("Qwen3-VL 2B probe failed:", error, file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
