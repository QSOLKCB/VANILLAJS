#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Exploratory *live* FreeDM match: four local vision models, four engine peers.

Unlike paired offline replay, each model's decisions change the live world.
One shared GPU services vision requests sequentially with rotating order.
This means inference delay, map/spawn and model scheduling confound frag scores.
"""
from __future__ import annotations

import argparse
import json
import multiprocessing
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "freedm-terra"))
from core import buttons, neutral_action, png_rgb24, sha256

import run as terra_engine
from replay import (
    MODEL_TAGS, TERRA_RUN_ID, TERRA_SOURCE_SHA, TERRA_WAD_SHA256,
    check_checkout, installed_models, no_model_reload, save_file, seal,
    vision_action,
)

ROLES = (
    ("OPEN-Q3-2B", MODEL_TAGS[0]),
    ("OPEN-Q3-4B", MODEL_TAGS[1]),
    ("OPEN-Q25-3B", MODEL_TAGS[2]),
    ("OPEN-MOON", MODEL_TAGS[3]),
)
MAX_ROUNDS = 12
MAX_WALL_SECONDS = 20 * 60


def live_prompt(role: str, observation: dict, previous: dict) -> str:
    # Identical neutral tactics for all local models, differing only by the
    # displayed player name. This differs from Terra's role-specific tactics;
    # the live match is therefore not a controlled Terra-vs-open causal test.
    return (
        "You are " + role + " controlling ONE actual first-person player "
        "in a four-player FreeDM MAP01 deathmatch. A screenshot from your "
        "own current camera is attached. No hidden enemy positions, depth, "
        "automap, console commands or external tools are available. "
        "Return exactly one JSON object with these keys and types: "
        '{"move":"forward|backward|left|right|stop",'
        '"turn":"left|right|none","fire":boolean,"use":boolean,'
        '"sprint":boolean,"tactic":"short reason"}. '
        "Choose where to move, turn and fire to engage opponents or obtain "
        "weapons/ammo. Each action lasts one short bounded game-tic interval. "
        "In-game counters: " + json.dumps(observation["variables"],
                                           sort_keys=True, separators=(",", ":")) +
        "\nPrevious action: " + json.dumps(previous, sort_keys=True,
                                          separators=(",", ":"))
    )


def save_json(path: Path, content: dict):
    save_file(path, json.dumps(content, indent=2, sort_keys=True,
                               allow_nan=False).encode("utf-8") + b"\n")


def play(args):
    terra_engine.require(20000 <= args.port <= 39999,
                         "local multiplayer port outside 20000..39999")
    terra_engine.require(1 <= args.decisions <= MAX_ROUNDS,
                         "maximum twelve real gameplay decisions")
    terra_engine.require(not args.output.exists() and
                         args.output.resolve() != args.wad.resolve() and
                         Path(__file__).resolve().parents[2] not in args.output.resolve().parents,
                         "live output must be fresh, outside repository")
    check_checkout(args.head)
    wad = terra_engine.valid_wad(args.wad)
    terra_engine.require(wad["sha256"] == TERRA_WAD_SHA256,
                         "same exact FreeDM IWAD required for cautious comparison")
    installed = installed_models()
    args.output.mkdir(mode=0o700, parents=True)
    images = args.output / "frames"
    images.mkdir(mode=0o700)

    report = {
        "schemaVersion": 1,
        "kind": "qsol.vanillajs.freedm.open-vlm-live.v1",
        "status": "ABORTED", "sourceSha": args.head,
        "terraReference": {"runId": TERRA_RUN_ID, "sourceSha": TERRA_SOURCE_SHA,
                           "recordedLeader": "TERRA-ALPHA",
                           "recordedFrags": 1,
                           "notDirectlyComparable": True},
        "game": {"mode": "real four-player FreeDM/ViZDoom",
                 "map": "map01", "engineMode": "ASYNC_PLAYER",
                 "wad": wad, "port": args.port},
        "models": installed,
        "players": [], "turns": [], "final": [],
        "modelOrder": [{"player": name, "modelTag": tag}
                       for name, tag in ROLES],
        "modelSchedule": "sequential inference, rotated starting player each round",
        "paidAPICredits": 0,
        "limitations": [
            "This is a live open-weight match; NOT a paired or same-spawn Terra rerun.",
            "Only one local inference request at a time; the engine advances while models reason.",
            "Model latency and inferred GPU/CPU residency affect observed gameplay results.",
            "No game engine determinism, fixed FPS, matched random seed or fair skill attribution.",
            "Runtime state cannot prove local inference used GPU rather than CPU without separate instrumentation.",
            "Tactic JSON is model commentary, not independent visual ground truth.",
        ],
    }
    sessions = []
    last = {name: neutral_action() for name, _ in ROLES}
    started = time.monotonic()
    try:
        sessions, report["players"] = terra_engine.spawn_players(
            multiprocessing.get_context("spawn"), str(args.wad), args.port,
            ROLES)
        for step in range(args.decisions):
            terra_engine.require(time.monotonic() - started < MAX_WALL_SECONDS,
                                 "live match exceeded bounded wall time")
            for pipe, _ in sessions:
                pipe.send({"op": "observe"})
            observations = [
                terra_engine.receive(pipe, terra_engine.STEP_TIMEOUT_S, "observation")
                for pipe, _ in sessions
            ]
            frame_metadata = []
            frames = []
            for i, (name, _) in enumerate(ROLES):
                item = observations[i]
                png = item.pop("image")
                terra_engine.require(item.get("role") == name and
                                     item.get("variables", {}).get("PLAYER_COUNT") == 4 and
                                     sha256(png) == item.get("imageSHA256"),
                                     "engine camera/role mismatch")
                frame_path = f"frames/{name.lower()}/{step:02}.png"
                destination = args.output / frame_path
                destination.parent.mkdir(mode=0o700, exist_ok=True)
                save_file(destination, png)
                frames.append(png)
                item["framePath"] = frame_path
                frame_metadata.append(item)
            round_record = {"round": step, "phase": "OBSERVED_UNAPPLIED",
                            "observations": frame_metadata, "actions": [],
                            "modelRequestOrder": [], "secondsFromStart": round(
                                time.monotonic() - started, 4)}
            report["turns"].append(round_record)
            chosen = [None] * 4
            # Rotating starting index spreads the order-dependent model
            # scheduling disadvantage; it does NOT make latency equal.
            request_order = [(step + i) % 4 for i in range(4)]
            for i in request_order:
                name, tag = ROLES[i]
                round_record["modelRequestOrder"].append(name)
                prompt = live_prompt(name, observations[i], last[name])
                action_row = {
                    "role": name, "modelTag": tag, "modelDigest": installed[tag]["sha256"],
                    "status": "INFERENCE_UNAPPLIED", "promptSHA256": sha256(prompt.encode()),
                }
                round_record["actions"].append(action_row)
                try:
                    result = vision_action(tag, prompt, frames[i])
                    action_row["inference"] = result
                    if result["status"] != "VALID":
                        round_record["phase"] = "INVALID_ACTION_ABORTED_UNAPPLIED"
                        raise ValueError("local model returned invalid action: " + name)
                    chosen[i] = result["action"]
                    action_row["status"] = "READY_NOT_APPLIED"
                    action_row["vector"] = buttons(chosen[i])
                except Exception as error:
                    action_row["error"] = {"class": type(error).__name__,
                                           "reason": str(error)[:200]}
                    round_record["phase"] = "LOCAL_INFERENCE_ABORTED_UNAPPLIED"
                    raise
            # Only after all four model actions were validated is an engine
            # action transmitted. On a worker failure below, do not falsely
            # claim none of the actions were applied.
            round_record["phase"] = "ENGINE_APPLY_UNCONFIRMED"
            for i, (pipe, _) in enumerate(sessions):
                pipe.send({"op": "act", "buttons": buttons(chosen[i])})
            results = [terra_engine.receive(pipe, terra_engine.STEP_TIMEOUT_S, "acted")
                       for pipe, _ in sessions]
            by_name = {item["role"]: item for item in round_record["actions"]}
            for i, (name, _) in enumerate(ROLES):
                by_name[name]["status"] = "ENGINE_ACKNOWLEDGED"
                by_name[name]["result"] = results[i]
                last[name] = chosen[i]
            round_record["phase"] = "ENGINE_APPLIED"
            if all(result["ended"] for result in results):
                report["matchEndedEarly"] = True
                break
        report["status"] = "PASS" if report["turns"] else "ABORTED"
    except Exception as error:
        report["error"] = {"class": type(error).__name__,
                           "message": str(error)[:400]}
        raise
    finally:
        report["final"] = terra_engine.stop_players(sessions)
        report["elapsedWallSeconds"] = round(time.monotonic() - started, 3)
        for name in MODEL_TAGS:
            no_model_reload(name)
        save_json(args.output / "MATCH.json", report)
        seal(args.output)
        print("FreeDM open-model live:", report["status"], "; rounds:",
              len(report["turns"]), "; output:", args.output, flush=True)
    return report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--wad", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--head", required=True)
    p.add_argument("--port", type=int, default=25040)
    p.add_argument("--decisions", type=int, default=6)
    a = p.parse_args()
    try:
        r = play(a)
        if r["status"] != "PASS":
            raise SystemExit(1)
    except (OSError, ValueError, TypeError, TimeoutError, RuntimeError,
            EOFError, KeyboardInterrupt) as error:
        print("FreeDM open-model live failed:", error, file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
