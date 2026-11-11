#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent standard-library finite enumeration + Decimal numerical reference.
No JavaScript import or invocation; inverse found by bijection, not elimination.
"""
import argparse
import hashlib
import itertools
import json
from decimal import Decimal as D, localcontext
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'tests/fixtures/qgame-math-001.json'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def action(a, x):
    return [sum(v * w for v, w in zip(row, x)) % 3 for row in a]


def finite_reference():
    states = list(itertools.product(range(3), repeat=2))
    matrices = [[list(v[:2]), list(v[2:])] for v in itertools.product(range(3), repeat=4)]
    inverse, images, affine = [], [], []
    for a in matrices:
        output = [action(a, x) for x in states]
        images.append(output)
        if len(set(map(tuple, output))) != 9:
            inverse.append(None)
            continue
        columns = [states[output.index(e)] for e in [[1, 0], [0, 1]]]
        inverse.append([list(row) for row in zip(*columns)])
        for b in states:
            affine.extend([[(v + w) % 3 for v, w in zip(action(a, x), b)] for x in states])
    products = []
    for a in matrices:
        for b in matrices:
            columns = [action(a, col) for col in zip(*b)]
            products.append([list(row) for row in zip(*columns)])
    return {'matrixCount': 81, 'invertibleCount': sum(x is not None for x in inverse),
            'affineStateCount': len(affine), 'matrixImages': images, 'inverses': inverse,
            'affineSHA256': digest(affine), 'productsSHA256': digest(products)}


def event_reference():
    state = [0, 0]
    log = []
    operations = ['pulse-0', 'pulse-1', 'shear', 'swap'] * 8
    for tick, op in enumerate(operations, 1):
        before = state[:]
        if op.startswith('pulse'):
            i = int(op[-1])
            state[i] = (state[i] + 1) % 3
        elif op == 'shear':
            state[0] = (state[0] + state[1]) % 3
        else:
            state.reverse()
        note = sum(state) % 3
        identity = f'{tick}:{op}:{"".join(map(str, before))}>{"".join(map(str, state))}'
        log.append(dict(kind='qsol.symbolic-event.v1', id=identity, tick=tick, order=0,
                        before=before, after=state[:], operation=op, note=note,
                        frequency=[165, 220, 330][note], durationTicks=1,
                        wave='triangle', gain=3500, visual=note))
    return log


def pcm_reference(events):
    # Independently evaluated integer triangle/envelope specification of audio2d.
    pcm = bytearray()
    for event in events:
        for sample in range(12000):
            phase = sample * event['frequency'] % 48000
            if phase < 12000:
                wave = 32767 * phase // 12000
            elif phase < 36000:
                wave = 32767 - 65534 * (phase - 12000) // 24000
            else:
                wave = -32767 + 32767 * (phase - 36000) // 12000
            gain = event['gain'] * (12000 - sample) // 12000
            value = (abs(wave) * gain // 32767) * (-1 if wave < 0 else 1)
            pcm.extend(value.to_bytes(2, 'little', signed=True))
    return hashlib.sha256(pcm).hexdigest()


def numerical_reference(events, preset):
    with localcontext() as context:
        context.prec = 60
        g, base, dt = D('6.67430e-11'), D('1e11' if preset == 'gentle' else '5e11'), D(1) / 32
        bodies = []
        for radius, direction in [(4, (1, 0)), (6, (0, 1))]:
            speed = (g * base / radius).sqrt()
            bodies.append(([D(radius * direction[0]), D(radius * direction[1]), D(0)],
                           [-speed * direction[1], speed * direction[0], D(0)]))

        def acceleration(position, mu):
            r = sum(x*x for x in position).sqrt()
            return [-mu*x/(r*r*r) for x in position]

        history = []
        for event in events:
            row = []
            for i, (position, velocity) in enumerate(bodies):
                mu = g * base * (1 + event['after'][i])
                for _ in range(8):
                    old = acceleration(position, mu)
                    position = [p + v*dt + a*dt*dt/2 for p, v, a in zip(position, velocity, old)]
                    new = acceleration(position, mu)
                    velocity = [v + (a+b)*dt/2 for v, a, b in zip(velocity, old, new)]
                bodies[i] = (position, velocity)
                energy = sum(v*v for v in velocity)/2 - mu/sum(p*p for p in position).sqrt()
                row.append(dict(position=list(map(float, position)), velocity=list(map(float, velocity)), energy=float(energy)))
            history.append(row)
        return history


def reference():
    events = event_reference()
    return {'kind': 'qsol.qgame-reference.v1', 'finite': finite_reference(), 'events': events,
            'pcmSHA256': pcm_reference(events), 'pcmFrames': 384000,
            'spatial': {preset: numerical_reference(events, preset) for preset in ['gentle', 'swift']},
            'tolerance': {'absolute': 5e-10, 'relative': 5e-11},
            'claim': 'Finite enumeration and 60-digit Decimal reference; not a proof of JavaScript or physical quantum behaviour'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    result = reference()
    if args.write:
        FIXTURE.write_text(json.dumps(result, indent=2) + '\n')
    if args.check:
        assert json.loads(FIXTURE.read_text()) == result, 'reference fixture differs'
        print('PASS: 81 matrices, 48 invertible, 3888 affine states, 6561 products, 32 events, 384000 PCM frames, two Decimal trajectories')
    if not (args.write or args.check):
        print(json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    main()
