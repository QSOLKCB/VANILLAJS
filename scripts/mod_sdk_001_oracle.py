#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent stdlib reference for dependency ordering; no JS imports."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/"tests/fixtures/mod-sdk-001-graph.json").read_text())
assert data["schema"]=="qsol.mod-sdk-001.graph-v1"
mods={p["id"]:p for p in data["packs"]}
order=[]
visiting=set()
seen=set()

def visit(name):
    if name in visiting:
        raise ValueError("cycle")
    if name in seen:
        return
    pack=mods.get(name)
    if pack is None:
        raise ValueError("missing dependency")
    visiting.add(name)
    for dep in pack["requires"]:
        target=mods.get(dep["id"])
        if target is None or target["version"]!=dep["version"]:
            raise ValueError("missing or incompatible dependency")
        visit(dep["id"])
    visiting.remove(name)
    seen.add(name)
    order.append(name)

visit(data["activate"])
print(json.dumps({"schema":"qsol.mod-sdk-001.oracle.v1","activation":order},
                 separators=(",",":")))
