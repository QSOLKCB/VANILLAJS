# SPDX-License-Identifier: Apache-2.0
import unittest
from score import compile_score, midi

XML = b'''<score-partwise><part id="fixture"><measure><attributes><divisions>2</divisions>
<time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<direction><sound tempo="120"/></direction><note><pitch><step>D</step><octave>4</octave></pitch>
<duration>2</duration><tie type="start"/></note><note><pitch><step>D</step><octave>4</octave></pitch>
<duration>2</duration><tie type="stop"/></note><note><rest/><duration>4</duration></note>
</measure></part></score-partwise>'''

class ScoreTests(unittest.TestCase):
    def test_tie_tempo_and_smf(self):
        notes,end,tempo,meter,_=compile_score(XML)
        self.assertEqual([r for r in notes if r[2]==0],[[0,960,0,62]])
        self.assertEqual((end,tempo,meter),(1920,[(0,120)],[(0,[4,4])]))
        smf=midi(notes,end,tempo,meter)
        self.assertEqual(smf[:4],b'MThd')
        self.assertEqual(int.from_bytes(smf[18:22],'big'),len(smf)-22)

    def test_rejections(self):
        for source in [b'<!ENTITY example "x">'+XML,XML.replace(b'<rest/>',b'<backup/>'),
                       XML.replace(b'tempo="120"',b'tempo="0"'),XML.replace(b'type="stop"',b'type="other"'),
                       XML.replace(b'<duration>4',b'<duration>-4'),b' '*1000001]:
            with self.subTest(size=len(source)), self.assertRaises(ValueError):
                compile_score(source)
