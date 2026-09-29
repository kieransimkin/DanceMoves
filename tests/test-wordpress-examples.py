#!/usr/bin/env python3
"""Local simulator HTTP contracts. Test-only bytes are NOT the Arcadians demo song."""
from __future__ import annotations
import copy
import hashlib
import http.client
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('demo_server', ROOT/'tools/serve-wordpress-examples.py')
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)
API = '/examples/wordpress/api/'

class HTTPContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='dance-moves-http-tests-')
        cls.root = Path(cls.temp.name)
        folder = cls.root/'examples/wordpress'
        folder.mkdir(parents=True)
        shutil.copyfile(ROOT/'examples/wordpress/features.json',folder/'features.json')
        (folder/'media').mkdir()
        # Deliberately not an audio recording: only tests byte-range/attachment transport.
        cls.test_bytes = b'HTTP-CONTRACT-FIXTURE-NOT-ARCADIANS\n' + bytes(range(256))*4
        (folder/'media/arcadians.mp3').write_bytes(cls.test_bytes)
        (folder/'index.html').write_text('<!doctype html><title>Test fixture</title>')
        (cls.root/'assets').mkdir()
        (cls.root/'assets/test.js').write_text('/* test asset */')
        (cls.root/'kieran-epk-device-orientation.php').write_text('PRIVATE-SOURCE-MUST-NOT-BE-SERVED')
        (folder/'.secret').write_text('NOT-PUBLIC')
        cls.server = server_module.DemoServer(('127.0.0.1',0),cls.root)
        cls.port=cls.server.server_port
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join(timeout=3);cls.temp.cleanup()

    def request(self,path,method='GET',payload=None,headers=None,raw=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
        sent=dict(headers or {})
        data=raw
        if payload is not None:
            data=json.dumps(payload).encode();sent.setdefault('Content-Type','application/json')
        try:
            conn.request(method,path,body=data,headers=sent)
            response=conn.getresponse()
            status=response.status;received=dict(response.getheaders());body=response.read()
            return status,received,body
        finally:
            conn.close()

    def parsed(self,*args,**kwargs):
        status,headers,body=self.request(*args,**kwargs)
        return status,json.loads(body) if body else None

    def setUp(self):
        self.request(API+'page/metadata/reset','POST')

    def test_all_23_presets(self):
        self.assertEqual(len(self.server.features),23)
        for slug,feature in self.server.features.items():
            with self.subTest(slug=slug):
                status,data=self.parsed(API+'page/'+slug)
                self.assertEqual(status,200);self.assertTrue(data['simulated'])
                self.assertEqual(data['meta'],feature['meta'])
                self.assertEqual(len(data['meta']),6)

    def test_partial_update_and_revision(self):
        status,before=self.parsed(API+'page/metadata')
        status,after=self.parsed(API+'page/metadata','POST',{'meta':{'_dance_moves_bpm':123.4567}})
        self.assertEqual(status,200);self.assertEqual(after['meta']['_dance_moves_bpm'],123.457)
        self.assertEqual(after['revisions'],1)
        other={k:v for k,v in before['meta'].items() if k!='_dance_moves_bpm'}
        self.assertEqual(other,{k:v for k,v in after['meta'].items() if k!='_dance_moves_bpm'})
        status,restored=self.parsed(API+'page/metadata/restore','POST')
        self.assertEqual(status,200);self.assertEqual(restored['meta'],before['meta']);self.assertEqual(restored['revisions'],0)

    def test_invalid_update_is_all_before_write(self):
        _,before=self.parsed(API+'page/metadata')
        invalids=[{'_dance_moves_bpm':0},{'_dance_moves_bpm':401},{'_dance_moves_bpm':True},
                  {'_dance_moves_bpm':'145'},{'_dance_moves_bpm':10**500},{'_dance_moves_bpm':None,'_dance_moves_lyric_timing_id':123},
                  {'_dance_moves_master_duration_ms':42},{'_dance_moves_bpm':130,'made_up_meta':True},
                  {'_dance_moves_lyric_popups_enabled':1},{'_dance_moves_effect':'none'},
                  {'_dance_moves_cue_timing_id':9001},{'_dance_moves_lyric_timing_id':9002}]
        for update in invalids:
            with self.subTest(update=update):
                status,data=self.parsed(API+'page/metadata','POST',{'meta':update})
                self.assertEqual(status,400);self.assertTrue(data['previousSelectionPreserved'])
                self.assertEqual(self.parsed(API+'page/metadata')[1],before)

    def test_clear_and_bounds(self):
        for bpm in ('',None,20,400):
            status,data=self.parsed(API+'page/metadata','POST',{'meta':{'_dance_moves_bpm':bpm,
                '_dance_moves_lyric_timing_id':0,'_dance_moves_cue_timing_id':0,
                '_dance_moves_lyric_popups_enabled':False,'_dance_moves_effect':''}})
            self.assertEqual(status,200);self.assertEqual(data['meta']['_dance_moves_bpm'],'' if bpm is None else bpm)
        self.assertEqual(self.parsed(API+'page/metadata','POST',{'meta':{'_dance_moves_effect':'paper-planes'}})[0],200)

    def test_revision_cap_and_reset(self):
        for value in range(120,135):
            self.assertEqual(self.parsed(API+'page/metadata','POST',{'meta':{'_dance_moves_bpm':value}})[0],200)
        self.assertEqual(self.parsed(API+'page/metadata')[1]['revisions'],10)
        self.request(API+'page/metadata/reset','POST')
        self.assertEqual(self.parsed(API+'page/metadata')[1]['revisions'],0)
        self.assertEqual(self.parsed(API+'page/metadata/restore','POST')[0],400)

    def test_host_origin_restrictions(self):
        for headers in ({'Host':'attacker.invalid'},{'Origin':'https://attacker.invalid'},{'Origin':'null'}):
            self.assertEqual(self.request(API+'page/metadata',headers=headers)[0],403)
        self.assertEqual(self.request(API+'page/metadata',headers={'Origin':f'http://127.0.0.1:{self.port}'})[0],200)

    def test_only_public_files(self):
        for path in ('/.git/config','/kieran-epk-device-orientation.php','/examples/wordpress/.secret',
                     '/assets/../kieran-epk-device-orientation.php','/assets/%2e%2e/kieran-epk-device-orientation.php',
                     '/examples/wordpress/../../kieran-epk-device-orientation.php',
                     '/assets/%00.js','/examples/wordpress/api/missing'):
            with self.subTest(path=path):self.assertEqual(self.request(path)[0],404)
        status,headers,_=self.request('/assets/test.js')
        self.assertEqual(status,200);self.assertEqual(headers['Content-Type'],'text/javascript')
        self.assertEqual(self.request('/')[0],200)

    def test_media_range_and_head(self):
        path='/examples/wordpress/media/arcadians.mp3'
        status,headers,body=self.request(path)
        self.assertEqual(status,200);self.assertEqual(body,self.test_bytes)
        self.assertEqual(headers['Content-Type'],'audio/mpeg');self.assertNotIn('Content-Disposition',headers)
        for value,expected in [('bytes=0-9',self.test_bytes[:10]),('bytes=-7',self.test_bytes[-7:]),('bytes=1024-',self.test_bytes[1024:])]:
            status,headers,body=self.request(path,headers={'Range':value})
            self.assertEqual(status,206);self.assertEqual(body,expected);self.assertIn('Content-Range',headers)
        status,headers,body=self.request(path,'HEAD',headers={'Range':'bytes=2-4'})
        self.assertEqual(status,206);self.assertEqual(body,b'');self.assertEqual(headers['Content-Length'],'3')
        for value in ('bytes=999999-','bytes=5-1','bytes=0-1,4-5','bytes=-0','items=1-2','bytes=x-y'):
            status,headers,body=self.request(path,headers={'Range':value})
            self.assertEqual(status,416);self.assertEqual(headers['Content-Range'],f'bytes */{len(self.test_bytes)}')

    def test_signed_download_and_normal_playback_are_distinct(self):
        _,info=self.parsed(API+'download-url');self.assertTrue(info['simulated'])
        status,headers,body=self.request(info['url'],headers={'Range':'bytes=0-2'})
        self.assertEqual(status,200);self.assertEqual(body,self.test_bytes)
        self.assertTrue(headers['Content-Disposition'].startswith('attachment;'))
        self.assertEqual(headers['Content-Type'],'audio/mpeg')
        status,headers,body=self.request(info['url'],'HEAD')
        self.assertEqual(status,200);self.assertEqual(body,b'');self.assertEqual(int(headers['Content-Length']),len(self.test_bytes))
        self.assertEqual(self.request(info['url']+'x')[0],404)
        self.assertEqual(self.request(info['url'].replace('arcadians.mp3','../private.mp3'))[0],404)
        self.assertEqual(self.request(API+'download')[0],404)
        self.assertEqual(self.request(API+'download?file=arcadians.mp3&signature=%C3%A9')[0],404)

    def test_capture_never_persists(self):
        payload={'schema':'ks-epk-motion-recording/v1','samples':[{'t':0,'beta':10,'gamma':2,'isTrusted':False}]}
        status,data=self.parsed(API+'capture','POST',payload)
        self.assertEqual(status,200);self.assertTrue(data['simulated']);self.assertEqual(data['captureId'],0)
        self.assertFalse(data['stored']);self.assertFalse(data['storedPrivately']);self.assertEqual(data['sampleCount'],1)
        for value in ([],[{'t':0,'beta':10,'gamma':2,'isTrusted':True}],[{'t':0,'beta':True,'gamma':0,'isTrusted':False}]):
            self.assertEqual(self.parsed(API+'capture','POST',{'schema':payload['schema'],'samples':value})[0],400)
        self.assertEqual(self.parsed(API+'capture','POST',{'schema':'wrong','samples':payload['samples']})[0],400)
        self.assertEqual(self.parsed(API+'capture','POST',{'schema':payload['schema'],'samples':payload['samples']*241})[0],400)

    def test_body_validation(self):
        path=API+'page/metadata'
        for data in (b'[]',b'{bad json',b'{"meta":{"_dance_moves_bpm":NaN}}',b'\xff'):
            self.assertEqual(self.request(path,'POST',headers={'Content-Type':'application/json'},raw=data)[0],400)
        self.assertEqual(self.request(path,'POST',raw=b'{}')[0],415)
        self.assertEqual(self.request(path,'POST',headers={'Content-Type':'application/json'},raw=b' '*262145)[0],413)
        self.assertEqual(self.request('/not-an-endpoint','POST')[0],405)
        self.assertEqual(self.request(API+'page/not-a-feature','POST')[0],404)

    def test_state_is_process_local(self):
        # Creating a new server recreates presets; nothing writes a database or configuration file.
        self.parsed(API+'page/metadata','POST',{'meta':{'_dance_moves_bpm':200}})
        fresh=server_module.DemoServer(('127.0.0.1',0),self.root)
        try:
            self.assertEqual(fresh.state['metadata']['meta']['_dance_moves_bpm'],145)
            self.assertNotEqual(fresh.key,self.server.key)
        finally:fresh.server_close()


class PreparationContracts(unittest.TestCase):
    """Exercise copy/hash/error policy with synthetic .bin files, not a fake song."""
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='dance-moves-prepare-tests-')
        self.root=Path(self.temp.name)/'plugin';self.source=Path(self.temp.name)/'stemlab'
        folder=self.root/'examples/wordpress/media';folder.mkdir(parents=True)
        self.source.mkdir()
        self.data=b'LOCAL TEST DATA: not audio or artwork'
        (self.source/'fixture.bin').write_bytes(self.data)
        record={'name':'fixture.bin','sourcePath':'fixture.bin','bytes':len(self.data),'sha256':hashlib.sha256(self.data).hexdigest(),'url':'https://invalid.example/not-used'}
        (folder/'manifest.json').write_text(json.dumps({'assets':[record]}))
        spec=importlib.util.spec_from_file_location('demo_prepare',ROOT/'tools/prepare-wordpress-examples.py')
        self.preparer=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.preparer);self.preparer.ROOT=self.root
        self.folder=folder
    def tearDown(self):self.temp.cleanup()
    def test_verified_copy_and_idempotency(self):
        self.assertIn('Prepared',self.preparer.prepare(self.source)[0])
        self.assertEqual((self.folder/'fixture.bin').read_bytes(),self.data)
        self.assertIn('Verified existing',self.preparer.prepare(self.source)[0])
    def test_wrong_existing_file_is_not_replaced(self):
        target=self.folder/'fixture.bin';target.write_bytes(b'wrong')
        with self.assertRaises(ValueError):self.preparer.prepare(self.source)
        self.assertEqual(target.read_bytes(),b'wrong')
    def test_wrong_source_leaves_no_destination_or_temporary_file(self):
        (self.source/'fixture.bin').write_bytes(b'bad source')
        with self.assertRaises(ValueError):self.preparer.prepare(self.source)
        self.assertFalse((self.folder/'fixture.bin').exists());self.assertEqual(list(self.folder.glob('*.partial')),[])
    def test_missing_source_fails_without_substitution(self):
        (self.source/'fixture.bin').unlink()
        with self.assertRaises(FileNotFoundError):self.preparer.prepare(self.source)
        self.assertFalse((self.folder/'fixture.bin').exists())

if __name__=='__main__':unittest.main(verbosity=2)
