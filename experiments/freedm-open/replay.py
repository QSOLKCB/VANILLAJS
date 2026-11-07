#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Locally replay the exact four-Terra FreeDM camera observations through open VLMs.

The original FreeDM game is NOT rerun. Actions cannot change the already
captured screenshots: agreement is a behavioral comparison, NOT FPS skill.
Only 127.0.0.1:11434 is contacted. No pulls, cloud APIs, tokens or npm.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "freedm-terra"))
from core import ROLES, agent_request_payload, parse_action, neutral_action, sha256

TERRA_RUN_ID = "42374695320"
TERRA_SOURCE_SHA = "afef132d8fd0a9acfc874ed760ea3dc5a175d906"
TERRA_MATCH_SHA256 = "4add0e7c1b2db8a5b72618d661a6420ce4d4b0af59bacff6aacdd2080e3cf50a"
TERRA_SUMS_SHA256 = "54fd28f5979c99f23721f6248fd94e054df1f3d73d3551932b47a9aa19e5844d"
TERRA_WAD_SHA256 = "d9adc4d792627e7fc47b09067b15486da724010c71dd12831e1cf8e0755b68ad"
MODEL_TAGS = ("qwen3-vl:2b", "qwen3-vl:4b-instruct",
              "qwen2.5vl:3b", "moondream:1.8b")
# Strict local JSON Schema is a new protocol version, not identical to the
# earlier /api/chat format="json" run. The original run/receipt is immutable.
PROTOCOL = "qsol.freedm.openvlm.structured-action.v2"
ACTION_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["move", "turn", "fire", "use", "sprint", "tactic"],
    "properties": {
        "move": {"type": "string", "enum": ["forward", "backward",
                                           "left", "right", "stop"]},
        "turn": {"type": "string", "enum": ["left", "right", "none"]},
        "fire": {"type": "boolean"}, "use": {"type": "boolean"},
        "sprint": {"type": "boolean"},
        "tactic": {"type": "string", "maxLength": 160},
    },
}
# Distinct model profiles are recorded as independent experimental factors.
# Qwen3-VL:2B exhausted all 192 generation tokens with empty action content
# in the owner's v1 evidence. Disable its thinking and allow more output.
def generation_profile(model: str) -> dict:
    require(model in MODEL_TAGS, "nonallowlisted model")
    settings = {"temperature": 0, "seed": 17, "num_ctx": 2048,
                "num_predict": 384 if model == "qwen3-vl:2b" else 192}
    return {"options": settings, "think": False if model == "qwen3-vl:2b" else None,
            "format": ACTION_SCHEMA}
BASE = "http://127.0.0.1:11434"
FRAME_COUNT = 12
MAX_FILE_BYTES = 256 * 1024
MAX_PNG_BYTES = 512 * 1024
HEAD_RE = re.compile(r"[a-f0-9]{40}\Z")
DIGEST_RE = re.compile(r"[a-f0-9]{64}\Z")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def file_bytes(file: Path, maximum: int) -> bytes:
    require(not file.is_symlink() and stat.S_ISREG(file.lstat().st_mode),
            "missing or nonregular source: " + str(file))
    require(0 < file.stat().st_size <= maximum, "invalid source file size")
    return file.read_bytes()


def checked_png(raw: bytes):
    require(len(raw) < MAX_PNG_BYTES and len(raw) > 33 and
            raw[:8] == b"\x89PNG\r\n\x1a\n" and raw[12:16] == b"IHDR" and
            raw[16:24] == b"\x00\x00\x01@\x00\x00\x00\xf0",
            "expected real 320x240 PNG, not a screenshot proxy")


def load_terra_archive(directory: Path) -> dict:
    """Accept only the exact source-anchored owner-run Terra match directory."""
    require(directory.is_dir() and not directory.is_symlink(),
            "source must be the immutable local match directory")
    match = file_bytes(directory / "MATCH.json", MAX_FILE_BYTES)
    sums = file_bytes(directory / "SHA256SUMS", 16 * 1024)
    require(sha256(match) == TERRA_MATCH_SHA256 and
            sha256(sums) == TERRA_SUMS_SHA256,
            "original Terra artifact byte identity mismatch")
    source = json.loads(match)
    require(source.get("status") == "PASS" and
            source.get("runId") == TERRA_RUN_ID and
            source.get("sourceSha") == TERRA_SOURCE_SHA and
            source.get("mode") == "paid" and
            source.get("game", {}).get("wad", {}).get("sha256") == TERRA_WAD_SHA256 and
            len(source.get("turns", [])) == FRAME_COUNT,
            "wrong Terra run, FreeDM IWAD, or completed-match identity")

    checksums = {}
    for line in sums.decode("ascii").splitlines():
        match_line = re.fullmatch(r"([a-f0-9]{64})  (MATCH\.json|frames/terra-(?:alpha|bravo|charlie|delta)/(?:0[0-9]|1[01])\.png)", line)
        require(match_line is not None, "unexpected checksum manifest member")
        digest, rel = match_line.groups()
        require(rel not in checksums, "duplicate checksum entry")
        checksums[rel] = digest
    require(len(checksums) == 49 and checksums["MATCH.json"] == TERRA_MATCH_SHA256,
            "expected 48 exact frames plus original match JSON")

    frames = {}
    for t, row in enumerate(source["turns"]):
        require(row.get("round") == t and row.get("phase") == "ENGINE_APPLIED" and
                len(row.get("observations", [])) == 4 and
                len(row.get("actions", [])) == 4,
                "not the 12 fully applied Terra rounds")
        for i, (role, _) in enumerate(ROLES):
            observation = row["observations"][i]
            action = row["actions"][i]
            expected_path = f"frames/{role.lower()}/{t:02}.png"
            require(observation.get("role") == role and
                    observation.get("framePath") == expected_path and
                    action.get("role") == role and
                    action.get("status") == "ENGINE_ACKNOWLEDGED" and
                    action.get("api", {}).get("model") == "gpt-6.1-terra",
                    "mismatched role, screenshot or action receipt")
            raw = file_bytes(directory / expected_path, MAX_PNG_BYTES)
            checked_png(raw)
            require(sha256(raw) == checksums[expected_path] ==
                    observation.get("imageSHA256"), "Terra screenshot SHA drift")
            frames[(role, t)] = raw
    return {"source": source, "frames": frames, "sums": sha256(sums),
            "match": sha256(match)}


def frame_indices(n: int) -> tuple[int, ...]:
    require(type(n) is int and 1 <= n <= 12, "1..12 paired frames per role required")
    if n == 1:
        return (0,)
    return tuple(i * 11 // (n - 1) for i in range(n))


def same_prompt(role: str, round_number: int, source: dict, screenshot: bytes) -> str:
    i = next(index for index, (name, _) in enumerate(ROLES) if name == role)
    obs = source["turns"][round_number]["observations"][i]
    previous = (source["turns"][round_number - 1]["actions"][i]["action"]
                if round_number else neutral_action())
    payload = agent_request_payload(role, ROLES[i][1], screenshot,
                                    obs["variables"], previous)
    # The prompt is produced by the exact Terra benchmark prompt builder,
    # not hand-translated into a more or less helpful open-model prompt.
    return payload["input"][0]["content"][0]["text"]


def local_opener():
    # Even with HTTP_PROXY environment settings, never proxy localhost traffic.
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def local_http(path: str, body: dict | None = None, *, timeout=90,
               opener=None) -> dict:
    require(path in ("/api/tags", "/api/chat", "/api/generate"),
            "nonallowlisted Ollama endpoint")
    url = BASE + path
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    require(data is None or len(data) <= 800 * 1024,
            "unbounded or nonlocal model request")
    headers = {"Content-Type": "application/json"} if data is not None else {}
    request = urllib.request.Request(url, data=data, headers=headers,
                                     method="POST" if data is not None else "GET")
    open_request = opener or local_opener().open
    try:
        with open_request(request, timeout=timeout) as response:
            raw = response.read(160 * 1024 + 1)
    except (TimeoutError, urllib.error.URLError) as error:
        raise RuntimeError("local Ollama connection failed: " + type(error).__name__) from None
    require(len(raw) <= 160 * 1024, "oversized local inference response")
    decoded = json.loads(raw.decode("utf-8"))
    require(type(decoded) is dict, "invalid Ollama response shape")
    return decoded


def installed_models(*, opener=None) -> dict:
    found = local_http("/api/tags", opener=opener)
    require(type(found.get("models")) is list, "Ollama model inventory unavailable")
    installed = {}
    for row in found["models"]:
        if type(row) is not dict:
            continue
        name = row.get("name")
        if name not in MODEL_TAGS:
            continue
        digest, size = row.get("digest"), row.get("size")
        require(type(digest) is str and DIGEST_RE.fullmatch(digest) is not None and
                type(size) is int and size >= 1_000_000_000,
                "unexpected local model fingerprint or cloud-only model")
        installed[name] = {"tag": name, "sha256": digest,
                           "installedBytes": size,
                           "details": row.get("details", {})}
    require(tuple(model for model in MODEL_TAGS if model not in installed) == (),
            "four specified local vision models must already be installed; no pull is allowed")
    return installed


def vision_action(model: str, prompt: str, screenshot: bytes, *, opener=None) -> dict:
    require(model in MODEL_TAGS, "nonallowlisted model")
    checked_png(screenshot)
    profile = generation_profile(model)
    request = {
        "model": model, "stream": False, "format": profile["format"],
        "keep_alive": "10m", "options": profile["options"],
        "messages": [{"role": "user", "content": prompt,
                      "images": [base64.b64encode(screenshot).decode("ascii")]}],
    }
    # Only the Qwen3 2B anomaly is subject to an explicit no-thinking
    # intervention. Other model defaults remain unchanged and documented.
    if profile["think"] is not None:
        request["think"] = profile["think"]
    started = time.perf_counter_ns()
    data = local_http("/api/chat", request, opener=opener, timeout=100)
    wall_ns = time.perf_counter_ns() - started
    text = data.get("message", {}).get("content")
    require(type(text) is str and len(text) <= 4096, "missing/oversized local action text")
    raw_hash = sha256(text.encode("utf-8"))
    response_message = data.get("message", {})
    thinking = response_message.get("thinking")
    metadata = {
        "wallNs": wall_ns, "rawTextSHA256": raw_hash,
        "providerModel": data.get("model"), "done": data.get("done"),
        "doneReason": data.get("done_reason"),
        "protocol": PROTOCOL,
        "numPredict": profile["options"]["num_predict"],
        "thinkingRequested": profile["think"],
        "format": "exact-six-field-json-schema",
    }
    if type(thinking) is str:
        # Preserve only thinking identity/length, not private model reasoning.
        metadata["thinkingCharacters"] = len(thinking)
        metadata["thinkingSHA256"] = sha256(thinking.encode("utf-8"))
    for name in ("prompt_eval_count", "eval_count", "total_duration",
                 "load_duration", "prompt_eval_duration", "eval_duration"):
        value = data.get(name)
        if type(value) is int and value >= 0:
            metadata[name] = value
    require(metadata["providerModel"] == model and metadata["done"] is True,
            "local model reply mismatch/incomplete")
    # Raw invalid output is intentionally retained for diagnosis, bounded to
    # 4096 chars and untrusted. Never repair it, auto-retry or count it valid.
    try:
        parsed = parse_action(text)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        category = ("EMPTY_ACTION_CONTENT" if not text.strip()
                    else "INVALID_JSON" if isinstance(error, json.JSONDecodeError)
                    else "SCHEMA_REJECTED")
        return {
            "status": "INVALID_ACTION", "meta": metadata,
            "errorClass": type(error).__name__, "errorCategory": category,
            "rawActionText": text,
        }
    return {"status": "VALID", "action": parsed, "meta": metadata}


def no_model_reload(model: str, *, opener=None):
    # Ollama's documented empty generation request releases the current model.
    # Best effort: does not change observed sample/result identities.
    try:
        local_http("/api/generate", {"model": model, "keep_alive": 0,
                                     "stream": False}, timeout=15, opener=opener)
    except (RuntimeError, ValueError):
        return False
    return True


def summarize(samples: list[dict]) -> dict:
    valid = [r for r in samples if r["status"] == "VALID"]
    timing = sorted(r["meta"]["wallNs"] / 1_000_000 for r in samples if "meta" in r)
    count = len(valid)
    return {
        "attempts": len(samples), "valid": count,
        "invalid": sum(r["status"] == "INVALID_ACTION" for r in samples),
        "localErrors": sum(r["status"] == "LOCAL_ERROR" for r in samples),
        "providerCompleted": sum(r["status"] in ("VALID", "INVALID_ACTION")
                                 for r in samples),
        "sameActionAsTerra": sum(r["agreement"]["all"] for r in valid),
        "sameMoveAsTerra": sum(r["agreement"]["move"] for r in valid),
        "sameTurnAsTerra": sum(r["agreement"]["turn"] for r in valid),
        "sameFireAsTerra": sum(r["agreement"]["fire"] for r in valid),
        "medianRequestMs": timing[len(timing) // 2] if timing else None,
        "p95RequestMs": timing[(95 * len(timing) + 99) // 100 - 1] if timing else None,
        "scoringBoundary": "Behavioral similarity to Terra on fixed frames; NOT game skill or frag results",
    }


def check_checkout(head: str):
    import subprocess
    require(type(head) is str and HEAD_RE.fullmatch(head) is not None,
            "full source SHA required")
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=Path(__file__).resolve().parents[2],
                                       text=True, timeout=10).strip()
    require(git("rev-parse", "HEAD") == head and
            git("branch", "--show-current") == "main" and
            not git("status", "--porcelain"),
            "exact reviewed main required; no replay of PR code on owner hardware")
    require("QSOLKCB/VANILLAJS" in git("remote", "get-url", "origin"),
            "unexpected source origin")


def save_file(path: Path, data: bytes):
    with path.open("xb") as output:
        output.write(data)


def seal(out: Path):
    # Replays contain only REPLAY.json; live matches additionally contain
    # role/turn PNGs in nested directories. All observed bytes must be
    # covered by the same checksum manifest, without symlink traversal.
    paths = sorted(p for p in out.rglob("*") if p.is_file() or p.is_symlink())
    require(1 <= len(paths) <= 64 and all(
        not p.is_symlink() and p.name != "SHA256SUMS" and
        all(not part.is_symlink() for part in p.parents if part != out)
        for p in paths
    ), "unsafe/unbounded or preexisting output sidecar")
    names = [p.relative_to(out).as_posix() for p in paths]
    require(len(set(names)) == len(names) and all(
        ".." not in Path(name).parts and "\n" not in name and "\r" not in name
        for name in names), "invalid output member path")
    save_file(out / "SHA256SUMS", "".join(
        sha256(p.read_bytes()) + "  " + name + "\n"
        for p, name in zip(paths, names)
    ).encode("ascii"))


def evaluate(args, *, opener=None):
    require(args.output.resolve() != args.source.resolve() and
            not args.output.exists() and
            Path(__file__).resolve().parents[2] not in args.output.resolve().parents,
            "new output outside repository and input required")
    check_checkout(args.head)
    dataset = load_terra_archive(args.source)
    inventory = installed_models(opener=opener)  # preflight before work
    selected = frame_indices(args.frames_per_role)
    args.output.mkdir(mode=0o700, parents=True)
    report = {
        "schemaVersion": 1, "kind": "qsol.vanillajs.freedm.open-vision-replay.v1",
        "status": "INCOMPLETE", "sourceSha": args.head, "provider": "Ollama localhost only",
        "comparison": "paired fixed Terra observations, not a live 4-player match",
        "terraBaseline": {"runId": TERRA_RUN_ID, "matchSha256": dataset["match"],
                          "manifestSha256": dataset["sums"],
                          "wadSha256": TERRA_WAD_SHA256,
                          "sourceSha": TERRA_SOURCE_SHA,
                          "model": "gpt-6.1-terra",
                          "observedFragLeader": "TERRA-ALPHA",
                          "observedLeaderFrags": 1},
        "modelInventory": inventory, "selectedRoundsPerRole": list(selected),
        "protocol": PROTOCOL,
        "generationProfiles": {
            tag: {"options": generation_profile(tag)["options"],
                  "thinkingRequested": generation_profile(tag)["think"],
                  "format": "exact-six-field-json-schema"}
            for tag in MODEL_TAGS},
        "temperature": 0, "seed": 17, "samples": [],
        "summary": {}, "errors": [],
        "limits": [
            "Open models are not controlling Doom in paired replay; no actual open-model frag counts.",
            "Terra model output is a reference, not ground-truth optimal behavior.",
            "The local model observes original PNG pixels; Terra used a low-detail remote vision input.",
            "Model weights/tags are inventoried but not claimed bit-exact inference across GPU configurations.",
            "Model runtime includes prompt decoding, image processing, loading and host overhead.",
            "No external cloud API, model pull, gameplay replay or API credits.",
        ],
    }
    try:
        for tag in MODEL_TAGS:
            samples = []
            for role, _ in ROLES:
                i = next(k for k, (name, _) in enumerate(ROLES) if name == role)
                for turn in selected:
                    observation = dataset["source"]["turns"][turn]["observations"][i]
                    reference = dataset["source"]["turns"][turn]["actions"][i]["action"]
                    png = dataset["frames"][(role, turn)]
                    prompt = same_prompt(role, turn, dataset["source"], png)
                    row = {"modelTag": tag, "modelDigest": inventory[tag]["sha256"],
                           "role": role, "round": turn,
                           "imageSHA256": observation["imageSHA256"],
                           "promptSHA256": sha256(prompt.encode("utf-8")),
                           "terraAction": reference}
                    try:
                        prediction = vision_action(tag, prompt, png, opener=opener)
                        row.update(prediction)
                        if prediction["status"] == "VALID":
                            action = prediction["action"]
                            row["agreement"] = {
                                "all": all(action[k] == reference[k]
                                           for k in ("move", "turn", "fire", "use", "sprint")),
                                "move": action["move"] == reference["move"],
                                "turn": action["turn"] == reference["turn"],
                                "fire": action["fire"] == reference["fire"],
                            }
                    except (RuntimeError, ValueError, TypeError) as error:
                        row.update(status="LOCAL_ERROR",
                                   errorClass=type(error).__name__,
                                   error=str(error)[:200])
                        report["errors"].append({"modelTag": tag, "role": role,
                                                 "round": turn,
                                                 "error": str(error)[:200]})
                    samples.append(row)
                    report["samples"].append(row)
            report["summary"][tag] = summarize(samples)
            no_model_reload(tag, opener=opener)
        # Distinguish complete inference that emitted invalid controls from a
        # transport/inference failure with no usable model response. Attempting
        # a request does not prove that the provider completed an answer.
        expected = len(MODEL_TAGS) * len(ROLES) * len(selected)
        report["executionComplete"] = (
            len(report["samples"]) == expected and
            all(row["status"] in ("VALID", "INVALID_ACTION")
                for row in report["samples"]))
        report["status"] = (
            "INCOMPLETE" if not report["executionComplete"]
            else "PASS" if all(row["status"] == "VALID"
                               for row in report["samples"])
            else "PARTIAL")
        report["liveReadiness"] = {
            "eligible": report["executionComplete"] and report["status"] == "PASS",
            "reason": "requires all four models to return valid actions on every paired test",
        }
    except Exception as error:
        report["errors"].append({"errorClass": type(error).__name__,
                                 "reason": str(error)[:200]})
        raise
    finally:
        save_file(args.output / "REPLAY.json",
                  json.dumps(report, sort_keys=True, indent=2, allow_nan=False).encode() + b"\n")
        seal(args.output)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True,
                        help="Original local match/ directory from Terra run 42374695320")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--frames-per-role", type=int, default=3,
                        choices=range(1, 13), metavar="{1..12}")
    args = parser.parse_args()
    try:
        receipt = evaluate(args)
        print("FreeDM open-model replay:", receipt["status"],
              "completed", len(receipt["samples"]), "samples")
        # A complete experiment containing invalid model outputs is itself
        # a valid research outcome. The live stage has a separate strict
        # readiness gate and cannot start on a partial replay.
        if not receipt.get("executionComplete") or receipt["status"] not in ("PASS", "PARTIAL"):
            raise SystemExit(1)
    except (OSError, ValueError, TypeError, RuntimeError) as error:
        print("FreeDM open-model replay FAIL:", error, file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
