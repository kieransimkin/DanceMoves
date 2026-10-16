"""Original synthetic click track; first beat 0.125 s, 120 BPM, no model downloads."""
from pathlib import Path
import hashlib
import json
import math
import struct
import wave

root=Path(__file__).parent/'media'
root.mkdir(exist_ok=True)
audio=root/'master.wav'
samples=[]
for frame in range(48000*8):
    t=frame/48000
    elapsed=(t-.125) % .5
    value=.35*math.sin(2*math.pi*880*elapsed)*math.exp(-elapsed*120) if t>=.125 else 0
    samples.append(struct.pack('<h',round(value*32767)))
with wave.open(str(audio),'wb') as stream:
    stream.setnchannels(1);stream.setsampwidth(2);stream.setframerate(48000);stream.writeframes(b''.join(samples))
reading=dict(schema='stemlab.beat-alignment.v1',source_sha256=hashlib.sha256(audio.read_bytes()).hexdigest(),
    source_audio_verified=True,source_audio=dict(sample_rate=48000,num_frames=48000*8),
    bpm=120,exact_bpm='120',bpm_basis='canonical',bpm_status='canonical',phase_status='synthetic',analysis_id='synthetic',
    evidence_sha256=hashlib.sha256(b'Original synthetic clicks at .125+n*.5 seconds').hexdigest(),
    report_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    first_beat_seconds=.125,first_beat_exact_seconds='1/8',offset_pips=-16,exact_offset_pips='-16',pips_per_beat=64,canonical_first_beat_pip=0)
(root/'alignment.json').write_text(json.dumps(reading,indent=2)+'\n',encoding='utf-8',newline='\n')
(root/'lyrics.lrc').write_text('[00:00.125]Synthetic first beat\n[00:02.125]Source timestamp preserved\n',encoding='utf-8',newline='\n')
(root/'cues.cue').write_text('[00:00.125][SECTION: First synthetic beat]\n[00:02.125][SECTION: Later source timestamp]\n',encoding='utf-8',newline='\n')
