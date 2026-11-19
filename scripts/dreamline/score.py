#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Compile a bounded single-voice-per-part MusicXML score into an instrumental edit."""
import argparse
import hashlib
import json
import struct
import sys
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path

PPQ = 480
RATE = 48000
STEPS = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
KINDS = {'major': (0, 4, 7), 'minor': (0, 3, 7)}
DTD = b'<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">'
digest = lambda data: hashlib.sha256(data).hexdigest()


def bounded(value, low, high):
    number = int(value)
    if not low <= number <= high:
        raise ValueError('score number outside supported range')
    return number


def compile_score(data):
    if len(data) > 1_000_000 or b'<!' in data.replace(DTD, b'', 1) or b'\x00' in data:
        raise ValueError('unsupported XML declarations or size')
    root = ET.fromstring(data)
    parts = root.findall('part')
    if root.tag != 'score-partwise' or not 1 <= len(parts) <= 4:
        raise ValueError('expected 1..4 partwise parts')
    forbidden = {'backup', 'forward', 'chord', 'grace', 'repeat', 'ending', 'transpose',
                 'offset', 'unpitched', 'cue', 'measure-repeat', 'multiple-rest', 'octave-shift'}
    if any(el.tag in forbidden for el in root.iter()):
        raise ValueError('unsupported navigation, pitch or polyphony')
    events, signatures, tempi, lengths, bars = [], {}, {}, [], []
    for pi, part in enumerate(parts):
        tick, held, division, voice = 0, {}, None, None
        measures = part.findall('measure')
        if not 1 <= len(measures) <= 512:
            raise ValueError('unsupported measure count')
        for mi, measure in enumerate(measures):
            start = tick
            if pi == 0:
                bars.append(start)
            for el in measure:
                if el.tag == 'attributes':
                    if el.find('divisions') is not None:
                        division = bounded(el.findtext('divisions'), 1, 3840)
                    if el.find('time') is not None:
                        meter = [bounded(el.findtext('time/beats'), 1, 16),
                                 bounded(el.findtext('time/beat-type'), 1, 16)]
                        if signatures.setdefault(tick, meter) != meter:
                            raise ValueError('conflicting meter')
                elif el.tag == 'direction':
                    for sound in el.findall('sound'):
                        if set(sound.attrib) != {'tempo'}:
                            raise ValueError('unsupported direction')
                        bpm = bounded(sound.get('tempo'), 30, 300)
                        if tempi.setdefault(tick, bpm) != bpm:
                            raise ValueError('conflicting tempo')
                elif el.tag == 'harmony':
                    key = 36 + STEPS[el.findtext('root/root-step')] + int(el.findtext('root/root-alter', '0'))
                    # New authored voicing. Clip at next harmony or end of measure below.
                    events.append([tick, tick, 1, key, KINDS[el.findtext('kind')]])
                elif el.tag == 'note':
                    length = Fraction(bounded(el.findtext('duration'), 1, 65536) * PPQ, division)
                    if length.denominator != 1 or tick + length > 512 * 16 * PPQ:
                        raise ValueError('unsupported time grid')
                    end = tick + int(length)
                    v = el.findtext('voice', '1')
                    if voice is not None and v != voice:
                        raise ValueError('multiple voices')
                    voice = v
                    if el.find('pitch') is not None:
                        key = ((int(el.findtext('pitch/octave')) + 1) * 12 +
                               STEPS[el.findtext('pitch/step')] + int(el.findtext('pitch/alter', '0')))
                        bounded(key, 0, 127)
                        ties = {t.get('type') for t in el.findall('tie')}
                        if ties - {'start', 'stop'}:
                            raise ValueError('unsupported tie')
                        if 'stop' in ties:
                            row = held.pop(key)
                            if row[1] != tick:
                                raise ValueError('discontinuous tie')
                            row[1] = end
                        else:
                            row = [tick, end, 0, key]
                            events.append(row)
                        if 'start' in ties:
                            if key in held:
                                raise ValueError('overlapping ties')
                            held[key] = row
                    elif el.find('rest') is None:
                        raise ValueError('unknown note')
                    tick = end
            if tick <= start:
                raise ValueError('empty measure')
        if held:
            raise ValueError('unclosed tie')
        lengths.append(tick)
    if len(set(lengths)) != 1 or 0 not in tempi or 0 not in signatures:
        raise ValueError('missing conductor or unequal part duration')
    end = lengths[0]
    changes = {}
    for row in events:
        if row[2] == 1 and changes.setdefault(row[0], row) != row:
            raise ValueError('conflicting simultaneous harmony')
    harmony = [changes[t] for t in sorted(changes)]
    notes = [r for r in events if r[2] == 0]
    for i, (tick, _, _, key, chord) in enumerate(harmony):
        stop = harmony[i+1][0] if i+1 < len(harmony) else end
        notes.append([tick, stop, 1, key])
        for j, t in enumerate(range(tick, stop, PPQ//2)):
            notes.append([t, min(t+PPQ//3, stop), 2, key+24+chord[j%3]])
    for start, stop in zip(bars, bars[1:]+[end]):
        for j, t in enumerate(range(start, stop, PPQ//2)):
            notes.append([t, min(t+90, stop), 3, (36, 42, 38, 42)[j%4]])
    if len(notes) > 32000:
        raise ValueError('event budget')
    return sorted(notes), end, sorted(tempi.items()), sorted(signatures.items()), bars


def vlq(n):
    out = [n & 127]
    while n >= 128:
        n >>= 7
        out.insert(0, 128 | (n & 127))
    return bytes(out)


def midi(notes, end, tempi, meters):
    rows = [(t, 0, b'\xff\x51\x03' + round(60000000 / bpm).to_bytes(3, 'big')) for t, bpm in tempi]
    for t, (beats, unit) in meters:
        if unit & (unit-1):
            raise ValueError('invalid meter denominator')
        rows.append((t, 0, bytes([255, 88, 4, beats, unit.bit_length()-1, 24, 8])))
    for a,b,ch,k in notes:
        channel = [0,1,2,9][ch]
        rows.extend([(a,2,bytes([144+channel,k,88])),(b,1,bytes([128+channel,k,0]))])
    track, pos = bytearray(), 0
    for t,_,msg in sorted(rows):
        track.extend(vlq(t-pos)+msg)
        pos=t
    track.extend(vlq(end-pos)+b'\xff\x2f\x00')
    return b'MThd'+struct.pack('>IHHH',6,0,1,PPQ)+b'MTrk'+struct.pack('>I',len(track))+track


def build(source, out):
    with source.open('rb') as f:
        data = f.read(1_000_001)
    notes,end,tempi,meters,bars = compile_score(data)
    def sample(t):
        seconds = sum(Fraction((min(t,limit)-start)*60, bpm*PPQ)
                      for (start,bpm),limit in zip(tempi,[v[0] for v in tempi[1:]]+[end])
                      if start<t)
        return round(seconds*RATE)
    if sample(end)>RATE*600:
        raise ValueError('full arrangement exceeds ten minutes')
    # Preserve the opening and resolve with the final four real measures.
    tail = bars[max(0,len(bars)-4)]
    lead = max(t for t in bars if sample(t)+sample(end)-sample(tail)<=89*RATE) if sample(end)>90*RATE else end
    spans = [(0,end)] if lead==end else [(0,min(lead,tail)),(tail,end)]
    def arrange(sections,frames):
        rows,offset=[],0
        for lo,hi in sections:
            for a,b,ch,k in notes:
                if a<hi and b>lo:
                    rows.append([offset+sample(max(a,lo))-sample(lo),offset+sample(min(b,hi))-sample(lo),ch,k])
            offset+=sample(hi)-sample(lo)
        return {'format':'dreamline.score.v1','source':digest(data),'frames':frames,'notes':sorted(rows)}
    outputs={'full.mid':midi(notes,end,tempi,meters)}
    for name,obj in [('full',arrange([(0,end)],sample(end))),('edit',arrange(spans,4320000))]:
        outputs[name+'.json']=(json.dumps(obj,separators=(',',':'))+'\n').encode()
    report={'sourceSHA256':digest(data),'python':sys.version.split()[0],'ppq':PPQ,'tempo':tempi,'meter':meters,
            'measureStarts':bars,'sectionsTicks':spans,'sectionsSourceSamples':[[sample(a),sample(b)] for a,b in spans],
            'hashes':{k:digest(v) for k,v in outputs.items()}}
    out.mkdir(exist_ok=False,parents=True)
    for name,contents in outputs.items():
        (out/name).write_bytes(contents)
    (out/'receipt.json').write_text(json.dumps(report,indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    build(args.source,args.output)
