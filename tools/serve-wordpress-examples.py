#!/usr/bin/env python3
"""Loopback-only WordPress-style DanceMoves examples. No real WordPress, database or remote writes."""
from __future__ import annotations
import argparse
import copy
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
from pathlib import Path
import secrets
import threading
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/examples/wordpress/'
BODY_LIMIT = 262144
REST_KEYS = frozenset(['_dance_moves_bpm','_dance_moves_lyric_timing_id','_dance_moves_cue_timing_id','_dance_moves_lyric_popups_enabled','_dance_moves_effect'])

def finite_number(value) -> bool:
    if type(value) not in (int,float): return False
    try: return math.isfinite(value)
    except OverflowError: return False

def validate_meta(update: dict, current: dict) -> dict:
    if not isinstance(update, dict) or not set(update) <= REST_KEYS:
        raise ValueError('Only the five REST-visible metadata keys may be changed here; master duration is advanced setup')
    next_meta = copy.deepcopy(current)
    for key, value in update.items():
        if key == '_dance_moves_bpm':
            if value in ('', None):
                value = ''
            elif not finite_number(value) or not 20 <= value <= 400:
                raise ValueError('BPM must be a finite number from 20 to 400, or blank for fallback')
            else:
                value = round(value,3)
        elif key.endswith('_timing_id'):
            expected = 9001 if 'lyric' in key else 9002
            if type(value) is not int or value not in (0,expected):
                raise ValueError(f'Choose fixture attachment {expected} or clear it; arbitrary IDs are not valid in this simulator')
        elif key == '_dance_moves_lyric_popups_enabled':
            if type(value) is not bool:
                raise ValueError('Lyric opt-in must be a JSON boolean')
        elif key == '_dance_moves_effect' and value not in ('','paper-planes'):
            raise ValueError('Ambient effect must be blank or paper-planes')
        next_meta[key] = value
    return next_meta

def byte_range(header: str | None, length: int) -> tuple[int,int,int]:
    if not header:
        return 0,length-1,200
    if not header.startswith('bytes=') or ',' in header:
        raise ValueError('Only one byte range is supported')
    left,sep,right = header[6:].partition('-')
    if not sep or (not left and not right):
        raise ValueError('Invalid range')
    if not left:
        count = int(right)
        if count <= 0:
            raise ValueError('Invalid suffix range')
        start,end = max(0,length-count),length-1
    else:
        start=int(left);end=int(right) if right else length-1
        if start < 0 or start >= length or end < start:
            raise ValueError('Range outside file')
        end=min(end,length-1)
    return start,end,206

class DemoServer(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self, address, root: Path = ROOT):
        self.root=root.resolve()
        manifest=json.loads((self.root/'examples/wordpress/features.json').read_text())
        self.features={row['id']:row for row in manifest['features']}
        self.state={key:{'meta':copy.deepcopy(row['meta']),'history':[]} for key,row in self.features.items()}
        self.lock=threading.Lock()
        self.key=secrets.token_bytes(32)
        super().__init__(address, Handler)

class Handler(BaseHTTPRequestHandler):
    server: DemoServer
    def log_message(self, fmt, *args):
        # Do not log signed URLs, payloads, request headers or sensor data.
        if args and str(args[1] if len(args)>1 else '').startswith('5'):
            super().log_message(fmt, *args)

    def valid_host(self) -> bool:
        host=self.headers.get('Host','')
        allowed={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        if host not in allowed:
            self.reply(403,{'error':'Loopback Host required'})
            return False
        origin=self.headers.get('Origin')
        if origin and origin not in {f'http://{item}' for item in allowed}:
            self.reply(403,{'error':'Cross-origin writes are not allowed'})
            return False
        return True

    def reply(self,status:int,data:dict) -> None:
        content=(json.dumps(data,ensure_ascii=False,allow_nan=False)+'\n').encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(content)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Robots-Tag','noindex, nofollow')
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers()
        if self.command!='HEAD':
            self.wfile.write(content)

    def state_reply(self,slug:str) -> None:
        with self.server.lock:
            state=self.server.state[slug]
            self.reply(200,{'simulated':True,'meta':state['meta'],'revisions':len(state['history'])})

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.valid_host():
            return
        parsed=urlsplit(self.path);path=unquote(parsed.path)
        if path=='/':
            path=PREFIX+'index.html'
        api=PREFIX+'api/'
        if path.startswith(api+'page/'):
            slug=path[len(api+'page/'):]
            if slug in self.server.state:
                self.state_reply(slug)
            else:
                self.reply(404,{'error':'Unknown example page'})
            return
        if path==api+'download-url':
            signature=hmac.new(self.server.key,b'arcadians.mp3',hashlib.sha256).hexdigest()
            self.reply(200,{'simulated':True,'url':api+'download?file=arcadians.mp3&signature='+signature})
            return
        if path==api+'download':
            query=parse_qs(parsed.query)
            signature=query.get('signature',[''])[0]
            expected=hmac.new(self.server.key,b'arcadians.mp3',hashlib.sha256).hexdigest()
            if query.get('file')!=['arcadians.mp3'] or len(signature)!=64 or any(c not in '0123456789abcdef' for c in signature) or not hmac.compare_digest(signature,expected):
                self.reply(404,{'error':'Invalid local demo signature or filename'})
                return
            self.file(self.server.root/'examples/wordpress/media/arcadians.mp3',download=True)
            return
        if path.startswith(api):
            self.reply(404,{'error':'Unknown simulated endpoint'})
            return
        relative=path.lstrip('/')
        if '\0' in relative or '\\' in relative or any(part.startswith('.') for part in Path(relative).parts):
            self.reply(404,{'error':'Not part of the public example surface'});return
        allowed=(relative.startswith('assets/') or relative.startswith('examples/wordpress/') or relative in ('README.md','RELEASING.md','RUDIMENTS-API.md','docs/wordpress-examples.md'))
        target=(self.server.root/relative).resolve()
        if not allowed or not target.is_relative_to(self.server.root) or any(part.startswith('.') for part in Path(relative).parts):
            self.reply(404,{'error':'Not part of the public example surface'})
            return
        if target.is_dir():
            target=target/'index.html'
        self.file(target)

    def file(self,target:Path,download:bool=False):
        if not target.is_file():
            self.reply(404,{'error':'File missing; prepare the pinned Arcadians assets or serve a complete DanceMoves checkout'})
            return
        size=target.stat().st_size
        try:
            start,end,status=byte_range(None if download else self.headers.get('Range'),size)
        except (ValueError,OverflowError):
            self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return
        mime='text/javascript' if target.suffix in ('.js','.mjs','.cjs') else 'audio/mpeg' if target.suffix=='.mp3' else mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(max(0,end-start+1)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Robots-Tag','noindex, nofollow')
        if download:
            self.send_header('Content-Disposition',"attachment; filename=\"Arcadians.mp3\"; filename*=UTF-8''Arcadians.mp3")
        else:
            self.send_header('Accept-Ranges','bytes')
        if status==206:
            self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.end_headers()
        if self.command=='HEAD':
            return
        try:
            with target.open('rb') as stream:
                stream.seek(start);remaining=end-start+1
                while remaining>0:
                    block=stream.read(min(65536,remaining))
                    if not block: break
                    self.wfile.write(block);remaining-=len(block)
        except (BrokenPipeError,ConnectionResetError):
            pass

    def do_POST(self):
        if not self.valid_host(): return
        parsed=urlsplit(self.path);path=unquote(parsed.path);api=PREFIX+'api/'
        if path.startswith(api+'page/'):
            parts=path[len(api+'page/'):].split('/');slug=parts[0]
            if slug not in self.server.state or len(parts)>2:
                self.reply(404,{'error':'Unknown example'});return
            if len(parts)==2:
                with self.server.lock:
                    s=self.server.state[slug]
                    if parts[1]=='restore' and s['history']:
                        s['meta']=s['history'].pop()
                    elif parts[1]=='reset':
                        s['meta']=copy.deepcopy(self.server.features[slug]['meta']);s['history'].clear()
                    else:
                        self.reply(400,{'error':'No such revision/action'});return
                self.state_reply(slug);return
            payload=self.body()
            if payload is None:return
            try:
                with self.server.lock:
                    state=self.server.state[slug];updated=validate_meta(payload.get('meta'),state['meta'])
                    state['history'].append(copy.deepcopy(state['meta']));state['history']=state['history'][-10:];state['meta']=updated
            except (AttributeError,ValueError) as error:
                self.reply(400,{'error':str(error),'previousSelectionPreserved':True});return
            self.state_reply(slug);return
        if path==api+'capture':
            payload=self.body()
            if payload is None:return
            samples=payload.get('samples') if isinstance(payload,dict) else None
            if payload.get('schema')!='ks-epk-motion-recording/v1' or not isinstance(samples,list) or not 1<=len(samples)<=240:
                self.reply(400,{'simulated':True,'error':'Expected v1 synthetic fixture with 1–240 samples'});return
            for sample in samples:
                if not isinstance(sample,dict) or any(not finite_number(sample.get(k)) for k in ('t','beta','gamma')) or sample.get('isTrusted') is not False:
                    self.reply(400,{'simulated':True,'error':'Only finite explicitly untrusted synthetic samples are accepted here'});return
            self.reply(200,{'simulated':True,'captureId':0,'sampleCount':len(samples),'storedPrivately':False,'stored':False,'note':'Validation demonstration only; not persisted or sent to WordPress'});return
        self.reply(405,{'error':'This route does not accept POST'})

    def body(self):
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':
            self.reply(415,{'error':'JSON content type required'});return None
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=BODY_LIMIT:
                self.reply(413,{'error':'Body size limit'});return None
            payload=json.loads(self.rfile.read(length),parse_constant=lambda s: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))
            if not isinstance(payload,dict):raise ValueError('JSON object required')
            return payload
        except (ValueError,UnicodeError):
            self.reply(400,{'error':'Invalid JSON object'});return None

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8765)
    args=parser.parse_args()
    if not 1<=args.port<=65535:parser.error('port must be in 1–65535')
    try: server=DemoServer(('127.0.0.1',args.port))
    except OSError as error:parser.exit(1,f'Cannot bind port: {error}. Choose --port with an unused port.\n')
    print(f'Arcadians examples: http://127.0.0.1:{server.server_port}{PREFIX}',flush=True)
    print('Loopback only. Ctrl+C stops the server. Metadata/revisions exist only in memory.',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
