#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Check ONLY the owner workstation's loopback Ollama HTTP service.

Uses the Python standard library. No remote URLs, proxy forwarding, daemon
management, model downloads, HTTP POST, keys or request retries. Intended as
a deterministic and inspectable preflight for the Qwen3-VL 2B owner workflow.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

URL = "http://127.0.0.1:11434/api/version"
MAX_BYTES = 4096


def ollama_version(*, opener=None, timeout=2.0) -> str:
    if not 0 < timeout <= 5:
        raise ValueError("bounded timeout required")
    request = urllib.request.Request(
        URL, method="GET", headers={"Accept": "application/json"})
    open_url = opener or urllib.request.build_opener(
        urllib.request.ProxyHandler({})).open
    try:
        with open_url(request, timeout=timeout) as response:
            if response.status != 200:
                raise ValueError("local Ollama returned non-200 status")
            data = response.read(MAX_BYTES + 1)
    except (urllib.error.URLError, OSError, TimeoutError) as error:
        # Avoid revealing proxy/environment data in the logs. The full
        # connection details are not used to bypass the pinned endpoint.
        raise ConnectionError(
            "Ollama is unreachable at 127.0.0.1:11434; "
            "check whether 'ollama serve' is running locally"
        ) from None
    if not 0 < len(data) <= MAX_BYTES:
        raise ValueError("Ollama local version response empty/oversized")
    payload = json.loads(data.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Ollama local version response must be an object")
    version = payload.get("version")
    if not isinstance(version, str) or not 1 <= len(version) <= 80:
        raise ValueError("Ollama local version unavailable")
    return version


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress connection diagnostics during startup polling")
    args = parser.parse_args(argv)
    try:
        version = ollama_version()
    except (ConnectionError, ValueError, UnicodeError, json.JSONDecodeError) as error:
        if not args.quiet:
            print("LOCAL OLLAMA NOT READY: " + str(error), file=sys.stderr)
        return 1
    if not args.quiet:
        print("LOCAL OLLAMA READY: " + version + " at 127.0.0.1:11434")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
