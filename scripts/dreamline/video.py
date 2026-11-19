#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Local native 1080p Dreamline render, full-stream decode and no-clobber publication."""
import argparse
import array
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import resource
import signal
import statistics
import subprocess as sp
import sys
import tempfile
import time
import wave

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CUTS = (240, 660, 1200, 1830, 2460)
THUMB_BYTES = 32 * 18 * 3
FF = ['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'error', '-xerror', '-protocol_whitelist', 'file,pipe']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def capture(args):
    return sp.check_output(args, cwd=ROOT).decode().strip()


def hashfile(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def samples(short):
    return [start+i for start in CUTS for i in range(12)] if short else range(2700)


def render_cmd(mode, source, refs):
    return ['node', str(HERE/'render.mjs'), mode, source, str(refs)]


def verify(movie, wav, refs, probes, short=False):
    candidate = Path(movie)
    require(candidate.is_file() and not candidate.is_symlink() and candidate.stat().st_size<=512*1024*1024,'invalid local movie')
    movie = candidate.resolve(strict=True)
    width, height = (320,180) if short else (1920,1080)
    frames = samples(short)
    seconds = len(frames)/30
    meta = json.loads(capture(['ffprobe','-v','error','-protocol_whitelist','file,pipe',
                               '-show_streams','-of','json',str(movie)]))['streams']
    require(len(meta)==2, 'expected two streams')
    video = next((s for s in meta if s['codec_type']=='video'),{})
    audio = next((s for s in meta if s['codec_type']=='audio'),{})
    for k,v in {'codec_name':'h264','width':width,'height':height,'pix_fmt':'yuv420p',
                'avg_frame_rate':'30/1','r_frame_rate':'30/1'}.items():
        require(video.get(k)==v,'wrong video '+k)
    for k,v in {'codec_name':'aac','sample_rate':'48000','channels':2}.items():
        require(audio.get(k)==v,'wrong audio '+k)
    for stream in (video,audio):
        require(float(stream['start_time'])==0 and abs(float(stream['duration'])-seconds)<1/48000,
                'incorrect stream start/duration')
    # Check presentation timestamps independently of the declared average rate.
    from fractions import Fraction
    ts=capture(['ffprobe','-v','error','-protocol_whitelist','file,pipe','-select_streams','v:0',
                '-show_entries','frame=best_effort_timestamp','-of','csv=p=0',str(movie)])
    ticks=[int(s.split(',')[0]) for s in ts.splitlines() if s.strip(', ')]
    base=Fraction(video['time_base'])
    require(len(ticks)==len(frames) and all(t*base==Fraction(i,30) for i,t in enumerate(ticks)),'frame timestamps')
    ref=Path(refs).read_bytes(); independent=Path(probes).read_bytes()
    require(len(ref)==len(frames)*THUMB_BYTES and len(independent)==15*THUMB_BYTES,'reference dimensions')
    decoded=sp.check_output(FF+['-threads','2','-i',str(movie),'-map','0:v:0','-vf','scale=32:18:flags=area',
                                '-fps_mode','passthrough','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
    require(len(decoded)==len(ref),'decoded frame count')
    probe_idx=0; errors=[]; previous=None; static_run=0
    for i,frame in enumerate(frames):
        start=i*THUMB_BYTES
        actual=decoded[start:start+THUMB_BYTES];expected=ref[start:start+THUMB_BYTES]
        error=sum(abs(a-b) for a,b in zip(actual,expected))/THUMB_BYTES
        require(error<=12,'wrong scene at frame %d: %.3f'%(frame,error))
        errors.append(error)
        if frame in {c+j for c in CUTS for j in (0,3,7)}:
            other=independent[probe_idx*THUMB_BYTES:(probe_idx+1)*THUMB_BYTES]
            require(other==expected and max(actual)-min(actual)>22,'blank or unreproducible act probe')
            probe_idx+=1
        static_run=static_run+1 if actual==previous else 0
        if 60<frame<2630:
            require(static_run<30,'frozen film at frame '+str(frame))
        previous=actual
    motion=Path(refs).with_name('motion.gray').read_bytes()
    scale=64*36
    observed=sp.check_output(FF+['-threads','2','-i',str(movie),'-map','0:v:0','-vf','scale=64:36:flags=area',
                                 '-fps_mode','passthrough','-pix_fmt','gray','-f','rawvideo','pipe:1'])
    require(len(motion)==len(observed)==len(frames)*scale,'motion reference dimensions')
    # Compare decoded temporal changes against pre-encoder thumbnails from the
    # same submitted JPEGs. A held source picture may still change a little on
    # decoding, particularly when B frames and quantisation differ.
    for i in range(1,len(frames)):
        if frames[i]!=frames[i-1]+1:continue
        a=(i-1)*scale;b=a+scale;c=b+scale
        reference=sum(abs(x-y) for x,y in zip(motion[a:b],motion[b:c]))
        if reference>scale*.45:
            movement=sum(abs(x-y) for x,y in zip(observed[a:b],observed[b:c]))
            require(movement>=reference*.22,'missing reference motion at frame '+str(frames[i]))
    # Static and translated footage can have the right temporal energy but the
    # wrong phase. Compare decoded pictures to the intended pre-encode picture
    # and nearby score positions. Permit minor codec quantisation differences
    # or near-identical neighbours; reject a substantially better alternate.
    for i,frame in enumerate(frames):
        start=i*scale
        picture=observed[start:start+scale]
        aligned=sum(abs(x-y) for x,y in zip(picture,motion[start:start+scale]))
        margin=max(scale*.5,aligned*.3)
        if aligned<=margin:
            continue
        for delta in (-6,-3,-1,1,3,6):
            j=i+delta
            if j<0 or j>=len(frames) or frames[j]-frame!=delta:
                continue
            pos=j*scale
            alternate=sum(abs(x-y) for x,y in zip(picture,motion[pos:pos+scale]))
            require(aligned-alternate<=margin,
                    'picture timing mismatch at frame %d (better source frame %d)'%(frame,frames[j]))
    # AAC priming is removed by the MP4 edit list. A decoder can retain at most
    # one partial AAC block after the declared sample count.
    pcm=sp.check_output(FF+['-i',str(movie),'-map','0:a:0','-f','s16le','pipe:1'])
    with wave.open(str(wav),'rb') as w:
        require((w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==
                (2,2,48000,len(frames)*1600),'reference PCM shape')
        original=w.readframes(w.getnframes())
    require(len(original)<=len(pcm)<len(original)+4096,'decoded PCM length')
    actual=array.array('h',pcm[:len(original)]);expected=array.array('h',original)
    if sys.byteorder=='big':
        actual.byteswap();expected.byteswap()
    sq=signal_energy=0
    for offset in range(0,len(expected),32000):
        refblock=expected[offset:offset+32000];block=actual[offset:offset+32000]
        noise=sum((a-b)**2 for a,b in zip(refblock,block))
        energy=sum(a*a for a in refblock)
        require(noise<=.12*energy+len(block)*80**2,'wrong audio or alignment at sample '+str(offset//2))
        sq+=noise;signal_energy+=energy
    require(signal_energy>0 and sq<signal_energy*.07,'audio identity')
    return {'decodedFrames':len(frames),'decodedStereoFrames':len(pcm)//4,'compositionFrames':len(original)//4,
            'nativeSize':[width,height],'independentSeekProbes':probe_idx,'maxThumbnailMAE':max(errors),
            'meanThumbnailMAE':statistics.mean(errors),'audioSNRdB':10*math.log10(signal_energy/max(1,sq))}


def regular_source(path):
    path=Path(path)
    require(path.is_file() and not path.is_symlink() and path.stat().st_size<=1_000_000,'invalid local score')
    return str(path.resolve())


def export(source, destination, short):
    destination=Path(destination).absolute()
    require(destination.parent.is_dir() and not destination.parent.is_symlink() and
            not os.path.lexists(destination),'new output directory required')
    require(not short or source=='--fixture','short verification requires the original fixture')
    if source not in ('--production','--fixture'):
        source=regular_source(source)
    started=time.monotonic()
    with tempfile.TemporaryDirectory(dir=destination.parent,prefix='.dreamline-') as scratch:
        tmp=Path(scratch)
        if source=='--production':
            # Fixed code and fixed local module URL, never user-supplied JS.
            code="import {productionScore} from './demos/dreamline/production.js';console.log(JSON.stringify(productionScore));"
            (tmp/'score.json').write_text(capture(['node','--input-type=module','-e',code])+'\n')
            source=str(tmp/'score.json')
        elif source!='--fixture':
            shutil.copyfile(source,tmp/'score.json');source=str(tmp/'score.json')
        wav=tmp/'edit.wav';film=tmp/'film.mp4';refs=tmp/'frames.rgb';probes=tmp/'seeks.rgb'
        receipt=json.loads(capture(['node',str(HERE/'pcm.mjs'),source,str(wav)]))
        if short:
            with wave.open(str(wav),'rb') as original, wave.open(str(tmp/'short.wav'),'wb') as clipped:
                clipped.setparams(original.getparams())
                for frame in samples(True):
                    original.setpos(frame*1600);clipped.writeframesraw(original.readframes(1600))
            wav=tmp/'short.wav'
        mode='fixture' if short else 'full'
        motion=tmp/'motion.gray'
        encode=FF+['-f','image2pipe','-framerate','30','-c:v','mjpeg','-threads','2','-i','pipe:0',
                   '-protocol_whitelist','file,pipe','-i',str(wav),'-map','0:v:0','-map','1:a:0',
                   '-vf','scale=in_range=full:out_range=tv,format=yuv420p','-color_range','tv',
                   '-c:v','libx264','-preset','veryfast','-threads','2','-crf','17','-pix_fmt','yuv420p',
                   '-c:a','aac','-b:a','192k','-movflags','+faststart','-n',str(film),
                   '-map','0:v:0','-vf','scale=64:36:flags=area','-pix_fmt','gray','-threads','1','-f','rawvideo',str(motion)]
        # A bounded host lifetime also bounds native Skia caches independently of JS GC.
        total=len(samples(short))
        with sp.Popen(encode,stdin=sp.PIPE) as encoder:
            try:
                with refs.open('xb') as combined:
                    for begin in range(0,total,120):
                        part=tmp/'chunk.rgb'
                        cmd=render_cmd(mode,source,part)+[str(begin),str(min(total,begin+120))]
                        sp.run(cmd,cwd=ROOT,stdout=encoder.stdin,check=True)
                        with part.open('rb') as stream:
                            shutil.copyfileobj(stream,combined)
                        part.unlink()
            finally:
                encoder.stdin.close()
                if encoder.poll() is None and sys.exc_info()[0]:encoder.terminate()
            require(encoder.wait()==0,'encoder failed')
        sp.run(render_cmd('fixture-probes' if short else 'probes',source,probes),cwd=ROOT,check=True)
        result=verify(film,wav,refs,probes,short)
        identity={'result':result,'profile':mode,'frameRule':'sample=1600*n; end exclusive; AAC edit list start=0',
                  'childCpuSeconds':round(resource.getrusage(resource.RUSAGE_CHILDREN).ru_utime+resource.getrusage(resource.RUSAGE_CHILDREN).ru_stime,3),
                  'canvasProfile':'native Skia Canvas2D and canonical HORIZON film raster, device scale 1',
                  'donorRevisions':{'HORIZON':'c11f42278ac9e1ca03abaad0eeb1a45d3ffc5c53',
                     'SONIFICATION':'2ca65c6540d7051a77ed571b83f5a9df453094ec',
                     'Audio-To-Video':'6cd8839764b4926de4bcc71463014886bcdf1aa2'},
                  'secondsElapsed':round(time.monotonic()-started,3),'score':receipt,
                  'scoreFileSHA256':hashfile(Path(source)) if source!='--fixture' else None,
                  'node':capture(['node','-v']),'python':sys.version,'ffmpeg':capture(['ffmpeg','-version']),
                  'ffprobe':capture(['ffprobe','-version']).splitlines()[0],
                  'skiaCanvas':capture(['node','-p',"require('@napi-rs/canvas/package.json').version"]),
                  'sourceCommit':capture(['git','rev-parse','HEAD']),
                  'donor':'6cd8839764b4926de4bcc71463014886bcdf1aa2',
                  'inputs':{str(p.relative_to(ROOT)):hashfile(p) for p in sorted([
                      *HERE.glob('*.py'),*HERE.glob('*.mjs'),*(ROOT/'demos/dreamline').glob('*.js')])},
                  'outputSHA256':hashfile(film),'frameReferenceSHA256':hashfile(refs),'seekProbeSHA256':hashfile(probes),'motionSHA256':hashfile(motion)}
        (tmp/'verification.json').write_text(json.dumps(identity,indent=2)+'\n')
        # Exclusive mkdir serializes publishers. Only remove entries linked by this call.
        destination.mkdir();linked=[]
        try:
            for name in ['film.mp4','verification.json','frames.rgb','seeks.rgb','motion.gray']:
                target=destination/name;os.link(tmp/name,target);linked.append(target)
        except BaseException:
            for target in reversed(linked):target.unlink()
            destination.rmdir()
            raise
        print(json.dumps(result),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination',type=Path)
    parser.add_argument('--score')
    parser.add_argument('--verify',metavar='REFERENCE_WAV',type=Path)
    parser.add_argument('--ci-fixture',action='store_true')
    args=parser.parse_args()
    def cancelled(signum,frame):
        raise KeyboardInterrupt('export cancelled')
    signal.signal(signal.SIGTERM,cancelled)
    if args.verify:
        manifest=json.loads((args.destination/'verification.json').read_text())
        for name,field in [('film.mp4','outputSHA256'),('frames.rgb','frameReferenceSHA256'),
                           ('seeks.rgb','seekProbeSHA256'),('motion.gray','motionSHA256')]:
            require(hashfile(args.destination/name)==manifest[field], 'receipt mismatch for '+name)
        require((manifest['profile']=='fixture')==args.ci_fixture,'wrong verification profile')
        result=verify(args.destination/'film.mp4',args.verify,args.destination/'frames.rgb',
                      args.destination/'seeks.rgb',args.ci_fixture)
        print(json.dumps(result))
    else:
        export(args.score or ('--fixture' if args.ci_fixture else '--production'),args.destination,args.ci_fixture)
