#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Four REAL ViZDoom/FreeDM clients, each independently controlled by Terra.

The four ZDoom peers connect over the local loopback interface. One worker
process owns one engine instance. The parent controls bounded API scheduling
and immutable evidence. In ASYNC_PLAYER mode the match continues during API
latency; this is genuine observed play, NOT a deterministic replay oracle.

Only owner-dispatched workflows may invoke --mode paid. --mode smoke uses
the exact four-player game topology with no API requests.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import multiprocessing
import os
from pathlib import Path
import re
import stat
import sys
import time

from core import (
    MODEL, ROLES, BUTTONS, MAX_DECISIONS, Budget, agent_request_payload,
    buttons, call_terra, canonical, neutral_action, png_rgb24, require, sha256,
)

SOURCE_ROOT = Path(__file__).resolve().parents[2]
MAP = "map01"
ACTIONS_TICS = 35  # nominal one second of *game time* per model decision
INIT_TIMEOUT_S = 120
STEP_TIMEOUT_S = 100
MAX_MATCH_SECONDS = 12 * 60


def worker(index: int, transport, wad: str, port: int):
    game = None
    role = ROLES[index][0]
    try:
        import vizdoom as vzd  # intentionally unavailable in hosted offline CI

        game = vzd.DoomGame()
        game.set_doom_game_path(wad)
        game.set_doom_map(MAP)
        game.set_screen_resolution(vzd.ScreenResolution.RES_320X240)
        game.set_screen_format(vzd.ScreenFormat.RGB24)
        game.set_window_visible(False)
        game.set_sound_enabled(False)
        game.set_render_hud(True)
        game.set_render_weapon(True)
        game.set_depth_buffer_enabled(False)
        game.set_labels_buffer_enabled(False)
        game.set_automap_buffer_enabled(False)
        game.set_mode(vzd.Mode.ASYNC_PLAYER)
        game.set_ticrate(35)
        game.set_episode_timeout(35 * 8 * 60)
        for name in BUTTONS:
            game.add_available_button(getattr(vzd.Button, name))
        variable_names = ("FRAGCOUNT", "DEATHCOUNT", "HEALTH", "AMMO2",
                          "PLAYER_COUNT", "PLAYER_NUMBER")
        variables = {name: getattr(vzd.GameVariable, name)
                     for name in variable_names}
        for var in variables.values():
            game.add_available_game_variable(var)
        if index == 0:
            args = (
                f"-host 4 -port {port} -deathmatch +timelimit 8.0 "
                "+viz_connect_timeout 120 +sv_forcerespawn 1 "
                "+sv_noautoaim 1 +sv_nocrouch 1 +viz_nocheat 1 "
                "+sv_spawnfarthest 1 +viz_respawn_delay 0"
            )
        else:
            args = f"-join 127.0.0.1 -port {port} +viz_connect_timeout 120"
        game.add_game_args(args + f" +name {role} +colorset {index}")
        game.init()
        require(bool(game.is_multiplayer_game()), "not a genuine multiplayer game")
        transport.send({
            "kind": "ready", "role": role, "engine": str(getattr(vzd, "__version__", "unknown")),
            "map": MAP,
            "playerNumber": int(game.get_game_variable(variables["PLAYER_NUMBER"])),
            "playerCount": int(game.get_game_variable(variables["PLAYER_COUNT"])),
        })

        def sample():
            if game.is_player_dead():
                game.respawn_player()
            state = game.get_state()
            require(state is not None, "no engine screenshot state")
            png = png_rgb24(state.screen_buffer)
            return {
                "kind": "observation", "role": role,
                "image": png, "imageSHA256": sha256(png),
                "ended": bool(game.is_episode_finished()),
                "variables": {
                    name: int(game.get_game_variable(variable))
                    for name, variable in variables.items()
                },
            }

        while True:
            command = transport.recv()
            if command["op"] == "observe":
                transport.send(sample())
            elif command["op"] == "act":
                vector = command["buttons"]
                require(type(vector) is list and len(vector) == len(BUTTONS)
                        and all(type(x) is int and x in (0, 1) for x in vector),
                        "invalid engine button vector")
                if not game.is_episode_finished():
                    game.make_action(vector, ACTIONS_TICS)
                    game.set_action([0] * len(BUTTONS))
                transport.send({
                    "kind": "acted", "role": role,
                    "ended": bool(game.is_episode_finished()),
                    "frags": int(game.get_game_variable(variables["FRAGCOUNT"])),
                    "deaths": int(game.get_game_variable(variables["DEATHCOUNT"])),
                })
            elif command["op"] == "stop":
                scoreboard = None
                if index == 0:
                    server = game.get_server_state()
                    if server is not None:
                        scoreboard = [
                            {"slot": i, "name": str(server.players_names[i]),
                             "frags": int(server.players_frags[i])}
                            for i, online in enumerate(server.players_in_game)
                            if online
                        ]
                transport.send({"kind": "final", "role": role,
                    "frags": int(game.get_game_variable(variables["FRAGCOUNT"])),
                    "deaths": int(game.get_game_variable(variables["DEATHCOUNT"])),
                    "scoreboard": scoreboard})
                break
            else:
                raise ValueError("unknown worker operation")
    except Exception as exc:
        try:
            transport.send({"kind": "error", "role": role,
                            "errorClass": type(exc).__name__,
                            "message": str(exc)[:500]})
        except (BrokenPipeError, EOFError, OSError):
            pass
    finally:
        if game is not None:
            game.close()
        transport.close()


def receive(pipe, timeout: float, expected: str):
    if not pipe.poll(timeout):
        raise TimeoutError(f"ViZDoom worker timeout while awaiting {expected}")
    message = pipe.recv()
    require(type(message) is dict and
            message.get("kind") == expected,
            "worker failed during " + expected + ": " +
            str(message.get("errorClass", "protocol")) + " " +
            str(message.get("message", ""))[:200])
    return message


def valid_wad(path: Path) -> dict:
    require(path.is_file() and not path.is_symlink() and
            stat.S_ISREG(path.stat().st_mode) and
            path.name.lower() == "freedm.wad",
            "expected regular FreeDM IWAD file, named freedm.wad")
    size = path.stat().st_size
    require(1_000_000 <= size <= 80_000_000, "unexpected FreeDM WAD byte size")
    with path.open("rb") as file:
        require(file.read(4) == b"IWAD", "FreeDM WAD must contain IWAD header")
    raw_digest = hashlib.sha256()
    with path.open("rb") as file:
        for piece in iter(lambda: file.read(1024 * 1024), b""):
            raw_digest.update(piece)
    return {"name": path.name, "byteLength": size,
            "sha256": raw_digest.hexdigest(),
            "identity": "user-supplied; version not inferred without separate release signature"}


def write_record(folder: Path, filename: str, payload: dict):
    output = folder / filename
    require(not output.exists(), "refusing to overwrite evidence")
    with output.open("xb") as file:
        file.write(json.dumps(payload, sort_keys=True, indent=2,
                              ensure_ascii=True, allow_nan=False).encode("utf-8") + b"\n")


def seal(folder: Path):
    files = sorted(path for path in folder.rglob("*") if path.is_file())
    names = [str(path.relative_to(folder)).replace(os.sep, "/") for path in files]
    require("SHA256SUMS" not in names and len(files) < 160,
            "unsafe/unbounded artifact seal")
    entries = []
    for path, name in zip(files, names):
        require(path.is_file() and not path.is_symlink() and
                ".." not in Path(name).parts and "\n" not in name,
                "unsafe artifact member")
        entries.append(f"{sha256(path.read_bytes())}  {name}\n")
    with (folder / "SHA256SUMS").open("x", encoding="ascii") as manifest:
        manifest.writelines(entries)


def spawn_players(ctx, wad: str, port: int):
    sessions = []
    try:
        for i in range(4):
            parent, child = ctx.Pipe(duplex=True)
            process = ctx.Process(target=worker, args=(i, child, wad, port),
                                  name="FreeDM-" + ROLES[i][0])
            process.start()
            child.close()
            sessions.append((parent, process))
            time.sleep(0.2)
        infos = [receive(pipe, INIT_TIMEOUT_S, "ready")
                 for pipe, _ in sessions]
        numbers = [info["playerNumber"] for info in infos]
        require(len(set(numbers)) == 4 and
                all(info["playerCount"] == 4 for info in infos),
                "all four real deathmatch players must join before any API call")
        return sessions, infos
    except BaseException:
        stop_players(sessions)
        raise


def stop_players(sessions):
    for pipe, proc in sessions:
        if proc.is_alive():
            try:
                pipe.send({"op": "stop"})
            except (OSError, EOFError, BrokenPipeError):
                pass
    final = []
    for pipe, proc in sessions:
        if proc.is_alive():
            try:
                final.append(receive(pipe, 5, "final"))
            except (OSError, EOFError, ValueError, TimeoutError):
                pass
        proc.join(5)
        if proc.is_alive():
            proc.terminate()
            proc.join(3)
        if proc.is_alive():
            proc.kill()
            proc.join(2)
        pipe.close()
    return final


def check_checkout(expected_sha: str, dry: bool):
    require(re.fullmatch(r"[0-9a-f]{40}", expected_sha) is not None,
            "source commit must be exact 40-character SHA")
    # On both smoke and paid modes validate the exact reviewed source.
    import subprocess
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=SOURCE_ROOT,
                                       text=True, timeout=10).strip()
    require(git("rev-parse", "HEAD") == expected_sha and
            git("branch", "--show-current") == "main" and
            not git("status", "--porcelain"),
            "must execute a clean, exact reviewed main checkout")
    require("github.com" in git("remote", "get-url", "origin") and
            "QSOLKCB/VANILLAJS" in git("remote", "get-url", "origin"),
            "unexpected Git source origin")


def play(args):
    require(20000 <= args.port <= 39999, "loopback game port out of bounds")
    require(1 <= args.decisions <= MAX_DECISIONS, "max 12 turns per player")
    require(args.authorized_usd == 20.0, "explicit US$20 authorization required")
    wad_info = valid_wad(args.wad)
    check_checkout(args.head, args.mode == "smoke")
    require(not args.out.exists() and SOURCE_ROOT not in args.out.resolve().parents,
            "evidence directory must be new and outside the repository")
    if args.mode == "paid":
        require(os.environ.get("FREEDM_TERRA_PAID_AUTH") == "YES",
                "paid match not owner-authorized")
        require(len(os.environ.get("OPENAI_API_KEY", "")) >= 10,
                "GitHub OPENAI_API_KEY secret missing")
    args.out.mkdir(mode=0o700, parents=True)
    (args.out / "frames").mkdir(mode=0o700)
    ledger = Budget()
    receipt = {"schemaVersion": 1,
        "kind": "qsol.vanillajs.freedm-terra.real-deathmatch.v1",
        "status": "ABORTED", "mode": args.mode, "model": MODEL,
        "game": {"engine": "ViZDoom", "multiplayer": "four actual network peers",
                 "synchronization": "ASYNC_PLAYER / real-time / latency-sensitive",
                 "map": MAP, "wad": wad_info},
        "sourceSha": args.head, "matchPort": args.port,
        "runId": os.environ.get("GITHUB_RUN_ID", "local"),
        "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT", "local"),
        "players": [], "turns": [], "final": [],
        "limits": ["Real-time wall-clock multiplayer, not deterministic frame replay.",
                   "Screen images only; no hidden world state, map or wall-clock oracle given to Terra.",
                   "Actual billed USD depends on provider; this is a 20 USD per-run conservative authorization, not an account-wide cap.",
                   "No guaranteed frags, skill level, equal latency or GPU acceleration."]}
    sessions = []
    started = time.monotonic()
    try:
        ctx = multiprocessing.get_context("spawn")
        sessions, receipt["players"] = spawn_players(ctx, str(args.wad), args.port)
        limit = 1 if args.mode == "smoke" else args.decisions
        last = {role: neutral_action() for role, _ in ROLES}
        for turn in range(limit):
            require(time.monotonic() - started < MAX_MATCH_SECONDS,
                    "match exceeded wall-clock timeout")
            for pipe, _ in sessions:
                pipe.send({"op": "observe"})
            observations = [receive(pipe, STEP_TIMEOUT_S, "observation")
                            for pipe, _ in sessions]
            for i, obs in enumerate(observations):
                require(obs["role"] == ROLES[i][0] and
                        obs["variables"]["PLAYER_COUNT"] == 4 and
                        sha256(obs["image"]) == obs["imageSHA256"],
                        "four-player image observation identity mismatch")
                name = f"frames/{ROLES[i][0].lower()}/{turn:02}.png"
                dest = args.out / name
                dest.parent.mkdir(mode=0o700, exist_ok=True)
                with dest.open("xb") as file:
                    file.write(obs["image"])
                obs["framePath"] = name
                del obs["image"]

            actions = []
            calls = []
            if args.mode == "smoke":
                actions = [neutral_action() for _ in ROLES]
            else:
                key = os.environ["OPENAI_API_KEY"]
                with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                    futures = []
                    for i, (role, tactic) in enumerate(ROLES):
                        ledger.reserve(role)  # nonrefundable before transmission
                        obs = observations[i]
                        with (args.out / obs["framePath"]).open("rb") as img:
                            png = img.read()
                        payload = agent_request_payload(
                            role, tactic, png, obs["variables"], last[role])
                        futures.append(pool.submit(call_terra, key, payload))
                    failures = []
                    for i, future in enumerate(futures):
                        role = ROLES[i][0]
                        try:
                            action, provider = future.result()
                            ledger.record_usage(role, provider["inputTokens"],
                                                provider["outputTokens"])
                            actions.append(action)
                            calls.append(provider)
                        except Exception as error:
                            failures.append({"role": role,
                                             "errorClass": type(error).__name__,
                                             "message": str(error)[:180]})
                    require(not failures,
                            "Terra call/usage failure; no retries: " +
                            json.dumps(failures))
            for i, (pipe, _) in enumerate(sessions):
                pipe.send({"op": "act", "buttons": buttons(actions[i])})
            results = [receive(pipe, STEP_TIMEOUT_S, "acted")
                       for pipe, _ in sessions]
            receipt["turns"].append({
                "round": turn, "observations": observations,
                "actions": [{"role": ROLES[i][0], "action": actions[i],
                             "vector": buttons(actions[i]),
                             "api": calls[i] if calls else None,
                             "result": results[i]} for i in range(4)]})
            for i, (role, _) in enumerate(ROLES):
                last[role] = actions[i]
            if all(result["ended"] for result in results):
                receipt["matchEndedEarly"] = True
                break
        receipt["status"] = "PASS" if len(receipt["turns"]) > 0 else "ABORTED"
    except Exception as error:
        receipt["error"] = {"class": type(error).__name__,
                            "message": str(error)[:600]}
        raise
    finally:
        receipt["budget"] = ledger.report()
        receipt["final"] = stop_players(sessions)
        receipt["elapsedWallSeconds"] = round(time.monotonic() - started, 3)
        write_record(args.out, "MATCH.json", receipt)
        seal(args.out)
        print("FreeDM/TERA: " + receipt["status"] +
              "; evidence: " + str(args.out) +
              "; rounds: " + str(len(receipt["turns"])), flush=True)
    return receipt


def main():
    parser = argparse.ArgumentParser(description="four real FreeDM Terra players")
    parser.add_argument("--mode", choices=("smoke", "paid"), required=True)
    parser.add_argument("--wad", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--port", type=int, default=25029)
    parser.add_argument("--decisions", type=int, default=12)
    parser.add_argument("--authorized-usd", type=float, default=20.0)
    args = parser.parse_args()
    result = play(args)
    if result["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, RuntimeError, TimeoutError,
            EOFError, KeyboardInterrupt) as error:
        print("FreeDM/TERRA FAIL: " + str(error), file=sys.stderr)
        raise SystemExit(1) from None
