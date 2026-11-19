# SPDX-License-Identifier: Apache-2.0
"""Real, short five-act encode/decode and failure tests for the optional export tool."""
import hashlib
import json
import math
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import wave

import video


def digest(data):
    return hashlib.sha256(data).hexdigest()


def ffmpeg(*args, data=None):
    return subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-threads', '2',
                           *map(str, args)], input=data, capture_output=True, check=True).stdout


class VideoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.package = cls.root / 'real'
        video.export('--fixture', cls.package, True)
        cls.movie = cls.package / 'film.mp4'
        cls.refs = cls.package / 'frames.rgb'
        cls.probes = cls.package / 'seeks.rgb'
        source = cls.root / 'whole.wav'
        subprocess.run(['node', video.HERE/'pcm.mjs', '--fixture', source],
                       check=True, stdout=subprocess.DEVNULL)
        cls.wav = cls.root / 'reference.wav'
        # Independent clip schedule expressed in seconds. No use of samples()
        # or the generator's event extraction helper.
        with wave.open(str(source), 'rb') as whole, wave.open(str(cls.wav), 'wb') as reference:
            reference.setparams(whole.getparams())
            for second in (8, 22, 40, 61, 82):
                whole.setpos(second * 48000)
                reference.writeframesraw(whole.readframes(19200))

    def check_movie(self, movie, wav=None):
        return video.verify(movie, wav or self.wav, self.refs, self.probes, short=True)

    def test_independent_full_decode(self):
        raw = ffmpeg('-i', self.movie, '-map', '0:v:0', '-pix_fmt', 'rgb24',
                     '-fps_mode', 'passthrough', '-f', 'rawvideo', 'pipe:1')
        size = 320 * 180 * 3
        self.assertEqual(len(raw), 60 * size)
        for start in range(0, 60, 12):
            group = [digest(raw[i*size:(i+1)*size]) for i in range(start, start+12)]
            self.assertGreater(len(set(group)), 1, 'static act at '+str(start))
        # Probe real decoded pixels. The left instrument is a three-ring CRT
        # support indicator. Compute its expected angle/ring from integer time,
        # independently of the browser's support() and projector.
        for i in (36, 39, 43, 47):
            n = (11*30+i-36)*303//600
            radius = 19+8*(n%3)
            angle = math.tau*(n%101)/101
            cx, cy = 119/3, 260/3
            dx, dy = radius*math.cos(angle)/3, radius*math.sin(angle)/3
            def peak_green(x, y):
                return max(raw[i*size+3*((round(y)+j)*320+round(x)+k)+1]
                           for j in (-1, 0, 1) for k in (-1, 0, 1))
            self.assertGreater(peak_green(cx+dx, cy+dy), peak_green(cx-dx, cy-dy)+60)
        pcm = ffmpeg('-i', self.movie, '-map', '0:a:0', '-f', 's16le', 'pipe:1')
        self.assertGreaterEqual(len(pcm), 96000*4)
        self.assertLess(len(pcm), (96000+1024)*4)
        receipt = json.loads((self.package/'verification.json').read_text())
        self.assertEqual(receipt['outputSHA256'], digest(self.movie.read_bytes()))
        self.assertEqual(self.check_movie(self.movie)['decodedFrames'], 60)

    def test_missing_streams(self):
        for stream in ('v', 'a'):
            with self.subTest(stream=stream):
                out = self.root / (stream+'.mp4')
                ffmpeg('-i', self.movie, '-map', '0:'+stream+':0', '-c', 'copy', out)
                with self.assertRaises(ValueError):
                    self.check_movie(out)

    def test_truncated_and_corrupt(self):
        broken = self.root / 'corrupt.mp4'
        broken.write_bytes(self.movie.read_bytes()[:48])
        with self.assertRaises((subprocess.CalledProcessError, ValueError)):
            self.check_movie(broken)
        shortened = self.root / 'short-audio.mp4'
        ffmpeg('-i', self.movie, '-t', '0.45', '-i', self.movie, '-map', '0:v:0',
               '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', shortened)
        with self.assertRaises(ValueError):
            self.check_movie(shortened)

    def test_scene_and_motion_faults(self):
        raw = ffmpeg('-i', self.movie, '-map', '0:v', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1')
        size = 320*180*3
        def encode(name, pick):
            frames = bytearray()
            for i in range(60):
                source_frame = pick(i)
                if source_frame is None:
                    frames.extend(bytes(size))
                else:
                    frames.extend(raw[source_frame*size:(source_frame+1)*size])
            dest = self.root/(name+'.mp4')
            ffmpeg('-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', '320x180',
                   '-framerate', '30', '-i', 'pipe:0', '-i', self.movie, '-map', '0:v:0',
                   '-map', '1:a:0', '-c:a', 'copy', '-c:v', 'libx264', '-crf', '14',
                   '-pix_fmt', 'yuv420p', dest, data=frames)
            return dest
        faults = {'wrong-act': lambda i: (i+12)%60, 'blank': lambda i: None,
                  'frozen-acts': lambda i: i//12*12, 'tripled-poses': lambda i: i//3*3,
                  'phase-shift': lambda i: i//12*12+(i+6)%12}
        for name, pick in faults.items():
            with self.subTest(fault=name), self.assertRaises(ValueError):
                self.check_movie(encode(name, pick))

    def test_rejects_wrong_audio(self):
        # Invert the polarity of only one channel. The shape, duration and channel
        # count stay identical, so stream presence alone cannot detect this.
        out = self.root/'inverted.mp4'
        ffmpeg('-i', self.movie, '-af', 'pan=stereo|c0=-1*c0|c1=c1', '-c:a', 'aac',
               '-b:a', '192k', '-c:v', 'copy', out)
        with self.assertRaises(ValueError):
            self.check_movie(out)

    def test_invalid_inputs_existing_output_and_denied_resources(self):
        marker = self.package/'verification.json'
        saved = marker.read_bytes()
        with self.assertRaises(ValueError):
            video.export('--fixture', self.package, True)
        self.assertEqual(marker.read_bytes(), saved)
        with self.assertRaises(ValueError):
            video.export('--fixture', marker/'child', True)
        for name, value in [('missing', self.root/'missing-score'), ('link', self.root/'symlink-score')]:
            if name == 'link':
                value.symlink_to(marker)
            with self.subTest(name=name), self.assertRaises(ValueError):
                video.export(str(value), self.root/('bad-'+name), False)

    def test_encoder_failure_cleans_staging(self):
        out = self.root/'encoder-failure'
        with patch.object(video, 'FF', [sys.executable, '-c', 'raise SystemExit(73)']):
            with self.assertRaises((subprocess.CalledProcessError, ValueError, BrokenPipeError)):
                video.export('--fixture', out, True)
        self.assertFalse(out.exists())
        self.assertEqual(list(self.root.glob('.dreamline-*')), [])

    def test_cancel_running_export(self):
        out = self.root/'cancelled'
        with subprocess.Popen([sys.executable, video.HERE/'video.py', out, '--ci-fixture'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as child:
            try:
                deadline = time.monotonic()+45
                while time.monotonic()<deadline and child.poll() is None:
                    if any(self.root.glob('.dreamline-*/frames.rgb')):
                        break
                    time.sleep(.03)
                self.assertTrue(any(self.root.glob('.dreamline-*/frames.rgb')), 'render did not start')
                child.send_signal(signal.SIGTERM)
                self.assertNotEqual(child.wait(timeout=20), 0)
            finally:
                if child.poll() is None:
                    child.kill()
        self.assertFalse(out.exists())
        self.assertEqual(list(self.root.glob('.dreamline-*')), [])
