# SPDX-License-Identifier: Apache-2.0
"""FreeDM Terra game controls, conservative per-agent budgets and PNG receipts.

No game engine or API connection at import time. This is independently testable
standard-library code; ViZDoom is loaded ONLY by the owner-only runner.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import struct
import urllib.error
import urllib.request
import zlib

MODEL = "gpt-6.1-terra"
PLAYERS = 4
MAX_DECISIONS = 12
MAX_OUTPUT_TOKENS = 384
PER_AGENT_LIMIT_CENTS = 500
RESERVE_PER_CALL_CENTS = 40
# Long-context, noncached, Standard rates in USD per million tokens.
# Each API attempt reserves 40 cents BEFORE transmission, including failed
# calls. 12 x $0.40 = $4.80 per agent. This is a *per-dispatch reservation*;
# neither USD estimates nor this script control OpenAI account-wide billing.
CONSERVATIVE_INPUT_USD_PER_MTOK = 2.00
CONSERVATIVE_OUTPUT_USD_PER_MTOK = 10.00
ROLES = (
    ("TERRA-ALPHA", "Aggressive: seek combat, strafe frequently, keep firing when an enemy is visible."),
    ("TERRA-BRAVO", "Survivalist: favour cover, collect weapons and health, flank where possible."),
    ("TERRA-CHARLIE", "Precision: turn carefully, assess targets and avoid wasting ammunition."),
    ("TERRA-DELTA", "Explorer: vary routes, search for threats and actively contest the arena."),
)
MOVES = ("forward", "backward", "left", "right", "stop")
TURNS = ("left", "right", "none")
BUTTONS = (
    "MOVE_FORWARD", "MOVE_BACKWARD", "MOVE_LEFT", "MOVE_RIGHT",
    "TURN_LEFT", "TURN_RIGHT", "ATTACK", "USE", "SPEED",
)


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise ValueError(reason)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True, allow_nan=False) + "\n").encode("ascii")


def parse_action(raw: str) -> dict:
    require(type(raw) is str and len(raw) <= 2048, "unbounded Terra action")
    action = json.loads(raw)
    require(type(action) is dict and set(action) ==
            {"move", "turn", "fire", "use", "sprint", "tactic"},
            "Terra action must contain the six documented fields")
    require(action["move"] in MOVES and action["turn"] in TURNS,
            "invalid movement or turning command")
    for field in ("fire", "use", "sprint"):
        require(type(action[field]) is bool, "invalid boolean button: " + field)
    require(type(action["tactic"]) is str and
            len(action["tactic"]) <= 160, "invalid tactic field")
    return dict(action)


def buttons(action: dict) -> list[int]:
    move = action["move"]
    turn = action["turn"]
    return [
        int(move == "forward"), int(move == "backward"),
        int(move == "left"), int(move == "right"),
        int(turn == "left"), int(turn == "right"),
        int(action["fire"]), int(action["use"]), int(action["sprint"]),
    ]


def neutral_action() -> dict:
    return {"move": "stop", "turn": "none", "fire": False,
            "use": False, "sprint": False, "tactic": "neutral standby"}


class Budget:
    """An immutable-history budget ledger. Never refund a submitted request."""

    def __init__(self):
        self.roles = {role: {"attempts": 0, "reservedCents": 0,
                             "estimatedCents": 0.0, "usage": []}
                      for role, _ in ROLES}

    def reserve(self, role: str) -> int:
        require(role in self.roles, "unknown budget role")
        slot = self.roles[role]
        require(slot["attempts"] < MAX_DECISIONS and
                slot["reservedCents"] + RESERVE_PER_CALL_CENTS <= PER_AGENT_LIMIT_CENTS,
                "agent authorization budget exhausted: " + role)
        slot["attempts"] += 1
        slot["reservedCents"] += RESERVE_PER_CALL_CENTS
        # Reserved BEFORE request, including HTTP errors and missing responses.
        return slot["attempts"]

    def record_usage(self, role: str, input_tokens: int, output_tokens: int):
        require(role in self.roles, "unknown budget role")
        require(type(input_tokens) is int and input_tokens >= 0 and
                type(output_tokens) is int and 0 <= output_tokens <= MAX_OUTPUT_TOKENS,
                "missing/invalid provider usage")
        cost_cents = (input_tokens * CONSERVATIVE_INPUT_USD_PER_MTOK +
                      output_tokens * CONSERVATIVE_OUTPUT_USD_PER_MTOK) / 10000
        slot = self.roles[role]
        slot["estimatedCents"] += cost_cents
        slot["usage"].append({"inputTokens": input_tokens,
                              "outputTokens": output_tokens,
                              "longTierEstimateCents": round(cost_cents, 5)})
        require(cost_cents <= RESERVE_PER_CALL_CENTS and
                slot["estimatedCents"] <= PER_AGENT_LIMIT_CENTS,
                "observed provider usage exceeds pre-authorized per-agent reservation")

    def report(self) -> dict:
        return {
            "perAgentAuthorizedUSD": 5.0,
            "totalAuthorizedUSD": 20.0,
            "accountWideLimit": False,
            "priceBasis": "Conservative GPT-6.1 Terra long-context, noncached Standard USD rates; estimates, not invoice",
            "noRetries": True,
            "roles": {k: {
                "attempts": v["attempts"],
                "reservedUSD": v["reservedCents"] / 100,
                "estimatedLongTierUSD": round(v["estimatedCents"] / 100, 6),
                "usage": [dict(u) for u in v["usage"]],
            } for k, v in self.roles.items()},
        }


def png_rgb24(frame) -> bytes:
    """Lossless PNG of ViZDoom RGB24 (height,width,3) without Pillow.

    Accepts NumPy's contiguous screen_buffer, but does not import NumPy.
    Screen data is explicitly 320x240; no whole-desktop capture.
    """
    shape = getattr(frame, "shape", None)
    require(tuple(shape or ()) == (240, 320, 3),
            "expected ViZDoom RGB24 320x240 screen buffer")
    image = frame.tobytes(order="C")
    require(len(image) == 240 * 320 * 3, "invalid RGB screenshot byte length")
    scanlines = b"".join(b"\0" + image[i:i + 960]
                         for i in range(0, len(image), 960))

    def chunk(name, content):
        return (struct.pack(">I", len(content)) + name + content +
                struct.pack(">I", zlib.crc32(name + content) & 0xffffffff))

    return (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", 320, 240, 8, 2, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(scanlines, 6)) +
            chunk(b"IEND", b""))


def agent_request_payload(role: str, tactics: str, png: bytes, public_state: dict,
                          last: dict | None) -> dict:
    require(role in dict(ROLES) and type(png) is bytes and
            png.startswith(b"\x89PNG\r\n\x1a\n") and
            len(png) <= 512 * 1024, "invalid bounded observation")
    data = base64.b64encode(png).decode("ascii")
    prompt = (
        "You are " + role + " controlling ONE actual player in a 4-player "
        "FreeDM Doom-engine deathmatch. " + tactics + "\n"
        "This is a screenshot from your in-game first-person camera. "
        "You have no hidden positions, depth buffer, map oracle or external tools. "
        "Return ONE legal JSON object with exactly these keys: "
        '{"move":"forward|backward|left|right|stop",'
        '"turn":"left|right|none","fire":boolean,"use":boolean,'
        '"sprint":boolean,"tactic":"brief visible reason under 160 chars"}. '
        "Actions will run for a short fixed interval; no numeric coordinates "
        "or textual command execution. Avoid standing still unless necessary. "
        "Public in-game status: " +
        json.dumps(public_state, sort_keys=True, separators=(",", ":")) +
        "\nPrevious action: " + json.dumps(last or neutral_action(),
                                       sort_keys=True, separators=(",", ":"))
    )
    require(len(prompt) < 3600, "unbounded public input")
    return {
        "model": MODEL,
        "store": False,
        "reasoning": {"effort": "low"},
        "max_output_tokens": MAX_OUTPUT_TOKENS,
        "input": [{"role": "user", "content": [
            {"type": "input_text", "text": prompt},
            {"type": "input_image", "image_url": "data:image/png;base64," + data,
             "detail": "low"},
        ]}],
    }


def call_terra(secret: str, payload: dict, opener=None) -> tuple[dict, dict]:
    """Exactly ONE Responses API request; HTTP failure never triggers a retry."""
    require(type(secret) is str and len(secret) >= 10, "missing API credential")
    require(payload.get("model") == MODEL and payload.get("store") is False,
            "wrong provider/model/privacy mode")
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
    require(len(body) <= 760 * 1024, "oversized API request")
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses", data=body, method="POST",
        headers={"Authorization": "Bearer " + secret,
                 "Content-Type": "application/json"})
    do_open = opener or urllib.request.urlopen
    try:
        with do_open(request, timeout=75) as resp:
            raw = resp.read(96 * 1024 + 1)
    except urllib.error.HTTPError as error:
        raise RuntimeError("OpenAI API HTTP " + str(error.code)) from None
    except (TimeoutError, urllib.error.URLError):
        raise RuntimeError("OpenAI API transport failed (no retry)") from None
    require(len(raw) <= 96 * 1024, "oversized API response")
    result = json.loads(raw.decode("utf-8"))
    require(result.get("status") == "completed" and
            str(result.get("model", "")).startswith(MODEL),
            "incomplete or wrong Terra model response")
    usage = result.get("usage", {})
    ins, outs = usage.get("input_tokens"), usage.get("output_tokens")
    require(type(ins) is int and type(outs) is int,
            "provider omitted mandatory usage")
    pieces = []
    for message in result.get("output", []):
        if message.get("type") == "message":
            for c in message.get("content", []):
                if c.get("type") == "output_text" and type(c.get("text")) is str:
                    pieces.append(c["text"])
    require(len(pieces) == 1, "Terra must return one JSON action")
    return parse_action(pieces[0]), {
        "inputTokens": ins, "outputTokens": outs,
        "responseId": result.get("id"), "model": result.get("model"),
        "rawActionTextSHA256": sha256(pieces[0].encode("utf-8")),
    }
