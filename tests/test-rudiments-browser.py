#!/usr/bin/env python3
"""Real browser / real WASM fixture test, NOT a live WordPress or physical-device test."""
from __future__ import annotations
import argparse
from functools import partial
import http.server
import json
from pathlib import Path
import shutil
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default=shutil.which('chromium'))
    parser.add_argument('--output', type=Path, default=ROOT / 'qa' / 'rudiments-browser')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    results = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.chromium or None, headless=True,
                args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
            page = browser.new_page(viewport={'width': 1100, 'height': 760})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            url = f'http://127.0.0.1:{server.server_port}/tests/rudiments-browser.html'
            page.goto(url)
            page.wait_for_function("window.DanceMovesClayRudiment?.snapshot().status === 'active'")
            page.wait_for_function("document.querySelector('audio').readyState >= 1")
            page.wait_for_timeout(120)
            state = page.evaluate("DanceMovesClayRudiment.snapshot()")
            assert state['controller']['status'] == 'running', state
            results.append('native ambient loop mounted in real Chromium')
            pseudo = page.evaluate("({name:getComputedStyle(document.querySelector('.epk-atmosphere'),'::after').animationName,translate:getComputedStyle(document.querySelector('.epk-atmosphere'),'::after').translate})")
            assert pseudo['name'] == 'ks-clay-rudiment-treatment', pseudo
            assert pseudo['translate'] != 'none', pseudo
            results.append('legacy translation replaced once; native CSS translate reaches pseudo-element')
            assert page.evaluate('inlineStyleMutations') == 0
            results.append('native frames cause zero inline style mutations / catalogue observer triggers')
            page.evaluate("async () => { const a=document.querySelector('audio'); await a.play(); a.pause(); }")
            page.evaluate("async () => { const a=document.querySelector('audio'); const done=new Promise(r=>a.addEventListener('seeked',r,{once:true})); a.currentTime=100/48; await done; }")
            page.wait_for_timeout(80)
            state = page.evaluate('DanceMovesClayRudiment.snapshot()')
            assert state['controller']['pip'] == 100, state
            assert state['controller']['status'] == 'audio-paused', state
            assert abs(state['controller']['position']['x'] + 14) < 1e-9
            positions = page.evaluate("({t:getComputedStyle(document.querySelector('.epk-atmosphere'),'::after').translate, animations:document.querySelector('.epk-atmosphere').getAnimations().map(a=>({name:a.animationName,time:a.currentTime,playState:a.playState}))})")
            assert '-14px' in positions['t'], positions
            assert positions['animations'][0]['playState'] == 'paused', positions
            assert abs(positions['animations'][0]['time']-100/256*(60000/90*8)) < .01, positions
            results.append('real audio seek/pause restores native pip100 and matching paused accent phase')
            page.screenshot(path=str(args.output / 'native-clay-fixture.png'), full_page=True)
            page.evaluate("root.dataset.danceMovesPerformance='constrained'")
            page.wait_for_function("DanceMovesClayRudiment.snapshot().status==='suspended'")
            assert page.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            assert page.evaluate("getComputedStyle(document.querySelector('.epk-atmosphere'),'::after').animationName") == 'none'
            results.append('constrained tier disables both native work and visual accents')
            page.evaluate("root.dataset.danceMovesPerformance='full'")
            page.wait_for_function("DanceMovesClayRudiment.snapshot().status==='active'")
            assert page.evaluate('DanceMovesClayRudiment.snapshot().controller.pip') == 100
            results.append('quality recovery reconstructs current audio pose')
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function("DanceMovesClayRudiment.snapshot().controller.status==='reduced-motion'")
            assert page.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            assert page.evaluate("getComputedStyle(document.querySelector('.epk-atmosphere'),'::after').translate") == 'none'
            results.append('reduced motion removes translation, accents and the frame loop')
            page.emulate_media(reduced_motion='no-preference', forced_colors='active')
            page.wait_for_function("DanceMovesClayRudiment.snapshot().controller.status==='forced-colors'")
            assert page.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            results.append('forced colours also stops native animation')
            page.emulate_media(forced_colors='none')
            page.evaluate('DanceMovesClayRudiment.teardown()')
            assert page.evaluate("getComputedStyle(document.querySelector('.epk-atmosphere'),'::after').animationName") == 'ks-particle-dance'
            assert page.evaluate('DanceMovesRudiments.snapshot().instances.length') == 0
            results.append('teardown restores original CSS fallback and removes ownership')
            assert errors == [], errors
            results.append('no uncaught browser errors')
            # A separate clean navigation deliberately denies WebAssembly.
            fallback = browser.new_page()
            fallback.add_init_script('window.WebAssembly = undefined;')
            fallback.goto(url)
            fallback.wait_for_function("window.DanceMovesClayRudiment?.snapshot().status==='fallback'")
            assert fallback.evaluate("getComputedStyle(document.querySelector('.epk-atmosphere'),'::after').animationName") == 'ks-particle-dance'
            assert fallback.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            results.append('WASM-unavailable path keeps existing CSS without starting another loop')
            fallback.close()
            browser.close()
    except Exception as error:
        report = {'status': 'BLOCKED' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error) else 'FAIL',
                  'scope': 'synthetic fixture; not live WordPress', 'passedBeforeFailure': len(results),
                  'checks': results, 'error': str(error)}
        (args.output / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
        raise
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=5)
    report = {'status': 'PASS', 'scope': 'real Chromium, production integration/WASM, synthetic legacy APIs and silent audio; not live WordPress',
              'passed': len(results), 'checks': results}
    (args.output / 'results.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
