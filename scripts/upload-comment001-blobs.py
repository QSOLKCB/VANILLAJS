#!/usr/bin/env python3
"""Owner-run, exact-byte COMMENT-001 Git blob import. Python stdlib only.

Read one previously verified transfer ZIP, upload two base64 Git blob objects,
verify their Git SHA-1, and make a single fast-forward commit on the dedicated
evidence branch. No historical evidence or existing files are rewritten.
"""
import argparse
import base64
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

REPO = "QSOLKCB/VANILLAJS"
BRANCH = "evidence/comment001-commit-exact-pngs"
API = "https://api.github.com/repos/" + REPO
TRANSFER_SHA256 = "29c52bc6f6969bb9845f60e10afa3b9119a460dedba394cb18cc82a0665eef3f"
EXPECTED = {
    "evidence/COMMENT-001/2026-11-07_original-screenshot.png": (
        357343,
        "7b575405c975030c952d04c12441e2e9b85d0d55acc7dfa472fdcf3e95e06654",
        "d3cb1bbad91c316ec5e4e3607fff68d1b7c48320",
    ),
    "evidence/COMMENT-001/2026-11-07_x-post_excerpt.png": (
        17205,
        "0840808768ddab18fa6faca9df8e92acf67a27817d5a17b6c48845680aaa9d86",
        "0c970a6f7ed71092ed2b0c18cbcb05d2b4ef8b5c",
    ),
}
EXISTING = ("evidence/RTX5060TI-003/vanillajs-rtx5060ti-arcade-42329114286-1.zip",
            25481, "2b4377fa147fb951d9a918f94716518865e0696da328140e0ac323556f46b5da")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def prepare(path):
    raw = path.read_bytes()
    require(digest(raw) == TRANSFER_SHA256, "transfer ZIP SHA-256 mismatch")
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        require(len(names) == 3 and set(names) == set(EXPECTED) | {EXISTING[0]},
                "unexpected, missing or duplicate members")
        require(z.testzip() is None, "transfer ZIP CRC failure")
        for info in z.infolist():
            require(not info.is_dir() and
                    (info.external_attr >> 16 & 0o170000) != 0o120000,
                    "directories and symlinks are forbidden")
        old = z.read(EXISTING[0])
        require(len(old) == EXISTING[1] and digest(old) == EXISTING[2],
                "original RTX003 transfer member changed")
        result = {}
        for name, (size, sha256, sha1) in EXPECTED.items():
            content = z.read(name)
            require(len(content) == size and digest(content) == sha256
                    and git_blob(content) == sha1, "evidence bytes changed: " + name)
            require(content[:8] == b"\x89PNG\r\n\x1a\n", "invalid PNG: " + name)
            result[name] = content
    return result


def token():
    value = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not value:
        try:
            result = subprocess.run(["gh", "auth", "token"], check=True,
                                    capture_output=True, text=True, timeout=10)
            value = result.stdout.strip()
        except (FileNotFoundError, subprocess.CalledProcessError,
                subprocess.TimeoutExpired) as exc:
            raise ValueError("authenticate with gh or set GH_TOKEN/GITHUB_TOKEN") from exc
    require(value and "\n" not in value, "invalid GitHub auth token")
    return value


def api(method, endpoint, credential, payload=None):
    data = None if payload is None else json.dumps(payload, separators=(",", ":")).encode()
    req = urllib.request.Request(API + endpoint, method=method, data=data, headers={
        "Authorization": "Bearer " + credential,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "qsol-comment001-original-evidence-importer/1",
        **({"Content-Type": "application/json"} if data is not None else {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        # Never print Authorization or request bytes.
        raise ValueError(f"GitHub API {method} {endpoint} rejected: HTTP {exc.code}") from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("transfer_zip", type=pathlib.Path,
                        help="VANILLAJS_RTX003_COMMENT001_RAW_EVIDENCE_TRANSFER.zip")
    parser.add_argument("--dry-run", action="store_true",
                        help="verify exact source bytes without GitHub access")
    args = parser.parse_args()
    contents = prepare(args.transfer_zip)
    print("PASS: exact original and derivative PNG bytes, Git SHA-1, transfer manifest")
    if args.dry_run:
        return

    credential = token()
    ref = api("GET", "/git/ref/heads/" + BRANCH, credential)
    head = ref["object"]["sha"]
    require(re.fullmatch("[0-9a-f]{40}", head) is not None, "invalid branch HEAD")
    commit = api("GET", "/git/commits/" + head, credential)
    tree = commit["tree"]["sha"]
    listing = api("GET", "/git/trees/" + tree + "?recursive=1", credential)
    require(not listing.get("truncated"), "repository tree listing truncated")
    items = {item["path"]: item for item in listing["tree"]}
    with zipfile.ZipFile(args.transfer_zip) as z:
        stored_rtx = z.read(EXISTING[0])
    require(items.get(EXISTING[0], {}).get("sha") == git_blob(stored_rtx),
            "already committed RTX003 evidence changed")
    require(not any(path in items for path in contents),
            "one or both screenshots already exist; refusing overwrite")

    entries = []
    for path, raw in contents.items():
        blob = api("POST", "/git/blobs", credential, {
            "content": base64.b64encode(raw).decode("ascii"),
            "encoding": "base64",
        })
        require(blob.get("sha") == git_blob(raw),
                "Git blob identity mismatch: " + path)
        print("Verified Git blob:", path, blob["sha"])
        entries.append({"path": path, "mode": "100644",
                        "type": "blob", "sha": blob["sha"]})

    new_tree = api("POST", "/git/trees", credential, {
        "base_tree": tree, "tree": entries,
    })["sha"]
    new_commit = api("POST", "/git/commits", credential, {
        "message": "evidence(comment001): preserve both original and derived PNG Git blobs",
        "tree": new_tree, "parents": [head],
    })["sha"]
    # force:false is a server-side fast-forward guard. A concurrent branch
    # update prevents this old-parent commit from replacing the new tip.
    api("PATCH", "/git/refs/heads/" + BRANCH, credential, {
        "sha": new_commit, "force": False,
    })
    verified = api("GET", "/git/ref/heads/" + BRANCH, credential)
    require(verified["object"]["sha"] == new_commit,
            "post-update branch identity mismatch; inspect branch manually")
    print("PASS: two exact screenshot Git blobs committed to", BRANCH)
    print("Commit: https://github.com/" + REPO + "/commit/" + new_commit)


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError, ValueError, json.JSONDecodeError,
            zipfile.BadZipFile, urllib.error.URLError) as exc:
        print("FAIL: COMMENT-001 base64 import: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
