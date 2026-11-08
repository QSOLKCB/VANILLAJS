#!/usr/bin/env python3
"""Append-only command capture. Run from the frozen source root; logs stay outside it."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys

def capture(evidence, name, command):
    evidence = Path(evidence).resolve()
    stdout = evidence / name
    stderr = evidence / (name + '.stderr')
    receipt = evidence / (name + '.execution.json')
    if any(p.exists() for p in (stdout, stderr, receipt)):
        raise SystemExit('Refusing to overwrite an execution attempt: ' + name)
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    env = dict(os.environ, Q16_EVIDENCE=str(evidence), PYTHONDONTWRITEBYTECODE='1')
    # The command may use tee to its named stdout file. Otherwise capture directly.
    with stderr.open('xb') as err:
        if '| tee ' in command:
            result = subprocess.run(['bash', '-c', 'set -euo pipefail\n' + command],
                                    env=env, stdout=subprocess.PIPE, stderr=err)
            sys.stdout.buffer.write(result.stdout)
            if not stdout.exists():
                stdout.write_bytes(result.stdout)
            assert stdout.read_bytes() == result.stdout
        else:
            with stdout.open('xb') as out:
                result = subprocess.run(['bash', '-c', 'set -euo pipefail\n' + command],
                                        env=env, stdout=out, stderr=err)
            sys.stdout.buffer.write(stdout.read_bytes())
    receipt.write_text(json.dumps({
        'run_id': 'Q16-FORMAL-002-local-20261108T090744Z',
        'command': command, 'shell': 'bash -c; set -euo pipefail',
        'working_directory': 'frozen-source-root',
        'environment_overrides': {'PYTHONDONTWRITEBYTECODE': '1',
                                  'Q16_EVIDENCE': '<new-evidence-directory>'},
        'started_utc': start,
        'finished_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'exit_status': result.returncode,
        'status': 'PASS' if result.returncode == 0 else 'FAIL',
        'stdout': name, 'stderr': stderr.name
    }, indent=2) + '\n')
    sys.stdout.flush()
    if result.returncode:
        sys.stderr.buffer.write(stderr.read_bytes())
    return result.returncode

if __name__ == '__main__':
    sys.exit(capture(*sys.argv[1:]))
