/** Native motion and calibrated spectral Canvas views, scoped to one page mount. */
import {VISUALISER_CATALOGUE, VISUALISER_RENDERERS, describeVisualiser} from './visualiser-catalogue.mjs';
import {validateVisualiserStyle, drawVisualiser} from './visualiser-drawing.mjs';
import {validateSpectrumBands, validateSpectrumStyle, analyseSpectrum} from './spectrum-analysis.mjs';
import {createVisualiserResources, createCanvasSurface, cachedSample, freezeSpectrumReport, playbackIdentity} from './visualiser-resources.mjs';
import {numberStyle} from './visualiser-helpers.mjs';

const neutralReasons = new Set(['disabled', 'reduced-motion', 'forced-colors']);
const heldReasons = new Set(['hidden','offscreen','paused','seeking']);
function selectedAxes(dimensions, axes, minimum) {
  const indexes = axes === undefined ? dimensions.map((_, i) => i) : axes.map(axis => typeof axis === 'string' ? dimensions.indexOf(axis) : axis);
  if (!indexes.length || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= dimensions.length)) throw new RangeError('Unknown visualiser axis');
  if (new Set(indexes).size !== indexes.length) throw new TypeError('Visualiser axes must be unique');
  if (indexes.length < minimum) throw new RangeError(`Visualiser requires at least ${minimum} selected axes`);
  return Object.freeze(indexes);
}
function historyWindow(data, pip, indexes, historyPips, historyStride, recording) {
  const key = `${pip}:${indexes.join(',')}:${historyPips}:${historyStride}`;
  let history = data.windows.get(key);
  if (!history) {
    history = [];
    for (let i = 0; i < historyPips; i++) {
      const agePips = i * historyStride, position = pip - agePips;
      if (recording && position < data.sampler.clock.start_pip) break;
      const values = cachedSample(data, position);
      history.push(Object.freeze({pip: position, agePips,
        ageSeconds: recording ? agePips * 60 / (data.sampler.clock.bpm * 64) : null,
        values: Object.freeze(indexes.map(index => values[index]))}));
    }
    history = Object.freeze(history.reverse());
    data.windows.set(key, history);
    if (data.windows.size > 16) data.windows.delete(data.windows.keys().next().value);
  }
  return {key, history};
}

export function createVisualiserService(scope, runtime, config, resources = createVisualiserResources(scope, runtime)) {
  const handles = new Map(), patterns = new Map();
  const host = scope.root.ownerDocument.defaultView;
  function acquirePattern(name, row) {
    let entry = patterns.get(name);
    if (!entry) {
      const dimensions = Object.freeze(['x','y','z'].slice(0, row.dimensions));
      entry = {refs: 0, data: {sampler: {dimensions, name,
        sample(pip) {const value = runtime.rudiments.sample(name, pip);return dimensions.map(axis => value[axis]);}},
        samples: new Map(), windows: new Map()}};
      patterns.set(name, entry);
    }
    entry.refs++;
    let released = false;
    return {promise: runtime.rudiments.ready().then(() => entry.data), release() {
      if (released) return;released = true;
      if (--entry.refs === 0 && patterns.get(name) === entry) patterns.delete(name);
    }};
  }
  function animate(options = {}) {
    if (scope.disposed) throw new Error('DanceMoves mount is destroyed');
    const id = typeof options.id === 'string' ? options.id.trim() : '';
    if (handles.get(id)?.snapshot().status === 'error') handles.get(id).destroy();
    if (!id || id.length > 160 || handles.has(id) || runtime.rudiments.get(id)) throw new TypeError('Visualiser requires a unique id of 1..160 characters');
    resources.assertIdAvailable(id);
    const renderer = options.renderer ?? 'waveform', view = describeVisualiser(renderer);
    if (!view) throw new RangeError('Unknown visualiser renderer');
    const style = validateVisualiserStyle(renderer, options.style);
    if ([options.rudiment, options.recordingUrl, options.recording].filter(value => value !== undefined).length !== 1) throw new TypeError('Supply exactly one rudiment, recordingUrl or recording');
    const isRecording = options.rudiment === undefined;
    const rudiment = isRecording ? null : options.rudiment;
    const row = isRecording ? null : runtime.rudiments.describe(rudiment);
    if (!isRecording && !row) throw new RangeError('Unknown native rudiment');
    if (!isRecording && view.requiresSpectrum) throw new TypeError('Spectral visualisers require a calibrated Fourier recording');
    if (isRecording) for (const key of ['clock','bpm','rate','phasePips','resetOnCue']) if (Object.hasOwn(options, key)) throw new TypeError('Recording clock, rate and origin come from its capture');
    if (Object.hasOwn(options, 'bpm')) throw new TypeError('Generic pattern BPM comes from the DanceMoves page clock');
    const audio = typeof options.audio === 'string' ? resources.resolveElement(options.audio, 'Visualiser player') : options.audio;
    const clock = isRecording ? 'audio' : options.clock ?? (audio ? 'audio' : 'page');
    if (!['page','audio','auto'].includes(clock)) throw new TypeError('clock must be page, audio or auto');
    if (clock !== 'page' && !audio) throw new TypeError('Visualiser requires an audio/player source for this clock');
    const rate = numberStyle(options, 'rate', 1, Number.MIN_VALUE, 64);
    const phasePips = numberStyle(options, 'phasePips', 0, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true);
    const resetOnCue = options.resetOnCue;
    if (resetOnCue !== undefined && typeof resetOnCue !== 'boolean' && typeof resetOnCue !== 'string') throw new TypeError('resetOnCue must be boolean or a cue name');
    const historyPips = numberStyle(options, 'historyPips', 256, 1, 512, true);
    const historyStride = numberStyle(options, 'historyStride', 1, 1, 120, true);
    const pixelRatio = numberStyle(options, 'pixelRatio', Math.min(3, Math.max(1, host.devicePixelRatio || 1)), .5, 4);
    for (const key of ['enabled','offscreen']) if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new TypeError(`${key} must be boolean`);
    if (options.onFrame !== undefined && typeof options.onFrame !== 'function') throw new TypeError('onFrame must be a function');
    if (options.axes !== undefined && (!Array.isArray(options.axes) || !options.axes.length || options.axes.length > 64 ||
      options.axes.some(axis => typeof axis !== 'string' && (!Number.isInteger(axis) || axis < 0 || axis > 63)))) throw new TypeError('axes must contain 1..64 dimension names or indexes');
    const axes = options.axes === undefined ? undefined : [...options.axes];
    if (row) selectedAxes(['x','y','z'].slice(0, row.dimensions), axes, view.minDimensions);
    const url = options.recordingUrl === undefined ? null : resources.recordingUrl(options.recordingUrl);
    const source = audio ? runtime.playbackSource(audio) : null, initialSource = playbackIdentity(source);
    const target = resources.resolveElement(options.target, 'Visualiser canvas');
    if (target.tagName.toLowerCase() !== 'canvas' || typeof target.getContext !== 'function') throw new TypeError('Visualiser target must be a canvas');
    resources.assertCanvasAvailable(target);
    const context = target.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    // Extract callback/options before creating long-lived closures. No handle,
    // including a retained scheduler handle, keeps the caller's recording JSON.
    let onFrame = options.onFrame;
    const offscreen = options.offscreen !== false;
    let destroyed = false, inner = null, activeData = null, acquired = null, bands = null, indexes = null, dimensions = null;
    let enabled = options.enabled !== false, paused = false, status = 'loading', error = null, last = null, drawn = '';
    const surface = createCanvasSurface(scope, target, context, {type: 'visualiser', label: view.label, pixelRatio,
      refresh() {drawn = '';inner?.refresh();}});
    function state(reason) {status = reason;surface.state(reason);}
    function clear(reason, pip = null, sourceSeconds = null) {
      state(reason);surface.clear();drawn = '';
      last = Object.freeze({id, renderer, rudiment, pip, sourceSeconds, reason, dimensions, values: null, historyLength: 0, report: null});
      onFrame?.(last);
    }
    function release() {acquired?.release();acquired = null;activeData = null;bands = null;indexes = null;dimensions = null;onFrame = null;}
    function destroy() {
      if (destroyed) return;destroyed = true;inner?.destroy();inner = null;release();last = null;
      surface.destroy();status = 'destroyed';handles.delete(id);resources.releaseCanvas(target);
    }
    function fail(failure) {
      if (destroyed) return;
      error = String(failure.message || failure);inner?.destroy();inner = null;release();last = null;
      surface.stop();surface.clear();state('error');
    }
    const handle = {id, ready: null, destroy, teardown: destroy,
      setEnabled(value) {if (typeof value !== 'boolean') throw new TypeError('enabled must be boolean');if (!destroyed) {enabled = value;inner?.setEnabled(value);}},
      pause() {if (!destroyed) {paused = true;inner?.pause();}},
      resume() {if (!destroyed) {paused = false;inner?.resume();}},
      refresh() {if (!destroyed) inner?.refresh();},
      reset() {if (isRecording) throw new TypeError('A saved recording retains its capture origin');if (!destroyed) inner?.reset();},
      snapshot() {
        const native = inner?.snapshot();
        return {id, type: 'visualiser', renderer, rudiment, recordingUrl: url,
          status: destroyed ? 'destroyed' : native?.status === 'error' ? 'error' : heldReasons.has(native?.status) ? native.status : status,
          error: error || native?.error || null, destroyed, enabled, paused, clock, rate: isRecording ? null : rate,
          pip: last?.pip ?? null, sourceSeconds: last?.sourceSeconds ?? null, dimensions: dimensions || [],
          values: last?.values ?? null, historyLength: last?.historyLength ?? 0, report: last?.report ?? null,
          historyPips, historyStride, canvasWidth: target.width, canvasHeight: target.height};
      }
    };
    handles.set(id, handle);resources.claimCanvas(target, handle);
    acquired = url ? resources.acquire(url) : isRecording ? null : acquirePattern(rudiment, row);
    handle.ready = (acquired?.promise || resources.prepare(options.recording)).then(data => {
      if (destroyed || scope.disposed) return handle;
      activeData = data;indexes = selectedAxes(data.sampler.dimensions, axes, view.minDimensions);
      dimensions = Object.freeze(indexes.map(index => data.sampler.dimensions[index]));
      bands = view.requiresSpectrum ? validateSpectrumBands(data.recording, indexes) : null;
      const analysisStyle = view.requiresSpectrum ? view.styleFamily === 'spectrum' ? style :
        validateSpectrumStyle({floor_db: style.floor_db, ceiling_db: style.ceiling_db}) : null;
      const analysisKey = analysisStyle ? JSON.stringify(analysisStyle) : '';
      // The dimension-map callback captures this lexical slot. Clear it before
      // installing a retained driver so activeData is the only table owner here.
      data = null;
      // The existing native driver owns RAF, audio seeks, page/auto clocks,
      // visibility, preferences, cue resets and phase/rate for generic patterns.
      inner = runtime.rudiments.animate({id, target, root: target, audio, clock, rudiment: rudiment || 'circle',
        ...(isRecording ? {} : {rate, phasePips, resetOnCue}), amplitude: 0, css: false, renderEveryFrame: true, enabled, offscreen,
        render(frame) {
          if (destroyed || !activeData) return;
          try {
            const capture = activeData.sampler;
            const seconds = frame.audio ? Number(frame.audio.currentTime) : frame.sourceBeats * 60 / config.bpm;
            const pip = isRecording ? Math.floor((seconds - capture.clock.beat_zero_seconds) * capture.clock.bpm / 60 * 64 + 1e-8) : frame.positionPips;
            if (neutralReasons.has(frame.reason)) return clear(frame.reason, pip, seconds);
            if (isRecording && playbackIdentity(source) !== initialSource) return clear('source-mismatch', pip, seconds);
            if (!Number.isFinite(seconds) || !Number.isSafeInteger(pip) ||
                isRecording && (pip < capture.clock.start_pip || pip >= capture.clock.start_pip + capture.count)) return clear('outside-recording', pip, seconds);
            state(frame.reason);
            const key = `${pip}:${surface.revision}:${view.styleFamily === 'wire' ? seconds : ''}`;
            if (drawn === key) return;
            const window = historyWindow(activeData, pip, indexes, view.usesHistory ? historyPips : 1, historyStride, isRecording);
            const values = window.history.at(-1).values;
            let report = null;
            if (bands) {
              const reportKey = `visualiser:${window.key}:${analysisKey}`;
              report = activeData.reports.get(reportKey);
              if (!report) {
                report = freezeSpectrumReport(analyseSpectrum(bands, values, window.history.slice(0, -1), analysisStyle));
                activeData.reports.set(reportKey, report);
                if (activeData.reports.size > 32) activeData.reports.delete(activeData.reports.keys().next().value);
              }
            }
            drawVisualiser(context, surface.width, surface.height, {values, dimensions, history: window.history,
              pip, sourceSeconds: seconds, historySpanPips: Math.max(1, (historyPips - 1) * historyStride), bands, report}, renderer, style);
            drawn = key;
            last = Object.freeze({id, renderer, rudiment, pip, sourceSeconds: seconds, reason: frame.reason,
              dimensions, values, historyLength: window.history.length, report});
            onFrame?.(last);
          } catch (failure) {fail(failure);throw failure;}
        }});
      if (paused) inner.pause();
      return inner.ready.then(() => {if (error) throw new Error(error);return handle;});
    }).catch(failure => {
      if (destroyed || scope.disposed) return handle;
      fail(failure);throw failure;
    });
    handle.ready.catch(() => {});
    return Object.freeze(handle);
  }
  function mountPage() {
    if (!config.visualiserRecordingUrl && !config.visualiserRudiment) return [];
    const selector = 'canvas[data-dance-moves-visualiser]';
    const canvases = [...(scope.root.matches(selector) ? [scope.root] : []), ...scope.root.querySelectorAll(selector)];
    return canvases.map((target, i) => {
      const id = `${scope.id}:visualiser:${i}`;
      const renderer = target.getAttribute('data-dance-moves-visualiser-renderer') || target.getAttribute('data-dance-moves-visualiser') || config.visualiserRenderer || 'waveform';
      try {
        const audioSelector = target.getAttribute('data-dance-moves-visualiser-audio');
        const audio = audioSelector ? resources.resolveElement(audioSelector, 'Visualiser player') : scope.root.querySelector('audio[data-dance-moves-master]') || scope.root.querySelector('audio,video');
        return animate({id, target, audio: audio || undefined,
          ...(config.visualiserRecordingUrl ? {recordingUrl: config.visualiserRecordingUrl} : {rudiment: config.visualiserRudiment}),
          ...(config.visualiserAxes?.length ? {axes: config.visualiserAxes} : {}), renderer});
      } catch (failure) {
        // A malformed declarative canvas must not tear down the song player or
        // other correctly configured views. Readiness still reports the error.
        let surface = null, claimed = false, destroyed = false;
        const ready = Promise.reject(failure);ready.catch(() => {});
        const handle = {id, ready, setEnabled() {}, pause() {}, resume() {}, refresh() {}, reset() {},
          snapshot: () => ({id, type: 'visualiser', renderer, rudiment: config.visualiserRudiment || null,
            recordingUrl: config.visualiserRecordingUrl || null, status: destroyed ? 'destroyed' : 'error', error: String(failure.message || failure),
            destroyed, enabled: false, paused: false, clock: config.visualiserRecordingUrl ? 'audio' : 'page', rate: null,
            pip: null, sourceSeconds: null, dimensions: [], values: null, historyLength: 0, report: null,
            historyPips: 256, historyStride: 1, canvasWidth: target.width, canvasHeight: target.height}),
          destroy() {if (destroyed) return;destroyed = true;surface?.destroy();surface = null;if (claimed) resources.releaseCanvas(target);handles.delete(id);}
        };
        handle.teardown = handle.destroy;
        try {
          resources.assertCanvasAvailable(target);
          const context = target.getContext('2d');
          if (context) {
            surface = createCanvasSurface(scope, target, context, {type:'visualiser',label:'Rudiment visualiser',pixelRatio:1,refresh() {}});
            surface.stop();surface.state('error');
          }
          resources.claimCanvas(target, handle);claimed = true;
        } catch { /* Another API may already own this authored canvas. */ }
        handles.set(id, handle);
        return Object.freeze(handle);
      }
    });
  }
  function destroyAll() {for (const handle of [...handles.values()]) handle.destroy();}
  scope.onDispose(destroyAll);
  return Object.freeze({animate, mountPage, catalogue: () => VISUALISER_CATALOGUE, describe: describeVisualiser,
    get: id => handles.get(id) || null, destroyAll,
    snapshot: () => ({renderers: VISUALISER_RENDERERS, sources: resources.sourceCount(), patterns: patterns.size, instances: [...handles.values()].map(handle => handle.snapshot())})});
}
