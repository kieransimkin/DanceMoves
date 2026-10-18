import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
import {environment, Element} from './fake-dom.mjs';
import {createScope} from '../../src/scope.mjs';
import {createRecordingService} from '../../src/recordings.mjs';
import {createSpectrumService} from '../../src/spectrum.mjs';
import {createVisualiserService} from '../../src/visualisers.mjs';
import {createVisualiserResources} from '../../src/visualiser-resources.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

// Both generic positions and saved recordings use the shipped native samplers.
// Only the scheduler and Canvas are doubles: browser tests own actual RAF,
// visibility events and rendered pixel evidence.
let native;
function genericNative() {
  if (native) return native;
  const e = environment();
  e.host.DanceMoves = {bpm: 150};
  const context = {window: e.host, document: e.doc};
  for (const file of ['assets/vendor/dancerudiments/dancerudiments-native.js', 'assets/dance-moves-rudiments.js']) {
    runInNewContext(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), context);
  }
  native = e.host.DanceMovesRudiments;
  return native;
}

function movementRecording({startPip = 0, count = 96, beatZero = .25} = {}) {
  return {format: 'dancerudiments.recording', schema_version: 1, pips_per_beat: 64,
    sample_dtype: 'float64', name: 'synthetic_native_movement', dimensions: ['x', 'y', 'z'],
    samples: Array.from({length: count}, (_, i) => [2 * (i % 17) / 16 - 1, Math.cos(i * Math.PI / 8) * .75, (i % 5) / 4]),
    clock: {bpm: 120, bpm_source: 'synthetic fixture', bpm_status: 'confirmed',
      beat_zero_seconds: beatZero, phase_status: 'supplied', start_pip: startPip},
    provenance: {producer: 'DanceMoves test', synthetic: true}};
}

function fixture({fetch, config = {}, source, withoutResizeObserver = false} = {}) {
  const e = environment(), requests = [], signals = [], drivers = new Map();
  const sampled = [], mutationObservers = [], installedOptions = [], scratchCanvases = [];
  const createElement = e.doc.createElement.bind(e.doc);
  e.doc.createElement = name => {
    const element = createElement(name);
    if (name === 'canvas') {
      // Spatial modules write their actual RGBA raster here. Browser coverage
      // separately verifies image presentation and CSS-colour parsing.
      element.getContext = () => ({createImageData(width,height) {return {data:new Uint8ClampedArray(width*height*4)};},putImageData() {}});
      scratchCanvases.push(element);
    }
    return element;
  };
  const Observer = e.host.MutationObserver;
  e.host.MutationObserver = class extends Observer {
    constructor(callback) {super(callback); mutationObservers.push(this);}
  };
  e.host.fetch = async (url, options = {}) => {
    requests.push(String(url)); signals.push(options.signal);
    return fetch ? fetch(url, options) : new Response(JSON.stringify(createSpectrumRecording()));
  };
  if (withoutResizeObserver) e.host.ResizeObserver = undefined;
  const settings = {bpm: 150, ...config}, scope = createScope(e.root, settings);
  const audio = source || Object.assign(new Element(e.doc, 'audio'), {
    currentTime: 0, paused: true, ended: false, playbackRate: 1, seeking: false,
    src: 'http://localhost:4173/synthetic.wav', duration: 20
  });
  if (audio.nodeType === 1) e.root.append(audio);
  const clockFrame = {sourceBeats: 123, rhythmicBeats: 9000, positionPips: 64};
  const sampler = genericNative(), runtime = {playbackSource: () => audio};
  let readyCalls = 0;
  runtime.rudiments = {
    ready() {readyCalls++; return sampler.ready();},
    describe: name => sampler.describe(name),
    catalogue: () => sampler.catalogue(),
    sample(name, pip) {sampled.push([name, pip]); return sampler.sample(name, pip);},
    get: id => drivers.get(id)?.handle || null,
    animate(options) {
      installedOptions.push(options);
      let destroyed = false, paused = false, blocked = null, enabled = options.enabled !== false;
      let status = 'loading', error = null, resetCount = 0;
      const emit = (reason = 'frame', updates = {}) => {
        if (destroyed) return;
        status = reason;
        const neutral = ['disabled', 'reduced-motion', 'forced-colors'].includes(reason);
        options.render({...clockFrame, audio: options.clock === 'page' ? null : audio,
          position: {x: 0, y: 0, z: 0}, reason,
          ...(neutral ? {positionPips: null} : {}), ...updates});
      };
      const refresh = () => {
        if (destroyed) return;
        if (blocked || paused) {status = blocked || 'paused'; return;}
        try {emit(enabled ? options.clock !== 'page' && audio.paused ? 'audio-paused' : 'frame' : 'disabled');}
        catch (failure) {error = String(failure.message || failure); status = 'error';}
      };
      const handle = {ready: null,
        destroy() {destroyed = true; status = 'destroyed'; drivers.delete(options.id);},
        pause() {paused = true; refresh();}, resume() {paused = false; refresh();}, refresh,
        setEnabled(value) {enabled = value; refresh();},
        reset() {resetCount++; refresh();},
        snapshot: () => ({status, destroyed, error, resetCount})};
      drivers.set(options.id, {handle, emit, block(reason) {blocked = reason; refresh();},
        unblock() {blocked = null; refresh();}});
      handle.ready = sampler.ready().then(() => {refresh(); if (error) throw new Error(error); return handle;});
      return handle;
    }
  };
  runtime.recordings = createRecordingService(scope, runtime.rudiments, settings);
  const resources = createVisualiserResources(scope, runtime);
  runtime.spectrum = createSpectrumService(scope, runtime, settings, resources);
  runtime.visualisers = createVisualiserService(scope, runtime, settings, resources);
  function canvas({width = 400, height = 220, renderer} = {}) {
    const target = new Element(e.doc, 'canvas'), figure = new Element(e.doc, 'figure');
    const status = new Element(e.doc, 'p'), calls = [];
    status.textContent = 'Authored fallback'; figure.append(target, status);
    figure.querySelector = () => status;
    let size = {width, height};
    const context = new Proxy({}, {get(object, key) {
      if (!(key in object)) object[key] = (...args) => {calls.push([key, ...args]);};
      return object[key];
    }});
    target.getContext = () => context;
    target.getBoundingClientRect = () => size;
    target.closest = () => figure;
    target.setAttribute('width', '300'); target.setAttribute('height', '150');
    target.setAttribute('role', 'presentation'); target.setAttribute('aria-label', 'Authored movement');
    const matches = target.matches.bind(target);
    target.matches = selector => selector.split(',').some(part => {
      const attribute = /^canvas\[([\w-]+)\]$/.exec(part.trim());
      return attribute ? target.hasAttribute(attribute[1]) : matches(part);
    });
    if (renderer) target.setAttribute('data-dance-moves-visualiser', renderer);
    Object.defineProperties(target, {
      width: {get: () => Number(target.getAttribute('width') || 300)},
      height: {get: () => Number(target.getAttribute('height') || 150)}
    });
    e.root.append(figure);
    return {target, figure, status, calls,
      resize(w, h) {size = {width: w, height: h}; e.host.dispatchEvent(new Event('resize'));}};
  }
  function flushRemovals() {
    for (const observer of mutationObservers) if (!observer.disconnected) observer.callback([{type: 'childList'}]);
  }
  return {...e, scope, runtime, audio, clockFrame, requests, signals, drivers, sampled, installedOptions,
    canvas, flushRemovals, scratchCanvases, readyCalls: () => readyCalls};
}

function saved(f, canvas, id, extra = {}) {
  return {id, target: canvas.target, audio: f.audio, recordingUrl: '/spectrum.json', offscreen: false, ...extra};
}
function generic(f, canvas, id, extra = {}) {
  return {id, target: canvas.target, rudiment: 'circle', offscreen: false, ...extra};
}
function assertDisposed(f) {
  assert.equal(f.drivers.size, 0);
  for (const key of ['listeners', 'frames', 'timers', 'observers']) assert.equal(f.scope.snapshot()[key], 0, key);
}

test('visualiser setup and configured pages without canvases load no page recording or native pattern', () => {
  for (const config of [{}, {visualiserRecordingUrl: '/unused-song.json'}, {visualiserRudiment: 'circle'}]) {
    const f = fixture({config});
    assert.deepEqual(f.runtime.visualisers.mountPage(), []);
    assert.equal(f.requests.length, 0); assert.equal(f.readyCalls(), 0);
    assert.equal(f.runtime.visualisers.snapshot().sources, 0);
    assert.equal(f.runtime.visualisers.snapshot().patterns, 0);
    assert.equal(f.installedOptions.length, 0);
    f.scope.dispose(); assertDisposed(f);
  }
});

test('generic views use native dimensions and positions, share bounded histories and never fetch a song', async () => {
  const f = fixture(), frames = [];
  const a = f.runtime.visualisers.animate(generic(f, f.canvas(), 'generic-a', {
    renderer: 'waveform-sample-beads', historyPips: 5, historyStride: 3, onFrame: frame => frames.push(frame)
  }));
  const b = f.runtime.visualisers.animate(generic(f, f.canvas(), 'generic-b', {
    renderer: 'waveform-sample-beads', historyPips: 5, historyStride: 3
  }));
  await Promise.all([a.ready, b.ready]);
  assert.equal(f.requests.length, 0); assert.equal(f.runtime.visualisers.snapshot().patterns, 1);
  assert.deepEqual(a.snapshot().dimensions, ['x', 'y']);
  const expected = genericNative().sample('circle', 64);
  assert.deepEqual(a.snapshot().values, [expected.x, expected.y]);
  assert.equal(a.snapshot().historyLength, 5);
  assert.deepEqual(f.sampled, [64, 61, 58, 55, 52].map(pip => ['circle', pip]), 'two views sample one shared observed history');
  f.drivers.get('generic-a').emit('frame', {positionPips: -5, sourceBeats: .5, rhythmicBeats: 10000});
  const negative = genericNative().sample('circle', -5);
  assert.deepEqual(a.snapshot().values, [negative.x, negative.y]);
  assert.equal(a.snapshot().pip, -5, 'absolute signed native pips are authoritative');
  assert.equal(frames.at(-1).historyLength, 5, 'generic native patterns wrap before a negative history origin');
  a.destroy(); assert.equal(f.runtime.visualisers.snapshot().patterns, 1);
  b.destroy(); assert.equal(f.runtime.visualisers.snapshot().patterns, 0);
  f.scope.dispose(); assertDisposed(f);
});

test('generic controls delegate clock, rate, phase and cue reset to the existing native driver', async () => {
  const f = fixture();
  const h = f.runtime.visualisers.animate(generic(f, f.canvas(), 'generic-controls', {
    rudiment: 'helix', renderer: 'spatial-torus', audio: f.audio, clock: 'auto',
    rate: 1.5, phasePips: -64, resetOnCue: 'chorus', offscreen: true
  }));
  h.pause(); await h.ready;
  const driver = f.installedOptions[0];
  for (const [key, value] of Object.entries({rudiment: 'helix', clock: 'auto', rate: 1.5,
    phasePips: -64, resetOnCue: 'chorus', offscreen: true, css: false, amplitude: 0, renderEveryFrame: true})) {
    assert.equal(driver[key], value, key);
  }
  assert.equal(h.snapshot().status, 'paused');
  h.resume(); assert.deepEqual(h.snapshot().dimensions, ['x', 'y', 'z']);
  assert.equal(h.snapshot().historyLength, 1, 'wire geometry does not allocate a history window');
  h.reset(); assert.equal(f.drivers.get(h.id).handle.snapshot().resetCount, 1);
  assert.equal(f.requests.length, 0); f.scope.dispose(); assertDisposed(f);
});

test('all six spatial views own a bounded CPU surface and redraw source-time changes within a native pip', async () => {
  const f = fixture(), handles = [], canvases = [];
  const style = {raster_size:64,rings:3,segments:6,fog:0,glow:0};
  for (const renderer of ['spatial-solid-torus','spatial-solid-sphere','spatial-solid-terrain',
    'spatial-music-torus','spatial-music-sphere','spatial-music-terrain']) {
    const canvas = f.canvas();canvases.push(canvas);
    handles.push(f.runtime.visualisers.animate(generic(f, canvas, renderer, {renderer,rudiment:'helix',style})));
  }
  await Promise.all(handles.map(handle => handle.ready));
  assert.equal(f.requests.length, 0);assert.equal(f.runtime.visualisers.snapshot().atlases, 0);
  assert.equal(f.scratchCanvases.length, 6);
  for (const [index, handle] of handles.entries()) {
    const state = handle.snapshot(), report = state.renderReport;
    assert.equal(state.report, null);assert.equal(report.backend, 'cpu');assert.equal(report.sourceSha256, null);
    assert.ok(Object.isFrozen(report));assert.ok(report.coveredPixels > 0);
    assert.ok(report.rasterWidth * report.rasterHeight <= 64 * 64);
    const draws = canvases[index].calls.filter(call => call[0] === 'drawImage').length;
    f.drivers.get(handle.id).emit('frame', {sourceBeats:f.clockFrame.sourceBeats + .001});
    assert.equal(handle.snapshot().pip, state.pip);
    assert.notEqual(handle.snapshot().sourceSeconds, state.sourceSeconds);
    assert.equal(canvases[index].calls.filter(call => call[0] === 'drawImage').length, draws + 1);
  }
  f.scope.dispose();assertDisposed(f);
  assert.ok(f.scratchCanvases.every(canvas => canvas.width === 1 && canvas.height === 1));
  assert.ok(handles.every(handle => handle.snapshot().renderReport === null));
});

test('optional music calibration uses the saved source clock, selected bands and observed history', async () => {
  const f = fixture({config:{bpm:173}}), recording = createSpectrumRecording(), handles = [];
  for (const [renderer, option] of [['spatial-music-torus',{spectral_deform:true}],
    ['spatial-music-sphere',{spectral_deform:true}], ['spatial-music-terrain',{terrain_source:'fft'}]]) {
    const handle = f.runtime.visualisers.animate(saved(f, f.canvas(), renderer, {
      renderer, recordingUrl:undefined, recording, historyPips:5,historyStride:2,
      axes:['band_000','band_001','band_002'],style:{raster_size:64,rings:3,segments:6,fog:0,glow:0,...option}
    }));handles.push(handle);
  }
  await Promise.all(handles.map(handle => handle.ready));
  for (const handle of handles) {
    assert.equal(handle.snapshot().pip, 0);assert.equal(handle.snapshot().historyLength, 1);
    assert.deepEqual(handle.snapshot().renderReport.sourcePips, [0], 'the first strip has one observed row');
    assert.equal(handle.snapshot().report.source_sha256, 'ab'.repeat(32));
    assert.equal(handle.snapshot().renderReport.sourceSha256, 'ab'.repeat(32));
  }
  f.audio.currentTime = .03125;
  for (const handle of handles) handle.refresh();
  const terrain = handles[2].snapshot();assert.equal(terrain.pip, 4);
  assert.deepEqual(terrain.renderReport.sourcePips, [0,2,4]);assert.equal(terrain.historyLength, 3);
  assert.equal(terrain.sourceSeconds, .03125, 'page BPM and rhythmic phase do not retime saved FFT rows');
  for (const handle of handles.slice(0,2)) assert.deepEqual(handle.snapshot().renderReport.sourcePips, [4]);
  f.audio.src = 'http://localhost:4173/another-master.wav';
  for (const handle of handles) {handle.refresh();assert.equal(handle.snapshot().status, 'source-mismatch');
    assert.equal(handle.snapshot().renderReport, null);assert.equal(handle.snapshot().report, null);}
  assert.equal(f.requests.length, 0);f.scope.dispose();assertDisposed(f);
});

test('declarative music controls reach the real calibrated renderer while incompatible native options fail before loading', async () => {
  const f = fixture({config:{visualiserRecordingUrl:'/page-bands.json',visualiserRenderer:'spatial-music-terrain',
    visualiserTerrainSource:'fft',visualiserSpectralDeform:true,visualiserAxes:['band_000','band_001','band_002']}});
  f.canvas({renderer:'spatial-music-terrain'});
  const [view] = f.runtime.visualisers.mountPage();await view.ready;
  assert.equal(view.snapshot().renderReport.sourceSha256, 'ab'.repeat(32));
  assert.equal(view.snapshot().dimensions.length, 3);assert.equal(f.requests.length, 1);
  const before = f.installedOptions.length;
  assert.throws(() => f.runtime.visualisers.animate(generic(f, f.canvas(), 'bad-native-fft', {
    renderer:'spatial-music-terrain',style:{terrain_source:'fft'}})), /calibrated Fourier/);
  assert.equal(f.installedOptions.length, before);assert.equal(f.requests.length, 1);
  f.scope.dispose();assertDisposed(f);
});

test('large generic seeks keep observed histories within the public sample limit', async () => {
  const f = fixture();
  const h = f.runtime.visualisers.animate(generic(f, f.canvas(), 'bounded-history', {
    rudiment: 'bounce', renderer: 'waveform-sample-beads', historyPips: 512, historyStride: 120,
    style: {history_limit: 4}
  }));
  await h.ready;
  assert.equal(h.snapshot().historyLength, 512); assert.equal(f.sampled.length, 512);
  assert.equal(f.sampled[0][1], 64); assert.equal(f.sampled.at(-1)[1], 64 - 511 * 120);
  for (const pip of [1000000, 2000000, 3000000, 4000000, 64]) {
    const before = f.sampled.length;
    f.drivers.get(h.id).emit('frame', {positionPips: pip});
    assert.equal(h.snapshot().historyLength, 512);
    assert.ok(f.sampled.length - before <= 512, 'a seek never samples the skipped interval');
    assert.deepEqual(h.snapshot().values, [genericNative().sample('bounce', pip).x]);
  }
  assert.equal(f.requests.length, 0); f.scope.dispose(); assertDisposed(f);
});

test('page mounting selects only its configured native pattern or saved recording', async () => {
  const a = fixture({config: {visualiserRudiment: 'bounce'}});
  a.canvas({renderer: 'waveform-sample-beads'}); a.canvas();
  const genericViews = a.runtime.visualisers.mountPage();
  assert.equal(genericViews.length, 1); await genericViews[0].ready;
  assert.equal(genericViews[0].snapshot().rudiment, 'bounce');
  assert.equal(a.requests.length, 0);
  const b = fixture({config: {visualiserRecordingUrl: '/selected-song.json', visualiserAxes: ['band_001']}});
  b.canvas({renderer: 'waveform-sample-beads'}); b.canvas({renderer: 'spectrum-capsules'});
  const savedViews = b.runtime.visualisers.mountPage();
  await Promise.all(savedViews.map(h => h.ready));
  assert.equal(savedViews.length, 2);
  assert.deepEqual(b.requests, ['http://localhost:4173/selected-song.json']);
  for (const h of savedViews) assert.deepEqual(h.snapshot().dimensions, ['band_001']);
  a.scope.dispose(); b.scope.dispose(); assertDisposed(a); assertDisposed(b);
});

test('a failed declarative canvas shows its error without destroying a valid view or its root', async () => {
  const f = fixture({config: {visualiserRudiment: 'bounce'}});
  const bad = f.canvas({renderer: 'path'}), good = f.canvas({renderer: 'waveform-sample-beads'});
  let views;
  assert.doesNotThrow(() => {views = f.runtime.visualisers.mountPage();});
  assert.equal(views.length, 2);
  await assert.rejects(views[0].ready, /at least 2/);
  await views[1].ready;
  assert.equal(views[0].snapshot().status, 'error');
  assert.equal(bad.target.getAttribute('data-dance-moves-visualiser-state'), 'error');
  assert.match(bad.status.textContent, /Visualiser unavailable/);
  assert.equal(f.scope.disposed, false); assert.equal(views[1].snapshot().destroyed, false);
  assert.deepEqual(views[1].snapshot().values, [genericNative().sample('bounce', 64).x]);
  assert.equal(f.drivers.size, 1); assert.equal(f.requests.length, 0);
  views[0].destroy(); assert.equal(bad.status.textContent, 'Authored fallback');
  views[1].refresh(); assert.ok(good.calls.some(call => call[0] === 'fill' || call[0] === 'stroke'));
  f.scope.dispose(); assertDisposed(f);
});

test('a failed declarative view cannot take over a canvas owned by the original spectrum API', async () => {
  const f = fixture({config: {visualiserRudiment: 'circle'}});
  const canvas = f.canvas({renderer: 'waveform-sample-beads'});
  const owner = f.runtime.spectrum.animate(saved(f, canvas, 'authored-spectrum-owner'));
  await owner.ready;
  const attributes = new Map(canvas.target.attributes), caption = canvas.status.textContent, calls = canvas.calls.length;
  const [failed] = f.runtime.visualisers.mountPage();
  await assert.rejects(failed.ready, /canvas.*owner/);
  assert.equal(failed.snapshot().status, 'error'); assert.equal(owner.snapshot().destroyed, false);
  assert.deepEqual(canvas.target.attributes, attributes); assert.equal(canvas.status.textContent, caption);
  assert.equal(canvas.calls.length, calls, 'failure does not clear or resize the existing owner’s canvas');
  failed.destroy(); owner.refresh(); assert.ok(owner.snapshot().report);
  assert.equal(f.runtime.spectrum.get(owner.id), owner); assert.equal(f.runtime.spectrum.snapshot().sources, 1);
  f.scope.dispose(); assertDisposed(f);
});

test('spectrum and expanded visualisers share one recording request and one native table per mount', async () => {
  const instantiate = WebAssembly.instantiate; let tables = 0;
  WebAssembly.instantiate = async (...args) => {
    const result = await Reflect.apply(instantiate, WebAssembly, args);
    if (typeof (result.instance || result).exports.sample_recording === 'function') tables++;
    return result;
  };
  const f = fixture();
  try {
    const a = f.runtime.visualisers.animate(saved(f, f.canvas(), 'shared-new', {renderer: 'spectrogram-pixel-mosaic'}));
    const b = f.runtime.spectrum.animate(saved(f, f.canvas(), 'shared-old', {
      renderer: 'spectrum-ring', recordingUrl: 'http://localhost:4173/spectrum.json#bands'
    }));
    await Promise.all([a.ready, b.ready]);
    assert.deepEqual(f.requests, ['http://localhost:4173/spectrum.json']); assert.equal(tables, 1);
    assert.equal(f.runtime.visualisers.snapshot().sources, 1); assert.equal(f.runtime.spectrum.snapshot().sources, 1);
    assert.ok(Math.abs(a.snapshot().report.bands[0].rms - .1) < 1e-12);
    assert.equal(a.snapshot().report.bands[3].rms, 0);
    a.destroy(); assert.equal(f.signals[0].aborted, false);
    assert.equal(b.snapshot().destroyed, false); b.refresh(); assert.ok(b.snapshot().report);
    b.destroy(); assert.equal(f.signals[0].aborted, true);
    assert.equal(f.runtime.visualisers.snapshot().sources, 0);
    const next = f.runtime.visualisers.animate(saved(f, f.canvas(), 'shared-remount'));
    await next.ready; assert.equal(f.requests.length, 2); assert.equal(tables, 2, 'last-owner teardown does not leave a global table cache');
  } finally {f.scope.dispose(); WebAssembly.instantiate = instantiate;}
  assertDisposed(f);
});

test('pending views reserve both canvas and ID across APIs and abort only after the last owner leaves', async () => {
  let resolve;
  const pending = new Promise(done => {resolve = done;});
  const f = fixture({fetch: () => pending}), a = f.canvas(), b = f.canvas();
  const first = f.runtime.visualisers.animate(saved(f, a, 'pending-new'));
  const second = f.runtime.spectrum.animate(saved(f, b, 'pending-old'));
  assert.throws(() => f.runtime.spectrum.animate(saved(f, a, 'same-canvas-old')), /canvas.*owner/);
  assert.throws(() => f.runtime.visualisers.animate(saved(f, b, 'same-canvas-new')), /canvas.*owner/);
  assert.throws(() => f.runtime.spectrum.animate(saved(f, f.canvas(), 'pending-new')), /unique id/);
  assert.throws(() => f.runtime.visualisers.animate(saved(f, f.canvas(), 'pending-old')), /unique id/);
  assert.equal(f.requests.length, 1); assert.equal(f.installedOptions.length, 0);
  first.destroy(); assert.equal(f.signals[0].aborted, false);
  second.destroy(); assert.equal(f.signals[0].aborted, true);
  resolve(new Response(JSON.stringify(createSpectrumRecording())));
  await Promise.all([first.ready, second.ready]);
  assert.equal(f.installedOptions.length, 0, 'an uncooperative late response cannot install a destroyed view');
  assert.equal(f.runtime.visualisers.snapshot().sources, 0);
  assert.equal(f.scope.snapshot().observers, 0);
  f.scope.dispose(); assertDisposed(f);
});

for (const kind of ['native URL', 'elementless master ID']) test(`a changed ${kind} during recording load cannot rebind either view API to another song`, async () => {
  let resolve;
  const pending = new Promise(done => {resolve = done;});
  const source = kind === 'native URL' ? undefined : {currentTime: 0, paused: true, ended: false, playbackRate: 1,
    masterId: 'first-master', masterSourceUrl: 'http://localhost:4173/synthetic.wav', element: null};
  const f = fixture({fetch: () => pending, source});
  const original = kind === 'native URL' ? f.audio.src : source.masterId;
  const handles = [
    f.runtime.spectrum.animate(saved(f, f.canvas(), 'loading-identity-old', {renderer: 'spectrum-line'})),
    f.runtime.visualisers.animate(saved(f, f.canvas(), 'loading-identity-new', {renderer: 'spectrum-capsules'}))
  ];
  if (kind === 'native URL') f.audio.src = 'http://localhost:4173/another-song.wav';
  else source.masterId = 'another-master';
  resolve(new Response(JSON.stringify(createSpectrumRecording())));
  await Promise.all(handles.map(handle => handle.ready));
  for (const handle of handles) {
    assert.equal(handle.snapshot().status, 'source-mismatch');
    assert.equal(handle.snapshot().report, null);
  }
  assert.equal(handles[1].snapshot().values, null);
  assert.equal(f.requests.length, 1, 'both APIs still share only the originally selected recording request');
  if (kind === 'native URL') f.audio.src = original;
  else source.masterId = original;
  for (const handle of handles) {
    handle.refresh();
    assert.ok(handle.snapshot().report, 'restoring the original master resumes its already loaded evidence');
  }
  assert.ok(handles[1].snapshot().values); assert.equal(f.requests.length, 1);
  f.scope.dispose(); assertDisposed(f);
});

test('pending generic destruction installs no driver and releases the generic source', async () => {
  const f = fixture(), h = f.runtime.visualisers.animate(generic(f, f.canvas(), 'early-generic'));
  h.destroy(); await h.ready;
  assert.equal(f.installedOptions.length, 0); assert.equal(f.runtime.visualisers.snapshot().patterns, 0);
  assert.equal(h.snapshot().status, 'destroyed'); f.scope.dispose(); assertDisposed(f);
});

test('recording loads belong to each mount and switching selection requests only the new source', async () => {
  const a = fixture(), b = fixture();
  const first = a.runtime.visualisers.animate(saved(a, a.canvas(), 'song-a', {recordingUrl: '/first.json'}));
  const other = b.runtime.visualisers.animate(saved(b, b.canvas(), 'same-url-other-mount', {recordingUrl: '/first.json'}));
  await Promise.all([first.ready, other.ready]);
  assert.deepEqual(a.requests, ['http://localhost:4173/first.json']);
  assert.deepEqual(b.requests, ['http://localhost:4173/first.json']);
  first.destroy(); assert.equal(b.signals[0].aborted, false);
  const next = a.runtime.visualisers.animate(saved(a, a.canvas(), 'song-b', {recordingUrl: '/second.json'}));
  await next.ready;
  assert.deepEqual(a.requests, ['http://localhost:4173/first.json', 'http://localhost:4173/second.json']);
  assert.equal(a.runtime.visualisers.snapshot().sources, 1);
  assert.equal(other.snapshot().destroyed, false);
  a.scope.dispose(); b.scope.dispose(); assertDisposed(a); assertDisposed(b);
});

test('saved movement can select and reorder native axes without requiring Fourier provenance', async () => {
  const f = fixture(), recording = movementRecording(), axes = ['z', 'x'];
  f.audio.currentTime = recording.clock.beat_zero_seconds;
  const h = f.runtime.visualisers.animate(saved(f, f.canvas(), 'movement-axes', {
    recordingUrl: undefined, recording, renderer: 'path', axes
  }));
  axes[0] = 'y'; await h.ready;
  assert.deepEqual(h.snapshot().dimensions, ['z', 'x']);
  assert.deepEqual(h.snapshot().values, [recording.samples[0][2], recording.samples[0][0]]);
  assert.equal(h.snapshot().report, null); assert.equal(h.snapshot().historyLength, 1);
  assert.equal(f.requests.length, 0);
  f.scope.dispose(); assertDisposed(f);
});

test('axis and Fourier prerequisites fail visibly before an invalid source installs a movement driver', async () => {
  const f = fixture();
  for (const extra of [{rudiment: 'bounce', renderer: 'path'}, {axes: ['x', 'x']},
    {axes: ['missing']}, {renderer: 'spectrum-capsules'}, {rudiment: 'missing'}]) {
    assert.throws(() => f.runtime.visualisers.animate(generic(f, f.canvas(), 'invalid-generic', extra)), /axis|axes|Fourier|rudiment/);
  }
  const cases = [
    {recording: movementRecording(), renderer: 'spectrum-capsules', error: /StemLab|Fourier/},
    {recording: movementRecording(), axes: ['missing'], error: /axis/},
    {recording: movementRecording(), axes: ['x', 'x'], error: /unique/},
    {recording: movementRecording(), axes: ['x'], renderer: 'waveform-phase-trails', error: /at least 2/},
    {recording: createSpectrumRecording(), axes: ['band_002', 'band_001'], renderer: 'spectrogram-tape', error: /order|overlap/},
    {recording: createSpectrumRecording(), axes: ['band_000','band_001'], renderer: 'spatial-music-terrain', style: {terrain_source:'fft'}, error: /at least 3/},
    {recording: movementRecording(), renderer: 'spatial-music-sphere', style: {spectral_deform:true}, error: /StemLab|Fourier/}
  ];
  for (const [index, row] of cases.entries()) {
    const c = f.canvas(), {error, ...sourceOptions} = row;
    const h = f.runtime.visualisers.animate(saved(f, c, `invalid-saved-${index}`, {
      recordingUrl: undefined, ...sourceOptions
    }));
    await assert.rejects(h.ready, error);
    assert.equal(h.snapshot().status, 'error'); assert.equal(h.snapshot().values, null);
    assert.match(c.status.textContent, /Visualiser unavailable/);
    assert.equal(c.target.getAttribute('data-dance-moves-visualiser-state'), 'error');
    h.destroy();
  }
  assert.equal(f.installedOptions.length, 0); assert.equal(f.requests.length, 0);
  f.scope.dispose(); assertDisposed(f);
});

test('saved visualisers preserve capture BPM and raw master seconds through seeks and playback-rate changes', async () => {
  const f = fixture({config: {bpm: 173}}), c = f.canvas(), recording = movementRecording({count: 256});
  const h = f.runtime.visualisers.animate(saved(f, c, 'capture-clock', {
    recordingUrl: undefined, recording, renderer: 'waveform-sample-beads', historyPips: 7, historyStride: 2
  }));
  await h.ready; assert.equal(h.snapshot().status, 'outside-recording');
  f.audio.currentTime = .5; h.refresh();
  assert.equal(h.snapshot().pip, 32, 'native 120 BPM capture ignores page BPM and a variable rhythmic clock');
  assert.deepEqual(h.snapshot().values, recording.samples[32]);
  assert.equal(h.snapshot().sourceSeconds, .5); assert.equal(h.snapshot().historyLength, 7);
  c.calls.length = 0; f.audio.currentTime = .375; h.refresh();
  const earlier = structuredClone(c.calls), earlierValues = h.snapshot().values;
  assert.deepEqual(earlierValues, recording.samples[16]);
  f.audio.playbackRate = 2; f.audio.currentTime = .5; h.refresh();
  assert.equal(h.snapshot().pip, 32);
  h.pause(); f.audio.currentTime = 1; h.refresh();
  assert.equal(h.snapshot().pip, 32); assert.equal(h.snapshot().status, 'paused');
  h.resume(); assert.equal(h.snapshot().pip, 96);
  f.audio.playbackRate = .5; f.audio.currentTime = .375; c.calls.length = 0; h.refresh();
  assert.deepEqual(c.calls, earlier, 'a seek reconstructs the observed history without integrated render state');
  assert.deepEqual(h.snapshot().values, earlierValues);
  assert.throws(() => h.reset(), /capture origin/);
  for (const key of ['clock', 'bpm', 'rate', 'phasePips', 'resetOnCue']) {
    assert.throws(() => f.runtime.visualisers.animate(saved(f, f.canvas(), 'clock-override', {[key]: 1})), /capture/);
  }
  f.scope.dispose(); assertDisposed(f);
});

for (const startPip of [-8, 8]) test(`saved history clips at its ${startPip < 0 ? 'negative' : 'positive'} capture origin and never wraps`, async () => {
  const f = fixture(), recording = movementRecording({startPip});
  const h = f.runtime.visualisers.animate(saved(f, f.canvas(), 'capture-boundary', {
    recordingUrl: undefined, recording, renderer: 'waveform-sample-beads', historyPips: 5, historyStride: 3
  }));
  await h.ready;
  for (const offset of [-1, 0, 1, 3, 4, 12, 45, 95, 96, 4]) {
    const pip = startPip + offset;
    f.audio.currentTime = recording.clock.beat_zero_seconds + pip / 128; h.refresh();
    assert.equal(h.snapshot().pip, pip);
    if (offset < 0 || offset >= recording.samples.length) {
      assert.equal(h.snapshot().status, 'outside-recording');
      assert.equal(h.snapshot().values, null); assert.equal(h.snapshot().historyLength, 0);
    } else {
      assert.deepEqual(h.snapshot().values, recording.samples[offset]);
      assert.equal(h.snapshot().historyLength, Math.min(5, Math.floor(offset / 3) + 1));
    }
  }
  f.scope.dispose(); assertDisposed(f);
});

test('preferences clear saved energy and visibility holds the existing frame through the native driver', async () => {
  const f = fixture(), c = f.canvas(), frames = [];
  const h = f.runtime.visualisers.animate(saved(f, c, 'neutral-visualiser', {
    renderer: 'spectrum-capsules', onFrame: frame => frames.push(frame)
  }));
  await h.ready;
  const expected = structuredClone(h.snapshot().report), original = h.snapshot().values;
  for (const reason of ['reduced-motion', 'forced-colors']) {
    f.drivers.get(h.id).emit(reason);
    assert.equal(h.snapshot().values, null); assert.equal(h.snapshot().report, null);
    assert.equal(h.snapshot().historyLength, 0); assert.equal(h.snapshot().status, reason);
    assert.equal(frames.at(-1).values, null, 'neutral zero must never be calibrated as Fourier energy');
    h.refresh(); assert.deepEqual(h.snapshot().report, expected);
  }
  h.setEnabled(false); assert.equal(h.snapshot().values, null); assert.equal(h.snapshot().report, null);
  h.setEnabled(true); assert.deepEqual(h.snapshot().values, original);
  for (const reason of ['hidden', 'offscreen', 'seeking']) {
    const count = c.calls.length, callbacks = frames.length;
    f.drivers.get(h.id).block(reason); h.refresh();
    assert.equal(h.snapshot().status, reason); assert.equal(c.calls.length, count); assert.equal(frames.length, callbacks);
    assert.deepEqual(h.snapshot().report, expected);
    f.drivers.get(h.id).unblock();
  }
  f.scope.dispose(); assertDisposed(f);
});

test('elementless master changes clear saved visuals without silently loading another song', async () => {
  const source = {currentTime: 0, paused: true, ended: false, playbackRate: 1,
    masterId: 'first', masterSourceUrl: 'http://localhost:4173/first.wav', element: null};
  const f = fixture({source});
  const h = f.runtime.visualisers.animate(saved(f, f.canvas(), 'master-identity', {renderer: 'spectrum-capsules'}));
  await h.ready; assert.ok(h.snapshot().report);
  source.masterId = 'second'; source.masterSourceUrl = 'http://localhost:4173/second.wav'; h.refresh();
  assert.equal(h.snapshot().status, 'source-mismatch'); assert.equal(h.snapshot().values, null); assert.equal(h.snapshot().report, null);
  assert.equal(f.requests.length, 1);
  source.masterId = 'first'; source.masterSourceUrl = 'http://localhost:4173/first.wav'; h.refresh();
  assert.ok(h.snapshot().report); assert.equal(f.requests.length, 1);
  f.scope.dispose(); assertDisposed(f);
});

test('public frames, selected values and calibration reports cannot mutate a shared view', async () => {
  const f = fixture(); let frame;
  const a = f.runtime.visualisers.animate(saved(f, f.canvas(), 'readonly-a', {renderer: 'spectrum-capsules', onFrame: value => {frame = value;}}));
  const b = f.runtime.visualisers.animate(saved(f, f.canvas(), 'readonly-b', {renderer: 'spectrum-capsules'}));
  await Promise.all([a.ready, b.ready]);
  const expected = structuredClone(b.snapshot());
  assert.ok(Object.isFrozen(frame)); assert.ok(Object.isFrozen(frame.values)); assert.ok(Object.isFrozen(frame.dimensions));
  assert.throws(() => {frame.values[0] = 1;}, TypeError);
  assert.throws(() => {frame.dimensions.push('extra');}, TypeError);
  assert.throws(() => {frame.report.bands[0].rms = 1;}, TypeError);
  assert.throws(() => {frame.report.peaks.push({});}, TypeError);
  const copy = b.snapshot(); copy.status = 'caller mutation';
  assert.deepEqual(b.snapshot(), expected);
  f.scope.dispose(); assertDisposed(f);
});

test('bounds, malformed styles and bad targets fail before creating resources or fetching a recording', () => {
  const f = fixture(), c = f.canvas();
  const invalid = [
    {historyPips: 0}, {historyPips: 513}, {historyPips: 1.5},
    {historyStride: 0}, {historyStride: 121}, {historyStride: 1.5},
    {pixelRatio: .49}, {pixelRatio: 4.01}, {pixelRatio: NaN},
    {rate: 0}, {rate: 64.01}, {phasePips: .5}, {phasePips: Number.MAX_SAFE_INTEGER + 1},
    {enabled: 1}, {offscreen: 'false'}, {onFrame: 1}, {axes: []}, {axes: [64]},
    {clock: 'invalid'}, {clock: 'audio'}, {bpm: 120}, {renderer: 'unknown'},
    {renderer: 'waveform-sample-beads', style: {history_limit: 3}},
    {renderer: 'waveform-sample-beads', style: {unknown: true}},
    {renderer: 'spatial-torus', style: {camera_distance: 2}},
    {renderer: 'spatial-sphere', style: {rings: 2}}
  ];
  for (const extra of invalid) assert.throws(() => f.runtime.visualisers.animate(generic(f, c, 'invalid-options', extra)), undefined, JSON.stringify(extra));
  for (const recordingUrl of ['file:///song.json', 'https://user:secret@example.com/song.json', '', '\n/song.json']) {
    assert.throws(() => f.runtime.visualisers.animate(saved(f, c, 'invalid-url', {recordingUrl})), /recordingUrl/);
  }
  assert.throws(() => f.runtime.visualisers.animate(saved(f, c, 'missing-canvas', {target: '#absent'})), /root/);
  assert.throws(() => f.runtime.visualisers.animate(saved(f, c, 'not-canvas', {target: f.root})), /canvas/);
  assert.throws(() => f.runtime.visualisers.animate(generic(f, c, 'two-sources', {recordingUrl: '/unexpected.json'})), /exactly one/);
  assert.equal(f.requests.length, 0); assert.equal(f.installedOptions.length, 0);
  assert.equal(f.scope.snapshot().observers, 0); assert.equal(f.runtime.visualisers.snapshot().instances.length, 0);
  f.scope.dispose(); assertDisposed(f);
});

test('minimum history and display bounds remain valid, and capped buffers restore authored DOM on destruction', async () => {
  const f = fixture({withoutResizeObserver: true}), c = f.canvas({width: 10000, height: 10000});
  const h = f.runtime.visualisers.animate(generic(f, c, 'small-bounds', {
    rudiment: 'bounce', renderer: 'waveform-sample-beads', historyPips: 1, historyStride: 120, pixelRatio: .5,
    style: {padding: 0, history_limit: 4, line_width: 1, bead_radius: .5, segments: 2}
  }));
  await h.ready;
  assert.equal(h.snapshot().historyLength, 1); assert.equal(h.snapshot().dimensions.length, 1);
  assert.ok(c.target.width * c.target.height <= 4194304);
  assert.ok(c.calls.some(row => row[0] === 'fill' || row[0] === 'stroke'));
  c.resize(320, 160); h.refresh(); assert.equal(c.target.width, 160); assert.equal(c.target.height, 80);
  c.resize(1, 1); h.refresh(); assert.notEqual(h.snapshot().status, 'error');
  c.target.setAttribute('aria-label', 'New authored label');
  h.destroy();
  assert.equal(c.target.getAttribute('width'), '300'); assert.equal(c.target.getAttribute('height'), '150');
  assert.equal(c.target.getAttribute('role'), 'presentation'); assert.equal(c.target.getAttribute('aria-label'), 'New authored label');
  assert.equal(c.target.getAttribute('data-dance-moves-visualiser-state'), null);
  assert.equal(c.status.textContent, 'Authored fallback');
  assert.equal(f.scope.snapshot().listeners, 0); assert.equal(f.scope.snapshot().observers, 0);
  f.scope.dispose(); assertDisposed(f);
});

test('removing or moving a canvas outside its root releases only that view across both APIs', async () => {
  const f = fixture(), a = f.canvas(), b = f.canvas();
  const first = f.runtime.visualisers.animate(saved(f, a, 'remove-new'));
  const second = f.runtime.spectrum.animate(saved(f, b, 'remove-old'));
  await Promise.all([first.ready, second.ready]);
  f.doc.body.append(a.target); f.flushRemovals();
  assert.equal(first.snapshot().destroyed, true); assert.equal(second.snapshot().destroyed, false);
  assert.equal(f.runtime.visualisers.snapshot().sources, 1); assert.equal(f.signals[0].aborted, false);
  b.target.remove(); f.flushRemovals();
  assert.equal(second.snapshot().destroyed, true); assert.equal(f.runtime.visualisers.snapshot().sources, 0);
  assert.equal(f.scope.disposed, false); assertDisposed(f);
  f.scope.dispose(); assertDisposed(f);
});

test('HTTP failures show a static error, release the source, and permit a retry on the same canvas and ID', async () => {
  let succeed = false;
  const f = fixture({fetch: () => succeed ? new Response(JSON.stringify(createSpectrumRecording())) : new Response('', {status: 503})});
  const c = f.canvas(), failed = f.runtime.visualisers.animate(saved(f, c, 'retry'));
  await assert.rejects(failed.ready, /503/);
  assert.equal(failed.snapshot().status, 'error'); assert.match(c.status.textContent, /Visualiser unavailable/);
  assert.equal(f.runtime.visualisers.snapshot().sources, 0); assert.equal(f.installedOptions.length, 0);
  succeed = true;
  const good = f.runtime.spectrum.animate(saved(f, c, 'retry'));
  await good.ready;
  assert.equal(failed.snapshot().destroyed, true); assert.ok(good.snapshot().report);
  assert.equal(f.requests.length, 2);
  f.scope.dispose(); assertDisposed(f);
});

test('destroyed visualiser controllers release raw recordings and shared native tables', async () => {
  if (typeof global.gc !== 'function') {
    const result = spawnSync(process.execPath, ['--expose-gc', '--test',
      '--test-name-pattern=^destroyed visualiser controllers release raw recordings and shared native tables$', import.meta.filename],
    {encoding: 'utf8', timeout: 20000});
    assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    return;
  }
  const instantiate = WebAssembly.instantiate, memories = [], decoded = [];
  WebAssembly.instantiate = async (...args) => {
    const result = await Reflect.apply(instantiate, WebAssembly, args), api = (result.instance || result).exports;
    if (typeof api.sample_recording === 'function') memories.push(new WeakRef(api.memory));
    return result;
  };
  const f = fixture({fetch: async url => {
    const recording = createSpectrumRecording();
    if (String(url).endsWith('/invalid.json')) recording.provenance.axes[0].clipped_windows = 1;
    return new Response(JSON.stringify(recording));
  }});
  const recordingService = f.runtime.recordings;
  f.runtime.recordings = {...recordingService, async load(...args) {
    const input = await recordingService.load(...args); decoded.push(new WeakRef(input.samples)); return input;
  }};
  function inline() {
    const recording = movementRecording();
    return {raw: new WeakRef(recording.samples), handle: f.runtime.visualisers.animate(saved(f, f.canvas(), 'memory-inline', {
      recordingUrl: undefined, recording, renderer: 'waveform-sample-beads'
    }))};
  }
  async function collected(refs, label) {
    // Cross a task boundary before every collection: WeakRef dereferencing keeps
    // an object alive for its current job even if there are no strong owners.
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(resolve => setImmediate(resolve)); global.gc();
      if (refs.every(ref => ref.deref() === undefined)) return;
    }
    assert.fail(label + ' remains strongly reachable after explicit full collections');
  }
  try {
    const direct = inline();
    const remote = f.runtime.visualisers.animate(saved(f, f.canvas(), 'memory-remote', {renderer: 'spectrum-capsules'}));
    const sibling = f.runtime.spectrum.animate(saved(f, f.canvas(), 'memory-sibling'));
    await Promise.all([direct.handle.ready, remote.ready, sibling.ready]);
    assert.equal(memories.length, 2); assert.equal(decoded.length, 1);
    await collected([direct.raw, ...decoded], 'Decoded JSON sample arrays');
    const retainedDrivers = [direct.handle, remote, sibling].map(handle => f.runtime.rudiments.get(handle.id));
    direct.handle.destroy(); remote.destroy();
    await collected([memories[0]], 'Unshared inline native recording table');
    assert.ok(memories[1].deref(), 'the old spectrum API still owns the shared native table');
    sibling.destroy();
    const failed = f.runtime.visualisers.animate(saved(f, f.canvas(), 'memory-error', {
      recordingUrl: '/invalid.json', renderer: 'spectrum-capsules'
    }));
    await assert.rejects(failed.ready, /Clipped Fourier axes/);
    assert.equal(memories.length, 3); assert.equal(f.runtime.visualisers.snapshot().sources, 0);
    await collected(memories, 'Destroyed and failed native recording tables');
    assert.equal(direct.handle.snapshot().destroyed, true); assert.equal(remote.snapshot().destroyed, true);
    assert.equal(sibling.snapshot().destroyed, true); assert.equal(failed.snapshot().status, 'error');
    assert.ok(retainedDrivers.every(handle => handle.snapshot().destroyed), 'public and scheduler handles remain retained during collection');
  } finally {f.scope.dispose(); WebAssembly.instantiate = instantiate;}
  assertDisposed(f);
});
