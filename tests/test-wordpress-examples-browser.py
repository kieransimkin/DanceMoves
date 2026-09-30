#!/usr/bin/env python3
"""Run real local DanceMoves assets in Chromium. Never accesses or mutates WordPress."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import threading
import wave

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('demo_server',ROOT/'tools/serve-wordpress-examples.py')
server_module=importlib.util.module_from_spec(spec);spec.loader.exec_module(server_module)

class Blocked(RuntimeError):pass

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium',help='Path to an installed Chromium executable; otherwise Playwright default')
    parser.add_argument('--output',type=Path,default=ROOT/'qa/wordpress-examples-browser.json')
    parser.add_argument('--synthetic-transport',action='store_true',help='TEST ONLY: intercept the MP3 URL with silent WAV transport, never modify demo files')
    args=parser.parse_args()
    results=[];server=None;thread=None
    report={'status':'NOT RUN','sourceBaseline':'c4252556774f38cad6d75b1a52de7917d2c65af0',
        'audioMode':'test-only silent WAV transport; NOT Arcadians listening evidence' if args.synthetic_transport else 'requires hash-verified StemLab Arcadians MP3',
        'mediaVerified':False,
        'scope':'Local browser functional smoke tests, not WordPress/PHP or physical-device proof','checks':results}
    def passed(name):results.append({'name':name,'status':'PASS'})
    try:
        required=['dance-moves-core.js','dance-moves-core.css','dance-moves-effects.js','dance-moves-catalogue-timing.js',
            'dance-moves-rudiments.js','vendor/dancerudiments/dancerudiments-native.js',
            'clay-stars-effects.js','clay-stars-effects.css',
            'ks-epk-device-orientation-core.js','ks-epk-device-orientation.js','ks-epk-device-orientation.css',
            'paper-dreams-flight.js','paper-dreams-flight.css','paper-dreams-plane-atlas.png']
        missing=[name for name in required if not (ROOT/'assets'/name).is_file()]
        if missing:raise Blocked('A complete integrated DanceMoves checkout is required. Missing: '+', '.join(missing))
        media=json.loads((ROOT/'examples/wordpress/media/manifest.json').read_text())
        for record in media['assets']:
            if args.synthetic_transport and record['name']=='arcadians.mp3':continue
            path=ROOT/'examples/wordpress/media'/record['name']
            if not path.is_file():raise Blocked('Prepare the pinned media first: python tools/prepare-wordpress-examples.py')
            if path.stat().st_size!=record['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest()!=record['sha256']:
                raise AssertionError('Arcadians media integrity mismatch: '+record['name'])
        report['mediaVerified']=not args.synthetic_transport
        try:from playwright.sync_api import sync_playwright
        except ImportError as error:raise Blocked('Install the test dependency: python -m pip install playwright; python -m playwright install chromium') from error
        server=server_module.DemoServer(('127.0.0.1',0),ROOT)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        origin=f'http://127.0.0.1:{server.server_port}'
        manifest=json.loads((ROOT/'examples/wordpress/features.json').read_text())
        coverage=json.loads((ROOT/'examples/wordpress/coverage.json').read_text())
        wav_data=None
        if args.synthetic_transport:
            stream=io.BytesIO()
            with wave.open(stream,'wb') as writer:
                writer.setnchannels(1);writer.setsampwidth(2);writer.setframerate(8000)
                writer.writeframes(b'\0\0'*round(273.604558*8000))
            wav_data=stream.getvalue()
        with sync_playwright() as p:
            options={'headless':True}
            if args.chromium:options['executable_path']=args.chromium
            try:browser=p.chromium.launch(**options)
            except Exception as error:raise Blocked('Chromium could not start: '+str(error)) from error
            try:
                context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='no-preference',color_scheme='dark')
                if wav_data:
                    context.route('**/examples/wordpress/media/arcadians.mp3',lambda route:route.fulfill(status=200,content_type='audio/wav',body=wav_data,headers={'Cache-Control':'no-store'}))
                errors=[]
                page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
                def load(slug,query=''):
                    errors.clear()
                    try:page.goto(origin+'/examples/wordpress/'+slug+'.html'+query,wait_until='load',timeout=30000)
                    except Exception as error:
                        if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error):raise Blocked('Chromium navigation blocked by administrator policy; no browser pass is claimed') from error
                        raise
                    page.wait_for_function('window.__danceMovesDemo?.ready === true || !!window.__danceMovesDemo?.error',timeout=20000)
                    state=page.evaluate('({ready:window.__danceMovesDemo.ready,error:window.__danceMovesDemo.error})')
                    assert state['ready'],state.get('error')
                    assert not errors,errors
                def seek(seconds):
                    page.wait_for_function('document.querySelector("audio").readyState>=1',timeout=20000)
                    page.evaluate('async t=>{const a=document.querySelector("audio"); if(Math.abs(a.currentTime-t)<.0001)return; await new Promise((ok,fail)=>{const timeout=setTimeout(()=>fail(new Error("seek timeout")),8000);a.addEventListener("seeked",()=>{clearTimeout(timeout);ok();},{once:true});a.currentTime=t;});}',seconds)
                def button(name):page.get_by_role('button',name=name,exact=True).click()
                load('index');assert page.evaluate('window.__danceMovesDemo.features.length')==23;passed('gallery index: 23 feature pages')
                for feature in manifest['features']:
                    load(feature['id'])
                    assert page.evaluate('window.DanceMoves.version')==json.loads((ROOT/'package.json').read_text('utf-8'))['version']
                    assert page.locator('audio').first.get_attribute('autoplay') is None
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),feature['id']+' desktop overflow'
                    page.set_viewport_size({'width':390,'height':844})
                    page.wait_for_timeout(80)
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),feature['id']+' mobile overflow'
                    page.set_viewport_size({'width':1440,'height':1000})
                    assert not errors,errors
                    passed(feature['id']+': real runtime mount, no autoplay, desktop/mobile overflow')
                load('arcadians');seek(110)
                assert page.evaluate('document.querySelector(".ks-epk").dataset.arcSection')=='drop-1'
                seek(0);assert page.evaluate('document.querySelector(".ks-epk").dataset.arcSection')=='intro';passed('Arcadians section restoration')
                load('timeline');seek(110)
                assert page.evaluate('window.__danceMovesDemo.handle.snapshot().active')==['drop-1']
                seek(60);assert page.evaluate('window.__danceMovesDemo.handle.snapshot().active')==['verse-1']
                button('Stop timeline (not audio)');assert page.evaluate('window.__danceMovesDemo.handle.snapshot().status')=='manual-stop';passed('timeline forward/backward seek and explicit stop')
                load('pointer');button('Manual upper-left')
                assert page.evaluate('window.__danceMovesDemo.handle.snapshot().x')==-1
                button('Reset');assert page.evaluate('window.__danceMovesDemo.handle.snapshot().x')==0;passed('pointer manual output and reset')
                load('quality');button('Manual minimal');assert page.evaluate('window.__danceMovesDemo.handle.snapshot().tier')=='minimal';passed('quality manual tier (not a performance measurement)')
                load('rudiments')
                for name in coverage['rudiments']:
                    page.get_by_label('Pattern',exact=False).select_option(name)
                    page.wait_for_function('name=>window.DanceMovesRudiments.get("arcadians:rudiment-gallery")?.snapshot().loaded===true',arg=name)
                    assert page.evaluate('window.DanceMovesRudiments.get("arcadians:rudiment-gallery").snapshot().rudiment')==name
                    sample=page.evaluate('name=>window.DanceMovesRudiments.sample(name,-1)',name)
                    assert all(isinstance(sample[axis],(int,float)) for axis in ('x','y','z'))
                button('Disable');assert page.evaluate('window.DanceMovesRudiments.get("arcadians:rudiment-gallery").snapshot().enabled') is False
                passed('all 15 native rudiments and controller disable')
                load('lyrics');seek(2.89);page.evaluate('document.querySelector("audio").play()')
                page.wait_for_function('window.__danceMovesDemo.handle.snapshot()?.text==="No crown, no concrete"',timeout=5000)
                page.evaluate('document.querySelector("audio").pause()')
                assert page.locator('.dance-moves-lyric-popover').get_attribute('data-dance-moves-lyric-state')=='idle';passed('canonical lyric playback and pause hide')
                for adapter in coverage['orientationAdapters']:
                    load('orientation','?adapter='+adapter)
                    assert page.evaluate('Boolean(window.__ksEpkOrientationRuntime)'),adapter
                    page.get_by_label('beta',exact=False).evaluate("input=>{input.value='20';input.dispatchEvent(new Event('input',{bubbles:true}));}")
                    assert not errors,errors
                passed('all nine orientation wrappers (synthetic, not physical sensor proof)')
                load('accessibility')
                page.emulate_media(reduced_motion='reduce')
                page.wait_for_timeout(100)
                states=page.evaluate('window.DanceMovesRudiments.snapshot().instances.map(x=>x.status)')
                assert all(state!='running' for state in states)
                page.emulate_media(reduced_motion='no-preference',forced_colors='active')
                page.wait_for_timeout(100)
                states=page.evaluate('window.DanceMovesRudiments.snapshot().instances.map(x=>x.status)')
                assert all(state!='running' for state in states);passed('reduced motion and forced colours suspend native motion')
                page.emulate_media(forced_colors='none');context.close()
            finally:browser.close()
        report['status']='PASS'
    except Blocked as error:
        report['status']='BLOCKED';report['reason']=str(error)
    except Exception as error:
        report['status']='FAIL';report['reason']=str(error)
    finally:
        if server:server.shutdown();server.server_close()
        if thread:thread.join(timeout=3)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(report,indent=2))
    return 0 if report['status']=='PASS' else 2 if report['status']=='BLOCKED' else 1

if __name__=='__main__':sys.exit(main())
