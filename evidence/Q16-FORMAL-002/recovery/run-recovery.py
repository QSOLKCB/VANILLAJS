#!/usr/bin/env python3
"""Append-only command capture for the separately identified recovery attempt."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys

out, cwd, name, *argv = sys.argv[1:]
out, cwd = Path(out), Path(cwd)
out.mkdir(parents=True, exist_ok=True)
paths = [out/(name+s) for s in ['.stdout','.stderr','.execution.json']]
assert all(not p.exists() for p in paths), 'refusing to overwrite an attempt'
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
with paths[0].open('xb') as stdout, paths[1].open('xb') as stderr:
    result = subprocess.run(argv, cwd=cwd, stdout=stdout, stderr=stderr,
        env={**os.environ, 'PYTHONDONTWRITEBYTECODE':'1', 'GIT_OPTIONAL_LOCKS':'0'})
with paths[2].open('x') as receipt:
    json.dump(dict(attempt_id=out.name, scope='post-power-loss recovery validation',
        command_argv=argv, working_directory=str(cwd), started_utc=start,
        finished_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        exit_status=result.returncode, stdout=paths[0].name, stderr=paths[1].name), receipt, indent=2)
    receipt.write('\n')
print(name, 'exit_status='+str(result.returncode))
print(paths[0].read_text()[-5000:])
if result.returncode: print(paths[1].read_text(), file=sys.stderr)
sys.exit(result.returncode)
