#!/usr/bin/env python3
"""Real browser / real WASM generic API test, not a live WordPress or physical-device test."""
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
            page.wait_for_function("window.fixtureRudiment?.snapshot().loaded === true")
            page.wait_for_function("document.querySelector('audio').readyState >= 1")
            page.wait_for_timeout(120)
            state = page.evaluate("fixtureRudiment.snapshot()")
            assert state['status'] == 'running', state
            api = page.evaluate("DanceMovesRudiments.snapshot()")
            assert api['upstreamVersion'] == '0.2.0' and api['sourceCatalogueCount'] == 1731, api
            results.append('generic API mounted one selected native rudiment in real Chromium')
            translate = page.evaluate("getComputedStyle(document.querySelector('.motion-target')).translate")
            assert translate != 'none', translate
            assert page.evaluate('inlineStyleMutations') == 0
            results.append('CSSOM output moves the consumer target with zero inline-style mutations')
            page.evaluate("async () => { const a=document.querySelector('audio'); await a.play(); a.pause(); }")
            # Seek inside pip 100 rather than exactly on its leading boundary.
            # Browsers may adjust the resulting media position to one supported by
            # the decoded stream, so a boundary seek can legitimately land just below it.
            page.evaluate("async () => { const a=document.querySelector('audio'); const done=new Promise(r=>a.addEventListener('seeked',r,{once:true})); a.currentTime=100.5/48; await done; }")
            page.wait_for_timeout(80)
            state = page.evaluate('fixtureRudiment.snapshot()')
            assert state['pip'] == 100 and state['status'] == 'audio-paused', state
            assert abs(state['position']['x'] + 14) < 1e-9
            results.append('audio seek and pause restore deterministic native pip 100')
            page.evaluate('fixtureRudiment.setEnabled(false)')
            page.wait_for_function("fixtureRudiment.snapshot().status==='disabled'")
            assert page.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            page.evaluate('fixtureRudiment.setEnabled(true)')
            page.wait_for_function("fixtureRudiment.snapshot().status==='audio-paused'")
            assert page.evaluate('fixtureRudiment.snapshot().pip') == 100
            results.append('generic enabled state stops work and reconstructs the current audio pose')
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function("fixtureRudiment.snapshot().status==='reduced-motion'")
            assert page.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            results.append('reduced motion stops the generic frame loop')
            page.emulate_media(reduced_motion='no-preference', forced_colors='active')
            page.wait_for_function("fixtureRudiment.snapshot().status==='forced-colors'")
            assert page.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            results.append('forced colours stops the generic frame loop')
            page.emulate_media(forced_colors='none')
            page.evaluate('fixtureRudiment.destroy()')
            assert page.evaluate('DanceMovesRudiments.snapshot().instances.length') == 0
            assert page.evaluate("document.querySelector('.motion-target').hasAttribute('data-dance-moves-rudiment-owner')") is False
            results.append('destroy releases the generic CSS owner and instance')
            page.screenshot(path=str(args.output / 'generic-rudiment-fixture.png'), full_page=True)
            assert errors == [], errors
            results.append('no uncaught browser errors')
            fallback = browser.new_page()
            fallback.add_init_script('window.WebAssembly = undefined;')
            fallback.goto(url)
            fallback.wait_for_function("window.DanceMovesRudiments?.snapshot().error")
            assert fallback.evaluate('DanceMovesRudiments.snapshot().framePending') is False
            results.append('WASM-unavailable path reports failure without starting a frame loop')
            fallback.close()
            browser.close()
    except Exception as error:
        report = {'status': 'BLOCKED' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error) else 'FAIL',
                  'scope': 'generic synthetic fixture; not live WordPress', 'passedBeforeFailure': len(results),
                  'checks': results, 'error': str(error)}
        (args.output / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
        raise
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=5)
    report = {'status': 'PASS', 'scope': 'real Chromium, production generic API/WASM, synthetic clock and silent audio; not live WordPress',
              'passed': len(results), 'checks': results}
    (args.output / 'results.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
