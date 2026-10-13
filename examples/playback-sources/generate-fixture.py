"""Generate an original synthetic master and exact full/excerpt video inputs; requires ffmpeg."""
from pathlib import Path
import subprocess, json, hashlib, argparse
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path(__file__).parent/'media');a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
def run(args):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y']+args,check=True)
run(['-f','lavfi','-i','sine=frequency=220:sample_rate=48000:duration=120','-c:a','pcm_s16le',str(a.output/'master.wav')])
for name,offset,duration in [('full',0,120),('clip',48,20)]:
 run(['-f','lavfi','-i','testsrc2=size=320x180:rate=24','-ss',str(offset),'-i',str(a.output/'master.wav'),'-t',str(duration),'-map','0:v','-map','1:a','-c:v','libx264','-preset','ultrafast','-crf','32','-c:a','aac','-b:a','96k','-movflags','+faststart',str(a.output/(name+'.mp4'))])
(a.output/'lyrics.lrc').write_text('[00:00.00]Synthetic introduction\n[00:48.00]Excerpt start\n[00:50.00]First excerpt cue\n[01:00.00]Second excerpt cue\n[01:08.00]\n',encoding='utf-8')
(a.output/'sections.cue').write_text('[00:00.00]INTRO\n[00:50.00]FIRST\n[01:00.00]SECOND\n',encoding='utf-8')
manifest={'provenance':'Original synthetic sine/testsrc2 fixture; no private music','master':'master.wav','players':[{'file':'full.mp4','offset':0,'duration':120},{'file':'clip.mp4','offset':48,'duration':20}],'sha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in a.output.iterdir() if f.is_file()}}
(a.output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');print(a.output)
